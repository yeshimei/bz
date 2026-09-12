# ADR-0126：备忘录到期文案口径固定相对（memoDueFormat 退役）

日期：2026-09-12 ｜ 状态：已采纳 ｜ 关联：issue 292、ADR-0117（保留键名单，本 ADR 修订）、ADR-0092（键名即存储契约）、ADR-0115（退役键处置范式）

## 背景

备忘录的到期文案原有两种口径，由设置键 `memoDueFormat` 二选一：「相对」（今天 14:00 到期 / 明天 14:00 到期 / 2天前已过期）与「绝对」（MM/DD HH:mm 到期 + 状态后缀）。用户 2026-09-12 拍板：**去掉这个设置项，一律相对**——到期信息要一眼看出「还有多久」，绝对日期对当下的紧迫感没有增量，却多一个要理解、要选的开关。

## 决策

1. **设置行退役**：备忘录设置「显示」组删除「到期时间格式」行。
2. **口径固定相对（消费面单源）**：`src/memo/due.ts` 的 `formatDueText(due)` 去掉 `mode` 参数与 absolute 分支；`ui.ts metaDueOf` 不再读设置。相对口径的现状语义（今天/明天/MM-DD 递进 + 逾期 N 天）逐字保留，本次只删分支不改编排。
3. **键退役**：`memoDueFormat` 从 `BzSettings` 与 `DEFAULT_SETTINGS` 删除，**不改名、不迁移**，data.json 残留值忽略（对齐 ADR-0115 的退役键范式）。
4. **原型产物重出**：`src/memo/render.ts` 注释变更即触发源指纹，`prototypes/memo/prototype-render.js` 与 `prototype-behavior.js`、`prototypes/settings-panel/prototype-behavior.js`（全域 schema 闭包）须在主仓库重出并提交——按 issue 291 §7② 既有口径，worktree 内不重出。

## 后果

- **ADR-0117 第 3 条的保留键清单由 6 键收缩为 5 键**：`memoScenarios/memoSortMode/memoShowArchivedByDefault/memoDefaultPriority/memoDefaultScene`。
- 设置面板备忘录徽标 10 → 9；`tests/settings-panel.test.ts` 计数断言同步。
- 回归守卫：`tests/memo/due.test.ts` 传第二参仍断言输出相对文案，防止 absolute 分支复活。
- 若日后「看绝对日期」的诉求回归，须新 ADR 重新引入；**不要复用 `memoDueFormat` 键名**——data.json 里的历史值会被重新读回，等于静默恢复旧选择。
