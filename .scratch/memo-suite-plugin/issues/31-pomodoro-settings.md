# 31 — 番茄钟设置

**What to build:** 设置归位（ADR-0009）：BzSettings 新增 9 项——pomodoroPreset（12 档：11 科学预设 + 自定义）、pomodoroWorkMin / pomodoroShortBreakMin / pomodoroLongBreakMin（预设=自定义时动态显示）、pomodoroLongBreakInterval（N，默认 4）、pomodoroForceFocus / pomodoroAutoCycle / pomodoroAutoSkipBreak（默认关）、pomodoroSound（默认开）；弹窗内 ⚙️ 打开域设置弹窗（复用通用设置弹窗组件）；设置即时生效——状态机时长/开关参数改从设置读取，切换预设立即应用时长，强制专注/自动循环/自动跳过休息/声音四开关按设置行为。

**Blocked by:** 27 — 数据层与状态机（状态机时长/开关参数接入）；28 — 弹窗与主命令（⚙️ 入口在弹窗内）。

**Status:** ready-for-agent

- [ ] settings 结构：9 项字段 + 默认值（11 预设常量表 + 经典 25/5/15 为默认预设）
- [ ] 设置弹窗测试：9 项渲染、预设 12 档下拉、自定义时长动态显示/隐藏、变更即保存
- [ ] 生效测试：切换预设后新阶段用新时长、四开关行为生效（强制专注禁用、自动循环自动流转、自动跳过休息、声音开关）
- [ ] 重启后设置保留（data.json 持久化）
