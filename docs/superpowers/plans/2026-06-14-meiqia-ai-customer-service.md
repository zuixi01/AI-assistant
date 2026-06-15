# Meiqia-Style AI Customer Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current project behave like a complete AI customer-service product with tenant-aware models, RAG, human handoff, operator workflow, platform adaptation, and focused verification.

**Architecture:** Keep `ChatService` as the orchestration point and `RetrievalService` as the search point. Use existing `ModelConfigService`, message metadata, conversation statuses, unknown questions, and admin workbench UI instead of introducing a competing workflow.

**Tech Stack:** NestJS, Prisma, Next.js, Vitest, pnpm workspace, existing design-system components.

---

### Task 1: Prove Tenant-Aware Runtime Config

**Files:**
- Modify: `tests/unit/chat-service-workflow.test.ts`
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/knowledge/retrieval/retrieval.service.ts`

- [x] Run current focused tests.

Command:

```powershell
pnpm exec vitest run tests/unit/chat-service-workflow.test.ts tests/unit/platform-router.test.ts --reporter=dot
```

Expected before implementation: `ChatService` tenant config assertion fails because `ModelConfigService.getConfig` is not called.

- [x] Inject `ModelConfigService` in `ChatService` and call `chatWithConfig` for rewrite, answer, and suggestions.
- [x] Inject `ModelConfigService` in `RetrievalService` and call `embedWithConfig` for semantic search.
- [x] Re-run the focused tests and confirm green.

### Task 2: Harden Workspace Tenant Isolation

**Files:**
- Create or modify: `tests/unit/workspace-tenant-isolation.test.ts`
- Modify: `apps/api/src/workspace/workspace.service.ts`

- [x] Add tests showing `assignConversation`, `unassignConversation`, and `updateStatus` first look up `{ id, tenantId }`.
- [x] Implement a shared `findTenantConversationOrThrow` helper.
- [x] Re-run the focused workspace test.

### Task 3: Clean Channel Reply Adaptation

**Files:**
- Create or modify: `tests/unit/message-adapter.test.ts`
- Modify: `apps/api/src/platform/message-adapter.service.ts`

- [x] Add tests for markdown stripping, Chinese bullet conversion, and concise filler removal.
- [x] Replace mojibake strings with readable Chinese punctuation and phrases.
- [x] Re-run adapter and platform-router tests.

### Task 4: Polish Touched Chat UI Copy

**Files:**
- Modify: `apps/web/src/app/chat/[tenantSlug]/page.tsx`
- Modify: `apps/web/src/app/admin/conversations/[id]/page.tsx`

- [x] Replace visible mojibake labels with Chinese strings or existing i18n keys.
- [x] Fix product price prefix to `¥`.
- [x] Keep layout and component system unchanged.

### Task 5: Verify

**Commands:**

```powershell
pnpm exec vitest run tests/unit/chat-service-workflow.test.ts tests/unit/platform-router.test.ts tests/unit/workspace-tenant-isolation.test.ts tests/unit/message-adapter.test.ts --reporter=dot
pnpm --filter @ai-assistant/api build
pnpm --filter @ai-assistant/web build
```

Expected: Focused tests and builds pass. If full `pnpm test:unit` remains blocked by known missing product/order imports, document it separately instead of hiding the blocker.

- [x] Restored missing product/order/Doudian service contracts so full unit tests can collect and run.
- [x] Fixed `module-boundaries.test.ts` to avoid importing `AppModule` in KnowledgeModule-only assertions.
- [x] Ran `pnpm test:unit -- --reporter=dot`: 18 files, 54 tests passed.
- [x] Ran `pnpm --filter @ai-assistant/api build`: passed.
- [x] Ran `pnpm --filter @ai-assistant/web build`: passed with existing React hook dependency warnings.
