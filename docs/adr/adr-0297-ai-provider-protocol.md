# ADR-0297 · AI 服务商扩表与双协议（OpenAI 兼容 / Anthropic Messages）

日期：2026-11-12 · 状态：已采纳 · 关联：ADR-0179（服务商收敛三条通道）、ADR-0182（AI 面板按模型族分组）、ADR-0193（输出上限护栏）

## 背景

ADR-0179 把服务商收敛成 deepseek / zhipu-plan / ollama 三档，理由是「插件能替用户保证选完填密钥就能用的只有这三家」；2026-11-11 加回 custom 兜底。实际用下来有两个缺口：

1. **覆盖太少**。国产常用的通义、Kimi、硅基流动、火山、阶跃、MiniMax，海外常用的 OpenAI、Claude、Gemini、xAI、Mistral、Groq、OpenRouter 全要用户自己去翻文档抄地址、猜模型名。用户反馈的原话是「直接支持市面上大多数的」。
2. **只有一种协议**。所有通道都按 OpenAI 兼容的 `/chat/completions` 发，Claude 官方（Anthropic Messages）压根接不进来——它的报文、鉴权头、SSE 事件、system 位置全都不同。

考察过引第三方库（`model-metadata-central` 零依赖 7.9 KB / Vercel AI SDK 8.5 MB / `openai` SDK 23 MB）：调用层的库一律不要——main.js 现在 3 MB，且 `core/ai.ts` 里那套 fetch→requestUrl 兜底、空闲超时、AbortController 组合是为 Obsidian（尤其移动端）趟出来的，换库等于重踩。**只取数据，不取运行时**。

## 决策

1. **注册表扩到 18 家**，按「国内常用 → 海外常用 → 本地」三段排，custom 仍居末位兜底。端点与默认模型取自 models.dev（2026-11-12 抓取，MIT），条目注释写明来源与日期——调大默认模型前必须核对官方文档，这是 `model-limits.ts` 同一条纪律。**不引任何依赖**：那张表裁下来不到 10 KB，抄进注册表比挂一个 6 星包的上游可靠。
2. **协议成为 provider 属性**（`AIProtocol = 'openai' | 'anthropic'`）。缺省即 openai，新增服务商不写 protocol 就是 OpenAI 兼容，不必重复声明。目前只有 Claude 常驻通道写 `anthropic`。
3. **请求层抽成协议适配器**（`ProtocolAdapter`）：URL / 鉴权头 / 报文转换 / 增量提取四个注入点，超时、中止、流式读取、requestUrl 兜底、坏 chunk 容错**全部共用一份**。复制两份 60 行的空闲超时逻辑迟早漂移，这是明确不接受的。
4. **Anthropic 报文的三处硬差异**必须处理，不能指望服务端宽容：
   - `system` 是顶层字段，塞在 `messages` 里会被 400 拒（多轮报文里常见）；
   - 图片是 `{type:'image', source:{type:'base64', media_type, data}}`，不是 `image_url`；
   - 参数只认白名单（temperature / top_p / top_k / metadata / stop_sequences），`response_format` 这类 OpenAI 专属字段会被拒。`stop` 改名 `stop_sequences`。
5. **Anthropic 通道暂不注入思考参数**。它的 extended thinking 是 `budget_tokens`，必须与 `max_tokens` 联动折算（且 `< max_tokens`），而本版没有档位表。遵循既有「不认识的口径宁可不发」原则——冒进发 OpenAI 形态的 `thinking` 字段只会换来 400。
6. **自定义通道可选协议**（`aiCustomProtocol`，缺省 openai）。同一档既能接 OpenAI 兼容网关，也能接 Claude 或任意 Anthropic 兼容端点，不必为换协议再加一档。
7. **新增服务商的密钥统一走 `aiApiKeys: Record<providerId, string>`**，不再为每家加一个 `SettingsKey`。老三家（deepseek / zhipu-plan / ollama）保留旧键位：读时先查表再回落旧键（`keyOf`），写时仍写旧键——**存量用户数据零迁移**。这是照 `jevApiKeys` 的现成范式，不是新发明。
8. **本地服务免鉴权按描述符判定**（`isNoAuthProvider`：ollama / lmstudio），不再是 `name !== 'ollama'` 这种写死一家的判断。

## 后果

- 设置页多出十几行密钥，但**全部由注册表循环生成**，schema 零改动——这是 ADR-0179 那个设计当时留下的红利，这次一分钱没付。下拉选项同样直出注册表。
- 服务商下拉从 4 项变 18 项，平铺会显得长。**分组/搜索留待后续**：这一版先把种类铺开，交互再优化属于独立一票。
- 退役键名单（`RETIRED_AI_KEY_KEYS`）不变：`openaiApiKey` 这类旧键仍会被清掉，用户在新表里重填。**不迁旧键**是有意的——那批键在 ADR-0179 时代已经删过一轮，能留到现在的极少，为它写一段迁移动逻辑不值。
- 新增一家的成本降到「往数组里加一个对象」：端点、默认模型、上限、密钥标签，其余（密钥行、测试按钮、模型拉取、上限护栏、per-provider 覆盖）全部自动跟上。
- 模型的默认值会过时。models.dev 是社区维护的数据，错漏难免（Kimi k3 报出 1M 输出上限就存疑，条目里已标注）。**注册表不是流量入口，用户能改**：默认值只负责「不改也能跑通」，不负责「永远最优」。
- Anthropic 协议下 `ai.json()` 的 `response_format` 被过滤，JSON 输出退回提示词约束。依赖严格 JSON 的调用方（知识盒）在 Claude 通道上容错率低于 OpenAI 通道，属已知降级。

## 补记：默认最大输出的保守档（2026-11-12 发版 review）

初版把上游声明的「最大输出」直接当 `defaultMaxTokens` 发出去，其中几家明显不可信（Kimi 报 1048576，与上下文同档；xAI 报 500000）。`max_tokens` 超过模型真实上限时，服务端会**整条请求拒掉**，用户看到的只是「AI 请求失败」，无从知道该去改哪一格。

口径改为：**只有官方文档写明的值才作默认**（DeepSeek 384K / 智谱 131072 / OpenAI·Claude 128K / Gemini 64K 照用），只有聚合数据、无法核实的家一律落到 `SAFE_DEFAULT_MAX_TOKENS = 32768`；`maxOutputCap` 保留上游值当面板软上限——用户自己调高是明确动作，不算默认坑人。

这条与 ADR-0193（输出上限护栏）同一方向：护栏管的是「别让手改的值越界」，这里管的是「别让默认值越界」。
