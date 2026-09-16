# 353 · 备忘录周期性重复备忘

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #5（用户已采纳）｜ status: open ｜ assignee: — ｜ blocked-by: —

## What

备忘录条目支持重复周期（每周/每月/每年，或自定义 N 天）：完成或到期后自动生成下一期条目（带来源标记）。数据加可选 `recur` 字段，零迁移兼容旧条目。

## Scene

每周五交周报、每月 1 号换净水器滤芯、每年 6 月续保险——设一次，到期自己回来。

## Acceptance

- 三种基础周期 + 完成后自动重生下一期（保留场景/优先级/关联笔记）
- 周期条目列表有可视标记；可随时停止重复
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/memo（data.ts schema、完成链路）
- 与 354（清单型）、355（月历）同动 memo.json，建议串行开发、一次设计好 schema 演进。
- 若 schema 变更大，考虑 ADR。
