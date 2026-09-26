# 428 · 第二大脑检索「只查最新」（新查询中断在途一轮）+ 空行不再触发查询

- 状态：已实现（2026-09-24）
- 用户原话①：「灵感参考，正在查询当中。如果变动了鼠标，或者新增了文字，也就是说，有了新的查询的时候，前面那个查询就中断掉，只查询最新的，可以做到吗？」
- 用户原话②（次日续报）：「另外，我发现放到空行里面，它也会进行一个查询，这是不应该的」
- 关联：ADR-0187（本票决策固化）/ issue 427 + ADR-0186（重排是接线末端，取消必须一路透穿它）/ issue 425 + ADR-0185（全扫是同步段，取消靠行间检查点）/ ticket 46（检索级 10s 超时降级是「失败」路径，与「取消」是两回事）/ ticket 141（面板失败提示）
- 号位说明：427 之后取 428；ADR 取 0187

## 背景与目标

参考面板常驻监听光标：打字或移动光标就会发起一轮检索（防抖 300ms + 500ms 轮询）。此前**在途的旧查询不会被取消**，于是快速改字时：

1. 一串查询在 Ollama 侧排队（查询嵌入 + 重排整列逐对串行 ≈1s/轮），越排越多；
2. 旧查询**后返回**时照样渲染 → 列表显示的可能是三轮前的文本的结果，与光标处内容对不上；
3. 每轮都吃满 GPU，最新一轮被压在队尾，体感「越打字越卡」。

第 2 条是本票的主诉：**列表态必须归最新查询所有**。

空行那条是同一个「什么时候该发起查询」的边角：旧实现里光标落在空行会**回退取上一行尾 300 字**当上下文（对齐 QA 闪念.js 的旧语义），于是「点一下空行」也会触发一轮与当前编辑动作无关的检索。

## 决策（详见 ADR-0187）

1. **最新胜出 + 真中断**：面板（桌面 `ReferencePanel` / 移动 `MobilePanel`）各持一个在途 `AbortController`。发起新一轮前 `abort()` 上一轮；关闭面板/抽屉也 `abort()`（已无接管者，请求没必要跑完）。中断是真的打到 HTTP 层——`fetch` 的 `signal` 一路透传：面板 → `store.search/searchMobile` → `vectorSearch` → `getEmbedding` / `rerankScores` → `rerankOne` → Ollama。
2. **取消 ≠ 失败**（这是本票最容易做错的地方）：`AbortError`（`name === 'AbortError'`，`core/abort.ts` 单源）与超时/连接失败分开处理——
   - 面板 catch 到中断：**静默 return**，不写 `检索失败…`、不写 `⚠ 已降级为文本匹配`（列表态已归新查询，旧一轮的失败/降级提示挂上去只会误导）；
   - `search()` 不因中断降级文本、不调 `onDegraded`；`applyRerank` 不因中断回退余弦序（回填旧序正好会盖掉新查询的列表）；`searchMobile` 远程向量一级被中断时直抛，不落 TF-IDF/文本级；
   - 超时（ticket 46 的 10s、`EMBED_TIMEOUT_MS` 30s、单对 20s/整轮 6s 预算）仍是失败路径，口径不变。
3. **取消检查点**：`vectorSearch` 在嵌入前后各一次，全扫是同步段 → `meta.notes` 每 64 篇查一次（检查开销相对点积可忽略）；`rerankScores` 每对之前查一次（取消后不再发起下一对）。**不引入「半完成」状态**——取消即整轮作废。
4. **检查点位置在早退之后**：`refreshContent()` 里「查询 < 2 字 或 与上一轮相同」的早退**先于** abort。反了的话：用户在原地打空格/重复词触发一轮早退，却把在途请求砍了、又没人接手 → 列表永远停在「检索中…」。
5. **空行 = 无上下文**：`getCurrentContext` 去掉「上一行尾 300 字」回退，整行空白即返回空串。面板据此短路——桌面保持现状（不刷新列表、留下上一份结果），移动端清空参考列表（与它既有的「< 2 字清空」行为一致）。顺带一个正面效果：不再出现「光标在空行 → 列表显示上一行内容的结果」这种对不上的状态。

