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
    • 긴 전사 결과를 Semantic Chunking
    ```
    import "dotenv/config";
    import { OpenAIEmbeddings } from "@langchain/openai";
    import { TextLoader } from "langchain/document_loaders/fs/text";
    import natural from "natural";
    import * as math from "mathjs";
    import { quantile } from "d3-array"; 
    
    interface SentenceObject {
    sentence: string;
    index: number;
    combined_sentence?: string;
    combined_sentence_embedding?: number[];
    distance_to_next?: number;
    }
    
    /**
    * Asynchronously loads a text file and returns its content as a string.
      *
      * This function creates an instance of `TextLoader` to load the document
      * specified by the given relative path. It assumes the document loader
      * returns an array of documents, and extracts the page content of the first
      * document in this array.
      *
      * @param {string} relativePath - The relative path to the text file that needs to be loaded.
      * @returns {Promise<string>} A promise that resolves with the content of the text file as a string.
      *
    */
    const loadTextFile = async (relativePath: string): Promise<string> => {
    const loader = new TextLoader(relativePath);
    const docs = await loader.load();
    const textCorpus = docs[0].pageContent;
    return textCorpus;
    };
    
    /**
    * Splits a given text corpus into an array of sentences.
      *
      * This function utilizes `natural.SentenceTokenizerNew` to tokenize the provided text corpus
      * into individual sentences. It's designed to accurately recognize sentence boundaries
      * and split the text accordingly. The tokenizer's efficiency and accuracy in identifying
      * sentence endings allow for reliable sentence segmentation, which is crucial for
      * text processing tasks that require sentence-level analysis.
      *
      * @param {string} textCorpus - The text corpus to be split into sentences.
      * @returns {string[]} An array of sentences extracted from the text corpus.
      *
      * @example
      * const text = "Hello world. This is a test text.";
      * const sentences = splitToSentences(text);
      * console.log(sentences); // Output: ["Hello world.", "This is a test text."]
        */
        const splitToSentences = (textCorpus: string): string[] => {
        const tokenizer = new natural.SentenceTokenizerNew();
        const sentences = tokenizer.tokenize(textCorpus);
        return sentences;
        };
    
    /**
    * Structures an array of sentences into an array of `SentenceObject`s, each enhanced with combined sentences based on a specified buffer size.
      *
      * This function iterates through each sentence in the input array, creating an object for each that includes the original sentence, its index, and a combined sentence. The combined sentence is constructed by concatenating neighboring sentences within a specified range (bufferSize) before and after the current sentence, facilitating contextual analysis or embeddings in subsequent processing steps.
      *
      * The `bufferSize` determines how many sentences before and after the current sentence are included in the `combined_sentence`. For example, with a `bufferSize` of 1, each `combined_sentence` will include the sentence itself, the one preceding it, and the one following it, as long as such sentences exist.
      *
      * @param {string[]} sentences - An array of sentences to be structured.
      * @param {number} [bufferSize=1] - The number of sentences to include before and after the current sentence when forming the combined sentence. Defaults to 1.
      * @returns {SentenceObject[]} An array of `SentenceObject`s, each containing the original sentence, its index, and a combined sentence that includes its neighboring sentences based on the specified `bufferSize`.
      *
      * @example
      * const sentences = ["Sentence one.", "Sentence two.", "Sentence three."];
      * const structuredSentences = structureSentences(sentences, 1);
      * console.log(structuredSentences);
      * // Output: [
      * //   { sentence: 'Sentence one.', index: 0, combined_sentence: 'Sentence one. Sentence two.' },
      * //   { sentence: 'Sentence two.', index: 1, combined_sentence: 'Sentence one. Sentence two. Sentence three.' },
      * //   { sentence: 'Sentence three.', index: 2, combined_sentence: 'Sentence two. Sentence three.' }
      * // ]
        */
        const structureSentences = (
        sentences: string[],
        bufferSize: number = 1
        ): SentenceObject[] => {
        const sentenceObjectArray: SentenceObject[] = sentences.map(
        (sentence, i) => ({
        sentence,
        index: i,
        })
        );
    
    sentenceObjectArray.forEach((currentSentenceObject, i) => {
    let combinedSentence = "";

    for (let j = i - bufferSize; j < i; j++) {
      if (j >= 0) {
        combinedSentence += sentenceObjectArray[j].sentence + " ";
      }
    }

    combinedSentence += currentSentenceObject.sentence + " ";

    for (let j = i + 1; j <= i + bufferSize; j++) {
      if (j < sentenceObjectArray.length) {
        combinedSentence += sentenceObjectArray[j].sentence;
      }
    }

    sentenceObjectArray[i].combined_sentence = combinedSentence.trim();
    });
    
    return sentenceObjectArray;
    };
    
    /**
    * Generates embeddings for combined sentences within a new array of SentenceObject items, based on the input array, attaching the embeddings to their respective objects.
      *
      * This function takes an array of SentenceObject items, creates a deep copy to maintain purity, and then filters to identify those with a `combined_sentence`.
      * It generates embeddings for these combined sentences in bulk using the OpenAIEmbeddings service. Each embedding is then attached to the corresponding SentenceObject
      * in the copied array as `combined_sentence_embedding`.
      *
      * The function is pure and does not mutate the input array. Instead, it returns a new array with updated properties.
      *
      * @param {SentenceObject[]} sentencesArray - An array of SentenceObject items, each potentially containing a `combined_sentence`.
      * @returns {Promise<SentenceObject[]>} A promise that resolves with a new array of SentenceObject items, with embeddings attached to those items that have a `combined_sentence`.
      *
      * @example
      * const sentencesArray = [
      *   { sentence: 'Sentence one.', index: 0, combined_sentence: 'Sentence one. Sentence two.' },
      *   // other SentenceObject items...
      * ];
      * generateAndAttachEmbeddings(sentencesArray)
      *   .then(result => console.log(result))
      *   .catch(error => console.error('Error generating embeddings:', error));
          */
          const generateAndAttachEmbeddings = async (
          sentencesArray: SentenceObject[]
          ): Promise<SentenceObject[]> => {
          /* Create embedding instance */
          const embeddings = new OpenAIEmbeddings();
    
    // Deep copy the sentencesArray to ensure purity
    const sentencesArrayCopy: SentenceObject[] = sentencesArray.map(
    (sentenceObject) => ({
    ...sentenceObject,
    combined_sentence_embedding: sentenceObject.combined_sentence_embedding
    ? [...sentenceObject.combined_sentence_embedding]
    : undefined,
    })
    );
    
    // Extract combined sentences for embedding
    const combinedSentencesStrings: string[] = sentencesArrayCopy
    .filter((item) => item.combined_sentence !== undefined)
    .map((item) => item.combined_sentence as string);
    
    // Generate embeddings for the combined sentences
    const embeddingsArray = await embeddings.embedDocuments(
    combinedSentencesStrings
    );
    
    // Attach embeddings to the corresponding SentenceObject in the copied array
    let embeddingIndex = 0;
    for (let i = 0; i < sentencesArrayCopy.length; i++) {
    if (sentencesArrayCopy[i].combined_sentence !== undefined) {
    sentencesArrayCopy[i].combined_sentence_embedding =
    embeddingsArray[embeddingIndex++];
    }
    }
    
    return sentencesArrayCopy;
    };
    
    /**
    * Calculates the cosine similarity between two vectors.
      *
      * This function computes the cosine similarity between two vectors represented as arrays of numbers.
      * Cosine similarity is a measure of similarity between two non-zero vectors of an inner product space that
      * measures the cosine of the angle between them. The cosine of 0° is 1, and it is less than 1 for any other angle.
      * It is thus a judgment of orientation and not magnitude: two vectors with the same orientation have a cosine similarity
      * of 1, two vectors at 90° have a similarity of 0, and two vectors diametrically opposed have a similarity of -1,
      * independent of their magnitude. Cosine similarity is particularly used in positive space, where the outcome is
      * neatly bounded in [0,1].
      *
      * The function returns 0 if either vector has a norm of 0.
      *
      * @param {number[]} vecA - The first vector, represented as an array of numbers.
      * @param {number[]} vecB - The second vector, also represented as an array of numbers.
      * @returns {number} The cosine similarity between vecA and vecB, a value between -1 and 1. Returns 0 if either vector's norm is 0.
      *
      * @example
      * const vectorA = [1, 2, 3];
      * const vectorB = [4, 5, 6];
      * const similarity = cosineSimilarity(vectorA, vectorB);
      * console.log(similarity); // Output: similarity score as a number
        */
        const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
        const dotProduct = math.dot(vecA, vecB) as number;
    
    const normA = math.norm(vecA) as number;
    const normB = math.norm(vecB) as number;
    
    if (normA === 0 || normB === 0) {
    return 0;
    }
    
    const similarity = dotProduct / (normA * normB);
    return similarity;
    };
    
    /**
    * Enhances an array of SentenceObject items by calculating cosine distances between sentences and identifying significant semantic shifts based on a specified percentile threshold.
      * This function first calculates the cosine distance between each sentence's embedding and its next sentence's embedding. It then identifies which of these distances exceed a specified percentile threshold, indicating significant semantic shifts. The `distance_to_next` property is updated for each SentenceObject, and the indices of sentences where significant shifts occur are returned.
      * This operation is performed in a pure manner, ensuring the input array is not modified.
      *
      * @param {SentenceObject[]} sentenceObjectArray - An array of SentenceObject items, each containing a combined sentence embedding.
      * @param {number} percentileThreshold - The percentile threshold as a number (0-100) to identify significant semantic shifts.
      * @returns {{updatedArray: SentenceObject[], significantShiftIndices: number[]}} An object containing the updated array of SentenceObject items with `distance_to_next` property set, and an array of indices indicating significant semantic shifts.
      *
    */
    const calculateCosineDistancesAndSignificantShifts = (
    sentenceObjectArray: SentenceObject[],
    percentileThreshold: number
    ): { updatedArray: SentenceObject[]; significantShiftIndices: number[] } => {
    // Calculate cosine distances and update the array
    const distances: number[] = [];
    const updatedSentenceObjectArray = sentenceObjectArray.map(
    (item, index, array) => {
    if (
    index < array.length - 1 &&
    item.combined_sentence_embedding &&
    array[index + 1].combined_sentence_embedding
    ) {
    const embeddingCurrent = item.combined_sentence_embedding!;
    const embeddingNext = array[index + 1].combined_sentence_embedding!;
    const similarity = cosineSimilarity(embeddingCurrent, embeddingNext);
    const distance = 1 - similarity;
    distances.push(distance); // Keep track of calculated distances
    return { ...item, distance_to_next: distance };
    } else {
    return { ...item, distance_to_next: undefined };
    }
    }
    );
    
    // Determine the threshold value for significant shifts
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const quantileThreshold = percentileThreshold / 100;
    const breakpointDistanceThreshold = quantile(
    sortedDistances,
    quantileThreshold
    );
    
    if (breakpointDistanceThreshold === undefined) {
    throw new Error("Failed to calculate breakpoint distance threshold");
    }
    
    // Identify indices of significant shifts
    const significantShiftIndices = distances
    .map((distance, index) =>
    distance > breakpointDistanceThreshold ? index : -1
    )
    .filter((index) => index !== -1);
    
    return {
    updatedArray: updatedSentenceObjectArray,
    significantShiftIndices,
    };
    };
    
    /**
    * Groups sentences into semantic chunks based on specified shift indices.
      *
      * This function accumulates sentences into chunks, where each chunk is defined by significant semantic shifts indicated by the provided shift indices. Each chunk comprises sentences that are semantically related, and the boundaries are determined by the shift indices, which point to sentences where a significant semantic shift occurs.
      *
      * @param {SentenceObject[]} sentenceObjectArray - An array of SentenceObject items, each potentially containing a sentence, its embedding, and additional metadata.
      * @param {number[]} shiftIndices - An array of indices indicating where significant semantic shifts occur, thus where new chunks should start.
      * @returns {string[]} An array of string, where each string is a concatenated group of semantically related sentences.
      *
      * @example
      * const sentencesWithEmbeddings = [
      *   { sentence: 'Sentence one.', index: 0 },
      *   // other SentenceObject items...
      * ];
      * const shiftIndices = [2, 5]; // Semantic shifts occur after the sentences at indices 2 and 5
      * const semanticChunks = groupSentencesIntoChunks(sentencesWithEmbeddings, shiftIndices);
      * console.log(semanticChunks); // Output: Array of concatenated sentence groups
        */
        const groupSentencesIntoChunks = (
        sentenceObjectArray: SentenceObject[],
        shiftIndices: number[]
        ): string[] => {
        let startIdx = 0; // Initialize the start index
        const chunks: string[] = []; // Create an array to hold the grouped sentences
    
    // Add one beyond the last index to handle remaining sentences as a final chunk
    const adjustedBreakpoints = [...shiftIndices, sentenceObjectArray.length - 1];
    
    // Iterate through the breakpoints to slice and accumulate sentences into chunks
    adjustedBreakpoints.forEach((breakpoint) => {
    // Extract the sentences from the current start index to the breakpoint (inclusive)
    const group = sentenceObjectArray.slice(startIdx, breakpoint + 1);
    const combinedText = group.map((item) => item.sentence).join(" "); // Combine the sentences
    chunks.push(combinedText);
    
        startIdx = breakpoint + 1; // Update the start index for the next group
    });
    
    return chunks;
    };
    
    async function main() {
    try {
    // Step 1: Load a text file.
    const textCorpus = await loadTextFile("assets/essaySmall.txt");

    // Step 2: Split the loaded text into sentences.
    const sentences = splitToSentences(textCorpus);

    // Step 3: Structure these sentences into an array of SentenceObject.
    const structuredSentences = structureSentences(sentences, 1); // Assuming a bufferSize of 1 for simplicity

    // Step 4: Generate embeddings for these combined sentences.
    const sentencesWithEmbeddings = await generateAndAttachEmbeddings(
      structuredSentences
    );

    // Step 5: Calculate cosine distances and significant shifts to identify semantic chunks.
    const { updatedArray, significantShiftIndices } =
      calculateCosineDistancesAndSignificantShifts(sentencesWithEmbeddings, 90); // Assuming a threshold of 90%

    // Step 6: Group sentences into semantic chunks based on the significant shifts identified.
    const semanticChunks = groupSentencesIntoChunks(
      updatedArray,
      significantShiftIndices
    );

    // Step 7: Log each semantic chunk with a clear separator.
    console.log("Semantic Chunks:\n");
    semanticChunks.forEach((chunk, index) => {
      console.log(`Chunk #${index + 1}:`);
      console.log(chunk);
      console.log("\n--------------------------------------------------\n");
    });
    ```
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
    • 생성된 embeddings를 Vertex AI Vector Search/Index에 저장
    • /api/index 라우트 등에서 “문자열 쿼리 → 임베딩 → TOP-k 유사도 검색” 구조
    • Read step5.md to implement.

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

---

## 📄 STORM Parse – Document → Markdown Conversion API

This repository now also supports **STORM Parse**, a Retrieval-Augmented Generation (RAG) endpoint that converts uploaded documents (PDF or image) into Markdown. The endpoint is fully self-contained and follows the same clean, modular principles used for the existing voice-to-RAG pipeline.

### 1. Endpoint summary

```
POST /convert/rag
```

|                | Value                                            |
|----------------|--------------------------------------------------|
| **Purpose**    | Convert a document to Markdown with RAG prompt. |
| **Auth**       | HTTP header **`storm-api-key: <token>`**         |
| **Content-Type** | `multipart/form-data`                            |
| **Allowed files** | `pdf`, `png`, `jpg`, `jpeg`                     |

### 2. Request

```
POST /convert/rag HTTP/1.1
Host: <your-domain>
storm-api-key: ********************
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="sample.pdf"
Content-Type: application/pdf

