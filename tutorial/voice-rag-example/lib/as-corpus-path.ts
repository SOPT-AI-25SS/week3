/**
 * Build a fully-qualified Vertex AI corpus resource path from either a corpus
 * ID (e.g. "voice-rag-corpus2") **or** a full resource name that already
 * starts with "projects/".
 *
 * The Vertex AI RAG APIs expect the long form:
 *   projects/{PROJECT}/locations/{LOCATION}/ragCorpora/{CORPUS_ID}
 *
 * If the caller already passes the full path we leave it untouched – this
 * lets the helper be safely applied multiple times.
 */
export function asCorpusPath(
  idOrPath: string,
  projectId: string,
  location: string = "us-central1",
): string {
  if (idOrPath.startsWith("projects/")) {
    return idOrPath;
  }

  return `projects/${projectId}/locations/${location}/ragCorpora/${idOrPath}`;
}
