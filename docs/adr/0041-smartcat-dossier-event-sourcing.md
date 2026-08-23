# ADR-0041：关系史沉淀（dossier 事件表派生 + 只留正性 + 独立周键叙事）

日期：2026-08-24 ｜ 状态：Accepted ｜ 关联：ticket 094（086 v4 方向八）、ADR-0021（记忆流）、ADR-0037（H4 安全契约）、ADR-0039（洞察版本化）

## Context

方向八要求「关系史沉淀」：把相处中的重要时刻沉淀为可视的时间线。v4 原方案依赖
applyMilestoneEvent 里程碑事件通道，但该通道随 089 一起 REJECTED，需要替代数据源。
同时裁决：砍负面低谷展示（只留正性）、零 LLM 默认（本地模板拼接）、低活跃也要有内容、
smartcat.json 兼容冻结（只加可选字段）。

## Options

**O1 dossier 数据源**
- A. 记忆流派生事件表：观察入流时按正性白名单即写 `editingData.dossierEvents` ✅
- B. 恢复 applyMilestoneEvent 里程碑通道 ❌
- C. 渲染时反查记忆流实时过滤 ❌

选 A。理由：记忆流会增长/裁剪/条目会被未来机制改写，不是稳定展示源；
事件表以记忆条目 id 为幂等键（eventId 天然唯一），即写即存，dashboard 用纯函数
deriveTimeline(dossierEvents) 重放重建——不反查流。白名单从记忆流派生：
domain:library 读完书 / letter、poem 首落 / movie 打分 / diary 首落 → 五类正性事件，
匹配各 source 模块用户拍板的固定句式（删除/更新/diff 句式天然不命中=只留正性）。

**O2 关键时刻形态（二选一裁决项）**
- A. 情绪标签变化日 + 当日备忘 ✅（零新增持久化）
- B. 每日 PAD 快照对比 ❌（晨起可调，噪声大）

选 A。当日入流观察 emotion 多数标签 ≠ 前一有标注日多数标签 → 该日为关键时刻，
当日备忘标题由 dashboard 现读 memo.json（读失败静默），全程零新增持久化。

**O3 叙事摘要调度与退避**
- A. 独立周键 `editingData.dossierScanKey` + 内存失败退避 ✅
- B. 共享 MemorySystem.reflectBackoffUntil ❌

选 A（票面明示）。每周至多一次成功生成；LLM 未配置静默跳过不推进周键，
失败静默 + 30 分钟内存退避重试（重启即重置，周键才是持久化去重位）；
成功产出写回记忆流 insight（source=dossier，对齐 weekly-report 先例），
不占 editingData 新字段。prompt 继承 H4 USER_CONTENT_BOUNDARY + 输入 1200 字符裁剪。

## Consequences

- smartcat.json 仅新增可选字段 `editingData.dossierEvents`（环形 ≤200 保最新）与
  `editingData.dossierScanKey`，旧数据零迁移容忍；trust/attachment 等信任数值完全不动。
- dashboard 总览新区块「一起的日子」恒含兜底统计行（陪伴天数=观察去重日计数 + 正性事件计数），
  不依赖反思/digest 产出；样式收敛 src/smartcat/styles.css，无新设置项、无新命令。
- 时间线文案为本地模板拼接（默认零 LLM）；LLM 只做可选润色且失败静默，面板永远有内容可看。
- 白名单句式与 note-source/diary-source/movie-source 文案耦合（措辞不得自改的既有约定使然）；
  未来文案改动须同步 dossier.ts 匹配器（已在模块头注释标明）。

## 测试

tests/smartcat/dossier.test.ts 18 用例：白名单五类命中+非白名单不入、eventId 幂等、环形截断、
editingData 兼容（null 兜底/既有字段保留）、getDossierEvents 防御归一、countCompanionDays、
deriveTimeline（空表兜底/跨周排序/聚合模板/无效时间防御）、情绪标签变化日检测（多数标签/
断链跳过/并列确定性）、shouldScanDossierNarrative 与 advanceDossierScanKey 独立性
（weeklyReport/reflection 字段原样）、generateDossierNarrative 三态（未配置/成功/失败静默）、
UI 区块渲染（时间线/兜底统计/叙事/关键时刻当日备忘/空态）。既有测试全量保留回归。