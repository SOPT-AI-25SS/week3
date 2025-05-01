## 실시간 음성-기반 회의 인사이트 플랫폼 구축 **워크숍 기획안**

---

### 1. 추진 배경 · 목적
- **원격·하이브리드 업무**가 일상화되며 회의 음성 데이터의 구조화 · 검색 수요가 급증
- Google Cloud Vertex AI 생태계를 활용해 **“녹음-→ 텍스트-→ 임베딩-→ RAG 챗봇”** 전 과정을 하루 만에 체험하는 **실습 중심 교육**을 제공
- 수강생이 현업에 돌아가 **자사 회의록 / 콜센터 / 교육 콘텐츠 자동화** PoC를 즉시 착수할 수 있도록 코드 스캐폴딩 제공

---

### 2. 기대 효과
1. **E2E AI 파이프라인** 실습으로 Vertex AI, Speech-to-Text, Vector Search 이해도 상승
2. 실습 결과물이 그대로 팀/회사 PoC의 **초석(코드 + GCP 셋업)** 역할
3. 벤치마킹을 통해 **비용 최적화·Latency 개선** 등 성능 튜닝 노하우 습득

---

### 3. 목표 시스템 기능
1. **브라우저 실시간 음성 녹음** – MediaRecorder API → MP3 업로드
2. **음성 → 텍스트 변환** – Gemini Audio Understanding https://ai.google.dev/gemini-api/docs/audio 사용하기
```
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  const myfile = await ai.files.upload({
    file: "path/to/sample.mp3",
    config: { mimeType: "audio/mp3" },
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: createUserContent([
      createPartFromUri(myfile.uri, myfile.mimeType),
      "Describe this audio clip",
    ]),
  });
  console.log(response.text);
}

await main();

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const base64AudioFile = fs.readFileSync("path/to/small-sample.mp3", {
  encoding: "base64",
});

const contents = [
  { text: "Please summarize the audio." },
  {
    inlineData: {
      mimeType: "audio/mp3",
      data: base64AudioFile,
    },
  },
];

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: contents,
});
console.log(response.text);import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const result = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
    "Generate a transcript of the speech.",
  ]),
});
console.log("result.text=", result.text);

import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const myfile = await ai.files.upload({
  file: "path/to/sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const countTokensResponse = await ai.models.countTokens({
  model: "gemini-2.0-flash",
  contents: createUserContent([
    createPartFromUri(myfile.uri, myfile.mimeType),
  ]),
});
console.log(countTokensResponse.totalTokens);

// Create a prompt containing timestamps.
const prompt = "Provide a transcript of the speech from 02:30 to 03:29."

WAV - audio/wav
MP3 - audio/mp3
AIFF - audio/aiff
AAC - audio/aac
OGG Vorbis - audio/ogg
FLAC - audio/flac

Gemini represents each second of audio as 32 tokens; for example, one minute of audio is represented as 1,920 tokens.
Gemini can only infer responses to English-language speech.
Gemini can "understand" non-speech components, such as birdsong or sirens.
The maximum supported length of audio data in a single prompt is 9.5 hours. Gemini doesn't limit the number of audio files in a single prompt; however, the total combined length of all audio files in a single prompt can't exceed 9.5 hours.
Gemini downsamples audio files to a 16 Kbps data resolution.
If the audio source contains multiple channels, Gemini combines those channels into a single channel.
```
3. **텍스트 분할 & 임베딩** – Vertex AI Text-Embedding-005 또는 Gemini Embedding
4. **벡터 인덱싱 & 검색** – Vertex AI Vector Search (BigQuery 벡터 컬럼 선택 가능)
5. **질의-응답 챗봇(RAG)** – Gemini 1.5 Pro + TOP-k 문단 컨텍스트 주입
6. **Dashboard** – 질의-응답 결과와 근거 문단 하이라이트

---

### 4. 워크숍 개요

| 항목 | 내용 |
|------|------|
| **대상** | 개발자·데이터사이언티스트·PM (최대 25명) |
| **형식** | **6 시간 오프라인 핸즈-온 랩** + 미니 해커톤 |
| **사전 준비** | ① GCP 프로젝트 1인 1개, ② Cloud Shell, ③ Chrome 기반 노트북 |
| **제공 자료** | - 완성 코드 레포(`/labs`)<br>- 단계별 README + TODO 주석<br>- 슬라이드(PDF) & 녹화 링크 |

