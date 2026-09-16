# AI 相关代码审查：bug 与流程不合理

范围：`src/core/ai.ts`、`core/ai-models.ts`、`core/model-limits.ts`、`core/link-now.ts`，以及全部 AI 消费方
（auto-summary / knowledge(含 mount-suggest) / secondbrain(含 link-agent, chat-panel) / smartcat / recap /
cinema / belongings / favorites / review-quiz / encrypt / password-vault）。

核对方式：逐行读源码 + 全仓 grep 调用点（不依赖运行时复现）。结论按「确凿缺陷」与「设计代价/潜伏风险」分开标注。

---

## P0-1 无 CORS 提供商失败后会**原样重放同一个请求**

- 位置：`core/ai.ts:778-793`
- 事实：`provider.noCors` 为真时，`try` 块里已经**直接调用** `chatCompletionsNonStream`；一旦它抛错，
  `catch` 里又无条件再调一次**同函数、同参数**——两条分支指向同一个实现，不构成任何 fallback。
- 触发面很大：默认 provider 就是 `opencode-go`（`core/ai.ts:406` 的 `s.aiProvider || 'opencode-go'`），
  其注册表条目 `noCors: true`（`core/ai.ts:121`）。
- 影响：
  1. 失败请求对服务端**重放一次**（双倍计费；最坏等 2×超时才报错）；
  2. 错误文案退化成自嵌套：`AI 请求失败: AI 请求超时（60 秒无响应）（fallback: AI 请求超时（60 秒无响应））`。
- 建议：`catch` 首行加 `if (provider.noCors) throw streamError;`；或只在「确实走过 fetch」时允许 fallback。

## P0-2 默认 provider 下 `onDelta` 静默失效 → 对话流式渲染永远不工作

- 位置：`core/ai.ts:780`（noCors 分支不传 onDelta）+ `core/ai.ts:595`（非流式实现根本没有 onDelta 形参）
  ←→ `secondbrain/chat-panel.ts:255-263`（UI **完全依赖** onDelta 累积 `acc` 做逐字渲染）
- 事实：默认 provider（opencode-go）走非流式，`onDelta` 永远不被调用；非流式通道也没有"伪增量"兜底。
- 影响：对话面板的「检索中」呼吸点会一直转到答案整段算完，然后一次性替换（`live.remove()` + `addChatMessage`）。
  代码读起来"支持流式"，默认配置下却无流式，且没有任何降级提示。
- 建议：非流式路径在拿到完整文本后补一次 `onDelta(full)`（保证回调契约），或 UI 按 provider 能力区分状态文案。

## P0-3 空内容判据只存在于**非流式**路径，两条路对同一响应结论不同

- 位置：`core/ai.ts:625-627`（非流式：`content == null` 即抛「响应缺少 content」）
  vs `core/ai.ts:549-551`、`566-580`（流式：返回 `full`，可以是空串）
- 叠加 141 行的空响应若 `content` 为 `''`，`prompt()` 会把它当**成功结果**返回给调用方。
- 影响：同一模型同一输入，provider 有 CORS 头 → 返回空串（调用方自己撞）；provider 无 CORS → 抛错走兜底。
  这正是「空正文事故」的机制——思考模型把预算吃光时 `content` 为空，core 层不做任何拦截。
- 调用方已被迫各自打补丁，反证 core 缺守卫：
  - `recap/summarize.ts:166-170`（空 → 降级模板）
  - `knowledge/note-gen.ts:218-220`（`summarizeTermSummary` 显式抛「AI 返回为空」）
  - **但 `knowledge/note-gen.ts:147-157` 的润色循环没有这个补丁** → `polished.push('')` 静默吞掉整块，
    正文永久少一段、笔记照写落盘（**静默数据丢失**，且 `whole = polished.join('')` 连块间换行都没有）。
- 建议：把「空内容」判据上收到 `prompt()`（两条路径统一），并在 `generateVideoNote` 对每块校验后再拼接。

## P0-4 两条路径都不读 `finish_reason`（也不读 `usage`）→ 撞 max_tokens 是静默截断

