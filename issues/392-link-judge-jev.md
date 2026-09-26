# 392 · 自动关联裁判接入 Jev（多维判定 + 失败回落 LLM）

> labels: feature ｜ map: — ｜ status: todo ｜ assignee: — ｜ blocked-by: 389, 391
> 上游：ADR-0173（判定口径以 Jev 为准）、ADR-0141（关联范围恒为三盒）
> 实现于 `wt/bz-link-judge-jev`

## 背景

`secondbrain/link-agent/pipeline.ts` 的裁判目前是用生成模型做判定：`buildJudgePrompt()` 把新笔记与
候选笔记的档案卡拼成一段 prompt（`JUDGE_PROMPT_PREFIX` + 要求吐严格 JSON 数组 `[{"id":n,"reason":"…"}]`），
经 `AI.ask`（`core/ai`）返回后由 `parseJudgeOutput` 解析。

三个问题：① 输出要解析，解析失败即整篇失败并入队重试；② `reason` 字段解析后**从未被消费**
（`links = picks.map(p => candidates[p.id - 1])` 只取 `path`），纯浪费输出 token；
③ 让模型「按关联强度降序」输出数组，顺序不可靠。

**一个「是否关联」的笼统问题，把不同性质的关联压成了同一个数字。** 而不同性质的关联应有不同的容忍度：
「直接引用 / 同一人物事件」几乎不会误判，可以宽；「同一主题」极易误判（整个心理学领域的笔记都
「同一主题」），必须严。单问句给的是综合感受，做不到这一点——**拆成独立维度才做得到**。

### 「关联预演」不是独立接入点，是同一个裁判的另一个出口

```
knowledge/ui.ts:3082    bridge.preview(content, title, {signal})   ← 录入面板「关联」行（实时预演）
knowledge/ui.ts:3133    bridge.preview(content, title)             ← 落盘前兜底
  → core/link-now.ts 的 getLinkBridge()
  → secondbrain/index.ts:101  setLinkBridge(createLinkBridge(linkAgent, …))
  → link-agent/watch.ts:69-71  preview: (…) => agent.previewLinks(…)
  → pipeline.ts:310  previewLinks()
  → pipeline.ts:336  AI.ask(buildJudgePrompt(ghost, …), {signal})   ← 本票第二处改造点
```

`apply()` 只写 frontmatter、**不调 AI**，不受本票影响。
因此本票要改的是**两个调用点**（280 / 336），共用同一套裁判实现。

**两条路径有一处实质差异，必须在实现时想清楚：**

| | `processNote`（280，后台/批量/队列） | `previewLinks`（336，录入面板实时预演） |
|---|---|---|
| 新笔记档案卡 | `dossierCard(真实 TFile)` → 标题 / **tags** / **summary** / 首块 400 字 | `ghost` 伪 TFile（**草稿未落盘**）→ 只有标题 + 草稿正文，**无 tags、无 summary** |
| 失败语义 | `enqueuePaths` 入队重试，可延后 | `{status:'failed'}` 返回面板，「关联」行显示失败态 |
| 取消 | 无 | **有 `AbortSignal`**（issue 327）——Jev 通道必须同样支持（见 389 §决策 4） |

**Q14 定稿（2026-09-21 用户决策）：预演路径与后台同规则——Jev 失败即当次回落 LLM。**
`commitEntryLinks()`（`knowledge/ui.ts:3121`）已有的「预演 failed → 转后台管线」兜底保留，
作为两道都不可用时的最终保障。

> ⚠ 叫法澄清：本库的「**AI 关联建议**」指**挂载树的幽灵节点**（`mount-suggest.ts` 顶栏徽标），
> **不是**录入面板的关联行，**不在本票范围**。

## 决策

1. **抽一个私有裁判方法，两个调用点共用**（避免两处各写一份必然漂移）：

   ```ts
   private async judge(
     selfFile: TFile, selfContent: string, candidates: SearchHit[],
     opts?: { signal?: AbortSignal }
   ): Promise<SearchHit[]>   // 返回选中的候选（已按强度降序、已剔除自身与不存在的文件）
   ```

   `processNote` 与 `previewLinks` 都改成调它：前者失败 → `enqueuePaths` 入队；
   后者失败 → 返回 `{status:'failed'}`。**筛选与排序只在 `judge()` 里做一次。**

2. **每个候选问三个独立 Noul 维度**（一次调用问完所有候选的所有维度，**加问不加价**）。
   问题键固定为 `c{i}_topic` / `c{i}_ref` / `c{i}_complement`（`i` = 候选序号，与
   `buildJudgePrompt` 的 `id` 同序）：

   | 维度 | 问法要点 |
   |---|---|
   | `topic` 同一主题 | 两者讨论的是同一个主题、概念或问题 |
   | `ref` 直接指向 | 一方直接引用、明确提及或指向另一方（含同一人物 / 事件 / 作品 / 术语） |
   | `complement` 内容互补 | 一方是另一方的展开、解释、案例或反例 |

   `state` 沿用现有档案卡拼接（`JUDGE_PROMPT_PREFIX` 那套文案改成 Jev 的 `instructions` 口径），
   不再要求模型输出 JSON。

