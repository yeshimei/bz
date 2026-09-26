# ADR-0179：番茄钟退役「后台自动暂停」（窗口 hidden 不再影响计时）

- 日期：2026-09-23
- 状态：已采纳（退役 ticket 62 引入的行为；`pausedBy` 转遗留兼容字段）
- 相关：ticket 62（引入方）/ ticket 63（同域设置收敛）；术语条目见 CONTEXT.md「番茄钟域」

## 背景

ticket 62 引入「后台自动暂停」：`document` 的 `visibilitychange` 进入 hidden（最小化 / 遮挡 / 系统休眠）时把运行中的主番茄钟冻结（`paused: true` + 来源标记 `pausedBy: 'autopause'` 落盘），恢复 visible 且原由本机制冻结的会话自动继续；设置面板「行为」组另有一行开关 `pomodoroAutoPauseOnHide`（默认开）。

用户 2026-09-23 报「Obsidian 切到后台、失去焦点等会干扰番茄钟」，要求去掉该功能。

口径澄清：原实现只认 `document.hidden`，blur 失焦**不**触发（旧术语条目已把「锁屏 / 全屏切走等 hidden 抓不到的缝隙」记为已知限制）。用户感受里的「失去焦点」＝ 切走导致 hidden 的那些路径。

## 决策

1. **删机制**：`visibilitychange` 监听、`autoPauseMain` 冻结标记，以及 `autoPauseEnabled` / `freezeRunning` / `unfreezeRunning` / `pauseOnHidden` / `resumeOnVisible` / 注册与注销函数整块退役。窗口 hidden 期间计时照走（tick 照常在后台推进，回来即真实剩余）。
2. **删设置**：「行为」组的「后台自动暂停」行、`pomodoroAutoPauseOnHide` 的类型声明与默认值一并移除（组内 7 项 → 6 项；设置弹窗可见项 14 → 13；设置面板侧栏徽标 11 → 10）。
3. **`pausedBy: 'autopause'` 转遗留兼容字段**：本版不再写入，读取侧（`data.ts` 解析 + `ui.ts` / `statusbar.ts` 的 forceFocus 放行判据）保留，理由见「后果」。
4. **文案同步**：ui.ts 头注与落盘注释、statusbar 的「暂停（含后台自动暂停）」、state.ts 字段注释改写。

## 后果

- 计时行为：hidden 不再暂停；跨越「关掉 Obsidian / 休眠到进程重启」的长时离开仍由**不补算**兜底（那是重启路径，与本机制无关，且本轮不动）。
- **遗留数据必留读取面**：旧 vault 里可能仍存在 `paused: true + pausedBy: 'autopause'` 的冻结态（在最小化状态下退出 Obsidian 才会留下）。若连读取面一起删，升级重启后该状态在 forceFocus 下会命中「开始/重置/跳过三键全禁用」的死锁（P1-4 曾修掉同款）。故本轮只删写入侧、留读取侧，且注释标明「遗留」。
- 存量 `pomodoroAutoPauseOnHide` 键成为被忽略的未知键（不迁移、不清理）。
- 已知代价：专注期间离开（切去别的应用 / 最小化）会计入番茄时长——这正是用户要的语义（离开不该打断专注），如实记账。
- 测试面：删 4 条自动暂停行为断言（ui 三条 + review-fix-clip-ui 的 F12 一条），新增 1 条「hidden/visible 不干扰计时」不变量（含「隐藏期间时间字照走」这条判别性断言）；data / state 的 `pausedBy` 断言改名标注为遗留兼容。

## 被否决的方案

- **保留开关、默认改关**：用户要的是「没有这个干扰」。留开关等于留一条会误开的路径——旧 vault 里已显式 `pomodoroAutoPauseOnHide: true` 的设置会继续生效。
- **连 `pausedBy` 读取面一起删**：见「后果」第二条的死锁（升级时正好停在旧冻结态的 vault 会三键全禁用）。
- **把 blur 也纳入**（失焦即暂停 / 失焦即继续）：与诉求相反，用户要的是不干扰。
- **hidden 暂停、回来后补算**：仍然会暂停；且与同域已有的「不补算」拍板冲突。
