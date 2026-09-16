# 355 · 备忘录月历视图

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #7（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

备忘录加月历视图页签：按 due 把到期事项标在日历上（点日期看当日清单，支持拖动/菜单顺延到别的日期）。

## Scene

月底要交三份材料，打开日历一眼看到哪天挤、哪天空；把顺延的操作直接在日历上做。

## Acceptance

- 月历网格 + 到期标记（ overdue/today/future 沿用现有状态色）+ 点日查看
- 桌面面板与移动端均可切换（移动端布局按项目全屏范式）
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/memo（新视图层，复用 core/ui 组件库）
- 与 353/354 串行；样式遵守组件库 token、不自造滚动条。
