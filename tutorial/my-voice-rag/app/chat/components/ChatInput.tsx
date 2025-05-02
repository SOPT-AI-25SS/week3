"use client";

import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSend: (question: string) => void;
}

export default function ChatInput({ disabled = false, onSend }: Props) {
  const [value, setValue] = useState<string>("");

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <div className="flex gap-2 mt-auto">
      <input
        type="text"
        className="flex-1 rounded border px-3 py-2"
        placeholder="Ask a question…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={disabled}
      />
      <button
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
      >
        Send
      </button>
    </div>
  );
}
