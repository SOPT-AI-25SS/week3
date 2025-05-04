## Vertex AI RAG Engine (TypeScript) — “Hello-Corpus” 예제

> **목표** — “코퍼스 하나 만들고 → JSONL 파일을 넣고 → 질문을 던져서 컨텍스트가 섞인 Gemini 답을 받기” 까지를 **100 줄 이내 TypeScript** 코드로 보여줍니다.

### 0. 사전 준비

| 단계                 | 명령 / 내용                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDK 설치**         | `npm i @google-cloud/aiplatform @google-cloud/vertexai uuid`                                                                                                |
| **인증**             | 로컬 → `gcloud auth application-default login` <br>Vercel → 서비스 계정 JSON을 Secret로 저장 후<br>`GOOGLE_APPLICATION_CREDENTIALS=/var/task/sa.json`                   |
| **환경 변수** (`.env`) | `env GCP_PROJECT_ID=<project> GCP_LOCATION=us-central1 EMBEDDING_MODEL_ID=text-embedding-004 GEN_MODEL_ID=gemini-1.5-pro-001 RAG_CORPUS_NAME=hello-corpus ` |

> RAG Engine API와 코퍼스·질의 개념은 Google 공식 문서의 **“RAG Engine API”**·“RAG Quickstart”에서 확인할 수 있습니다. ([Google Cloud][1])

---

### 1. 클라이언트 초기화

```ts
// lib/googleClients.ts
import { VertexRagDataServiceClient, VertexRagServiceClient }
        from '@google-cloud/aiplatform';
import { VertexAI } from '@google-cloud/vertexai';
import 'dotenv/config';

const endpoint = `${process.env.GCP_LOCATION}-aiplatform.googleapis.com`;

export const ragData  = new VertexRagDataServiceClient({ apiEndpoint: endpoint });
export const ragQuery = new VertexRagServiceClient({ apiEndpoint: endpoint });
export const vertex   = new VertexAI({
  project : process.env.GCP_PROJECT_ID!,
  location: process.env.GCP_LOCATION!
});
```

---

### 2. “Hello-Corpus” 빌드 스크립트 (100 줄)

```ts
// scripts/helloCorpus.ts
import { ragData, ragQuery, vertex } from '../lib/googleClients';
import { Storage } from '@google-cloud/storage';
import { v1 } from '@google-cloud/aiplatform';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';

const BUCKET = 'my-rag-demo-bucket';                   // 생성해 두세요
const CORPUS = process.env.RAG_CORPUS_NAME!;
const EMB_MODEL = process.env.EMBEDDING_MODEL_ID!;
const GEN_MODEL = process.env.GEN_MODEL_ID!;

/** 1) ➊ 간단한 텍스트 → JSONL + GCS 업로드 */
async function uploadJsonl(): Promise<string> {
  const text = `Vertex AI RAG Engine connects Gemini
to your private knowledge base for better answers.`;
  // → 한 줄 JSONL (이미 임베딩 포함)
  const embeddingModel = vertex.getGenerativeModel({ model: EMB_MODEL });
  const [{ values }]   = (await embeddingModel.embedContent({ content: {parts:[{text}]}})).embedding!;
  const jsonl          = JSON.stringify({ id: uuid(), embedding: values, text });
  const storage        = new Storage();
  const gcsKey         = `rag-data/${Date.now()}.jsonl`;
  await storage.bucket(BUCKET).file(gcsKey).save(jsonl);
  return `gs://${BUCKET}/${gcsKey}`;
}

/** 2) ➋ 코퍼스가 없으면 만들기 */
async function ensureCorpus(): Promise<string> {
  const parent = ragData.locationPath(process.env.GCP_PROJECT_ID!,
                                      process.env.GCP_LOCATION!);
  const [list] = await ragData.listRagCorpora({ parent });
  const found  = list.find(c => c.displayName === CORPUS);
  if (found) return found.name!;
  const [op] = await ragData.createRagCorpus({
    parent,
    ragCorpus: {
      displayName: CORPUS,
      ragEmbeddingModelConfig: {
        vertexPredictionEndpoint: {
          publisherModel: `publishers/google/models/${EMB_MODEL}`
        }
      }
    }
  });
  const [corpus] = await op.promise();
  return corpus.name!;
}

