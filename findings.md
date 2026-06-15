# 发现与决策

## 需求
- 用户希望基于当前项目现状，分析仍需优化的地方，并生成一份解决方案和实施计划。
- 交付重点应是可执行、可排序、可落地，而不是泛泛的架构讨论。

## 研究发现
- 项目是 `pnpm workspace + turbo` 的 monorepo，核心应用包括 `apps/api`、`apps/web`、`apps/embed-widget`、`packages/database`、`services/python-sidecar`。
- 后端核心复杂度集中在 `apps/api/src/chat/chat.service.ts`、知识库/RAG 链路、平台接入链路。
- 前端后台和公开聊天链路已经较完整，但 `apps/web` 公开聊天页与 `apps/embed-widget` 的会话/token 生命周期并不一致。
- 历史记忆已明确指出一些风险点：部分后台接口契约不一致、`ChatService` 责任过重、sidecar 高级能力仍偏占位、部分测试与功能契约曾出现断裂。
- 基础设施依赖较多：`Postgres(pgvector)`、`Redis`、`MinIO`、`Python sidecar`，这意味着上线稳定性高度依赖运行环境一致性。
- 本轮热点排查确认的 P0/P1 问题包括：
- `ChatService` 是超级编排器，承担配额、消息、意图、检索、日志、状态流转、流式响应等多重职责。
- 多处服务存在“先按 tenant 校验，再按 id 直接写入”的模式，租户隔离边界仍不够硬。
- `PlatformRouterService.findOrCreateConversation()` 未使用平台用户唯一键做会话隔离，存在同租户同渠道串会话风险。
- 公聊 Web 与 Widget 使用了两套不同的 session/token/message 同步模型，未来行为容易继续漂移。
- Juguang、Leads、Workspace 等前后端接口契约存在真实错配或多套并存的问题。
- 测试体系覆盖面广但默认验证链没有纳入 e2e、AI safety、真实 sidecar 联调，回归保护不足。
- sidecar 对外暴露管理接口且缺少鉴权，能力声明与真实实现也存在落差。
- 本轮已实际落地的 P0 事项：
- 已为 `Conversation` 增加平台用户/账号标识，并让 `PlatformRouterService` 基于这些字段查找/创建会话。
- 已将 `ProductsService`、`LeadsService`、`ConversationsService` 的核心写路径切到 tenant-scoped 写入方式。
- 已关闭公共 `POST /conversations/:conversationId/messages` 直写入口，强制公共聊天走 `/api/chat` 主编排。
- 已修正 Juguang 编辑请求方法、Lead 详情页状态字段，以及后台会话详情页的状态更新入口。
- 已为 sidecar 向量接口增加共享令牌校验，并让 compose 默认只绑定到 localhost。
- 本轮已实际落地的 P1 事项：
- 已将 `ChatService` 拆分为主编排层、`ChatTurnContextService`、`ChatTurnAuditService`，把上下文准备、检索编排、审计与持久化拆开。
- 已将后台会话详情页的状态变更、指派/取消指派、人工回复统一收敛到 `admin/conversations` 路由模型。
- 已在 `packages/shared` 新增共享 public chat client，并让 Web Chat 与 Embed Widget 统一使用相同的会话创建、token 持有、消息轮询与发送逻辑。
- 本轮已实际落地的 Sprint 2 事项：
- 已新增统一测试环境脚本 `test-env.ts`，为测试 DB / Redis / sidecar 提供默认连接与共享令牌。
- 已新增 `test-infra.ts`、`push-test-schema.ts`、`validate-release.ts`，形成 `test:infra:*`、`test:db:push`、`validate:release` 的一键测试基础设施与发布前验证链。
- 已将 `reset-test-db.ts`、`seed-test-data.ts` 接到统一测试环境，并对旧 fixture 短 ID 做稳定 UUID 映射，兼容当前 Prisma UUID schema。
- 已在 `docker-compose.test.yml` 中加入 `python-sidecar-test`，并通过 `check-sidecar-live.ts` 区分 sidecar 不可达、健康异常和解析业务失败三类问题。
- 本轮已实际落地的 Sprint 3 事项：
- 已在 `apps/web/src/lib/api.ts` 增加统一错误消息归一化，兼容 `message: string[]`、`message: string` 与纯文本错误响应。
- 已为 `apps/api/src/workspace/workspace.controller.ts` 增加 `PATCH /conversations/:id/assignment` 与 `PATCH /conversations/:id/status`，同时将 `workspace.service.ts` 的会话写路径统一为 tenant-scoped 更新与空回复校验。
- 已将 `tenants.service.ts`、`knowledge/pipeline.service.ts`、`integrations/xiaohongshu/*.ts`、`integrations/juguang/juguang.service.ts` 的通用 `Error` 收敛为更明确的 Nest 业务异常。
- 已新增 `apps/web/src/app/admin/settings/integrations/shared.ts`，并让总设置页、小红书页、聚光页统一复用 `XhsAccount` / `JuguangAccount` 契约、Juguang 表单映射和集成 API helper。
- 已让 `retrieval.service.ts` 在 keyword-only / no-hit / pgvector / turbovec 间输出明确日志与 fallback 原因，并为 sidecar `/health` 增加 parser mode、graph mode、capabilities 与 vector health，使“真实能力”和“降级路径”可观测。
- 已补齐 `tests/unit/workspace-tenant-isolation.test.ts` 的 Prisma mock，使其与 `WorkspaceService` 当前基于 `updateMany` 的 tenant-scoped 写入实现保持一致；修复后 `pnpm validate` 全链路通过。
- 已在 Sprint 3 完成后再次跑通 `pnpm validate:release`，确认测试基础设施、RAG fixture fallback、sidecar live smoke 与发布前 orchestrator 仍可用。
- 本轮公开聊天页增强发现：
- 公开聊天页的上下文绑定在 `conversationId + conversationToken + localStorage(ai-assistant:chat-session:${tenantSlug})` 上，因此“清除记录”要真正生效，必须同时清空页面状态、本地缓存，并丢弃旧会话后重新创建新会话，而不是只删 DOM 消息数组。
- 通过复用现有 `retryNonce` 初始化流程，可以在不新增后端删除接口的情况下安全切断旧上下文，确保后续提问不会再加载已清理的历史会话。
- 返回后台主页面使用 `next/navigation` 的 `router.push('/admin/dashboard')`，并在页面挂载时 `prefetch` 目标路由，可减少返回过程中的感知卡顿。
- 本机 `3100` 端口存在一个带旧 `.next` 缓存的 Next 进程，命中 `Cannot find module './31.js'` 的已知白屏问题；本轮浏览器验证改在新启动的 `3101` 实例完成，功能正常。