---

### 5. 세부 커리큘럼 (6 h)

| 시간 | 내용 | 주요 액션 |
|------|------|----------|
| 09:30 – 10:00 | Kick-off & 환경셋업 | IAM·API Enable, 저장소 버킷 생성 |
| 10:00 – 11:00 | **Lab 1 : 브라우저 녹음 & 업로드** | HTML + Flask, Signed URL 업로드 |
| 11:00 – 12:00 | **Lab 2 : STT 변환** | 장기 음성 비동기 API 호출, WER 체크 |
| 13:00 – 14:00 | **Lab 3 : 텍스트 전처리 & 임베딩** | 512 token 슬라이딩 윈도우, Embedding 호출 |
| 14:00 – 15:00 | **Lab 4 : Vector Search 구축** | Index 생성, 유사도 TOP-k 쿼리 |
| 15:00 – 16:00 | **Lab 5 : Gemini RAG 챗봇** | 프롬프트 템플릿·스트리밍 응답 |
| 16:00 – 16:30 | Demo & Wrap-up | 성능·비용 베스트팀 시상 |

---

### 6. 산출물
- `record.html`, `backend_api.py`, `transcribe.py`, `embedding.py`, `rag_chat.py`
- GCP 자원: Storage 버킷, Vertex AI Index, Endpoint
- README: 배포 가이드 + 비용 계산 스프레드시트

---

### 7. 자원 · 예산 (인당 8 h 실습 기준)

| 구분 | 세부 | 추정 비용 |
|------|------|-----------|
| **Speech-to-Text** | 30 분 × 2 회 | ≈ **\$0.36** |
| **Embedding** | 200 문단 | ≈ **\$0.05** |
| **Vector Search** | 1 GB 인덱스 / 1 일 | ≈ **\$0.15** |
| **Gemini 1.5 Pro** | 5 질의 × 8k 토큰 | ≈ **\$0.40** |
| **합계** | (VAT 별도) | **\$0.96 / 인당** |

※ 워크숍 데모 수준으로 월 \$1 미만. 실제 서비스 전환 시 사용량·Auto-Pause 전략으로 최적화 필요.

---

### 8. 팀 구성 · 역할
- **테크 리드(1)** : 커리큘럼 운영, 기술 Q&A
- **튜터(3)** : 실습 중 실시간 코드/콘솔 지원
- **프로젝트 매니저(1)** : 일정·예산·성과 관리
- **참가자(≤ 25)** : 4~5인 스쿼드로 미션 수행

---

### 9. 위험 요소 · 대응
| Risk | 영향 | 대응 방안 |
|------|------|-----------|
| API 쿼터 초과 | 실습 중단 | 워크숍용 별도 Billing 프로젝트 사전 확보 |
| 네트워크 불안정 | 모델 호출 지연 | 오프라인 Whisper Container 예비 제공 |
| 학습 난이도 편차 | 일정 지연 | 미션-기반 튜토리얼, 코드 스캐폴딩 제공 |

---

### 10. 성공 지표 (워크숍 종료 기준)
1. **녹음-→ 답변 총 소요 ≤ 30 초** 달성 팀 비율 70 %↑
2. 참가자 설문 – “업무 즉시 활용 가능” 4 점/5 점 이상 80 %↑
3. 워크숍 이후 1 개월 내 **PoC 착수팀 3팀** 이상

---

### 11. 추진 일정 (제안)
- **D-14** : 참가자 모집·GCP 계정 발급
- **D-7** : 자료·코드 Freeze, Dry-Run
- **D-Day** : 워크숍 실행
- **D + 7** : 설문·피드백·소스 코드 공개
- **D + 30** : PoC 컨설팅 세션(희망 팀 대상)

---

### 12. 부록 — 권장 레포 구조
```
/labs
 ├─ 01_record_upload/
 ├─ 02_stt/
 ├─ 03_embedding/
 ├─ 04_vector_search/
 └─ 05_rag_chat/
```
> 각 디렉터리별 Dockerfile·requirements.txt 포함, `README.md` 에 실습 가이드·TODO 마킹.

