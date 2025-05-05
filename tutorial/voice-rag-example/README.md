# VoiceRAG: Voice 녹음한 것을 Vertex AI RAG Engine에 넣어서 LLM에게 질문해보자

## Tech Spec
* [Tech Spec](docs/spec.md)

## Modules
* [Vercel AI SDK](docs/vercel.md)
* [Vertex RAG Engine](docs/vertex.md)
* [Gemini TTS](docs/tts.md)

## 과제
0. 이 프로젝트를 나의 Google Cloud 계정을 설정하여 만들어보자.
1. 해당 프로젝트의 기술적인 흐름을 하나의 그림을 그려 이해해보자.
2. 두 개 중의 하나의 과제를 선택해서 진행해보자.
- 가. Chunk 의 score 등을 프론트엔드에 표시하여 LLM에 넣은 정보 조각들이 어떤 것이 있는지 알 수 있도록 Chat 컴포넌트를 수정해보자.
  ```
  {
  contexts: [
    {
      sourceUri: 'gs://voice-rag-assets-2/rag/auto-1746430339398.jsonl',
      text: 'id 7fddbcf1-61b1-4d28-a41a-b35643b607b8\n' +
        `text Okay, I hear you. It seems like you're saying "Test, test, one, two, three, one, two, three." Is that correct?\n`,
      sourceDisplayName: 'auto-1746430339398.jsonl',
      score: 0.4748015677339469,
      _score: 'score'
    }
  ]
  }
  ```
- 나. 아래 링크를 참고하여 LLM의 chunk에 대하여 진실성 여부를 판단해서 chunk를 LLM 모델에 넣기 전에 사전에 filtering 하도록 해보자.
  - https://cloud.google.com/generative-ai-app-builder/docs/check-grounding#terms-defined

## 구글 클라우드 크레딧 사용 방법
1. 구글 클라우드에 가입한다 (가입시 300달러를 줍니다)
2. 다음 링크에 접속한다. https://trygcp.dev/e/build-ai-KOR01
3. 여기 슬라이드를 통해 사용 방법을 확인한다. https://docs.google.com/presentation/d/1fnQNauWcxgt5eqhTAuaBGn2giNQU6f_f_fv3R7nAvp4/edit?usp=gmail&resourcekey=0-dlnAU4LYN8QV27uVMLeIQA
