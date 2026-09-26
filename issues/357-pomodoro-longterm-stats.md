# 357 · 番茄钟长期专注统计

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #11（用户已采纳）｜ status: closed ｜ assignee: dev ｜ blocked-by: —

## What

history 落盘前裁到 7 天的既有拍板保留；裁剪时先把离开的周聚合成「月归档行」（周粒度聚合：总分钟/次数/任务分布）存独立段或独立文件。统计视图加「近 N 月趋势」，月行 + 近 7 天明细两档。

## Scene

月底回顾：「9 月共专注 41 小时，比 8 月多 6 小时。」

## Acceptance

- 旧 7 天裁剪行为不变；新归档行自动累积（零迁移，首月起算）
- 统计视图月趋势呈现（柱/线）；数据层纯函数可测
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/pomodoro（data.ts trimHistory、stats.ts）
- 不改「只留 7 天明细」的既有决策，只加归档层——ADR 记一笔即可。

## Resolution

✅ 已交付：commit `e23da635`（2026-09-17，全量门禁绿，随 2b2fdbbc 部署）。
