import { randomUUID } from "crypto";

import { uploadBufferToGcs } from "@/lib/gcs";
import { ChunkEmbedding } from "@/lib/semantic-chunk";

/**
 * Data structure holding dense & sparse embeddings for a chunk.
 */
export interface SparseVector {
  /** Zero-based indices of the non-zero dimensions. */
  indices: number[];
  /** Values (weights) corresponding to `indices`. */
  values: number[];
}

export interface ProcessedChunk {
  /** Unique identifier – suitable for Vertex Index `id`. */
  id: string;
  /** Original text of the chunk. */
  text: string;
  /** Dense embedding from Gemini/Vertex Embedding. */
  denseEmbedding: number[];
  /** Sparse representation derived from TF-IDF. */
  sparseEmbedding: SparseVector;
}

/**
 * Computes sparse (TF-IDF) embeddings for the given chunks and returns
 * `ProcessedChunk` objects containing both dense & sparse vectors.
 */
export function generateHybridEmbeddings(
  denseEmbeddings: ChunkEmbedding[],
): ProcessedChunk[] {
  const documents: string[] = denseEmbeddings.map((d) => d.chunk);

  const vocabulary: Map<string, number> = buildVocabulary(documents);
  const docTermFreqs: Map<string, number>[] = documents.map((doc) => termFrequency(doc, vocabulary));
  const idf: Map<string, number> = inverseDocumentFrequency(docTermFreqs, documents.length);

  const processed: ProcessedChunk[] = denseEmbeddings.map((d, idx) => {
    const tf: Map<string, number> = docTermFreqs[idx];
    // Build sparse vector (indices & tf-idf weights).
    const indices: number[] = [];
    const values: number[] = [];
    vocabulary.forEach((termIdx, term) => {
      const tfVal = tf.get(term) ?? 0;
      if (tfVal === 0) return;
      const weight = tfVal * (idf.get(term) ?? 0);
      if (weight === 0) return;
      indices.push(termIdx);
      values.push(weight);
    });

    return {
      id: `${Date.now()}-${randomUUID()}`,
      text: d.chunk,
      denseEmbedding: d.vector as number[],
      sparseEmbedding: { indices, values },
    };
  });

  return processed;
}

/**
 * Converts the processed data into a JSON Lines string ready for Vertex AI
 * Vector Search ingestion.
 */
export function toJsonLines(chunks: ProcessedChunk[]): string {
  return chunks
    .map((c) =>
      JSON.stringify({
        id: c.id,
        embedding: c.denseEmbedding,
        sparse_embedding: c.sparseEmbedding,
        metadata: { text: c.text },
      }),
    )
    .join("\n");
}

/**
 * Uploads the JSONL content to GCS and returns the `gs://` URI.
 */
export async function uploadJsonlToGcs(params: {
  bucketName: string;
  jsonlContent: string;
}): Promise<string> {
  const buffer = Buffer.from(params.jsonlContent, "utf8");
  return uploadBufferToGcs({
    bucketName: params.bucketName,
    buffer,
    contentType: "application/jsonl",
    extension: "jsonl",
  });
}

/********************* Private helpers ******************************/

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildVocabulary(docs: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const doc of docs) {
    for (const token of tokenize(doc)) {
      if (!vocab.has(token)) {
        vocab.set(token, vocab.size);
      }
    }
  }
  return vocab;
}

function termFrequency(
  doc: string,
  vocab: Map<string, number>,
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokenize(doc)) {
    if (!vocab.has(token)) continue;
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

function inverseDocumentFrequency(
  docTermFreqs: Map<string, number>[],
  docCount: number,
): Map<string, number> {
  const df = new Map<string, number>();
  for (const tf of docTermFreqs) {
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  df.forEach((count, term) => {
    // +1 smoothing to avoid division by zero.
    idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
  });
  return idf;
}

/**
 * Creates or updates a Hybrid Vector Index in Vertex AI.
 *
 * This is a thin wrapper around `@google-cloud/aiplatform` SDK. The SDK is
 * imported lazily to avoid adding it to the bundle when this code is executed
 * on the browser.
 */
export async function createHybridIndex(params: {
  projectId: string;
  location: string;
  displayName: string;
  gcsSourceUri: string;
  denseDimensions: number;
  sparseDimensions: number;
}): Promise<string> {
  const { IndexServiceClient } = await import("@google-cloud/aiplatform");

  const client = new IndexServiceClient();
  const parent = client.locationPath(params.projectId, params.location);

  const indexConfig = {
    displayName: params.displayName,
    metadataSchemaUri:
      "gs://google-cloud-aiplatform/schema/matchingengine/metadata/index_1.0.0.yaml",
    metadata: {
      contentsDeltaUri: params.gcsSourceUri,
      config: {
        dimensions: params.denseDimensions,
        distanceMeasureType: "DOT_PRODUCT_DISTANCE",
        algorithmConfig: {
          treeAhConfig: { leafNodeEmbeddingCount: 1000, leafNodesToSearchPercent: 10 },
        },
        sparseRecordConfig: {
          dimensions: params.sparseDimensions,
        },
      },
    },
    indexUpdateMethod: "STREAM_UPDATE",
  } as unknown as Parameters<InstanceType<typeof IndexServiceClient>["createIndex"]>[0]["index"];

  const [operation] = await client.createIndex({ parent, index: indexConfig });
  const [response] = await operation.promise();
  return response.name as string; // e.g. projects/.../locations/.../indexes/...
}

/**
 * Creates an Index Endpoint and deploys the given index.
 */
export async function deployIndexEndpoint(params: {
  projectId: string;
  location: string;
  displayName: string;
  indexResourceName: string;
}): Promise<string> {
  const { IndexEndpointServiceClient } = await import("@google-cloud/aiplatform");
  const client = new IndexEndpointServiceClient();
  const parent = client.locationPath(params.projectId, params.location);

  // 1. Create endpoint
  const [createOp] = await client.createIndexEndpoint({
    parent,
    indexEndpoint: { displayName: params.displayName },
  });
  const [endpointResp] = await createOp.promise();

  // 2. Deploy index to endpoint
  const [deployOp] = await client.deployIndex({
    indexEndpoint: endpointResp.name,
    deployedIndex: {
      displayName: `${params.displayName}-deployed`,
      index: params.indexResourceName,
    },
  });
  await deployOp.promise();

  return endpointResp.name as string; // projects/.../locations/.../indexEndpoints/...
}

/**
 * Executes a hybrid search query against a deployed index endpoint and returns
 * the top-k results. Requires `@google-cloud/aiplatform` RuntimeService
 * prediction client.
 */
export async function queryHybridIndex(params: {
  endpoint: string;
  projectId: string;
  location: string;
  denseQuery: number[];
  sparseQuery?: SparseVector;
  topK?: number;
}): Promise<unknown> {
  const { PredictionServiceClient } = await import("@google-cloud/aiplatform");
  const client = new PredictionServiceClient();

  const instances: Record<string, unknown>[] = [
    {
      embedding: params.denseQuery,
      sparse_embedding: params.sparseQuery ?? {},
    },
  ];

  const [prediction] = await client.predict({
    endpoint: params.endpoint,
    instances,
    parameters: { top_k: params.topK ?? 5 },
  });

  return prediction;
}
