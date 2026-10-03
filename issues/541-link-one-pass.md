# 541 · 知识盒自动关联：建链白跑一整轮重排 + 点确认写入重跑一整轮

## 症状

创建文献笔记（名词 / 段落 / 图版）时，属性区「关联」行的"分析中…"体感特别慢。

本机实测口径（vault：232 篇 / 3259 块 / dim 4096 / `qwen3-embedding:8b` / `linkAgentTopK = 15`）：
主链路 = 一轮重排（走 `rerankChannel()` 当前生效通道，预算封顶 6s）+ Jev 裁判 1–2s + 一次索引刷新。

报障时通道是 **local**（`secondBrainRerank = true`、`secondBrainRerankJev` 未开）→ 45 对串行
打到本地 `Qwen3-Reranker-4B:Q4_K_M`。用户事后自行在设置里开了 Jev 重排，通道判定随即变 **jev**
（`src/secondbrain/config.ts`：总闸开后**先查 Jev 开关**，为真即 jev，不落到 local）——
两者都是「一次额外裁决调用」：local 是一次本地 4B 载入 + 45 对，jev 是一次云端批问。
**本次修复对两条通道同时成立**（跳过的是整轮重排，与通道无关）。

## 根因 1：建链候选池落在重排窗口内，白跑一整轮重排

`applyRerank` 用 `hits.length > RERANK_MAX_DOCS`（50）判别"后台长列表"并整轮跳过重排
（`src/secondbrain/vector-store.ts:739`）。而建链的池是 `max(TopK×3, 24)`
（`src/secondbrain/link-agent/pipeline.ts:493`）——**只有 TopK ≥ 17 才够得到 51**，
TopK ≤ 16 时池 ≤ 48，早退失效。

于是每篇文献笔记都白跑一轮重排（`applyRerank` → 生效通道；本地通道走
`src/secondbrain/rerank.ts` 的 `rerankScores`，Jev 通道走 `src/secondbrain/rerank-jev.ts` 的
`jevRerankScores`），两通道共用 `RERANK_BUDGET_MS = 6000` 的整轮预算——**跑穿即抛错回落余弦序，
那 6 秒照付不回收**。

**为什么是白跑**：

- `vectorSearch` 的成员集在重排**之前**就锁定了（`vector-store.ts:707-715` 按余弦排序去重截断，
  `:716` 才调 `applyRerank`）——重排只能换序、不增删；
- `applyRerank` → `rankByScores` 也只换序 + 挂 `hit.rerankScore`（`:763-768`），`hit.score` 明确不动；
- 下游 `findCandidates` 只读 `hit.score`：过滤 `minScore`、排序 `b.score - a.score`、
  截断 `slice(0, topK)`（`pipeline.ts:503-513`）——重排换出的顺序被它按余弦重排覆盖；
- `rerankScore` 全仓唯一读取点是 `vector-store.ts:90` 的 `hitPercent`（面板百分比），
  link-agent 里一次都没出现。

即重排的产出（顺序 + 新字段）没有任何消费方。改动前后 `findCandidates` 拿到的 hits 逐条相同
（仅多一个没人读的 `rerankScore`）——这是**无行为变化的纯提速**。

> 重排对交互检索（参考面板 / 对话）是真收益：那两条链路按 `rerankScore` 显示百分比与名次。
> 问题在于建链与它们共用同一个 `vectorSearch` 入口、重排无条件接在末尾，于是建链搭了顺风车，只付耗时。

## 根因 2：关联行 loading 时点确认写入，一次操作付两遍

`commitEntryLinks` 在 `entryRelState === 'loading'` 时 abort 在途预演并起一次完整重跑
（`src/knowledge/ui.ts:3232-3237`）。

abort 是"假"的：判定通道走 `requestUrl`，该 API 无中止能力（`core/jev.ts` 模块头已写明
"只能立即拒绝、底层结果弃用"）。**已占用的算力与 token 收不回来**，只是结果被丢弃；
紧接着 `backgroundRelCommit` 从零再跑一轮（索引刷新 → 检索 → 一整轮重排 → Jev 裁判）。

触发条件很常见：关联行还在转圈时点「确认写入」。越慢越容易点，越点越慢。

## 实测（2026-10-03，本机 Ollama）

请求形状按真实实现复刻（嵌入 `/api/embed`；重排 `/api/chat` + `num_ctx 2048` + `num_predict 1`）。

| 项 | 耗时 |
|---|---|
| 查询嵌入 8000 字（`qwen3-embedding:8b`，冷/含装载） | 3505ms |
| 查询嵌入 8000 字（热） | **88ms** |
| 本地重排第 1 对（`Qwen3-Reranker-4B:Q4_K_M` 冷启动，含载入） | **4727ms** |
| 本地重排第 2 对（热） | 130ms |
| 本地重排 45 对串行（热，与嵌入模型共驻） | **2028ms**（45ms/对） |

三点结论：

1. **嵌入不是瓶颈**——热态 8000 字 88ms，`LINK_QUERY_MAX_CHARS = 8000` 的全文嵌入可留。
2. **本地通道的冷启动是致命的**：4B 载入 4.7s，加 45 对（≈2.0s 热态）→ 6.7s，
   **撞穿 6s 整轮预算 → 抛错 → 回落余弦序**。这 6 秒不但白付，连重排结果都没拿到——
   这正是「每次都特别慢、且每次慢得一样」的来源（冷态必熔断）。
3. 热态 45 对只要 2.0s，重排能跑完——但产出仍无人消费（根因 1），照旧白付。

修复前每篇 ≈ 一轮重排（6s 级，冷态即熔断）+ Jev 裁判 1–2s ≈ **7s**，与用户实测吻合。
修复后重排整轮消失（也不再把 4B 拉进显存），只剩裁判那一次云端调用 + 88ms 嵌入。

> 探测脚本：`.scratch/541-timing/`（直打本机 Ollama，不进库）。

## 修法

1. **给 `vectorSearch` 加显式跳过重排的通道**（第 5 参 `opts.skipRerank`），`findCandidates` 走它。
   判别权从"列表长度"还给调用方——那本来就是调用方才知道的事（建链只需成员集与余弦分）。
   `hits.length > RERANK_MAX_DOCS` 的早退保留，作为"未声明跳过的大列表"兜底。

2. **点确认时"接住"在途轮**：`loading` 时不再 abort + 重跑，而是把刚落盘的 path 交给这一轮，
   它出结果后直接 `apply`。这一轮从面板生命周期摘出（面板复位 / 关窗不再 abort 它），
   写盘由它自己收口。`abort` 的语义收窄成两种：**内容变了**（重新生成 / 图版重读）与
   **明确放弃**（关面板且没点确认）。

   边界：`loading` 却捞不到在途轮句柄（罕见错位态）时，仍走原 `backgroundRelCommit` 兜底——
   算不出来就不能假装有结果。

## 验收

- 建链侧：`skipRerank` 下不发起任何重排请求，且 hits 与"未跳过 + 重排失败回退余弦序"逐条一致；
- 知识盒 UI：关联行 loading 时点确认 → `preview` 只被调用**一次**，`apply` 收到该轮的 picks；
- 域测试 + `node scripts/test-affected.mjs --since master` 全绿。

## 明确不做

- 不动 `RERANK_MAX_DOCS` 与重排通道本身（交互检索照旧受益）。
- 不动挂载建议 / 每周撞车的检索（同类问题但不在本次范围；每周撞车是后台低频，另记）。
- 不改成"关面板且没点确认也算放弃"之外的新语义（关面板 + 已点确认 → 那一轮继续跑完并写盘）。
