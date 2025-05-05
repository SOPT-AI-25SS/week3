/**
 * Semantic chunking utilities – adapted from docs/semantic_chunking.md.
 *
 * This implementation removes the dependency on `natural` by relying on a
 * tokenizer from the `@xenova/transformers` package. The tokenizer is loaded
 * once via a small singleton helper, then reused for all subsequent sentence
 * splitting operations.  Splitting is performed by inspecting the offset map
 * produced by the tokenizer – when we encounter a token that represents a
 * sentence-terminator character (".", "!" or "?"), we slice the original
 * string at that character boundary.  No regular expressions or complex NLP
 * libraries are required, keeping the bundle size small and start-up time
 * fast.
 */

// npm i @xenova/transformers mathjs d3-array uuid
// (or use the official @huggingface/transformers when running under Node.)

import * as math from 'mathjs';
import { quantile } from 'd3-array';
import { v4 as uuid } from 'uuid';

export interface SentenceObject {
  sentence: string;
  index: number;
  combinedSentence?: string;
  embedding?: number[];
  distanceToNext?: number;
}

import type { PreTrainedTokenizer } from '@xenova/transformers';
import { AutoTokenizer } from '@xenova/transformers';

class TokenizerSingleton {
  private static model: string = 'Xenova/gpt-4';
  private static instance: PreTrainedTokenizer | null = null;

  static async get(): Promise<PreTrainedTokenizer> {
    if (!this.instance) {
      this.instance = await AutoTokenizer.from_pretrained(this.model);
    }
    return this.instance;
  }
}

export const splitToSentencesWithOffsets = async (text: string): Promise<string[]> => {
  const tokenizer = await TokenizerSingleton.get();

  // 1. Get array of token IDs
  const input_ids = tokenizer.encode(text, null, { add_special_tokens: false });

  // 2. Attempt to reconstruct approximate offsets
  const offsets: [number, number][] = [];
  let searchStart = 0;

  for (let i = 0; i < input_ids.length; i++) {
    // Decode just this one token
    const tokenStr = tokenizer.decode([input_ids[i]]);

    // Locate it in `text` starting at `searchStart`
    const idx = text.indexOf(tokenStr, searchStart);

    if (idx === -1) {
      // If we can’t find it, we must either skip or break:
      // This can happen if 'tokenStr' appears multiple times or
      // the decode doesn’t match exactly.
      console.warn('Unable to find token in text:', tokenStr);
      offsets.push([searchStart, searchStart]); // fallback
    } else {
      const end = idx + tokenStr.length;
      offsets.push([idx, end]);
      searchStart = end;
    }
  }

  // 3. Now do sentence splitting using the offsets
  const sentences: string[] = [];
  let sentenceStart = 0;

  offsets.forEach(([start, end], i) => {
    console.log('start, end, i', start, end, i)
    const tokenText = tokenizer.decode([input_ids[i]]).trim();

    // If this token ends in punctuation, we consider that a sentence boundary
    if (/[.!?]$/.test(tokenText)) {
      sentences.push(text.slice(sentenceStart, end).trim());
      sentenceStart = end;
    }
  });

  // Flush any trailing text
  if (sentenceStart < text.length) {
    sentences.push(text.slice(sentenceStart).trim());
  }

  return sentences;
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
    cur.combinedSentence = [...before, cur.sentence, ...after].join(' ').trim();
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
    const group = items.slice(start, bp + 1).map((o) => o.sentence).join(' ');
    if (group.trim()) chunks.push(group.trim());
    start = bp + 1;
  });
  return chunks;
};

export interface ChunkRecord {
  id: string;
  embedding?: number[];
  text: string;
}

/**
 * High-level helper: sentence-chunk → embed → return records ready for JSONL.
 */
export async function chunkAndEmbed(
  text: string,
  embedFn?: (input: string) => Promise<number[]>,
  bufferSize = 1,
  percentile = 90,
): Promise<ChunkRecord[]> {
  if (!embedFn) {
    const records: ChunkRecord[] = [];
    records.push({ id: uuid(), embedding: undefined, text: text });
    return records;
  }
  const sentences = await splitToSentencesWithOffsets(text);
  const sentenceObjs = structureSentences(sentences, bufferSize);

  for (const obj of sentenceObjs) {
    if (obj.combinedSentence) {
      obj.embedding = await embedFn!(obj.combinedSentence);
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