---

### 결론
본 워크숍은 **“실시간 음성 데이터의 구조화·검색·활용”** 이라는 시장 요구를 Vertex AI 기반 최신 스택으로 하루 만에 체험할 수 있는 올인원 프로그램입니다. 참가자는 실습을 통해 완전한 E2E 파이프라인을 구현하고, 이후 자사 업무에 곧바로 적용 가능한 **PoC Seed** 를 손에 넣게 됩니다.

### 구현 계획

아래 단계별 예시는 Next.js(타입스크립트) 환경에서 음성 업로드 → STT → 임베딩 → 벡터 검색 → RAG 챗봇 완성까지 구현하는 일반적인 구조를 간략히 정리한 것입니다. (주로 Next.js 13 버전의 Route Handlers, Server Actions 등을
활용한다고 가정)

    ────────────────────────────────────────────────────────

        1. 프로젝트 초기 셋업
           ────────────────────────────────────────────────────────
           • 프로젝트 생성
             npx create-next-app@latest my-voice-rag --typescript

    • .env 파일에 API 키나 GCP 설정 보관
      GOOGLE_API_KEY=yourApiKeyHere
      GCP_PROJECT_ID=yourProjectId

    • 필요한 라이브러리 설치
      npm install @google/genai @google-cloud/storage

    ────────────────────────────────────────────────────────
    2. 음성 녹음 및 업로드
    ────────────────────────────────────────────────────────
    • 클라이언트에서 음성 녹음 (MediaRecorder)

        1. pages/record.tsx(혹은 app/record/page.tsx)에 브라우저 측 녹음 UI 구성
        2. Blob으로 수집된 MP3/WAV 파일을 /api/upload로 업로드

    • /api/upload 라우트 (Route Handler 예시)
      파일: app/api/upload/route.ts
      ┌───────────────────────────────────────────────
      import { NextRequest, NextResponse } from 'next/server';
      import { Storage } from '@google-cloud/storage';

      const storage = new Storage();
      const bucket = storage.bucket(process.env.GCS_BUCKET ?? '');

      export async function POST(req: NextRequest) {
        // 1) Read file from formData
        const data = await req.formData();
        const file = data.get('audioFile') as File;

        // 2) Upload to GCS
        const blob = bucket.file(file.name);
        await blob.save(Buffer.from(await file.arrayBuffer()), {
          contentType: file.type
        });

        return NextResponse.json({
          success: true,
          gcsPath: `gs://${bucket.name}/${file.name}`
        });

      }
      └───────────────────────────────────────────────

    ────────────────────────────────────────────────────────
    3. 음성 → 텍스트 변환(STT)
    ────────────────────────────────────────────────────────
    • /api/transcribe 라우트에서 MP3/WAV를 Gemini Audio Understanding API(또는 Vertex AI Speech)로 전송
    • 단일 파일에 대해 비동기로 전사해 결과를 문자열로 받음

    파일: app/api/transcribe/route.ts
    ┌───────────────────────────────────────────────
    import { NextRequest, NextResponse } from 'next/server';
    import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' });

    export async function POST(req: NextRequest) {
      const { gcsPath } = await req.json();

      // STT 호출: GCS URI → Gemini
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: createUserContent([
          createPartFromUri(gcsPath, 'audio/mpeg'),
          'Transcribe the audio into English text.'
        ])
      });

      return NextResponse.json({ transcript: response.text });
    }
    └───────────────────────────────────────────────

    ────────────────────────────────────────────────────────
    4. 텍스트 전처리 & 임베딩
    ────────────────────────────────────────────────────────
    • 긴 전사 결과를 512~1024 토큰 단위로 분할(Langchain's Semantic Chunking)
    • 각 청크 문자열을 Embedding API로 호출 → 임베딩 벡터 생성
    • 예시: /api/embedding 라우트에서 transcript를 받아 처리

    파일: app/api/embedding/route.ts
    ┌───────────────────────────────────────────────
    import { NextRequest, NextResponse } from 'next/server';
    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' });

    export async function POST(req: NextRequest) {
      const { transcriptChunks } = await req.json();
      // transcriptChunks: string[] (분할된 텍스트 배열)

      const embeddings = [];
      for (const chunk of transcriptChunks) {
        const response = await ai.models.embed({
          model: 'textembedding-gecko', // 예: Vertex AI textembedding-gecko or gemini embedding
          texts: [chunk]
        });
        embeddings.push({ chunk, vector: response.embeddings[0] });
      }

      return NextResponse.json({ embeddings });
    }
    └───────────────────────────────────────────────

    ────────────────────────────────────────────────────────
    5. 벡터 검색
    ────────────────────────────────────────────────────────
    • 생성된 embeddings를 Vertex AI Vector Search나 DB(BigQuery 벡터 컬럼)에 저장
    • /api/index 라우트 등에서 “문자열 쿼리 → 임베딩 → TOP-k 유사도 검색” 구조

    (단순 POC라면, 로컬에 임시로 embedding 배열을 저장 후, 코사인 유사도 계산도 가능하지만 실제 배포용으로는 Vertex AI Index 또는 BigQuery 권장)

    ────────────────────────────────────────────────────────
    6. RAG 챗봇 구현
    ────────────────────────────────────────────────────────
    • /api/chat 라우트에서 다음 작업 수행:

        1. 사용자의 질문에 대한 임베딩 계산
        2. 벡터 검색으로 Top-k 문단/스니펫 찾기
        3. 이 스니펫들을 프롬프트에 첨부하여 Gemini 모델 등으로 Q&A 호출
        4. 최종 답변을 반환

    예: /api/chat/route.ts
    ┌───────────────────────────────────────────────
    import { NextRequest, NextResponse } from 'next/server';
    import { GoogleGenAI } from '@google/genai';

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' });

    // (가정) embeddingStore 는 완성된 Vector Search 모듈 or DB Client
    import { embeddingStore } from '@/lib/embeddingStore';

    export async function POST(req: NextRequest) {
      const { query } = await req.json();

      // 1) 쿼리 임베딩 구하기
      const queryEmbeddingRes = await ai.models.embed({
        model: 'textembedding-gecko',
        texts: [query]
      });
      const queryEmbedding = queryEmbeddingRes.embeddings[0];

      // 2) 유사도 검색 → topChunks
      const topChunks = await embeddingStore.search(queryEmbedding);

      // 3) 프롬프트 생성 및 LLM 호출
      const context = topChunks.map((c: any) => c.chunk).join('\n');
      const prompt = [
        You are an AI assistant. Use the following context to answer the question.\nContext:\n${context},
        Question: ${query}\nAnswer:
      ].join('\n');

      const answerRes = await ai.models.generateText({
        model: 'gemini-1.5-pro', // RAG에 적합한 모델
        prompt
      });

      return NextResponse.json({ answer: answerRes.text });
    }
    └───────────────────────────────────────────────

    ────────────────────────────────────────────────────────
    7. 프론트엔드 (챗 UI 및 Dashboard)
    ────────────────────────────────────────────────────────
    • 브라우저에서는 /api/chat과 통신하면서, 사용자의 질문과 모델 답변을 교환
    • 답변에 근거가 된 “topChunks”는 extra 단계에서 추가로 내려 사용자에게 출처를 하이라이트할 수도 있음
    • Next.js의 Server Components나 Client Components를 혼합해 구조적으로 간결하게 유지

    ────────────────────────────────────────────────────────
    정리
    ────────────────────────────────────────────────────────
    위와 같은 방식으로 Next.js 타입스크립트 환경에서 음성 기반 RAG 시스템을 구축할 수 있습니다.
    • 녹음하고 → 업로드 → STT → 전처리 & 임베딩 → 벡터 검색 → 답변 생성(RAG)
    • 각 단계를 /api/… 라우트로 작게 나누어 유지보수성과 확장성을 확보
    • GCP 자원(Cloud Storage, Vertex AI, BigQuery, etc.)을 적절히 연결해 실제 PoC나 운영 환경에 적용

    이렇게 하면 README.md에서 제시된 워크숍 시나리오(음성 녹음 ~ 챗봇)에 대응하는 End-to-End 구현이 가능해집니다.