- 位置：`core/ai.ts:566-577`（SSE 只取 `delta.content`，`[DONE]` 直接 return）、`core/ai.ts:549-551`、`621-627`
- 影响：`finish_reason === 'length'` 无法被任何调用方感知。长文润色被截断的正文会被当成完整结果写进笔记；
  已知实测口径：思考模型 ≈ 8.7 token/汉字，面板默认 `max_tokens` 极大，一旦撞顶就是"半截正文 + 无告警"。
- 建议：至少把 `finish_reason`/`usage` 透出（返回对象或回调），由调用方决定重试或提示。

## P0-5 非流式通道共用 60s 硬超时，与长文本任务的耗时结构冲突

- 位置：`core/ai.ts:481`（`AI_IDLE_TIMEOUT_MS = 60000`，`484` 只有带图才放宽到 180s）
- 语义差异：流式的 60s 是「每段数据的间隔」（`armIdle()` 在每次 `read()` 前重置，长回答不受总时长限制）；
  非流式的 60s 是「从发出到收完整响应」——而默认 provider 走的正是非流式。
- 影响：**同一个长任务，走流式的 provider 能跑完，走默认 noCors provider 会超时**；超时后又触发 P0-1 的重放
  → 最坏 120s 才失败。这是默认配置下「长文本 AI 任务翻车」的结构性原因。
- 建议：非流式给独立且更长的超时（或按请求体量/预估输出动态放宽），别和流式的空闲阈值共用一个常量。

---

## P1-6 挂载建议硬编码 `reasoning_effort`，绕过面板思考档位 —— 与设置文案直接冲突

- 位置：`knowledge/mount-suggest.ts:111`（`SUGGEST_REASONING_EFFORT = 'low'`）+ `1298-1301`，三处调用同一口径
  （`1388` 查询官 / `1444` 采纳官 / `1499` 定位官）
- 机制：`core/ai.ts:347 hasExplicitThinkingOption` 命中 ⇒ `771-775` 的面板档位注入被跳过。
- 冲突点：设置项文案（`core/settings-main-schema.ts:255`）写的是「关闭可省**判定类小任务**的思考消耗」——
  挂载建议的三个「官」正是最费 token 的判定类小任务（单卡 3 次调用），用户关掉思考后这里照发。
- 叠加：默认 provider 是 `enable` 系（`AI_THINKING_STYLE['opencode-go'] = 'enable'`），`reasoning_effort`
  并不是它的有效字段 ⇒ **既没关掉思考、也没设成低档**，等于这段硬编码对默认配置完全无效。
- 建议：改走 `thinkingOptionsFor(...)`，把"建议用低思考"作为面板缺省值（auto 时的域默认），而不是硬编码字段。

## P1-7 `reason()` / `search()` / `reasonAndSearch()` 硬编码私有字段，且已是**死 API**

- 位置：`core/ai.ts:802-828`（`enable_thinking` / `search`）+ `765-768`（无条件透传给任意 provider）
- 风险：这两个字段属 deepseek / 第三方代理的私有参数。对 openai/anthropic/groq/mistral 等严格校验端点，
  未知参数会直接 400（`Unrecognized request argument`）。ADR-0146 按 provider 抑制未知参数（见 `core/ai.ts:306`
  注释「未知/自定义端点冒进发参数有 400 风险」）本就是为了躲这个，语义方法却完全绕过该机制。
- 现状：全仓 grep 无内部调用方（`.reason(` / `.search(` 命中均为业务搜索或正则），属公开死 API。
- 建议：删除，或改为走 `thinkingOptionsFor` 统一口径。

## P1-8 `withTimeout` 是"假超时"：调用方早退，底层请求不取消

- 位置：`knowledge/note-gen.ts:76-86`（`BACKFILL_AI_TIMEOUT_MS = 25000`），用于批量回填 domain（同文件 555-590）
- 事实：自建 timer 只让外层 Promise reject，`ai.json()` **没有传 signal**（core 支持 signal，这里没接）
  ⇒ 请求继续跑到 core 的 60s 才结束。注释写"settle 结果被丢弃"是对的，但没意识到请求本身没被中止。
- 影响：批量 N 条时超时条目持续占用配额并与后续条目在途叠加。
- 建议：`withTimeout` 接收 AbortController 并透传到 `ai.json(..., { signal })`。

## P1-9 对象形态 override 缺 `apiKey` 时被**静默忽略**