## 落地清单

| 文件 | 改动 |
|---|---|
| `src/core/abort.ts` | 新增：`abortError()` / `isAbortError()` / `throwIfAborted()` / `linkAbort()`（外层 signal 链到内层 controller 并返回解绑函数） |
| `src/secondbrain/context.ts` | 空行回退删除 → 直接返回 `''` |
| `src/secondbrain/ollama.ts` | `httpFetch` 接 `signal`；`timedOut` 标记区分「取消」与「超时」（取消也会中断内层 controller，只看 `controller.signal.aborted` 会把取消误报成超时）；`getEmbedding` / `getEmbeddingsBatch` 透传 |
| `src/secondbrain/rerank.ts` | `rerankScores` 对间检查点 + `rerankOne` 透传 signal（同款 `timedOut` 口径） |
| `src/secondbrain/vector-store.ts` | `vectorSearch` / `applyRerank` / `search` / `searchMobile` 全部接 signal；全扫每 64 篇检查点；中断一律直抛 `AbortError` |
| `src/secondbrain/reference-panel.ts` | `inflight` 控制器（发起/关闭双中断）+ catch 首行 `if (ac.signal.aborted) return` + 成功分支「仍是本轮」门禁（`if (this.inflight !== ac) return`，review 收口补） |
| `src/secondbrain/mobile-panel.ts` | 同上（`refreshResults` / `close`） |
| `tests/core/abort.test.ts` | 新增：AbortError 判定 / 已中断即抛 / linkAbort 链式中断 + 解绑 + 幂等 |
| `tests/secondbrain/ollama.test.ts` | 取消报 AbortError 而非超时文案；取消后定时器已清（`getTimerCount() === 0`）；取消先于超时到达；`linkAbort` 解绑断言（取消 + 成功路径，review 收口补） |
| `tests/secondbrain/rerank.test.ts` | 已中断 signal → 一对都不发；打分途中取消 → AbortError（+ 取消路径解绑断言） |
| `tests/secondbrain/rerank-wiring.test.ts` | signal 逐层透传断言 + 取消不回退余弦序 + `search()` 取消不触发 `onDegraded` |
| `tests/secondbrain/reference-panel.test.ts` | 新查询发起即中断上一轮（旧 signal `aborted === true`、旧结果不回填、无失败文案）；关闭面板中断在途；**旧轮迟到 resolve 也不覆盖新轮**（review 收口补） |
| `tests/secondbrain/mobile-error.test.ts` | 移动端同两款（含关闭抽屉）；两条取消用例重写为真压门禁（旧轮悬着不落 → 新一轮先落定 → 旧轮再迟到 resolve / 以 AbortError 拒绝） |
| `tests/secondbrain/pure.test.ts` | 空行（含纯空格行）→ `''` |

## 遗留与取舍

- **取消态没有可见反馈**：列表停在「检索中…」直到新查询出结果。这是刻意的——旧一轮被自己主动砍掉，弹「已取消」纯噪声。
- **全扫检查点粒度 64 篇**：3193 chunk 的库全扫 ~27ms，64 篇 ≈ 1ms 一跳，取消延迟感知不到；换更大的库也仍是线性让出，不会退化成「取消要等一秒」。
- **`getEmbeddingsBatch`（索引侧）也接了 signal 但暂无人传**：索引是启动/显式触发的一次性任务，没有「换新查询」语义；留着通道是为了不把取消能力焊死在检索侧。
- 移动端「空上下文」与桌面端处置不同（清空 / 保留）——两端既有行为不同（桌面留上一份结果、移动端本就清空），本票不统一，只保证都不发查询。
