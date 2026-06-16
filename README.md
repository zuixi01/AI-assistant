# AI-assistant

多租户 AI 电商/教育客服助手 —— 支持知识库 RAG、人机协作、多渠道接入与后台工作台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 目录

- [项目定位](#项目定位)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [本地启动](#本地启动)
- [环境变量](#环境变量)
- [Docker 启动](#docker-启动)
- [RAG 流程](#rag-流程)
- [测试命令](#测试命令)
- [部署说明](#部署说明)
- [后续路线图](#后续路线图)
- [常见问题](#常见问题)

---

## 项目定位

**AI-assistant**（包名 `ai-commerce-assistant`）是一套面向**电商零售、教育培训**等场景的自研 AI 客服系统，目标能力对标美洽（Meiqia）类产品：

| 能力维度 | 说明 |
|---------|------|
| 7×24 自动应答 | 基于租户知识库的 RAG 问答，支持意图识别与查询改写 |
| 人机协作 | 低置信度转人工、未知问题收集、会话状态流转（open / pending_human / needs_review / closed） |
| 多渠道接入 | H5 公聊、嵌入 Widget、小红书、抖店、小程序、聚光等 |
| 多租户 SaaS | 租户隔离、套餐配额、按租户配置 LLM / Embedding |
| 运营工作台 | 会话管理、线索、分析看板、知识库、模型配置、快捷回复 |

**适用场景：**

- 垂直电商/品牌自营客服（商品咨询、售后、发货）
- 教培机构课程顾问（试听、班型、退费规则）
- 需要**自研可控 RAG + 平台定制集成**的团队

**当前成熟度：** MVP+ —— 核心链路已跑通，适合内测与二次开发；生产上线需补齐 CI/CD、监控与运维文档。

---

## 核心功能

### AI 对话与 RAG

- 公聊页面 `/chat/[tenantSlug]` 与 **Embed Widget** 共享会话协议（`packages/shared`）
- 会话 token 哈希存储，公聊 API 需携带 `x-conversation-token`
- 意图识别 → 查询改写 → 混合检索（语义 + 关键词）→ LLM 生成 → 引用与置信度
- 租户级模型配置（LLM / Embedding），支持 OpenAI 兼容接口与 Mock 模式
- 向量维度不匹配时自动降级为关键词检索

### 知识库

- 支持 PDF、DOCX、XLSX、PPTX、Markdown、CSV、TXT、图片等格式
- 多种分块策略（固定大小、递归、QA 对等）
- BullMQ 异步索引队列，避免上传阻塞
- 检索测试页、分块预览、知识增强管理

### 客服工作台

- 会话列表与分屏详情（指派、状态变更、人工回复）
- 未知问题池、线索管理、快捷回复
- 数据分析看板（趋势、意图分布、平台对比、AI 准确率）
- 后台 httpOnly Cookie 鉴权（`admin_token`）

### 平台集成

| 平台 | 能力 |
|------|------|
| 小红书 | Webhook 解密、聚光账号绑定、AI 自动回复 |
| 抖店 | 商品同步 → 知识库联动 |
| 聚光 (Juguang) | 账号管理与消息路由 |
| 小程序 | 微信/抖音小程序消息接入 |
| ChatGPT-on-CS | 可选多平台消息桥接 Sidecar |

### 安全与隔离

- 多租户数据隔离（tenant-scoped 查询与写入）
- 公聊 token 门控、消息配额校验
- Python Sidecar 共享令牌鉴权（`SIDECAR_SHARED_TOKEN`）
- JWT 管理端鉴权 + CORS 限制

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端层                                 │
│  Next.js 15 管理台 (:3100)  │  公聊页  │  Embed Widget (:5190)   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ /api/* 代理 → :4000
┌─────────────────────────────▼───────────────────────────────────┐
│                    NestJS API (:4000)                            │
│  Auth │ Chat │ Knowledge │ Platform │ Integrations │ Analytics  │
│  BullMQ Workers (knowledge-index)                                │
└──────┬──────────────┬─────────────────┬─────────────────────────┘
       │              │                 │
       ▼              ▼                 ▼
┌────────────┐ ┌────────────┐  ┌──────────────────┐
│ PostgreSQL │ │   Redis    │  │ Python Sidecar   │
│ + pgvector │ │  BullMQ    │  │ RAG / turbovec   │
│   :5433    │ │   :6380    │  │     :8001        │
└────────────┘ └────────────┘  └──────────────────┘
       │
       ▼
┌────────────┐
│   MinIO    │  对象存储 (:9002)
└────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| Monorepo | pnpm 8 + Turborepo |
| 后端 | NestJS 11、Prisma 6、BullMQ、Passport JWT |
| 前端 | Next.js 15、React 19、Tailwind CSS、Radix UI |
| 数据库 | PostgreSQL 16 + pgvector |
| 缓存/队列 | Redis 7 |
| 向量检索 | pgvector（主）+ turbovec Sidecar（可选加速） |
| 嵌入组件 | Vite + React（UMD/ES 双格式） |
| 进程管理 | PM2（`ecosystem.config.cjs`） |
| 测试 | Vitest 3、Playwright CLI、自研 RAG/AI Safety Eval |

### 核心数据流（公聊）

```
用户消息 → POST /api/chat
         → ChatService（配额 / 持久化 / 意图 / 改写）
         → RetrievalService（混合检索 + 重排）
         → LlmService（租户 modelConfig）
         → 持久化助手消息 + 检索日志 + 未知问题（如需要）
         → 返回 answer / requiresHuman / citations
```

---

## 目录结构

```
.
├── apps/
│   ├── api/                 # NestJS 后端 API
│   │   └── src/
│   │       ├── ai/          # LLM / Embedding / ModelConfig
│   │       ├── chat/        # 对话编排（ChatService + TurnContext/Audit）
│   │       ├── knowledge/   # 知识库、检索、索引管道
│   │       ├── integrations/# 小红书、抖店、聚光、小程序等
│   │       ├── platform/    # 平台消息路由与适配
│   │       └── ...
│   ├── web/                 # Next.js 管理台 + 公聊
│   │   └── src/app/
│   │       ├── admin/       # 后台各功能页
│   │       └── chat/        # 租户公聊页
│   └── embed-widget/        # 可嵌入第三方站点的聊天组件
├── packages/
│   ├── database/            # Prisma Schema + Seed
│   └── shared/              # 公聊客户端等共享逻辑
├── services/
│   └── python-sidecar/      # RAG 解析、向量加速、知识图谱（可选）
├── tests/
│   ├── unit/                # 单元测试（19 文件 / 57 用例）
│   ├── integration/         # 集成测试
│   ├── e2e/                 # E2E 契约测试
│   ├── evals/               # RAG / AI Safety 评测
│   ├── fixtures/            # 演示与测试数据集
│   └── scripts/             # 测试基础设施、Seed、Release 验证
├── scripts/                 # DB 迁移确保、运行时监控
├── harness/                 # Mock Server（开发/测试）
├── docs/                    # 设计文档与 Superpowers 计划
├── PRPs/                    # 产品需求提示（Product Requirement Prompts）
├── docker-compose.yml       # 本地开发基础设施
├── docker-compose.test.yml  # 测试专用基础设施
├── ecosystem.config.cjs     # PM2 生产进程配置
└── turbo.json               # Turborepo 任务编排
```

---

## 环境要求

| 依赖 | 版本建议 |
|------|---------|
| Node.js | ≥ 20（推荐 22 LTS） |
| pnpm | 8.11.0（见 `packageManager` 字段） |
| Docker Desktop | 用于 Postgres / Redis / Sidecar（Windows 需开启 WSL2 后端） |
| Python | 3.10+（仅 Sidecar 本地开发时需要） |

**默认端口占用：**

| 服务 | 端口 |
|------|------|
| Web (Next.js) | 3100 |
| API (NestJS) | 4000 |
| PostgreSQL | 5433 |
| Redis | 6380 |
| MinIO API / Console | 9002 / 9003 |
| Python Sidecar | 8001 |
| Embed Widget Dev | 5190 |
| Swagger 文档 | http://localhost:4000/api/docs |

---

## 本地启动

### 1. 克隆与安装

```bash
git clone https://github.com/zuixi01/AI-assistant.git
cd AI-assistant

pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 按需编辑 .env（至少配置 DATABASE_URL、REDIS_URL、JWT_SECRET）
```

API 也会读取 `apps/api/.env`；根目录脚本（如 `pnpm db:ensure`）会优先加载根目录 `.env`。

### 3. 启动基础设施

```bash
docker compose up -d postgres redis
# 可选：MinIO、Python Sidecar
docker compose up -d minio python-sidecar
```

> **Windows 提示：** 若 `docker compose` 报 `project name must not be empty`，可设置：
> `set COMPOSE_PROJECT_NAME=ai-sales-assistant`

### 4. 初始化数据库

```bash
# 生成 Prisma Client
pnpm --filter @ai-assistant/database db:generate

# 同步 Schema（开发环境）
pnpm --filter @ai-assistant/database db:push

# 写入演示数据
pnpm --filter @ai-assistant/database db:seed
```

`pnpm api:prepare` 会在 API 启动前自动等待 DB/Redis 并执行 `db:ensure`（应用 pending migrations）。

### 5. 启动开发服务

**方式 A — 一键启动全部（Turbo）：**

```bash
pnpm dev
```

**方式 B — 分别启动：**

```bash
# 终端 1：API
pnpm --filter @ai-assistant/api dev

# 终端 2：Web
pnpm --filter @ai-assistant/web dev

# 终端 3（可选）：Embed Widget
pnpm --filter @ai-assistant/embed-widget dev
```

### 6. 访问应用

| 入口 | URL |
|------|-----|
| 首页 | http://localhost:3100 |
| 管理后台登录 | http://localhost:3100/admin/login |
| 公聊（生鲜电商 Demo） | http://localhost:3100/chat/lingnan-fresh-produce |
| 公聊（教培 Demo） | http://localhost:3100/chat/upskill-digital-lab |
| API 健康检查 | http://localhost:4000/api/health |
| Swagger | http://localhost:4000/api/docs |

### 演示账号（Seed 后可用）

| 租户 | 邮箱 | 密码 | 角色 |
|------|------|------|------|
| 岭南鲜配 | ops@lingnanfresh.cn | FreshOps2026! | admin |
| 岭南鲜配 | service@lingnanfresh.cn | FreshService2026! | operator |
| 向上数字技能中心 | ops@upskilllab.cn | UpskillOps2026! | admin |
| 向上数字技能中心 | advisor@upskilllab.cn | Advisor2026! | operator |

> 首次开发可将 `AI_PROVIDER=mock`、`EMBEDDING_PROVIDER=mock` 设为 Mock 模式，无需真实 API Key 即可跑通对话链路。

---

## 环境变量

完整模板见 [`.env.example`](.env.example)。以下为分组说明。

### 应用与网络

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `APP_URL` | 前端地址（CORS） | `http://localhost:3100` |
| `API_URL` | API 对外地址 | `http://localhost:4000` |
| `API_PORT` | API 监听端口 | `4000` |

### 数据库与缓存

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串（含 pgvector） |
| `TEST_DATABASE_URL` | 测试库连接串（`:5434`） |
| `REDIS_URL` | Redis 连接串（BullMQ + 缓存） |

### 安全

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥（生产务必更换，建议 48 字节随机） |
| `ENCRYPTION_KEY` | 敏感字段加密密钥（32 字节） |
| `ADMIN_JWT_EXPIRES_IN` | 管理端 Token 有效期 | `8h` |
| `WEBHOOK_SECRET` | Webhook 签名校验 |
| `SIDECAR_SHARED_TOKEN` | Python Sidecar 鉴权令牌（与 compose 中一致） |

### AI 模型

| 变量 | 说明 |
|------|------|
| `AI_PROVIDER` | LLM 提供商：`mock` / `openai` 等 |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | OpenAI 兼容接口 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` | DeepSeek 接口 |
| `EMBEDDING_PROVIDER` | Embedding 提供商 |
| `MOCK_AI_ENABLED` | 开发 Mock 开关 |

### RAG 与向量检索

| 变量 | 说明 |
|------|------|
| `VECTOR_DB_PROVIDER` | 向量存储 | `pgvector` |
| `VECTOR_SEARCH_PROVIDER` | 语义检索 | `pgvector` / `turbovec` |
| `RAG_SIDECAR_ENABLED` | 是否启用 Python Sidecar |
| `RAG_SIDECAR_URL` | Sidecar 地址 | `http://localhost:8001` |
| `TURBOVEC_ENABLED` | turbovec 向量加速 |
| `TURBOVEC_MIN_CHUNKS` | 启用 turbovec 的最小 chunk 数 |

Sidecar 专属配置见 [`services/python-sidecar/.env.example`](services/python-sidecar/.env.example)。

### 平台集成

| 变量 | 说明 |
|------|------|
| `XHS_CRYPTO_KEY` | 小红书消息 AES 密钥（32 hex） |
| `XHS_APP_ID` / `XHS_ACCESS_TOKEN` | 小红书开放平台 |
| `DOUDIAN_*` | 抖店 OAuth 与 API |
| `JUGUANG_*` | 聚光集成 |
| `WECHAT_MINIAPP_*` / `DOUYIN_MINIAPP_*` | 小程序 |

### 对象存储与通知

| 变量 | 说明 |
|------|------|
| `MINIO_*` | MinIO 文件存储 |
| `WE_COM_WEBHOOK_URL` 等 | 企业微信/飞书/钉钉通知 |

---

## Docker 启动

### 开发环境（完整栈）

```bash
# 启动 Postgres + Redis + MinIO + Python Sidecar
docker compose up -d

# 查看状态
docker compose ps

# 查看 Sidecar 健康
curl http://127.0.0.1:8001/health
```

`docker-compose.yml` 服务一览：

| 服务 | 镜像/构建 | 宿主机端口 |
|------|----------|-----------|
| postgres | pgvector/pgvector:pg16 | 5433 |
| redis | redis:7-alpine | 6380 |
| minio | minio/minio | 9002, 9003 |
| python-sidecar | `./services/python-sidecar` | 127.0.0.1:8001 |

Sidecar 默认仅绑定 `127.0.0.1`，生产环境请配合反向代理与令牌鉴权。

### 测试环境

```bash
pnpm test:infra:up      # 启动 postgres-test:5434, redis-test:6381, sidecar:8002
pnpm test:db:push       # 同步测试 Schema
pnpm seed:test          # 写入测试数据
pnpm test:infra:down    # 销毁测试栈
```

---

## RAG 流程

### 知识入库（Indexing）

```
管理员上传文件 / 创建文本源
        │
        ▼
KnowledgeController (/api/admin/knowledge)
        │
        ▼
KnowledgeService.createFromUpload()
        │
        ├─► DocumentParserService（Sidecar 或内置 Fallback 解析）
        │       提取正文 / 表格 / 图片 OCR
        │
        ▼
KnowledgeIndexQueue（BullMQ: knowledge-index:index-source）
        │
        ▼
PipelineService.processDocument()
        │
        ├─► ChunkerFactory（fixed / recursive / qa-pair）
        ├─► EmbeddingService.embedBatch()（租户或全局配置）
        ├─► VectorStoreService.insertChunk() → pgvector
        └─► VectorStoreService.syncChunksToAccelerator() → turbovec（可选）
```

### 检索与回答（Retrieval + Generation）

```
用户消息（公聊 / 平台 Webhook）
        │
        ▼
ChatTurnContextService.prepareTurn()
        │
        ├─► 意图识别 + 查询改写（LLM，租户 modelConfig）
        │
        ▼
RetrievalService.retrieve()
        │
        ├─► 语义检索：turbovec Sidecar 或 pgvector（<=> 余弦距离）
        │       └─ 维度不匹配 / Sidecar 超时 → 降级 keyword_only
        ├─► 关键词检索：中文分词 + SQL 全文匹配
        └─► 多因子重排（向量分 / 关键词分 / 类目 / 标题 / 模态）
        │
        ▼
LlmService.chatWithConfig()（RAG Prompt + 引用片段）
        │
        ▼
ChatTurnAuditService
        ├─► 持久化助手消息 + metadata（confidence / citations / products）
        ├─► KnowledgeRetrievalLog
        └─► UnknownQuestion（低置信度时）
```

### 向量检索策略

| 模式 | 条件 | 行为 |
|------|------|------|
| pgvector | 默认 | Postgres `vector(1536)` 语义搜索 |
| turbovec | `TURBOVEC_ENABLED=true` 且 chunk 数达标 | Sidecar ANN 加速，结果回表校验 tenant |
| keyword_only | Embedding 维度不匹配 / 语义失败 | 仅关键词检索，日志记录 `fallbackReason` |

---

## 测试命令

### 快速验证（提交前）

```bash
pnpm validate:quick
# = lint + typecheck + test:unit + test:integration
```

> **Windows 注意：** Vitest 多 worker 可能触发 Node/tinypool 崩溃。若失败，请改用：
> ```bash
> pnpm exec vitest run tests/unit --pool=forks --maxWorkers=1
> pnpm exec vitest run tests/integration --pool=forks --maxWorkers=1
> ```

### 分层测试

| 命令 | 说明 |
|------|------|
| `pnpm test:unit` | 单元测试（19 文件 / 57 用例） |
| `pnpm test:integration` | 集成测试 |
| `pnpm test:e2e` | E2E 契约（如 admin auth cookie） |
| `pnpm test:api` | API Smoke 测试 |
| `pnpm test:rag` | RAG 评测（fixture 或 live API） |
| `pnpm test:ai-safety` | AI 安全/fixture 评测 |
| `pnpm test:sidecar:live` | Sidecar 联调 Smoke |
| `pnpm test:tenant-isolation` | 租户隔离专项 |

### 发布前全链路

```bash
pnpm validate:release
```

执行顺序：测试基础设施启动 → Schema 同步 → 重置/Seed → Build → validate → RAG eval → Sidecar live → 清理。

### MVP 验证（含 Docker 测试栈）

```bash
pnpm validate:mvp
```

---

## 部署说明

### 生产构建

```bash
pnpm install
pnpm --filter @ai-assistant/database db:generate
pnpm --filter @ai-assistant/database db:push   # 或 migrate deploy

pnpm build
```

### PM2 进程管理（单机）

```bash
# 构建完成后
pnpm pm2:start

# 查看日志
pnpm pm2:logs

# 重启 / 停止
pnpm pm2:restart
pnpm pm2:stop
```

PM2 配置见 [`ecosystem.config.cjs`](ecosystem.config.cjs)，包含：

- `ai-assistant-api` — NestJS 生产模式（含 `api:prepare`）
- `ai-assistant-web` — Next.js `start -p 3100`

### 生产检查清单

- [ ] 更换 `JWT_SECRET`、`ENCRYPTION_KEY`、`SIDECAR_SHARED_TOKEN`
- [ ] 设置真实 `AI_PROVIDER` / `EMBEDDING_PROVIDER` 与 API Key
- [ ] `NODE_ENV=production`，`MOCK_AI_ENABLED=false`
- [ ] Docker 栈健康：`postgres`、`redis`、（可选）`python-sidecar`
- [ ] 执行 `pnpm validate:release` 或至少 `pnpm validate:quick`
- [ ] 配置反向代理（Nginx/Caddy）与 HTTPS
- [ ] 限制 Sidecar 端口仅内网可达
- [ ] 配置 `WE_COM_WEBHOOK_URL` 等告警通知

### 推荐拓扑（中小规模）

```
Internet
    │
    ▼
[Nginx / Caddy] ──► Web :3100
    │               API :4000（/api 反代）
    │
    ├── PostgreSQL (pgvector)
    ├── Redis
    ├── Python Sidecar（内网 :8001）
    └── MinIO（可选）
```

### Swagger API 文档

部署后访问：`https://your-domain/api/docs`

---

## 后续路线图

### 近期（P0 — 上线必备）

- [ ] GitHub Actions CI：`lint` + `vitest --maxWorkers=1` + `build`
- [ ] 完善 Prisma Migration 流程，减少 `db push` 依赖
- [ ] 生产环境一键部署文档（含环境变量清单）
- [ ] pgvector ANN 索引（IVFFlat / HNSW）应对大规模 chunk

### 中期（P1 — 产品化）

- [ ] WebSocket / SSE 替代公聊轮询，降低延迟
- [ ] 统一前后端 API 契约测试（OpenAPI + contract test）
- [ ] Sidecar 高级解析（MinerU / Docling）生产级启用与监控
- [ ] 租户计费、配额后台与用量统计
- [ ] 完善商品/订单管理前台页面

### 长期（P2 — 平台化）

- [ ] 实时质检与客服 SLA 报表
- [ ] 多 Region 部署与读写分离
- [ ] 插件化渠道接入框架
- [ ] 知识库版本管理与 A/B 评测平台

详细优化任务见 [`task_plan.md`](task_plan.md) 与 [`PRPs/`](PRPs/) 目录。

---

## 常见问题

### API 启动报 `Environment variable not found: DATABASE_URL`

根目录脚本需读取 `.env`。确认已 `cp .env.example .env`，且 Postgres 容器已启动。

### 管理后台会话/线索 500，Prisma P2022

数据库 Schema 落后于代码。执行：

```bash
pnpm --filter @ai-assistant/database db:push
# 或
pnpm db:ensure
```

### 公聊无 AI 回复 / RAG 空结果

1. 确认 Redis、Postgres 运行中
2. 检查知识源 `indexStatus` 是否为 `completed`
3. 查看 Embedding 维度是否与 `vector(1536)` 匹配（不匹配会降级关键词检索）
4. 开发模式可设 `AI_PROVIDER=mock`

### Next.js 白屏 `Cannot find module './NNN.js'`

`.next` 缓存损坏。停止 Web 进程，删除 `apps/web/.next`，重新 `pnpm --filter @ai-assistant/web dev`。

### Docker Desktop 500 但容器实际在跑

Windows 上偶发 Docker API 异常。用 `netstat -ano | findstr 5433` 确认端口监听。

---

## 许可证

[MIT](LICENSE)

---

## 相关文档

- [`AGENTS.md`](AGENTS.md) — AI 协作入口与 OpenWolf 规范
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — 功能设计与实施计划
- [`PRPs/meiqia-ai-customer-service-optimization.md`](PRPs/meiqia-ai-customer-service-optimization.md) — 美洽式客服优化 PRP
- [`PRPs/production-hardening.md`](PRPs/production-hardening.md) — 生产加固 PRP
