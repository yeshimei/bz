# 293 — 备忘录设置补两项：打开默认场景 + 已完成显示范围

- 日期：2026-09-12
- 用户拍板（一句话需求）：从候选项里采纳「已完成折叠区时间窗」与「面板打开时的默认场景」两项（承接 issue 292 收尾时的选项梳理）
- 关联：issue 292（选项梳理出处）、ADR-0104（渲染/行为分层）、设置项文案规范（CONTEXT.md）
- 状态：已完成

## §1 设计决策

### 打开默认场景（`memoOpenScene`，显示组首行）

- 选项：**上次停留（'@last'，默认）** / 全部 / 今日 / 重要 / 动态场景列表（与「新条目默认场景」同范式，schema 每次打开重建）。
- **默认取 '@last'（上次停留）**：此前面板本就存在「会话内隐式记忆」（M.activeScene 模块级、关面板不重置），默认值只是把既有行为显式化，并升级为**跨重启记忆**——关面板时把当下场景写进 `memoLastScene`（一次 settings 写盘/次关闭，与尺寸记忆同量级）。
- `@last` 哨兵值防与用户场景名撞车；场景已删/改名导致记忆失效 → 回落「全部」。
- **提醒 notePath 定位开面板恒「全部」**：定位靠搜索框过滤，若默认场景叠加场景过滤会把目标条目挡掉（issue 292 前的隐式记忆下同样存在该隐患，本次一并封死）。

### 已完成显示范围（`memoDoneWindow`，显示组末行）

- 选项：近 7 天 / 近 30 天（默认，原硬编码行为）/ 近 90 天 / 全部。
- 「全部」= 不折叠，已完成条目直列、不出现「更早 N 条」；非法值回落 30 天。
- 原常量 `DONE_WINDOW_DAYS = 30` 删除，取数改 `doneWindowDays()`。

## §2 改动面

| 文件 | 内容 |
|---|---|
| `src/settings.ts` | 新键 `memoOpenScene`（默认 '@last'）/`memoLastScene`（默认 ''）/`memoDoneWindow`（默认 '30'） |
| `src/memo/settings.ts` | 「显示」组增「打开默认场景」「已完成显示范围」两行（9 → 11 项） |
| `src/memo/ui.ts` | `resolveOpenScene()`/`doneWindowDays()` 两纯函数；openMemoPanel 播种场景（notePath 恒「全部」）；closeMemoPanel 写 `memoLastScene`；renderContent 时间窗改设置驱动 |
| `src/memo/state.ts` | showEarlierDone 注释去「30 天」硬编码提法 |

## §3 测试

- `tests/memo/ui.test.ts`（56 → 58）：
  - 「已完成显示范围」：7 天窗把 10 天前完成收进「更早 1 条」、近项直列；'all' 全列且无「更早 N 条」。
  - 「打开默认场景」：固定场景直用；'@last' 关面板写入 `memoLastScene`、重开取回、失效回落「全部」。
  - schema 用例补两行断言（绑定键、选项值全列）。
- `tests/settings-panel.test.ts`：备忘录徽标 9 → 11。

## §4 门禁记录

- `pnpm exec tsc --noEmit` → 0 错误。
- `pnpm test tests/memo tests/settings-panel.test.ts` → 13 文件 / 196 测试全绿。
- worktree 全量仅 preview-freshness（源指纹，主仓库重出）与 smartcat/memory 一例高负载抖动红（单跑 67 全绿，与 memo 改动无关，issue 291 §7① 同族）。

## §5 备查

- `memoOpenScene` 固定为某具体场景后，该场景被删除/改名不自动迁移设置值（回落「全部」）；场景管理菜单的「在设置中编辑」可直达调整。
- spec.md 设置项总表顺手修正：memoAutoArchive 键已随旧域退役（src 无此键），从列表移除并注明。
