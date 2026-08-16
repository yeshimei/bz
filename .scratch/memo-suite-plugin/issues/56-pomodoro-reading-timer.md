# 56 — 番茄钟读书计时重构（独立读书番茄钟 + 重置清目标 + 关书恢复 + 读书时长统计）

**What to build:** 用户需求（多轮对齐定稿）：①点「重置」同时清空关联目标；②打开 epub 书时**独立进行一个番茄钟**，自动选「阅读沉浸」预设（45/10/20），后台/重启不漏时；③关闭 epub 书时恢复进入读书前主番茄钟的状态；④界面读书统计由「📚 读书 X 个 🍅」改显示「📚 读书 X 小时 Y 分」（按读书历史实读秒数求和）。

**Status:** done

## 模型

**独立读书番茄钟**（src/pomodoro/reading.ts，纯函数）：复用 state.ts 的 transition/recover（同一阶级模型），以读书预设时长注入，自成节律。
- 打开 epub 书 → 快照并**挂起主番茄钟**（reading.prevState 存完整快照，主 endTime→paused/frozenRemaining）→ 独立读书番茄钟从「读书专注 45min」开始。
- 专注走满 45min → 记一个读书历史（target.type=book，duration=2700）→ 读书短休 10min；每 4 个专注 → 读书长休 20min → 回专注（autoCycle 恒真，书开机自走节律）。
- 换书 → 结算旧书当前段**按实读时长**入旧书历史，新书从新段开始；主番茄钟保持挂起。
- 关闭书 → 结算当前段按实读时长入账（读书休息段不计）→ 恢复 reading.prevState 主番茄钟快照（时间不流逝）。
- `pomodoro.json.reading` 可选字段：`{ active, book, state(PomodoroState), prevState }`，旧数据无 → 空会话兼容。

## 统计
- stats.ts：`bookCountToday`（个数）删除 → `readingSecondsToday(history, now)`（今日 target.type=book 条目实读秒数之和）。
- ui renderStats：`📚 读书 ${fmtDuration(sec)}`（X 小时 Y 分 / Y 分）。
- 状态栏读书中：`📖[专注] mm:ss`（读书番茄钟倒计时，非空闲态）。

## UI
- 读书中主弹窗：读书番茄钟阶段+倒计时、环形进度（读书预设 45/10/20）、/读书目标、按钮禁用。
- 重置清目标：reset 按钮重置满时长同时清空关联目标。
- epub-link：decideReadingAction 增加 readingActive 参数；动作 start/switch/pause→ 新读书番茄钟动作。

## 测试
- reading.test.ts 12：开始/推进/长休循环/实读结算/关书恢复/重启恢复/归一容错。
- stats.test.ts 改 readingSecondsToday、ui.test 改时长显示、statusbar.test 改读书倒计时、epub-link/data 适配。全量 965→982 全绿；tsc 0 新增。

## 注意
- 读书不再替换主番茄钟状态机；主预设始终为用户所选；读书预设「阅读沉浸」仅读书番茄钟内部使用。
- 无新命令 id；`readingModePopupEnabled`（读书启动形态）保留；退出读书=closeReadingSession。
- 中途关书按实读入账、读书休息段不计时长（用户定稿）。