# Ticket 167 — 已有 related 不再触发自动双链

## 背景

自动双链（ticket 111）管线对关联范围内笔记持续建链：新笔记落盘触发、正文大改自动重跑（ticket 119）、队列消费、存量补链。问题：**用户已手动维护了 `related` 的笔记仍会被自动路径处理**——正文大改会触发 AI 裁判重跑（费算力且可能覆盖用户意图），`related` 里已有的链虽幂等不重复，但自动路径仍在「碰」用户已接管的笔记。

## 需求（用户逐项拍板，grill-with-docs 六轮）

1. **覆盖路径**：创建① + 修改②（含正文大改自动重跑）+ 队列消费③ 三条自动路径统一加「已有 related 则跳过」；存量补链（ticket 115）本就只补缺 `related` 的笔记，天然一致；死链清理不受影响。
2. **判定标准**：related **非空**（≥1 个有效条目）才算「有」；`related: []` / 空值 / 缺失 = 未接管，自动双链继续建链。与存量补链 hasRelated 同一语义（统一出口 `hasRelatedEntries`）。
3. **手动命令豁免**：`bz-secondbrain-rebuild-links` 保持强制重跑（显式意图），传 `respectRelated: false`。
4. **加设置开关**：`linkAgentRespectRelated`，默认开（开 = 新语义；关 = 恢复旧行为）。开关文案「已有关联不再建链」（标题 8 字过文案 lint 规范）。

## 实现

- 数据层 `src/secondbrain/link-agent/data.ts`：新增纯函数 `hasRelatedEntries(value)`——`parseRelatedEntries(...).length > 0`（related 非空判定统一出口）。
- 管线 `src/secondbrain/link-agent/pipeline.ts`：
  - `ProcessOutcome` 新增 `{ status: 'skipped-related' }`；
  - `processNote` 新增 `opts.respectRelated?: boolean`；默认（自动路径）尊重开关 `linkAgentRespectRelated`（缺省兜底 true），frontmatter `related` 非空 → 直接 `skipped-related`（不探测 / 不 refresh / 不裁判 / 不写入）；metadataCache 不可读按「未接管」放行（与存量补链不可读按「已连接」兜底同向——自动路径宁保守）；
  - `consumeQueue`：`skipped-related` 条目**顺带移除队列**（条目代表「待处理」，已接管即处理完毕，避免队列滞留）；不计数 processed；
  - `runBatch` 对 `skipped-related` 静默（不计入 processed/queued/failed）。
- 手动命令 `src/secondbrain/index.ts` `rebuildSecondBrainLinks`：`processNote(file.path, { respectRelated: false })` 豁免。
- 设置 `src/settings.ts`：类型 + DEFAULT_SETTINGS 新增 `linkAgentRespectRelated: true`。
- ⚙️ 弹窗 `src/secondbrain/panel.ts`：自动双链组新增 toggle 行「已有关联不再建链」，`boolDefaultOn('linkAgentRespectRelated')`，`visibleWhen` 同明细行。

## 测试

- `tests/secondbrain/link-agent-data.test.ts`：`hasRelatedEntries` 纯函数（非空=true；空数组/空值/缺失=false）；DEFAULT_SETTINGS 七键断言。
- `tests/secondbrain/link-agent-ui.test.ts`：
  - ⚙️ 弹窗六行明细渲染 + 新 toggle 独立持久化；
  - 尊重门默认开：related 非空 → `skipped-related`，不探测不裁判不写入；
  - related 空数组 / 缺失 → 照常建链；
  - `respectRelated: false`（手动）→ 强制重跑幂等合并；
  - 开关关闭 → 恢复旧行为（已有关联仍走完整管线）；
  - 队列消费：已连接条目 `skipped-related` 且移除队列（无滞留），未连接照常建链；全部已连接时 processed=0 完成通知静默；
  - 手动命令守卫：`rebuildSecondBrainLinks` 传 `respectRelated: false`。
- 既有 3 处依赖「幂等重跑」语义的用例改为 `respectRelated: false`（原自动路径现被尊重门拦截，属预期新行为）。

## 门禁

- [x] 数据层 + UI 层 Vitest 覆盖
- [x] `pnpm exec tsc --noEmit` 0 错
- [x] 全量测试绿
- [x] 构建验证 + 部署产物同步
- [x] spec v1.7 节 + PROGRESS 留档
