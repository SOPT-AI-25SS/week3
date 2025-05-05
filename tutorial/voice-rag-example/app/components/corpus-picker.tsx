"use client";

import React, { useState } from "react";
import { RagCorpus, useCorpus } from "../corpus-context";

export default function CorpusPicker(): React.ReactElement {
  const { corpora, selected, select, refresh, isLoading } = useCorpus();
  const [isCreating, setIsCreating] = useState(false);

  const handleNewCorpus = async () => {
    const title = prompt("New corpus title?");
    if (!title) return;
    const description = prompt("Description (optional)") ?? "";

    try {
      setIsCreating(true);
      select(undefined as unknown as RagCorpus);
      const res = await fetch("/api/corpora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: title, description }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { corpus: RagCorpus };
      await refresh();
      select(data.corpus);
    } catch (err) {
      alert((err as Error).message || "Failed to create corpus");
    } finally {
      setIsCreating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      handleNewCorpus();
    } else {
      const corp = corpora.find((c) => c.name === val);
      if (corp) select(corp);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium" htmlFor="corpus-select">
        Corpus:
      </label>
      <select
        id="corpus-select"
        value={selected?.name ?? ""}
        onChange={handleChange}
        disabled={isLoading || isCreating}
        className="rounded border p-1 text-sm"
      >
        {isLoading || isCreating ? (
          <option>{isCreating ? "Creating…" : "Loading…"}</option>
        ) : (
          <>
            <option value="" disabled>
              {corpora.length ? "Select corpus…" : "No corpus yet"}
            </option>
            {corpora.map((c) => (
              <option key={c.name} value={c.name}>
                {c.displayName}
              </option>
            ))}
            <option value="__new__">➕ New corpus…</option>
          </>
        )}
      </select>
    </div>
  );
}
