# ADR-0042：心情门控（quietMode 状态机 + 输出维度换）

日期：2026-08-24 ～ 状态：Accepted ～ 关联：ticket 095（086 v4 方向四裁决）、ADR-0021（记忆流）、ADR-0022（PAD 心情）、ADR-0025（情绪闭环）、体验原则 1（打扰总量守恒）

## Context

方向四要求「心情参与行为决策」：PAD/趋势此前只影响 prompt 语气素材，不影响主动关心时机与话术——低落期小橘照样按 Bandit 排程热情搭话。v3 方案（PAD pleasure 连续采样 hysteresis 切「安静陪伴」）被 v4 裁决限范围修：
1. **输出维度换，不降频**——平静期把 Bandit 选中臂映射到温和话术子集（Bandit 结构与 reward 口径冻结），间隔 2 天 → 3~4 天；
2. **防抖落地形态改窗口多数采样**（替代 v3 hysteresis 思路），采样器固定挂既有循环不新建定时器；
3. **门控输入 = 趋势漂移**（analyzeEmotionTrend），非瞬时 PAD——瞬时值抖动大且无「期」语义；
4. **先接线死代码 loadMoodState()**（24h 陈旧归中性，防重启假情绪）。

## Options

**O1 门控信号源**
- A. analyzeEmotionTrend 的 EMA valence（currentVad.valence）✅
- B. 瞬时 PAD pleasure ❌（v4 明否：抖动、无趋势语义）
- C. 记忆流 emotion 标签众数直接判 ❌（analyzeEmotionTrend 已含众数+EMA+波动度，复用不自造）

选 A。理由：趋势漂移是唯一有「平静期」语义的现成纯函数输出；60s 衰减 tick 只复用其缓存值补采样，不为采样现算全流分析。

**O2 防抖形态**
- A. 窗口多数采样（进：≥3 样本且最近 ≤5 条低值严格多数；出：最近 3 条非低 ≥2）✅
- B. v3 连续 N 次 hysteresis ❌（v4 改裁决；且「连续」对乱序/断供样本脆弱）

选 A。采样带 10 分钟最小间隔去重（60s tick 与 30 分钟心跳共用一个环形缓冲 ≤5 条，防高频克隆灌满窗口）；进出对称多数表决，阈值附近天然不震荡。

**O3 温和问候豁免与总量守恒**
- A. 豁免问候独立通道每日一条，但与 Bandit 主动共享间隔/作息闸门并刷新 lastAt 占槽顺延 ✅
- B. 豁免问候完全自由发（仅日历日去重）❌（安静期每周可到 7 条 > 既有承诺每周 ≤2，违反体验原则 1）
- C. 不做豁免问候 ❌（v3/v4 明文「安静陪伴 ≠ 沉默」，保留存在感）

选 A。守恒论证：任意外发触点（温和问候或 Bandit 主动）都受同一 ≥3.5 天间隔闸门约束，每周触点 ≤⌊7/3.5⌋=2，不超过既有「每周 ≤2」承诺；问候不计 proactiveCare.count、不标 pendingArm（不占周上限、不喂 Bandit 噪声 reward——低能量 ping 的回应率会污染臂学习）。问候优先占用槽位（更轻的打扰先出），Bandit 主动在问候当日已用时照常走计数+reward 路径（口径不改）。

**O4 陈旧 PAD 处理**
- A. loadMoodState 内三分支：新鲜合并 / 超 24h 归中性基线 / lastUpdate 缺失非法归中性 ✅
- B. 维持旧语义（陈旧保持构造时的持久化副本）❌（等于没防重启假情绪——构造函数已复制 saved.pad，旧分支恒 no-op 死代码）

选 A。归中性不主动写盘，随既有 60s 衰减落盘基线自愈；mood.test.ts 一处断言按票面新语义同步收窄（55→50，见测试节）。

## Consequences

- smartcat.json 仅新增可选字段 `editingData.quietMode = {on, since}` 与 `editingData.gentleGreeting = {day, at}`（本地日历日键），旧数据零迁移容忍；Bandit 结构（ceBandit 臂参数/pendingArm/reward 口径）零改动。
- 新模块 `src/smartcat/quiet-gate.ts` 全纯函数（读态容忍/采样去重/多数表决/迁移表/臂→温和映射/日键）+ QuietGateSystem 薄壳（内存写回 + 既有 dataSaver 落盘，无自有定时器）；接线点三处：ensureSmartCat 挂 onDecayTick 钩子、maybeTrendDrift 心跳喂数、maybeProactiveCare 读 quiet 态换间隔与话术。
- MoodSystem 新增可选 `onDecayTick` 钩子（60s 循环每 tick fire-and-forget，采样失败不影响衰减）；loadMoodState 激活并在 ensureSmartCat 装配时调用。
- 全部阈值为出厂常量（QUIET_VALENCE_THRESHOLD=0.2 / 窗口 5 / 边界 3 / 采样最小间隔 10min / QUIET_PROACTIVE_INTERVAL_DAYS=3.5 / 静默超时 48h），「晨起可调」= 改常量一行；设置面板零新项。
- 无新 LLM 调用（温和问候为纯本地语料池；Bandit 主动的 LLM 路径仅换 styleHint 来源）。
- 已知边界：情绪观察 <3 条时心跳不喂门控（无数据缺省不动）；窗口缓冲为内存态，重启后随首个心跳重建（quietMode 状态本身已持久化，行为连续）。

## 测试

tests/smartcat/mood-gating.test.ts 40 用例：窗口采样（最小间隔去重/保尾截断/非法存量容忍）、多数表决边界（0/1/2 样本不判、2/3 与 3/5 多数、阈值严格小于、exit 只看最近 3 条）、状态机迁移表（enter/exit/timeout 恰 48h 边界/趋势优先于兜底/幂等不落盘）、间隔口径（2 天 vs 3~4 天域）、温和子集映射（任意臂 × rng 都落在子集/未知臂回退/风格指令/问候语料池含提案点名句）、日键与每日一次判定、loadMoodState 三分支（新鲜合并/恰 24h/陈旧归中性/lastUpdate 缺失与非法缺省）、QuietGateSystem 集成（null 不动/enter 落盘幂等/exit/跨源最小间隔/衰减钩子复用缓存/超时兜底/isQuiet/预置态 exit 不误判 enter）、ensure 装配冒烟（钩子就位/internals 单 json 持久化/unload 置空）、豁免端到端（周上限已满仍发问候但 count 不动 pendingArm 不标/同日第二次静默/安静期 3 天不发/非安静期同状态正常计数路径标记 pendingArm）。既有 mood/interaction 测试全量保留回归（mood.test.ts loadMoodState 陈旧断言按票面语义收窄为归中性）。