# 358 · 剪藏本阅读报告

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #18（用户已采纳）｜ status: closed ｜ assignee: dev ｜ blocked-by: —

## What

剪藏本一直在累计阅读时长但无出口。仿 reading-report 出一页「我读了什么」：周/月阅读篇数与时长、来源分布（站点/UP/订阅源）、阅读时段分布、读完率。入口 = 剪藏本左栏既有「阅读分析数据」位（现深链 reading-report 书库报告，需理清两报告的关系或并列）。

## Scene

月底一看：「这个月读了 87 篇，知乎日报占一半，周三晚上是阅读高峰。」

## Acceptance

- 数据由 clipbook.json/stats 侧写派生（阅读时长已有收集，先核对字段完整度）
- 周期切换（本周/本月/自定义）；空态人话
- 数据层（统计纯函数）+ UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/clipbook（stats 收集链路、报告视图）、范式参考 src/reading-report
- 注意与书库阅读报告入口的关系（rail 底部现有入口跳书库报告）——入口规划在 spec 里定。

## Resolution

✅ 已交付：commit `866b5213`（2026-09-17，全量门禁绿，随 2b2fdbbc 部署）。

周期口径回填（秋季批审查 2026-09-17）：Acceptance 写「周期切换（本周/本月/自定义）」，首版实交**本周/本月两档**；「自定义区间」列为**二版候选**（区间起止选择器，等真实使用反馈再定形态），首版不做。
