import { RagApiResponse } from "@/types/rag";

/**
 * Calls the `/api/rag` endpoint and returns the parsed JSON response.
 * The caller is expected to handle success / error branches.
 */
export async function fetchRag(params: {
  endpoint: string;
  question: string;
}): Promise<RagApiResponse> {
  console.log(params)
  const response = await fetch("/api/rag", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: params.endpoint, question: params.question }),
  });

  return (await response.json()) as RagApiResponse;
}
