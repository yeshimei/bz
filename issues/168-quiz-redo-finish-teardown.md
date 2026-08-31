# Ticket 168 — 重做终局点「完成复习」遮罩残留卡死

## 背景

做题家（quiz）复习的**重做队列**（ADR-0044）走 `redoReviewLoop`：最后一篇通过后结果卡只保留「完成复习」按钮，点击仅 `resolve` 外层 Promise、**不调 `quiz.endReviewSession()`**——而 `endReviewSession` 是唯一触发 `_teardownModal()` 拆除 `#quiz-mask` DOM 的入口。残留遮罩遮挡全屏，其 click 处理 `e.target === mask → finishQuiz()` 又因 `onComplete` 已置 null（`ui.ts:461-463`）永远 return——点击遮罩/ESC 均无反应，面板永不关闭（卡死）。对照普通复习 `quizReviewLoop` 终局显式调 `endReviewSession`，重做路径缺失。

## 实现

- `src/review/app.ts` `redoReviewLoop` 终局分支（isLast）：「完成复习」（`#quiz-next-note`）点击从 `resolveAction('next')` 改为 `resolveAction('end')`，与「结束这次复习」同走 `quiz.endReviewSession()`（拆遮罩收尾）+ `resolve(passed)`——**终局完成仍返回通过集**（调用方 `autoJumpOverdue` 依赖返回集继续逾期流程），中途「结束」才返回 null。
- 测试 `tests/review/app.test.ts`：
  - `makeQuizMock().endReviewSession` 由空实现改为真实拆 DOM（对齐 `close` 行为）——此前空实现令 bug 在测试中不可见；
  - 终局测试补断言：点「完成复习」后 `quiz.popup`/`quiz.mask` 均为 null（遮罩拆除）。

## 门禁

tsc 0 错；全量 222 文件 3581 用例绿；构建部署通过。
