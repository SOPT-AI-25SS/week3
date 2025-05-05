# 📈 Implementation Progress Tracker

This document records the current status of the “Voice-to-RAG Chatbot” project.
Each major task from **docs/spec.md – Implementation Roadmap** is listed with a
checkbox so that contributors can quickly see what is finished and what is
pending.  Please keep the list up-to-date whenever a pull-request is merged.

> Convention
> * **✅ Done** – merged to `main`, works end-to-end.
> * **🚧 In Progress** – work is happening in a branch / PR.
> * **⬜️ Todo** – not started.

| # | Task (spec §14) | Owner | Status |
|---|-----------------|-------|--------|
| 0 | Setup (.env, gcloud) | – | ✅ Done |
| 1 | Project Bootstrap | FE | ✅ Done |
| 2 | Recording UI | FE | ✅ Done |
| 3 | STT Route | BE | ✅ Done |
| 4 | Semantic Chunking + Embedding | BE | ✅ Done |
| 5 | **Corpus Creation / Selection** | BE | 🚧 In Progress |
| 6 | Chat API (RAG Tool) | BE | 🚧 In Progress |
| 7 | Chat UI Integration | FE | ✅ Done |
| 8 | E2E & Smoke Tests | QA | ⬜️ Todo |
| 9 | CI / Pre-commit | DevOps | ⬜️ Todo |
|10 | Vercel Deployment | DevOps | ⬜️ Todo |
|11 | Cleanup Utility | BE | ⬜️ Todo |

## Current Sprint Focus (Step 5–7)

| Sub-task | Branch / PR | Status |
|----------|-------------|--------|
| `lib/rag-corpus.ts` helper | `feature/rag-corpus-lib` | ✅ Done |
| `/api/corpora` (GET·POST) route | `feature/api-corpora` | ✅ Done |
| `/api/corpora/[id]/import` route | `feature/api-import` | ✅ Done |
| Extend `/api/pipeline` to accept `corpusId` | – | ⬜️ Todo |
| React context `RagCorpusContext` | `feature/corpus-context` | ✅ Done |
| `<CorpusPicker />` component | `feature/corpus-picker` | ✅ Done |
| Integrate picker in `/record` | – | ✅ Done |
| Integrate picker in chat home | – | ✅ Done |
| Update `/api/chat` to read `corpus` query | – | ✅ Done |

---

_Last updated: 2025-05-05_
