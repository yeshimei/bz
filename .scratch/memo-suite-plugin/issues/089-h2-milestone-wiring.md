# ticket 089 —— H2 接线段：里程碑事件通道 + trust 写点（设计确认稿）

状态：**REJECTED**（2026-08-24 用户拍板：里程碑机制无感，不做。留档备查）
父文档：086-intelligence-evolution-proposal.md v4「H2」「方向五」
日期：2026-08-24

## 一、要修的结构性缺失

全库 trust 写点唯一入口 = `developBasedOnInteraction`（mood.ts:347）。warm 集 {learn, talk, diary, flash}：
learn 死接线（零调用者）、diary/flash 已随 077/083 移除——**实际只剩 chat 一条活路**。
读书写信写诗这些高价值陪伴事件对信任零贡献，trust 只能靠聊天单线爬升。

## 二、裁决口径（v4 权威层，含条目间冲突的消解）

- H2 条目原文：「直写 trustUpdate{warm, quality:0.5×cred}」
- 方向五裁决（更晚、且方向五是唯一返工方向）：「softUpdate **专用通道** δ≈0.003，**非 trustUpdate 现收拢**」
- **本设计按方向五裁决执行**：H2 条目成文于动力学返工定稿之前；若走 trustUpdate，
  cap+K(v−cap) 吸引子会吞掉线性增量（H1 结论），天数推算再次作废。

## 三、API 设计

```ts
// mood.ts（PersonalityGrowth 方法，与 developBasedOnInteraction 同层）
type MilestoneType = 'diary_first' | 'letter_first' | 'poem_first' | 'book_done';

applyMilestoneEvent(type: MilestoneType, credibility?: number): void
```

- **纯内存变异、无独立落盘**：契约规定调用点必须紧邻既有保存
  （settle 分支的下一条 addObservation 自带 dataSaver，整个 SmartCatData 一起持久化）。
  零新增 IO。
- 内部逻辑：
  1. `δ = 0.003 × clamp(credibility ?? ruleCredibility(来源), 0.25, 1)`
     （cred 0.9 的信/诗 → δ≈0.0027；0.6 的读书 → δ≈0.0018）
  2. `trust = softUpdate(trust, δ)`（character.ts 既有 logistic 饱和，永不到 1.0；
     **绕开 trustUpdate**——不经 cap+K 收拢、不走 erode 分支）
  3. attachment 慢跟随一行（ATTACHMENT_FOLLOW，对齐 developBasedOnInteraction L349 语义）★设计决策点
  4. `tickBehaviorStats('milestone')`：tone 表加中性行（计数进 interactionCount、基调 ±0）
  5. growthHistory.push({ source: 'milestone', type, traitsBefore })
  6. **旁路** characterTransition 特质微移（里程碑是关系事件，不是情绪事件）

## 四、挂点（全部边缘触发，天然只发一次）

| 挂点 | 位置 | 防重依据 |
|---|---|---|
| 日记首落 | index.ts settleDiaryEntry `settled.kind === 'first'`（~L1400） | generated 边沿触发；重启基线预置不触发 |
| 信/诗首落 | index.ts settleNoteFile 补首落/首产分支（~L1650/L1667 observed） | observed/generated 边沿 |
| 读完书 | index.ts consumeLibraryDiff `diff.done` 循环（L1766） | weave prev done 键记账，一书一次 |

**升级日规则（防存量爆发）**：ensure 时若无 `editingData.milestoneSince` 则写入当前时间戳；
挂点只在 `观察.created >= milestoneSince` 时发里程碑。重启基线补发的存量首落被此规则挡住。

## 五、测试要求

- 纯函数层：δ 缩放边界（cred 缺省/0.25 钳位/1.0）、softUpdate 不越 0.999、attachment 跟随方向正确
- 接线层：日记首落恰发 1 次（补写不发）；重启基线不发；存量补首落被 milestoneSince 挡；
  读完书二次 done 不再发（prev 记账）；tickBehaviorStats 中性行
- 回归：现有 trust 相关测试全量不动

## 六、开放问题（用户拍板）

1. attachment 是否随里程碑跟随？（本稿建议：跟随）
2. 影视「标记看过」是否入 milestone 集？（v4 未点名；本稿建议：暂不入，枚举留扩展位）
3. milestoneSince 首次升级日 = 发版当天，此前已存在的信/诗永不补发——接受吗？