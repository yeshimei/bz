# 541 · 知识盒自动关联：建链白跑一轮本地重排 + 点确认写入重跑一整轮

## 症状

创建文献笔记（名词 / 段落 / 图版）时，属性区「关联」行的"分析中…"体感特别慢。

本机实测口径（vault：232 篇 / 3259 块 / dim 4096 / `qwen3-embedding:8b` / `linkAgentTopK = 15`）：
主链路 = 本地重排 45 对串行（预算 6s）+ Jev 裁判 1–2s + 一次索引刷新。

## 根因 1：建链候选池落在重排窗口内，白跑一轮本地 4B 重排

`applyRerank` 用 `hits.length > RERANK_MAX_DOCS`（50）判别"后台长列表"并整轮跳过重排
（`src/secondbrain/vector-store.ts:739`）。而建链的池是 `max(TopK×3, 24)`
（`src/secondbrain/link-agent/pipeline.ts:493`）——**只有 TopK ≥ 17 才够得到 51**，
TopK ≤ 16 时池 ≤ 48，早退失效。

于是每篇文献笔记都白跑一轮 `rerankScores`（`src/secondbrain/rerank.ts:135-147`）：
45 次串行 HTTP 打到本地 Qwen3-Reranker-4B，整轮预算 6 秒（`RERANK_BUDGET_MS`）。

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
紧接着 `backgroundRelCommit` 从零再跑一轮（索引刷新 → 检索 → 45 对重排 → Jev 裁判）。

触发条件很常见：关联行还在转圈时点「确认写入」。越慢越容易点，越点越慢。

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
