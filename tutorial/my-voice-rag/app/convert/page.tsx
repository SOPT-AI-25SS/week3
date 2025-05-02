"use client";

/*
 * ConvertPage
 * -----------
 * Professional, clean implementation of the STORM Parse document-to-Markdown UI.
 *
 * High-level responsibilities:
 *   • Let the user pick a single document (PDF / image).
 *   • POST it to `/convert/rag` with the required `storm-api-key` header.
 *   • Render the Markdown content returned by the backend, grouped by page.
 *
 * Implementation notes:
 *   • All React state is co-located and strongly typed (no `any`).
 *   • Functions are pure and intention-revealing.
 *   • No visual frameworks; uses Tailwind classes already available in the repo.
 */

import { useCallback, useState, ChangeEvent, ReactElement } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarkdownPage {
  page_number: number;
  content: string;
}

type UploadState =
  | { status: "idle" }
  | { status: "selecting"; file: File }
  | { status: "uploading" }
  | { status: "success"; pages: MarkdownPage[] }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPT_MIME = "application/pdf,image/png,image/jpeg";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConvertPage(): ReactElement {
  const [state, setState] = useState<UploadState>({ status: "idle" });

  // -- Handlers -------------------------------------------------------------

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "selecting", file });
  }, []);

  const handleUpload = useCallback(async () => {
    if (state.status !== "selecting") return;

    try {
      setState({ status: "uploading" });

      const form = new FormData();
      form.append("file", state.file);

      const response = await fetch("/convert/rag", {
        method: "POST",
        headers: {
          "storm-api-key": process.env.NEXT_PUBLIC_STORM_API_KEY ?? "",
        },
        body: form,
      });

      if (!response.ok) {
        const { message } = (await response.json()) as { message?: string };
        throw new Error(message ?? `Upload failed – ${response.status}`);
      }

      const { pages } = (await response.json()) as { pages: MarkdownPage[] };
      setState({ status: "success", pages });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ status: "error", message });
    }
  }, [state]);

  // -- Render helpers -------------------------------------------------------

  const renderActionSection = (): ReactElement => {
    switch (state.status) {
      case "idle":
      case "selecting":
        return (
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={state.status !== "selecting"}
            onClick={handleUpload}
          >
            Convert to Markdown
          </button>
        );
      case "uploading":
        return <p className="text-blue-600">Uploading… please wait.</p>;
      case "error":
        return <p className="text-red-600">Error: {state.message}</p>;
      default:
        return <></>;
    }
  };

  const renderPages = (): ReactElement | null => {
    if (state.status !== "success") return null;

    return (
      <section className="w-full space-y-8">
        {state.pages.map(({ page_number, content }) => (
          <article key={page_number} className="border rounded p-4">
            <h2 className="font-semibold mb-2">Page {page_number}</h2>
            <pre className="whitespace-pre-wrap text-sm">{content}</pre>
          </article>
        ))}
      </section>
    );
  };

  // -- JSX ------------------------------------------------------------------

  return (
    <main className="flex flex-col items-center gap-6 p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Document → Markdown (STORM Parse)</h1>

      <input type="file" accept={ACCEPT_MIME} onChange={handleFileChange} />

      {renderActionSection()}

      {renderPages()}
    </main>
  );
}
