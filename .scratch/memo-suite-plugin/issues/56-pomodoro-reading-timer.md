# 56 — 番茄钟读书计时重构（独立读书计时 + 重置清目标 + 关书恢复）

**What to build:** 用户需求三项：①点「重置」同时清空关联目标；②当 Obsidian 在后台停止倒计时时，读书计时单独可靠累计（不漏时）；③关闭 epub 书时主番茄钟恢复进入读书前的状态。

**Status:** done

## 变更

### 重置清目标
- `src/pomodoro/ui.ts` 新增 `resetPomodoro()`：`applyAction('reset')` 后若原目标非空则清空（state.target → null）并落盘；重置按钮事件改指向它。

### 独立读书计时（新模块 `src/pomodoro/reading.ts`）
- `ReadingSession { active, book, elapsedMs, startedAt, prevState }` 纯函数状态机（start/switch/end/readingElapsedMs/normalize），无 DOM。
- 累计 = `elapsedMs + (now - startedAt)`，endTime 基准 → Obsidian 后台节流/重启不漏时。
- `pomodoro.json` 新增**可选** `reading` 字段（v1 兼容，旧数据无 → 空会话）。
- ui：打开书 `startReadingFocus` 快照并挂起主番茄钟（endTime→paused/frozenRemaining），`closeReadingSession` 结算并恢复 `reading.prevState`；换书 `switchReadingFocus` 旧书累计入账。
- epub-link：`decideReadingAction` 增加 `readingActive` 参数；执行动作 start/switch/pause（pause→closeReadingSession）经函数体内 import ui。
- settings-modal「读书自动番茄钟」描述更新。

### 关书恢复
- `reading.prevState` 保留进入读书前完整主状态（含运行中 endTime）；关书恢复后主番茄钟原样继续（时间不流逝）。

## 测试
- 新增 `tests/pomodoro/reading.test.ts`（10：累计/后台补时/换书结算/关书快照/归一容错）。
- `data.test.ts` +2（旧数据无 reading 兼容 / 非法归一）。
- `ui.test.ts` +1（重置清目标）。
- `statusbar.test.ts` +1（读书累计显示 📖 mm:ss）。
- `epub-link.test.ts` 决策表与集成测试改造适配独立读书计时。
- 全量 965→980 全绿；tsc 0 新增。

## 注意
- 语义变更：读书不再替换主番茄钟状态机；无读书预设自动 override；主 state.target 不再置为 book（读书历史单独以 target.type=book 入账）。
- 无新命令 id；`readingModePopupEnabled`（读书启动形态）保留；`exitReadingMode`/`pauseReadingFocus`→`closeReadingSession`。