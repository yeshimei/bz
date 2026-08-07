# 09 — 聚合讯

**What to build:** 新闻聚合阅读流完整移植：逐篇阅读、抓取、统计、已读/跳过、剪藏保存、dataviewjs 写入。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 逐篇阅读流（非列表）：单篇渲染（news-card-header/title/meta + platform-pill 平台徽章、👤 作者/📅 日期）、全部读完显示完成态（renderDoneState）
- [ ] 阅读器打开/关闭（ESC/遮罩）、注入样式（≈196 行收敛 styles.css）
- [ ] 已读（markAsRead）/跳过（skipArticle）/检查新文章（checkNewArticles）/剪藏保存（saveToClip → 归档/网页剪藏，失败提示「❌ 保存失败」）
- [ ] 统计：news-stats.json 读写（{totalRead,totalSaved,totalSkipped,byPlatform,byDate}，recordStat/loadStats/saveStats）
- [ ] dataviewjs 代码块写入笔记（`await dv.view('CONFIG/SCRIPTS/DataView/摘要')`），保留由 Dataview 插件渲染（ADR-0005）
- [ ] 命令 `news-reader-open` 注册（含防重标志语义）+ 剪藏本互调
- [ ] 测试：阅读流状态机（读/跳过/完成态）、统计落盘、代码块生成
