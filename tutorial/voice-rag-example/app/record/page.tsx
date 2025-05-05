"use client";

import { useState } from "react";
import { useAudioRecorder } from "./use-audio-recorder";
import CorpusPicker from "../components/corpus-picker";
import { useCorpus } from "../corpus-context";

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
  const [isSuccess, setIsSuccess] = useState(false);

  const { selected } = useCorpus();
  const { isLoading: isCorpusLoading } = useCorpus();

  const handleUpload = async () => {
    if (!blob || !selected) return;
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
      setIsSuccess(false);
      await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text, corpusId: selected.name }),
      });
      setIsBuilding(false);
      setIsSuccess(true);
    } catch (err) {
      alert((err as Error).message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Voice Recorder</h1>

      {isCorpusLoading && (
        <p className="text-sm text-gray-500">Loading corpora… (first load may take a few seconds)</p>
      )}

      <div className="flex items-center gap-4">
        <CorpusPicker />
        {isCorpusLoading ? (
          <button
            disabled
            className="rounded bg-gray-400 px-4 py-2 text-white opacity-60"
          >
            Loading…
          </button>
        ) : isRecording ? (
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
          disabled={isCorpusLoading || !blob || isUploading || !selected}
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

      {isSuccess && !isBuilding && (
        <p className="text-sm text-green-600">Upload & corpus import completed! 🎉</p>
      )}
    </div>
  );
}
