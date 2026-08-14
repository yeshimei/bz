# 59 — 全量 + 增量提炼链路 + 面板骨架

**What to build:** 写日记后黑匣子自动提炼的完整链路：vault modify/create 监听（三目录边界 + 防抖 30 分钟）+ 打开黑匣子时待处理条目即时提炼 + 首次启用历史全量（分批 50 条/批串行 + 进度通知）+ 一次 AI 调用批量提炼（JSON {people, events, emotions}，失败跳过重试，永不拒收）；三标签面板骨架（人物墙/时间线/复盘流空态 + 提炼结果简单列表渲染）。

**Blocked by:** 58

**Status:** ready-for-agent

- [ ] 写日记 → 30 分钟防抖 → AI 提炼 → profiles/mentions/events 更新落盘（mock fetch 断言调用与 JSON 解析）
- [ ] 打开黑匣子时若有待处理条目先即时提炼再渲染
- [ ] 首次全量分批串行 + 进度通知；失败跳过下次重试
- [ ] 三标签面板骨架渲染提炼结果；测试全绿