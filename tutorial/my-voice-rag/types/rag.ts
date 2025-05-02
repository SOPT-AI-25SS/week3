export interface RetrievedChunk {
  id: string;
  text: string;
  distance: number;
}

export interface RagApiSuccess {
  success: true;
  answer: string;
  chunks: RetrievedChunk[];
}

export interface RagApiError {
  success: false;
  message: string;
}

export type RagApiResponse = RagApiSuccess | RagApiError;
