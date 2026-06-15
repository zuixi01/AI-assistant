# Meiqia-Style AI Customer Service Optimization

## Background

The project already has the main ingredients for an AI ecommerce customer-service assistant: multi-tenant conversations, RAG retrieval, model configuration, unknown-question capture, human handoff, platform routing, admin workbench pages, and public chat polling. The requested optimization is to make those pieces behave like a complete AI customer-service product rather than a demo chat bot.

Public Meiqia positioning emphasizes 7x24 automated FAQ handling, human-AI collaboration, multi-turn dialogue, intelligent assignment, custom knowledge bases, and all-channel access. This PRP maps those capabilities onto the current NestJS/Next.js codebase without replacing the existing architecture.

## Goals

- Use tenant-level LLM and embedding configuration in runtime chat and retrieval.
- Improve AI turn metadata so admin operators can see intent, confidence, answer status, handoff status, products, and citations.
- Harden workspace conversation actions with tenant-scoped verification.
- Improve channel reply adaptation so platform messages are clean, concise, and readable.
- Fix visible mojibake strings in the chat/admin surfaces touched by this workflow.
- Add focused regression tests for the customer-service workflow.

## Non-Goals

- Do not rebuild the whole chat architecture.
- Do not add a new database schema unless an existing model cannot represent the workflow.
- Do not integrate directly with Meiqia APIs.
- Do not add a new paid model provider.

## Current Code Analysis

- `apps/api/src/chat/chat.service.ts` performs the main orchestration: quota check, persistence, intent heuristics, query rewrite, retrieval, RAG prompt, unknown-question capture, human handoff, product recommendation extraction, retrieval logging, and assistant message persistence.
- `apps/api/src/ai/model-config/model-config.service.ts`, `LlmService.chatWithConfig`, and `EmbeddingService.embedWithConfig` already exist, but `ChatService` and `RetrievalService` are not consistently using tenant config.
- `apps/api/src/workspace/workspace.service.ts` reads messages tenant-safely, but assign/unassign/status updates still write by id after only receiving tenantId.
- `apps/api/src/platform/message-adapter.service.ts` strips markdown and trims channel replies; this pass hardens Chinese bullet output and concise filler cleanup.
- `apps/web/src/app/admin/conversations/[id]/page.tsx` and `apps/web/src/app/chat/[tenantSlug]/page.tsx` already show handoff states; UTF-8 checks found the touched labels are readable, so no unnecessary UI churn is needed.

## Implementation Plan

1. Add failing tests for tenant model config and workspace tenant-scoped mutations.
2. Inject `ModelConfigService` into `ChatService` and use `chatWithConfig` / `chatStreamWithConfig`.
3. Inject `ModelConfigService` into `RetrievalService` and use `embedWithConfig`.
4. Centralize chat metadata construction so persisted assistant messages and platform messages carry the same AI status contract.
5. Harden `WorkspaceService` mutations by verifying `{ id, tenantId }` before updates.
6. Clean `MessageAdapterService` markdown/list handling and concise filler phrases.
7. Fix visible Chinese UI labels in touched chat/admin pages.
8. Run focused unit tests, API build, and Web build.

## Testing And Verification

- `pnpm exec vitest run tests/unit/chat-service-workflow.test.ts tests/unit/platform-router.test.ts --reporter=dot`
- Add and run a focused workspace tenant-isolation test.
- `pnpm --filter @ai-assistant/api build`
- `pnpm --filter @ai-assistant/web build`

## Risks

- Full `test:unit` currently has a known historical blocker: `tests/unit/tenant-isolation.test.ts` references missing product/order service paths.
- Live chat verification depends on local Postgres/Redis/API keys and may need environment-specific setup.
- Existing platform integrations may need per-channel sender verification outside unit tests.

## Acceptance Criteria

- Public chat uses tenant model config for rewrite and answer generation.
- RAG semantic retrieval uses tenant embedding config.
- Workspace assign/unassign/status cannot mutate another tenant's conversation.
- Platform-adapted replies have clean plain-text bullets and no mojibake filler.
- Chat/admin touched surfaces show readable Chinese labels.
- Focused tests and builds pass, or any remaining blocker is documented with exact cause.
