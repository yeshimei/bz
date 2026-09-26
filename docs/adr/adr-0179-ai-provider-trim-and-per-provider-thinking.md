# ADR-0179 AI 服务商收敛三条通道 + 思考档位按 provider 单源

- 状态：已接受（2026-09-23，用户拍板「只保留 deepseek 和智谱套餐即可，其他的用到了再添加」「也要保留 ollama」「思考参数和强度各家不同，在设置面板正确显示，而不是一律几个档位省事」）
- 关联：issue 411 / ADR-0146（思考档位前身，本 ADR 取代其 §2 静态映射与全局单值）/ ADR-0148（面板独裁）/ ADR-0151（模型档位表）/ ticket 170-173（provider 注册表与 per-provider 行）
- 影响：`src/core/ai.ts`、`src/core/ai-models.ts`、`src/core/settings-schema.ts`、`src/settings-panel/renderer.ts`、`src/core/settings-main-schema.ts`、`src/settings.ts`、`src/core/model-limits.ts`、`src/main.ts`（迁移接线不变）、相关测试与原型产物

## 背景

两件事一起暴露的：

1. **「关闭思考」对 DeepSeek 从来没生效过**（用户实测提问）。ADR-0146 把 deepseek 归进 `enable` 风格、发 `enable_thinking: false`——那是 Qwen / 自建 vLLM 的 `chat_template_kwargs` 词表。DeepSeek 官方 V4 的思考控制是另一套（2026-09-23 核对 `api-docs.deepseek.com/guides/thinking_mode`）：
   - 开关：`{"thinking": {"type": "enabled"|"disabled"}}`（默认**开**，effort 默认 high）
   - 强度：`{"reasoning_effort": "low"|"high"|"max"}`（映射表 `low→low` / `medium→high` / `high→high` / `max→max`）
   - 未知参数**不报错也不生效**（文档对 temperature 等即此口径）——所以这个 bug 是静默的：界面写了「关闭（省 token）」，请求里躺着一个服务端不认识的字段，`reasoning_content` 照旧长出来、照旧计费。
2. **档位词表是 provider 属性，不是全局属性**，而面板摆的是固定五档：
   - DeepSeek：能关（`thinking.type`）、能分档（low/high/max），**没有「中」**（medium 被服务端折成 high）；
   - 智谱 Plan（默认模型 `glm-5.3-flash`）：`glm-5.3 / 5.3-flash / 5.3-flashx` **强制思考**，发 `disabled` 无效，只有 `reasoning_effort: low|high|max`；
   - Ollama：OpenAI 兼容层把 `reasoning_effort` 映射成内部 `Think`（`none` = 关思考，low/medium/high = 开且分档），省略该字段时有思考能力的模型**默认就是开**，所以「关闭」必须发 `none` 而不是「不注入」。
   一个全局单值 `aiThinking` 无法承载「三家档位不同」这件事：切服务商后旧档位可能落在新表外，面板只能显示一个不存在的档。

## 决策

1. **注册表收敛为三条在册通道**：`deepseek`（官方，缺省）/ `zhipu-plan`（智谱 Coding 套餐）/ `ollama`（本地）。其余 14 家（opencode-go / openai / anthropic / google / moonshot / zhipu / dashscope / siliconflow / openrouter / xai / groq / mistral / together）与 `custom`（自定义 OpenAI 兼容端点）连同其密钥键、设置行一并退役——「用到了再按注册表加一行」（注册表加一行即含端点/模型/密钥行/思考档位，解析与设置页零分支改动）。新增导出 `DEFAULT_AI_PROVIDER`，缺省字面量（原 `'opencode-go'`）全仓收编。
   - 对象形态 override（调用方自带 endpoint/key/model）**保留**：脚本内指定第三方端点仍走它，只是没有注册表身份、因而没有思考档位可查。
   - `desc.noCors` / `desc.extraHeaders` 两个机制**保留**（当前三条通道都不需要，留给下一条通道；CORS 不友好的端点也有「fetch 失败 → requestUrl 兜底」这条既有路径兜着）。
2. **思考档位表 = descriptor.thinking（单一事实源）**：档位（value/label/请求体片段）写在每条通道的注册表条目里，设置面板选项与请求注入**同源消费**：
   - deepseek：`auto` / `off`→`{thinking:{type:'disabled'}}` / `low|high|max`→`{thinking:{type:'enabled'}, reasoning_effort:<档>}`；
   - zhipu-plan：`auto` / `low|high|max`（**无关闭档**——强制思考的模型不摆无效档）；
   - ollama：`auto` / `off`→`{reasoning_effort:'none'}` / `low|medium|high`。
   - `thinkingBodyFor(providerId, level)`：`auto` / 空 / 档位不在该 provider 表内 / 无注册表身份 → **一律不注入**（「不认识的档宁可不动」优先于「尽力翻译」，不给端点发它不认识的参数）。
   - ADR-0146 的 `AI_THINKING_STYLE` / `thinkingOptionsFor` 与全局键 `aiThinking` 一并退役；`hasExplicitThinkingOption`（显式优先）保留——`knowledge/mount-suggest` 的 low 档是 ADR-0140 的实测决策（默认档 143s / low 7s），显式优先让它不被面板改写。
