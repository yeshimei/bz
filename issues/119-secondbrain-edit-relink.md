# Ticket 119：正文大改自动重跑（v1.4，用户拍板）

- 状态：已实现（worktree/t119-edit-relink）
- 域：secondbrain
- 来源：双链体验优化讨论，用户拍板：「记录第一次向量后的文件，如果改动笔记后，再次向量的文件有变化才走查新索引」
- 关联：issues/111（管线）、issues/115（存量补链）、`src/secondbrain/link-agent/{data,pipeline,watch}.ts`、`.scratch/secondbrain-link-agent/spec.md` v1.4

## 背景

v1 只监听「新笔记落盘」+ 启动补缺 `related` 的存量笔记；**已连接笔记正文大改后旧链永不更新**，只能靠手动 `bz-secondbrain-rebuild-links`。用户拍板做「正文大改自动重跑」，并给判定机制：「记录第一次向量后的文件，改动后再向量化的文件有变化才走查新索引」——即用**内容哈希**做基准，内容实质变化才重跑。

## 设计

- **基准哈希**：新状态文件 `CONFIG/STORAGE/secondbrain_link_state.json` 记录每篇**最近一次成功建链时**的全文内容哈希（`{ path: { hash, linkedAt } }`）；写入后记录（含本次 related 写入）→ 自写触发的 `vault:md-modified` 到冲刷时哈希与基准相同 → 被过滤跳过，杜绝自触发死循环；
- **修改监听**：`LinkAgentWatcher` 订阅 `vault:md-modified`（范围过滤、防抖聚合，复用批次管道）；
- **哈希过滤**：冲刷时 `filterChangedForRelink` 只保留「与基准不同 / 无基准（升级前存量）」的笔记重跑；**Obsidian 高频保存但内容未变 → 不空转裁判**；
- **基准维护**：每次 `processNote` 成功（含监听/队列消费/补链/手动重跑）刷新；文件删除时 `dropLinkBaseline` 移除；不可达入队/失败不记；
- 纯自动：无新命令、无新按钮、无新设置项；批次沿用串行锁与通知规则（N=0 静默）。

## 代码改动

- `data.ts`：`getLinkStateFilePath / loadLinkState / upsertLinkState / removeLinkState`（+`LinkStateEntry`/`LinkStateMap`）；
- `pipeline.ts`：`recordLinkBaseline / filterChangedForRelink / dropLinkBaseline`；`processNote` 写入后记基准；
- `watch.ts`：`pendingModifies` 缓冲 + `onModified`（范围门、防抖）+ `flushBatch` 合并过滤结果 + `onDeleted` 清基准 + `destroy` 清缓冲；
- `index.ts`：文档头补 ticket 119。

## 验收

- [x] 成功建链后记基准（含本次 related）；幂等重跑也刷新基准；不可达入队/失败不记；
- [x] `filterChangedForRelink`：基准相同剔除 / 正文大改保留 / 无基准保留 / 缺失/非md/encrypt 剔除；
- [x] watcher 修改事件聚合与过滤、删除清两缓冲与基准、过滤异常按全部保留兜底、scope 与开关门；
- [x] 数据层 CRUD（upsert/读回/覆盖/移除/损坏与非对象容错）；
- [x] 全量测试 + tsc 全绿；smoke 无新命令（不新增 id）。

## 后续

ticket 112 质量反馈闭环（审计日志 + 否决记忆 + 互惠加权）仍待开发，非本票。