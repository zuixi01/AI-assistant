# Meiqia Conversation Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin conversation records experience into a Meiqia-style split-column customer-service workbench.

**Architecture:** Preserve the existing Next.js routes, API calls, state handlers, and admin layout. Update only the conversation list/detail presentation and shared workbench CSS so the existing data flow continues to work.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS utility classes, lucide-react icons, existing `apps/web/src/components/ui/design-system.tsx` primitives.

---

### Task 1: List View Split Workspace

**Files:**
- Modify: `apps/web/src/app/admin/conversations/page.tsx`

- [ ] Replace the broad stats/table layout with a compact two-column workbench: status/category rail and scrollable conversation list.
- [ ] Keep `apiGet('/api/admin/conversations')`, workspace stats, status/channel/search filters, and CSV/JSON export behavior intact.
- [ ] Use screenshot-like density: pale shell, white rounded panels, compact rows, avatar dots, channel/status metadata, and fixed-height scrolling.
- [ ] Verify the page still routes to `/admin/conversations/[id]` on row click.

### Task 2: Detail View Four-Part Workbench

**Files:**
- Modify: `apps/web/src/app/admin/conversations/[id]/page.tsx`

- [ ] Keep existing detail fetch, conversation list fetch, status actions, assignment actions, and human reply submit handlers.
- [ ] Render a split workspace: left conversation list, central chat transcript, right customer profile panel.
- [ ] Match the reference composition: top customer header, toolbar actions, centered system timeline chips, right-aligned customer bubbles, left-aligned assistant/system bubbles, sticky composer.
- [ ] Keep citations, summary, intent, lead, status, assigned-to, and conversation ID visible in the right panel.

### Task 3: Shared Workbench Styling

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] Tune `.workbench-*` classes for smaller radii, crisp dividers, screenshot-like lavender background, compact rows, avatar/status marks, message bubbles, scroll bounds, and responsive behavior.
- [ ] Avoid adding new dependencies or generated image assets.

### Task 4: Verification

**Commands:**
- `pnpm.cmd --filter @ai-assistant/web lint`
- `pnpm.cmd --filter @ai-assistant/web build`
- `openwolf designqc --url http://localhost:3100 --routes /admin/conversations`

- [ ] Run the most relevant checks available in this workspace.
- [ ] If protected admin visual capture hits login, document that and use build/lint plus available browser evidence.
- [ ] Save `design-qa.md` with source image, implementation target, viewport, findings, and final result.
