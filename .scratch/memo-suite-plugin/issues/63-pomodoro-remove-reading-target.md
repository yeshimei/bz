# 63 — 移除读书番茄钟 + 专注目标选择（用户决策：无用且复杂）

**What to build:** 用户反馈读书番茄钟与目标选择「没用处反而很复杂」，确认后整体移除：
1. **读书番茄钟**：删 `src/pomodoro/epub-link.ts`、`src/pomodoro/reading.ts` 整文件；ui 读书分支/确认弹窗/设置项（pomodoroEpubAuto/pomodoroEpubMode）；data `reading` 字段；stats 读书时长 + book 统计；statusbar 读书态；config 读书预设；main 接线。
2. **专注目标选择**：ui 目标区/选择器（memo/note）/重置清目标逻辑；state/data 的 target 归一（旧数据忽略不迁移）。
3. **保留 ticket 62 通用改进**：主番茄钟后台自动暂停（pomodoroAutoPauseOnHide）、不补算（recover 超时回空闲）、暂停落盘。
4. 历史数据：state.target / history.target / reading 字段读取时忽略，不迁移不清空（铁律 1 数据格式稳定）。

**Status:** done

## 模型

**删除面（src/pomodoro/）**：
- 删 `epub-link.ts`（视图探测/决策/监听/接线）
- 删 `reading.ts`（独立读书会话状态机）
- `ui.ts`：reading 模块变量/reading 渲染分支/suspendMainState/pushReadingHistory/startReadingFocus/switchReadingFocus/closeReadingSession/tickReading/recoverReadingSession 调用/读书确认弹窗/读书设置开关
- `data.ts`：PomodoroData.reading 字段删；normalizeData 不再处理 reading
- `stats.ts`：readingSecondsToday、PRESETS.reading 依赖删；todayCount/last7Days 恢复纯计数（无 book 口径）
- `statusbar.ts`：读书态渲染分支删
- `config.ts`：PRESETS.reading 删
- `settings.ts`：pomodoroEpubAuto/pomodoroEpubMode 删
- `main.ts`：ensurePomodoroEpubLink 接线删
- `index.ts`：读书相关导出删

**目标删除面**：
- `state.ts`：FocusTarget 类型、PomodoroState.target、HistoryEntry.target、Duration 无关……target 相关全删
- `ui.ts`：目标区/选择器/重置清目标（resetPomodoro 恢复纯重置）
- `data.ts`：isValidTarget/target 归一删（旧数据 target 字段读取自然忽略）

**保留**：后台自动暂停（visibilitychange/autoPauseMain）、不补算（recover 回空闲）、暂停落盘（applyAction）。

## UI / 设置

- 设置项 14 → 12（删 epubAuto/epubMode，保留后台自动暂停等）
- 弹窗：删目标区、读书确认

## 测试

- 删 tests/pomodoro/epub-link.test.ts、reading.test.ts
- settings.test.ts：计数 14→12，删读书开关用例
- stats.test.ts：删读书时长/todayCount book 口径用例（回纯计数）
- ui.test.ts：删读书/目标相关用例
- statusbar.test.ts：删读书态用例
- data.test.ts：删 reading/target 相关用例
- 全量测试 + tsc 零新增

## 注意

- 铁律 1：不迁移旧数据——pomodoro.json 旧 reading/target 字段读取时忽略，UI/统计不再使用。
- 不新增命令 id；`bz-pomodoro-open` 等命令不变。
- spec/CONTEXT 同步删除读书与目标术语。
