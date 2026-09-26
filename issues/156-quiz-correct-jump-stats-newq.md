# 156 — 做题家：答对 0.8s 亮绿跳题 + 去右上角统计 + 逾期复习出新题

**状态**：✅ 已完成

## 用户拍板

> 选对答案等待 0.8 秒自动转跳到下一题
> 去掉右上角的对错题统计
> 如果做错题，到下个逾期复习时题是上次的错题，应该是新题

## 改动（src/quiz/ui.ts + styles.css + src/review/app.ts + tests/{quiz,review}）

- **0.8s 延时跳题**：`_answerCorrect` 持久化成功后不再立即 `showQuestion()`，改 `CORRECT_JUMP_DELAY_MS=800` 定时后跳——正确选项亮绿给足反馈。竞态防护：`_jumpTimer` 句柄，`finishQuiz` 确认放弃 / `close()` 强制关闭时清除，回调内再校验 `_sessionActive` 防迟到渲染僵尸题弹窗。
- **去右上角统计**：删 `renderModal` 的 `.bz-quiz-stats` 元素、`_statsEl` 字段、`_syncHeaderStats()` 及全部调用点与样式规则；结算面板统计（`_buildResults`）保留不动。
- **逾期复习出新题**：`batchGenerateQuestions` 改「先清后生」——逐笔记 `saveQuestionsForNote(app, path, [])` 清掉上轮残留（答错的题仅移出会话、留在 quiz.json，旧逻辑 `ensureQuestions` 见有题就不重生成 → 错题原样重考），再 `ensureQuestions` 全新生成；对齐待重做队列 `regenerateQuestions` 范式。
- 测试：quiz/ui.test 答对类用例全部补 0.8s 延时等待（`flushJump`）并改断言（延时窗口内停留当前题、统计元素已删）、新增「延时期间放弃做题不渲染僵尸弹窗」竞态用例；review/app.test 批量出题用例补 `saveQuestionsForNote` 桩并断言先清空。

## 验收

- tests/quiz + tests/review 187 用例全绿；tsc 0 错。
- 行为：答对亮绿 0.8s → 自动下一题；头部无 ✅/❌ 统计；下个逾期复习不再复现上次错题。
