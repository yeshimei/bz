# 361 · 复习拟合放开全部 19 参数

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #28（用户已采纳）｜ status: closed ｜ assignee: dev ｜ blocked-by: —

## What

FSRS 自动拟合现在只调 w[0..7] 八个参数；放开到全部 19 个。保留数据量门槛（现 ≥300 条全参），不足时降级拟合子集；拟合结果落 review-fit.json 的契约扩展版本号。

## Scene

用半年后系统学出个人记忆曲线的完整形态，排期更贴身（如「你的困难度分化比默认陡」）。

## Acceptance

- 19 参数拟合收敛（优化器性能可接受，必要时迭代上限/早停）
- 数据门槛分档：<300 维持现状，≥300 全参
- 拟合纯函数测试（含降级路径）+ 门禁全绿

## Notes

- 相关：src/review/fit.ts、fsrs.ts
- 纯数据层为主，UI 只需在统计弹窗展示当前拟合档位。
- 纯数据层测试首行加 // @vitest-environment node。

## Resolution

✅ 已交付：commit `45b1438f`（2026-09-17，全量门禁绿，随 2b2fdbbc 部署）。
