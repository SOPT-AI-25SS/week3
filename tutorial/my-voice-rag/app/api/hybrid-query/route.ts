/*
 * /api/hybrid-query (POST)
 * ------------------------
 * Performs a hybrid similarity search against a deployed Vertex AI Vector
 * Search endpoint and returns raw prediction results.
 *
 * Request JSON
 * {
 *   endpoint: string;             // required – full resource name
 *   denseQuery: number[];         // required – dense embedding vector
 *   sparseQuery?: {               // optional – sparse indices & values
 *     indices: number[];
 *     values: number[];
 *   };
 *   topK?: number;                // optional – default 5
 * }
 *
 * Response 200
 * { success: true, prediction: unknown }
 */

import { NextRequest, NextResponse } from "next/server";

import { queryHybridIndex } from "@/lib/vector-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------- Types ----------------------------------------------------

interface RequestBody {
  endpoint?: unknown;
  denseQuery?: unknown;
  sparseQuery?: unknown;
  topK?: unknown;
}

interface SuccessResponse {
  success: true;
  prediction: unknown;
}

interface ErrorResponse {
  success: false;
  message: string;
}

// ---------------- Handler --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (typeof body.endpoint !== "string" || !body.endpoint.includes("indexEndpoints")) {
      return jsonError("`endpoint` must be a valid Vertex IndexEndpoint resource name.", 422);
    }

    if (!Array.isArray(body.denseQuery) || body.denseQuery.some((v) => typeof v !== "number")) {
      return jsonError("`denseQuery` must be an array of numbers.", 422);
    }

    let sparseQuery: { indices: number[]; values: number[] } | undefined;
    if (body.sparseQuery) {
      const sq = body.sparseQuery as { indices?: unknown; values?: unknown };
      if (
        !Array.isArray(sq.indices) ||
        !Array.isArray(sq.values) ||
        sq.indices.some((i) => typeof i !== "number") ||
        sq.values.some((v) => typeof v !== "number") ||
        sq.indices.length !== sq.values.length
      ) {
        return jsonError("`sparseQuery` must contain `indices` and `values` arrays of equal length.", 422);
      }
      sparseQuery = { indices: sq.indices, values: sq.values };
    }

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION ?? "us-central1";
    if (!projectId) {
      return jsonError("GCP_PROJECT_ID environment variable is not set.", 500);
    }

    const prediction = await queryHybridIndex({
      endpoint: body.endpoint,
      projectId,
      location,
      denseQuery: body.denseQuery as number[],
      sparseQuery,
      topK: typeof body.topK === "number" ? body.topK : 5,
    });

    const res: SuccessResponse = { success: true, prediction };
    return NextResponse.json(res);
  } catch (error) {
    console.error("/api/hybrid-query error", error);
    return jsonError("Internal server error.", 500);
  }
}

// ---------------- Utils ---------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}
