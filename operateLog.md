# 操作日志

- 时间：2026-05-08（会话内）
- 操作类型：修改
- 影响文件：`apps/api/src/chat/chat.service.ts`、`apps/api/src/ai/prompts/prompts.service.ts`
- 变更摘要：增加对话轨/知识轨分类与双轨提示词，对话轨在低检索置信度时用模型生成友好回复，命中检索时用可选参考资料而非「仅知识库」强约束。
- 原因：减轻纯 RAG 拒答带来的呆板感，同时保留知识轨下的强事实约束。
- 测试状态：待测试（已跑 `pnpm exec tsc --noEmit -p apps/api`）

- 时间：2026-05-08（会话内）
- 操作类型：修改
- 影响文件：`apps/api/src/chat/chat.service.ts`
- 变更摘要：扩展对话轨判定（致谢口误「没谢…」、含「的帮助」短句、`我想要…` 类无业务词短句），并抽出 `hasStrongBusinessSignals` 复用。
- 原因：避免截图类场景被误判为知识轨导致固定「知识库无资料」拒答。
- 测试状态：待测试（已跑 `pnpm exec tsc --noEmit -p apps/api`）
