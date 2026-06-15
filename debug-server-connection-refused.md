# Debug Session: server-connection-refused [OPEN]

## Problem
- 项目服务器频繁出现突发连接拒绝，需要手动反复重启。

## Scope
- 先完成重启前后的运行态采集、日志与资源证据收集、根因定位、修复方案设计与验证方案落地。

## Constraints
- 在拿到运行时证据前，不修改业务逻辑。
- 首次代码改动若发生，只能是插桩/监控相关改动。

## Hypotheses
- H1: 服务主进程因未捕获异常或 promise rejection 退出，导致端口瞬时不可用并出现连接拒绝。
- H2: 存在端口冲突或残留进程占用，重启后偶发绑定失败，外部表现为需要多次手动重启。
- H3: 存在连接池/句柄/内存泄漏，运行一段时间后资源耗尽，最终拒绝新连接或被系统终止。
- H4: 上游依赖（数据库、缓存、第三方 API）不可用后，应用缺少降级/保活/重连策略，引发服务假死或退出。
- H5: 运行方式缺少守护与健康检查，单次异常后无人拉起，导致长时间不可用。

## Evidence Plan
- 收集启动方式、端口配置、依赖服务配置与日志位置。
- 增加最小化运行态插桩：进程异常、内存、事件循环、连接池、端口绑定、健康检查。
- 重启并复现，记录时间点、资源、日志、端口、连接状态。
- 依据证据确认根因后做最小修复，再压测与长稳验证。

## Evidence Summary
- 2026-06-15 15:05 首次运行态采集确认：`4000/5433/6380/8001` 端口存在，Docker 依赖容器运行中，API 当前没有守护进程。
- 历史错误日志显示出现过 `Redis 6380 ECONNREFUSED`、`Prisma P1001 Can't reach database server at localhost:5433`，且发生后 API 直接退出。
- 受控复现一：在依赖容器停机状态下执行 `pnpm --filter @ai-assistant/api dev`，启动链路在 `db:ensure` 阶段直接因 `P1001` 退出，未等待依赖恢复。
- 受控复现二：依赖恢复后，`4000` 端口仍未监听，`/api/health` 连接失败，必须再次手动启动 API 才恢复。
- 插桩日志表明在依赖正常时 `bootstrap -> prisma-connect -> listen-success` 正常完成，内存心跳在短周期内稳定，无明显泄漏迹象。

## Hypothesis Verification
| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| H1 | 未捕获异常或 promise rejection 导致进程退出 | ⏳ 部分成立 | 已补充插桩，但本轮核心复现未看到业务未捕获异常；主要退出点发生在启动前置依赖校验阶段。 |
| H2 | 端口冲突或残留进程占用 | ❌ 排除为主因 | 复现时 `4000` 未被其他进程占用；服务失败来自依赖未就绪导致的启动退出，而非绑定冲突。 |
| H3 | 内存泄漏/连接池耗尽 | ❌ 当前证据不支持 | 插桩心跳显示 RSS/heap 在短时窗口内平稳，无持续攀升。 |
| H4 | 依赖服务短暂宕机后，应用缺少恢复机制 | ✅ 确认 | 停掉 Postgres/Redis 后，API 启动直接失败；依赖恢复后 API 不会自动恢复，符合“需要人工重启”。 |
| H5 | 缺少守护与真实健康检查 | ✅ 确认 | 现有 API 仅裸进程启动，无 PM2/systemd；`/api/health` 之前只返回静态 `ok`，无法反映依赖故障。 |

## Fixes Applied
- 新增 `scripts/wait-for-runtime-deps.ts`：启动前等待 `Postgres/Redis` 可连，避免依赖晚启动导致 API 直接退出。
- 加强 `scripts/ensure-db-migrations.ts`：数据库迁移失败时按次数重试，而不是首次失败即退出。
- 调整 `package.json` 与 `apps/api/package.json`：统一通过 `api:prepare` 执行“等待依赖 + 迁移”。
- 增强 `apps/api/src/main.ts`：加入进程异常插桩、资源心跳、`enableShutdownHooks()`、`SIGINT/SIGTERM` 优雅停机、HTTP keep-alive 超时配置。
- 增强 `apps/api/src/app.module.ts`：为 Redis/BullMQ 连接增加 `connectTimeout` 与重试策略。
- 增强 `apps/api/src/health.controller.ts`：新增 `/api/health/ready`，真实检查 `database/redis/sidecar`。
- 新增 `ecosystem.config.cjs` 与 PM2 脚本：提供自动重启、延迟重启、内存阈值重启。
- 新增 `scripts/monitor-runtime.ps1`：用于长周期采集健康状态、端口、资源、进程快照。

## Verification
- 验证一：`pnpm --filter @ai-assistant/api typecheck` 通过。
- 验证二：`pnpm --filter @ai-assistant/api build` 通过。
- 验证三：在依赖全停时启动 API，确认新链路进入等待状态而非立即退出。
- 验证四：在等待期间恢复 Docker 依赖，API 自动完成启动，无需再次手动执行启动命令。
- 验证五：`GET /api/health/ready` 返回 `200`，`database` 与 `redis` 检查通过。

## Remaining Long-Run Work
- 72 小时持续监控与 168 小时稳定性验证所需真实时长超出本次会话窗口，已提供监控脚本与守护配置，可直接在目标环境执行并留存证据。
