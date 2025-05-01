import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center h-screen gap-8 p-8 text-center">
      <h1 className="text-3xl font-semibold">Voice RAG Demo</h1>
      <p className="max-w-md text-balance text-neutral-600 dark:text-neutral-300">
        Record your voice in the browser, automatically upload it to Google
        Cloud Storage, and generate insights with our AI pipeline.
      </p>
      <Link
        href="/record"
        className="px-6 py-3 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Go to Recorder
      </Link>
    </main>
  );
}
