## 🎯 프로젝트 개요

**Voice-to-RAG Chatbot**
브라우저에서 녹음한 회의 음성을 자동 전사(STT)-→ 텍스트 청크 → Dense 임베딩 → Vertex AI RAG Engine에 저장 → Gemini 1.5 Pro + RAG로 실시간 Q\&A를 제공하는 **Next.js (React) 애플리케이션**입니다.
프론트엔드는 Vercel의 오픈소스 템플릿 \*\*`ai-chatbot`\*\*를 그대로 활용하고, 백엔드는 Google Cloud Vertex AI SDK로 구현합니다. ([GitHub][1])

---

## 1. 목표 · 비-목표

| 구분       | 내용                                                                                         |
| -------- | ------------------------------------------------------------------------------------------ |
| **목표**   | • 음성→RAG 파이프라인 전체를 TypeScript로 구현<br>• Dense Search만 사용하여 설계 단순화<br>• Vercel 1-Click 배포 지원 |
| **비-목표** | • Sparse Vector(BM25 등) 생성·하이브리드 검색<br>• 자체 벡터 DB(Pinecone 등) 연동                           |

---

## 2. 기술 스택

* **Frontend** : Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui, Vercel AI SDK (`useChat`) ([AI SDK][2])
* **Backend** :

    * `@google-cloud/vertexai` – Gemini 2.5 Pro, text-embedding-004
    * `@google-cloud/aiplatform` – Vertex AI RAG Engine v1 API ([Google Cloud][3])
    * `@google-cloud/storage` – GCS 업로드
* **Infra** : Vercel(Edge Functions), Google Cloud Vertex AI
* **Lang/Tools** : TypeScript, Node 18 LTS, PNPM/NPM

---

## 3. 아키텍처 한눈에 보기

```
┌────────────┐       POST /api/transcribe ┌────────────┐
│  Browser   │  ─────────────────────────▶│  Edge Fn   │──┐
│ (Recorder) │                            │ (STT)      │  │
└────────────┘                            └────────────┘  │
        ▲                                                  │ GCS
        │  WebSocket/Fetch  /api/chat (stream)             ▼
┌────────────┐       ┌────────────────┐     ┌─────────────────────┐
│  useChat   │──────▶│ Edge Fn /chat  │────▶│ Vertex AI Gemini    │
│  UI Hook   │◀──────│  (RAG call)    │◀────│ (RAG Tool 포함)     │
└────────────┘  SSE  └────────────────┘     └─────────────────────┘
                                            ▲
                                            │ retrieveContexts
                                    ┌─────────────────────┐
                                    │ Vertex AI RAG       │
                                    │  Engine (corpus)    │
                                    └─────────────────────┘
```

---

## 4. 필수 환경 변수 (`.env.local`)

```env
# Google Cloud
GCP_PROJECT_ID=your-project
GCP_LOCATION=us-central1
GCS_BUCKET_NAME=my-rag-bucket
EMBEDDING_MODEL_ID=text-embedding-004
GEN_MODEL_ID=gemini-1.5-pro-001
RAG_CORPUS_NAME=voice-rag-corpus
```

> **TIP** : 로컬 개발은 `gcloud auth application-default login` 한 번이면 됩니다.

---

## 5. 상세 모듈 설명

| 모듈            | 파일/폴더                         | 책임                                                     |
| ------------- | ----------------------------- | ------------------------------------------------------ |
| **녹음 UI**     | `app/record/page.tsx`         | MediaRecorder로 MP3 녹음 후 `/api/transcribe` 호출           |
| **STT Route** | `app/api/transcribe/route.ts` | MP3를 GCS 업로드 → `gemini-2.0-flash`로 전사                  |
| **임베딩 스크립트**  | `scripts/embed.ts`            | `transcript.txt` → 512 token 청크 → Dense 임베딩 → JSONL 생성 |
| **코퍼스 생성**    | `scripts/create-corpus.ts`    | RAG Corpus 생성 + JSONL 파일 `importRagFiles`              |
| **챗 Route**   | `app/api/chat/route.ts`       | Vercel AI SDK 호환 스트림 응답, Gemini 1.5 Pro + RAG Tool 호출  |
| **Chat UI**   | 템플릿 기본 (`useChat`)            | 메시지 상태 관리, 서버-센트 SSE 스트림 렌더                            |

