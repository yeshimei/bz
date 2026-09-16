# 352 · 日记本「那年今天」放开文字条目

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #1（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

首页/日记本的「那年今天」时光条现在只挑有照片/视频/音频的媒体条目；放开为纯文字日记也进入回顾流（文字块卡样式与媒体卡区分）。

## Scene

早上翻开日记本，「三年前的今天」除了照片，还有当时随手写的一段心情。

## Acceptance

- 纯文字条目出现在「那年今天」横滑条，与媒体卡视觉可区分
- 数据层 + UI 层测试 + smoke.test.ts 同步
- 门禁全绿：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建

## Notes

- 相关：src/diary（时光条数据源）、src/home
- 动工前：更新 spec.md、本票 assignee 认领；worktree 开发。
