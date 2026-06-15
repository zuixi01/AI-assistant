# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-15T03:43:33.295Z
> Files: 209 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitignore` — Git ignore rules (~96 tok)
- `CLAUDE.md` — OpenWolf (~57 tok)
- `docker-compose.test.yml` — Docker Compose test infra for Postgres, Redis, Python sidecar (~276 tok)
- `docker-compose.yml` — Docker Compose services (~251 tok)
- `ecosystem.config.cjs` — PM2 process manager config for API/Web autorestart and memory restart thresholds (~195 tok)
- `findings.md` — 当前优化结论、决策与研究发现 (~462 tok)
- `package.json` — Node.js package manifest (~402 tok)
- `pnpm-lock.yaml` — pnpm lock file (~67449 tok)
- `pnpm-workspace.yaml` (~12 tok)
- `progress.md` — 本轮任务的阶段日志与验证记录 (~522 tok)
- `task_plan.md` — P0/P1/P2 优化开发任务清单与执行顺序 (~2525 tok)
- `turbo.json` — Turborepo configuration (~92 tok)

## .claude/

- `settings.json` (~485 tok)
- `settings.local.json` (~22 tok)

## .claude/commands/

- `test-mvp.md` — Test MVP (~55 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## C:/Users/29408/.claude/plans/

- `agile-dazzling-panda.md` — 小红书配置问题分析与修复计划 (~2437 tok)
- `cheeky-stirring-avalanche.md` — 小红书三方客服私信集成计划 (~1461 tok)
- `https-api-docs-deepseek-com-zh-cn-api-de-dazzling-raven.md` — 接入 DeepSeek 模型 + 知识库向量检索 (~543 tok)
- `https-github-com-cs-lazy-tools-chatgpt-o-stateful-treasure.md` — 多平台智能客服集成计划 (~1370 tok)
- `jaunty-noodling-harbor.md` — Plan: Simplify Admin Sidebar Navigation (~1146 tok)
- `keen-shimmying-panda.md` — AI 智能客服助手 — 项目架构设计与运行逻辑 (~2663 tok)

## PRPs/


## apps/api/

- `nest-cli.json` (~49 tok)
- `package.json` — Node.js package manifest (~362 tok)
- `tsconfig.json` — TypeScript configuration (~188 tok)

## apps/api/src/

- `app.module.ts` — Exports AppModule (~889 tok)
- `health.controller.ts` — Exports HealthController (~86 tok)
- `main.ts` — Prisma returns BigInt for @db fields; JSON.stringify cannot serialize BigInt natively (~354 tok)

## apps/api/src/admins/

- `admins.controller.ts` — Exports AdminsController (~242 tok)
- `admins.module.ts` — Exports AdminsModule (~81 tok)
- `admins.service.ts` — Prisma data access layer (~207 tok)

## apps/api/src/after-sales/

- `after-sales.controller.ts` — Exports AfterSalesController (~244 tok)
- `after-sales.module.ts` — Exports AfterSalesModule (~91 tok)
- `after-sales.service.ts` — Prisma data access layer (~226 tok)

## apps/api/src/ai/

- `ai-orchestrator.service.ts` — Exports ChatRequest, ChatResponse, AiOrchestratorService (~1009 tok)
- `ai.controller.ts` — AI controller moved to chat module (~25 tok)
- `ai.module.ts` — Exports AiModule (~173 tok)

## apps/api/src/ai/embedding/

- `embedding-provider.factory.ts` — API routes: GET (5 endpoints) (~488 tok)
- `embedding-provider.interface.ts` — Exports EmbeddingResult, EmbeddingProvider (~82 tok)
- `embedding.service.ts` — Exports EmbeddingService (~202 tok)

## apps/api/src/ai/embedding/providers/

- `deepseek.embedding.ts` — Exports DeepSeekEmbeddingProvider (~398 tok)
- `mock.embedding.ts` — Exports MockEmbeddingProvider (~324 tok)
- `openai.embedding.ts` — Exports OpenAiEmbeddingProvider (~386 tok)

## apps/api/src/ai/llm/

- `llm-provider.factory.ts` — API routes: GET (5 endpoints) (~560 tok)
- `llm-provider.interface.ts` — Exports ChatMessage, ChatOptions, StreamChunk, ChatResult, LlmProvider (~209 tok)
- `llm.service.ts` — Exports LlmService (~224 tok)

## apps/api/src/ai/llm/providers/

- `mock-llm.provider.ts` — Exports MockLlmProvider (~2253 tok)
- `openai.provider.ts` — Exports OpenAiLlmProvider (~881 tok)

## apps/api/src/ai/model-config/

- `model-config.service.ts` — Exports ProviderConfig, ModelConfig, ModelConfigService (~1243 tok)

## apps/api/src/ai/prompts/

- `prompts.service.ts` — Intent classification prompt (section 15.1 of the doc) (~1346 tok)

## apps/api/src/analytics/

- `analytics.controller.ts` — Exports AnalyticsController (~592 tok)
- `analytics.module.ts` — Exports AnalyticsModule (~88 tok)
- `analytics.service.ts` — Exports AnalyticsService (~2066 tok)

## apps/api/src/auth/

- `auth.controller.ts` — Exports AuthController (~251 tok)
- `auth.module.ts` — Exports AuthModule (~243 tok)
- `auth.service.ts` — Exports AuthService (~648 tok)
- `jwt-auth.guard.ts` — Exports JwtAuthGuard (~46 tok)
- `jwt.strategy.ts` — Exports JwtStrategy (~234 tok)

## apps/api/src/auth/dto/

- `login.dto.ts` — Exports LoginDto (~89 tok)

## apps/api/src/chat/

- `chat-turn-audit.service.ts` — Retrieval log / unknown-question / assistant persistence helpers (~1928 tok)
- `chat-turn-context.service.ts` — Turn preparation, quota check, rewrite, retrieval, prompt assembly (~3539 tok)
- `chat.controller.ts` — Exports ChatController (~490 tok)
- `chat.module.ts` — Wires ChatService plus context/audit subservices (~197 tok)
- `chat.service.ts` — Main chat orchestrator after Sprint 1 split (~3216 tok)
- `chat.types.ts` — Shared chat request/response/turn types (~408 tok)

## apps/api/src/chat/dto/


## apps/api/src/common/prisma/

- `prisma.module.ts` — Exports PrismaModule (~60 tok)
- `prisma.service.ts` — Exports PrismaService (~102 tok)

## apps/api/src/conversations/

- `conversations.controller.ts` — Exports ConversationsController, AdminConversationsController. Admin list supports ?status filter (~530 tok)
- `conversations.module.ts` — Exports ConversationsModule (~163 tok)
- `conversations.service.ts` — Exports ConversationsService. findByTenant supports {status} filter param (~510 tok)

## apps/api/src/conversations/dto/


## apps/api/src/coupons/

- `coupons.controller.ts` — Exports CouponsController (~376 tok)
- `coupons.module.ts` — Exports CouponsModule (~109 tok)
- `coupons.service.ts` — Get available coupons for a tenant (~802 tok)

## apps/api/src/integrations/

- `integrations.controller.ts` — Exports IntegrationsController (~124 tok)
- `integrations.module.ts` — Exports IntegrationsModule (~155 tok)

## apps/api/src/integrations/doudian/


## apps/api/src/integrations/juguang/

- `juguang.service.ts` — Exports JuguangService (~2024 tok)

## apps/api/src/integrations/miniapp/

- `miniapp.controller.ts` — Exports MiniappController (~206 tok)
- `miniapp.module.ts` — Exports MiniappModule (~107 tok)
- `miniapp.service.ts` — API routes: GET (4 endpoints) (~908 tok)

## apps/api/src/integrations/xiaohongshu/

- `setup.controller.ts` — Exports SetupController (~506 tok)
- `setup.service.ts` — Exports SetupStatus, SetupService (~2012 tok)
- `xhs-api.client.ts` — Generate OAuth authorization URL for QR code scanning. (~1568 tok)
- `xhs-crypto.ts` — Exports XhsCrypto (~434 tok)
- `xhs-webhook.guard.ts` — Verifies XHS webhook signature. (~462 tok)
- `xiaohongshu.controller.ts` — ─── Webhook Endpoints (no JWT — called by XHS servers) ───────── (~1308 tok)
- `xiaohongshu.module.ts` — Exports XiaohongshuModule (~287 tok)
- `xiaohongshu.service.ts` — Generate OAuth authorization URL. (~3920 tok)

## apps/api/src/knowledge/

- `knowledge.controller.ts` — 必须放在 @Get(':id') 之前 (~2110 tok)
- `knowledge.module.ts` — Exports KnowledgeModule (~404 tok)
- `knowledge.service.ts` — Upload and parse a file with multimodal extraction (~3916 tok)

## apps/api/src/knowledge/chunkers/

- `chunker.factory.ts` — Exports ChunkerFactory (~284 tok)
- `chunker.interface.ts` — Exports Chunk, TextChunker, ChunkOptions (~107 tok)
- `fixed-size.chunker.ts` — Exports FixedSizeChunker (~198 tok)
- `qa-pair.chunker.ts` — Exports QAPairChunker (~282 tok)
- `recursive.chunker.ts` — Exports RecursiveChunker (~485 tok)

## apps/api/src/knowledge/dto/

- `knowledge-upload.dto.ts` — multipart 中与 file 同行的表单字段（class-validator + 全局 ValidationPipe） (~218 tok)

## apps/api/src/knowledge/parsers/

- `csv.parser.ts` — Exports CsvParser (~313 tok)
- `docx.parser.ts` — Exports DocxParser (~513 tok)
- `image.parser.ts` — Supported image MIME types (~530 tok)
- `markdown.parser.ts` — Exports MarkdownParser (~228 tok)
- `parser.factory.ts` — Exports ParserFactory (~444 tok)
- `parser.interface.ts` — A section of multimodal content extracted from a document (~417 tok)
- `pdf.parser.ts` — Exports PdfParser (~992 tok)
- `pptx.parser.ts` — Exports PptxParser (~925 tok)
- `txt.parser.ts` — Exports TxtParser (~80 tok)
- `xlsx.parser.ts` — Exports XlsxParser (~432 tok)

## apps/api/src/knowledge/pipeline/

- `pipeline.service.ts` — Chunk multimodal content sections, preserving type metadata. (~3040 tok)

## apps/api/src/knowledge/retrieval/

- `retrieval.service.ts` — Enhanced retrieval with rerank and confidence scoring. (~3902 tok)

## apps/api/src/knowledge/services/

- `customer-service-rag.service.ts` — Answer a customer question using RAG-enhanced retrieval. (~1576 tok)
- `document-parser.service.ts` — Max retry attempts on failure (~2432 tok)
- `knowledge-graph.service.ts` — Extract entities from document content using NLP heuristics. (~1320 tok)
- `python-sidecar.client.ts` — Client for the Python RAG-Anything sidecar service. (~1342 tok)
- `vector-store.service.ts` — Generate embedding vector from text. (~1639 tok)

## apps/api/src/knowledge/utils/

- `text-cleaner.ts` — Text cleaning utility for knowledge base content. (~700 tok)

## apps/api/src/leads/

- `leads.controller.ts` — Exports LeadsController, AdminLeadsController (~1205 tok)
- `leads.module.ts` — Exports LeadsModule (~92 tok)
- `leads.service.ts` — Exports LeadsService (~1816 tok)

## apps/api/src/leads/dto/


## apps/api/src/messages/


## apps/api/src/messages/dto/


## apps/api/src/notifications/

- `notifications.controller.ts` — Exports NotificationsController (~208 tok)
- `notifications.module.ts` — Exports NotificationsModule (~97 tok)
- `notifications.service.ts` — API routes: GET (3 endpoints) (~793 tok)

## apps/api/src/orders/


## apps/api/src/platform/

- `message-adapter.service.ts` — Exports MessageAdapterService (~1290 tok)
- `platform-monitor.service.ts` — Exports PlatformStatus, PlatformDashboard, PlatformMonitorService (~1010 tok)
- `platform-router.service.ts` — Exports PlatformMessage, PlatformReplyResult, ReplySender, PlatformRouterService (~1728 tok)
- `platform.module.ts` — Exports PlatformModule (~231 tok)

## apps/api/src/products/


## apps/api/src/tenants/

- `tenants.controller.ts` — Exports TenantsController (~638 tok)
- `tenants.module.ts` — Exports TenantsModule (~84 tok)
- `tenants.service.ts` — Prisma data access layer (~1058 tok)

## apps/api/src/unknown-questions/

- `unknown-questions.controller.ts` — Exports UnknownQuestionsController (~320 tok)
- `unknown-questions.module.ts` — Exports UnknownQuestionsModule (~105 tok)
- `unknown-questions.service.ts` — Prisma data access layer (~422 tok)

## apps/api/src/users/

- `users.controller.ts` — Exports UsersController (~281 tok)
- `users.module.ts` — Exports UsersModule (~79 tok)
- `users.service.ts` — Prisma data access layer (~375 tok)

## apps/api/src/webhooks/

- `webhooks.controller.ts` — Exports WebhooksController (~157 tok)
- `webhooks.module.ts` — Exports WebhooksModule (~86 tok)
- `webhooks.service.ts` — API routes: GET (1 endpoints) (~794 tok)

## apps/embed-widget/

- `index.html` — AI 智能客服 - 嵌入式聊天组件 (~2739 tok)
- `package.json` — Node.js package manifest (~125 tok)
- `tsconfig.json` — TypeScript configuration (~116 tok)
- `vite.config.ts` (~152 tok)

## apps/embed-widget/src/

- `ChatWidget.tsx` — Embed widget now uses shared public chat client with token + polling (~2902 tok)
- `index.tsx` — initAIChatWidget (~194 tok)
- `main.tsx` — Demo (~147 tok)

## apps/web/

- `next-env.d.ts` — / <reference types="next" /> (~77 tok)
- `next.config.ts` — Next.js configuration (~87 tok)
- `package.json` — Node.js package manifest (~316 tok)
- `postcss.config.js` — PostCSS configuration (~24 tok)
- `tailwind.config.ts` — Tailwind CSS configuration (~426 tok)
- `tsconfig.json` — TypeScript configuration (~162 tok)
- `tsconfig.tsbuildinfo` (~35626 tok)

## apps/web/src/app/


## apps/web/src/app/admin/

- `layout.tsx` — AdminLayout (~1488 tok)

## apps/web/src/app/admin/analytics/

- `page.tsx` — AnalyticsPage — renders table (~2704 tok)

## apps/web/src/app/admin/conversations/

- `page.tsx` — ConversationsPage (~4239 tok)

## apps/web/src/app/admin/conversations/[id]/

- `page.tsx` — ConversationDetailPage (~6045 tok)

## apps/web/src/app/admin/dashboard/

- `page.tsx` — DashboardPage (~2918 tok)

## apps/web/src/app/admin/knowledge/

- `page.tsx` — apiErrorMessage — renders table (~4224 tok)

## apps/web/src/app/admin/knowledge/[id]/chunks/


## apps/web/src/app/admin/knowledge/enhancements/

- `page.tsx` — KnowledgeEnhancementsPage (~1822 tok)

## apps/web/src/app/admin/knowledge/test-retrieval/


## apps/web/src/app/admin/leads/

- `page.tsx` — LeadsPage — renders table (~3357 tok)

## apps/web/src/app/admin/leads/[id]/

- `page.tsx` — LeadDetailPage — renders table (~1854 tok)

## apps/web/src/app/admin/login/


## apps/web/src/app/admin/model-config/

- `page.tsx` — PRESETS (~2395 tok)

## apps/web/src/app/admin/orders/


## apps/web/src/app/admin/products/


## apps/web/src/app/admin/quick-reply/

- `page.tsx` — QuickReplyPage — renders table (~3009 tok)

## apps/web/src/app/admin/settings/

- `page.tsx` — PRESETS (~14531 tok)

## apps/web/src/app/admin/settings/juguang/

- `page.tsx` — JuguangSettingsPage (~2235 tok)

## apps/web/src/app/admin/settings/xiaohongshu/

- `page.tsx` — TABS (~5956 tok)

## apps/web/src/app/admin/settings/xiaohongshu/setup/

- `page.tsx` — XiaohongshuSetupPage (~5265 tok)

## apps/web/src/app/admin/unknown-questions/


## apps/web/src/app/admin/workspace/

- `page.tsx` — WorkspacePage (~3792 tok)

## apps/web/src/app/chat/[tenantSlug]/

- `page.tsx` — Public chat page now uses shared public chat client (~5902 tok)

## apps/web/src/components/


## apps/web/src/components/ui/


## apps/web/src/lib/


## apps/web/src/lib/i18n/


## apps/web/src/lib/i18n/locales/

- `en.ts` — Declares en (~4542 tok)
- `fr.ts` — Declares fr (~4945 tok)
- `ja.ts` — Declares ja (~3646 tok)
- `zh.ts` — Declares zh (~3370 tok)

## docs/superpowers/plans/


## docs/superpowers/specs/


## harness/mock-server/


## packages/database/

- `package.json` — Node.js package manifest (~161 tok)

## packages/database/prisma/

- `schema.prisma` — Declares String (~6012 tok)
- `seed.ts` — prisma: sha256, main (~2608 tok)

## packages/database/prisma/migrations/

- `migration_lock.toml` — Please do not edit this file manually (~37 tok)

## packages/database/prisma/migrations/20260506084333_init/

- `migration.sql` — CreateExtension (~2932 tok)

## packages/database/prisma/migrations/20260608221500_turbovec_vector_acceleration/


## packages/database/prisma/migrations/20260609023000_production_hardening/


## packages/database/prisma/migrations/20260615003000_platform_conversation_keys/

- `migration.sql` — Add platform conversation identifiers and lookup index (~98 tok)
- `package.json` — Node.js package manifest (~70 tok)
- `tsconfig.json` — TypeScript configuration (~73 tok)

## packages/shared/src/

- `index.ts` — Shared package barrel exports (~616 tok)
- `public-chat-client.ts` — Shared public chat session/token/polling client utilities (~1665 tok)

## scripts/

- `ensure-db-migrations.ts` — Root startup guard that runs `prisma migrate deploy` in `packages/database` before API startup (~238 tok)
- `monitor-runtime.ps1` — Long-run runtime sampler for API health, ports, processes, CPU/memory, and disk I/O (~760 tok)
- `wait-for-runtime-deps.ts` — Startup dependency waiter for Postgres and Redis before API boot/migrations (~615 tok)

## services/python-sidecar/

- `main.py` — API: 7 endpoints (~2375 tok)
- `raganything_service.py` — class: multimodal_available, graph_available, parse_document, generate_image_description + 2 more (~3004 tok)
- `requirements.txt` — Python dependencies (~204 tok)

## tests/e2e/

- `admin-web-auth-contract.test.ts` — Admin pages must not persist tokens or send Authorization headers (~182 tok)

## tests/evals/

- `hallucination_cases.json` (~645 tok)
- `rag_questions.json` (~1066 tok)
- `run-ai-safety-eval.ts` — Validates AI safety fixtures for forbidden claims (~246 tok)
- `run-rag-eval.ts` — Live-or-fixture RAG evaluation against admin knowledge routes (~2489 tok)

## tests/fixtures/

- `admin-users.demo.json` (~200 tok)
- `conversations.demo.json` (~1586 tok)
- `knowledge.ecommerce.md` — 鲜果优选 — 电商客服知识库 (~379 tok)
- `knowledge.school.md` — 启航编程培训中心 — 客服知识库 (~347 tok)
- `leads.demo.json` (~723 tok)
- `products.durian.json` (~751 tok)
- `quick-replies.demo.json` (~599 tok)
- `tenants.demo.json` (~254 tok)
- `unknown-questions.demo.json` (~603 tok)
- `users.demo.json` (~436 tok)

## tests/integration/


## tests/integration/api/


## tests/scripts/

- `check-sidecar-live.ts` — Live smoke for sidecar health and parse, with unavailable/business-failure split (~538 tok)
- `push-test-schema.ts` — Pushes Prisma schema to the test database with default test env (~214 tok)
- `reset-test-db.ts` — Truncates all public tables in the local test database (~507 tok)
- `seed-test-data.ts` — Seeds demo fixtures into test DB; maps legacy fixture ids to stable UUIDs (~2380 tok)
- `send-mock-webhooks.ts` — Mock webhook smoke script (~217 tok)
- `test-doudian-mock.ts` — Doudian mock webhook smoke script (~205 tok)
- `test-env.ts` — Shared default env values for test DB, Redis, sidecar URL, and sidecar token (~261 tok)
- `test-infra.ts` — Docker Compose test infra up/down/restart plus readiness waits (~1162 tok)
- `test-miniapp-mock.ts` — Miniapp mock webhook smoke script (~206 tok)
- `validate-release.ts` — One-command release validation orchestrator with infra lifecycle (~534 tok)

## tests/unit/

- `sidecar-auth.test.ts` — Verifies sidecar shared token headers for vector and health requests (~450 tok)
