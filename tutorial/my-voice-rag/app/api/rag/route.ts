/**
 * POST /api/rag
 * --------------
 * Clean, SRP-oriented RAG endpoint:
 *   1. Embed user question.
 *   2. Hybrid-search top-k chunks.
 *   3. Generate answer with Gemini using retrieved context.
 */

import { NextRequest, NextResponse } from "next/server";

import { embedQuestion, generateAnswer, retrieveChunks } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------

interface RagRequestBody {
  endpoint?: unknown;
  question?: unknown;
  topK?: unknown;
  llmModel?: unknown;
  embeddingModel?: unknown;
}

interface SuccessResponse {
  success: true;
  answer: string;
  chunks: unknown; // opaque to client
}

interface ErrorResponse {
  success: false;
  message: string;
}

// Defaults ---------------------------------------------------------------

const DEFAULT_LLM_MODEL = "gemini-1.5-pro-preview";
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-exp-03-07";

// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RagRequestBody;

    // Validate input early and clearly
    if (!isVertexEndpoint(body.endpoint)) {
      return error("`endpoint` must be a valid Vertex IndexEndpoint resource name.", 422);
    }

    if (!isNonEmptyString(body.question)) {
      return error("`question` must be a non-empty string.", 422);
    }

    const topK = parseTopK(body.topK);

    // -------------------------------------------------------------------
    // 1. Embed question
    // -------------------------------------------------------------------

    const queryVector = await embedQuestion({
      question: body.question,
      model: coalesceString(body.embeddingModel, DEFAULT_EMBEDDING_MODEL),
    });

    // -------------------------------------------------------------------
    // 2. Retrieve chunks with hybrid search
    // -------------------------------------------------------------------

    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      return error("GCP_PROJECT_ID environment variable is not set.", 500);
    }

    const location = process.env.GCP_LOCATION ?? "us-central1";

    const chunks = await retrieveChunks({
      endpoint: body.endpoint,
      projectId,
      location,
      queryVector,
      topK,
    });

    // -------------------------------------------------------------------
    // 3. Generate answer
    // -------------------------------------------------------------------

    const answer = await generateAnswer({
      chunks,
      question: body.question,
      model: coalesceString(body.llmModel, DEFAULT_LLM_MODEL),
    });

    return NextResponse.json<SuccessResponse>({ success: true, answer, chunks });
  } catch (err) {
    console.error("/api/rag error", err);
    return error("Internal server error.", 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers – kept small & intention-revealing
// ---------------------------------------------------------------------------

function error(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isVertexEndpoint(value: unknown): value is string {
  return isNonEmptyString(value) && value.includes("indexEndpoints/");
}

function parseTopK(input: unknown): number {
  const num = typeof input === "number" && input > 0 && input <= 20 ? input : 5;
  return Math.floor(num);
}

function coalesceString(value: unknown, fallback: string): string {
  return isNonEmptyString(value) ? value : fallback;
}
