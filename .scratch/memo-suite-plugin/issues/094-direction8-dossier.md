# ticket 094 —— 方向八：关系史沉淀（086 v4）

状态：**READY-FOR-AGENT**
父文档：086-intelligence-evolution-proposal.md v4「方向八」（裁决：砍负面低谷展示，只留正性）
基线：以合并时 master HEAD 为准（≥6419c06）；开工前先 git log 确认
日期：2026-08-24

## ⚠ 范围适配（089 里程碑已 REJECTED 的替代数据源）

v4 原文「里程碑事件事件级即写 dossier」依赖已被否决的 applyMilestoneEvent 通道。
**替代定义**：dossier 事件表从记忆流派生——观察入流时按来源白名单即写事件：
{ domain:library(读完书), letter/poem 首落, movie 打分, diary 首落 } → type 映射正性事件。
幂等键 eventId = 记忆条目 id（天然唯一，防重建重复）。信任数值完全不动。

## 设计（v4 裁决逐条落地）

1. **事件级即写**：index.ts onObservation 钩子处（或 addObservation 后接线点）按白名单写
   `editingData.dossierEvents: [{ eventId, type, at, title? }]`（环形 ≤200，eventId 幂等去重）
2. **批重建按事件表重放**：dashboard 渲染 = 纯函数 deriveTimeline(dossierEvents)，
   不反查记忆流（流会增长/裁剪，事件表才是稳定源）
3. **周键调度独立**：叙事摘要挂 `editingData.dossierScanKey`（weeklyReport 同款周键格式），
   独立退避，不共享 reflectBackoffUntil
4. **默认纯本地派生零 LLM**：时间线文案模板拼接（「8 月你读完了《X》、写了 N 封信」）；
   叙事润色可选 LLM 且失败静默（H4 边界继承：USER_CONTENT_BOUNDARY + 异常裁剪）
5. **低活跃兜底**：时间线至少含陪伴天数（观察去重日计数）+ 正性事件计数，
   不依赖反思/digest 产出
6. **关键时刻二选一 → 选「情绪标签变化日 + 当日备忘」**（零新增持久化，兼容冻结友好；
   每日 PAD 快照方案放弃——晨起可调）：情绪标签变化 = 当日入流观察 emotion 多数标签
   与前一日不同
7. **只留正性**：低谷/负面事件一律不入时间线（v4 砍负面展示裁决）
8. UI：dashboard 新区块「一起的日子」时间线，样式收敛 styles.css（bz- 前缀），DOM 契约稳定

## 明确不做

- 任何 trust/attachment 数值写入
- 负面事件展示
- 设置面板新项

## 测试要求

- eventId 幂等（同 id 二次不重写）；环形截断；白名单过滤（非正性来源不入）
- deriveTimeline 纯函数（空表兜底陪伴天数行；排序；周聚合文案模板）
- 情绪标签变化日检测；周键推进与退避独立性
- UI 测试（新区块渲染 + 空态）；既有测试全量保留

## 工程规约

同 091 号票（exFAT pwsh 写盘 / git -c safe.directory 双参 / Conventional Commits 中文 /
.scratch add -f / flake 协议 maxWorkers=4 / 完成门禁 test+tsc）。汇报 ≤15 行。