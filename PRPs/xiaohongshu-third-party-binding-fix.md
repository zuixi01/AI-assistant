# Xiaohongshu Third-Party Binding Fix

## Background

The attached Xiaohongshu third-party customer service document describes a Juguang binding flow, not a generic OAuth QR flow. The current implementation generates `https://adapi.xiaohongshu.com/oauth2/authorize`, which is not present in the document and can surface as `404 page not found` after scanning.

## Goals

- Generate the documented binding URL: `https://ad.xiaohongshu.com/api/leona/three/im/account/add`.
- Include an encrypted token containing `account_code` and tenant identity so the first bind callback can create the tenant-bound account.
- Accept Xiaohongshu documented POST paths under `/api/open/im/...` while preserving existing internal webhook aliases.
- Show the correct public callback URL in the admin page so messages can reach this platform and trigger AI replies.

## Non-Goals

- Do not redesign the whole Xiaohongshu UI.
- Do not add database migrations unless the existing schema cannot support the flow.
- Do not implement unsupported message types beyond storing/auto-replying to received text content.

## Relevant Files

- `apps/api/src/integrations/xiaohongshu/xiaohongshu.controller.ts`
- `apps/api/src/integrations/xiaohongshu/xiaohongshu.service.ts`
- `apps/api/src/integrations/xiaohongshu/xhs-api.client.ts`
- `apps/web/src/app/admin/settings/xiaohongshu/page.tsx`
- `apps/web/src/lib/i18n/locales/*.ts`
- `tests/unit/xiaohongshu-binding.test.ts`

## Plan

1. Add failing tests for documented binding URL generation, token-based first bind, and documented open/im controller paths.
2. Replace OAuth URL generation with a Juguang binding URL builder.
3. Decrypt nested bind token in `handleBindAccount` and use it to resolve tenant/account code.
4. Add `/open/im/send`, `/open/im/third/bind_account`, `/open/im/third/unbind_account`, and `/open/im/auth/bind_user/event` controller aliases.
5. Update admin page webhook URL from `/webhooks/xiaohongshu/im/send` to `/api/open/im/send`.
6. Run focused unit tests, API typecheck or build, and Web typecheck or build.

## Acceptance Criteria

- The scan QR code points at `https://ad.xiaohongshu.com/api/leona/three/im/account/add?appId=...&token=...`, not `adapi.../oauth2/authorize`.
- A first bind notification with encrypted `content.token` can create/update `XhsAccount` for the correct tenant.
- The documented Xiaohongshu message and bind paths are routable behind the global `/api` prefix.
- The admin page displays `/api/open/im/send` as the callback URL for message aggregation.
