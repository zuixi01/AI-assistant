# Fix Public Chat AI Model Configuration

## Background

The public chat page can create tenants and conversations, but `POST /api/chat` returns HTTP 500. The tenant record contains configured LLM and embedding settings, while the runtime chat flow still uses provider factories initialized only from `.env`.

## Goals

- Public chat must call the tenant-configured LLM provider.
- Knowledge retrieval must embed queries with the tenant-configured embedding provider.
- The chat response should continue to use RAG context and save messages, retrieval logs, statuses, and metadata.
- Missing or invalid provider configuration should fail with a useful error instead of a generic provider lookup failure.

## Non-Goals

- Do not redesign the chat UI.
- Do not change the database schema.
- Do not rotate or expose model API keys.

## Current Code Analysis

- `ChatController` resolves the public conversation and passes `tenantId` to `ChatService`.
- `ChatService` calls `llmService.chat(...)` without tenant provider config.
- `RetrievalService` calls `embeddingService.embed(query)` without tenant provider config.
- `ModelConfigService.getConfig(tenantId)` already reads tenant-level `config.modelConfig`.
- `LlmProviderFactory` and `EmbeddingProviderFactory` only register providers from environment variables.

## Implementation Plan

1. Add tests proving `ChatService` uses tenant LLM config and `RetrievalService` uses tenant embedding config.
2. Add runtime provider creation from `ProviderConfig` to LLM and embedding factories/services.
3. Inject `ModelConfigService` into `ChatService` and `RetrievalService`.
4. Thread tenant LLM config through chat, suggest, stream, rewrite, and metadata model names.
5. Thread tenant embedding config through semantic retrieval.
6. Verify unit tests, API build, and a live public chat request.

## Acceptance Criteria

- Unit tests fail before the implementation and pass after it.
- `pnpm --filter @ai-assistant/api build` succeeds.
- A live request through `/api/conversations` then `/api/chat` returns HTTP 201/200, not 500.
- Response content comes from the configured model path or the existing knowledge fallback when confidence is low.

