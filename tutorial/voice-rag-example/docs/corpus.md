**Gathering tech specs for ListCorpus & GetCorpus**

The user asks for technical specs of ListCorpus and GetCorpus, likely looking for a detailed description of API endpoints, parameters, expected response fields, and sample code. Based on the provided proto definitions, I can craft a concise specification without needing to browse — the required information is already available. I’ll summarize the specs clearly in a language the user can easily follow, incorporating both descriptions and examples in REST and Node SDK formats, while also addressing specific pagination and limits. I’ll include some Korean explanations for clarity.


Thought for 12 seconds


### Vertex AI RAG Store – List & Get API Technical Specs

(한국어 설명 · Proto v1 기준)

---

## 1. List Rag Corpora (`ListRagCorpora`)

| 항목           | 값                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------- |
| **gRPC**     | `google.cloud.aiplatform.v1.VertexRagDataService.ListRagCorpora`                         |
| **REST**     | `GET https://{LOCATION}-aiplatform.googleapis.com/v1/{parent}/ragCorpora`                |
| **권한/Scope** | `https://www.googleapis.com/auth/cloud-platform` (Cloud IAM: `roles/aiplatform.user` 이상) |

### 요청

| 필드           | 타입       | 필요 | 설명                                                            |
| ------------ | -------- | -- | ------------------------------------------------------------- |
| `parent`     | `string` | ✔  | 조회할 **Location**<br>`projects/{project}/locations/{location}` |
| `page_size`  | `int32`  |    | 한 페이지에 돌려줄 최대 개수 (기본/최대값은 서비스에 따라 100 \~ 1000)                |
| `page_token` | `string` |    | 이전 호출에서 받은 `next_page_token`                                  |

#### REST 예시

```http
GET https://us-central1-aiplatform.googleapis.com/v1/projects/demo-prj/locations/us-central1/ragCorpora?pageSize=20
Authorization: Bearer $(gcloud auth print-access-token)
```

### 응답

```jsonc
{
  "ragCorpora": [
    {
      "name": "projects/1234/locations/us-central1/ragCorpora/9876543210",
      "displayName": "news-corpus",
      "description": "News articles 2024",
      // … 기타 RagCorpus 필드 …
    }
  ],
  "nextPageToken": "abc123"   // 더 이상 없으면 누락
}
```

> 페이지가 더 있으면 `nextPageToken` 을 전달받으며,
> 같은 `parent`·`page_size` 로 다시 호출할 때 `page_token=...` 으로 넘기면 이어서 조회.

---

## 2. Get Rag Corpus (`GetRagCorpus` / `GetCorpus`)

| 항목           | 값                                                              |
| ------------ | -------------------------------------------------------------- |
| **gRPC**     | `google.cloud.aiplatform.v1.VertexRagDataService.GetRagCorpus` |
| **REST**     | `GET https://{LOCATION}-aiplatform.googleapis.com/v1/{name}`   |
| **권한/Scope** | `https://www.googleapis.com/auth/cloud-platform`               |

### 요청

| 필드     | 타입       | 필요 | 설명                                                                             |
| ------ | -------- | -- | ------------------------------------------------------------------------------ |
| `name` | `string` | ✔  | 대상 코퍼스 경로<br>`projects/{project}/locations/{location}/ragCorpora/{rag_corpus}` |

#### REST 예시

```http
GET https://us-central1-aiplatform.googleapis.com/v1/projects/demo-prj/locations/us-central1/ragCorpora/9876543210
Authorization: Bearer $(gcloud auth print-access-token)
```

### 응답

```jsonc
{
  "name": "projects/1234/locations/us-central1/ragCorpora/9876543210",
  "displayName": "news-corpus",
  "description": "News articles 2024",
  "createTime": "2025-05-05T08:10:09.123Z",
  "updateTime": "2025-05-05T08:15:12.456Z",
  // backendConfig, statistics 등 추가 필드
}
```

---

## 3. 오류 코드

| 코드 (gRPC / HTTP)                                 | 의미            | 흔한 원인 / 해결                                                                            |
| ------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------- |
| `3 / 400 INVALID_ARGUMENT`                       | 경로·파라미터 형식 오류 | `parent`, `name` 가 올바른지 확인                                                            |
| `5 / 404 NOT_FOUND`                              | 대상 미존재        | `ragCorpusId` 오타, 잘못된 프로젝트·리전                                                         |
| `7 / 403 PERMISSION_DENIED` · `CONSUMER_INVALID` | 권한 없음         | 프로젝트·리전에 Vertex AI API 활성화, SA/User에게 `aiplatform.user`·`ragCorpusViewer/Admin` 역할 부여 |

---

## 4. Node SDK 샘플

```ts
import {VertexRagDataServiceClient} from '@google-cloud/vertexai';

const client = new VertexRagDataServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});

const parent = 'projects/1234/locations/us-central1';

// List
for await (const corpus of client.listRagCorporaAsync({ parent, pageSize: 50 })) {
  console.log(corpus.displayName, corpus.name);
}

// Get
const name =
  'projects/1234/locations/us-central1/ragCorpora/9876543210';
const [corpus] = await client.getRagCorpus({ name });
console.log('Fetched corpus:', corpus.displayName);
```

---

### 요약

* **ListRagCorpora** → `parent` 기준으로 RAG 코퍼스 목록과 `nextPageToken` 제공
* **GetRagCorpus** → 단일 코퍼스 세부 정보 조회
* 둘 다 **리소스 경로**를 정확히 지정해야 하며, IAM·API 활성화가 충족되지 않으면 403/404 오류가 발생합니다.
