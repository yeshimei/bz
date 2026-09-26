# 429 · AI 面板「重排模型」行（同款「获取模型」弹窗）+ 参考面板百分比与名次同尺

- 状态：已实现（2026-09-24）
- 用户原话①：「AI 设置面板当中开启重排之后，还要显示一个选择重排模型的选项，也使用『获取模型』打开弹窗，让用户选择一个」
- 用户原话②（截图：列表百分比 45% / 49% / 44% / 46% / 46%）「没有按照相关度由高到低去排序」
- 用户拍板（AskUserQuestion 选「其他」）：**「只在灵感参考界面进行一个简单的排序即可，相关度高的排上面」**
- 关联：issue 427 + ADR-0186（重排接线；本票是对它「决策 1 取舍」与「决策 7 模型单点」的两处收口）/ issue 422 + ADR-0182（Embedding 组与「获取模型」范式）/ ticket 173（模型选择器回填时机）/ issue 425 + ADR-0185（余弦是阈值唯一尺，本票不动它）
- 号位说明：428 之后取 429

## 背景与目标

两件小事，都出在 ADR-0186 落地后的手感上：

1. **重排模型被写死在代码里**（`RERANK_MODEL` = `dengcao/Qwen3-Reranker-4B:Q4_K_M`）：换机器（显存宽裕可上 8B）、换社区转换版都得改代码重构建。用户要的是「跟 Embedding 模型一样，在 AI 面板里能选」。
2. **列表百分比与名次对不上**：重排是纯换序层，名次按重排分 P(yes)，但列表百分比显示的是**余弦**（ADR-0186 §1 的刻意取舍）——于是列表「按 45 / 49 / 44 / 46」这样看起来乱序。用户看到的「没排序」其实是**两把尺**。

## 关键判断：不是排序 bug，是显示尺不一致

名次本来就是「相关度由高到低」（重排分序），乱的是**百分比**。故本票按用户「只在灵感参考界面」的口径，只改显示：**给重排过的条目记下重排分 `hit.rerankScore`，参考面板的百分比优先显示它**（未重排/重排回退的尾部条目回落余弦 `score`）。

- **不动阈值**：`linkAgentMinScore` 0.30 与每周撞车 0.63 继续读 `hit.score`（余弦）——ADR-0185 的单一阈值尺不破。
- **不动其他面板**：对话/移动端的百分比仍是余弦（用户明确「只在灵感参考界面」）。

## 决策

1. **`hit.rerankScore?` 由 `applyRerank` 写入**（仅头部经重排的条目携带），`hit.score` 仍是原始余弦。显示层 `relevancePct(item) = round((rerankScore ?? score) × 100)`——一个函数收口列表卡与浮卡预览两处百分比。
2. **「重排模型」行 = Embedding 模型行的同款范式**：text 行 + 行内「获取模型」按钮 + `openModelPicker`；选中写 `secondBrainRerankModel` + 落盘 + success toast「重排模型已设为 X，下次检索即生效」。留空 = 回落内置默认（`resolvedRerankModel()`）。
3. **可见性 = 与「启用重排」同一条件链再叠开关**：`isQwen3Embedding8b(嵌入模型) && secondBrainRerank !== false`。开关关掉时这行一起收起——不给「藏着的设置还在起作用」的暗态（与 ADR-0186 §3 同口径）。
4. **候选池只按名字软过滤**（`pickRerankModels`）：名字含 `rerank` 的优先；一条都没有 → 全量返回让用户自辨。**不按 capabilities 过滤**——社区转换版的重排模型在 Ollama 里 `capabilities` 只有 `completion`，没有 `rerank` 这一档，按能力过滤正好把真模型滤掉（embedding 侧能按能力过滤，是因为那儿有 `embedding` 标签）。
5. **换重排模型不重建索引**：重排是纯换序层，不参与向量入库。改完下一次检索即生效（与 Embedding 模型「换模型 = 整库重建」完全不同）——toast 文案就按这个说。
6. **回填时机沿用 ticket 173 的收口**：动作 Promise 在 `onClose` 里 resolve（`openModelPicker` 打开即返回），否则渲染器重读绑定拿到的还是旧值、要选中两次才刷新。

## 落地清单

