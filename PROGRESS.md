# PROGRESS — 包仔（bz）插件开发进度

> 进度同步总表（AGENTS.md）。每票一节，状态：计划中 → 进行中 → 门禁 → 已交付。

## Ticket 136 — 文献盒改版（literature 域 / 术语生成 / AI 回迁 / 去网页版）

**状态：进行中（多 worktree 并行）**

- [x] 设计定稿（grill-with-docs 五轮拍板，契约见 `issues/136-literature-box-redesign.md`）
- [x] 文档：ADR-0071（AI 回迁+去网页版）/ ADR-0072（新域迁出+literature.json）/ ADR-0073（type+domain）
- [x] CONTEXT.md 词条更新（文献盒/B站下载/快速流程/文献笔记/文献类型/领域/术语文献/文献目录）
- [ ] Worktree A `worktree/tools-literature`：CLI 去 AI 去网页版、转录临时文件、压缩步骤（子代理 A）
- [ ] Worktree B `worktree/literature-domain`：src/literature 域全量实现 + 集成 + 测试 + 构建（子代理 B）
- [ ] 合并回 master + 全量测试 + 构建部署
- [ ] 门禁：pnpm test + tsc --noEmit + 构建验证 + 自审 + diff 审查
