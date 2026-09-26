# Ticket 166：开始复习抓题出现两条动态通知

## 需求

备忘（todo-1788083221627-4jpxfz，场景「做题家」）：「开始复习抓题出现两条动态通知，只保留『正在为 2 篇笔记批量生成题目…』」。

## 根因

「开始复习」（开启做题决定难度）时两条 progress 框并存：

1. `src/review/app.ts:206`：`notify('正在批量生成题目…', { dedupeKey: 'review-generate' })` —— 复习域外层总揽框
2. `src/quiz/ui.ts:139`：`notify('正在为 N 篇笔记批量生成题目…', { dedupeKey: 'quiz-generate' })` —— 做题家域内层框

两个 dedupeKey 不同（`review-generate` ≠ `quiz-generate`），通知去重机制（`notice.ts:368-385` 按 key 合并）不生效，于是两条 progress 常驻框叠在一起。

## 改动

- `src/review/app.ts:206`：`dedupeKey: 'review-generate'` → `'quiz-generate'`，与 quiz 域内层框同键。
  - 复习域外层框先弹 → quiz 内层框同键触发 → 原地合并更新文案为「正在为 N 篇笔记批量生成题目…」→ 只剩一条。
  - 复习域成功收尾 `h.setMessage('题目已生成，开始做题复习')`、失败降级 `h.setMessage('批量出题失败，改用普通复习')` 行为不变。
  - quiz 域逐篇降级路径（`ui.ts:154/180`）共用 `'quiz-generate'` 键，行为不变。

## 测试

- `tests/review/app.test.ts` 断言的是「批量出题失败，改用普通复习」（与 key 无关）；`tests/quiz/ui.test.ts` 无「正在为」文案断言；`tests/core/notice.test.ts` 的 dedupe 用例不涉及业务 key——改动无测试破坏。
- `pnpm exec tsc --noEmit` 0 错；全量 221 文件 3563 用例绿；构建通过，产物已同步仓库根目录与 E 盘

## 状态

- [x] 实现（review/app.ts dedupeKey 统一）
- [x] tsc + 全量测试 + 构建验证
- [x] 部署产物同步
