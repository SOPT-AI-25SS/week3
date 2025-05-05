import { NextResponse } from "next/server";
import { TextEncoder } from "util";

import { asCorpusPath } from "../../../lib/as-corpus-path";
import { GenerativeModel } from "@google-cloud/vertexai";
import { ragQuery, vertex } from "@/lib/google-clients";
import {google} from "@google-cloud/aiplatform/build/protos/protos";
import IRetrieveContextsResponse = google.cloud.aiplatform.v1.IRetrieveContextsResponse;
import {protos} from "@google-cloud/aiplatform";

export const runtime = "nodejs";

type Role = "user" | "assistant" | "system" | "model";

interface ChatMessage {
  role: Role;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages?: ChatMessage[] };

    if (!messages?.length) {
      return NextResponse.json({ error: "messages array missing" }, { status: 400 });
    }

    console.log("messages >>>>>>>>>>>>>> ", messages)

    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json({ error: "GCP_PROJECT_ID not set" }, { status: 500 });
    }

    console.log("projectId >>>>>>>>>>>>>> ", projectId)

    const url = new URL(req.url);
    const corpusQuery = url.searchParams.get("corpus") || process.env.RAG_CORPUS_NAME;

    const corpusPath = corpusQuery
      ? asCorpusPath(corpusQuery, projectId, process.env.GCP_LOCATION || "us-central1")
      : undefined;

    let retrievedText: string = "";
    let contexts: string[] = [];

    console.log("corpusPath >>>>>>>>>>>>>> ", corpusPath)

    type RagRetrievalCfg = protos.google.cloud.aiplatform.v1.IRagRetrievalConfig;

    const ragRetrievalConfig: RagRetrievalCfg = {
      topK: 10,
      filter: { vectorSimilarityThreshold: 0.2 },
      ranking: {
        rankService: {
          modelName: "semantic-ranker-default-004"
        }
        // llmRanker: {
        //   modelName:
        //       process.env.LLM_RANKER_MODEL ??
        //       process.env.GEN_MODEL_ID ??
        //       'gemini-1.5-pro-001',
        // },
      },
    } as RagRetrievalCfg;

    if (corpusPath) {
      // const parent = `projects/${projectId}/locations/${process.env.GCP_LOCATION || "us-central1"}`;
      const resTuple = await ragQuery.retrieveContexts({
        parent: `projects/${projectId}/locations/${process.env.GCP_LOCATION || "us-central1"}`,
        vertexRagStore: { ragResources: [{ ragCorpus: corpusPath }] },
        query: {
          text: messages.map(m => m.content).filter(Boolean).join('\n---\n'),
          ragRetrievalConfig: ragRetrievalConfig,
        },
      });

      const ctxRes: IRetrieveContextsResponse = resTuple[0];
      console.log(resTuple[0].contexts)

      const rawContexts = ctxRes.contexts?.contexts ?? [];
      const safeContexts = JSON.parse(JSON.stringify(rawContexts));
      contexts = safeContexts;

      retrievedText = safeContexts
          // @ts-expect-error safeContexts 모델 타입이 아직 SDK에 반영되지 않아 any 캐스팅
        .map((c) => (c?.text ?? "").toString())
        .filter(Boolean)
        .join("\n---\n").toString();
    }

    console.log("retrievedText >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ", retrievedText)

    const contents: {role: "user" | "assistant" | "system" | "model", parts: {text: string}[]}[] = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const systemInstruction: string = retrievedText
      ? `Use the following context snippets to answer accurately in Korean. If the answer is not contained, say "I do not know".\n\n${retrievedText}`
      : `Say I don't know`;

    console.log("systemInstruction >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ", systemInstruction);
    console.log("contents (chat history) >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ", contents);

    const model: GenerativeModel = vertex.getGenerativeModel({
      model: process.env.GEN_MODEL_ID || "gemini-2.5-flash-preview-04-17",
      generationConfig: { maxOutputTokens: 2048 },
    });

    const geminiStream = await model.generateContentStream({
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    const encoder: TextEncoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`ctx:${JSON.stringify(contexts)}\n`));

          for await (const chunk of (geminiStream).stream) {
            const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
            if (text) controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }

          controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: "stop" })}\n`));
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
