# 27 — 番茄钟数据层与状态机

**What to build:** 番茄钟域的数据底座：`CONFIG/STORAGE/pomodoro.json` v1 的读写（跟随共享数据路径）、纯函数状态机 `transition(state, action, now, durations)`、持久化恢复。状态机覆盖完整阶段流转：idle/focus/short-break/long-break，动作 start/pause/resume/reset/skip/tick；专注自然完成记入 history（跳过不计）；每 N 个专注（默认 4）后进长休息并清零循环计数；`now > endTime` 超时自动完成并流转（不补通知）；暂停态（remaining 存剩余、endTime 置空）恢复。本 ticket 提供默认时长（经典 25/5/15、N=4），settings 注入由 T31 接入。数据格式：`{ version: 1, state: { phase, endTime, remaining, paused, cycleFocusCount }, history: [{ ts, duration }] }`（grilling 会话定稿）。

**Blocked by:** None — 可以立即开始。

**Status:** ready-for-agent

- [ ] 状态机纯函数测试全绿：四阶段流转、暂停/恢复（endTime=now+remaining）、重置（回满时长并停止）、跳过（不计历史、cycleFocusCount 不增）、超时自动完成并流转、第 N 个专注后进长休息且循环计数清零、自动循环/自动跳过休息/强制专注语义（开关作为参数传入时生效）
- [ ] 数据层测试：pomodoro.json 读写（jsonStore 语义）、恢复（含暂停态恢复、超时重建为已完成）
- [ ] history 只记自然完成的专注，duration 为实际专注时长（秒）
- [ ] 类型：state/action/transition 导出清晰，纯函数无 DOM 依赖