3. **值按 provider 分开存**：新键 `aiThinkingOverrides: Record<providerId, level>`（与 `aiModelOverrides` / `aiMaxTokensOverrides` 同族，缺省 = auto = 不注入；写 auto 即删键）。切服务商互不污染，与「模型名称 / 最大输出 token」两行的 per-provider 口径一致。
4. **渲染器支持「选项随快照求值」**：`SelectRow.options` 收函数形式（+ `refreshKey`），任意行变更后重求值——选项集变了整只下拉重建，否则只回填当前值（不落盘、不置脏）。core 渲染器（`renderSettingsInto`）与面板自绘渲染器（`settings-panel/renderer.ts`）同口径实现；显示值不在选项内时回落首项（与请求侧「不在表内不注入」同口径，显示值不许落在选项外）。
5. **迁移（settings.ts `migrateRetiredAIKeys` 扩写，main.ts 接线不变）**：退役密钥键（16 个）+ `aiContextOverrides` 删除；存量 `aiProvider` 非在册 id → 回落 `DEFAULT_AI_PROVIDER`（否则解析会静默落到缺省描述上、密钥键与面板行全对不上）；三个 per-provider 覆盖表清退役 provider 条目；全局 `aiThinking` → `aiThinkingOverrides[当前 provider]`（表内档位直接沿用，「中」不在表内时按官方映射折 high，折后仍不在表内或为 auto 即丢弃）。
6. **顺带补录**：`core/model-limits.ts` 补 `glm-5.3-flash`（官方最大输出 131072 / 默认 65536 / 上下文 1M）；`zhipu-plan` 注册表 `defaultMaxTokens` 由 8192 修正为 131072（原值远低于官方最大档，面板「留空时取该模型官方上限」显示与实际不符）。
7. **删除死 API**：`AIService.reason()` / `search()` / `reasonAndSearch()`——三者硬编码 `enable_thinking` / `search` 私有字段（对严格校验的服务端有 400 风险），全仓零调用方，且与新的单源口径直接冲突。

## 被否的备选

- **保留全部 17 家只修 deepseek 的参数名**：面板仍要给 14 家不用的通道摆密钥行与档位，且每家在售模型的档位都得核一遍（正是本次踩的坑）。用户明确「用到了再添加」。
- **思考档位按模型名查表**（仿 model-limits）：最准确（glm-5.3 与 glm-5.2 档位就不同），但要为全模型空间维护档位词表，收益不抵维护面；按 provider 表 + 默认模型口径已能覆盖三条通道，模型差异用注册表注释与设置行文案如实说明。
- **保持全局单值 + 切服务商时钳制**：切服务商是「看配置」，不该顺手改写用户设置（渲染即写盘是更坏的隐式行为）。
- **思考行改 custom 行自绘下拉**：`custom` 是声明体系的逃生口，per-provider 行在本仓已有先例（模型名称 / 最大输出 token 都是标准行型 + 三函数绑定 + refreshKey）——补 `SelectRow` 的动态选项能力才是与先例一致的做法。

## 后果

- 「关闭思考」在 DeepSeek 上真正生效（`thinking.type=disabled`）；智谱 Plan 不再摆一个无效的「关闭」，只给 low/high/max；Ollama 的关闭走 `none`（省略字段是「默认开」，不是关）。
- 副作用需知：DeepSeek 文档明确**思考模式下 temperature / presence_penalty / frequency_penalty 不报错也不生效**——auto 档下 auto-summary 的 `temperature: 0.3`、smartcat 的 `0.7` 一直是空转；关闭思考后它们才开始起作用，输出风格会变。
- 已知遗留（不在本 ADR 范围）：`knowledge/mount-suggest` 仍硬编码 `reasoning_effort: 'low'`，故面板的「关闭」对它不生效——这是 ADR-0140 的实测决策（低档 7s / 关闭会退回标签式作答），不是缺陷；`review-ai-bugs.md` P1-6 的建议（把「建议低档」做成面板缺省值）留作后续。
- 面板显示与请求注入自此同源：改档位表只动注册表一处，设置行与请求体同时跟着变（新增 provider 忘写档位表会被 `tests/core/ai.test.ts` 的「每家都要有档位表」断言拦住）。
