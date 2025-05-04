#!/usr/bin/env ts-node
// @ts-nocheck
/**
 * scripts/create-corpus.ts <gcs://bucket/path/data.jsonl>
 *
 * 1. Ensures a RAG Corpus exists (creates if absent).
 * 2. Imports provided JSONL (already embedded) with chunkSize 0.
 *
 * Env vars required:
 *  - GCP_PROJECT_ID
 *  - GCP_LOCATION (default us-central1)
 *  - RAG_CORPUS_NAME
 *  - EMBEDDING_MODEL_ID (e.g. text-embedding-004)
 */

import { ragData } from "../lib/google-clients";

// Configuration constants
const DEFAULT_LOCATION = "us-central1";

const PROJECT = process.env.GCP_PROJECT_ID ?? "";
const LOCATION = process.env.GCP_LOCATION ?? DEFAULT_LOCATION;
const CORPUS_DISPLAY_NAME = process.env.RAG_CORPUS_NAME ?? "voice-rag-corpus";
const EMB_MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? "text-embedding-004";

if (!PROJECT) {
  console.error("GCP_PROJECT_ID env missing");
  process.exit(1);
}

async function ensureCorpus(): Promise<string> {
  const parent = ragData.locationPath(PROJECT, LOCATION);
  const [list] = await ragData.listRagCorpora({ parent });
  const existing = list.find((c) => c.displayName === CORPUS_DISPLAY_NAME);
  if (existing?.name) {
    console.log("✅ Corpus exists:", existing.name);
    return existing.name;
  }

  console.log("🆕 Creating corpus…");
  const [op] = await ragData.createRagCorpus({
    parent,
    ragCorpus: {
      displayName: CORPUS_DISPLAY_NAME,
      ragEmbeddingModelConfig: {
        vertexPredictionEndpoint: {
          publisherModel: `publishers/google/models/${EMB_MODEL_ID}`,
        },
      },
    },
  });

  const [corpus] = await op.promise();
  console.log("✅ Created:", corpus.name);
  return corpus.name as string;
}

async function importJsonl(corpusName: string, gcsUri: string) {
  console.log("⏫ Importing", gcsUri);
  const [op] = await ragData.importRagFiles({
    parent: corpusName,
    importRagFilesConfig: {
      gcsSource: { uris: [gcsUri] },
      ragFileChunkingConfig: { chunkSize: 0 },
    },
  });
  await op.promise();
  console.log("✅ Import completed");
}

async function main() {
  const gcsUri = process.argv[2];
  if (!gcsUri?.startsWith("gs://")) {
    console.error("Usage: ts-node scripts/create-corpus.ts gs://bucket/path.jsonl");
    process.exit(1);
  }

  const corpusName = await ensureCorpus();
  await importJsonl(corpusName, gcsUri);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
