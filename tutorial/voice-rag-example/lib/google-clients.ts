import { VertexAI } from "@google-cloud/vertexai";
import { Storage } from "@google-cloud/storage";

/**
 * Shared Google Cloud clients initialised from environment variables.
 */

const PROJECT = process.env.GCP_PROJECT_ID ?? "";
const LOCATION = process.env.GCP_LOCATION ?? "us-central1";

if (!PROJECT) {
  // eslint-disable-next-line no-console
  console.warn("[google-clients] GCP_PROJECT_ID env is missing");
}

export const vertex = new VertexAI({ project: PROJECT, location: LOCATION });

export const storage = new Storage();
