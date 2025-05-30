"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRagChat } from "../hooks/use-rag-chat";
import CorpusPicker from "../components/corpus-picker";
import { useCorpus } from "../corpus-context";

export default function ChatPage() {
  const { selected } = useCorpus();

  const apiPath = useMemo(() => {
    if (selected) {
      return `/api/chat?corpus=${encodeURIComponent(selected.name)}`;
    }
    return "/api/chat";
  }, [selected]);


  const { messages, input, handleInputChange, handleSubmit, isLoading, error, contexts } =
    useRagChat({ api: apiPath });

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chat</h1>
        <CorpusPicker />
      </div>

      {/* The per-answer contexts viewer is now embedded inside each assistant reply. */}



      <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pr-2">
        {messages.map((m, idx) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "self-end rounded bg-blue-600 px-3 py-2 text-white"
                : "self-start rounded bg-gray-200 px-3 py-2 text-gray-900"
            }
          >
            {m.content}

            {/* Show retrieval contexts right after the assistant response */}
            {m.role === "assistant" && idx === messages.length - 1 && !!contexts.length && (
              <details className="mt-2 rounded border px-2 py-1 text-xs text-gray-700">
                <summary className="cursor-pointer font-medium">Contexts used ({contexts.length})</summary>
                <div className="mt-1 space-y-1">
                  {contexts.map((c, i: number) => (
                    <pre key={i} className="whitespace-pre-wrap rounded bg-gray-100 p-1">
                      {typeof c === "string" ? c : JSON.stringify(c, null, 2)}
                    </pre>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded border p-2"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something…"
        />
        <button
          disabled={isLoading || !input.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isLoading ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
