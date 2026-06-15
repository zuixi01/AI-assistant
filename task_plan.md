# 任务计划：项目优化开发任务清单

## 目标
基于当前项目代码、历史记忆和已知问题，输出一份按优先级排序、可直接执行的开发任务清单与落地计划。

## 当前阶段
阶段 12

## 各阶段

### 阶段 1：现状梳理与问题归类
- [x] 理解用户意图
- [x] 确定约束条件和需求
- [x] 将发现记录到 findings.md
- [x] 汇总当前系统的主要优化方向
- **状态：** complete

### 阶段 2：方案设计与优先级排序
- [x] 确定优化优先级矩阵
- [x] 输出每类问题的解决方案
- [x] 记录关键决策及理由
- **状态：** complete

### 阶段 3：计划拆解
- [x] 将优化方案拆成阶段性执行计划
- [x] 为每个阶段定义目标、产出和验证方式
- [x] 识别依赖关系与风险
- **状态：** complete

### 阶段 4：校对与交付
- [x] 检查方案是否覆盖架构、质量、运行和交付维度
- [x] 将结果整理为用户可直接执行的计划
- [x] 交付给用户
- **状态：** complete

## 执行原则
- 先做会影响数据正确性、租户隔离、接口稳定性的 P0 任务。
- 每个任务必须包含：目标、改动范围、验收标准、回归方式。
- 优先做“小步可上线”改动，避免一次性大重构。
- 每完成一个任务，就补一条回归测试或契约校验，防止回退。

## 开发任务清单

### Sprint 0：上线前阻断项（P0，建议 3-5 天）

#### T0-01 平台会话唯一键修复
- **目标：** 修复平台消息串会话风险，确保同租户同渠道不同用户不会复用错误会话。
- **改动文件：** `apps/api/src/platform/platform-router.service.ts`，必要时联动 `packages/database/prisma/schema.prisma`
- **动作：**
  - 将会话查找条件从“tenantId + channel + 最近 open 会话”改为基于 `tenantId + channel + accountId + fromUserId` 的稳定唯一键。
  - 如现有表结构无法承载，补充平台会话标识字段或映射表。
  - 为历史无标识数据设计兼容兜底逻辑。
- **验收标准：**
  - 两个不同平台用户连续发消息时，不会进入同一会话。
  - 单元测试覆盖“同渠道不同用户”“同用户多次消息”“无历史会话”三种场景。
- **依赖：** 无
- **执行状态：** complete

#### T0-02 租户隔离写入硬化
- **目标：** 消除“先查 tenant、再按 id 写入”的脆弱模式。
- **改动文件：** `apps/api/src/products/products.service.ts`、`apps/api/src/leads/leads.service.ts`、`apps/api/src/conversations/conversations.service.ts`，以及同类 service
- **动作：**
  - 将 update/delete 统一为 tenant-scoped helper。
  - 全面替换按 `id` 单独写入的 Prisma 调用。
  - 为 tenant mismatch 返回统一业务异常。
- **验收标准：**
  - 所有高风险写接口都必须通过 tenant 条件更新。
  - 新增 integration test 覆盖跨租户 update/delete 拒绝。
- **依赖：** 无
- **执行状态：** complete（本轮已覆盖 `products`、`leads`、`conversations` 的核心写路径与测试）

#### T0-03 公共消息写入口收口
- **目标：** 阻止客户端绕过主聊天编排直接写消息或伪造角色。
- **改动文件：** `apps/api/src/messages/messages.controller.ts`、`apps/api/src/messages/messages.service.ts`、`apps/api/src/chat/chat.service.ts`
- **动作：**
  - 限制公共消息接口仅允许受控用户消息输入，禁止自由传 `role`。
  - 能删除则删除该直写入口；不能删除则降级为内部专用。
  - 统一公共消息创建走聊天编排服务。
- **验收标准：**
  - 外部请求无法写入 `assistant/system` 角色消息。
  - 公开聊天历史、检索日志、状态流转仍完整可用。
- **依赖：** T0-02
- **执行状态：** complete

#### T0-04 前后端契约修正
- **目标：** 修掉已知真实错配，恢复主业务流稳定性。
- **改动文件：** `apps/web/src/app/admin/settings/page.tsx`、`apps/web/src/app/admin/settings/juguang/page.tsx`、`apps/web/src/app/admin/settings/xiaohongshu/page.tsx`、`apps/web/src/app/admin/leads/[id]/page.tsx`、对应 API controller/dto
- **动作：**
  - Juguang 更新统一改成 `PATCH`。
  - Leads 详情页字段统一改为 `followStatus`。
  - 盘点 workspace / conversations 双路由的调用边界，先统一前端调用入口。
