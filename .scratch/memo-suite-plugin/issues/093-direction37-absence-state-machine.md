# ticket 093 —— 方向三+七 合并：单一缺席状态机（086 v4）

状态：**done**（2026-08-24，分支 absence-state-machine 落地：单一状态机 editingData.absenceState 三态环 + selfEvents 环形 ≤20 + PAD 幅度域 [1.0,1.8]+0.5×共振帽 + 时序分窗同日不抵消 + lazyAttachment 读侧惰性视图 + onPresence 钩子；测试 tests/smartcat/absence.test.ts 36 用例，全量 1752 绿 + tsc 0；ADR-0040）
父文档：086-intelligence-evolution-proposal.md v4「方向三」「方向七」（绿队C 裁决合并）
基线：以合并时 master HEAD 为准（≥6419c06）；开工前先 git log 确认
日期：2026-08-24

## ⚠ 范围裁定（本票与 v4 原文的差异，必读）

v4 方向七的「分离降速倍数（1.5x/2.5x/1.2x 相对 trust 日降温）」**依赖 H1 信任降温机制**，
而 H1/090 已随 089 一并 PARKED——**本票不实现任何 trust 降温/倍率逻辑**，只做状态机与表达层。
降速倍率留待方向五重新定义后另票（票据标注即可）。

## 设计（v4 裁决逐条落地）

1. **单一缺席状态机**：方向三「牵挂/安心/重逢喜悦」与方向七「分离焦虑/重逢」共用，
   状态持久化 `editingData.absenceState?: { phase: string; since: number }`（可选字段零迁移）；
   **杜绝双写**——全库只有这一处缺席判定
2. **selfEvents 持久化**：`editingData.selfEvents: [{ type: string; at: number }]`
   （环形缓冲 ≤20 条）——事件直接呈现 dashboard，不依赖 PAD 可见性（体验原则 3 表达先于数值）
3. **PAD 幅度重规格 [1.0, 1.8]**：对齐 handleInteraction 最小行；且 ≥ updatePad 落盘阈值 1.0
   才有可验证效果；单事件上限 ≤0.5×用户共振幅度（applyEmotionResonance 同期差量为顶）
4. **时序归因分离**：重逢喜悦不得与「牵挂」同日抵消——按 lastPresenceAt 分窗口：
   触发时刻距 lastPresenceAt < 24h 只走重逢分支；≥N 天才先补「牵挂」再等重逢
5. **attachment 惰性算分**（方向七裁决）：读侧纯函数 `lazyAttachment(stored, lastPresenceAt, now)`，
   分离衰减只影响读取视图，不写盘不漂移；now 注入可测
6. **画像选择器砍掉**：安全/焦虑/回避三套参数为出厂内部常量候选（代码内注释标明），
   不进设置面板、不做用户选择（涌现不可配置原则）
7. **触发源**：调度心跳（onSchedulerTick）检查 lastPresenceAt 距今 → 状态迁移；
   重逢判定 = sendChatMessage/onVaultActivity 在场信号 + absenceState.phase ≠ normal

## 明确不做

- trust/attachment 写盘衰减（方向五域）
- 任何新增 LLM 调用
- 设置面板任何新项

## 测试要求

- 状态机迁移表全覆盖（normal→missing→reunion 回 normal；边界 24h/N 天）
- PAD 幅度域断言 [1.0,1.8] 与 0.5× 共振帽；同日不抵消窗口
- selfEvents 环形缓冲截断；dashboard 呈现（UI 测试）
- lazyAttachment 纯函数（含 now 注入/缺省容忍）
- 兼容回归：既有 mood/index 测试全量保留

## 工程规约

同 091 号票（exFAT pwsh 写盘 / git -c safe.directory 双参 / Conventional Commits 中文 /
.scratch add -f / flake 协议 maxWorkers=4 / 完成门禁 test+tsc）。汇报 ≤15 行。