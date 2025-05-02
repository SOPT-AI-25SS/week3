/*
 * /convert/rag (POST)
 * -------------------
 * Converts an uploaded document (PDF or image) into Markdown using a
 * Retrieval-Augmented Generation prompt. The endpoint accepts a single file
 * via multipart/form-data and returns a JSON payload of the shape:
 * {
 *   pages: [ { page_number: 1, content: "# markdown" }, … ]
 * }
 *
 * The client must include a `storm-api-key` header. If the environment
 * variable `STORM_API_KEY` is set, the header value must match; otherwise, the
 * request is rejected.
 */

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import { getGenaiClient } from "@/lib/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Config & Types
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

interface SuccessResponse {
  pages: Array<{ page_number: number; content: string }>;
}

interface ErrorResponse {
  success: false;
  message: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // --- Auth ----------------------------------------------------------------
  const apiKeyHeader = request.headers.get("storm-api-key") ?? "";
  const expectedKey = process.env.STORM_API_KEY ?? "";

  if (expectedKey && apiKeyHeader !== expectedKey) {
    return jsonError("Invalid or missing storm-api-key header.", 401);
  }

  // --- Parse multipart/form-data -----------------------------------------
  let file: File;
  try {
    const formData = await request.formData();
    const fileField = formData.get("file");

    if (!(fileField instanceof File)) {
      return jsonError("`file` field is required.", 400);
    }
    file = fileField;
  } catch (err) {
    console.error("Failed to parse form-data", err);
    return jsonError("Invalid multipart/form-data payload.", 400);
  }

  // --- Validation ---------------------------------------------------------
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return jsonError("Unsupported file type.", 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError("File exceeds the 25 MB limit.", 400);
  }

  // --- Persist to tmp & upload -------------------------------------------
  const buffer = Buffer.from(await file.arrayBuffer());
  const tmpPath = join("/tmp", `${randomUUID()}-${file.name}`);

  await fs.writeFile(tmpPath, buffer);

  try {
    const pages = await convertDocumentToMarkdown({
      filePath: tmpPath,
      mimeType: file.type,
    });

    return NextResponse.json<SuccessResponse>({ pages });
  } catch (err) {
    console.error("/convert/rag error", err);
    return jsonError("Internal server error during processing.", 500);
  } finally {
    // Best-effort clean-up.
    fs.unlink(tmpPath).catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function convertDocumentToMarkdown(params: {
  filePath: string;
  mimeType: string;
}): Promise<Array<{ page_number: number; content: string }>> {
  const ai = getGenaiClient();

  // 1) Upload file to Google AI storage
  const uploaded = await (ai as unknown as GoogleGenAI).files.upload({
    file: params.filePath,
    config: { mimeType: params.mimeType },
  });

  // The SDK typings declare `uri` as optional. If the property is missing the
  // subsequent Gemini request cannot proceed, so we fail fast with a clear
  // error message instead of relying on a non-null assertion or letting the
  // call site crash later.
  if (!uploaded.uri) {
    throw new Error("GoogleGenAI.files.upload did not return a 'uri'.");
  }

  const fileUri = uploaded.uri;

  // 2) Prompt Gemini to convert → Markdown per page (JSON)
  const prompt =
    `You are STORM Parse, an expert in understanding complex documents. ` +
    `Convert **each page** of the provided document into Markdown. ` +
    `Respond STRICTLY with valid JSON of the shape:\n` +
    `{"pages":[{"page_number":1,"content":"<markdown>"}, …]}. ` +
    `Do NOT wrap the JSON in code fences or add extra keys.`;

  const { text } = (await ai.models.generateContent({
    model: "gemini-1.5-pro-preview",
    contents: createUserContent([
      createPartFromUri(fileUri, params.mimeType),
      prompt,
    ]),
  })) as unknown as { text?: string };

  if (!text) {
    throw new Error("Gemini returned empty response.");
  }

  const jsonText = stripMarkdownCodeFence(text.trim());

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.warn("Failed to JSON.parse Gemini output", err, jsonText);
    // Fallback: return the raw markdown as single page
    return [{ page_number: 1, content: jsonText }];
  }

  if (!isPagesPayload(parsed)) {
    return [{ page_number: 1, content: jsonText }];
  }

  return parsed.pages;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}

function stripMarkdownCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\n([\s\S]*?)\n```$/i, "$1");
}

function isPagesPayload(val: unknown): val is SuccessResponse {
  if (!val || typeof val !== "object") return false;
  const pages = (val as { pages?: unknown }).pages;
  return (
    Array.isArray(pages) &&
    pages.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as { page_number?: unknown }).page_number === "number" &&
        typeof (p as { content?: unknown }).content === "string",
    )
  );
}
