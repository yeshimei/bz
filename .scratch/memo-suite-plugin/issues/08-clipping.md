# 08 — 剪藏本

**What to build:** 剪藏文章展示面板（`我的/文章`）完整移植：站点栏、搜索、排序、双击跳转、长按删除、反链显示、自动刷新。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 面板（article-view-popup/mask/search-container）+ 头部（标题/关闭）+ 站点栏（createSiteBar/rebuildSiteBar/updateSiteButtons 单选）
- [ ] 文章解析：frontmatter 必需 link+created（缺任一跳过）、title=文件名；卡片显示标题/作者（✍️）/反链笔记名（📌 去《》书名号）
- [ ] 搜索（每批加载数量 batchSize 设置）、排序（时间倒序）、双击跳转（openLinkText）
- [ ] 长按删除（longPress + 删除确认弹窗「确认删除」）
- [ ] vault modify 监听自动刷新（attachFileListener）；数据为空自动重新加载
- [ ] 滚动到底加载更多（initScroll）、空态「暂无文章」、加载态「📚 正在加载文章...」
- [ ] 命令 `article-open-view` 裸注册；changelog 'article'
- [ ] 测试：parseArticleFile（必需字段/反链）、UI jsdom、modify 事件触发
