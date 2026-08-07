# 14 — 影视

**What to build:** 影视管理器完整移植：面板、状态筛选、排序、无限滚动、添加/编辑（frontmatter）、海报、AI 推荐、自动刷新。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 面板 + `我的/影视` frontmatter 读写（fileManager.processFrontMatter；字段含 name/type/status/rating/douban/watchDate/tags/海报 等，实现时对照源码）；条目字段全集以影视数据分析的 48 聚合字段为准
- [ ] 三状态（STATUS_WANT 想看/STATUS_WATCHING 在看/STATUS_WATCHED 已看）+ 状态色 + 类型标签胶囊按钮组（ALL_TAGS + TYPE_GROUPS/TYPE_COLORS，实现时从源码复制完整列表）
- [ ] 排序三键（date 含 watchDate 无日期排后/rating/name）+ 搜索（toggleSearch）+ 无限滚动（setupInfiniteScroll「滚动加载更多...」）
- [ ] 添加/编辑弹窗（名称/类型选择/状态/评分/日期/海报等，prefill 预填）+ 星级评分（getStarRating）
- [ ] vault modify/create/delete 三事件自动刷新（registerAutoRefresh）+ PROCESSING_FILES 防重入
- [ ] AI 推荐：buildTasteProfile（口味画像「🧠 正在分析你的观影历史…」）→ buildRecommendPrompt → parseRecommendJson → openRecommendModal（导演：/加入想看 quickAddWant 预填）→ ⚠️ 解析失败/❌ 生成失败提示
- [ ] 设置：folderPath/pageSize（📄 每页加载数量）/enableQ3/posterFolder；命令 `movie-manager-open`/`movie-manager-add` 裸注册；changelog 'movie'
- [ ] 测试：frontmatter 解析/排序/状态筛选/无限滚动/AI 推荐 mock
