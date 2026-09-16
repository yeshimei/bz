# 356 · 归物本年度资产报告

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #9（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

仿 reading-report 范式给归物本出一页年度总结：今年购入/离场件数与金额、月度花销走势、分类占比、日均成本变化、陪伴最久的物件榜。入口 = 归物本面板 + 命令。

## Scene

年底翻开：「今年购入 23 件、转卖回血 X 元、陪你最久的是那把 2019 年的伞。」

## Acceptance

- 报告页数据全由 belongings.json 派生（不改数据）；分片渲染不卡死（reading-report 范式）
- 年份可切换；空数据空态人话
- 数据层（统计纯函数）+ UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/belongings（stats + 报告视图）、复用 core/chart-palette
- 范式参考：src/reading-report（分片渲染/骨架/取消三路收口）。
