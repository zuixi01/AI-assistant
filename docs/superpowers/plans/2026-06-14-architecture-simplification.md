# Architecture Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the backend customer-service architecture by removing duplicate platform message persistence and narrowing the knowledge module interface.

**Architecture:** Keep `ChatService.chat()` as the public chat endpoint behavior. Add a separate method for callers that have already persisted the inbound message, so platform routing can reuse chat intelligence without owning chat persistence. Keep knowledge implementation modules internal unless another Nest module needs to inject them.

**Tech Stack:** NestJS, Prisma, Vitest, pnpm/turbo.

---

### Task 1: Platform Router Persistence Contract

**Files:**
- Create: `tests/unit/platform-router.test.ts`
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/platform/platform-router.service.ts`

- [ ] **Step 1: Write the failing test**

Add a unit test that instantiates `PlatformRouterService` with a real `ChatService` harness and verifies one inbound platform turn writes exactly two normal messages: one user message and one adapted assistant message.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/platform-router.test.ts`
Expected: FAIL because the current router calls `ChatService.chat()` and duplicates persistence.

- [ ] **Step 3: Add persisted-turn chat method**

Add `ChatService.generateReplyForPersistedTurn()` and route both `chat()` and the new method through one private `runChatTurn()` implementation.

- [ ] **Step 4: Update platform router**

Store the inbound message once, pass its id into `generateReplyForPersistedTurn()`, then store the adapted assistant message once with response metadata/citations.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/platform-router.test.ts`
Expected: PASS.

### Task 2: Knowledge Module Interface

**Files:**
- Create: `tests/unit/module-boundaries.test.ts`
- Modify: `apps/api/src/knowledge/knowledge.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing test**

Assert that `KnowledgeModule` exports only `KnowledgeService` and `RetrievalService`, and imports `KnowledgeEnhancementsModule`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/module-boundaries.test.ts`
Expected: FAIL because `KnowledgeModule` currently exports implementation services and `AppModule` owns enhancements directly.

- [ ] **Step 3: Narrow module exports**

Move `KnowledgeEnhancementsModule` into `KnowledgeModule.imports`, remove it from `AppModule`, and reduce `KnowledgeModule.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/module-boundaries.test.ts`
Expected: PASS.

### Task 3: Verification

**Files:**
- Existing test suite only.

- [ ] **Step 1: Run focused unit tests**

Run: `pnpm vitest run tests/unit/platform-router.test.ts tests/unit/module-boundaries.test.ts tests/unit/chat-service-workflow.test.ts`
Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS or report existing unrelated failures with exact evidence.
