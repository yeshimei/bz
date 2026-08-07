# 05 — 备忘录·高级（AI 推荐/URL 提取/长按编辑）

**What to build:** 备忘录高级交互：AI 场景推荐、URL/页面标题提取、从当前笔记创建、长按 #标签 编辑。

**Blocked by:** 04（备忘录基础）

**Status:** ready-for-agent

- [ ] AI 推荐场景+优先级：ai.chat(prompt) → JSON {scene, priority}（priority 仅「重要」/「次要」）；按钮 `#add-todo-ai-recommend`、加载态「⏳ 推荐中...」、失败降级提示「AI 推荐失败，请手动选择」
- [ ] 粘贴/输入 URL 自动提取页面标题（fetchPageTitle/extractUrlAndDisplay）、剪贴板焦点处理（clipboardFocusHandler）
- [ ] 从当前笔记（📌 笔记名）或光标选中内容创建待办（getCurrentNoteInfo/getCurrentCursorPosition）
- [ ] 长按 #标签 编辑待办全部信息（内容/场景/优先级等）；公开课场景标签不重复显示
- [ ] 课程字段（courseInput，学习/公开课场景）
- [ ] 测试：AI 推荐 mock fetch（成功/失败降级）、URL 提取、从笔记创建
