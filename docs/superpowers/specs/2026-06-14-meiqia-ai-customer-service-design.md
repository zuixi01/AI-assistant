# Meiqia-Style AI Customer Service Design

## Product Shape

The assistant should feel like a full customer-service desk: the customer gets immediate 7x24 AI replies, clear fallback when knowledge is missing, and an easy path to human service; the operator gets a queue with status, intent, confidence, citations, and manual reply actions. The system should keep learning through unknown questions and knowledge conversion rather than silently failing.

## Recommended Approach

Use the existing stack and tighten the workflow contracts:

- Chat runtime remains centered on `ChatService`.
- Retrieval remains centered on `RetrievalService`.
- Tenant model settings remain stored in `Tenant.config.modelConfig`.
- Admin operations stay in the existing conversations/workspace controllers.
- Frontend keeps the current premium workbench UI primitives.

This is safer than adding a new orchestration layer right now because the current code already has most product states and tests. The optimization should remove gaps, not add parallel paths.

## Customer Flow

1. A customer opens public chat or messages through an integrated channel.
2. The system validates conversation token/session and quota.
3. The AI rewrites the query with tenant LLM settings.
4. Retrieval runs hybrid search using tenant embedding settings.
5. The assistant chooses one of three tracks:
   - Answer from knowledge/product context.
   - Friendly dialogue for greetings or casual turns.
   - Human handoff for high-risk, after-sale, refund, complaint, or explicit transfer intent.
6. The assistant persists metadata: intent, score, confidence, answer status, conversation status, rewritten query, citations, and product recommendations.
7. Admin workbench displays the queue and enables manual reply/status handling.

## Operator Flow

Operators should see:

- Open conversations.
- Pending human handoff.
- Needs-review knowledge misses.
- Closed conversations.
- Message bubbles with AI/human distinction.
- Citations and source snippets.
- Intent and confidence.
- Manual reply composer.

## Error Handling

- Missing public conversation tokens reject before reading messages.
- Quota exhaustion rejects before writing chat messages.
- Retrieval failures degrade to no-answer handling and unknown-question capture.
- Model config falls back to environment/default provider config through `ModelConfigService`.
- Workspace write actions must verify tenant ownership before mutation.

## Testing

Focused tests should prove:

- Tenant LLM config is used for query rewrite and answer generation.
- Tenant embedding config is used for retrieval.
- Platform router stores exactly one user message and one adapted assistant message per inbound turn.
- Workspace assign/unassign/status mutations are tenant-scoped.
- Existing human handoff and low-confidence behavior remains intact.

## Approval Basis

The user explicitly asked the agent to generate the plan and start implementation without waiting, so this design is treated as approved for this pass.
