"use client";

import { useCallback, useRef, useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseRagChatOptions {
  api: string;
}

export function useRagChat({ api }: UseRagChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [contexts, setContexts] = useState<[]>([]);

  const controllerRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim()) return;

      const userMsg: Message = {
        id: `${Date.now()}-user`,
        role: "user",
        content: input,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      try {
        setIsLoading(true);
        setError(null);

        controllerRef.current?.abort();
        controllerRef.current = new AbortController();

        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMsg] }),
          signal: controllerRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error(await res.text());

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const assistantId = `${Date.now()}-assistant`;
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line) continue;
            const [prefix, payload] = line.split(":", 2);
            if (prefix === "0") {
              const token = JSON.parse(payload) as string;
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m,
                ),
              );
            } else if (prefix === "d") {
              // finished
            } else if (prefix === "ctx") {
              try {
                try {
                  const arr = JSON.parse(payload);
                  setContexts(arr);
                } catch {
                  /* ignore */
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [api, input, messages],
  );

  return {
    messages,
    input,
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
    handleSubmit,
    isLoading,
    error,
    contexts,
  } as const;
}
