# Ticket 115：第二大脑存量笔记启动自动补链 + 批量补链命令

- 状态：已完成（master 1975912；合并后全量 2708 用例复核绿 + tsc 0 + 构建部署验证）
- 域：secondbrain
- 设计文档：`.scratch/secondbrain-link-agent/spec.md`（v1.1 增量节「①b 存量补链」/ 手动命令 / 验收标准）
- 前置：ticket 111（自动双链管线，本票在其 link-agent 模块上叠加）

## 背景

ticket 111 v1 的自动建链只在「新文件落盘到关联范围目录」时触发，库里已有的大量存量笔记永远不会被自动处理；且候选与监听都局限在 `linkAgentScopes`（默认仅「文献盒」）。实际运行库中文献盒只有 1 篇笔记、全库 0 条 related 连接——用户希望「每次启动软件自动做」，并保留手动兜底命令。

## 任务清单

1. **数据层**：`computeBackfillTargets` 纯函数——目标清单 = scope 内 md、剔除已含 related（`related` 即进度检查点，中断续跑天然增量）、范围外、encrypt 锁定、队列内待重试条目；字典序稳定输出、去重；
2. **管线**：`LinkAgent.backfillMissingLinks`——开关门 → 可达性探测（不可达返回 `unreachable` 静默待下次启动）→ 计算目标（从 vault/metadataCache/encrypt 边界/队列翻译谓词）→ `processBatch(targets, { assumeReachable: true })`；`processBatch` 增加全局串行锁（与监听批次排队互斥，杜绝并发 refresh/AI 裁判）；
3. **接线**：`watch.ts` 增 `startStartupBackfill`（等待索引装载后执行、静默处理结果）；`index.ts` 在 `linkAgentEnabled` 分支把「队列消费 → 存量补链」依序串行执行；
4. **命令**：`bz-secondbrain-link-all`（批量补链，即启动路径的显式兜底），按结果通知：完成（处理 N 篇 / 新建 M 条）/ 未发现实质关联 / 无待补链 / embedding 不可达 / 开关已关闭；
5. **测试**：数据层（目标清单筛选/去重/字典序）+ UI/通知层（补链可达 done 汇总 / 不可达 / 全已连接 no-targets / 队列排除 / 串行锁并发不重叠 / 命令五分支）+ smoke 新命令 id；
6. **文档**：spec v1.1、CONTEXT.md 第二大脑词条、PROGRESS.md。

## 边界

- 与 v1 一致：只写新笔记侧 `related`；encrypt 锁定文件跳过；候选仍按 `linkAgentScopes` 过滤；
- 启动路径静默（unreachable / no-targets 不打扰）；批次进度与汇总 toast 复用既有语义（N=0 静默）；
- 不做正文大改重跑（大改靠 `bz-secondbrain-rebuild-links` 逐篇）。

## 验收门禁

- [ ] spec「验收标准」v1.1 项全过
- [ ] `pnpm test` + `pnpm exec tsc --noEmit` 全绿
- [ ] 构建验证通过，产物部署后真机冒烟（启动自动补链 / 手动命令兜底 / 断网静默下次补）