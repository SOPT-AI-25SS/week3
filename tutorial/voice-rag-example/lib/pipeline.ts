import { chunkAndEmbed } from "./semantic-chunk";
import { storage, ragData } from "./google-clients";
import { asCorpusPath } from "./as-corpus-path";

import { GoogleError } from "google-gax";

interface EnsureRagCorpusParams {
  displayName: string;
  projectId: string;
  location?: string;
  corpusName?: string;
}

async function ensureRagCorpus(
    {
      displayName,
      projectId,
      location = "us-central1",
      corpusName,
    }: EnsureRagCorpusParams
): Promise<string> {
  const parent = `projects/${projectId}/locations/${location}`;

  console.log('checking corpora')

  // 1. If caller passed a corpus ID or path, normalize it and verify it exists.
  if (corpusName) {
    const resourcePath = asCorpusPath(corpusName, projectId, location);

    try {
      await ragData.getRagCorpus({ name: resourcePath });
      return resourcePath; // ✅ Already exists, return full path
    } catch (err: unknown) {
      const gErr = err as Partial<GoogleError> & { code?: number };
      // If NOT_FOUND (code 5) fall through to creation – otherwise re-throw.
      if (gErr.code !== 5) {
        throw err;
      }

      console.warn(`Corpus ${resourcePath} not found – creating a new one.`);
    }
  }

  console.log('not existing corpora. creating new one.')

  // 2. Create a new corpus – if caller supplied an ID, reuse it so we don't
  //    accumulate duplicate corpora.
  const [op] = await ragData.createRagCorpus({
    parent,
    ragCorpus: {
      displayName,
      backendConfig: {
        ragVectorDbConfig: {
          ragEmbeddingModelConfig: {
            vertexPredictionEndpoint: {
              publisherModel: "publishers/google/models/text-embedding-005",
            },
          },
        },
      },
    },
    ...(corpusName ? { ragCorpusId: corpusName } : {}),
  });

  const [corpus] = await op.promise();

  console.log('created new one.')

  return corpus.name as string;
}

export async function embedAndImport(
  transcript: string,
  embedFn: (txt: string) => Promise<number[]>,
  bucket: string,
  corpusName: string,
): Promise<string> {
  const records = await chunkAndEmbed(transcript, embedFn);
  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");

  const objectName = `rag/auto-${Date.now()}.jsonl`;
  await storage.bucket(bucket).file(objectName).save(jsonl, {
    resumable: false,
    contentType: "application/json",
  });
  const gcsUri = `gs://${bucket}/${objectName}`;
  console.log("Uploaded chunks to", gcsUri);

  const projectId = process.env.GCP_PROJECT_ID!;

  const corpus = await ensureRagCorpus({
    displayName: 'my-corpus',
    projectId,
    location: 'us-central1',
    corpusName,
  });

  console.log("Using corpus", corpus);

  const [importOp] = await ragData.importRagFiles({
    parent: corpus,
    importRagFilesConfig: {
      gcsSource: { uris: [gcsUri] },
      ragFileChunkingConfig: { chunkSize: 128 },
    },
  });
  await importOp.promise();
  console.log("Import completed for", objectName);

  return gcsUri;
}

