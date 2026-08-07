# 20 — 端到端验收（对照原宏全量）

**What to build:** memo-suite 全 15 域对照原 QuickAdd 宏的逐项验收——UI 与逻辑逐字一致、数据零迁移、可回退。

**Blocked by:** 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19

**Status:** ready-for-agent

- [ ] 15 域面板外观与交互逐项对照原宏验收（用户操作验证）：备忘录（CRUD/AI 推荐/置顶提醒）、归物本、密码本（主密码/生成器）、剪藏本、聚合讯、收藏本（置顶/余额）、书库（笔记弹窗）、阅读报告、影视（AI 推荐/自动刷新）、影视数据分析、自动摘要、复习计划（FSRS/评级）、做题家（答题/替换）、闪念（窄窗/Ollama 检索）、AIAgent（同步/批准）
- [ ] 数据零迁移验证：memo.json/quiz.json/review.json/favorites.json/news.json/news-stats.json/归物本/密码本数据文件全部原位置原格式读取
- [ ] 命令全量可用：27 命令裸注册、互调链（剪藏本→news-reader-open、书库→show-reading-report、影视→movie-analysis-open、复习→quiz-master-*）逐一验证
- [ ] 常驻域按设置开关工作：自动摘要新文件触发、AIAgent 同步、闪念监听
- [ ] 降级链验证：无 AI key/无 Ollama/无 Dataview 时各域优雅降级
- [ ] 回退验证：禁用插件后 QuickAdd 宏照常可用
- [ ] 用户逐域签字确认，spec 关闭