---

## 6. 데이터 흐름 (End-to-End)

1. **사용자 녹음** → `/api/transcribe` (Edge Function)
2. **STT 결과** 클라이언트 수신 후 `scripts/embed.ts` 트리거 ✍︎
3. **임베딩 JSONL** `gs://…/rag-data.jsonl` 업로드
4. **`create-corpus.ts`** 실행 → RAG Corpus 구축 완료
5. **채팅 시작** : `useChat` 훅이 `/api/chat`에 메시지 배열 POST
6. **`/api/chat`** :

    * Gemini 1.5 Pro 모델 인스턴스 생성 (RAG Tool 포함)
    * `streamContent()` 로 답변 스트림 → `NextResponse` 변환
7. **useChat** : 스트림 파싱 → UI 실시간 업데이트

---

## 7. 구현 단계

### 7-1. 템플릿 세팅

```bash
npx create-next-app@latest my-voice-rag \
  --example "https://github.com/vercel/ai-chatbot"
cd my-voice-rag
npm i @google-cloud/aiplatform @google-cloud/vertexai @google-cloud/storage uuid
```

### 7-2. STT 라우트

```ts
// app/api/transcribe/route.ts
const [{ text }] = await audioModel.generateContent([
  { role:'user', parts:[{ uri:`gs://${bucket}/${gcsPath}`, mimeType:'audio/mpeg' }] },
  { role:'user', parts:[{ text:'Transcribe to English text.' }] }
]).then(r => r.response.candidates!.map(c => c.content!.parts![0]));
```

### 7-3. Dense 임베딩

```ts
const req = chunks.map(c => ({ content:{ role:'user', parts:[{ text:c }] } }));
const { embeddings } = await embed.embedContents(req);
```

### 7-4. RAG Corpus

```ts
const [op] = await ragData.createRagCorpus({
  parent,
  ragCorpus:{ displayName:'voice-rag', ragEmbeddingModelConfig:{
     vertexPredictionEndpoint:{ publisherModel:`publishers/google/models/${EMBEDDING_MODEL_ID}` }
  }}
});
```

### 7-5. RAG Tool & 채팅

```ts
const ragTool: Tool = {
  retrieval:{ vertexRagStore:{
     ragResources:[{ ragCorpus:RAG_CORPUS_NAME }],
     ragRetrievalConfig:{ similarityTopK:5 }
  }}
};
const gemini = vertex.getGenerativeModel({
  model: GEN_MODEL_ID,
  tools:[ragTool],
});
const stream = await gemini.streamContent({
  contents:[{ role:'user', parts:[{ text:userQuestion }] }]
});
return new NextResponse(stream);
```

---

## 8. Vercel AI SDK 사용법 핵심

* **`useChat`** 훅은 클라이언트 상태·입력·스트리밍 수신을 모두 관리합니다. 서버가 **`ReadableStream`**(text/event-stream)을 반환하면 자동으로 파싱·렌더합니다. ([AI SDK][2])
* 서버 라우트가 반환할 때는 **`new NextResponse(stream)`** 형식이면 충분합니다.
* 추가 메타데이터를 보내고 싶다면 `experimental_prepareRequestBody` 훅 또는 AI SDK “tools” 프로토콜을 참고하세요. ([AI SDK][4])

---

## 9. Vertex AI RAG Engine: 필수 개념

| 개념                   | 설명                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Corpus**           | 검색 가능한 지식베이스(=index) 단위. 생성 시 **Embedding Model**을 지정해야 함.                                                  |
| **ImportRagFiles**   | GCS/Drive/로컬 파일(JSONL·PDF·TXT…)을 Corpus에 청킹·임베딩하여 삽입.<br>청킹 옵션을 `chunkSize:0` 으로 두면 JSONL이 이미 임베딩된 상태라고 간주. |
| **retrieveContexts** | 쿼리 임베딩 → 상위 K개 컨텍스트 반환.                                                                                     |
| **RAG Tool**         | Gemini 등 LLM 호출 시 “컨텍스트 검색 + 프롬프트 주입”을 자동 수행하도록 하는 인터페이스.                                                   |

공식 가이드는 “Manage your RAG corpus”, “RAG quickstart” 문서를 참고하세요. ([Google Cloud][5], [Google Cloud][6])

---

## 10. 보안 & 비용

* **IAM** : 서비스 계정에 *Vertex AI User*, *Storage Object Admin* 권한만 부여.
* **청구** (1 사용자·8 h 실습 가정)

    * STT 1 시간 ≈ \$0.72
    * text-embedding-004 1000 청크 ≈ \$0.30
    * RAG Engine 저장 1 GB·1 일 ≈ \$0.15
    * Gemini 1.5 Pro 25 k tokens ≈ \$2.0
    * **총 \$3.2 이하 / 인** (변동 有)
* **Auto-Delete 스크립트** : 완료 후 `deleteRagCorpus` 호출해 잔존 인덱스를 제거.

---

## 11. 테스트 & 로컬 개발

1. `npm run dev` – Next.js hot-reload
2. `/record` 페이지에서 dummy MP3 업로드로 STT 확인
3. `npm run embed && npm run corpus` — JSONL 생성·Corpus 구축
4. 홈 채팅에서 질문: **“Summarize key decisions.”**
5. 터미널 로그에서 retrieveContexts latency와 Gemini 답변 확인

---

## 12. Vercel 배포

1. GitHub push → Vercel import
2. **Environment Variables** 섹션에 `.env.local` 동일 값 입력
3. 서비스 계정 JSON은 Vercel Secret(`gcloud-sa`) 으로 저장 후 `GOOGLE_APPLICATION_CREDENTIALS=/var/task/gcloud-sa.json` 환경변수 지정
4. **Deploy** 버튼 한 번으로 배포 완료

---

## 13. 추후 확장 아이디어

* **토큰 비용 절감** : RAG Tool `similarityTopK` ↓, `vectorDistanceThreshold` ↑.
* **멀티모달** : Document AI Layout Parser를 켜서 PDF 레이아웃 보존. ([Google Cloud][7])
* **Access Control** : RAG Engine Corpus 별로 IAM Condition 추가, Vercel Edge Config로 토큰 검증.

---

### ✅ 이 문서를 따라 하면…

* Vertex AI RAG Engine API 호출 방법을 몰라도 **CLI 스크립트/Route 예제**만 복사해 즉시 실행할 수 있습니다.
* Vercel AI SDK(`useChat`)는 **스트림만 되돌려 주면 자동으로 UI를 구성**하므로 복잡한 상태 관리가 필요 없습니다.
* Dense Search만 쓰기 때문에 Sparse Vector 관리/쿼리 가중치 등 까다로운 설정이 없습니다.

즐거운 구현 되세요! 🚀

---

## 14. **Implementation Roadmap (Step-by-Step)**

이 계획은 **프론트엔드 1명 + 백엔드 1명** 기준으로 **2 주 Sprint** 안에 완성할 수 있도록 쪼갠 태스크 목록입니다. 각 단계는 *Pull Request → Code Review → Merge* 순으로 진행합니다.

| 단계 | 담당 | 산출물 / 파일 | 핵심 작업                                                                                                                                                                                                                                                                             |
| --- | --- | --- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **0. Setup** | 공통 | `.env.local`, `gcloud` 로그인 | • Google Cloud Project / GCS Bucket 생성<br>• 필수 환경변수 작성<br>• `gcloud auth application-default login` 로컬 인증<br>• NPM 의존성 설치: `@google-cloud/aiplatform`, `@google-cloud/vertexai`, `@google/genai`, `@google-cloud/storage`, `langchain`, `natural`, `mathjs`, `d3-array` (Semantic Chunking 용) |
| **1. Project Bootstrap** | FE | `next.config.ts`, `globals.css` | • `create-next-app` + Vercel `ai-chatbot` 템플릿 적용<br>• Tailwind / shadcn/ui 초기 세팅 확인                                                                                                                                                                                               |
| **2. Recording UI** | FE | `app/record/page.tsx` | • `MediaRecorder`로 MP3 스트림 획득<br>• 폼 전송 시 `/api/transcribe` POST                                                                                                                                                                                                                  |
| **3. STT Route** | BE | `app/api/transcribe/route.ts` | • **WebM/MP3** 오디오 수신 후 파일 크기 체크<br>  · **≤20 MB** → `inlineData`(base64) 로 `gemini-2.0-flash` 호출<br>  · **>20 MB** → `ai.files.upload()` 이용, 반환 URI 로 호출<br>• 프롬프트 → "Generate a transcript of the speech."<br>• 최종 응답 `{ text:string }` (순수 전사 결과) |
| **4. Semantic Chunking + Embedding** | BE | `scripts/embed.ts`, `lib/semantic-chunk.ts` | • 전사 텍스트를 **Semantic Chunking 알고리즘**으로 구간화 ([문서](docs/semantic_chunking.md))<br>   · 단계: 문장 분리 → 버퍼링 → 문맥 Embedding 생성 → cosine distance 분석 → 의미 단락 추출<br>• 각 청크를 `text-embedding-004`(Vertex AI) 또는 **Gemini Embedding 모델**로 재-Embed 하여 JSONL `{id, embedding, text}` 생성<br>• 결과 파일을 GCS(`gs://…/rag-data.jsonl`) 업로드 |
| **5. Corpus Creation** | BE | `scripts/create-corpus.ts` | • `createRagCorpus` (없으면)<br>• `importRagFiles` 로 JSONL 삽입<br>• 옵션: `chunkSize:0`, `similarityTopK:5`                                                                                                                                                                             |
| **6. Chat API** | BE | `app/api/chat/route.ts` | • RAG Tool 구성 → Gemini 1.5 Pro 스트림 응답<br>• `experimental_Stream()` 래핑                                                                                                                                                                                                             |
| **7. Chat UI 통합** | FE | `app/page.tsx` (홈) | • `useChat({api:'/api/chat'})` 적용<br>• 대화 상태·렌더링 확인                                                                                                                                                                                                                               |
| **8. E2E Test & Smoke Test** | QA | `tests/` | • `record → transcribe → embed → chat` 통합 스크립트<br>• controller `/admin/test` 엔드포인트로 헬스체크                                                                                                                                                                                          |
| **9. CI / Pre-commit** | DevOps | `.github/workflows`, `.pre-commit-config.yaml` | • `npm test`, `eslint`, `prettier`, `tsc --noEmit` 검사                                                                                                                                                                                                                             |
| **10. Vercel Deployment** | DevOps | Vercel dashboard | • GitHub 연동 + Env Secrets 입력<br>• Edge Functions 지역 = `iad1` 설정<br>• Prod URL smoke test                                                                                                                                                                                          |
| **11. Cleanup Utility** | BE | `scripts/delete-corpus.ts` | • `deleteRagCorpus` 자동화<br>• README 코스트 섹션 업데이트                                                                                                                                                                                                                                   |

> **완료 조건** – 홈에서 “Summarize key decisions.” 라고 질문했을 때 회의록 주요 의사결정 3줄 이상을 5초 내 스트리밍 표시하면 Success.


[1]: https://github.com/vercel/ai-chatbot?utm_source=chatgpt.com "A full-featured, hackable Next.js AI chatbot built by Vercel - GitHub"
[2]: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat?utm_source=chatgpt.com "useChat - AI SDK UI"
[3]: https://cloud.google.com/vertex-ai/generative-ai/docs/rag-overview?utm_source=chatgpt.com "Vertex AI RAG Engine overview - Google Cloud"
[4]: https://sdk.vercel.ai/cookbook/next/send-custom-body-from-use-chat?utm_source=chatgpt.com "Send Custom Body from useChat - AI SDK"
[5]: https://cloud.google.com/vertex-ai/generative-ai/docs/manage-your-rag-corpus?utm_source=chatgpt.com "Manage your RAG knowledge base (corpus) - Google Cloud"
[6]: https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-quickstart?utm_source=chatgpt.com "RAG quickstart for Python | Generative AI on Vertex AI - Google Cloud"
[7]: https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/layout-parser-integration?utm_source=chatgpt.com "Use Document AI layout parser with Vertex AI RAG Engine"
