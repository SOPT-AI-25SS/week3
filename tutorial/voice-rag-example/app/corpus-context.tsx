"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface RagCorpus {
  name: string;
  displayName: string;
  description?: string;
}

interface CorpusContextValue {
  corpora: RagCorpus[];
  selected?: RagCorpus;
  isLoading: boolean;
  select: (corpus: RagCorpus) => void;
  refresh: () => Promise<void>;
}

const CorpusContext = createContext<CorpusContextValue | null>(null);

export function useCorpus() {
  const ctx = useContext(CorpusContext);
  if (!ctx) throw new Error("useCorpus must be used inside <CorpusProvider>");
  return ctx;
}

export function CorpusProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [corpora, setCorpora] = useState<RagCorpus[]>([]);
  const [selected, setSelected] = useState<RagCorpus | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchCorpora = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/corpora", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as { corpora: RagCorpus[] };
      setCorpora(data.corpora);

      // Auto-select first corpus when none yet chosen.
      if (!selected && data.corpora.length) {
        setSelected(data.corpora[0]);
      }
    } catch (e) {
      console.error("Failed to list corpora", e);
    } finally {
      setIsLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    fetchCorpora();
  }, [fetchCorpora]);

  const value: CorpusContextValue = {
    corpora,
    selected,
    isLoading,
    select: setSelected,
    refresh: fetchCorpora,
  };

  return <CorpusContext.Provider value={value}>{children}</CorpusContext.Provider>;
}
