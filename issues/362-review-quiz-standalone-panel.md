# 362 · 做题家独立面板

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #29（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

AI 出题做题引擎（quiz-core）现在只能从复习流程内进；给独立入口与面板：选题范围（全部/文件夹/单篇）、出题批量、答题会话（沿用 1-4 键盘化、跳过回队尾契约）、成绩小结。

## Scene

考试周想专门刷题不排期复习，直接开做题面板刷一小时。

## Acceptance

- 新命令 `bz-review-quiz-open`（或按命令命名惯例定名）+ 面板（桌面/移动）
- 会话契约 startReviewSession/endReviewSession 沿用，行为流事件接入
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/review/quiz-core/（引擎不动，做壳）、src/main.ts 命令注册
- AI 未配置时的降级提示（现在依赖在线 AI 出题）口径进 spec。