| 文件 | 改动 |
|---|---|
| `src/settings.ts` | 键 `secondBrainRerankModel`（默认 `''` = 用内置默认） |
| `src/secondbrain/config.ts` | `resolvedRerankModel()`：设置留空 → `RERANK_MODEL` |
| `src/secondbrain/rerank.ts` | `rerankOne` 的 `model` 逐次解析（改完即生效，无需重启） |
| `src/core/ai-models.ts` | `pickRerankModels` / `fetchRerankModels`（同一 `/api/tags` 端点、同一服务地址）；`hasRerankNamed`（全量回退时标题提示用） |
| `src/core/settings-main-schema.ts` | Embedding 组第四行「重排模型」（text + 「获取模型」+ `visibleWhen`）；全量回退时选择器标题注明（二轮收口：间隔号续句，不再嵌套括号） |
| `src/secondbrain/rerank.ts` | `RERANK_MAX_DOCS` 24 → **50**（= TopK 设置上限；review 收口，见下）；二轮收口：语义改为「整列上限」，注释订正 |
| `src/secondbrain/reference-panel.ts` / `mobile-panel.ts` | resolve 路径「仍是本轮」门禁（`if (this.inflight !== ac) return;`）；二轮收口：移动端把结果赋值一并移到门禁之后 |
| `src/secondbrain/vector-store.ts` | `SearchHit.rerankScore?`；`applyRerank` 重排条目带分；二轮收口：> `RERANK_MAX_DOCS` 的列表整轮早退（尾部保序分支删除） |
| `src/secondbrain/vector-store.ts`（二轮收口） | `relevancePct()` 从 reference-panel 提升到此处导出——桌面参考面板与移动端参考列表共用同一显示尺 |
| `src/secondbrain/reference-panel.ts` / `mobile-panel.ts` | 列表卡与浮卡预览/移动卡片的百分比改读 `relevancePct`（重排分优先） |
| `tests/core/settings-schema.test.ts` | Embedding 组四行断言 + 重排模型行 `visibleWhen` 真值表（含开关关闭一档） |
| `tests/core/ai-models.test.ts` | `pickRerankModels` 软过滤 / 回落；`fetchRerankModels` 端点与空列表报错；`hasRerankNamed` 判定 |
| `tests/core/settings-model-picker-ui.test.ts` | 重排模型行：拉取 → 只列重排候选 → 选中即回填（一次点击）+ 失败 toast + 非 8B 收起 + 全量回退标题提示 |
| `tests/secondbrain/panel-settings-rows.test.ts` | 不变式：两张 TopK 行的 `max` ≤ `RERANK_MAX_DOCS`（二轮收口：先断言 `max` 是数字，杀掉 `?? 0` 恒真写法） |
| `tests/secondbrain/rerank.test.ts` | 设置覆盖 / 留空回落默认；请求体 `model` 断言；取消路径 `linkAbort` 解绑断言 |
| `tests/secondbrain/rerank-wiring.test.ts` | 整列条目带 `rerankScore` 且 `score` 不动；二轮收口：新增「超长列表整轮不重排」用例、原「头部截断」用例改为整列断言 |
| `tests/secondbrain/ollama.test.ts` | `linkAbort` 解绑断言（取消路径 + 成功路径） |
| `tests/secondbrain/reference-panel.test.ts` / `mobile-error.test.ts` | 迟到 resolve 门禁（旧轮不覆盖新轮列表）；移动端两条取消用例重写为真压门禁；二轮收口：移动端参考列表百分比同尺渲染用例 |
| `tests/smoke.test.ts` | 默认值断言（`secondBrainRerankModel === ''`） |

## 遗留与取舍

