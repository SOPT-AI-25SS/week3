/*
 * /api/transcribe (POST)
 * ----------------------
 * Body(JSON): { gcsPath: string, mimeType?: string, prompt?: string }
 *  - `gcsPath`: gs://bucket/path/to/file
 *  - `mimeType`: Optional MIME type (default: "audio/webm")
 *  - `prompt`:   Optional instruction prompt for Gemini, default is
 *                "Transcribe the audio into English text."
 *
 * Response(JSON):
 *  Success: { success: true, transcript: string }
 *  Error:   { success: false, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createPartFromUri, createUserContent } from "@google/genai";

import { getGenaiClient } from "@/lib/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Types -----------------------------------------------------------------

interface TranscribeRequestBody {
  gcsPath?: unknown;
  mimeType?: unknown;
  prompt?: unknown;
}

type SuccessResponse = { success: true; transcript: string };
type ErrorResponse = { success: false; message: string };

// --- Constants -------------------------------------------------------------

const DEFAULT_MIME_TYPE = "audio/webm";
const DEFAULT_PROMPT = "Transcribe the audio into English text.";

// --- Handler ---------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranscribeRequestBody;

    if (typeof body.gcsPath !== "string" || !body.gcsPath.startsWith("gs://")) {
      return jsonError("`gcsPath` must be a valid gs:// URI.", 400);
    }

    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.trim() !== ""
        ? body.mimeType
        : DEFAULT_MIME_TYPE;

    const instructionPrompt =
      typeof body.prompt === "string" && body.prompt.trim() !== ""
        ? body.prompt
        : DEFAULT_PROMPT;

    const genai = getGenaiClient();

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash", // Low latency, suitable for transcription
      contents: createUserContent([
        createPartFromUri(body.gcsPath, mimeType),
        instructionPrompt,
      ]),
    });

    if (!response.text || response.text.trim() === "") {
      return jsonError("Model returned empty transcript.", 502);
    }

    return NextResponse.json<SuccessResponse>({
      success: true,
      transcript: response.text.trim(),
    });
  } catch (error) {
    console.error("/api/transcribe error", error);
    return jsonError("Internal server error.", 500);
  }
}

// --- Helpers ---------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}
