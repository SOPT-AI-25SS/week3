/*
 * /api/vector-index (POST)
 * ------------------------
 * End-to-end pipeline that:
 *   1. Accepts a full transcript string (or pre-generated embeddings).
 *   2. Runs semantic chunking + dense embedding (reuse lib/semantic-chunk).
 *   3. Generates sparse embeddings (TF-IDF) and prepares JSONL.
 *   4. Uploads JSONL to GCS.
 *   5. Creates a Hybrid Vector Index + Endpoint in Vertex AI.
 *
 * Request JSON
 * {
 *   transcript: string;            // Required if `embeddings` not provided
 *   embeddings?: Array<{           // Optional – reuse output from /api/embedding
 *     chunk: string;
 *     vector: number[];
 *   }>;
 *   bufferSize?: number;           // Same as /api/embedding options
 *   percentile?: number;
 *   model?: string;                // Embedding model (dense)
 *   taskType?: string;             // Embedding taskType
 *   indexDisplayName?: string;     // Optional custom index name
 * }
 *
 * Response 200
 * {
 *   success: true,
 *   chunkCount: number,
 *   gcsUri: string,
 *   indexName: string,
 *   endpointName: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";

import { generateSemanticChunks } from "@/lib/semantic-chunk";
import {
  createHybridIndex,
  deployIndexEndpoint,
  generateHybridEmbeddings,
  toJsonLines,
  uploadJsonlToGcs,
} from "@/lib/vector-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------------------------------------------

interface RequestBody {
  transcript?: unknown;
  embeddings?: unknown;
  bufferSize?: unknown;
  percentile?: unknown;
  model?: unknown;
  taskType?: unknown;
  indexDisplayName?: unknown;
}

interface SuccessResponse {
  success: true;
  chunkCount: number;
  gcsUri: string;
  indexName: string;
  endpointName: string;
}

interface ErrorResponse {
  success: false;
  message: string;
}

// ---------------- Handler --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    // --- Input validation --------------------------------------------------

    let embeddingsInput: { chunk: string; vector: number[] }[] | null = null;

    if (Array.isArray(body.embeddings)) {
      embeddingsInput = body.embeddings.filter(
        (e): e is { chunk: string; vector: number[] } =>
          !!e && typeof e.chunk === "string" && Array.isArray(e.vector),
      );

      if (!embeddingsInput.length) {
        return jsonError("`embeddings` array is empty or invalid.", 422);
      }
    }

    if (!embeddingsInput) {
      if (typeof body.transcript !== "string" || body.transcript.trim() === "") {
        return jsonError("Either `transcript` or `embeddings` must be provided.", 422);
      }

      const bufferSize = toPositiveInt(body.bufferSize, 1);
      const percentile = toPositiveInt(body.percentile, 90);

      // Generate dense embeddings via semantic chunking.
      const { embeddings } = await generateSemanticChunks(body.transcript, {
        bufferSize,
        percentile,
        model: typeof body.model === "string" ? body.model : undefined,
        taskType: typeof body.taskType === "string" ? body.taskType : undefined,
      });

      embeddingsInput = embeddings as { chunk: string; vector: number[] }[];
    }

    // --- Hybrid embedding generation --------------------------------------

    const processed = generateHybridEmbeddings(embeddingsInput);

    const jsonl = toJsonLines(processed);

    // --- Upload JSONL to GCS ---------------------------------------------

    const bucketName = process.env.GCS_BUCKET;
    if (!bucketName) {
      return jsonError("GCS_BUCKET environment variable is not set.", 500);
    }

    const gcsUri = await uploadJsonlToGcs({ bucketName, jsonlContent: jsonl });

    // --- Vertex AI Index & Endpoint creation ------------------------------

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION ?? "us-central1";
    if (!projectId) {
      return jsonError("GCP_PROJECT_ID environment variable is not set.", 500);
    }

    const denseDims = embeddingsInput[0].vector.length;
    const sparseDims = processed[0].sparseEmbedding.indices.length
      ? Math.max(...processed.flatMap((p) => p.sparseEmbedding.indices)) + 1
      : 0;

    const indexDisplayName =
      (typeof body.indexDisplayName === "string" && body.indexDisplayName.trim() !== ""
        ? body.indexDisplayName
        : `workshop-hybrid-index-${Date.now()}`);

    const indexName = await createHybridIndex({
      projectId,
      location,
      displayName: indexDisplayName,
      gcsSourceUri: gcsUri,
      denseDimensions: denseDims,
      sparseDimensions: sparseDims,
    });

    const endpointName = await deployIndexEndpoint({
      projectId,
      location,
      displayName: `${indexDisplayName}-endpoint`,
      indexResourceName: indexName,
    });

    const res: SuccessResponse = {
      success: true,
      chunkCount: processed.length,
      gcsUri,
      indexName,
      endpointName,
    };

    return NextResponse.json(res);
  } catch (error) {
    console.error("/api/vector-index error", error);
    return jsonError(
      error instanceof Error ? error.message : "Internal server error.",
      500,
    );
  }
}

// ---------------- Utils ---------------------------------------------------

function toPositiveInt(value: unknown, defaultVal: number): number {
  const v = typeof value === "number" && !Number.isNaN(value) && value > 0 ? value : defaultVal;
  return Math.floor(v);
}

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}
