"use client";

import { useState } from "react";
import { useAudioRecorder } from "./use-audio-recorder";

interface TranscriptResponse {
  text: string;
}

export default function RecordPage() {
  const {
    isRecording,
    audioUrl,
    start,
    stop,
    reset,
    blob,
  } = useAudioRecorder();

  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const handleUpload = async () => {
    if (!blob) return;
    setIsUploading(true);
    setTranscript(null);

    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as TranscriptResponse;
      setTranscript(data.text);

      // automatically launch embedding + import
      setIsBuilding(true);
      await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      });
      setIsBuilding(false);
    } catch (err) {
      alert((err as Error).message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Voice Recorder</h1>

      <div className="flex gap-4">
        {isRecording ? (
          <button
            onClick={stop}
            className="rounded bg-red-600 px-4 py-2 text-white"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded bg-green-600 px-4 py-2 text-white"
          >
            Record
          </button>
        )}

        <button
          onClick={handleUpload}
          disabled={!blob || isUploading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Transcribe"}
        </button>

        <button
          onClick={reset}
          disabled={!blob && !audioUrl}
          className="rounded bg-gray-300 px-4 py-2 text-gray-800 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {audioUrl && <audio controls src={audioUrl} className="w-full" />}

      {transcript && (
        <div className="whitespace-pre-wrap rounded border bg-gray-100 p-4">
          {transcript}
        </div>
      )}

      {isBuilding && (
        <p className="text-sm text-gray-500">Building knowledge base…</p>
      )}
    </div>
  );
}
