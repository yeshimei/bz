# 26 — 番茄钟：按手册重建的新域（原脚本代码已丢失）

**What to build:** bz 第 16 个域「番茄钟」：中央单例弹窗计时器 + 状态栏常驻倒计时，替代已装插件 obsidian-statusbar-pomo（v0.1.15）。范围 = 手册核心版——环形进度条、11 科学预设 + 自定义、开始/暂停/重置/跳过、4 个高级开关（强制专注/自动循环/自动跳过休息/声音）、完整完成历史（今日计数 + 近 7 天柱条）。

**Status:** ready-for-agent（grilling 会话 3 轮 20 问封板 + to-spec）

## Problem Statement

用户的 QuickAdd 宏「🍅 番茄钟」引用的脚本 `CONFIG/SCRIPTS/Quickadd/番茄钟.js` 已丢失（文件不存在），仅存使用手册 `CODE/obsidian 插件/番茄钟.md`（160 行，描述功能、无代码）。现装插件 obsidian-statusbar-pomo 功能简陋（无预设/无强制专注/无历史），不满足手册描述的能力。番茄钟原在 spec Out of Scope 清单，现纳入 bz（范围扩张）。

## Solution

新域 `src/pomodoro/`：命令 `bz-pomodoro-open`（中文名「番茄钟」，icon `timer`）打开中央弹窗；状态栏常驻「🍅 mm:ss」（空闲灰态 🍅，点击开弹窗）；数据 `CONFIG/STORAGE/pomodoro.json`（v1）；设置入插件 data.json + ⚙️ 域设置弹窗（复用 core/settings-modal.ts）；阶段完成 bz toast（ADR-0010）+ Web Audio 提示音。完成后用户手动禁用 obsidian-statusbar-pomo。

## User Stories

1. 作为用户，我想用一条命令打开番茄钟弹窗，以便开始专注计时
2. 作为用户，我想看到环形进度条与剩余 mm:ss，以便直观了解当前阶段进度
3. 作为用户，我想从 11 个科学预设或自定义方案中选择工作/短休/长休时长，以便匹配任务类型
4. 作为用户，我想开始/暂停/重置/跳过当前阶段，以便掌控计时
5. 作为用户，我想开启强制专注模式后工作阶段不可暂停/跳过/重置，以便强制自己专注
6. 作为用户，我想开启自动循环后阶段结束自动进入下一阶段，以便无中断连续工作
7. 作为用户，我想开启自动跳过休息后工作结束直接开始下一工作阶段，以便连续冲刺
8. 作为用户，我想每 N 个专注（默认 4）后进入长休息，以便遵循番茄工作法节律
9. 作为用户，我想关闭弹窗后计时继续、状态栏可见，以便不中断计时同时做其他事
10. 作为用户，我想点击状态栏随时打开弹窗，以便查看/控制计时
11. 作为用户，我想阶段完成时收到 toast 与提示音（声音可关），以便离开 Obsidian 也能知道切换
12. 作为用户，我想 Obsidian 重启后计时自动恢复（含暂停态），以便意外关闭不丢进度
13. 作为用户，我想 Obsidian 关闭期间走完的阶段自动记为完成，以便历史诚实记录
14. 作为用户，我想历史只记自然完成的专注（跳过不计），以便统计真实专注量
15. 作为用户，我想弹窗内看到今日完成数 + 近 7 天柱条，以便获得即时激励与节奏反馈
16. 作为用户，我想在 ⚙️ 设置弹窗调整预设/开关/N/声音等，以便按需定制
17. 作为用户，我想移动端同样可用（不做专项适配），以便手机上也能计时

## Implementation Decisions

- **范围（用户决策）**：核心版——主题概念移除，固定默认样式且**与 bz 现有 UI 风格统一**（用户决策 Q17，非手册蓝紫渐变独立主题）；11 预设 + 自定义保留（纯常量表零成本，Q8）
- **数据**：`CONFIG/STORAGE/pomodoro.json` v1（Q2，跟随共享数据路径 storagePath）：
  `{ version: 1, state: { phase, endTime, remaining, paused, cycleFocusCount }, history: [{ ts, duration }] }`
  - phase: `idle | focus | short-break | long-break`
  - `cycleFocusCount` = 当前循环内已完成专注数；达到 N 后进长休并清零
  - history 只记自然完成的专注（Q10 跳过不计）；duration = 实际专注时长（秒）
  - 暂停态：remaining 存剩余、endTime 置空；恢复时 `endTime = now + remaining`（Q11）
