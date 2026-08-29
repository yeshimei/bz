# 153 — 修复：通知「去复习」不走做题流程 + 做题答对自动跳下一题

**状态**：✅ 已完成

## 现象（用户实测）

① 逾期提醒通知里的「去复习」按钮，点击后**只打开最早逾期笔记**，不会按复习计划设置
「用做题测难度」（forceQuizForReview）走进做题流程。

② 做题时答对一道题后，仍需手动点击「下一题」按钮才进入下一题——期望**答对直接自动跳下一题**，
只有答错时才出现「下一题」按钮。

## 根因

- **通知「去复习」**（src/review/app.ts `checkOverdueAndNotify`）：ticket 58 的 action 是
  `leaf.openFile(最早逾期)` 单篇裸跳，绕过了 `autoJumpOverdue()` 的完整分流（做题决定难度
  开启 → 批量出题做题；关闭 → 普通复习跳转笔记）。
- **做题跳题节奏**（src/quiz/ui.ts）：ticket 141 把答对后的自动跳题改成「用户点按下一题按钮
  掌控节奏」，答对/答错都挂按钮。用户拍板恢复：答对即自动进入下一题。

## 修复（Ticket 153）

- **review/app.ts**：`checkOverdueAndNotify` 的通知「去复习」action 改调
  `reviewApp.autoJumpOverdue()`（统一开始复习流程，按 forceQuizForReview 分流）；
  删除单篇 openFile 跳转与 earliest 目标计算（通知名单仍按 newly diff 记忆去重，语义不变）。
- **quiz/ui.ts**「作答节奏」：
  - 答对（单选/多选）：`_answerCorrect` 持久化成功后直接 `showQuestion()` 自动进入下一题，
    不再挂「下一题」按钮；
  - 答错：保留「下一题」按钮（用户点按 / Enter 进入）；
  - 删除 `_enableNextButton`/`_removeNextButton`/`addNextButton` 的 disabled 占位参数
    （仅答错需按钮，无挂起解锁语义），同步删 styles.css `.quiz-next-btn--pending`。

## 验收

- review/app.test.ts：ticket 58 两用例改写为 Ticket 153 语义——「去复习」触发
  `autoJumpOverdue`（spy 断言 1 次）且不再裸开单篇（openFile 不被调用）。
- quiz/ui.test.ts：答对类用例改断言「无下一题按钮 + 自动进入下一题/自动完题回调」；
  答错类保留「下一题按钮」断言；新增键盘 Enter 答错跳题用例。
- tsc 0 错误 + 全量测试 3536 全绿 + 构建通过。