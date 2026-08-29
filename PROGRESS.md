# PROGRESS — 包仔（bz）插件开发进度

> 进度同步总表（AGENTS.md）。每票一节，状态：计划中 → 进行中 → 门禁 → 已交付。

## Ticket 136 — 文献盒改版（literature 域 / 术语生成 / AI 回迁 / 去网页版）

**状态：门禁（终审中）**

- [x] 设计定稿（grill-with-docs 五轮拍板，契约见 `issues/136-literature-box-redesign.md`）
- [x] 文档：ADR-0071（AI 回迁+去网页版）/ ADR-0072（新域迁出+literature.json）/ ADR-0073（type+domain）
- [x] CONTEXT.md 词条更新（文献盒/B站下载/快速流程/文献笔记/文献类型/领域/术语文献/文献目录）
- [x] Worktree A `worktree/tools-literature`：CLI 去 AI 去网页版、转录临时文件、压缩步骤 → 已合并 master（531bcd2）
- [x] Worktree B `worktree/literature-domain`：src/literature 域全量实现 + 集成 + 测试 + 构建
- [x] 合并回 master：feature 4 提交 rebase 后快进合并（master a9f9d15）
- [x] 全量测试 218 文件 / 3450 用例绿 + tsc 0 错 + 构建通过 + 部署产物与仓库一致
- [x] 命令：bz-literature-open（文献盒）/ bz-literature-note-term（术语生成文献笔记）；移除 bz-bili-open / bz-bili-tasks-open
- [ ] 终审（独立 review 子代理 + 自审，P1/P2 修复后收口）
