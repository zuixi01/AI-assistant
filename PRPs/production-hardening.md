# Production Hardening PRP

Date: 2026-06-09
Status: draft

## Background

The customer-service workflow is already functionally rich, but the public chat surface is still too trusting, the database is missing a few high-value indexes/constraints, and the current RAG eval only checks fixture shape instead of exercising the real API and seeded data.

This pass hardens the project for production use:

- public chat sessions must be opaque and tokenized
- public message/lead access must stop trusting client-supplied tenant identity
- polling should fetch only new messages instead of reloading the whole conversation
- DTO validation should be enforced at the API boundary
- plan quota checks should actually block over-limit usage
- RAG evaluation should hit the real API with seeded knowledge and admin auth
- sync-heavy tables should gain the indexes/uniques they already imply in code

## Goals

- Add a secure public session token for customer conversations.
- Make public chat, message, and lead endpoints tenant-safe without trusting `tenantId` from the browser.
- Convert the chat page to incremental polling.
- Add DTO validation for the public and admin-facing endpoints touched in this pass.
- Enforce message quota checks before expensive chat writes.
- Replace the shallow RAG eval with a real API-backed check.
- Add the missing database indexes and uniqueness constraints for hot lookup paths.
- Improve ingestion/sync reliability where current code relies on repeated `findFirst` scans.

## Non-Goals

- Do not redesign the already-implemented handoff/review workflow.
- Do not swap the current LLM or embedding providers.
- Do not change the admin UX beyond what is needed for the new validation/flow.
- Do not replace Postgres as the source of truth.

## Current Code Analysis

- `apps/api/src/conversations/conversations.controller.ts`
  - Public `POST /conversations` accepts `tenantId` directly.
  - Public `GET /conversations/:id` exposes a conversation by ID only.

- `apps/api/src/chat/chat.controller.ts`
  - Public chat endpoints resolve `conversationId` and then trust the returned tenant.
  - There is no public session token in the request path.

- `apps/api/src/messages/messages.controller.ts`
  - Public read/write under `conversations/:conversationId/messages` only checks the ID.
  - Admin human replies are already tenant-scoped and JWT-protected.

- `apps/api/src/leads/leads.controller.ts`
  - Public lead creation still trusts `tenantId` from the request body.

- `apps/web/src/app/chat/[tenantSlug]/page.tsx`
  - The page creates a conversation once, but polls the full message list every 3 seconds.
  - It posts `tenantId` and `conversationId` directly when creating a lead.

- `apps/api/src/tenants/tenants.service.ts`
  - Plan limit logic already exists, including `checkLimit(...)`, but the chat path does not appear to enforce it yet.

- `packages/database/prisma/schema.prisma`
  - `Conversation` has no public session token or hot-list indexes.
  - `Message` has no `(conversationId, createdAt)` index.
  - `Lead` has no tenant/status/timestamp index.
  - `Product` and `Order` code paths repeatedly search by external IDs, but the schema does not clearly encode those access patterns as constraints.
  - `KnowledgeSource` also has room for tenant-scoped uniqueness/indexes around its external identifiers.

- `tests/evals/run-rag-eval.ts`
  - Only validates fixture shape and tokenizer output.
  - It does not call the API, log in, or inspect real answers/citations.

- `tests/scripts/seed-test-data.ts` and `packages/database/prisma/seed.ts`
  - Seed data already exists for live retrieval and auth-backed evals.

## Relevant Files