- **尾部条目没有重排分**（二轮收口后已不是「尾部」问题）：百分比回落余弦、与重排过的条目不同尺——`RERANK_MAX_DOCS` 提到 **50 = TopK 设置上限**（同日 review 收口）后，参考面板在任何合法配置下**整列都带重排分**；**二轮收口把 `> 50` 条的列表改为整轮不重排**（原「尾部保余弦序」结构退役，见 ADR-0186 决策 6），故「混尺」只剩整轮回退一种来源（全列回落余弦，仍是单一尺）。不变式由 `tests/secondbrain/panel-settings-rows.test.ts` 钉住。
- **对话面板仍按余弦**：用户明确「只在灵感参考界面」，`chat-panel.ts` 的对话参考列表（`:200`）与桌面/移动端两条对话提示词（`chat-panel.ts:274`、`mobile-panel.ts:466`）本轮不动。前者的名次由重排分决定、百分比却是余弦——属于同一观感的已知残留（若要收口，复用 `vector-store` 导出的 `relevancePct` 即可）；后者（提示词）**刻意保留余弦**：那是给模型看的相似度绝对值，跨查询可比，不是排序尺。
- **无真关联时重排分是噪声序**（issue 427 实测）：此时「相关度高的排上面」照样成立（都是噪声里的相对高），但百分比会给出 0–70% 的裸值。不设阈值不裁剪——用户要的是排序，不是过滤。
- **不提供「重排模型」的连通性校验**：与 Embedding 行同款，选错了要到下一次检索才在 `console.warn` 里看到「重排不可用，按余弦序返回」。现取「选择器只列 /api/tags 里真实存在的模型」作为约束。

## 子代理 review 收口（2026-09-24）

- **TopK 可配到 50 而头部上限仍是 24（应修，已改）**：`RERANK_MAX_DOCS` 初版取 24（按当时口径的 topK 定），但「参考结果数 TopK」「对话参考结果数」两行允许 1–50——用户把 TopK 调到 25–50 时尾部只有余弦分、与已重排头部混排，**本票刚修掉的「两把尺」观感会原样复现**（正是用户原始投诉的形态）。现 `RERANK_MAX_DOCS = 50`（= TopK 设置上限）：任何合法配置下列表整列都吃重排；超长列表（> 50 条，无入口）的兜底是 6s 整轮预算（用尽即整轮回退，不做半重排）。不变式由新增测试 `tests/secondbrain/panel-settings-rows.test.ts` 钉住（TopK 上限 > `RERANK_MAX_DOCS` 即炸）。
- **resolve 路径缺「仍是本轮」门禁（建议，已加）**：`refreshContent` / `refreshResults` 的成功分支原来只清 `inflight`、不检查它是否已被新一轮接管——旧轮迟到 resolve 时会盖掉新轮的列表。现加 `if (this.inflight !== ac) return;`（参考面板 / 移动面板各一处），补两条真敏感的测试（新一轮先落定、旧轮后迟到返回，断言列表不被旧轮覆盖）；已用「临时撤掉门禁 → 两条测试都失败」验证过敏感性。
- **两条移动端取消测试是空转（建议，已重写）**：原「store 抛错路径」用例的桩里 `signal.aborted` 恒 false（根本没走到被取消的 signal，走的是正常返回）；「旧结果不回填」用例里旧轮先 resolve、随后新一轮渲染又把它盖掉，断言恒真。现重写为：旧轮悬着不落 → 新一轮先落定 → 旧轮再以「迟到 resolve」或「AbortError 拒绝」收口。
- **`pickRerankModels` 全量回退无提示（建议，已加）**：一个 rerank 字样都没匹配到时列的是全部模型，用户无从判断是筛选失效还是服务里真没有。现新增 `hasRerankNamed()`，选择器标题在该情形注明「未找到 rerank 字样模型，已列出全部」。
- **`linkAbort` 解绑未断言（建议，已加）**：ADR-0187 要求「外层监听必须 finally 解绑」，原测试只断言了定时器清理。现在 `getEmbedding` 的取消路径与成功路径、`rerankScores` 的取消路径各加一条 `removeEventListener('abort', …)` 断言。
- 未采纳：对话面板百分比统一改读重排分——用户口径明确「只在灵感参考界面」，保持不动。（**二轮 review 收口**：移动端参考列表改判为「灵感参考的另一端」，已改读重排分；见下节。）

## 子代理 review 收口（二轮，2026-09-24 部署后）

同批 4 条应修 + 4 条建议，逐条处置：

