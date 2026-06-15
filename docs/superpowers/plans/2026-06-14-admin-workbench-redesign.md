# Admin Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout the admin customer-service web UI into a reference-image-style workbench while preserving existing conversation, status, reply, assignment, export, and customer-info behavior.

**Architecture:** Keep the existing Next.js app, API helpers, auth layout, and i18n keys. Add focused workbench CSS utilities in `globals.css`, update the admin shell in `layout.tsx`, convert `/admin/conversations` from a table to an inbox layout, and convert `/admin/conversations/[id]` into a chat workspace with a right-side customer panel.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, lucide-react, existing `@/lib/api` and `@/components/ui/design-system` primitives.

---

### Task 1: Workbench Shell Styling

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/admin/layout.tsx`

- [x] Add CSS utilities for a soft customer-service workbench: pale lavender page background, white rounded panels, compact sidebar items, fixed-height workbench regions, conversation list rows, chat header, composer, and right customer panel.
- [x] Update the admin sidebar copy and layout to feel closer to the provided reference while preserving all existing navigation links and logout behavior.

### Task 2: Conversation Inbox Page

**Files:**
- Modify: `apps/web/src/app/admin/conversations/page.tsx`

- [x] Preserve the current `/api/admin/conversations?page=1&pageSize=50&status=...` fetch and detail navigation.
- [x] Replace the wide table with a two-column inbox: status buckets on the left and conversation rows on the right.
- [x] Preserve visible fields: user/lead name, phone, channel, intent, score, message count, status, created time, and view-detail action.

### Task 3: Conversation Detail Workbench

**Files:**
- Modify: `apps/web/src/app/admin/conversations/[id]/page.tsx`

- [x] Preserve existing data fetches, status mutations, human reply sending, and reopen/close behavior.
- [x] Re-layout into reference-style columns: conversation header, central scrollable chat, bottom composer, and right customer/info panel.
- [x] Keep message identities, timestamps, citations, lead info, intent score, channel, and status controls visible.

### Task 4: Verification

**Commands:**
- Run `pnpm --filter @ai-assistant/web build` or the workspace-compatible equivalent.
- If a dev server is available, capture or inspect `/admin/conversations` and a detail route with the existing app tooling.

**Acceptance Criteria:**
- Admin navigation still exposes all current sections.
- Conversation list supports the same status filtering and detail navigation.
- Detail page supports status changes and human replies with the same API endpoints.
- Layout resembles the reference image: left navigation, inbox/list, chat panel, customer information panel, rounded white surfaces over a soft tinted background.
