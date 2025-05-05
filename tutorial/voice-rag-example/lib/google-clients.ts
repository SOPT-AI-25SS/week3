import { VertexAI } from "@google-cloud/vertexai";
import { Storage } from "@google-cloud/storage";
import {v1 as aiplatform, VertexRagDataServiceClient, VertexRagServiceClient} from "@google-cloud/aiplatform";

/**
 * Shared Google Cloud clients initialised from environment variables.
 */

const PROJECT = process.env.GCP_PROJECT_ID ?? "";
const LOCATION = process.env.GCP_LOCATION ?? "us-central1";

if (!PROJECT) {
  console.warn("[google-clients] GCP_PROJECT_ID env is missing");
}

export const vertex = new VertexAI({ project: PROJECT, location: LOCATION });

export const storage = new Storage();

// Vertex AI RAG Engine clients
export const ragData: VertexRagDataServiceClient = new aiplatform.VertexRagDataServiceClient({
  apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
});

export const ragQuery: VertexRagServiceClient = new aiplatform.VertexRagServiceClient({
  apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
});
