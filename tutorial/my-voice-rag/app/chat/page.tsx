"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "./components/ChatMessageRow";
import ChatInput from "./components/ChatInput";
import ChatMessageRow from "./components/ChatMessageRow";
import EndpointField from "./components/EndpointField";
import { fetchRag } from "@/lib/fetch-rag";

export default function ChatPage() {
  const defaultEndpoint = process.env.NEXT_PUBLIC_VERTEX_ENDPOINT ?? "";

  const [endpoint, setEndpoint] = useState<string>(defaultEndpoint);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuestion = useCallback(
    async (question: string) => {
      if (!question || !endpoint.trim()) {
        return;
      }

      // Optimistic UI update
      setMessages((prev) => [...prev, { role: "user", text: question }]);
      setLoading(true);
      setError(null);

      try {
        const response = await fetchRag({ endpoint: endpoint.trim(), question });

        if (response.success) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: response.answer, chunks: response.chunks },
          ]);
        } else {
          throw new Error(response.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [endpoint],
  );

  return (
    <main className="flex flex-col h-screen p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Voice RAG Chat</h1>

      <EndpointField value={endpoint} onChange={setEndpoint} />

      <div className="flex-1 overflow-y-auto mb-4 border rounded p-4 space-y-4 bg-neutral-50 dark:bg-neutral-800">
        {messages.map((msg, idx) => (
          <ChatMessageRow key={idx} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-600 text-sm mb-2">Error: {error}</p>}

      <ChatInput disabled={loading} onSend={sendQuestion} />
    </main>
  );
}
