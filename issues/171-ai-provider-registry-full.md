# Ticket 171 — AI 提供商注册表策略模式完整化（常见提供商全量内置）

> 备忘：`memo.json`「AI 这边使用策略模式，把市面上常用的 AI 提供商都给列出来，而不是只给一个什么兼容模式这样的写法」。
> ticket 170 已落地注册表骨架（deepseek / opencode-go / custom 三项），本票把市面常用 OpenAI 兼容提供商全量注册，注册表 = 单一事实源，设置页与解析全部驱动自注册表。

## 背景

ticket 170 的 `AI_PROVIDER_REGISTRY` 只有 3 行，设置页下拉只有 DeepSeek / OpenCode Go / 自定义三项；用户若要接 OpenAI、Gemini、Kimi 等，只能走 custom 手填端点。本票把市面常用提供商全部内置为注册表项，新增提供商零分支改动。

## 实现

- `src/core/ai.ts` `AI_PROVIDER_REGISTRY` 扩展为 **16 家**：
  deepseek / opencode-go / openai / anthropic / google（Gemini）/ moonshot（Kimi）/ zhipu（GLM）/ dashscope（通义百炼）/ siliconflow（硅基流动）/ openrouter / xai（Grok）/ groq / mistral / together / ollama（本地）/ custom（OpenAI 兼容自填）。
  `AIProviderDescriptor` 新增 `apiKeyLabel`（设置页密钥行标题）与 `apiKeyDesc`（密钥行描述）与 `extraHeaders`（附加请求头）。
- `getAIProvider` 泛化：全部注册表提供商查表解析；`extraHeaders` 注入 fetch 与 requestUrl 两路请求头（anthropic 注入 `anthropic-version: 2023-06-01`）；**ollama 本地服务无鉴权空密钥放行**；deepseek QuickAdd data.json 兜底 / custom 自填行为零变化；未知名回退 custom。
- 主设置页 `settings-main-schema.ts`：密钥行由注册表驱动生成（apiKeyLabel / apiKeyDesc / apiKeyKey），新增提供商零 schema 改动；custom 端点/模型/密钥三行顺序契约保持。
- `src/settings.ts` 新增 13 个密钥键：`openaiApiKey` / `anthropicApiKey` / `googleApiKey` / `moonshotApiKey` / `zhipuApiKey` / `dashscopeApiKey` / `siliconflowApiKey` / `openrouterApiKey` / `xaiApiKey` / `groqApiKey` / `mistralApiKey` / `togetherApiKey` / `ollamaApiKey`（默认空串，`Object.assign(DEFAULT_SETTINGS, loaded)` 自动带默认）。
- `src/favorites/ai.ts` `isAvailable` 注册表驱动：ollama 恒 true；deepseek 缺 key 不判死（运行时 QuickAdd 兜底）；其余查 `apiKeyKey` 对应键。

## 默认模型与端点（写死前经公开文档核验）

| id | label | endpoint | 默认模型 |
|---|---|---|---|
| deepseek | DeepSeek | api.deepseek.com | 沿用调用方默认 |
| opencode-go | OpenCode Go | opencode.ai/zen/go/v1 | deepseek-v4-flash |
| openai | OpenAI | api.openai.com/v1 | gpt-4o-mini |
| anthropic | Anthropic（Claude） | api.anthropic.com/v1 | claude-sonnet-4-5（extraHeaders: anthropic-version） |
| google | Google Gemini | generativelanguage.googleapis.com/v1beta/openai | gemini-2.0-flash |
| moonshot | Moonshot（Kimi） | api.moonshot.cn/v1 | kimi-k2-0711-preview |
| zhipu | 智谱（GLM） | open.bigmodel.cn/api/paas/v4 | glm-4-flash |
| dashscope | 阿里云百炼（通义） | dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| siliconflow | 硅基流动 | api.siliconflow.cn/v1 | deepseek-ai/DeepSeek-V3 |
| openrouter | OpenRouter | openrouter.ai/api/v1 | deepseek/deepseek-chat |
| xai | xAI（Grok） | api.x.ai/v1 | grok-2-latest |
| groq | Groq | api.groq.com/openai/v1 | llama-3.3-70b-versatile |
| mistral | Mistral | api.mistral.ai/v1 | mistral-large-latest |
| together | Together AI | api.together.xyz/v1 | meta-llama/Llama-3.3-70B-Instruct-Turbo |
| ollama | Ollama（本地） | localhost:11434/v1 | llama3.1 |
| custom | 自定义（OpenAI 兼容） | 用户自填 | 用户自填 |

## 测试

- `tests/core/ai-cov.test.ts`：注册表解析（openai 端点/模型/密钥）、注册表缺密钥报错文案、anthropic extraHeaders 注入请求头、ollama 空密钥放行。
- `tests/favorites/ai.test.ts`：openai/google 配 key → true、缺 key → false、密钥互不顶替、ollama 恒 true。
- `tests/core/settings-schema.test.ts` / `settings-copy-lint.test.ts`：schema/lint 断言改注册表驱动（行列表随注册表，新增提供商不破测试）。

## 门禁

tsc 0 错；全量 222 文件 3588 用例绿（基线 3581 + 7 新增）；构建通过（main.js 同步仓库根目录）。
