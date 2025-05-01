import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";

/**
 * Uploads a Buffer to Google Cloud Storage and returns the `gs://` URI. The file
 * name is auto-generated using a timestamp and UUID to avoid collisions.
 */
export async function uploadBufferToGcs(params: {
  buffer: Buffer;
  bucketName: string;
  contentType: string;
  extension?: string;
}): Promise<string> {
  const { buffer, bucketName, contentType, extension = "bin" } = params;

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    resumable: false,
    metadata: { contentType },
  });

  return `gs://${bucket.name}/${file.name}`;
}
