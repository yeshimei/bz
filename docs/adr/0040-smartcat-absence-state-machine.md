# ADR-0040：单一缺席状态机（方向三+七合并 + 读侧依恋惰性视图）

日期：2026-08-24 ｜ 状态：Accepted ｜ 关联：ticket 093（086 v4 方向三+七 绿队 C 裁决合并）、ADR-0022（PAD 心情）、ADR-0023（MATE 人格）、ticket 088/H5（lastPresenceAt 在场口径）

## Context

方向三「牵挂/安心/重逢喜悦」与方向七「分离焦虑/重逢」在 v4 原文中各自为政，存在双写风险
（两套缺席判定、两套事件账本）。绿队 C 裁决合并为**单一缺席状态机**；同时方向七裁决
attachment 改读侧惰性算分。范围裁定：H1/090 已随 089 PARKED——本票不做任何 trust 写盘
衰减与分离降速倍率，只做状态机与表达层。

## Options

**O1 状态归属**
- A. 单一状态机持久化 `editingData.absenceState = { phase, since }` ✅
- B. 由 lastPresenceAt 每次现算派生 ❌

选 A。「牵挂中」是阶段而非瞬时函数值：需要 since 留痕与跨重启稳定；可选字段零迁移。
全库仅 absence.ts 一处迁移表（杜绝双写），天数换算复用 `data.getAbsenceDays`（H5 单一口径，
不自造第二套）。

**O2 阶段图**
- A. `normal → missing → reunion → normal` 三态环 ✅
- B. 增加「worry/anxious」中间态 ❌

选 A。v4 裁决只要求牵挂与重逢两类可表达状态；中间态徒增迁移面。missing 静默自愈
（缺席天数回落，如主动关心刷新在场）不补发事件——这是「同日不抵消」窗口的一半；
另一半是 normal 入边要求距上次在场 ≥24h（<24h 只走重逢分支），兼防时钟回拨边界抖动。
reunion 保持窗口 24h 内不再评估缺席，防止重逢当天又被判「再次牵挂」。

**O3 PAD 幅度域**
- A. [1.0, 1.8] 域收敛 + ≤0.5× 用户共振幅度帽 ✅
- B. 复用 EMOTION_RESONANCE_GAIN 原值 ❌

选 A。下限 ≥ MoodSystem.updatePad 落盘阈值 1.0（|adjusted|≥1 才 saveMoodState）——
低于它缺席情绪永远不可验证；上限对齐 handleInteraction 最小行量级，保证缺席永远弱于
用户真实情绪共振（applyEmotionResonance 同期差量为顶）。锚点情绪经 emotionResonanceDelta
取三轴最大绝对值为幅度基数（出厂 safe：miss=lonely→1.05、reunion=happy→帽压到下限 1.0）。
实现上不做十进制取整（1.05 类边界值会被浮点抖动翻档），精度交给 updatePad 落盘侧。

**O4 attachment 读侧惰性视图**
- A. `lazyAttachment(stored, lastPresenceAt, now)` 纯函数，只作用于读取展示 ✅
- B. 分离时定期写盘衰减存储基线 ❌（方向五域，兼容冻结明令不做）

选 A。半衰期 14 天指数衰减 + 地板 0.05，且视图永不高于存储基线；now 注入可测、
缺省容忍（无 H5 字段原样返回）。dashboard 统计的依恋项切换到该视图，存储基线零漂移。

**O5 画像参数**
- A. 安全/焦虑/回避三套为出厂内部常量候选（absence.ts 内注释标明），当前启用 safe ✅
- B. 进设置面板供用户选择 ❌（涌现不可配置原则）

**O6 触发源**
调度心跳挂 `memorySystem.onSchedulerTick`（复用既有 30s tick，不自建定时器）做缺席评估；
重逢判定 = 在场信号 + phase ≠ normal——观察路径统一经 `MemorySystem.onPresence` 新钩子
（addObservation→touchPresence 后触发），聊天/主动关心路径在其 touchPresence 后直呼信号。

## Consequences

- selfEvents 环形缓冲（≤20）持久化 `editingData.selfEvents`：表达先于数值（体验原则 3），
  dashboard 总览新增「缺席状态」卡直接呈现阶段与最近事件，不依赖 PAD 可见性。
- 缺席情绪差量走既有 updatePad（人格调制/60s 衰减生效），reason 标记 `absence:miss|reunion`
  可溯源；单次迁移至多一次 dataSaver 落盘（PAD |adjusted|≥1 时 mood 侧可能并发再存一次，幂等）。
- smartcat.json 只新增可选字段 `absenceState/selfEvents`（editingData 内部），旧数据零迁移容忍。
- 明确不做：trust/attachment 写盘衰减、任何新增 LLM 调用、设置面板新项；降速倍率留待方向五
  重新定义后另票。

## 测试

tests/smartcat/absence.test.ts 36 用例：迁移表全覆盖（normal/missing/reunion × 边界 N 天±1ms/
24h 恰好/时钟回拨/缺省容忍）、同日不抵消端到端（先牵挂后重逢两账分离 + 重逢窗口内心跳不补牵挂）、
PAD 幅度域与共振帽数学断言 + updatePad 输入 ≥1.0 验证、环形截断与脏输入容忍、
lazyAttachment（半衰期/地板/回拨/单调/now 注入）、AbsenceSystem 集成（幂等/落盘/旧数据/
无 PadWriter）、onPresence 钩子触发、dashboard UI（缺席卡渲染/依恋惰性视图不改存储）。
既有 presence/dashboard/mood/memory/data 套件全量保留回归。