- **验收标准：**
  - 设置页编辑 Juguang 成功。
  - Leads 详情页状态展示和保存正确。
  - 相关页面不再依赖错误字段名或错误 HTTP 方法。
- **依赖：** 无
- **执行状态：** complete

#### T0-05 Sidecar 最小安全收口
- **目标：** 降低 sidecar 暴露风险，避免高风险接口裸奔。
- **改动文件：** `services/python-sidecar/main.py`、`docker-compose.yml`
- **动作：**
  - 给 `/vector/*` 管理接口增加服务间鉴权或仅内网可访问限制。
  - 收紧 CORS 配置，去掉生产下的 `*`。
  - 评估是否取消主机直映射端口或只在 dev 暴露。
- **验收标准：**
  - 未授权请求不能执行向量重建/写入/删除。
  - 本地开发与生产配置可区分。
- **依赖：** 无
- **执行状态：** complete

### Sprint 1：主链路统一（P1，建议 5-7 天）

#### T1-01 ChatService 拆分第一步
- **目标：** 降低 `ChatService` 复杂度，但不一次性推翻现有流程。
- **改动文件：** `apps/api/src/chat/chat.service.ts` 及新建的 chat 子服务文件
- **动作：**
  - 抽离 `quota/session guard`、`retrieval orchestration`、`reply persistence/audit` 三类职责。
  - 保留原外部接口不变，先做内部重构。
  - 去掉 `chat / suggest / stream` 间的重复逻辑。
- **验收标准：**
  - `ChatService` 主文件显著瘦身。
  - 原有单元测试和主流程接口行为不变。
- **依赖：** T0-03
- **执行状态：** complete

#### T1-02 公聊客户端统一
- **目标：** 让 Web Chat 和 Widget 使用同一套 session/token/message 同步模型。
- **改动文件：** `apps/web/src/app/chat/[tenantSlug]/page.tsx`、`apps/embed-widget/src/ChatWidget.tsx`、必要时新建 shared client
- **动作：**
  - 提取 shared public chat client / hook。
  - 统一 conversation token 持有、消息拉取、发送与错误解析策略。
  - Widget 补齐必要的 token 安全模型和消息同步机制。
- **验收标准：**
  - Web Chat 与 Widget 共享相同的会话初始化和发送协议。
  - 两端不会再因为 token/session 差异出现行为分叉。
- **依赖：** T0-03
- **执行状态：** complete

#### T1-03 后台会话操作 API 收敛
- **目标：** 减少同一业务流打三套接口的问题。
- **改动文件：** `apps/web/src/app/admin/conversations/[id]/page.tsx`、`apps/api/src/conversations/conversations.controller.ts`、`apps/api/src/workspace/workspace.controller.ts`
- **动作：**
  - 确定后台会话操作单一入口。
  - 前端统一改为一套路由调用。
  - 标记废弃接口，保留兼容期。
- **验收标准：**
  - 会话详情页的读取、改状态、指派、人工回复只走一套路由模型。
- **依赖：** T0-04
- **执行状态：** complete

### Sprint 2：测试与交付硬化（P1，建议 4-6 天）

#### T2-01 默认验证链升级
- **目标：** 让默认 `validate` 更接近真实上线前检查。
- **改动文件：** `package.json`、`tests/e2e/*`、`tests/evals/*`
- **动作：**
  - 将最小 e2e、AI safety、mock webhook 纳入 `validate` 或新增 `validate:release`。
  - 明确本地快速验证与发布前验证两条命令。
- **验收标准：**
  - 团队知道什么时候跑快速校验，什么时候跑发布前校验。
  - 发布前验证能覆盖登录、公聊、知识检索、平台消息至少 4 条关键链路。
- **依赖：** 无
- **执行状态：** complete（已新增 `validate:quick` / `validate` / `validate:release` 分层命令，并纳入 e2e、AI safety、mock webhook、平台 mock 校验）

#### T2-02 测试环境自动拉起
- **目标：** 让测试依赖可一键启动，减少环境偶现问题。
- **改动文件：** `package.json`、`docker-compose.test.yml`、`tests/scripts/*`
- **动作：**
  - 新增测试环境启动/销毁脚本。
  - 测试脚本自动读取 `docker-compose.test.yml` 提供的连接信息。
  - 为 CI 和本地复用同一套入口。
