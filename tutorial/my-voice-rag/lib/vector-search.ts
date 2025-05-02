// FILE: lib/vector-search.ts

import { randomUUID } from "crypto";
import { Buffer } from "buffer"; // Explicit import for Buffer

// Ensure the import path matches your project structure for GCS utility
import { uploadBufferToGcs } from "@/lib/gcs"; // Assuming this path is correct
// Ensure the import path matches your project structure for semantic chunking types
import { ChunkEmbedding } from "@/lib/semantic-chunk"; // Assuming this path is correct

// Import necessary clients and types from Google Cloud AI Platform SDK
// Using v1 namespace explicitly is often recommended
import {
  IndexServiceClient,
  IndexEndpointServiceClient,
  PredictionServiceClient,
  protos, // Contains generated protobuf types
} from "@google-cloud/aiplatform";

// --- Type Aliases ---
type IIndex = protos.google.cloud.aiplatform.v1.IIndex;
type IIndexEndpoint = protos.google.cloud.aiplatform.v1.IIndexEndpoint;
type IDeployedIndex = protos.google.cloud.aiplatform.v1.IDeployedIndex;
type IPredictResponse = protos.google.cloud.aiplatform.v1.IPredictResponse;

// --- Helper Type for Parsing Prediction Response ---
// Define a type for the expected structure within prediction results' neighbors list
interface Neighbor {
  structValue?: {
    fields?: {
      neighbor?: {
        structValue?: {
          fields?: {
            id?: { stringValue?: string | null };
            distance?: { numberValue?: number | null };
            // Include other fields returned by your specific index (like metadata/restricts)
            restricts?: { /* Define the structure of your restricts if needed */ };
          } | null
        } | null
      } | null;
    } | null
  } | null;
}


// ---------------------------------------------------------------------------
// Singleton Clients (Defined BEFORE they are used)
// ---------------------------------------------------------------------------
let predictionClientSingleton: PredictionServiceClient | undefined;
let indexClientSingleton: IndexServiceClient | undefined;
let indexEndpointClientSingleton: IndexEndpointServiceClient | undefined;

/**
 * Gets or creates a singleton instance of PredictionServiceClient.
 * Initializes client for a specific region if provided.
 * @param {string} [location] - Optional location (e.g., 'us-central1') to target specific regional endpoint.
 * @throws {Error} If the client fails to initialize.
 * @returns {PredictionServiceClient} The initialized client instance.
 */
