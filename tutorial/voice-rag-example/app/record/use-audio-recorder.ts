"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAudioRecorder {
  isRecording: boolean;
  audioUrl: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  blob: Blob | null;
}

/**
 * useAudioRecorder – minimal MediaRecorder abstraction.
 * Returns helpers to start / stop recording plus the resulting audio Blob & URL.
 */
export const useAudioRecorder = (): UseAudioRecorder => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  /* Revoke previous blob URL on unmount / change */
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const reset = useCallback(() => {
    chunksRef.current = [];
    setBlob(null);
    setAudioUrl(null);
  }, []);

  const start = useCallback(async () => {
    reset();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = "audio/webm";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blobData = new Blob(chunksRef.current, { type: mimeType });
      setBlob(blobData);
      const url = URL.createObjectURL(blobData);
      setAudioUrl(url);
      chunksRef.current = [];
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  }, [reset]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, audioUrl, start, stop, reset, blob };
};
