# 431 · 第二大脑重排第二通道：Jev 重排开关（与本地 Qwen3-Reranker 二选一）

- 状态：已拍板（设计定稿 2026-09-24，实现待启动）
- 用户原话：「可以，定义为第二通道，给一个开关，打开了就使用ai面板设置的jev模型通道，走重排。打开jev，本地模型的选项会被隐藏，两者只能二选一」
- 关联：issue 427 + ADR-0186（本地重排通道基线，本票不改其任何语义）/ issue 429（`rerankScore` 显示同尺机制，Jev 通道复用）/ issue 428 + ADR-0187（取消语义，口径原样沿用）/ ADR-0181（`judgeOrFallback` 编排纪律）/ issue 430 + ADR-0188（Jev 服务商注册表，与本票正交——重排走哪个 Jev 服务商由 JEV 组配置决定）/ ADR-0173（Jev 判定通道本体）/ ADR-0185（余弦是阈值唯一尺，本票不动）
- 号位说明：430 / ADR-0188 已被并行会话的博查接入占用（同日落 master），本票顺延 **431 / ADR-0189**

## 背景与目标

本地重排（ADR-0186）整条链绑「嵌入模型 = Qwen3-Embedding-8B」门（显存共驻考量），且依赖本机 Ollama 装有 Qwen3-Reranker。用户提出用 Jev 决策模型（`core/jev.ts` 判定通道）做**第二重排通道**：云端 noul 判定给出每候选 0–1 连续相关概率，不吃本地显存、不依赖本地重排模型——非 8B 嵌入 / 移动端 / 未装 Reranker 的场景第一次能用上重排。

前置事实（设计访谈时核实）：

1. Jev `noul` 题型返回 0–1 校准概率，与本地通道 P(yes) 语义几乎一对一；一次 `askJev` 可带整批问题（实测单次 1–2s，固化超时 10s），在重排段 6s 预算内。
2. Jev 是云端服务：候选笔记摘录会上 Typesafe（或博查，ADR-0188）——隐私代价已向用户明示并拍板接受。
3. state 体积未实测（50 条 × 摘录长度的服务端上限未知），实现时需探针定截断终值。

## 拍板记录（grill-with-docs 七问，2026-09-24）

| # | 决策点 | 拍板 |
|---|---|---|
| Q1 | 开关层级 | **总闸 + 通道开关**：「启用重排」保持总闸、改常显；其下新增「重排走 Jev」。总闸关 = 重排全关；总闸开 + Jev 关 = 本地通道（现状）；总闸开 + Jev 开 = Jev 通道，本地「重排模型」行隐藏。二选一，无「总闸关了 Jev 还在跑」的怪态 |
| Q2 | 8B 嵌入门 | **Jev 通道解绑**：任何嵌入模型可用（Jev 通道最大增量）；本地通道维持 8B 门。两行各自「可见性 = 生效条件」，无暗态 |
| Q3 | 判定协议 | **noul 每候选一题**（连续 0–1 概率直接当 `rerankScore`；score 量表档位粗、并列多，正是 ADR-0186 反对的粗糙分）；state = 查询 + 编号候选清单；候选摘录初值 300 字/条（实测后调）；批上限沿用 `RERANK_MAX_DOCS = 50` |
| Q4 | 失败回落 | **回余弦序、不落 LLM**：经 `judgeOrFallback` 编排、fallback 槽位填「维持余弦序」（非 LLM——50 条逐条 LLM 在预算内不可能且白烧钱）；取消直抛 AbortError 不回落（ADR-0187 口径不变） |
| Q5 | 开关归属 | **Embedding 组**，紧挨总闸；JEV 组保持「判定通道凭据卡」不动 |
| Q6 | 缺题语义 | **缺题键 = 整轮畸形回余弦**。有意偏离 link-agent 决策 9 的「计 0」：那是建链「宁少建不误建」场景；重排计 0 会把相关条目沉底，即 ADR-0186 反对的半排观感 |
| Q7 | 空转提示 | **静态 desc 说门槛**：总闸 desc 写双通道各自门槛（本地需 8B 嵌入 / Jev 需 JEV 组密钥）；Jev 开关 desc 写「未填密钥自动回退余弦序」。不做动态警示条（不为边缘状态动设置行渲染器） |

