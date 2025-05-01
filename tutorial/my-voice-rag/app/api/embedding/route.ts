/**
 * Semantic chunking + Gemini Embedding
 * ------------------------------------
 * POST /api/embedding
 *
 * Body JSON
 * {
 *   transcript: string;            // required
 *   bufferSize?: number;           // optional, default 1
 *   percentile?: number;           // optional, default 90 (0–100)
 *   taskType?: string;             // optional, Gemini taskType
 *   model?: string;                // optional, embedding model id
 * }
 *
 * Response 200
 * {
 *   success: true,
 *   chunkCount: number,
 *   breakpoints: number[],
 *   embeddings: Array<{ chunk: string; vector: unknown }>
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateSemanticChunks } from "@/lib/semantic-chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------------------------------------------

interface RequestBody {
  transcript?: unknown;
  bufferSize?: unknown;
  percentile?: unknown;
  taskType?: unknown;
  model?: unknown;
}

interface SuccessResponse {
  success: true;
  chunkCount: number;
  breakpoints: number[];
  embeddings: { chunk: string; vector: unknown }[];
}

interface ErrorResponse {
  success: false;
  message: string;
}

// ---------------- Entry ----------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (typeof body.transcript !== "string" || body.transcript.trim() === "") {
      return jsonError("`transcript` must be a non-empty string.", 422);
    }

    const bufferSize = toPositiveInt(body.bufferSize, 1);
    const percentile = toPositiveInt(body.percentile, 90);

    const { breakpoints, embeddings } = await generateSemanticChunks(
      body.transcript,
      {
        bufferSize,
        percentile,
        model: typeof body.model === "string" ? body.model : undefined,
        taskType: typeof body.taskType === "string" ? body.taskType : undefined,
      },
    );

    const res: SuccessResponse = {
      success: true,
      chunkCount: embeddings.length,
      breakpoints,
      embeddings,
    };

    return NextResponse.json(res);
  } catch (error) {
    console.error("/api/embedding error", error);
    return jsonError("Internal server error.", 500);
  }
}

// ---------------- Utils ----------------------------------------------------

function toPositiveInt(value: unknown, defaultVal: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return defaultVal;
  }
  return Math.floor(value);
}

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}
