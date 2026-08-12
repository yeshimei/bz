# 52 — 读书预设 + 读书番茄统计 + 删书库 tab

**What to build:** 番茄钟读书联动的纯数据/UI 底座（无新事件逻辑，独立可验收）：设置里出现第 12 个预设「阅读沉浸（45/10/20）」可选；弹窗统计行从「📚 读书 X 分钟」改为「📚 读书 X 个 🍅」（今日完成、target 为书的专注数）；目标选择器删除 📚 书库 tab（书籍目标改由自动关联产生）；两个新设置字段落盘（读书自动番茄钟总开关默认开、启动形态默认后台静默）。

**Blocked by:** 无 — 可以立即开始

**Status:** ready-for-agent

- [ ] 设置下拉出现第 12 项「阅读沉浸（45/10/20）」，选中后时长生效（durations 解析走既有 PRESETS 路径）
- [ ] 弹窗统计行 `📚 读书 X 个 🍅`：X = 今日（本地时区）完成、target.type=book 的专注数；X=0 时该行隐藏；「今日 N 个 🍅」计数不受影响
- [ ] `bookMinutesToday` 删除（含 stats 测试）；history 中 book target 的完成专注仍计入今日总数
- [ ] 目标选择器只剩 📝 备忘录 / 📄 当前笔记 两 tab；书库 tab 渲染与测试删除；`FocusTarget type:'book'` 类型保留
- [ ] 设置字段落盘：`pomodoroEpubAuto: true`、`pomodoroEpubMode: 'background'`；旧 data.json 无字段 → 默认值生效，不破坏
- [ ] 相关测试全绿（stats/ui/settings），tsc 无新增错误
