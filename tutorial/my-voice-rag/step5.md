### **구현 계획 상세: 5단계 - 벡터 임베딩, 인덱싱 및 하이브리드 검색 구축 (TypeScript)**

이 단계는 워크숍의 핵심 부분으로, 4단계에서 준비된 텍스트 청크들을 검색 가능한 벡터 형태로 변환하고, Vertex AI Vector Search를 활용하여 의미론적 검색과 키워드 검색을 결합한 하이브리드 검색 시스템을 구축합니다.

**입력:** 4단계에서 생성된 텍스트 청크 배열 (예: `string[]`)

**출력:**
*   배포된 Vertex AI Vector Search Index Endpoint (하이브리드 검색 가능)
*   하이브리드 쿼리를 수행할 수 있는 함수 (다음 단계인 RAG 챗봇에서 사용)

**주요 기술 스택:**
*   TypeScript
*   `@google-cloud/aiplatform` SDK (Vertex AI API용)
*   `@google/genai` 또는 Vertex AI Prediction Endpoint (임베딩 모델 호출용)
*   `@google-cloud/storage` SDK (데이터 업로드용)
*   Sparse Vector 생성을 위한 라이브러리 (예: `natural`, `tf-idf-node`, 또는 커스텀 로직)

**세부 구현 단계:**

**(5.1) Dense & Sparse 임베딩 생성**

*   **목표:** 각 텍스트 청크에 대해 Dense Vector(의미 임베딩)와 Sparse Vector(키워드 표현)를 생성합니다.
*   **구현:**
    *   **Dense Embedding:**
        *   4단계에서 받은 각 텍스트 청크(`chunk: string`)에 대해 Vertex AI Embedding API (예: `text-embedding-004`, `multimodalembedding`) 또는 Gemini Embedding 모델(`@google/genai` SDK 사용 가능)을 호출하여 Dense Vector(`number[]`)를 생성합니다.
        *   워크숍 기획안의 `@google/genai` 예시 (`ai.models.embed`)를 활용할 수 있습니다. 여러 청크를 배치(batch)로 처리하여 효율성을 높입니다.
    *   **Sparse Embedding (표현):**
        *   **개념:** 각 텍스트 청크 내의 중요한 키워드와 그 가중치(예: TF-IDF 또는 BM25 점수)를 계산하여 희소 벡터 형식(`{ indices: number[], values: number[] }`)으로 만듭니다. `indices`는 전체 코퍼스(모든 청크) 기준의 고유 단어 ID 목록이고, `values`는 해당 단어의 가중치입니다.
        *   **구현:**
            *   전체 텍스트 청크 모음(Corpus)을 기준으로 **어휘 사전(Vocabulary)**을 구축합니다. (고유 단어 -> 인덱스 매핑)
            *   각 청크를 토큰화하고, 불용어 제거, 어간 추출 등 전처리를 수행합니다.
            *   `tf-idf-node` 같은 라이브러리를 사용하거나, BM25 알고리즘 로직을 직접 구현하여 각 청크 내 단어들의 가중치를 계산합니다.
            *   계산된 가중치와 어휘 사전의 인덱스를 사용하여 Vertex AI가 요구하는 `SparseTensor` 형식(`{ indices: number[], values: number[] }`)으로 변환합니다. **(주의: 이 과정은 상당한 구현 노력이 필요하며, 워크숍에서는 단순화된 TF-IDF 방식 또는 미리 계산된 예시 데이터를 사용할 수 있습니다.)**
    *   **데이터 구조화:** 생성된 임베딩들을 각 청크의 ID와 함께 객체 배열로 관리합니다.

    ```typescript
    // 개념적 예시 데이터 구조
    interface ProcessedChunk {
      id: string; // 고유 ID (예: 'meeting1_chunk_001')
      text: string; // 원본 텍스트 청크
      denseEmbedding: number[]; // Dense 벡터
      sparseEmbedding: { // Sparse 벡터 표현
        indices: number[];
        values: number[];
      };
    }

    let processedChunks: ProcessedChunk[] = [];
    // ... (루프를 돌며 각 청크에 대해 dense/sparse 임베딩 생성 및 processedChunks 배열 채우기) ...
    ```

**(5.2) Vertex AI Vector Search용 데이터 포맷팅 (JSON Lines)**