## 技术决策
| 决策 | 理由 |
|------|------|
| 优化建议按 P0/P1/P2 分层输出 | 便于用户按上线收益排序执行 |
| 将问题分为架构、接口契约、测试质量、运行稳定性、性能体验五类 | 便于覆盖全局且避免重复建议 |
| 开发计划按 `T0/T1/T2/T3` 任务编号输出 | 便于直接转 issue、排期和跟踪验收 |
| 每个任务必须附带目标、文件范围、验收标准和依赖 | 避免“建议很对但无法执行”的空转 |
| Sidecar 能力边界通过健康接口和检索日志显式暴露 | 比单纯文档说明更利于测试、监控和生产排障 |
| 完整验证链失败时优先修测试契约漂移，再判断业务回归 | 能区分“实现坏了”和“测试仍停留在旧实现”的两类问题 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 规划模板初次按 `.claude/skills` 路径读取失败 | 改为实际存在的 `.agents/skills/planning-with-files-zh/templates` 路径 |

## 资源
- `d:\智能客服助手\.wolf\anatomy.md`
- `d:\智能客服助手\.wolf\cerebrum.md`
- `d:\智能客服助手\.wolf\buglog.json`
- `d:\智能客服助手\package.json`

## 视觉/浏览器发现
- 本轮任务不涉及浏览器可视化检查，暂无新增视觉发现。

## 本轮新增发现：测试数据真实性优化
- 当前测试数据核心来源集中在 `tests/fixtures/*.demo.json`、`tests/fixtures/*.md`、`tests/evals/*.json`、`tests/scripts/seed-test-data.ts`、`packages/database/prisma/seed.ts` 与 `apps/api/src/ai/llm/providers/mock-llm.provider.ts`。
- 现有数据主要问题不是“结构错误”，而是“过度演示化”：字段分布过于整齐、商品价格与课程价格像营销样稿、欢迎语/售后话术过于统一、会话流缺少真实用户犹豫和渠道差异。
- 账号和凭据存在明显演示痕迹：`admin123456`、`cs123456`、`admin@example.com`、`admin@demo.com` 等示例口令/邮箱出现在 fixture、DTO 示例、评测脚本和前端占位文案中。
- 存在占位资源：`example.com` 头像/商品图、`tenantId="demo"`、`inactive-demo` 等标识容易造成“演示数据误用为真实数据”的错觉。
- 电商样本当前集中在榴莲、车厘子、贵妃芒等高辨识度商品，但价格、促销、话术分布过于规则；培训样本存在“就业率92%”“平均薪资涨幅40%”“大厂讲师”等强营销表达，与审慎客服口径不一致。
- RAG 与 AI safety 评测样本当前直接绑定旧商品名、旧价格、旧课程课时与旧退费规则；如果只改 fixtures 不改评测样本，会导致验证链出现大量伪失败。
- `products.durian.json` 没有被 seed 脚本直接消费，但其中的商品与价格信息被 `conversations.demo.json`、`mock-llm.provider.ts`、`hallucination_cases.json` 手工复制，因此必须视为“联动源”。
- `seed-test-data.ts` 与 `seed.ts` 均硬编码依赖租户 slug `fresh-fruit-shop` / `qihang-coding`，如果租户品牌和场景升级，需要同步修改代码中的查找逻辑。
- 适合保留的稳定结构包括：双租户建模、用户-会话-线索关联、未知问题沉淀、知识库 FAQ + RAG 评测分层；适合重写的是内容文本、数值分布、角色画像、渠道来源和业务流程描述。

## 本轮新增决策：测试数据替换策略
| 决策 | 理由 |
|------|------|
| 保留“生鲜零售 + 职业培训”两类业务场景，但改为更真实的区域门店/课程顾问口径 | 兼顾现有代码语义与测试覆盖，降低结构性改动风险 |
| 商品价格采用分档但不过度整齐的整数分布，课程价格与课时改为更常见的招生口径 | 更贴近真实业务数据分布 |
| 会话文本加入真实咨询节奏，如追问、犹豫、地址/时效限制、年龄段/上课时间顾虑 | 提升流程真实性与意图识别价值 |
| AI safety 样本继续保留“禁止编造”方向，但上下文改为新的商品、时效、价格和课程规则 | 保持评测目标不变，同时让内容与新数据一致 |
| 示例账号统一改为业务域名邮箱，密码改为仅测试用途但非弱口令的值 | 降低演示痕迹和误导性 |

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
