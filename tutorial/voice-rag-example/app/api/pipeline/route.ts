import { NextResponse } from "next/server";
// import { GoogleGenAI } from "@google/genai";
import { embedAndImport } from "../../../lib/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { text, corpusId } = (await request.json()) as {
      text?: string;
      corpusId?: string;
    };

    if (!text) {
      return NextResponse.json({ error: "text missing" }, { status: 400 });
    }

    const bucket = process.env.GCS_BUCKET_NAME!;

    if (!bucket) {
      return NextResponse.json(
        { error: "GCS_BUCKET_NAME env missing" },
        { status: 500 },
      );
    }

    if (!corpusId) {
      return NextResponse.json(
        { error: "corpusId missing" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY not set" }, { status: 500 });
    }

    // const genai = new GoogleGenAI({ apiKey });
    // const modelId = process.env.EMBEDDING_MODEL_ID || "gemini-embedding-exp-03-07";

    // const embedFn = async (txt: string): Promise<number[]> => {
    //   const res = await genai.models.embedContent({
    //     model: modelId,
    //     contents: txt,
    //     config: { taskType: "RETRIEVAL_DOCUMENT" },
    //   });
    //   return res.embeddings?.[0]?.values ?? [];
    // };

    const uri = await embedAndImport(text, bucket, corpusId);

    return NextResponse.json({ ok: true, uri });
  } catch (error) {
    console.error("pipeline route error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
