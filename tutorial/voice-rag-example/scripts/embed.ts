#!/usr/bin/env ts-node
// @ts-nocheck
/**
 * scripts/embed.ts
 *
 * Usage:  npx ts-node scripts/embed.ts path/to/transcript.txt
 *
 * 1. Reads raw transcript text (UTF-8).
 * 2. Runs semantic chunking → embeddings.
 * 3. Writes JSONL file (id, embedding, text).
 * 4. Uploads to GCS bucket defined by GCS_BUCKET_NAME.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { vertex, storage } from "../lib/google-clients";
import { chunkAndEmbed, ChunkRecord } from "../lib/semantic-chunk";

// Instantiate embedding model once
const embedModel = vertex.getGenerativeModel({
  model: process.env.EMBEDDING_MODEL_ID || "text-embedding-004",
});

// Validate environment variables
const BUCKET = process.env.GCS_BUCKET_NAME;
const EMB_MODEL = process.env.EMBEDDING_MODEL_ID || "text-embedding-004";

if (!BUCKET) {
  console.error("GCS_BUCKET_NAME env missing");
  process.exit(1);
}

const transcriptPath = process.argv[2];
if (!transcriptPath) {
  console.error("Usage: ts-node scripts/embed.ts <transcript.txt>");
  process.exit(1);
}

const embedText = async (text: string): Promise<number[]> => {
  const [{ values }] = (
    await embedModel.embedContent({
      content: { role: "user", parts: [{ text }] },
    })
  ).embedding!;
  return values;
};

async function main() {
  const transcript = await fs.readFile(transcriptPath, "utf8");

  console.log("📑 Loaded transcript chars:", transcript.length);

  const records: ChunkRecord[] = await chunkAndEmbed(transcript, embedText);

  console.log("🔹 Chunks generated:", records.length);

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");

  const fileName = `rag-data-${Date.now()}.jsonl`;
  const localPath = path.join(path.dirname(fileURLToPath(import.meta.url)), fileName);

  await fs.writeFile(localPath, jsonl);
  console.log("💾 JSONL written to", localPath);

  const destFile = storage.bucket(BUCKET).file(`rag/${fileName}`);
  await destFile.save(jsonl, { resumable: false, contentType: "application/json" });
  console.log("☁️  Uploaded to gs://" + BUCKET + "/rag/" + fileName);
}

main().catch((err) => {
  console.error("embed script error", err);
  process.exit(1);
});
