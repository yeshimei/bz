# ADR-0033：smartcat 番茄钟观察（方法监听，专注完成单次语义）

Status: accepted（2026-08-24，ticket 080，用户拍板定稿）

## Context

番茄钟原先只有 blind 事件渠道：`DOMAIN_FILES.pomodoro` extract 按 history 新 ts 批量发「你用番茄钟完成了一段专注（+ N 次）」——批量化、无时长、无法表达单次完成语义。按影视（ADR-0027）/备忘录（ADR-0028）/聚合讯（ADR-0029）的方法监听先例，用户拍板改为**方法监听**：专注自然完成时通知 smartcat，事件渠道 extract 移除。

## Options

- A（采纳）方法监听（单一挂点）：`src/pomodoro/ui.ts` `applyAction` 的 `phase-completed` 分支内，`completedPhase === 'focus'` 且 `historyEntry` 存在（focus 自然完成、写 history 的路径）时调 `notifyPomodoroAction`；文案构造集中 `pomodoro-source.ts` 纯函数。
- B 事件快照 diff 增强：保留 domain-source 渠道并补时长字段——仍是批量计数语义，无法表达「一次动作一条」，且 pomodoro.json 写盘频率（每次完成+暂停态落盘）产生无意义 diff——弃。
- C 双通道（方法 + 事件）——防重逻辑复杂，正是本系列 ticket 从事件渠道迁走的起因——弃。

## Decisions

- **观察集（用户 2026-08-24 拍板）：只观察「专注完成」**——focus 阶段 tick 自然完成（写 history 的路径）。开始/暂停/继续/跳过/重置/休息完成一律不观察（skip 与休息完成无 `historyEntry`，天然排除）。
- **文案**：`你用番茄钟完成了 X 分钟专注`，X = 当前配置的工作分钟数（`durations().workMin`，设置预设/自定义；默认 25）。例：`你用番茄钟完成了 25 分钟专注`。
- **唯一挂点**：`applyAction` 内 `if (r.event.type === 'phase-completed')` 分支，与 `if (action === 'tick') notifyPhaseComplete(r.event)` 相邻；**不随 `action === 'tick'` 条件写死**——以 `historyEntry` 存在判断（skip 无 historyEntry，天然排除）。
- **`PomodoroActionEvent` union**：`{ kind: 'focus-done'; minutes: number }`（本域只有这一个事件，保持 union 结构对齐先例）。
- **`notifyPomodoroAction`（src/smartcat/index.ts 导出）**：守卫同 movie/memo/news——未初始化或 `data.config.noteSource` 关闭时静默；观察 `source: 'pomodoro'` 入记忆流。
- **事件通道关停**：`onVaultActivity` 对 `kind === 'pomodoro'` 短路（`classifyPath` 补 `CONFIG/STORAGE/pomodoro.json` 分类——vault create/modify 对 json 也触发，显式短路防域 JSON 事件双记录，对齐 movie 先例）；`DOMAIN_FILES.pomodoro` extract 移除（计数观察不再产）。
- 无 timer/map 需清理（单一 fire-and-forget 通知，无调度/登记表）。

## Consequences

- 观察粒度从「批量计数（+ N 次、无时长）」细化为「单次完成 + 精确分钟」，一次动作一条、零定时器（对齐方法监听系列的零噪音特性）。
- smartcat 与 pomodoro 产生新依赖边：`src/pomodoro/ui.ts → src/smartcat`（notifyPomodoroAction）。方向单向（smartcat 不 import pomodoro UI/数据），符合 ADR-0002。
- 行为变更：`domain:pomodoro` 事件观察停用——旧记忆不迁移（兼容冻结：旧数据直接可读）。
- 数据零改动：pomodoro.json / smartcat.json 格式、状态机、UI 结构与命令、番茄钟既有文案均不动（兼容冻结：仅加 notify 挂点）。
- 已知边界：休息完成（短休/长休自然结束）不观察、手动跳过不观察——与用户拍板一致；如需扩展观察集须另行拍板。