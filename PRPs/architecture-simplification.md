# Architecture Simplification PRP

Status: in progress

## Goal

Reduce backend architecture complexity in the current customer-service core without changing user-facing behavior.

## Scope

- Platform inbound messages should persist each user/assistant message once.
- `ChatService` should expose a clear method for callers that already persisted the inbound user message.
- `KnowledgeModule` should export only public knowledge capabilities needed by other modules.
- Knowledge enhancement routes should be owned by `KnowledgeModule`, not imported as a separate root app module.

## Non-goals

- No broad rewrite of `ChatService` streaming/suggestion flows.
- No database schema changes.
- No platform sender rewrite for Xiaohongshu encryption.
- No RAG ingestion pipeline merge in this pass.

## Current Findings

- `PlatformRouterService.handleMessage()` writes an inbound user message, then calls `ChatService.chat()`, which also writes the user and assistant messages, then the router writes another adapted assistant message.
- `KnowledgeModule` exports many implementation services that no external module currently imports, increasing the public module surface.
- `AppModule` directly imports `KnowledgeEnhancementsModule` even though its routes belong to the knowledge domain.

## Implementation Plan

1. Add a failing unit test proving platform inbound routing persists exactly one user message and one adapted assistant message.
2. Add a `ChatService.generateReplyForPersistedTurn()` method that runs the same customer-service turn logic without saving user/assistant messages.
3. Update `PlatformRouterService` to call the new method after saving the inbound message, and to persist only the adapted assistant reply.
4. Add an architecture contract test for the public knowledge module surface.
5. Import `KnowledgeEnhancementsModule` from `KnowledgeModule`, remove it from `AppModule`, and reduce `KnowledgeModule` exports to `KnowledgeService` and `RetrievalService`.
6. Run focused tests and typecheck.

## Verification

- `pnpm test:unit -- tests/unit/platform-router.test.ts tests/unit/module-boundaries.test.ts tests/unit/chat-service-workflow.test.ts`
- `pnpm typecheck`

## Risks

- Platform router currently does not register concrete reply senders in this workspace; this pass preserves that behavior.
- Xiaohongshu keeps its direct encrypted send flow for now to avoid mixing transport encryption with the generic platform router.
