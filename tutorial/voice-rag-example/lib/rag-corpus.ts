import { ragData } from "./google-clients";

export interface RagCorpus {
  /**
   * Fully-qualified resource name, e.g.
   * projects/123/locations/us-central1/ragCorpora/987654321
   */
  name: string;
  displayName: string;
  description?: string;
}

const DEFAULT_LOCATION = process.env.GCP_LOCATION || "us-central1";
const DEFAULT_EMBED_MODEL = process.env.EMBEDDING_MODEL_ID || "gemini-embedding-exp-03-07";

function locationPath(project: string, location: string): string {
  return `projects/${project}/locations/${location}`;
}

/**
 * List all RAG corpora in the project / location.
 */
export async function listCorpora(
  projectId: string,
  location = DEFAULT_LOCATION,
): Promise<RagCorpus[]> {
  const parent = locationPath(projectId, location);
  const [corpora] = await ragData.listRagCorpora({ parent });
  return corpora.map((c) => ({
    name: c.name!,
    displayName: c.displayName!,
    description: c.description ?? undefined,
  }));
}

interface CreateCorpusParams {
  projectId: string;
  displayName: string;
  description?: string;
  location?: string;
  embeddingModelId?: string;
}

/**
 * Create a new RAG Corpus. Returns the created corpus resource.
 */
export async function createCorpus(
    {
      projectId,
      displayName,
      description,
      location = DEFAULT_LOCATION,
      embeddingModelId = DEFAULT_EMBED_MODEL,
    }: CreateCorpusParams): Promise<RagCorpus> {
  const parent = locationPath(projectId, location!);
  console.log('parent >>>', parent);

  const ragCorpusPayload = {
    displayName: displayName, // Use camelCase key
    description: description, // Use camelCase key
    ragEmbeddingModelConfig: { // Use camelCase key
      vertexPredictionEndpoint: { // Use camelCase key
        publisherModel: `publishers/google/models/${embeddingModelId}`, // Use camelCase key
      },
    },
  };

  console.log('ragCorpusPayload ::: ', ragCorpusPayload, "display name::: ", displayName)

  const [createOp] = await ragData.createRagCorpus({
    parent: parent,
    ragCorpus: ragCorpusPayload,
  });

  console.log('Submitted create operation:', createOp.name);

  const [corpus] = await createOp.promise();

  console.log('Created corpus:', JSON.stringify(corpus, null, 2)); // Log the full response for inspection

  return {
    name: corpus.name!,
    displayName: corpus.displayName!,
    description: corpus.description ?? undefined,
  };
}

interface ImportJsonlParams {
  corpusName: string; // fully-qualified corpus resource name
  gcsUri: string;
  chunkSize?: number; // 0 means embedded already
}

/**
 * Import a JSONL file (already embedded) into an existing corpus.
 */
export async function importJsonl({
  corpusName,
  gcsUri,
  chunkSize = 0,
}: ImportJsonlParams): Promise<void> {
  const [op] = await ragData.importRagFiles({
    parent: corpusName,
    importRagFilesConfig: {
      gcsSource: { uris: [gcsUri] },
      ragFileTransformationConfig: {
        ragFileChunkingConfig: {
          fixedLengthChunking: { chunkSize },
        },
      },
    },
  }, {});

  await op.promise();
}
