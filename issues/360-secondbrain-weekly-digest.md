# 360 · 第二大脑每周知识摘要

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #27（用户已采纳）｜ status: closed ｜ assignee: dev ｜ blocked-by: —

## What

利用索引增量与自动关联数据，每周生成一页「本周知识库动态」：新增笔记数、新增关联数、主题撞车提示（哪几篇与既有内容高度重合，附跳转）。呈现形态（通知附入口 / 面板页签 / 生成 md 笔记）在 spec 阶段定。

## Scene

周日晚看到：「本周新增 14 篇，其中 3 篇与既有笔记高度重合，点击查看。」

## Acceptance

- 每周自动跑一次（静默，无新内容不打扰）；可手动触发
- 撞车判定复用向量近邻（阈值口径进 spec）
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/secondbrain（vector-store/link 段、meta 段时间戳）
- 注意成本控制：摘要聚合优先用本地数据，AI 文案生成可选。

## Resolution

✅ 已交付：commit `7e9d00d7`（2026-09-17，全量门禁绿，随 2b2fdbbc 部署）。
