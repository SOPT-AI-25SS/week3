"use client";

import type { RetrievedChunk } from "@/types/rag";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  chunks?: RetrievedChunk[];
}

interface Props {
  message: ChatMessage;
}

export default function ChatMessageRow({ message }: Props) {
  const { role, text, chunks } = message;

  return (
    <div className="whitespace-pre-wrap">
      <p className={role === "user" ? "font-semibold" : ""}>
        {role === "user" ? "You:" : "Assistant:"} {text}
      </p>

      {role === "assistant" && chunks && chunks.length > 0 && (
        <details className="mt-1 cursor-pointer select-none">
          <summary className="text-blue-600">Show supporting chunks</summary>
          <ul className="list-decimal list-inside mt-2 space-y-2 text-sm">
            {chunks.map((c, idx) => (
              <li key={c.id}>
                <span className="font-medium">({idx + 1})</span> {c.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