- **验收标准：**
  - 新环境可通过固定命令完成 test infra 启动、seed、验证、清理。
- **依赖：** 无
- **执行状态：** complete（已新增 `test:infra:*`、`test:db:push`，并通过 `validate:release` 串联 schema/reset/seed/validate/cleanup）

#### T2-03 Sidecar 活体回归
- **目标：** 测试不再只覆盖 fallback，而是覆盖真实 sidecar 通路。
- **改动文件：** `tests/integration/*`、`services/python-sidecar/*`
- **动作：**
  - 增加最小 sidecar 健康检查与文档解析联调测试。
  - 区分“sidecar unavailable 时允许回退”和“sidecar should be alive 的回归测试”。
- **验收标准：**
  - 可以明确判断是 sidecar 不可用，还是业务逻辑本身有误。
- **依赖：** T2-02
- **执行状态：** complete（已新增 `check-sidecar-live.ts`，并在测试 compose 中引入 sidecar 服务，区分 unavailable / unhealthy / business failure）

### Sprint 3：中期治理（P2，建议持续推进）

#### T3-01 REST 与错误处理统一
- **目标：** 统一接口风格与异常语义，降低前端接入复杂度。
- **改动文件：** `apps/api/src/**/*controller.ts`、`apps/api/src/**/*service.ts`
- **动作：**
  - 统一更新/删除接口方法语义。
  - 统一使用 Nest 异常而不是混合 `Error` / `{ success: false }`。
  - 为前端整理统一错误解析协议。
- **验收标准：**
  - 新接口设计风格统一，旧接口有迁移清单。
- **依赖：** T0-04
- **执行状态：** complete（已为 `workspace` 补齐 `PATCH /conversations/:id/(assignment|status)`，统一 tenant-scoped 写入与前端错误消息归一化，并将多处通用 `Error` 收敛为 Nest 业务异常）

#### T3-02 设置页与集成页去重
- **目标：** 消除三处重复实现带来的漂移。
- **改动文件：** `apps/web/src/app/admin/settings/page.tsx`、`apps/web/src/app/admin/settings/xiaohongshu/page.tsx`、`apps/web/src/app/admin/settings/juguang/page.tsx`
- **动作：**
  - 抽取共享集成设置组件和 API 层。
  - 合并重复状态管理与表单逻辑。
- **验收标准：**
  - 同一集成逻辑只保留一套主要实现。
- **依赖：** T0-04
- **执行状态：** complete（已新增 `apps/web/src/app/admin/settings/integrations/shared.ts`，并让总设置页、小红书页、聚光页统一复用账号类型、表单映射、webhook URL 与账号 API helper）

#### T3-03 RAG/向量能力边界澄清
- **目标：** 让 sidecar 能力声明、数据库维度约束和实际运行逻辑一致。
- **改动文件：** `services/python-sidecar/raganything_service.py`、`services/python-sidecar/turbovec_service.py`、`apps/api/src/knowledge/retrieval/retrieval.service.ts`
- **动作：**
  - 明确哪些能力是生产可用，哪些仍是 fallback。
  - 将 embedding 维度约束配置化或显式校验化。
  - 补充运行文档与告警提示。
- **验收标准：**
  - 模型维度不匹配时，系统行为明确且可观测。
- **依赖：** T2-03
- **执行状态：** complete（已让 `retrieval.service.ts` 输出语义 provider / retrieval mode / fallback reason，并在 sidecar `/health` 暴露 parser mode、graph mode、vector health 与 capability summary；客户端同时统一 snake_case/camelCase 健康字段）

## 建议执行顺序
1. `T0-01` -> `T0-02` -> `T0-03`
2. `T0-04` 与 `T0-05` 可并行
3. `T1-01` 与 `T1-03` 串行推进
4. `T1-02` 在 `T0-03` 后启动
5. `T2-*` 可在 P0 收口后并行补强
6. `T3-*` 作为稳定后治理项持续推进

## 每个任务的统一交付模板
- **改动说明：** 改了什么、为什么现在要改
- **影响范围：** API / Web / Widget / DB / Sidecar / Tests
- **验证方式：** 单元测试、集成测试、手工回归路径
- **回滚策略：** 是否可 feature flag、是否可局部回滚
- **文档同步：** 是否需要更新 README、部署说明、接口说明

