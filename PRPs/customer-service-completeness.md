# Customer Service Completeness PRP

Status: implemented

## Goal

Make the current AI customer service workflow operationally complete for a tenant:

- Business questions are answered through RAG with citations and retrieval logs.
- Low-confidence knowledge misses become a review queue, not silent failures.
- Human-service / after-sales intents become a visible handoff queue.
- Admin operators can filter, inspect, reply to, resolve, and close these conversations.
- Users can receive persisted human-agent replies during an active chat session.
- Unknown-question resolution remains tenant-scoped and can be converted to FAQ.

## Current Findings

- `ChatService` already saves messages, retrieves/reranks knowledge, writes retrieval logs, and records unknown questions.
- High-risk intents currently return transfer copy, but do not update `Conversation.status`.
- Low-confidence greetings/dialogue can be recorded as unknown questions because unknown recording happens before dialogue/knowledge branching.
- High-risk intents inside a low-confidence retrieval path are not forced to human handoff.
- Retrieval logs store the original retrieval status even when final answer status is changed to `transferred_to_human`.
- `UnknownQuestionsService.resolve()` updates by `id` only and lacks tenant-scoped lookup.
- Admin conversations UI only understands `open` and `closed`, so handoff/review queues are hidden inside the generic list.

## Implementation Plan

1. Add conversation workflow statuses in service code:
   - `open`
   - `pending_human`
   - `needs_review`
   - `closed`
2. Extend `ConversationsService` with scoped status helpers:
   - `markNeedsHuman(tenantId, id)`
   - `markNeedsReview(tenantId, id)`
   - validated `updateStatus()`
3. Update `ChatService` turn handling:
   - classify dialogue vs knowledge before unknown-question recording
   - force high-risk intents to `transferred_to_human` and `pending_human`
   - record unknown questions only for knowledge-track misses
   - mark knowledge misses as `needs_review`
   - save retrieval logs with the final answer status
   - include final conversation workflow status in response/metadata
4. Tenant-scope unknown-question resolution.
5. Update admin conversation pages:
   - add filters for `pending_human` and `needs_review`
   - display status labels/colors consistently
   - add detail actions for close/reopen/mark human/mark review
   - add tenant-scoped human reply composer
6. Add focused tests:
   - conversation workflow helpers
   - chat high-risk handoff
   - chat low-confidence knowledge review
   - chat low-confidence dialogue does not create unknown question
   - unknown-question resolve is tenant-scoped
   - admin conversation message creation is tenant-scoped
7. Verify:
   - `pnpm test:unit`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test:rag`

## Acceptance Criteria

- Asking for human service or after-sales marks the conversation `pending_human`.
- A real knowledge miss marks the conversation `needs_review` and records a tenant-scoped unknown question.
- A casual greeting or short dialogue does not pollute unknown-question analytics.
- Admin can filter and act on `pending_human` and `needs_review` conversations.
- Admin can send a human reply from conversation detail through a tenant-scoped endpoint.
- The user chat page polls persisted messages so human replies can appear in-session.
- Unknown-question resolution cannot update another tenant's unresolved question.
- Existing RAG/vector optimization tests still pass.

## Verification

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm lint`
- `pnpm test:integration`
- `pnpm test:rag`
- `pnpm build`
- `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3100/admin/conversations` => `200`
- `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3100/admin/conversations/test-id` => `200`
- `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3100/chat/demo` => `200`
