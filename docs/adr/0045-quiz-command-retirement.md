# ADR-0045：做题家命令入口退役（bz-quiz-open / bz-quiz-update 删除注册）

日期：2026-08-25 ～ 状态：Accepted ～ 关联：ticket 098、ADR-0004（命令裸注册无前缀/无热键）、铁律 2（命令注册单点，id 为外部裸调用约定）

## Context

做题家（quiz 域）原有两个命令入口：`bz-quiz-open`（做题家面板）与 `bz-quiz-update`（更新题库）。grilling 会话初议「checkCallback 隐藏命令」方案（注册但不出现在命令面板），用户追问后翻盘拍板：**删除注册，更简单更直观**——命令面板、热键、程序调用（`executeCommandById`）全部不可达，id 契约正式退役。

## Decision

1. `bz-quiz-open`、`bz-quiz-update` 从 `src/main.ts` COMMANDS 表**删除**（不再 addCommand；卸载 removeCommand 列表自然失效）。
2. 复习面板 🎯 图标（`review-btn-quiz`，原调 `executeCommandById('bz-quiz-open')`）删除。
3. 打开复习面板的自动更新题库由 `executeCommandById('bz-quiz-update')` 改为**模块直调** `quizUpdate(app)`（不着命令层，行为不变）。
4. 入口页（launcher.json）中的 `bz-quiz-open` 磁贴清除（用户点头，部署时一次性处理）。
5. 做题家降级为复习流程内部引擎：仅「做题决定难度」开启、点「开始复习」时经 `quizReviewLoop`/重做队列驱动；quiz.json 数据格式与 `startReviewSession`/`endReviewSession` 联动契约不动。

## Options

- **O1 checkCallback 隐藏（注册但 checking 恒 false）**——命令面板隐藏、id 仍可编程调用、launcher 磁贴不幽灵化。用户明言「删掉注册命令吧，更简单更直观」——接受契约破坏换取彻底性。
- **O2 保留注册但提示用户手动在命令面板设置里禁用**——❌ 不可控（Obsidian 无程序化「隐藏命令」；依赖用户手动操作，新装/重置即暴露）。

## Consequences

- 外部裸调用 `bz-quiz-open`/`bz-quiz-update` 的第三方（含旧入口页磁贴、旧脚本）将失效——铁律 2 明文破约，本次经用户拍板放行。
- `tests/smoke.test.ts` 命令全集、README 命令表同步删改。
- 做题会话、批量出题、quiz.json 读写全部保留（内部契约），无数据迁移。