- 位置：`core/ai.ts:396`（守卫 `override.apiKey`）vs `375-382`（`AIOverrideObject.apiKey` 是可选的）
- 影响：`{ endpoint, model }` 这类"只换端点"的 override 会静默落到 `s.aiProvider`，用别的服务商 + 别的 key
  发请求。配置错误表现为"看起来成功但打错服务"。
- 建议：要么把 `apiKey` 标记为必填并在缺失时抛错，要么允许无 key（保留设置的 key）。

## P1-10 `max_tokens` 面板独裁导致调用方无法自救，代价被四处补丁化

- 位置：`core/ai.ts:754-756`（调用方传的 `max_tokens` 一律忽略，且**无任何日志/返回信息**）
- 后果：每个需要小预算、或要避开"思考吃预算"的调用点都得自己兜 —— `recap/summarize.ts:167-170`、
  `auto-summary/processor.ts:86`（注释）、`knowledge/note-gen.ts:218-220`。
- 评价：ADR-0148 的决策本身可理解（上限只是封顶），但"忽略 + 不可观测"让调用方只能猜。
  与 P0-4 同一处可修：把 `finish_reason=length` 或 `usage` 回传即可让补丁不必再猜。

## P1-11 请求模型与预算档位可能脱钩，且"显式模型"判据脆弱

- 位置：`core/ai.ts:751-756`
- 事实：`isExplicit = model !== this.defaultModel`。调用方传的模型名只要与 `defaultModel` 相同就被判为"非显式"，
  实际请求模型改取 `provider.model`；而 `max_tokens/contextWindow` 恒按**面板模型名**解析（`core/ai.ts:454`）。
- 风险：若某调用方显式传入一个与面板不同的模型，预算仍是面板模型的档位 → 超该模型真实上限时被服务端 400。
  当前调用方都传 `defaultModel` 或 `undefined`，属潜伏风险；但 `chat()/json()` 传的 `'deepseek-v4-flash'`
  恰好等于 `defaultModel`，即"显式指定"在本仓库里实际是空操作，语义容易被误读。

---

## P2 轻量项

| # | 位置 | 问题 |
|---|---|---|
| 12 | `core/ai.ts:791` | 错误文案自嵌套 `AI 请求失败: X（fallback: X）`（P0-1 的副产物，修 P0-1 后自然消失） |
| 13 | `core/ai.ts:623` | `data.message` 判定过宽：正常响应若带 `message` 字段会被误判为错误 |
| 14 | `core/ai.ts:621` | `JSON.parse(resp.text)` 失败抛原始 SyntaxError，文案不可读 |
| 15 | `core/ai.ts:736` | `AIService` 构造的 `params` 完全未使用（Q3 遗留），易误以为能传 provider 配置 |
| 16 | `core/ai.ts:746` | `prompt(input, model, options)` 第二参是**模型名**，而 `json/chat/reason` 第二参是 **options** → `prompt(text, {temperature})` 会把对象当模型名发出去（`body.model = {}`）。当前无调用方踩到，但形状危险 |
| 17 | `knowledge/note-gen.ts:50` vs `cinema/recommend.ts:160` | 代码围栏容忍度不一致（前者去裸 ` ``` `，后者只认 ` ```json `） |
| 18 | `core/ai.ts:567` + `chat-panel.ts:264` | 流式失败转非流式时，已推送的 `acc` 与最终返回值是两次请求的两份内容；chat-panel 靠 `live.remove()` 掩盖，若将来有调用方把增量直接写正文就会重复 |

## 流程层面的两个观察

1. **缺统一的"AI 结果有效性"判据**：空内容 / 截断 / JSON 不可解析三件事，core 只在非流式路径管了第一件，
   其余全靠各域自建（`parseAiJson`、`parseJudgeOutput`、`parseRecommendJson`、`parseCategorySuggestion`…）。
   与项目「禁留第二套判定」的原则相反，建议把「空/截断」判据收进 `core/ai`。
2. **AI 调用无统一并发与取消治理**：`secondbrain/link-agent` 有 `runSerial`，其它批量场景（回填 domain、
   挂载建议三官、批量补链）各自串行 await，且除对话面板外无取消入口（signal 未接）。
   P0-5/P1-8 的放大效应都出现在这些批量路径上。
