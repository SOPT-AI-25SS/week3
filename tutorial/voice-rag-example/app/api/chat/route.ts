import { NextResponse } from "next/server";

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

    const ragCorpusName = process.env.RAG_CORPUS_NAME;

    const ragTool = ragCorpusName
      ? {
          retrieval: {
            vertexRagStore: {
              ragResources: [{ ragCorpus: ragCorpusName }],
              similarityTopK: 5,
            },
          },
        }
      : undefined;

    const { VertexAI } = await import("@google-cloud/vertexai");
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

    // streamContent typing mismatch across SDK versions; cast to any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamResult = await (model as any).generateContentStream({ contents });

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const chunk of (streamResult as any).stream) {
            const candidate = chunk?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            const text = part?.text as string | undefined;
            if (text) {
              controller.enqueue(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }
          controller.enqueue(`data: ${JSON.stringify({ done: true })}\n\n`);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("/api/chat error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