*   **목표:** `processedChunks` 배열의 데이터를 Vertex AI Vector Search 인덱스 생성/업데이트에 필요한 JSON Lines 형식으로 변환합니다.
*   **구현:**
    *   각 `ProcessedChunk` 객체를 JSON 문자열로 변환합니다. Vertex AI Hybrid Search는 보통 `id`, `embedding` (dense), `sparseEmbedding` 필드를 기대합니다 (정확한 필드명은 API 버전 확인 필요).
    *   각 JSON 문자열을 개행 문자(`\n`)로 구분하여 하나의 큰 문자열 또는 스트림으로 만듭니다.

    ```typescript
    // processedChunks 배열을 JSONL 문자열로 변환하는 함수 (개념)
    function formatDataToJsonL(chunks: ProcessedChunk[]): string {
      return chunks.map(chunk => JSON.stringify({
        id: chunk.id,
        embedding: chunk.denseEmbedding,
        sparse_embedding: chunk.sparseEmbedding // API 문서 확인하여 정확한 필드명 사용!
      })).join('\n');
    }

    const jsonDataL = formatDataToJsonL(processedChunks);
    ```

**(5.3) 포맷된 데이터 Google Cloud Storage(GCS)에 업로드**

*   **목표:** 생성된 JSONL 데이터를 GCS 버킷에 업로드하여 Vertex AI 인덱스가 접근할 수 있도록 합니다.
*   **구현:**
    *   `@google-cloud/storage` SDK를 사용합니다.
    *   지정된 GCS 버킷 및 경로에 JSONL 데이터를 파일로 저장합니다.

    ```typescript
    import { Storage } from '@google-cloud/storage';

    const storage = new Storage();
    const bucketName = 'YOUR_GCS_BUCKET_NAME'; // 환경 변수 등에서 가져오기
    const gcsPath = `hybrid_embeddings/data-${Date.now()}.jsonl`; // 업로드 경로

    async function uploadToGcs(content: string, destinationPath: string) {
      await storage.bucket(bucketName).file(destinationPath).save(content, {
        contentType: 'application/jsonl', // 명시적 지정 권장
      });
      console.log(`Data uploaded to gs://${bucketName}/${destinationPath}`);
      return `gs://${bucketName}/${destinationPath}`;
    }

    const gcsUri = await uploadToGcs(jsonDataL, gcsPath);
    ```

**(5.4) Vertex AI Vector Search Hybrid Index 생성**

*   **목표:** Dense 벡터와 Sparse 벡터를 모두 처리할 수 있는 하이브리드 인덱스를 생성합니다.
*   **구현:**
    *   `@google-cloud/aiplatform` SDK의 `IndexServiceClient`를 사용합니다.
    *   `createIndex` 메소드를 호출하며, 인덱스 설정(`metadata`)에 하이브리드 검색 관련 구성을 포함합니다.
        *   `contentsDeltaUri`: (5.3)에서 업로드한 JSONL 파일의 GCS 경로.
        *   `dimensions`: Dense 벡터의 차원 수.
        *   `distanceMeasureType`: 예: `DOT_PRODUCT_DISTANCE`.
        *   `sparseRecordConfig`: Sparse 벡터 관련 설정 (예: 전체 어휘 사전 크기 `dimensions`). **(API 문서에서 정확한 필드명과 구조 확인 필수)**
        *   `indexUpdateMethod`: `STREAM_UPDATE` 또는 `BATCH_UPDATE` (Hybrid는 보통 Streaming 지원 필요).
        *   알고리즘 설정 (`treeAhConfig` 등).

    ```typescript
    import { IndexServiceClient } from '@google-cloud/aiplatform';

    const indexClient = new IndexServiceClient();
    const location = 'us-central1'; // 워크숍 리전
    const projectPath = indexClient.projectLocationPath(process.env.GCP_PROJECT_ID!, location);

    async function createHybridIndex(gcsSourceUri: string) {
      const indexConfig = {
        displayName: 'workshop-hybrid-index',
        description: 'Hybrid index for workshop',
        metadataSchemaUri: 'gs://google-cloud-aiplatform/schema/matchingengine/metadata/index_1.0.0.yaml', // 스키마 버전 확인
        metadata: { // 실제 구조는 API 버전 따라 다름 - 문서 필수 확인!
          contentsDeltaUri: gcsSourceUri,
          config: {
            dimensions: 768, // Dense 벡터 차원 (모델에 맞게 수정)
            approximateNeighborsCount: 15,
            distanceMeasureType: 'DOT_PRODUCT_DISTANCE',
            algorithmConfig: {
              treeAhConfig: { leafNodeEmbeddingCount: 1000, leafNodesToSearchPercent: 10 }
            },
            // --- Hybrid Search 설정 ---
            sparseRecordConfig: { // 필드명과 구조는 API 문서 확인!
              dimensions: 50000 // Sparse 벡터 차원 (전체 어휘 사전 크기 추정치)
            }
          }
        },
         indexUpdateMethod: 'STREAM_UPDATE', // 데이터 스트리밍 업데이트 허용 [4]
      };

      const [operation] = await indexClient.createIndex({ parent: projectPath, index: indexConfig });
      console.log('Index creation operation started:', operation.name);
      const [indexResponse] = await operation.promise(); // 완료 대기
      console.log('Hybrid Index created:', indexResponse.name);
      return indexResponse; // 생성된 인덱스 정보 반환
    }

    const createdIndex = await createHybridIndex(gcsUri);
    const indexResourceName = createdIndex.name; // 다음 단계에서 사용 (예: projects/.../indexes/...)
    ```

**(5.5) Vertex AI Index Endpoint 생성**

*   **목표:** 생성된 인덱스를 배포하고 쿼리를 받을 수 있는 네트워크 엔드포인트를 만듭니다.
*   **구현:**
    *   `@google-cloud/aiplatform` SDK의 `IndexEndpointServiceClient`를 사용합니다.
    *   `createIndexEndpoint` 메소드를 호출합니다. Public 엔드포인트 또는 Private 엔드포인트(VPC 네트워크 설정 필요)를 선택할 수 있습니다.

    ```typescript
    import { IndexEndpointServiceClient } from '@google-cloud/aiplatform';

    const endpointClient = new IndexEndpointServiceClient();

    async function createIndexEndpoint() {
      const endpointConfig = {
        displayName: 'workshop-hybrid-endpoint',
        // publicEndpointEnabled: true, // 공개 엔드포인트 사용 시
        // network: `projects/${process.env.GCP_PROJECT_NUMBER}/global/networks/default` // VPC 사용 시
      };

      const [operation] = await endpointClient.createIndexEndpoint({ parent: projectPath, indexEndpoint: endpointConfig });
      console.log('Endpoint creation operation started:', operation.name);
      const [endpointResponse] = await operation.promise();
      console.log('Index Endpoint created:', endpointResponse.name);
      return endpointResponse; // 생성된 엔드포인트 정보 반환
    }

    const createdEndpoint = await createIndexEndpoint();
    const endpointResourceName = createdEndpoint.name; // 다음 단계에서 사용 (예: projects/.../indexEndpoints/...)
    ```

**(5.6) Index를 Endpoint에 배포**

*   **목표:** (5.4)에서 생성한 하이브리드 인덱스를 (5.5)에서 생성한 엔드포인트에 연결하여 쿼리가 가능하도록 합니다.
*   **구현:**
    *   `IndexEndpointServiceClient`의 `deployIndex` 메소드를 사용합니다.
    *   배포할 인덱스의 리소스 이름(`indexResourceName`)과 배포될 엔드포인트의 리소스 이름(`endpointResourceName`)을 지정합니다.
    *   `deployedIndexId`는 이 배포를 식별하는 사용자 정의 ID입니다.

    ```typescript
    async function deployIndexToEndpoint(endpointName: string, indexName: string, deployedId: string) {
      const deployedIndexConfig = {
        id: deployedId,
        index: indexName, // 생성된 인덱스의 전체 리소스 이름
        displayName: deployedId,
        // dedicateResources 또는 automaticResources 등 리소스 설정 가능
      };

      const [operation] = await endpointClient.deployIndex({
        indexEndpoint: endpointName, // 생성된 엔드포인트의 전체 리소스 이름
        deployedIndex: deployedIndexConfig,
      });
      console.log('Index deployment operation started:', operation.name);
      const [deployResponse] = await operation.promise(); // 배포 완료 대기 (시간 소요될 수 있음)
      console.log('Index deployed successfully:', deployResponse);
      return deployResponse;
    }

    const deployedIndexId = 'hybrid_v1'; // 배포 버전 ID
    await deployIndexToEndpoint(endpointResourceName!, indexResourceName!, deployedIndexId);
    ```

**(5.7) 하이브리드 쿼리 함수 구현 (RAG 챗봇에서 사용)**

*   **목표:** 사용자 질문(문자열)을 받아 Dense/Sparse 벡터로 변환하고, 배포된 하이브리드 인덱스에 쿼리하여 관련성 높은 청크 ID 목록을 반환하는 함수를 만듭니다.
*   **구현:**
    *   함수는 사용자 질문(`query: string`)을 인수로 받습니다.
    *   질문에 대해 **Dense Embedding**과 **Sparse Representation**을 생성합니다 (문서 임베딩과 동일한 방식/모델 사용).
    *   `IndexEndpointServiceClient`의 `findNeighbors` (또는 `match`) 메소드를 사용하여 엔드포인트에 쿼리합니다.
    *   쿼리 요청 객체에 `featureVector` (dense query vector), `sparseFeatureVector` (sparse query vector), `neighborCount` (검색할 이웃 수, k), `deployedIndexId`를 포함합니다.
    *   **(선택)** `fraction` 또는 `sparse_weight`/`dense_weight` 파라미터를 사용하여 하이브리드 검색 결과의 가중치를 조절할 수 있습니다 (API 문서 확인).
    *   결과에서 유사한 청크의 ID와 거리(유사도 점수)를 추출하여 반환합니다.

    ```typescript
    // RAG 단계에서 사용할 쿼리 함수 (개념적 예시)
    async function findSimilarChunks(query: string, numNeighbors: number): Promise<{id: string, distance: number}[]> {
      // 1. 쿼리에 대한 Dense Embedding 생성
      // const denseQueryVector = await generateDenseEmbeddingForQuery(query);

      // 2. 쿼리에 대한 Sparse Representation 생성 (문서와 동일 방식)
      // const sparseQueryVector = await generateSparseRepresentationForQuery(query);

      const request = {
        indexEndpoint: endpointResourceName!, // 배포된 엔드포인트 이름
        deployedIndexId: deployedIndexId,
        queries: [
          {
            featureVector: denseQueryVector, // 1번 결과
            sparseFeatureVector: sparseQueryVector, // 2번 결과 (API 필드명 확인!)
            neighborCount: numNeighbors,
            // fraction: { sparseWeight: 0.3, denseWeight: 0.7 } // 가중치 조절 예시 (API 확인)
          }
        ],
      };

      try {
        // findNeighbors 또는 match API 사용 (최신 SDK 확인)
        // const [response] = await endpointClient.findNeighbors(request); // 또는 match
        // const neighbors = response?.nearestNeighbors?.[0]?.neighbors || [];
        // return neighbors.map((n: any) => ({ id: n.datapoint.datapointId, distance: n.distance }));
        console.log("Query Request:", JSON.stringify(request, null, 2));
        // 임시 반환값 (실제 API 호출 필요)
        return Promise.resolve([{ id: 'dummy_chunk_1', distance: 0.9 }, { id: 'dummy_chunk_2', distance: 0.85 }]);
      } catch (error) {
        console.error('Error querying hybrid index:', error);
        return [];
      }
    }
    ```

**요약 및 고려사항:**

*   이 5단계 구현 계획은 4단계의 텍스트 청크를 받아 하이브리드 검색이 가능한 Vertex AI Vector Search 인덱스를 구축하고 쿼리하는 전 과정을 TypeScript 환경 기준으로 상세화했습니다.
*   **Sparse Vector 생성**은 이 단계에서 가장 복잡하고 중요한 부분이며, 실제 구현 시 BM25 로직 또는 적절한 라이브러리 선택 및 적용에 대한 깊은 이해가 필요합니다. 워크숍에서는 이 부분을 단순화하거나 사전 준비된 데이터를 활용하는 방안을 고려해야 합니다.
*   Vertex AI API의 필드명, 메타데이터 스키마 등은 버전에 따라 변경될 수 있으므로, 실제 구현 시에는 **반드시 공식 API 문서를 참조**해야 합니다.
*   인덱스 생성 및 배포는 시간이 소요되는 작업이므로 비동기 처리 및 오류 처리를 견고하게 구현해야 합니다.
*   워크숍 환경에서는 비용 및 리소스 관리를 위해 생성된 인덱스 및 엔드포인트를 워크숍 종료 후 정리하는 절차도 안내해야 합니다.

이 상세 계획을 바탕으로 워크숍의 `04_vector_search/` 또는 별도의 `05_indexing_and_search/` 디렉토리 내에서 TypeScript 코드를 구현할 수 있습니다.
