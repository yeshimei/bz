# 15 — 影视数据分析

**What to build:** 影视数据分析弹窗完整移植：聚合统计、7 种图表组件、评分分桶、10 组分析配置。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] buildAnalysisData 聚合（48 字段：total/watched/watching/want/rating/douban/groups/tags/years/months/buckets/genres/countries/directors/actors/topRated/wantList/age/eras/durBuckets/weekdays/diff/treasure/disappoint/reviewKeywords/series/wantDouban/wantTags/yearRating 等）
- [ ] 图表组件：statCardHTML（统计卡片）/barChartHTML（条形图）/donutChartHTML（环形图）/softBarHTML/topListHTML（排行榜）/ratingCompareListHTML（评分对比）/statInlineHTML
- [ ] 评分分桶（ratingBucketOf 6 档：≥5.5/5~5.5/4~5/3~4/2~3/<2）+ 空态（emptyHTML）+ ESC 关闭
- [ ] 10 组分析配置设置项（groups/buckets/genres/ageBuckets/eras/durBuckets/groupDur/reviewKeywords/series/yearRating）
- [ ] 命令 `movie-analysis-open` 裸注册；影视互调可用；「请先在命令面板运行一次」提示语义保留
- [ ] 测试：聚合口径抽样断言 + 图表 HTML 生成
