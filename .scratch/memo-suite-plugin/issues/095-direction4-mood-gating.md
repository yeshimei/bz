# ticket 095 —— 方向四：心情门控（086 v4 裁决：限范围修，输出维度换）

状态：**READY-FOR-AGENT**（开放点默认值已定，标注「晨起可调」处可改）
父文档：086-intelligence-evolution-proposal.md v4「方向四」
基线：以合并时 master HEAD 为准；开工前先 git log 确认
日期：2026-08-24

## 设计（v4 裁决逐条落地）

1. **频率不动，换输出维度**：不降搭话频率——平静期把 Bandit 选中臂映射到「温和话术子集」；
   主动间隔 2 天 → 3~4 天（默认值，晨起可调）
2. **「每日 1 次温和问候」豁免**：不计 proactive 计数、不领 Bandit reward
3. **采样器固定挂载**：60s PAD 衰减循环 + 30 分钟心跳上挂窗口采样器（不新建循环）；
   判定从瞬时阈值改为「窗口内多数采样低于阈值」（防抖动，替代 v3 hysteresis 思路的落地形态）
4. **先接线死代码 loadMoodState()**：读取持久化 PAD；24h 陈旧超时归中性（防重启假情绪）
5. **门控输入 = 趋势漂移**：analyzeEmotionTrend 输出为准，非瞬时 PAD
6. **quietMode 状态机持久化**：editingData.quietMode?: { on: boolean; since: number }；
   静默超时自动退出兜底（默认 48h，晨起可调）
7. **体验原则 1 打扰总量守恒**：温和问候豁免额度不得增加任何新主动行为总量

## 明确不做

- 不改 Bandit 结构与既有 reward 口径（只加豁免分支与臂→话术映射表）
- 不新增设置面板项

## 测试要求

- 窗口多数采样判定（含边界样本数）；趋势漂移驱动开关 quietMode
- 温和话术子集映射（平静期选中任意臂都落在子集）；豁免分支不计计数不领 reward
- loadMoodState 接线：新鲜读取 / 24h 陈旧归中性 / 无数据缺省
- 静默超时自动退出；既有 mood/interaction 测试全量保留

## 工程规约

同 091 号票（exFAT pwsh 写盘 / git -c safe.directory 双参 / Conventional Commits 中文 /
.scratch add -f / flake 协议 maxWorkers=4 / 完成门禁 test+tsc）。汇报 ≤15 行。