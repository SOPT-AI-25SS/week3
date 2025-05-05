import { NextResponse } from "next/server";
import { TextEncoder } from "util";

import { asCorpusPath } from "../../../lib/as-corpus-path";
import { VertexAI } from "@google-cloud/vertexai";

export const runtime = "nodejs";

type Role = "user" | "assistant" | "system" | "model";

interface ChatMessage {
  role: Role;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array missing" }, { status: 400 });
    }

    const url = new URL(req.url ?? "http://localhost");
    const qc = url.searchParams.get("corpus") || process.env.RAG_CORPUS_NAME;

    const ragCorpusFullPath =
      qc && process.env.GCP_PROJECT_ID
        ? asCorpusPath(qc, process.env.GCP_PROJECT_ID!, process.env.GCP_LOCATION || "us-central1")
        : undefined;

    const ragTool = ragCorpusFullPath
      ? {
          retrieval: {
            vertexRagStore: {
              ragResources: [{ ragCorpus: ragCorpusFullPath }],
              similarityTopK: 5,
            },
          },
        }
      : undefined;

    const vertex = new VertexAI({
      project: process.env.GCP_PROJECT_ID!,
      location: process.env.GCP_LOCATION || "us-central1",
    });

    const model = vertex.getGenerativeModel({
      model: process.env.GEN_MODEL_ID || "gemini-1.5-pro-001",
      ...(ragTool ? { tools: [ragTool] } : {}),
      generationConfig: { maxOutputTokens: 1024 },
    });

    // Transform incoming messages to Vertex AI expected structure
    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    // get a streaming response from Gemini:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamResult = await (model as any).generateContentStream({ contents });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of (streamResult).stream) {
            const candidate = chunk?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            const text = part?.text as string | undefined;
            if (!text) continue;

            // Encode as data-stream text part (code "0").
            controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }

          // Signal completion with a finish_message part (code "d").
          controller.enqueue(
            encoder.encode(`d:${JSON.stringify({ finishReason: "stop" })}\n`),
          );
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("/api/chat error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
