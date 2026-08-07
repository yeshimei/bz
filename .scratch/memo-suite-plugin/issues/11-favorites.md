# 11 — 收藏本

**What to build:** GitHub 收藏管理器完整移植：CRUD、置顶、AI 生成标题/简介、余额查询、大模型配置。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 面板 + favorites.json 读写（13 字段：id/tags/title/description/pinned/url/balance/balanceCacheTime/balanceError/linkedNote/created/type/llmConfig）零迁移
- [ ] 收藏新增/编辑/删除、置顶（📌 置顶）、标签 emoji 显示、空态「暂无收藏 🎉」
- [ ] AI 生成标题/简介（ai.json → {title,description}，简介≤50 字）；失败降级；加载态「⏳ AI 整理中...」
- [ ] 余额查询：API Keys（每行一个，第一个用于余额查询）/余额查询 URL（完整 URL）/自动从返回对象查找余额数字；状态机（查询中/刷新中/❌ 错误）+ 刷新
- [ ] 🧠 大模型配置弹窗（API Keys 输入）
- [ ] 命令 `favorites-open-panel`/`favorites-add-item` 裸注册
- [ ] 测试：CRUD/置顶排序/余额状态机（mock fetch）
