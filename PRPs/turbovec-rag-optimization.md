# turbovec RAG Optimization PRP

Date: 2026-06-08
Status: implemented

## Background

The project currently stores embeddings in PostgreSQL with pgvector and performs semantic retrieval by sorting `knowledge_chunks.embedding <=> query_vector`. This is simple and reliable, but it can become slow as chunk counts grow because no ANN vector index is currently defined for the embedding column.

RyanCodrai/turbovec is a Rust-backed Python vector search library with compression-oriented indexes, local persistence, and ID mapping/filter support. It is a useful candidate for a sidecar accelerator, but it should not replace PostgreSQL as the source of truth at this stage because the package is alpha and the current application depends on tenant/status/source metadata stored in Postgres.

Sources:

- https://github.com/RyanCodrai/turbovec
- https://github.com/RyanCodrai/turbovec/blob/main/docs/api.md
- https://pypi.org/project/turbovec/

## Goals

- Reduce semantic retrieval latency for large knowledge bases.
- Keep pgvector/Postgres as the source of truth and fallback path.
- Add enough instrumentation to decide whether turbovec is worth production use.
- Preserve current hybrid retrieval and reranking behavior.
- Keep the integration feature-flagged and reversible.

## Non-Goals

- Do not replace Postgres storage with turbovec.
- Do not change embedding providers or embedding dimensions in this work.
- Do not move keyword/full-text retrieval into turbovec.
- Do not change chat UX or admin UI unless metrics display is requested later.

## Current Code Analysis

- `packages/database/prisma/schema.prisma`
  - `KnowledgeChunk.embedding` is `Unsupported("vector(1536)")?`.
  - There are tenant/source/status indexes, but no vector ANN index.

- `apps/api/src/knowledge/retrieval/retrieval.service.ts`
  - Main RAG path calls `retrieveWithRerank()`.
  - Semantic search embeds the query, then executes raw SQL ordered by `embedding <=> query`.
  - Results are merged with keyword results and reranked using vector, keyword, category, title, modality, priority, and freshness scores.

- `apps/api/src/knowledge/services/vector-store.service.ts`
  - Handles embedding helpers, chunk deletion, raw SQL chunk insertion, and a second semantic search helper.
  - `insertChunk()` currently lets Postgres generate the UUID and returns no chunk ID.

- `services/python-sidecar`
  - FastAPI sidecar exists and is a natural home for Python-only vector acceleration.
  - It currently handles parsing/image/entity/graph endpoints, not vector search.

## Recommended Architecture

Use a staged architecture:

1. Baseline and pgvector optimization first.
2. Add turbovec as an optional sidecar accelerator.
3. Keep Postgres rehydration and reranking in NestJS.
4. Fall back to pgvector automatically whenever sidecar search is stale, unhealthy, or disabled.

Request flow after integration:

```text
ChatService
  -> RetrievalService.retrieveWithRerank()
  -> EmbeddingService.embed(query)
  -> semantic candidate provider
     -> turbovec sidecar when enabled and healthy
     -> pgvector SQL fallback otherwise
  -> keyword search
  -> mergeResults()
  -> rerank()
  -> LLM answer generation
```

## Phase 0: Baseline and pgvector ANN

Before adding turbovec, collect baseline metrics:

- chunk count by tenant
- semantic SQL latency p50/p95
- keyword SQL latency p50/p95
- total `retrieveWithRerank()` latency p50/p95
- top-k recall quality from existing RAG evals

Add a pgvector ANN migration first:

```sql
CREATE INDEX knowledge_chunks_embedding_hnsw_idx
ON knowledge_chunks
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL AND status = 'active';
```

Production note: if the database is already large, create the index concurrently with an operational migration, because `CREATE INDEX CONCURRENTLY` cannot run inside a normal transaction.

Acceptance gate for Phase 0:

- If pgvector ANN meets latency goals, turbovec remains optional/research.
- If latency is still too high or memory/cost pressure remains, proceed to turbovec.

## Phase 1: Sidecar Search Prototype

Add a Python module:

- `services/python-sidecar/turbovec_service.py`

Add FastAPI endpoints:

- `GET /vector/health`
- `POST /vector/rebuild`
- `POST /vector/search`
- `POST /vector/upsert-batch`
- `POST /vector/delete`

Sidecar search request:

```json
{
  "tenant_id": "uuid",
  "embedding": [0.1, 0.2],
  "top_k": 20,
  "allow_ids": [1, 2, 3],
  "content_types": ["text", "table"]
}
```

Sidecar search response:

```json
{
  "success": true,
  "provider": "turbovec",
  "index_version": "2026-06-08T12:00:00Z",
  "results": [
    { "vector_index_id": 123, "chunk_id": "uuid", "score": 0.92 }
  ]
}
```

NestJS must still fetch chunk rows from Postgres by returned IDs and validate:

- tenant ID
- `knowledge_chunks.status = 'active'`
- `knowledge_sources.status = 'active'`
- requested content type filters

## Phase 2: Stable ID Mapping

turbovec ID mapping is easier with unsigned integer IDs, while current chunk IDs are UUIDs.

Recommended production mapping:

- Add `KnowledgeChunk.vectorIndexId BigInt @unique @default(autoincrement()) @map("vector_index_id")`.
- Use `vectorIndexId` as turbovec external ID.
- Keep UUID as the public/internal relational ID.

Why this is preferred:

- stable across sidecar restarts
- no UUID hashing collision risk
- easy delete/update sync
- compatible with turbovec `IdMapIndex`

Prototype alternative:

- Keep a sidecar-local JSON/SQLite UUID-to-int map.
- This is acceptable for local experiments, but not preferred for production because stale mappings are easier to create.

## Phase 3: NestJS Integration

