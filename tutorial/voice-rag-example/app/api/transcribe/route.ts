import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
  Part,
} from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Buffer required for base64 handling

// ===== Constants =====
const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20 MB
const MODEL_ID = "gemini-2.0-flash";
const TRANSCRIBE_PROMPT = "Generate a transcript of the speech.";

// ===== Helpers =====
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

function buildInlineContent(base64: string, mimeType: string): Part[] {
  return [
    { text: TRANSCRIBE_PROMPT },
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ];
}

async function buildFileContent(
  buffer: Buffer,
  mimeType: string,
): Promise<Part[]> {
  const uploadRes = await genai.files.upload({
    file: buffer,
    config: { mimeType },
  });

  return createUserContent([
    createPartFromUri(uploadRes.uri, mimeType),
    TRANSCRIBE_PROMPT,
  ]);
}

// ===== Route Handler =====
export async function POST(request: Request) {
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY not configured" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field missing" }, { status: 400 });
  }

  const mimeType = file.type || "audio/webm";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contents =
    buffer.byteLength <= MAX_INLINE_BYTES
      ? buildInlineContent(buffer.toString("base64"), mimeType)
      : await buildFileContent(buffer, mimeType);

  try {
    const { text } = await genai.models.generateContent({
      model: MODEL_ID,
      contents,
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Gemini transcription error", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