## 关键问题
1. 哪些问题属于立即影响上线稳定性的高优先级项？
2. 哪些问题属于中期架构治理项，适合在功能稳定后推进？
3. 如何把问题拆成可以逐周执行的落地计划，而不是泛泛建议？

## 已做决策
| 决策 | 理由 |
|------|------|
| 先基于现有代码和项目记忆做静态优化分析 | 当前用户要求的是方案和计划，不是立即改代码 |
| 优先按“稳定性/正确性 -> 可维护性 -> 性能与体验”排序 | 更符合当前项目接近交付阶段的收益最大化原则 |
| 优先级按 P0/P1/P2 划分 | 便于先处理影响上线与数据正确性的事项 |
| 计划按“立即修复 -> 结构治理 -> 稳定化与提效”分阶段 | 能兼顾快速收益与长期可维护性 |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| 按 `C:\Users\29408\.claude\skills\planning-with-files-zh\templates\*.md` 读取模板失败 | 1 | 改为从实际技能目录 `C:\Users\29408\.agents\skills\planning-with-files-zh\templates\` 读取 |

## 阶段 12：测试数据现状盘点与替换方案
- [x] 识别所有测试数据来源、seed 入口和硬编码副本
- [x] 分析当前模拟数据的失真点和业务不一致问题
- [x] 输出需要替换的测试用例、输入参数、输出结果和关联文本清单
- [x] 设计新的真实化业务样本与字段分布
- **状态：** complete

### 阶段 13：测试数据与评测样本重写
- [x] 重写 `tests/fixtures` 下的核心静态数据集
- [x] 同步更新 seed 脚本中的租户 slug、知识源标题和演示账号
- [x] 重写 RAG / AI safety 评测样本与 Mock 回复，保持语义一致
- [x] 清理占位域名、弱口令、演示型文案和不真实业务场景
- **状态：** complete

### 阶段 14：全量验证与对比交付
- [x] 执行全量测试与发布前验证链
- [x] 检查新数据是否引入 lint / type / test 问题
- [x] 汇总完整数据清单与前后对比说明
- [x] 整理真实性、业务贴合度和覆盖率提升点
- **状态：** complete

## 已做决策（本轮追加）
| 决策 | 理由 |
|------|------|
| 保留双租户结构，但将样本升级为更接近真实生产的生鲜零售与职业培训场景 | 能兼容现有 schema、seed 逻辑与大部分测试入口，同时显著提升数据真实性 |
| 用“自然波动、非整百、含渠道差异”的数据替代展示型价格和用语 | 更接近真实业务数据分布，避免一眼看出是演示样本 |
| 同步改 fixtures、知识库、快捷回复、Mock LLM、RAG eval、AI safety eval 和示例账号 | 避免数据主源和断言副本漂移，保证测试仍然稳定 |
| 保留 fixture 文件名不变，优先改内容而不是改装载机制 | 降低改动半径，先保证全量测试可以通过 |

## 备注
- 本轮目标是直接完成测试数据替换、验证和对比交付，而不是只给方案。
- 替换结果必须映射到真实文件和真实测试入口，避免只改一部分样本导致断言漂移。

## 阶段 15：数据分析模块视觉与指标审计
- [x] 盘点 `apps/web/src/app/admin/analytics/page.tsx` 当前页面结构和交互缺口
- [x] 复核 `apps/api/src/analytics/analytics.service.ts` 返回口径，识别前后端字段不一致问题
- [x] 对照图三模板归纳适合的卡片、趋势、占比、排行图表组合
- [x] 确认本轮实施顺序为“后端标准化数据 -> 前端图表重构 -> 浏览器视觉验收”
- **状态：** complete

## 阶段 16：标准化分析数据接口与图表系统开发
- [x] 重构分析接口输出，统一趋势、占比、排行、效率类指标口径
- [x] 实现新的分析页布局、图表组件、交互动效和响应式适配
- [x] 补齐错误态、空态、悬浮提示、维度切换和基础下钻交互
- [x] 同步更新多语言文案与必要的样式定义
- **状态：** complete

## 阶段 17：视觉验收与对比交付
- [x] 启动本地页面并完成浏览器截图核验
- [x] 执行 diagnostics / lint / build 等静态验证
- [x] 对比旧方案与新方案的信息层级、可读性与视觉统一性
- [x] 记录验证结果、遗留风险与后续优化建议
- **状态：** complete