- **「头部 50 条 + 尾部保余弦序」的半重排在超长列表上仍可复现（应修，已改）**：上一轮的注释断言「其余 topK（关联候选池 24、每周撞车 10）本就在限内」不成立——自动关联候选池 = `Math.max(topK × 3, 24)`（`link-agent/pipeline.ts`）而它的 TopK 上限同为 50（`knowledge/ui.ts`），**池可达 150**，那一整条路径长期停在「已重排头部 + 只有余弦分的尾部」。现 `applyRerank` 第二条早退为 `if (hits.length > RERANK_MAX_DOCS) return hits;`，尾部拼接分支删除——**要么整体重排、要么整体不重排**。副作用是好的：那些链路本来自己按 score 重排/取 max（重排对产出零影响），每篇白付的 ~1.7s GPU 一并省掉。新增接线用例「列表超过 RERANK_MAX_DOCS：整轮不重排，不半重排」。
- **TopK 不变式测试有空转写法（应修，已改）**：`expect(RERANK_MAX_DOCS).toBeGreaterThanOrEqual(row.max ?? 0)` 在 `max` 缺失时断言恒真。现先 `expect(row.max).toBeTypeOf('number')` 再比大小。
- **移动端参考列表仍按余弦显示、与自己的名次对不上（应修，已改）**：`mobile-panel.ts` 的卡片百分比与分数条写死 `Math.round(item.score * 100)`，而 `searchMobile` 走的也是 `vectorSearch`（名次已按重排分）。判定为**同一个「灵感参考」功能的两端**，与桌面同尺收口：`relevancePct()` 提升到 `vector-store` 导出、两处共用（原 `reference-panel` 的本地副本删除）。新增移动端渲染用例断言卡片显示 92%（重排分）而非 49%（余弦）。**注意这比用户原话「只在灵感参考界面」多覆盖了移动端**——按「灵感参考是同一个功能」理解，若用户认为移动端该保持余弦，回退只需把该文件两处换回 `item.score`。
- **移动端结果赋值在门禁之前（应修，已改）**：`refreshResults` 里 `this.refResults = await this.store.searchMobile(...)` 先于 `if (this.inflight !== ac) return;`——旧轮迟到 resolve 时仍会把结果落进 `refResults`、盖掉新轮。现改为先接住返回值、过门禁后再赋值（与桌面 `refreshContent` 同构）。
- **选择器标题嵌套括号（建议，已改）**：`openModelPicker` 的标题模板自带一层全角括号，全量回退文案原样再套一层 → `选择模型（Ollama 重排（未找到…））`。现用间隔号续句：`Ollama 重排 · 未找到 rerank 字样模型，已列出全部`。
- **短上下文分支造了一个没人用的 `AbortController`（建议，已改）**：`refreshResults` 原来在长度判定**之前**就 `new AbortController()` 并赋给 `inflight`，短上下文路径随即把它置 null——一个是死对象。现挪到早退之后。「先 abort 再判长度」的顺序（ADR-0187 §5）不变，语义不变。
- **存量 TopK > 50 的配置（建议，已按新规则消解）**：本票后 > 50 的列表整体不重排——不重排即不混尺，该场景自洽；面板三处 TopK 恒 ≤ 50，不受影响。不做存量值钳制。
- 未采纳：对话面板百分比（`chat-panel.ts` / `render.ts`）仍按余弦——用户口径限定「灵感参考」，本轮不动，已在「遗留与取舍」记为已知残留。

### 第三轮（三审，2026-09-24）

三审结论「未发现应修」，逐条给出建议处置：

- **`applyRerank` 早退未查 `signal`（建议，判定不可达，未改）**：> 50 条的调用方都不传 signal；且全扫期每 64 篇的检查点会先抛 `AbortError`，扫描结束到 `applyRerank` 之间没有 await（同步段）——不存在「带着已取消 signal 走到早退」的路径。
- **`mobile-panel` 的 `let r: SearchHit[] = []` 初值从不被读（建议，已改）**：收成 `try` 内的 `const r = await …`，门禁后再赋值（提交 `55d03775`）。
- **「超长列表整轮不重排」用例不区分早退与失败回退（建议，已改）**：原用例不给 `rerankScores` 设 mock，「保纯余弦序 + 全无 rerankScore」在**失败回退**路径下同样成立。现给一组「若被调用就会换序」的分数（`[0.05, 0.1, 0.9, 0.2]`），只有真早退才两个断言都过。
- **对话侧两把尺的清单不全（建议，已改）**：除 `chat-panel.ts:200`（对话消息里的参考列表）与 `:274`（提示词内的百分比），移动端对话提示词 `mobile-panel.ts:466` 也把余弦百分比写进了 prompt——已一并记入「遗留与取舍」。提示词里的百分比**刻意保留余弦**：那是给模型看的相似度绝对值（跨查询可比），不是给用户看的排序尺。
