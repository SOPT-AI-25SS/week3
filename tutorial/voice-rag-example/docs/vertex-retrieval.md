## Vertex AI RAG Engine — **`retrieveContexts`** API

https://cloud.google.com/generative-ai-app-builder/docs/ranking#models

### Node.js SDK Technical Specification (v1 beta 1)

> **Scope**
> This document explains how to call the **`retrieveContexts`** method of Vertex AI RAG Engine from a Node.js service. It is distilled entirely from the two Google-supplied docs you shared (RAG Engine core + Retrieval & Reranking). No additional sources were consulted.

---

### 1  Overview

`retrieveContexts` performs vector / hybrid search over a **RAG corpus** (or specific RAG files) and returns the top-k text chunks with similarity scores. These chunks are later fed to an LLM (for `generateContent`) or inspected directly for grounding.

```
┌────────────┐   RetrieveContexts    ┌───────────────┐
│  Your app  │ ────────────────────▶ │  Vertex AI     │
└────────────┘        HTTPS          │  RAG Engine    │
        ▲                            └───────────────┘
        │                                      │
        │                          retrieves & reranks chunks
        └─────────  JSON response  ◀───────────┘
```

---

### 2  Prerequisites

| Item                     | Notes                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Google Cloud project** | RAG Engine and Generative AI APIs enabled.                                                             |
| **RAG corpus**           | Already created and populated (`projects/{project}/locations/{loc}/ragCorpora/{id}`).                  |
| **Service account**      | Role **Vertex AI Admin** *or* `aiplatform.ragUser` + `aiplatform.operationViewer`.                     |
| **Node.js**              | ≥ v16 LTS                                                                                              |
| **Network / security**   | Only **VPC-SC** perimeter controls are honored at GA-time (no CMEK, AXT, data-residency).              |
| **If using rerankers**   | • Gemini models must be enabled (LLM reranker) • Discovery Engine API enabled (Rank Service reranker). |

---

### 3  Install SDK

```bash
npm install @google-cloud/aiplatform   # Node client for Vertex AI
npm install protobufjs@^7              # only if you need manual proto loading
```

> The Node package ships type definitions; no extra `@types/*` needed.

---

### 4  Authentication

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
```

The key must belong to the service account mentioned above.

---

### 5  Client Initialization

```js
// index.js
import {VertexRagDataServiceClient} from '@google-cloud/aiplatform';

const client = new VertexRagDataServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',  // match your LOCATION
});
```

> The class name follows the proto service **`VertexRagDataService`** exposed in the v1beta1 API.
> If you generated your own stub from the proto snippet, import that instead.

---

### 6  Request Object

```ts
// TypeScript-ish for clarity
interface RetrieveContextsRequest {
  parent: string;              // "projects/123/locations/us-central1"
  vertexRagStore: {
    ragResources: RagResource[];   // at least one corpus or file
    vectorDistanceThreshold?: number; // optional cosine-distance filter
  };
  query: RagQuery;
}

interface RagResource {
  ragCorpus?: string;          // "projects/.../ragCorpora/..."
  ragFileIds?: string[];       // within the same corpus
}

interface RagQuery {
  text: string;                // user query
  ragRetrievalConfig?: RagRetrievalConfig;
}

interface RagRetrievalConfig {
  topK?: number;                       // default 10
  hybridSearch?: {alpha?: number};     // Weaviate only, 0-1
  filter?: {
    vectorDistanceThreshold?: number;
    vectorSimilarityThreshold?: number;
  };
  ranking?: {
    llmRanker?: {modelName: string};   // e.g. "gemini-2.0-flash"
    rankService?: {modelName: string}; // e.g. "semantic-ranker-512@latest"
  };
}
```

---

### 7  Minimal Code Sample

```js
import {VertexRagDataServiceClient} from '@google-cloud/aiplatform';

async function retrieve() {
  const projectId = 'YOUR_PROJECT';
  const location  = 'us-central1';
  const corpusId  = 'YOUR_CORPUS_ID';

  const parent = `projects/${projectId}/locations/${location}`;
  const corpusName = `${parent}/ragCorpora/${corpusId}`;

  const request = {
    parent,
    vertexRagStore: {
      ragResources: [{ragCorpus: corpusName}],
      // vectorDistanceThreshold: 0.3    // optional filter
    },
    query: {
      text: 'What is the warranty period for Model X?',
      ragRetrievalConfig: {
        topK: 10
      }
    }
  };

  const [response] = await client.retrieveContexts(request);
  response.contexts.forEach(c => {
    console.log('---');
    console.log('URI  :', c.sourceUri);
    console.log('Chunk:', c.text.substring(0, 200), '...');
    console.log('Score:', c.score);
  });
}

