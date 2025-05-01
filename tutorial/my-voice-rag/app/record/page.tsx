"use client";

/*
 * RecordPage
 * -------------
 * Simple client-side page that lets the user:
 * 1. Start/stop microphone recording (MediaRecorder).
 * 2. Immediately upload the recorded Blob to the `/api/upload` route as `FormData`.
 * 3. Display upload status and a local audio preview.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type UploadState =
  | { status: "idle" }
  | { status: "recording" }
  | { status: "uploading" }
  | { status: "success"; gcsPath: string }
  | { status: "error"; message: string };

export default function RecordPage() {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  /**
   * Request the microphone, create a MediaRecorder,
   * and start collecting audio chunks.
   */
  const startRecording = useCallback(async () => {
    if (uploadState.status === "recording") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setUploadState({ status: "recording" });
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error(err);
      setUploadState({ status: "error", message: "Failed to access microphone." });
    }
  }, [uploadState.status]);

  /**
   * Stop the MediaRecorder, build a single Blob from chunks,
   * upload to the server, and create a local preview.
   */
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));

      try {
        setUploadState({ status: "uploading" });

        const formData = new FormData();
        formData.append("audioFile", blob, `recording-${Date.now()}.webm`);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const json = (await res.json()) as
          | { success: true; gcsPath: string }
          | { success: false; message: string };

        if (!res.ok || json.success !== true) {
          const errorMessage = "message" in json ? json.message : "Upload failed";
          throw new Error(errorMessage);
        }

        setUploadState({ status: "success", gcsPath: json.gcsPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setUploadState({ status: "error", message });
      }
    };

    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
  }, []);

  // Clean up object URL when component unmounts or audio changes.
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <main className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Voice Recorder & Upload</h1>

      <div className="flex gap-4">
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={startRecording}
          disabled={uploadState.status === "recording"}
        >
          Start Recording
        </button>
        <button
          className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
          onClick={stopRecording}
          disabled={uploadState.status !== "recording"}
        >
          Stop & Upload
        </button>
      </div>

      {uploadState.status === "recording" && (
        <p className="text-yellow-600">Recording…</p>
      )}
      {uploadState.status === "uploading" && (
        <p className="text-blue-600">Uploading… Please wait.</p>
      )}
      {uploadState.status === "success" && (
        <p className="text-green-600 break-all">
          Uploaded to: <code>{uploadState.gcsPath}</code>
        </p>
      )}
      {uploadState.status === "error" && (
        <p className="text-red-600">Error: {uploadState.message}</p>
      )}

      {audioUrl && (
        <audio controls className="mt-4">
          <source src={audioUrl} type="audio/webm" />
          Your browser does not support the audio element.
        </audio>
      )}
    </main>
  );
}