## 实现口径（非决策，按仓库惯例固定）

- 新键 `secondBrainRerankJev`（bool，默认 `false`——存量用户行为零变化），随 `DEFAULT_SETTINGS` 落盘，无迁移。
- 检索侧生效判定收单源 `rerankChannel(): 'off' | 'local' | 'jev'`（`secondbrain/config.ts`）：`off` = 总闸关；`local` = 总闸开 ∧ Jev 关 ∧ 8B 嵌入（原 `rerankActive()` 语义）；`jev` = 总闸开 ∧ Jev 开。设置行可见性与运行期共用，替代现有双头判定。
- Jev 请求超时 = min(固化 10s，重排段剩余预算 6s)；整轮仍受 `SEARCH_TIMEOUT_MS` 10s 约束；`> RERANK_MAX_DOCS` 的超长列表整轮跳过不变（150 建链池照旧不重排）。
- `answers[key].noul` 直接记 `hit.rerankScore` → 显示百分比与名次同尺（issue 429 机制复用，`relevancePct` 不动）；阈值仍只读余弦 `hit.score`（ADR-0185 单尺不破）。
- 查询截断沿用 `RERANK_QUERY_MAX_CHARS` 1000 字。
- 未配密钥 = `judgeOrFallback` 类别①（不发请求直接回落），与「填密钥即接管判定」的常开哲学不冲突——重排是检索链路环节，开关管的是「检索要不要这一层」，不是「判定通道开不开」。

## 计划落地清单

| 文件 | 改动 |
|---|---|
| `src/settings.ts` | 键 `secondBrainRerankJev`（默认 false） |
| `src/secondbrain/config.ts` | `rerankChannel()` 单源判定（替代 `rerankActive()` 双头） |
| `src/secondbrain/rerank-jev.ts`（新） | state 构造 + noul 问题批量构造 + 答案映射；经 `judgeOrFallback`，fallback = 维持余弦序 |
| `src/secondbrain/vector-store.ts` | `applyRerank` 按 `rerankChannel()` 分流本地 / Jev；通道内失败语义不变（整轮回余弦 + console.warn；取消直抛） |
| `src/core/settings-main-schema.ts` | Embedding 组「启用重排」改常显 + 新行「重排走 Jev」+「重排模型」行可见性叠 `!secondBrainRerankJev`；desc 按 Q7 口径 |
| `tests/secondbrain/rerank-jev.test.ts`（新） | state / 问题构造、noul 映射、缺题整轮畸形、未配密钥回落、预算收紧、取消直抛 |
| `tests/secondbrain/rerank-wiring.test.ts` | 通道分流用例（local / jev / off 各自生效与回退） |
| `tests/core/settings-schema.test.ts` | 显隐矩阵真值表（8B × Jev 开关 × 总闸） |
| `tests/smoke.test.ts` | 默认值断言（`secondBrainRerankJev === false`） |

## 遗留与取舍

- **state 体积未实测**：50 条 × 300 字 ≈ 15K 字的 state 是否触发服务端 422 / 限额未知——实现时用探针定截断终值（初值 300 字/条可下调）；超限则优先砍单条长度、不砍批大小（砍批大小会复现「半重排」混尺）。
- **隐私上云**：每次交互检索最多 50 × 300 字笔记摘录发往 Jev 服务商——已向用户明示并拍板接受；ADR-0189「后果」节留痕。
- **noul 与 P(yes) 无跨通道可比性**：两者都是 0–1 但校准分布不同——同一时刻只有一个通道生效（二选一），列表内同尺、无混尺；跨通道比较百分比无意义，亦无场景。
- **对话面板不另设通道开关**：重排接线在 `vectorSearch` 末尾（ADR-0186 决策 2「全部链路统一」），Jev 通道继承同一范围，不为对话单开分叉。
