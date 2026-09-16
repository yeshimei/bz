# 354 · 备忘录清单型子任务

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #6（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

一条备忘可挂多个勾选项（子任务），composer 用约定语法快速录入（如「筹备旅行 /订机票 /订酒店」），列表显示进度（2/3）。

## Scene

「筹备旅行」下面挂：订机票 ☑、订酒店 ☐、办签证 ☐，看一眼知道办到哪了；全勾完父项自动完成。

## Acceptance

- 子任务增删勾选、父项进度展示、全勾自动完成（可配置？）
- composer 录入语法 + 编辑弹窗支持改子任务
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/memo（data schema + composer + 列表渲染）
- 与 353 同动 memo.json，串行开发。