/** 3) ➌ JSONL 임포트 */
async function importData(corpusName: string, gcsUri: string) {
  const [op] = await ragData.importRagFiles({
    parent: corpusName,
    importRagFilesConfig: {
      gcsSource:              { uris:[gcsUri] },
      ragFileChunkingConfig:  { chunkSize: 0 }   // 이미 chunk·임베딩 완료
    }
  });
  await op.promise();           // built-in vector DB 색인 완료까지 대기
}

/** 4) ➍ RAG Tool → Gemini 질문 */
async function ask(question: string, corpusName: string) {
  const ragTool = {
    retrieval: {
      vertexRagStore: {
        ragResources:       [{ ragCorpus: corpusName }],
        ragRetrievalConfig: { similarityTopK: 3 }
      }
    }
  };
  const gemini = vertex.getGenerativeModel({
    model: GEN_MODEL,
    tools:[ragTool],
    generationConfig:{ maxOutputTokens: 512 }
  });
  const res = await gemini.generateContent({
    contents:[{ role:'user', parts:[{ text: question }] }]
  });
  console.log('🔎  Answer:', res.response.candidates?.[0]
                          ?.content?.parts?.[0]?.text ?? 'no answer');
}

/** 5) 실행 */
(async () => {
  const gcsUri  = await uploadJsonl();
  const corpus  = await ensureCorpus();
  await importData(corpus, gcsUri);          // 한 줄 JSONL 임포트
  await ask('What is Vertex AI RAG Engine?', corpus);
})();
```

---

### 3. 코드 해설 (한눈 요약)

| 단계       | API 호출                       | 핵심 파라미터                          | 설명                               |
| -------- | ---------------------------- | -------------------------------- | -------------------------------- |
| ➊ 임베딩    | `embedContent`               | `model=text-embedding-004`       | 짧은 문장을 Dense 768-vector로 변환      |
| ➋ 코퍼스 생성 | `createRagCorpus`            | `ragEmbeddingModelConfig`        | 코퍼스마다 **하나의 임베딩 모델**을 지정해야 함     |
| ➌ 파일 임포트 | `importRagFiles`             | `gcsSource.uris`, `chunkSize:0`  | 이미 임베딩된 JSONL은 chunking 0        |
| ➍ 질문     | `generateContent` + RAG Tool | `ragResources`, `similarityTopK` | Gemini가 **질문 임베딩→검색→답변**까지 자동 수행 |

*모든 메서드는 Long-running operation(LRO) → `await op.promise()` 로 완료까지 대기*.

---

### 4. 실행 결과 예시

```text
🔎  Answer:
Vertex AI RAG Engine is a managed service that lets Gemini
automatically retrieve relevant chunks from a corpus that you
create (stored in an internal vector DB) and use them to answer
your questions more accurately.
```

---

## 참고 링크

* RAG Engine API 레퍼런스 ([Google Cloud][1])
* “Building RAG with Vertex AI RAG Engine” 튜토리얼 ([Medium][2])

---

**이 한 파일만 돌려 보면 “Vertex AI RAG Engine ↔ Gemini” 연동이 어떻게 돌아가는지 단박에 체감할 수 있습니다.**
필요하면 JSONL 대신 PDF·TXT를 넣고 `chunkSize` 를 지정해서 자동 임베딩·청킹 파이프라인도 바로 실험해 보세요.

[1]: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/rag-api?utm_source=chatgpt.com "RAG Engine API | Generative AI on Vertex AI - Google Cloud"
[2]: https://medium.com/google-cloud/building-rag-for-product-recommendation-using-google-gemini-2-0-apis-9ecca5089ae2?utm_source=chatgpt.com "Building RAG for Product Recommendation using Google Gemini ..."
