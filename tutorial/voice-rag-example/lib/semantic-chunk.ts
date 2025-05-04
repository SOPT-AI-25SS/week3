/**
 * Semantic chunking utilities – adapted from docs/semantic_chunking.md.
 * The implementation keeps functions pure and avoids mutating inputs.
 */

import natural from "natural";
import * as math from "mathjs";
import { quantile } from "d3-array";
import { v4 as uuid } from "uuid";

export interface SentenceObject {
  sentence: string;
  index: number;
  combinedSentence?: string;
  embedding?: number[];
  distanceToNext?: number;
}

const tokenizer = new natural.SentenceTokenizer();

export const splitToSentences = (text: string): string[] => {
  return tokenizer.tokenize(text.trim());
};

export const structureSentences = (
  sentences: string[],
  bufferSize: number,
): SentenceObject[] => {
  const arr: SentenceObject[] = sentences.map((s, i) => ({ sentence: s, index: i }));

  arr.forEach((cur, idx) => {
    const before = arr.slice(Math.max(0, idx - bufferSize), idx).map((o) => o.sentence);
    const after = arr
      .slice(idx + 1, Math.min(arr.length, idx + bufferSize + 1))
      .map((o) => o.sentence);
    cur.combinedSentence = [...before, cur.sentence, ...after].join(" ").trim();
  });

  return arr;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  const dot = (math.dot(a, b) as number) ?? 0;
  const normA = (math.norm(a) as number) || 1e-9;
  const normB = (math.norm(b) as number) || 1e-9;
  return dot / (normA * normB);
};

export const calculateDistances = (
  items: SentenceObject[],
): { updated: SentenceObject[]; distances: number[] } => {
  const dists: number[] = [];
  const updated = items.map((item, idx) => {
    if (idx < items.length - 1 && item.embedding && items[idx + 1].embedding) {
      const embA = item.embedding as number[];
      const embB = items[idx + 1].embedding as number[];
      const sim = cosineSimilarity(embA, embB);
      const dist = 1 - sim;
      dists.push(dist);
      return { ...item, distanceToNext: dist };
    }
    return item;
  });
  return { updated, distances: dists };
};

export const getShiftIndices = (
  distances: number[],
  percentile: number,
): number[] => {
  if (distances.length === 0) return [];
  const threshold = quantile(distances.slice().sort((a, b) => a - b), percentile / 100) ?? 0;
  return distances
    .map((dist, idx) => (dist > threshold ? idx : -1))
    .filter((x) => x !== -1);
};

export const groupIntoChunks = (
  items: SentenceObject[],
  shiftIndices: number[],
): string[] => {
  const chunks: string[] = [];
  let start = 0;
  const breakpoints = [...shiftIndices, items.length - 1];
  breakpoints.forEach((bp) => {
    const group = items.slice(start, bp + 1).map((o) => o.sentence).join(" ");
    if (group.trim()) chunks.push(group.trim());
    start = bp + 1;
  });
  return chunks;
};

export interface ChunkRecord {
  id: string;
  embedding: number[];
  text: string;
}

/**
 * High-level helper: chunk + embed + return records ready for JSONL.
 */
export async function chunkAndEmbed(
  text: string,
  embedFn: (input: string) => Promise<number[]>,
  bufferSize = 1,
  percentile = 90,
): Promise<ChunkRecord[]> {
  const sentences = splitToSentences(text);
  const sentenceObjs = structureSentences(sentences, bufferSize);

  // Embed combined sentences to compute shift indices
  for (const obj of sentenceObjs) {
    if (obj.combinedSentence) {
      obj.embedding = await embedFn(obj.combinedSentence);
    }
  }

  const { distances } = calculateDistances(sentenceObjs);
  const shiftIndices = getShiftIndices(distances, percentile);

  const chunks = groupIntoChunks(sentenceObjs, shiftIndices);

  // Embed final chunks for corpus storage
  const records: ChunkRecord[] = [];
  for (const chunk of chunks) {
    const embedding = await embedFn(chunk);
    records.push({ id: uuid(), embedding, text: chunk });
  }

  return records;
}
