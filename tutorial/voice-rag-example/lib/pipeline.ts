import { chunkAndEmbed } from "./semantic-chunk";
import { storage, ragData } from "./google-clients";

async function ensureRagCorpus(displayName: string, corpusName?: string): Promise<string> {
  if (corpusName) return corpusName; // already provided

  const [createOp] = await ragData.createRagCorpus({
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
  });

  const [corpus] = await createOp.promise();
  return corpus.name as string;
}

export async function embedAndImport(
    transcript: string,
    embedFn: (txt: string) => Promise<number[]>,
    bucket: string,
    displayName: string,
    corpusName?: string,
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

  const corpus = await ensureRagCorpus(displayName, corpusName);
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