Add or extend a sidecar client:

- Option A: extend `PythonSidecarClient` with vector methods.
- Option B: create `VectorAcceleratorClient` so parsing/graph concerns stay separate.

Recommendation: create `VectorAcceleratorClient` under `apps/api/src/knowledge/services/`, because vector search has different health, timeout, and fallback behavior from document parsing.

Add config:

- `VECTOR_SEARCH_PROVIDER=pgvector|turbovec`
- `TURBOVEC_ENABLED=false`
- `TURBOVEC_BASE_URL=http://localhost:8001`
- `TURBOVEC_SEARCH_TIMEOUT_MS=800`
- `TURBOVEC_REBUILD_ON_START=false`
- `TURBOVEC_MIN_CHUNKS=50000`
- `TURBOVEC_TOPK_MULTIPLIER=4`

Modify `RetrievalService.semanticSearch()`:

1. Generate query embedding exactly as today.
2. If turbovec is enabled and healthy, call sidecar for candidate chunk IDs.
3. Rehydrate rows from Postgres and preserve vector scores from sidecar.
4. If sidecar fails, is stale, or returns too few results, run the current pgvector SQL.
5. Return the same `RetrievalResult[]` shape used today.

Keep keyword search, merge, confidence, and rerank logic unchanged in the first implementation.

## Phase 4: Index Sync Strategy

Use rebuild-first for the first implementation:

- `POST /vector/rebuild` loads active chunks and embeddings from Postgres.
- Build one index per embedding dimension and tenant-aware metadata map.
- Persist index files under `services/python-sidecar/.data/turbovec/`.

Then add incremental sync:

- After `PipelineService.processDocument()` completes inserts for one source, call `upsert-batch`.
- After `VectorStoreService.deleteChunks(sourceId)`, call sidecar delete by source/chunk IDs.
- If incremental sync fails, mark sidecar index stale and let queries fall back to pgvector.

Do not make ingestion fail just because turbovec sync failed.

## Data and API Changes

Database:

- Phase 0: add pgvector HNSW index.
- Phase 2: add optional `vector_index_id` bigint unique column.

NestJS:

- Add sidecar vector client.
- Add feature flags/env config.
- Modify semantic search provider selection only.
- Add metrics logs around semantic provider, latency, fallback reason, and result counts.

Python sidecar:

- Add `turbovec` dependency in `services/python-sidecar/requirements.txt`.
- Add vector index service and endpoints.
- Persist index metadata and health state.

No UI changes are required.

## Testing and Verification

Unit tests:

- `RetrievalService` uses pgvector when turbovec disabled.
- `RetrievalService` falls back to pgvector on sidecar timeout/error.
- Sidecar scores are mapped into `vectorScore` without changing result shape.
- Tenant/status validation prevents cross-tenant or inactive chunk leakage.

Integration tests:

- Seed chunks, rebuild sidecar index, compare top-k overlap with pgvector.
- Delete/reindex a source and verify stale chunks do not appear.
- Verify fallback behavior when sidecar is stopped.

Performance checks:

- Baseline pgvector SQL p50/p95 before index.
- pgvector ANN p50/p95 after index.
- turbovec sidecar p50/p95 with rehydration included.
- RAG eval quality before/after using `pnpm test:rag` if the eval harness is available.

Minimum acceptance:

- No regression in tenant isolation.
- No change to public API response shape.
- Sidecar disabled path behaves exactly like current pgvector path.
- turbovec path has a measurable latency improvement at the target chunk scale.
- Failed sidecar never breaks chat/RAG answer generation.

## Risks

- turbovec is alpha; pin the version and keep it optional.
- Python wheel/platform support may be smoother in Linux containers than Windows local development.
- UUID-to-uint64 mapping is a real production concern; use DB-backed numeric IDs before relying on it.
- Embedding dimension mismatch would corrupt search quality; enforce dimension checks at index build and search time.
- Local sidecar indexes can become stale; expose index version, chunk count, and stale state in health checks.

## Todo List

- [ ] Confirm target chunk scale and latency goal.
- [x] Add retrieval timing metrics.
- [x] Add pgvector HNSW migration.
- [ ] Benchmark pgvector/turbovec latency on a production-like corpus once target chunk scale is available.
- [x] Decide whether `vector_index_id` should be added before the turbovec prototype.
- [x] Add sidecar vector endpoints behind feature flags.
- [x] Add NestJS vector accelerator client.
- [x] Route semantic retrieval through provider selection with fallback.
- [x] Add rebuild and stale-index handling.
- [x] Add tests for fallback, tenant isolation, and result rehydration.
- [x] Run typecheck, targeted tests, and RAG eval.

Implementation summary:

- Added `vector_index_id` and a pgvector HNSW migration.
- Added `VectorAcceleratorClient` and feature flags for optional turbovec search.
- Routed semantic retrieval through turbovec when enabled, with pgvector fallback.
- Rehydrates accelerator hits through Postgres and validates active tenant/source rows.
- Added vector accelerator upsert/delete sync from chunk ingestion paths.
- Added Python sidecar turbovec service and `/vector/*` endpoints with degraded fallback behavior.
- Verified with unit tests, API typecheck, full unit suite, RAG eval, Python compile/test, and project build.

## Open Questions

- What is the expected production chunk count per tenant and globally?
- Is the deployment target Linux Docker, Windows host, or both?
- Should sidecar indexes be rebuilt on API start, on demand, or through an admin/job trigger?
- Should the first implementation add `vector_index_id`, or start with a prototype-only sidecar map?

## Completion Summary Requirements

When implementation is complete, report:

- files modified
- env vars added
- database migrations added
- provider behavior and fallback behavior
- benchmark numbers before/after
- tests and checks run
- remaining production risks