- `apps/api/src/conversations/conversations.controller.ts`
- `apps/api/src/conversations/conversations.service.ts`
- `apps/api/src/chat/chat.controller.ts`
- `apps/api/src/chat/chat.service.ts`
- `apps/api/src/messages/messages.controller.ts`
- `apps/api/src/messages/messages.service.ts`
- `apps/api/src/leads/leads.controller.ts`
- `apps/api/src/leads/leads.service.ts`
- `apps/api/src/tenants/tenants.service.ts`
- `apps/api/src/knowledge/knowledge.controller.ts`
- `apps/api/src/integrations/doudian/doudian.service.ts`
- `apps/web/src/app/chat/[tenantSlug]/page.tsx`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/seed.ts`
- `tests/evals/run-rag-eval.ts`
- `tests/evals/rag_questions.json`
- `tests/unit/chat-service-workflow.test.ts`
- `tests/unit/tenant-isolation.test.ts`

## Implementation Plan

1. Introduce a public conversation/session token.
   - Generate an opaque token at conversation creation.
   - Persist it on `Conversation`.
   - Return it from the public create conversation endpoint.
   - Require it for public chat, message polling, and lead submission.

2. Harden public controllers and DTOs.
   - Replace loose body/query shapes with explicit DTOs.
   - Validate required strings, lengths, pagination, and cursors.
   - Reject mismatched conversation/token pairs early.

3. Make polling incremental.
   - Add cursor/`after` support to public message reads.
   - Update the web chat page to store the token and only request newer messages.
   - Preserve optimistic UI messages without duplication.

4. Enforce quota checks.
   - Check the tenant message limit before persisting expensive chat turns.
   - Fail with a clear API error when a tenant is over quota.

5. Add schema-level indexes and uniqueness.
   - Optimize conversation, message, lead, product, order, and knowledge-source lookups.
   - Encode external-ID and tenant-scoped uniqueness where code already depends on it.

6. Replace the shallow RAG eval.
   - Log in as the seeded admin.
   - Call live knowledge retrieval and live RAG answer endpoints.
   - Verify returned sources/citations and answer status against seeded knowledge.

7. Tighten sync reliability.
   - Prefer indexed lookups and upserts where code already treats IDs as unique.
   - Keep sync failures isolated from the user-facing request path.

## Data Structure / API Changes

- `Conversation`
  - add an opaque public session token field
  - add a unique index on that token
  - add hot-path indexes for tenant/status/time-based listing

- `Message`
  - add a `(conversationId, createdAt)` index for incremental polling

- `Lead`
  - add tenant/status/time-based listing indexes
  - keep tenant-scoped access strict

- `Product`, `Order`, `KnowledgeSource`
  - add the composite indexes/uniques needed by existing sync and lookup paths

- Public APIs
  - `POST /conversations`
  - `GET /conversations/:id`
  - `GET /conversations/:conversationId/messages`
  - `POST /conversations/:conversationId/messages`
  - `POST /chat`
  - `POST /chat/stream`
  - `POST /leads`

  These should all accept a public conversation token and stop trusting a caller-supplied tenant ID.

- RAG eval
  - should use the real HTTP API, real admin auth, and seeded tenant data.

## UI / Interaction Changes

- The web chat page should persist the conversation token per tenant slug.
- Message syncing should request only new messages since the last seen timestamp/cursor.
- Lead submission should use the conversation token instead of sending `tenantId`.
- Quota failures should surface as a readable chat error instead of a silent failure.

## Todo List

- [ ] Add failing tests for token-gated public chat/message/lead access.
- [ ] Add failing tests for incremental message polling.
- [ ] Add failing tests for quota enforcement on chat turns.
- [ ] Add failing tests for live RAG evaluation against seeded data.
- [ ] Add the Prisma schema changes and migration.
- [ ] Implement token-aware conversation/session helpers.
- [ ] Update public controllers, services, and DTOs.
- [ ] Update the web chat page to store token + poll incrementally.
- [ ] Replace the shallow RAG eval with live API checks.
- [ ] Run lint, typecheck, unit, integration, RAG eval, and build.

## Testing and Verification

- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:rag`
- `pnpm build`

Targeted checks should also cover:

- public conversation create returns a token
- public message polling rejects missing/wrong tokens
- lead creation rejects mismatched tokens
- quota violations fail before expensive chat work
- live RAG eval can authenticate and read seeded knowledge

## Risks

- A public token introduced in the wrong place could leak through logs or URLs.
- A migration that adds unique constraints may require data cleanup first.
- Incremental polling can duplicate or skip messages if cursor semantics are too loose.
- Quota enforcement can become noisy if it is checked too early or against the wrong resource counter.
- Live RAG evals are only useful if the seed data and local API boot order are stable.

## Acceptance Criteria

- Public chat cannot be driven with only a `conversationId`.
- Public message polling and lead submission require the correct session token.
- The web chat page reuses the session token and no longer reloads the full message history on every poll.
- Over-quota tenants are blocked with a deterministic API error.
- The database has the new indexes/uniques that match the hot lookup paths.
- The RAG eval uses live API responses and fails if the seeded knowledge is missing or wrong.
- Existing customer-service workflow behavior still passes.

## Completion Summary Requirements

When this PRP is done, report:

- modified files
- database migration details
- public session-token behavior
- incremental polling behavior
- quota enforcement behavior
- live RAG eval behavior
- verification commands run and their results
- residual production risks