<binary-data>
------WebKitFormBoundary--
```

#### Body parameters

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | Yes | PDF / PNG / JPG / JPEG only |

### 3. Response

`HTTP 200 OK`

```json
{
  "pages": [
    {
      "page_number": 1,
      "content": "Markdown content of page 1"
    },
    {
      "page_number": 2,
      "content": "Markdown content of page 2"
    }
  ]
}
```

#### Error codes

| Status | Meaning                                   |
|--------|-------------------------------------------|
| 400    | Invalid file type or missing `file` field |
| 500    | Internal error during processing          |

### 4. cURL example

```bash
curl -X POST \
  -H "storm-api-key: $STORM_API_KEY" \
  -F "file=@/path/to/document.pdf" \
  https://<your-domain>/convert/rag
```

### 5. JavaScript (fetch) example

```ts
async function convertDocument(file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/convert/rag', {
    method: 'POST',
    headers: { 'storm-api-key': process.env.NEXT_PUBLIC_STORM_API_KEY! },
    body: form,
  });

  if (!res.ok) throw new Error(`Failed – ${res.status}`);
  const data = await res.json();
  console.log(data.pages);
}
```

### 6. Implementation guide (my-voice-rag)

1. **Create API route** – `app/api/convert/rag/route.ts`
   • Parse `multipart/form-data` (see `busboy` or `formidable`).
   • Validate MIME type and size.
2. **Load STORM API key** – add `STORM_API_KEY="…"` to `.env` (exposed to runtime only) and proxy through the `storm-api-key` header to downstream services if needed.
3. **Vision → Markdown** –
   • Pass the raw file to your Vision LLM (Gemini 1.5 Pro or similar).
   • Prompt pattern: _“Convert every element (text, table, image) to Markdown. Output **only** valid Markdown.”_
   • Split multi-page documents and stream per-page responses for UX responsiveness.
4. **Return JSON payload** exactly as specified above.
5. **(Optional) Vector-index pages** – Re-use `/api/vector-index` to embed & store each Markdown page so that the existing RAG chat endpoint can immediately query the converted document.

The new endpoint has zero coupling with the existing audio pipeline and can be iterated or scaled independently.

---

> Need help? Open an issue or ping the maintainer listed in `package.json`.
