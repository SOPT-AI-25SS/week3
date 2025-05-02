import { createUserContent } from "@google/genai";

import { getGenaiClient } from "@/lib/genai";
import { queryHybridIndex } from "@/lib/vector-search";

/**
 * A single chunk returned from Hybrid Vector Search.
 */
export interface RetrievedChunk {
  id: string;
  text: string;
  distance: number;
}

/**
 * Embeds a question (dense).
 */
export async function embedQuestion(params: {
  question: string;
  model: string;
}): Promise<number[]> {
  const ai = getGenaiClient();

  const resp = (await ai.models.embedContent({
    model: params.model,
    contents: params.question,
    config: { taskType: "RETRIEVAL_QUERY" },
  })) as unknown as { embeddings?: number[][] };

  const vector = resp.embeddings?.[0] ?? [];
  if (vector.length === 0) {
    throw new Error("Failed to embed question – empty vector returned.");
  }

  return vector;
}

/**
 * Runs hybrid search and returns parsed chunks.
 */
export async function retrieveChunks(params: {
  endpoint: string;
  projectId: string;
  location: string;
  queryVector: number[];
  topK: number;
}): Promise<RetrievedChunk[]> {
  const raw = await queryHybridIndex({
    endpoint: params.endpoint,
    projectId: params.projectId,
    location: params.location,
    denseQuery: params.queryVector,
    topK: params.topK,
  });

  return parseNeighbors(raw);
}

/**
 * Generates an answer given context chunks and the original question.
 */
export async function generateAnswer(params: {
  chunks: RetrievedChunk[];
  question: string;
  model: string;
}): Promise<string> {
  const ai = getGenaiClient();

  const context = params.chunks
    .map((c, idx) => `(${idx + 1}) ${c.text}`)
    .join("\n\n");

  const prompt =
    `You are an expert meeting assistant. Using ONLY the context provided, answer the question in a concise manner. ` +
    `If the answer is not contained in the context, respond with "I don't have enough information from the context provided." ` +
    `Cite supporting chunks using (1), (2)… notation.\n\nContext:\n${context}\n\nQuestion: ${params.question}`;

  const resp = (await ai.models.generateContent({
    model: params.model,
    contents: createUserContent([prompt]),
  })) as unknown as { text?: string };

  return resp.text?.trim() ?? "";
}

// -------------------------------------------------------------------------

function parseNeighbors(rawPrediction: unknown): RetrievedChunk[] {
  if (!rawPrediction || typeof rawPrediction !== "object") return [];

  const predictions = (rawPrediction as { predictions?: unknown[] }).predictions ?? [];
  const neighbors = (predictions[0] as { neighbors?: unknown[] })?.neighbors ?? [];

  return neighbors.map((n): RetrievedChunk => {
    const neighbor = n as Record<string, unknown>;

    const id =
      (neighbor.neighbor_id as string | undefined) ??
      ((neighbor.datapoint as Record<string, unknown> | undefined)?.datapoint_id as string | undefined) ??
      "";

    const distanceRaw =
      neighbor.distance ??
      (neighbor as Record<string, unknown>).similarity ??
      0;

    const distance = typeof distanceRaw === "number" ? distanceRaw : 0;

    const metadataCandidate =
      (neighbor.datapoint as Record<string, unknown> | undefined)?.datapoint_metadata ??
      (neighbor.datapoint as Record<string, unknown> | undefined)?.metadata ??
      neighbor.metadata;

    const text =
      typeof (metadataCandidate as Record<string, unknown> | undefined)?.text === "string"
        ? ((metadataCandidate as Record<string, unknown>).text as string)
        : "";

    return { id, text, distance };
  });
}
