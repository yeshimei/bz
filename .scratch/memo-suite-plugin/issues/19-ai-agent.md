# 19 — AI Agent

**What to build:** 笔记 ⇄ 备忘录/收藏本 自动同步 + AI 剪藏匹配完整移植。

**Blocked by:** 04（备忘录）, 11（收藏本）, 03（AI）

**Status:** ready-for-agent

- [ ] vault rename/delete/create/open 监听（inWatchedFolders 监听范围检查，ALLOW_PATHS 语义）
- [ ] 同步：rename → 引用路径/标题更新（syncRename，memo + favorites）；delete → 清空关联（syncDelete）；create/open → 同名自动关联（syncAutoLink，仅 favorites）
- [ ] 任务队列（enqueue 顺序执行，防并发冲突）
- [ ] AI 剪藏匹配：URL 精确匹配直接归档（archiveItem）；不中 → AI 判断（ai.json → {match, itemId}，max_tokens 200 + response_format）→ 弹窗批准（showClipConfirmDialog）→ 归档到备忘录/收藏本
- [ ] 权限模型：非 AI 操作静默直改；仅 AI 剪藏匹配弹窗批准
- [ ] 测试：rename/delete 事件同步断言、队列顺序、AI 匹配 mock（命中/不中/批准）
