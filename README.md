# Week 3: RAG 심화 이해하기

## 가장 많이 맞닥드리는 문제
### 복잡한 데이터 파싱을 잘 하는 방법 고민하기
* LLM-as-a-vision

### 데이터 청킹을 어떻게 잘할 수 있을까?
* 문장 분리기로 파싱된 텍스트를 문장으로 나눈다.
* 임베딩 모델로 문장을 벡터 임베딩 한다.
* 문장 간의 벡터 유사도 점수를 계산해서 기준보다 높으면 하나의 단락으로 합친다.

### RAG 성능 Eval 을 어떻게 평가할 수 있을까?
* RAGAS / G-Eval
* Recall / Precision

### Hybrid Search
* Dense 임베딩 의미론적인 검색
* Lexical 키워드 기반의 검색
* Lexical - 0.3 / Dense - 0.7

## 과제
* [README.md](tutorial%2Fvoice-rag-example%2FREADME.md)
