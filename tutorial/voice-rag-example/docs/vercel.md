# Vercel AI SDK 빠른 사용 가이드 (Next.js 14 기준)

> **목적** – “AI SDK를 한 번도 써보지 않은 개발자”가 **5 분 안에 채팅 UI + 스트리밍 서버**를 띄워 볼 수 있도록 핵심만 정리했습니다.
> 최신 3.x 버전을 기준으로 합니다. ([AI SDK][1])

---

## 1 . 설치 & 프로젝트 준비

```bash
# Next 14 앱이 이미 있다면 이 두 줄만
npm i ai                      # Vercel AI SDK
npm i react-dom@latest react  # 리액트 최신 권장 버전
```

> **템플릿으로 시작하고 싶다면**
>
> ```bash
> npx create-next-app@latest my-chat --example "https://github.com/vercel/ai-chatbot"
> ```
>
> 템플릿에는 AI SDK, Tailwind, `useChat` 훅이 미리 세팅돼 있습니다. ([AI SDK][2])

---

## 2 . 클라이언트 – `useChat` 훅으로 UI 끝내기

```tsx
// app/chat/page.tsx (Client Component)
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const { messages, handleSubmit, input, handleInputChange, isLoading } =
    useChat({ api: '/api/chat' });     // 서버 엔드포인트만 알려주면 됨

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      {messages.map(m => (
        <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
          <span className="rounded-md px-2 py-1 bg-gray-200 inline-block">
            {m.content}
          </span>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border p-2 rounded"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me anything…"
        />
        <button
          className="bg-black text-white px-4 py-2 rounded"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

* **상태 보관** · **로딩 처리** · **스트림 수신**을 모두 훅이 대신 해 줍니다.
* 화면에 표시되는 `messages` 구조는 OpenAI Chat API와 동일(`[{id, role, content}]`). ([AI SDK][2])

---

## 3 . 서버 – 스트림을 반환하는 Route Handler

### 3-1. 가장 단순한 OpenAI 예시

```ts
// app/api/chat/route.ts
import OpenAI from 'openai';
import { experimental_Stream } from 'ai';        // 3.x 전용 스트림 헬퍼

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,                   // 🟡 중요: 스트리밍!
    messages,
  });

  // AI SDK가 파싱 가능한 SSE 포맷으로 변환
  return experimental_Stream(response);
}
```

* `experimental_Stream(res)` — OpenAI SDK 스트림을 **`text/event-stream`** 으로 래핑해 줍니다.
* `useChat` 훅은 이벤트 스트림을 받아 토큰 단위로 UI를 갱신합니다. ([AI SDK][3])

### 3-2. Vertex AI Gemini(스트림)로 교체해 보기

```ts
import { VertexAI } from '@google-cloud/vertexai';
import { experimental_Stream } from 'ai';

const vertex = new VertexAI({ project: 'my-project', location: 'us-central1' });
const gemini = vertex.getGenerativeModel({ model: 'gemini-1.5-pro' });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const streamRes = await gemini.streamContent({ contents: messages });
  return experimental_Stream(streamRes);
}
```

> **어떤 LLM이든** Node SDK가 *ReadableStream* 을 준다면 `experimental_Stream()` 으로 감싸면 끝!

---

## 4 . 옵션 커스터마이징

`useChat` 은 내부에서 `fetch()` 를 호출합니다. 직접 헤더·body 필드를 수정하고 싶을 때는 `fetchOptions` 콜백을 전달합니다. ([AI SDK][4])

```tsx
const { handleSubmit, ... } = useChat({
  api: '/api/chat',
  fetchOptions: (messages) => ({
    headers: { 'x-user-id': '123' },    // 예: 사용자 인증 토큰
    body: JSON.stringify({ messages, extra: 'foo' }),
  }),
});
```

---

## 5 . 에러 / 리셋 / 스크롤 유틸

| 기능        | 코드 스니펫                                             |
| --------- | -------------------------------------------------- |
| 대화 초기화    | `reset()`                                          |
| 최하단 스크롤   | `useRef` 로 div 지정 후 `useEffect` → `scrollIntoView` |
| 에러 상태     | `error` 값으로 SnackBar 노출                            |
| 리얼타임 입력 중 | `isStreaming` 플래그                                  |

---

## 6 . 요약 Checklist

1. **설치** `npm i ai` → 클라에서 **`useChat`** 사용
2. **Route Handler** 작성 → LLM 스트림 반환 → `experimental_Stream()` 로 감싸기
3. **환경 변수** (예. `OPENAI_API_KEY` 또는 GCP 인증) 설정
4. **배포** – Vercel은 Edge Functions로 자동 최적화

> 이 4단계만 끝나면 “ChatGPT처럼 토큰이 실시간으로 흘러오는” 챗봇을 완성할 수 있습니다. UI를 꾸미거나 백엔드 모델을 갈아끼우는 작업은 모두 **훅 한 줄** 혹은 **Route 한 파일**만 수정하면 됩니다.

---

### 참고 자료

* **AI SDK 공식 문서 – Introduction / useChat** ([AI SDK][5], [AI SDK][2])
* **Next.js Stream 예제** ([AI SDK][3])
* **3.2 마이그레이션 가이드** (실험적 API 변경 확인) ([AI SDK][1])

즐거운 빌드 되세요! 🚀

[1]: https://sdk.vercel.ai/docs/migration-guides/migration-guide-3-2?utm_source=chatgpt.com "Migrate AI SDK 3.1 to 3.2"
[2]: https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat?utm_source=chatgpt.com "useChat - AI SDK UI"
[3]: https://sdk.vercel.ai/cookbook/next/stream-assistant-response?utm_source=chatgpt.com "Stream Assistant Response - Next.js - AI SDK"
[4]: https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot?utm_source=chatgpt.com "Chatbot - AI SDK UI"
[5]: https://sdk.vercel.ai/docs/introduction?utm_source=chatgpt.com "AI SDK by Vercel"
