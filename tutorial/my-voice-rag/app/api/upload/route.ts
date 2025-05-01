/*
 * /api/upload (POST)
 * ------------------
 * Accepts a multipart/form-data request containing the field `audioFile`,
 * uploads the file to a Google Cloud Storage bucket, and returns the resulting
 * `gs://` URI. Includes validation for MIME type and size, and generates a
 * unique file name to prevent collisions.
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToGcs } from "@/lib/gcs";

// Next.js route options
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Configuration ---------------------------------------------------------

const bucketName = process.env.GCS_BUCKET ?? "";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// --- Types -----------------------------------------------------------------

type ErrorResponse = { success: false; message: string };
type SuccessResponse = { success: true; gcsPath: string };

// --- Handler ----------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!bucketName) {
    return jsonError("GCS_BUCKET environment variable is not set.", 500);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("audioFile");

    if (!(file instanceof File)) {
      return jsonError("`audioFile` field is required.", 400);
    }

    if (!file.type.startsWith("audio/")) {
      return jsonError("Only audio files are allowed.", 400);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return jsonError("File exceeds the 50 MB limit.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop() ?? "webm";

    const gcsPath = await uploadBufferToGcs({
      buffer,
      bucketName,
      contentType: file.type,
      extension,
    });

    return NextResponse.json<SuccessResponse>({ success: true, gcsPath });
  } catch (error) {
    console.error("/api/upload error", error);
    return jsonError("Internal server error.", 500);
  }
}

// --- Helpers ----------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json<ErrorResponse>({ success: false, message }, { status });
}