3. **建链判据在代码里，不看模型返回的顺序**：

   ```
   ref ≥ M  或  (topic ≥ M 且 complement ≥ M)        M = JUDGE_DIM_MIN = 0.5
   ```

   - **用逻辑组合而非加权和**：权重是无法解释的魔术数字，逻辑规则可读、且能回答
     「为什么这条建了链」；三个维度共用同一个阈值，不需要各自校准。
   - **顺序也由代码定**：`score = max(topic, ref, complement)` 降序（同分保持候选原序，
     即向量相似度降序）。这替代了原来那个「让模型按强度降序输出」的不可靠约定。

4. **`JUDGE_DIM_MIN` 是代码里的具名常量，不新增设置键。** 首版 0.5 是**拍的**——
   三维拆分的判定数据还没有（实测只有单维度 Noul 的数据）。灰度后按真实误建率调，
   **调阈值不需要动提示词**，这正是把判据放进代码的意义。
   注意：既有的 `linkAgentMinScore`（0.65）是**候选向量相似度下限**，与裁判阈值是两件事，别混用。

5. **理由由命中的维度拼出来**（如「直接指向」「同一主题 · 内容互补」）——**不新增 LLM 调用、
   不写入 frontmatter**。仅随返回结果供调试与批次日志使用。旧 prompt 里那个要模型写的
   `reason` 字段彻底退役。

6. **失败即当次回落 LLM**（ADR-0173 §2）：Jev 抛错时，在同一次 `judge()` 内用**现有 prompt
   与 `parseJudgeOutput`** 再跑一遍。回落对用户不可见，**降级不通知、不落盘标记**。
   - **取消不算失败**：`signal.aborted` 时直接抛出，**不触发回落**（用户主动放弃，回落等于白烧一次 LLM）。

7. **两道都不可用**（Jev 抛错 + `AI.ask` 也抛错）→ 维持现有行为：`enqueuePaths` 入队待重试，
   **不引入第三层兜底**。

8. **`data.ts` 的 `parseJudgeOutput` 与 `buildJudgePrompt` 一并保留**——它们是回落路径的实现，
   不是死代码。仅删掉 `JUDGE_PROMPT_PREFIX` 里那个要求 `reason` 的输出格式约定
   （回落路径同样不该再让模型写理由）。

9. **Jev 返回的 `answers` 缺键按 0 处理**（普通情况：某候选的某个维度没答）；但
   **`answers` 整体缺失或非对象 → 视为响应畸形，抛错走回落**，不静默当成「零命中」——
   那会让一次故障伪装成「这批笔记确实没有关联」。

10. **`jevEnabled` 为关时**直接走原 LLM 路径，行为与本票之前完全一致（零风险回退）。

## 测试

`tests/secondbrain/` 下新增/扩展：

- **mock Jev 三维答案** → 建链集合与判据一致：
  - 仅 `ref` 高（≥0.5）→ 建链（单靠直接指向就够）；
  - 仅 `topic` 高 → **不建**（同主题不算，这是本票的核心口径）；
  - `topic` + `complement` 都高 → 建链；
  - 三维全低 → 不建；
  - 恰好等于 `JUDGE_DIM_MIN` → **建链**（`≥` 语义，边界要有断言）。
- **顺序来自代码**：构造一组「返回顺序与强度顺序相反」的 mock，断言结果按 `max(...)` 降序，
  且 `linkAgentMaxLinks` 截断时保留的是高分那条。
- **Jev 抛错 → 回落 LLM**：断言确实调用了 `AI.ask` 且结果正确，而不是返回空。
- **`signal` abort → 不回落**：断言 `AI.ask` **零调用**。
- **`answers` 整体缺失 → 回落**（不静默零命中）。
- **两道都抛错 → 入队**：断言 `link.queue` 有条目、`status === 'failed'`。
- **`jevEnabled=false` → 不碰 Jev**：断言零 Jev 调用，走旧路径。
- 预演路径（`previewLinks`）与主流程（`processNote`）**共用同一裁判**，两处都要覆盖。
- `smoke.test.ts` 同步。

## 遗留

- **存量 related 不重跑**（ADR-0173 §4）——库里会同时存在两种口径建的链，这是有意接受的不一致。
- **三维阈值 0.5 未经真实数据校准**（见决策 4），灰度后需回看。
- **挂载树 AI 语义建议**（`mount-suggest.ts` 三段式）不在本票范围，**已决定不做**（理由见 spec）。
- **「待确认」中间档**不做（2026-09-21）：先跑「达标建链、其余丢弃」，等灰度看到中间地带实际有多大，
  再决定要不要给它一个界面。
