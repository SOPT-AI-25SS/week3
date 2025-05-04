import Link from "next/link";

export const runtime = "edge";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-6 text-center">
      <h1 className="text-4xl font-bold">Voice-to-RAG Chatbot</h1>
      <p className="max-w-xl text-balance text-lg text-gray-600 dark:text-gray-300">
        Record your meeting, transcribe with Gemini&nbsp;Flash, semantically
        chunk&nbsp;+ embed to Vertex&nbsp;AI RAG Engine, then chat with Gemini&nbsp;1.5
        Pro in real-time.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/record"
          className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Record a Meeting
        </Link>

        <Link
          href="/chat"
          className="rounded border border-gray-400 px-6 py-3 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Open Chat
        </Link>
      </div>

      <footer className="mt-16 text-xs text-gray-400">
        Built with Next.js 14, Vercel AI SDK & Vertex AI.
      </footer>
    </main>
  );
}