retrieve().catch(console.error);
```

---

### 8  Adding a Reranker (LLM example)

```js
query: {
  text: 'How do I reset my device?',
  ragRetrievalConfig: {
    topK: 20,
    ranking: {
      llmRanker: { modelName: 'gemini-2.0-pro' }
    }
  }
}
```

*Swap `llmRanker` for `rankService` if you prefer the fixed-cost Cloud Ranker.*

---

### 9  Response Schema

```jsonc
{
  "contexts": [
    {
      "sourceUri": "gs://bucket/manual.pdf",
      "sourceDisplayName": "manual.pdf",
      "text": "Hold the power button for 10 s …",
      "score": 0.612345 // smaller = closer when using cosine_distance
    },
    …
  ]
}
```

*Score semantics depend on the underlying vector DB:*

| DB Type                            | Field uses …                                |
| ---------------------------------- | ------------------------------------------- |
| ragManagedDB, Vertex Vector Search | **Cosine distance** (0 = identical)         |
| Pinecone, Weaviate, Feature Store  | See their configs (distance or similarity). |

---

### 10  Error Handling

| gRPC / REST code      | Typical cause           | Suggested action                               |
| --------------------- | ----------------------- | ---------------------------------------------- |
| `NOT_FOUND`           | Wrong corpus / file ID  | Verify resource names & region.                |
| `PERMISSION_DENIED`   | SA missing roles        | Grant `aiplatform.ragUser` or above.           |
| `INVALID_ARGUMENT`    | Bad threshold values    | Check `vectorDistanceThreshold` (must be ≥ 0). |
| `FAILED_PRECONDITION` | Reranker model disabled | Enable Gemini or Discovery Engine API.         |

---

### 11  Quotas & Cost Levers

* **Embedding QPM** during import: default = 1000, adjustable per job.
* **`topK`** and **chunk size** control both latency & LLM token usage.
* **Rerankers**

    * LLM: priced per token processed.
    * Rank Service: fixed per query.
* **Hybrid search α** only relevant for Weaviate: α = 0 (BM25 only) … 1 (dense only).

---

### 12  Security & Compliance Caveats

* RAG Engine currently honors **VPC-SC** boundaries.
* CMEK-encrypted vector indices, data-residency, and Access Transparency (AXT) are **not** yet supported (status: May 2025 docs).
* If these controls are mandatory for your workload, isolate the RAG corpus in a dedicated project/perimeter and apply compensating controls (bucket-level CMEK for raw files, etc.).

---

### 13  Versioning & Lifecycle

* This spec targets **v1beta1** (API base: `https://LOCATION-aiplatform.googleapis.com/v1beta1`).
* As of **29 Apr 2025** new projects can’t enable **Gemini 1.5 Pro/Flash**; existing projects retain access. Plan reranker model choices accordingly.

---

#### Appendix A – Mapping Proto ⇄ JavaScript Object

| Proto field (camelCase in JS)                | JS path inside `RetrieveContextsRequest` |
| -------------------------------------------- | ---------------------------------------- |
| `parent`                                     | `parent`                                 |
| `vertex_rag_store.rag_resources`             | `vertexRagStore.ragResources`            |
| `vertex_rag_store.vector_distance_threshold` | `vertexRagStore.vectorDistanceThreshold` |
| `query.text`                                 | `query.text`                             |
| `query.rag_retrieval_config.top_k`           | `query.ragRetrievalConfig.topK`          |
| …                                            | …                                        |

The Node client converts snake-case proto fields to camelCase automatically.

---

### 14  Ready-to-Run Template

```bash
# 1.  Edit these five lines, then run.
export PROJECT_ID="my-project"
export LOCATION="us-central1"
export CORPUS_ID="support-kb"
export QUERY="How do I pair bluetooth headphones?"
export RERANK_MODEL="gemini-2.0-flash"

node retrieve.js
```

```js
// retrieve.js
import {VertexRagDataServiceClient} from '@google-cloud/aiplatform';
import process from 'node:process';

const {
  PROJECT_ID,
  LOCATION,
  CORPUS_ID,
  QUERY,
  RERANK_MODEL
} = process.env;

const client = new VertexRagDataServiceClient({
  apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`
});

(async () => {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
  const corpus = `${parent}/ragCorpora/${CORPUS_ID}`;

  const [resp] = await client.retrieveContexts({
    parent,
    vertexRagStore: {ragResources: [{ragCorpus: corpus}]},
    query: {
      text: QUERY,
      ragRetrievalConfig: {
        topK: 15,
        ranking: { llmRanker: { modelName: RERANK_MODEL } }
      }
    }
  });

  console.log(JSON.stringify(resp.contexts, null, 2));
})();
```