function getPredictionServiceClient(location?: string): PredictionServiceClient {
  // If the singleton exists and no specific location is requested, or if the existing one matches, reuse it.
  // This simple check might need refinement if you frequently switch regions.
  // A more robust approach might store clients per region in a map.
  if (!predictionClientSingleton || (location && !predictionClientSingleton.matchLocationFromEndpointName(location))) {
    const clientOptions = location ? { apiEndpoint: `${location}-aiplatform.googleapis.com` } : {};
    try {
      predictionClientSingleton = new PredictionServiceClient(clientOptions);
      console.log(`PredictionServiceClient initialized${location ? ` for region ${location}` : ' (default region)'}.`);
    } catch (error: unknown) {
      console.error("Error initializing PredictionServiceClient:", error);
      throw new Error(`Failed to initialize PredictionServiceClient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  // Check if initialization (potentially inside the block) was successful
  if (!predictionClientSingleton) {
    throw new Error("PredictionServiceClient singleton is undefined after initialization attempt.");
  }
  return predictionClientSingleton;
}

/**
 * Gets or creates a singleton instance of IndexServiceClient.
 * @param {string} [location] - Optional location (e.g., 'us-central1').
 * @throws {Error} If the client fails to initialize.
 * @returns {IndexServiceClient} The initialized client instance.
 */
function getIndexServiceClient(location?: string): IndexServiceClient {
  if (!indexClientSingleton || (location && !indexClientSingleton.matchLocationFromEndpointName(location))) {
    const clientOptions = location ? { apiEndpoint: `${location}-aiplatform.googleapis.com` } : {};
    try {
      indexClientSingleton = new IndexServiceClient(clientOptions);
      console.log(`IndexServiceClient initialized${location ? ` for region ${location}` : ' (default region)'}.`);
    } catch (error: unknown) {
      console.error("Error initializing IndexServiceClient:", error);
      throw new Error(`Failed to initialize IndexServiceClient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  if (!indexClientSingleton) {
    throw new Error("IndexServiceClient singleton is undefined after initialization attempt.");
  }
  return indexClientSingleton;
}

/**
 * Gets or creates a singleton instance of IndexEndpointServiceClient.
 * @param {string} [location] - Optional location (e.g., 'us-central1').
 * @throws {Error} If the client fails to initialize.
 * @returns {IndexEndpointServiceClient} The initialized client instance.
 */
function getIndexEndpointServiceClient(location?: string): IndexEndpointServiceClient {
  if (!indexEndpointClientSingleton || (location && !indexEndpointClientSingleton.matchLocationFromEndpointName(location))) {
    const clientOptions = location ? { apiEndpoint: `${location}-aiplatform.googleapis.com` } : {};
    try {
      indexEndpointClientSingleton = new IndexEndpointServiceClient(clientOptions);
      console.log(`IndexEndpointServiceClient initialized${location ? ` for region ${location}` : ' (default region)'}.`);
    } catch (error: unknown) {
      console.error("Error initializing IndexEndpointServiceClient:", error);
      throw new Error(`Failed to initialize IndexEndpointServiceClient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  if (!indexEndpointClientSingleton) {
    throw new Error("IndexEndpointServiceClient singleton is undefined after initialization attempt.");
  }
  return indexEndpointClientSingleton;
}

// ---------------------------------------------------------------------------
// Data Structures
// ---------------------------------------------------------------------------

/** Data structure holding sparse embeddings. */
export interface SparseVector {
  indices: number[];
  values: number[];
}

/** Input structure for the dense query vector. */
export interface DenseQueryInput {
  values: number[];
}

/** Represents a text chunk processed with both dense and sparse embeddings. */
export interface ProcessedChunk {
  id: string;
  text: string;
  denseEmbedding: number[];
  sparseEmbedding: SparseVector;
}

// ---------------------------------------------------------------------------
// TF-IDF Calculation Helpers (Private)
// ---------------------------------------------------------------------------

/** Basic tokenizer: lowercase, split on non-alphanumeric, filter short words. */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
      .toLowerCase()
      .split(/[^a-z0-9]+/) // Split on one or more non-alphanumeric characters
      .filter((t) => t && t.length > 1); // Filter empty strings and single characters
}

/** Builds a vocabulary map (term -> unique index) from a list of documents. */
function buildVocabulary(docs: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const doc of docs) {
    for (const token of tokenize(doc)) {
      if (!vocab.has(token)) {
        vocab.set(token, vocab.size); // Assign the next available index
      }
    }
  }
  console.log(`Built vocabulary with ${vocab.size} unique terms.`);
  return vocab;
}

/** Calculates term frequency (raw count) for a single document based on the vocabulary. */
function termFrequency(doc: string, vocab: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  const tokens = tokenize(doc);
  if (tokens.length === 0) return tf; // Return empty map for empty docs

  for (const token of tokens) {
    if (vocab.has(token)) { // Only count terms present in the vocabulary
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
  }
  return tf;
}

/** Calculates inverse document frequency (IDF) with smoothing across all documents. */
function inverseDocumentFrequency(
    docTermFreqs: Map<string, number>[], // Array of TF maps, one per document
    docCount: number, // Total number of documents (N)
): Map<string, number> { // Returns Map<term, idf_weight>
  const df = new Map<string, number>(); // Document frequency for each term
  const allTerms = new Set<string>();

  // Find all unique terms across all documents and calculate document frequency (df_t)
  docTermFreqs.forEach(tfMap => {
    tfMap.forEach((count, term) => {
      if(count > 0) { // Only consider terms actually present in a doc for DF count
        allTerms.add(term);
        if (df.has(term)) {
          df.set(term, df.get(term)! + 1);
        } else {
          df.set(term, 1);
        }
      }
    });
  });
  // Recalculate DF more carefully
  df.clear(); // Clear previous calculation attempt
  allTerms.forEach(term => {
    let docFrequencyCount = 0;
    for (const tfMap of docTermFreqs) {
      if ((tfMap.get(term) ?? 0) > 0) {
        docFrequencyCount++;
      }
    }
    df.set(term, docFrequencyCount);
  });


  const idf = new Map<string, number>();
  // Calculate Smoothed IDF: log((N + 1) / (df_t + 1)) + 1.0
  df.forEach((docFrequency, term) => {
    const smoothedIdf = Math.log((docCount + 1) / (docFrequency + 1)) + 1.0;
    idf.set(term, smoothedIdf);
  });

  console.log(`Calculated IDF for ${idf.size} terms.`);
  return idf;
}

// ---------------------------------------------------------------------------
// Public Hybrid Embedding Generation
// ---------------------------------------------------------------------------

/**
 * Computes sparse (TF-IDF) embeddings and combines them with provided dense embeddings.
 *
 * @param denseEmbeddings Array of objects containing original text chunks and their dense vectors.
 * @returns Array of `ProcessedChunk` objects with dense and sparse embeddings.
 */
export function generateHybridEmbeddings(
    denseEmbeddings: ChunkEmbedding[], // Input: [{ chunk: string, vector: number[] }]
): ProcessedChunk[] {
  console.log(`Starting hybrid embedding generation for ${denseEmbeddings.length} chunks.`);
  if (denseEmbeddings.length === 0) return [];

  const documents: string[] = denseEmbeddings.map((d) => d.chunk);

  // 1. Build vocabulary from all documents
  const vocabulary: Map<string, number> = buildVocabulary(documents);
  const vocabSize = vocabulary.size;
  if (vocabSize === 0) {
    console.warn("Vocabulary is empty. Sparse embeddings will be empty.");
  }

  // 2. Calculate Term Frequency (TF) for each document
  const docTermFreqs: Map<string, number>[] = documents.map((doc) => termFrequency(doc, vocabulary));

  // 3. Calculate Inverse Document Frequency (IDF) across the corpus
  const idf: Map<string, number> = inverseDocumentFrequency(docTermFreqs, documents.length);

  // 4. Generate ProcessedChunk with TF-IDF based sparse vectors
  const processed: ProcessedChunk[] = denseEmbeddings.map((d, idx) => {
    const tfMap: Map<string, number> = docTermFreqs[idx];
    const sparseIndices: number[] = [];
    const sparseValues: number[] = [];

    // Calculate TF-IDF weight for each term in the current document's TF map
    tfMap.forEach((tfVal, term) => {
      const termIdx = vocabulary.get(term);
      const idfVal = idf.get(term);

      // Ensure term exists in vocab & IDF, and TF > 0
      if (termIdx !== undefined && idfVal !== undefined && tfVal > 0) {
        const tfIdfWeight = tfVal * idfVal;
        if (tfIdfWeight > 1e-6) { // Filter out negligible weights
          sparseIndices.push(termIdx);
          sparseValues.push(tfIdfWeight);
        }
      }
    });

    // Ensure dense vector is valid
    const denseVector = Array.isArray(d.vector) ? d.vector : [];
    if (denseVector.length === 0 && d.chunk?.length > 0) {
      console.warn(`Chunk "${d.chunk.substring(0, 30)}..." has an empty dense vector.`);
    }

    // Sort sparse indices/values pairs by index
    const sortedSparse = sparseIndices
        .map((index, i) => ({ index, value: sparseValues[i] }))
        .sort((a, b) => a.index - b.index);

    // Generate a unique ID compatible with Vertex AI Vector Search requirements
    const uniqueId = `chunk_${Date.now()}_${randomUUID().replace(/-/g, '')}`;

    return {
      id: uniqueId.substring(0, 63), // Ensure ID length constraint if any (e.g., 63 chars)
      text: d.chunk,
      denseEmbedding: denseVector,
      sparseEmbedding: {
        indices: sortedSparse.map(item => item.index),
        values: sortedSparse.map(item => item.value),
      },
    };
  });

  console.log(`Finished generating hybrid embeddings for ${processed.length} chunks.`);
  if (processed.length > 0) {
    console.log(`Example sparse vector lengths (first 3): ${processed.slice(0,3).map(p => p.sparseEmbedding.indices.length).join(', ')} (Vocab size: ${vocabSize})`);
  }
  return processed;
}

// ---------------------------------------------------------------------------
// Data Preparation & Upload for Index Ingestion
// ---------------------------------------------------------------------------

/**
 * Converts processed chunks into a JSON Lines string for Vertex AI ingestion.
 * Structure must match index configuration (restricts vs metadata).
 */
export function toJsonLines(chunks: ProcessedChunk[]): string {
  console.log(`Converting ${chunks.length} processed chunks to JSONL format.`);
  return chunks
      .map((c) => {
        const sparseData = (c.sparseEmbedding && Array.isArray(c.sparseEmbedding.indices) && Array.isArray(c.sparseEmbedding.values))
            ? c.sparseEmbedding
            : { indices: [], values: [] }; // Ensure valid structure

        // Data point structure for JSONL (using restricts for filtering)
        const dataPoint = {
          id: c.id,
          embedding: c.denseEmbedding, // Dense vector array
          sparse_embedding: sparseData, // Sparse vector object
          // Example: Use 'restricts' for filtering by text chunk content later
          restricts: [
            { namespace: "text_chunk", allow_list: [c.text] }
            // Add other namespaces if needed: { namespace: "doc_source", allow_list: ["source_file_1"] }
          ],
          // Alternatively, use 'metadata' if not filtering, just returning info:
          // metadata: { text: c.text, source: "some_source" }
        };
        try {
          return JSON.stringify(dataPoint);
        } catch (error: unknown) {
          console.error(`Failed to stringify data point for chunk ID ${c.id}:`, error);
          return ""; // Return empty string or handle error appropriately
        }
      })
      .filter(line => line !== "") // Remove lines that failed to stringify
      .join("\n");
}

/**
 * Uploads the JSONL content string to Google Cloud Storage.
 */
export async function uploadJsonlToGcs(params: {
  bucketName: string;
  jsonlContent: string;
  fileNamePrefix?: string; // Optional prefix for the GCS file name
}): Promise<string> {
  const fileName = `${params.fileNamePrefix ?? 'vector-data'}-${Date.now()}.jsonl`;
  console.log(`Preparing to upload JSONL content to gs://${params.bucketName}/${fileName}`);
  if (!params.jsonlContent) {
    throw new Error("JSONL content is empty, cannot upload.");
  }
  const buffer = Buffer.from(params.jsonlContent, "utf8");

  try {
    // Assuming uploadBufferToGcs is correctly implemented elsewhere
    const gcsUri = await uploadBufferToGcs({
      bucketName: params.bucketName,
      buffer,
      destinationFileName: fileName, // Pass the desired file name
      contentType: "application/jsonl", // Correct content type
    });
    console.log(`Successfully uploaded JSONL to ${gcsUri}`);
    return gcsUri;
  } catch (error: unknown) {
    console.error(`Failed to upload JSONL to GCS bucket ${params.bucketName}:`, error);
    throw error; // Re-throw after logging
  }
}

// ---------------------------------------------------------------------------
// Vertex AI Index and Endpoint Management
// ---------------------------------------------------------------------------

/**
 * Creates a Hybrid Vector Index in Vertex AI Vector Search.
 *
 * @param params Configuration parameters for the index.
 * @returns The full resource name of the created index.
 */
export async function createHybridIndex(params: {
  projectId: string;
  location: string; // e.g., 'us-central1'
  displayName: string; // User-friendly name for the index
  gcsSourceUri: string; // `gs://` path to the JSONL file
  denseDimensions: number; // Dimensionality of the dense vectors
  sparseDimensions: number; // Dimensionality of sparse vectors (MUST match vocabulary size)
  distanceMeasure?: 'DOT_PRODUCT_DISTANCE' | 'COSINE_DISTANCE' | 'SQUARED_L2_DISTANCE'; // Default: DOT_PRODUCT
  approximateNeighborsCount?: number; // For ANN indexes
  treeAhLeafNodeEmbeddingCount?: number; // Tree-AH specific config
  treeAhLeafNodesToSearchPercent?: number; // Tree-AH specific config
  updateMethod?: 'BATCH_UPDATE' | 'STREAM_UPDATE'; // Default: BATCH_UPDATE
}): Promise<string> {
  console.log(`Creating Vertex AI Hybrid Index '${params.displayName}' in location ${params.location}`);
  const client = getIndexServiceClient(params.location);
  const parent = client.locationPath(params.projectId, params.location);

  // --- Configure Index Metadata ---
  // Structure MUST match schema: gs://google-cloud-aiplatform/schema/matchingengine/metadata/index_1.0.0.yaml
  const indexMetadataConfig: Record<string, unknown> = {
    contentsDeltaUri: params.gcsSourceUri,
    config: {
      dimensions: params.denseDimensions,
      distanceMeasureType: params.distanceMeasure ?? "DOT_PRODUCT_DISTANCE",
      algorithmConfig: {
        treeAhConfig: { // Example using Tree-AH ANN algorithm
          leafNodeEmbeddingCount: params.treeAhLeafNodeEmbeddingCount ?? 500,
          leafNodesToSearchPercent: params.treeAhLeafNodesToSearchPercent ?? 7,
        },
        // Or use bruteForceConfig: {} for exact search (slower)
      },
      sparseRecordConfig: {
        dimensions: params.sparseDimensions, // CRITICAL: Must match vocabulary size
      },
      approximateNeighborsCount: params.approximateNeighborsCount ?? 150, // Used by ANN
    },
  };

  const indexConfig: IIndex = {
    displayName: params.displayName,
    metadataSchemaUri: "gs://google-cloud-aiplatform/schema/matchingengine/metadata/index_1.0.0.yaml",
    metadata: {
      // Convert the JS object config to a Protobuf Struct
      structValue: protos.google.protobuf.Struct.fromJavaScript(indexMetadataConfig),
    },
    indexUpdateMethod: params.updateMethod ?? "BATCH_UPDATE", // BATCH_UPDATE is simpler for initial load
  };

  try {
    console.log("Sending CreateIndex request...");
    const [operation] = await client.createIndex({ parent, index: indexConfig });
    console.log(`Index creation initiated. Operation: ${operation.name}`);

    // Wait for the operation to complete
    console.log("Waiting for index creation operation to complete...");
    const [response] = await operation.promise();
    console.log(`Index created successfully: ${response.name}`);
    return response.name!; // Resource name
  } catch (error: unknown) {
    console.error(`Failed to create index '${params.displayName}':`, error);
    if (error instanceof Error) { // Type guard for accessing message
      if (error.message?.includes("sparseRecordConfig.dimensions")) { console.error("--> Hint: Check if 'sparseDimensions' parameter matches your vocabulary size."); }
      if (error.message?.includes("contentsDeltaUri")) { console.error(`--> Hint: Check if GCS URI '${params.gcsSourceUri}' is accessible and contains valid JSONL.`); }
      if (error.message?.includes("Permission denied")) { console.error("--> Hint: Check IAM permissions for the service account running this code."); }
    }
    throw error; // Re-throw
  }
}

/**
 * Creates a Vertex AI Index Endpoint and deploys a given index to it.
 */
export async function deployIndexEndpoint(params: {
  projectId: string;
  location: string;
  displayName: string; // User-friendly name for the endpoint
  indexResourceName: string; // Full resource name of the Index
  deployedIndexId?: string; // Optional: Specify an ID for the deployed index instance
  machineType?: string; // Optional: Specify machine type (e.g., 'n1-standard-16'). If omitted, uses automatic resources.
  minReplicaCount?: number; // Optional: Min replicas
  maxReplicaCount?: number; // Optional: Max replicas
  network?: string; // Optional: VPC network name (e.g., projects/PROJECT_ID/global/networks/default)
}): Promise<string> {
  console.log(`Deploying index '${params.indexResourceName}' to new endpoint '${params.displayName}' in ${params.location}`);
  const client = getIndexEndpointServiceClient(params.location);
  const parent = client.locationPath(params.projectId, params.location);

  try {
    // 1. Create the Index Endpoint
    const endpointConfig: IIndexEndpoint = {
      displayName: params.displayName,
      // Use 'default' network if unsure and using the default VPC. Otherwise specify full network name.
      network: params.network ?? `projects/${params.projectId}/global/networks/default`,
      // publicEndpointEnabled: true, // Uncomment if public internet access is needed (review security)
    };
    console.log("Creating Index Endpoint...");
    const [createOp] = await client.createIndexEndpoint({ parent, indexEndpoint: endpointConfig });
    const [endpointResp] = await createOp.promise();
    const endpointName = endpointResp.name!;
    console.log(`Index Endpoint created successfully: ${endpointName}`);

    // 2. Configure the Deployment
    const deployedIndexId = params.deployedIndexId ?? `deploy_${params.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '')}_${Date.now()}`.substring(0, 63);
    const deployedIndexConfig: IDeployedIndex = {
      id: deployedIndexId,
      index: params.indexResourceName,
      displayName: `${params.displayName}-deployment`, // Name for this specific deployment instance
      // Choose resource allocation strategy:
      automaticResources: !params.machineType ? {
        minReplicaCount: params.minReplicaCount ?? 1,
        maxReplicaCount: params.maxReplicaCount ?? 5, // Example autoscaling max
      } : undefined,
      dedicatedResources: params.machineType ? {
        machineSpec: { machineType: params.machineType },
        minReplicaCount: params.minReplicaCount ?? 1,
        maxReplicaCount: params.maxReplicaCount ?? (params.minReplicaCount ?? 1), // Default max = min if not specified
      } : undefined,
    };

    // Ensure only one resource type is defined and provide default if none
    if (deployedIndexConfig.dedicatedResources && deployedIndexConfig.automaticResources) {
      console.warn("Both dedicated and automatic resources specified; preferring automatic.");
      deployedIndexConfig.dedicatedResources = undefined;
    }
    if (!deployedIndexConfig.dedicatedResources && !deployedIndexConfig.automaticResources) {
      console.log("No machine type specified, using default automatic resource allocation (min=1, max=5).");
      deployedIndexConfig.automaticResources = { minReplicaCount: 1, maxReplicaCount: 5 };
    }

    // 3. Deploy the Index to the Endpoint
    console.log(`Deploying index with deployment ID '${deployedIndexConfig.id}' to endpoint ${endpointName}...`);
    const [deployOp] = await client.deployIndex({
      indexEndpoint: endpointName,
      deployedIndex: deployedIndexConfig,
    });
    console.log(`Deploy Index operation initiated: ${deployOp.name}`);

    // Wait for the deployment operation to complete (can take several minutes)
    console.log("Waiting for index deployment operation to complete...");
    await deployOp.promise();
    console.log(`Index ${params.indexResourceName} deployed successfully as ${deployedIndexConfig.id} to endpoint ${endpointName}`);

    return endpointName; // Return the endpoint resource name
  } catch (error: unknown) {
    console.error(`Failed to deploy index endpoint '${params.displayName}':`, error);
    if (error instanceof Error) { // Type guard
      if (error.message?.includes("network")) { console.error("--> Hint: Check if the specified network exists and is accessible by Vertex AI."); }
      if (error.message?.includes("quota") || error.message?.includes("resources sufficient")) { console.error("--> Hint: Resource quota exceeded or insufficient. Check machine type/replica count or project quotas."); }
      if (error.message?.includes("Permission denied")) { console.error("--> Hint: Check IAM permissions for the service account."); }
    }
    throw error; // Re-throw
  }
}

// ---------------------------------------------------------------------------
// Vertex AI Vector Search Querying
// ---------------------------------------------------------------------------

/**
 * Executes a hybrid search query against a deployed index endpoint.
 * Assumes the PredictionServiceClient handles Protobuf conversion internally.
 *
 * @param params Parameters for the query, including endpoint location.
 * @returns The prediction response from the Vertex AI API.
 */
export async function queryHybridIndex(params: {
  endpoint: string; // Full endpoint resource name (projects/.../locations/.../indexEndpoints/...)
  projectId: string; // Included for context/logging
  location: string; // Location of the endpoint (e.g., 'us-central1') - REQUIRED
  denseQuery: DenseQueryInput; // The object { values: number[] }
  sparseQuery?: SparseVector; // Optional sparse query vector { indices: number[], values: number[] }
  topK?: number; // Number of neighbors to return (default: 10)
}): Promise<IPredictResponse> {

  const { endpoint, denseQuery, sparseQuery, topK, location, projectId } = params;
  const functionName = 'queryHybridIndex';

  // --- Input Validation ---
  console.log(`[${functionName}] Initiating query`);
  console.log(`  - Project: ${projectId}`);
  console.log(`  - Location: ${location}`);
  console.log(`  - Endpoint: ${endpoint}`);
  if (!location) {
    throw new Error(`[${functionName}] Location parameter is required to initialize regional client.`);
  }
  if (!endpoint || !endpoint.includes('indexEndpoints/')) { throw new Error(`[${functionName}] Invalid endpoint format: ${endpoint}. Expected projects/.../locations/.../indexEndpoints/...`); }
  if (!denseQuery || !Array.isArray(denseQuery.values) || denseQuery.values.length === 0) { throw new Error(`[${functionName}] Invalid/empty denseQuery. Expected { values: [number,...] }`); }
  if (sparseQuery) {
    if (!Array.isArray(sparseQuery.indices) || !Array.isArray(sparseQuery.values)) { throw new Error(`[${functionName}] Invalid sparseQuery structure. 'indices' and 'values' must be arrays.`); }
    if (sparseQuery.indices.length !== sparseQuery.values.length) { throw new Error(`[${functionName}] Sparse query 'indices' (${sparseQuery.indices.length}) and 'values' (${sparseQuery.values.length}) arrays must have the same length.`); }
    console.log(`  - Using sparse query with ${sparseQuery.indices.length} dimensions.`);
  }

  // --- Get Client & Prepare Request ---
  // Ensure client is initialized for the correct region specified by 'location'
  const client = getPredictionServiceClient(location);
  const kValue = typeof topK === 'number' && topK > 0 ? topK : 10;

  // Construct instance payload as Plain JavaScript Object
  const instancePayload: Record<string, unknown> = {
    embedding: denseQuery.values, // Use the number array directly
  };
  if (sparseQuery && sparseQuery.indices.length > 0) {
    instancePayload.sparse_embedding = { // Add sparse embedding object if valid
      indices: sparseQuery.indices,
      values: sparseQuery.values,
    };
  }
  // The instances array contains the plain JS object(s)
  const instances = [instancePayload];

  // Construct parameters payload as Plain JavaScript Object
  const parameterPayload: Record<string, unknown> = {
    neighbor_count: kValue, // Vector Search API uses 'neighbor_count'
    // Add filtering parameters here if needed, e.g.:
    // filter: [{ namespace: "text_chunk", allow_list: ["some text to filter by"] }]
  };
  // The parameters object is the plain JS object
  const parameters = parameterPayload;

  // --- Logging Request Details ---
  console.log(`[${functionName}] Preparing request:`);
  console.log(`  - Dense Vector Dim: ${denseQuery.values.length}`);
  if (instancePayload.sparse_embedding) {
    const sparse = instancePayload.sparse_embedding as SparseVector; // Safe cast after check
    console.log(`  - Sparse Vector Dim: ${sparse.indices.length}`);
  }
  console.log(`  - Parameters: ${JSON.stringify(parameters)}`);

  // --- Execute Prediction Call ---
  try {
    // Pass plain JavaScript objects directly to the predict method
    const request = {
      endpoint: endpoint,
      instances: instances,   // Pass JS object array
      parameters: parameters, // Pass JS object
    };

    console.log(`[${functionName}] Sending request to Vertex AI Prediction Service...`);
    // The client.predict method should handle Protobuf conversion internally
    const [prediction] = await client.predict(request);
    console.log(`[${functionName}] Prediction successful.`);

    // --- Basic Response Parsing & Logging ---
    if (prediction.predictions && Array.isArray(prediction.predictions) && prediction.predictions.length > 0) {
      // Prediction results are often Structs, access fields carefully
      const firstPredictionStruct = prediction.predictions[0]?.structValue?.fields;
      const neighborsList = firstPredictionStruct?.neighbors?.listValue?.values;

      if (neighborsList && Array.isArray(neighborsList)) {
        console.log(`  - Received ${neighborsList.length} neighbors.`);
        // Example: Log details of the first neighbor
        const firstNeighbor = neighborsList[0] as Neighbor | undefined; // Use helper type
        const neighborFields = firstNeighbor?.structValue?.fields?.neighbor?.structValue?.fields;
        const neighborId = neighborFields?.id?.stringValue;
        const neighborDistance = neighborFields?.distance?.numberValue;
        if (neighborId) {
          console.log(`  - Top neighbor ID: ${neighborId}, Distance: ${neighborDistance?.toFixed(4) ?? 'N/A'}`);
        }
      } else {
        console.log(`  - Prediction structure unexpected or neighbors field missing/empty.`);
        // console.log(`  - First prediction structure: ${JSON.stringify(prediction.predictions[0])}`); // Log structure for debug
      }
    } else {
      console.log("  - Prediction response did not contain any predictions.");
    }

    return prediction;

  } catch (error: unknown) { // Catch error as unknown for type safety
    console.error(`--- [${functionName}] Prediction API Call Failed ---`);
    console.error('Timestamp:', new Date().toISOString());
    console.error('Endpoint:', endpoint);
    console.error('Parameters Sent:', JSON.stringify(parameters)); // Log parameters sent
    console.error('Instance Structure Sent:', JSON.stringify(Object.keys(instancePayload))); // Log keys, not values

    // Safely extract error details
    let errorMessage = 'Unknown error during prediction.';
    let errorCode: number | string | undefined = undefined;
    if (typeof error === 'object' && error !== null) {
      // Attempt to access common error properties
      if ('details' in error && typeof error.details === 'string') { errorMessage = error.details; }
      else if ('message' in error && typeof error.message === 'string') { errorMessage = error.message; }
      if ('code' in error && (typeof error.code === 'string' || typeof error.code === 'number')) {
        errorCode = error.code; console.error('Error Code:', errorCode);
      }
      if ('metadata' in error) { /* console.error('gRPC Metadata:', error.metadata); */ } // Metadata can be large
    } else if (error instanceof Error) { // Fallback for standard Error
      errorMessage = error.message;
    }

    console.error('Error Details:', errorMessage);
    console.error('Full Error Object (if available):', error); // Log raw error
    console.error('---------------------------------------');

    // Re-throw a more informative error for the caller
    throw new Error(`[${functionName}] Vertex AI prediction query failed for endpoint ${endpoint}: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}`);
  }
}
