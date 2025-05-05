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

  // 1. If caller passed a corpus ID or path, normalize it and verify it exists.
  if (corpusName) {
    const resourcePath = asCorpusPath(corpusName, projectId, location);

    try {
      await ragData.getRagCorpus({ name: resourcePath });
      return resourcePath;
    } catch (err: unknown) {
      const gErr = err as Partial<GoogleError> & { code?: number };
      if (gErr.code !== 5) {
        throw err;
      }

      console.warn(`Corpus ${resourcePath} not found – creating a new one.`);
    }
  }

  // 2. Create a new corpus – if caller supplied an ID, reuse it so we don't
  //    accumulate duplicate corpora.
  const [op] = await ragData.createRagCorpus({
    parent,
    ragCorpus: {
      displayName,
      vectorDbConfig: {
        ragEmbeddingModelConfig: {
          vertexPredictionEndpoint: {
            model: "publishers/google/models/text-embedding-005",
          },
        },
      },
    },
    ...(corpusName ? { ragCorpusId: corpusName } : {}),
  }, {});

  const [corpus] = await op.promise();
  return corpus.name as string;
}

export async function embedAndImport(
  transcript: string,
  // embedFn: (txt: string) => Promise<number[]>,
  bucket: string,
  corpusName: string,
): Promise<string> {
  const records = await chunkAndEmbed(transcript);
  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");

  const objectName = `rag/auto-${Date.now()}.jsonl`;
  await storage.bucket(bucket).file(objectName).save(jsonl, {
    resumable: false,
    contentType: "application/json",
  });
  const gcsUri = `gs://${bucket}/${objectName}`;

  const projectId = process.env.GCP_PROJECT_ID!;

  const corpus = await ensureRagCorpus({
    displayName: 'my-corpus',
    projectId,
    location: 'us-central1',
    corpusName,
  });

  // /** Properties of an ImportRagFilesConfig. */
  //                 interface IImportRagFilesConfig {
  //
  //                     /** ImportRagFilesConfig gcsSource */
  //                     gcsSource?: (google.cloud.aiplatform.v1.IGcsSource|null);
  //
  //                     /** ImportRagFilesConfig googleDriveSource */
  //                     googleDriveSource?: (google.cloud.aiplatform.v1.IGoogleDriveSource|null);
  //
  //                     /** ImportRagFilesConfig slackSource */
  //                     slackSource?: (google.cloud.aiplatform.v1.ISlackSource|null);
  //
  //                     /** ImportRagFilesConfig jiraSource */
  //                     jiraSource?: (google.cloud.aiplatform.v1.IJiraSource|null);
  //
  //                     /** ImportRagFilesConfig sharePointSources */
  //                     sharePointSources?: (google.cloud.aiplatform.v1.ISharePointSources|null);
  //
  //                     /** ImportRagFilesConfig partialFailureGcsSink */
  //                     partialFailureGcsSink?: (google.cloud.aiplatform.v1.IGcsDestination|null);
  //
  //                     /** ImportRagFilesConfig partialFailureBigquerySink */
  //                     partialFailureBigquerySink?: (google.cloud.aiplatform.v1.IBigQueryDestination|null);
  //
  //                     /** ImportRagFilesConfig importResultGcsSink */
  //                     importResultGcsSink?: (google.cloud.aiplatform.v1.IGcsDestination|null);
  //
  //                     /** ImportRagFilesConfig importResultBigquerySink */
  //                     importResultBigquerySink?: (google.cloud.aiplatform.v1.IBigQueryDestination|null);
  //
  //                     /** ImportRagFilesConfig ragFileTransformationConfig */
  //                     ragFileTransformationConfig?: (google.cloud.aiplatform.v1.IRagFileTransformationConfig|null);
  //
  //                     /** ImportRagFilesConfig ragFileParsingConfig */
  //                     ragFileParsingConfig?: (google.cloud.aiplatform.v1.IRagFileParsingConfig|null);
  //
  //                     /** ImportRagFilesConfig maxEmbeddingRequestsPerMin */
  //                     maxEmbeddingRequestsPerMin?: (number|null);
  //                 }
  // https://raw.githubusercontent.com/googleapis/google-cloud-node/484c6e0934fa16c4d500fb9d441dbf8c9f441015/packages/google-cloud-aiplatform/protos/protos.d.ts

  const [importOp] = await ragData.importRagFiles({
    parent: corpus,
    importRagFilesConfig: {
      gcsSource: { uris: [gcsUri] },
      ragFileTransformationConfig: {
        ragFileChunkingConfig: {
          fixedLengthChunking: { chunkSize: 256, chunkOverlap: 64 },
        },
      },
    },
  }, {});

  await importOp.promise();


  return gcsUri;
}

