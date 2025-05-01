import { getGenaiClient } from "@/lib/genai";

//     Semantic Chunking 파이프라인 (app/api/embedding → lib/semantic-chunk.ts)
//
//         1. 입력
//            • transcript(string)  : 전체 전사 텍스트
//            • bufferSize(number)  : 윈도우 문맥 크기(기본 1; 좌우 한 문장씩)
//            • percentile(number)  : 의미 단절 임계값 결정용 퍼센타일(기본 90)
//            • model / taskType    : Gemini Embedding 모델·taskType(기본 gemini-embedding-exp-03-07 / RETRIEVAL_DOCUMENT)
//         2. 단계별 처리
//            ① 문장 단위 토크나이즈
//               splitIntoSentences() – 간단한 정규식으로 「마침표/물음표/느낌표+공백」을 기준으로 구분.
//
//            ② 윈도우(Combined Sentence) 생성
//               buildWindow() – index i 문장을 중심으로 앞뒤 bufferSize 만큼 포함해 하나의 ‘combined sentence’ 스트링을 만듦.
//               전체 문장 수 N → combined 배열 길이 N.
//
//            ③ 1차 Embedding
//               Gemini embedContent(model, contents = combined[]) 호출 → vector_i (i = 0‥N-1) 획득.
//               SDK 배치 호출이므로 네트워크 라운드트립 1회.
//
//            ④ 인접 문장 코사인 거리 계산
//               distance_i = 1 − cosine(vector_i, vector_{i+1}) (총 N-1개).
//               cosine() 은 수치 오버헤드 없는 직접 구현.
//
//            ⑤ 의미 단절(Breakpoint) 추출
//               • distances 배열을 복사·정렬 → sortedDistances
//               • threshold = quantile(sortedDistances, percentile/100)
//               • breakpoints = { i | distance_i > threshold }
//
//               결과적으로 상위 p% 거리(=유사도 하위 p%) 지점 바로 뒤 문장에서 “의미가 크게 변했다”고 간주.
//
//            ⑥ 문장 Group → Chunk 생성
//               groupSentences() – breakpoints 리스트를 순회하며
//               [startIdx .. breakpoint] 범위 문장들을 공백으로 join → 하나의 chunk 문자열.
//               마지막 문장은 배열 길이-1 을 강제로 breakpoint 로 넣어 남김없이 포함.
//
//            ⑦ Chunk 임베딩 (최종 인덱싱용)
//               Gemini embedContent(model, contents = chunks[]) 재호출 → chunkVectors.
//               반환 { chunk, vector }[] 가 Vector Store(또는 Vertex AI Vector Search)에 바로 저장할 레코드.
//         3. 반환값
//            {
//              success: true,
//              chunkCount,        // 최종 청크 개수
//              breakpoints,       // 의미 단절 발생 문장 인덱스
//              embeddings: [ { chunk, vector }, … ]
//            }
//         4. 특징
//            • 의미 기반: 토큰 길이와 무관하게 “내용 전환” 지점에서 자연스럽게 절단.
//            • 두 번의 임베딩 호출:
//              – 1차(Window) : 의미 변화 탐지용 · 짧고 가볍다.
//              – 2차(Chunk)  : 실제 검색/LLM 컨텍스트용 벡터.
//            • 퍼센타일 조정으로 Chunk 크기·개수를 손쉽게 튜닝.
//            • 전체 로직은 Pure TS, 외부 의존성 최소화(Gemini SDK만 사용).
//         5. 확장 여지
//            • 더 정교한 Sentence Tokenizer(natural, spaCy 등) 교체 가능.
//            • distance metric을 Euclidean/Manhattan 등으로 바꿀 수 있음.
//            • percentile 대신 K-means 등으로 Breakpoint 추출 가능.

// Default configuration constants
const DEFAULT_BUFFER_SIZE = 1; // sentences before & after
const DEFAULT_PERCENTILE = 90; // distance percentile
const DEFAULT_MODEL = "gemini-embedding-exp-03-07";
const DEFAULT_TASK_TYPE = "RETRIEVAL_DOCUMENT";

// ----------------- Public API ---------------------------------------------

export interface SemanticChunkingOptions {
  bufferSize?: number;
  percentile?: number; // 0–100
  model?: string;
  taskType?: string;
}

export interface ChunkEmbedding {
  chunk: string;
  vector: unknown;
}

export async function generateSemanticChunks(
  transcript: string,
  options: SemanticChunkingOptions = {},
): Promise<{ breakpoints: number[]; embeddings: ChunkEmbedding[] }> {
  const bufferSize =
    typeof options.bufferSize === "number" && options.bufferSize >= 0
      ? Math.floor(options.bufferSize)
      : DEFAULT_BUFFER_SIZE;

  const percentile =
    typeof options.percentile === "number" && options.percentile > 0 && options.percentile < 100
      ? options.percentile
      : DEFAULT_PERCENTILE;

  const model = options.model ?? DEFAULT_MODEL;
  const taskType = options.taskType ?? DEFAULT_TASK_TYPE;

  const sentences = splitIntoSentences(transcript);

  // 1. Build combined sentences (windowed context)
  const combined = sentences.map((_, idx) => buildWindow(sentences, idx, bufferSize));

  // 2. Embed combined sentences
  const ai = getGenaiClient();
  const embedResp = await ai.models.embedContent({
    model,
    contents: combined,
    config: { taskType },
  });

  const vectors = embedResp.embeddings as number[][] | undefined;
  if (!vectors || vectors.length !== combined.length) {
    throw new Error("Embedding API returned invalid response");
  }

  // 3. Cosine distance between neighbour windows
  const distances: number[] = [];
  for (let i = 0; i < vectors.length - 1; i += 1) {
    distances.push(1 - cosine(vectors[i], vectors[i + 1]));
  }

  // 4. Determine breakpoints via percentile threshold
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const threshold = quantile(sortedDistances, percentile / 100);
  const breakpoints: number[] = distances
    .map((d, i) => (d > threshold ? i : -1))
    .filter((idx) => idx !== -1);

  // 5. Group sentences into chunks
  const chunks = groupSentences(sentences, breakpoints);

  // 6. Embed each chunk (final representation)
  const chunkResp = await ai.models.embedContent({
    model,
    contents: chunks,
    config: { taskType },
  });

  const chunkVectors = chunkResp.embeddings as number[][] | undefined;
  if (!chunkVectors || chunkVectors.length !== chunks.length) {
    throw new Error("Embedding API returned invalid chunk embeddings");
  }

  const embeddings: ChunkEmbedding[] = chunks.map((chunk, idx) => ({
    chunk,
    vector: chunkVectors[idx],
  }));

  return { breakpoints, embeddings };
}

// ----------------- Helpers -------------------------------------------------

function splitIntoSentences(text: string): string[] {
  const regex = /([^.!?]*[.!?])([\s\n]+|$)/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const s = match[1].trim();
    if (s) sentences.push(s);
  }
  return sentences.length ? sentences : [text.trim()];
}

function buildWindow(sentences: string[], idx: number, buffer: number): string {
  const start = Math.max(0, idx - buffer);
  const end = Math.min(sentences.length - 1, idx + buffer);
  return sentences.slice(start, end + 1).join(" ");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function groupSentences(sentences: string[], breakpoints: number[]): string[] {
  const chunks: string[] = [];
  let startIdx = 0;
  const adjusted = [...breakpoints, sentences.length - 1];
  for (const bp of adjusted) {
    const group = sentences.slice(startIdx, bp + 1).join(" ");
    chunks.push(group);
    startIdx = bp + 1;
  }
  return chunks;
}