- **状态机**：纯函数 `transition(state, action, now)`（先例：review FSRS 纯函数）。动作 start/pause/resume/reset/skip/tick；阶段结束自动流转 focus→short-break（第 N 个→long-break）→focus；`now > endTime` 超时 = 自动完成并流转、不补通知（Q11）；历史记录由状态机完成事件生成
- **设置（BzSettings + ⚙️ 域设置弹窗，ADR-0009）9 项**：
  pomodoroPreset（12 档下拉：11 预设 + 自定义）、pomodoroWorkMin / pomodoroShortBreakMin / pomodoroLongBreakMin（预设=自定义时动态显示，仿 AI tab bz-setting-hidden 模式）、pomodoroLongBreakInterval（N，默认 4）、pomodoroForceFocus（默认关）、pomodoroAutoCycle（默认关）、pomodoroAutoSkipBreak（默认关）、pomodoroSound（默认开）——默认值包 Q16
- **通知**：阶段完成 toast（文案规范：`✅ 专注完成：休息 5 分钟`）；Web Audio 蜂鸣——工作结束低音 3 响、休息结束高音 2 响（OscillatorNode 零依赖；移动端「开始」按钮即用户手势，满足 iOS 音频约束）
- **状态栏**：默认开（Q13）；`🍅 mm:ss`；空闲灰态 🍅；点击开弹窗；1s 轮询（与状态机 tick 共用）
- **弹窗**：单例（escManager，重复打开幂等）；布局 = 环形进度 SVG + 阶段文案（专注/短休/长休 + 第几个循环）+ 剩余 mm:ss + 开始/暂停/重置/跳过 + 今日计数 + 近 7 天柱条 + ⚙️（Q20）
- **重置语义（Q19）**：当前阶段回满时长并**停止**；强制专注模式下禁用（手册原文）
- **装配**：main.ts COMMANDS 表加 `{ id: 'bz-pomodoro-open', name: '番茄钟', icon: 'timer' }`，域内不重复 addCommand；onunload 清理状态栏元素与轮询
- **替代关系**：不写禁用逻辑，交付说明提醒用户手动禁用 obsidian-statusbar-pomo（Q4）
- **CSS**：写入 `styles/pomodoro.css`（最终收敛根 styles.css），类名遵循 bz-* 风格

## Testing Decisions

- **缝**（三层，沿用项目既有缝模型）：
  1. **状态机纯函数**（最高缝）：phase 流转、暂停/恢复/重置/跳过语义、超时自动完成、N 长休判断、历史生成（跳过不计）——先例：review FSRS 纯函数测试
  2. **数据层**：pomodoro.json 读写（jsonStore）、恢复（含暂停态/超时重建）——先例：password 数据层
  3. **UI jsdom**：弹窗交互（按钮/环形进度/计数渲染）、状态栏（显示/点击/空闲灰态）、⚙️ 设置弹窗（9 项 + 自定义时长动态显示）——先例：diary/bz UI 测试
- 原则：只测外部行为（流转结果、落盘、DOM 渲染），不测实现细节；轮询用 fake timers `advanceTimersByTimeAsync`；`setApp`/`setSettingsProvider` 注入
- smoke.test.ts 命令清单 +1（bz-pomodoro-open）

## Out of Scope

- 主题系统（7 主题移除，固定 bz 统一风格样式）
- 任务/笔记关联（专注不绑定备忘录/日记）
- 统计报告页（历史全量落盘，渲染只做今日 + 近 7 天，格式预留扩展）
- 系统通知（Electron Notification 不做，Q6）
- 移动端专项适配（项目惯例）
- 自动禁用/管理 obsidian-statusbar-pomo（用户手动禁用）
- 原脚本代码找回后的逐字对齐（代码已丢，按手册重建）

## Further Notes

- **原脚本代码已丢失**（QuickAdd 宏指向 `CONFIG/SCRIPTS/Quickadd/番茄钟.js`，文件不存在）→ 按手册重建，非逐字复刻；无旧数据 → 「数据格式零迁移」铁律不适用 → ADR-0012
- 手册 11 预设表见 `CODE/obsidian 插件/番茄钟.md`：经典 25/5/15、神经专注 30/7/20、深度心流 50/10/25、创意激发 40/12/20、初学入门 15/5/12、高效学习 30/5/15、敏捷冲刺 20/4/12、马拉松式 45/15/30、疲劳恢复 20/10/20、高强度 50/5/15、平衡模式 35/7/18
- spec.md 同步：命令 id 全清单、设置项总表、Out of Scope（番茄钟移出）、User Stories 节
- CONTEXT.md 术语：番茄钟/专注阶段/短休息/长休息/循环/预设方案
