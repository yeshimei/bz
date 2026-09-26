# 386 · 小橘「更智能」批：关系阶段 / 她自己的事 / 情绪惯性 / 记忆自动纠错 / 追问线

> labels: wayfinder:task ｜ map: 346 ｜ status: done ｜ assignee: — ｜ blocked-by: —
> 上游：`docs/smartcat-companion-research.md`（八节路线的第一、三、四阶段）、`docs/smartcat-mechanism-audit.md`
> ADR：0172（本批）；实现于 `wt/smartcat-smart`

## 背景

机制审计与社区调研共同指向：**小橘不浅在机制，浅在连线**——状态只流向显示层与 prompt 素材，
零条流向行为决策；另有两条同源根因「无自主情绪源（纯镜像）」与「无纵向时间（每条独立结算）」。
用户拍板两条硬约束：①记忆与情感**全自动、黑匣子**；②要从「陪伴工具」变成**角色**。

## 本批范围（8 项，全部零新增 AI 成本）

1. **关系阶段派生**（`relationship.ts` 新建）——trust/attachment/互动量/相识天数派生五阶段
   （初见/熟人/朋友/知交/老友），门槛同时卡分数+次数+天数。**无任何用户可调项**。
   消费面：prompt（阶段 + 相处方式 + 表达许可）、数据面板感情卡（卡名带阶段 + 阶段进度行）。
2. **自我披露**（`buildSelfDisclosure`）——按她自己的 PAD/时段/特质/缺席/待回访线数合成
   「小橘自己的事」节，输入**不含用户数据**；用日键散列选文案（同日稳定、跨日变化）。
3. **情绪惯性**（`MoodSystem.inertiaFactor`）——衰减速率乘 ≤1 的系数：偏离越远越慢、
   负面额外 ×0.7、高唤醒额外 ×0.8。只改速率，不改半衰常量与增益路径。
4. **记忆自动纠错**（`detectRevisions` / `applyRevisionInvalidation`）——修正语气闸门 +
   「同一件事」双重近似（bigram 重叠 ≥2 或共有 ≥3 字连续子串）；
   洞察走既有 `supersededBy`，观察走新增 `invalidatedAt`（credibility 折半，下限 0.05）；**不删数据**。
5. **记忆不确定语感**（`memoryHedge`）——低可信/未核实/久远未检索 → 回显带前缀。
6. **追问线**（`open-threads.ts` 新建）——确定性抽取前瞻句 → `editingData.openThreads`；
   TTL 21 天、进 prompt ≤2 条、6 小时冷却；保守了结判定（宁可漏收不误收）。
7. **表达护栏**（`prompts.ts`）——AI 身份声明 + 边界三条（不侮辱/不鼓励自伤/不操控；
   危机措辞先陪着再建议求助）。
8. **主动消息复读抑制**（`messages.ts`）——每 key 记住最近 3 条并从候选排除。

## 有意未做（避免与 `bz-369-smartcat` 在途工作撞车）

- A1 效用闸门（mood/特质 → 主动时机与频率）、A7 臂池换具体生活事件、F5 臂模板与文案合一
  ——三者都落在 `maybeProactiveCare`，等 369 落地后在主仓统一做。

## 已知遗留（本批发现，另开票候选）

- 域事件与聊天消息经 `routing.ts` 落**行为流**；记忆流里的「用户事实」主要由
  reflect / digest / 周报 / dossier 承载 —— 用户当场的说法要经一次反思才进记忆。
  属路由契约层，改动面大。
- 心境一致检索（`retrieve` 的 GA 加法公式是 096 冻结契约）。
- 沉默退让（涉及主动调度计数）。

## 交付

- `docs/adr/adr-0172-smartcat-relationship-inner-life.md`
- 新增测试 5 个文件：`relationship` / `open-threads` / `memory-revision` / `mood-inertia`，
  以及 `messages` / `companion-context` / `dashboard-097` 的追加用例。
