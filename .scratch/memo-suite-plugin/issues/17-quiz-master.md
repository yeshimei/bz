# 17 — 做题家

**What to build:** 统一题库做题系统完整移植：题库管理、答题流程、AI 出题、完成替换笔记、与复习联动。

**Blocked by:** 16（复习计划——联动共用）

**Status:** ready-for-agent

- [ ] quiz.json 读写（`{notes: {notePath: [question]}}`；题目 = {question, options, correctIndices, notePath, _index}）+ QuizManager（loadQuiz/saveQuiz/removeQuestion）
- [ ] 答题流程：题目展示 → 提交答案（「提交答案」）→ 下一题（「下一题 →」）；单选题（四选一）/多选题（正确选项不限）；错误选中变红、正确项标注
- [ ] AI 出题：3 难度提示词（基础概念/中等/高难度推理交叉）、批量出题失败降级逐篇、AI 服务未初始化提示（「⚠️ AI 服务未初始化，无法生成题目。请先运行 Q3.js。」）
- [ ] 完成状态记录；全完成的笔记自动替换内容
- [ ] 设置：enableMultipleChoice/questionsPerNote/difficulty
- [ ] 命令 `quiz-master-open`/`quiz-master-update` 裸注册；复习计划互调可用
- [ ] 测试：题目状态流转/多选判定/全完成替换/AI 出题 mock
