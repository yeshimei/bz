/**
 * AIService / createAI（Q3.js window.__utils 移植，ticket 03）
 * provider：注册表驱动（ticket 170/171 策略模式）——2026-11-12/ADR-0297 扩到常用 18 家：
 * 老三家常驻 deepseek（官方，缺省）/ zhipu-plan（智谱 Coding 套餐）/ ollama（本地）；
 * 国内常用 zhipu / qwen / kimi / siliconflow / volcengine / stepfun；海外常用 openai / anthropic /
 * google / xai / mistral / groq / openrouter；本地 lmstudio；custom 兜底（OpenAI 兼容与 Anthropic
 * 两套协议由 aiCustomProtocol 选）。插件没列出的服务商都从自定义接，不必为加一家改代码。
 * 协议（ADR-0297）：`protocol` 是 provider 属性，缺省即 OpenAI 兼容 /chat/completions；目前只有
 * anthropic 常驻通道走 Messages API（/messages、x-api-key、system 顶层、content_block_delta）。
 * 两套协议的差异收在 ProtocolAdapter 四个注入点，超时/中止/流式读取/兜底共用一份实现。
 * override 字符串（注册表 id）或对象 {endpoint, apiKey, model, extraHeaders, defaultMaxTokens}
 * （对象形态 = 调用方自带完整配置，不经注册表，脚本内指定第三方端点用；无协议身份，按 openai 走）。
 * prompt：fetch 流式（stream:true），失败自动 fallback requestUrl 非流式。
 * 图像输入（issue 311）：`prompt` 除纯文本外也收 `{text, images}`，带图时 content 走 OpenAI
 * 多模态数组（`image_url`）；本地图用 `imageDataUrl` 转 base64 data URL（DeepSeek V4.1-Flash
 * 只收公网 https 或 base64，格式限 JPEG/PNG/GIF/WebP）。纯文本调用报文与旧版逐字节一致。
 * 参数单源（issue 334/ADR-0148）：输出上限 max_tokens 面板独裁——唯一权威 = provider 解析结果
 * （设置「最大输出 token」per-provider 覆盖 > 注册表默认），调用方/工厂传值一律忽略；
 * 默认档位（issue 342/ADR-0151）：未填覆盖时按「当前模型名」查官方最大档（core/model-limits），
 * 未收录才回退注册表默认——上限只是封顶、不是目标消耗，正常短输出成本不变；
 * `prompt` 也收 `{messages}` 多轮报文（smartcat 行为流），temperature 等任务语义仍由调用方传。
 * 思考档位（issue 411/ADR-0179，取代 ADR-0146 的三风格静态映射）：档位表 = descriptor.thinking，
 * 参数名与被支持的档**逐家不同**，故由 provider 自带而不是全局映射——
 * deepseek：开关 thinking.type + 强度 reasoning_effort（仅 low/high/max，官方无 medium）；
 * zhipu-plan：glm-5.3 系强制思考（无关闭档），仅能调 reasoning_effort low/high/max；
 * ollama：OpenAI 兼容层把 reasoning_effort 映射为内部 Think（none = 关思考，省略 = 有能力则开）。
 * 取值 per-provider 存设置（aiThinkingOverrides），档位不在表内即不注入（保守，不冒进发参数）。
 */
import { requestUrl } from 'obsidian';
import { getApp } from './app';
import { resolveModelLimits } from './model-limits';
import { toBase64 } from './crypto';

export interface AISettingsLike {
  aiProvider?: string;
  /** 🔑 各服务商密钥（键 = 注册表 id）。2026-11-12 起新增的服务商统一走这张表，不再为每家加一个
   *  设置键；老三家（deepseek / zhipu-plan / ollama）仍读各自旧键，读时先查本表再回落旧键
   *  （见 keyOf），写入端按「有无 apiKeyKey」分流，故存量用户数据零迁移 */
  aiApiKeys?: Record<string, string>;
  /** 🔑 DeepSeek 密钥（留空则回退读外部配置） */
  deepseekApiKey?: string;
  /** 🔑 智谱 Plan（Coding 套餐）密钥 */
  zhipuPlanApiKey?: string;
  /** 🔑 Ollama（本地服务通常无需密钥，留空放行） */
  ollamaApiKey?: string;
  /** 🔑 自定义（OpenAI 兼容）接口地址（2026-11-11 加回；空 = 没配） */
  aiCustomEndpoint?: string;
  /** 🔑 自定义（OpenAI 兼容）API Key（空 = 没配） */
  aiCustomApiKey?: string;
  /** 自定义通道的请求协议（2026-11-12）：'openai'（缺省，OpenAI 兼容 /chat/completions）/
   *  'anthropic'（Claude 官方 Messages API /messages）。同一档自定义既能接 OpenAI 兼容网关，
   *  也能接 Claude 或各家 Anthropic 兼容端点，不必为换协议再加一档 */
  aiCustomProtocol?: string;
  /** 每提供商模型覆盖（键 = provider id；未填用注册表默认） */
  aiModelOverrides?: Record<string, string>;
  /** 每提供商最大输出 token 覆盖（键 = provider id；未填用注册表 defaultMaxTokens） */
  aiMaxTokensOverrides?: Record<string, number>;
  /** 每提供商思考档位（键 = provider id，值 = 该 provider 档位表内的 value；缺省 auto 不注入）。
   *  issue 411/ADR-0179：档位词表逐家不同（deepseek 有 off 无 medium；zhipu-plan 无 off；
   *  ollama 走 reasoning_effort），故按 provider 分开存，切服务商不互相污染 */
  aiThinkingOverrides?: Record<string, string>;
}

let _settingsProvider: (() => AISettingsLike) | null = null;

/** 注册设置读取器（main.ts onload 时注入） */
export function setAISettingsProvider(fn: () => AISettingsLike): void {
  _settingsProvider = fn;
}

function getQ3Settings(): AISettingsLike {
  return _settingsProvider ? _settingsProvider() : {};
}

// ---------------- provider 注册表（策略模式，ticket 170） ----------------

/** 思考档位一项：面板档位 → 请求体片段（body = null 表示不注入任何思考参数 = 跟随模型默认） */
export interface AIThinkingLevel {
  /** 档位值（存设置 aiThinkingOverrides；跨 provider 复用同一词表 auto/off/low/medium/high/max） */
  value: string;
  /** 设置面板展示名 */
  label: string;
  /** 该档位注入的请求体键值；null = 不注入 */
  body: Record<string, unknown> | null;
}

/**
 * provider 的思考档位表（issue 411/ADR-0179）：**唯一事实源**——设置面板选项与请求注入同取此处，
 * 参数名与被支持的档**逐家不同**（各家 api-docs 核对 2026-09-23）：
 * - deepseek：开关 `thinking:{type:enabled|disabled}` + 强度 `reasoning_effort: low|high|max`
 *   （官方映射表 low→low / medium→high / high→high / max→max，即「中」无独立档，不入表）；
 * - zhipu-plan：仅 `reasoning_effort: low|high|max`（thinking.type 服务端默认 enabled，不发）；
 *   glm-5.3 / 5.3-flash 系**强制思考**（发 disabled 直接报错），故不提供「关闭」档；
 * - ollama：OpenAI 兼容层只认 `reasoning_effort`（none = 关思考，low/medium/high = 开且分档）；
 *   省略该字段时有思考能力的模型**默认就是开**，故「关闭」走 `none` 而不是「不注入」。
 * 旧口径（ADR-0146 三风格静态映射 + 全局单值 aiThinking）已退役：名称与档位是 provider 属性，
 * 不是全局属性——映射表写在注册表里，新增 provider 才不用再改第二处。
 */
export interface AIThinkingSpec {
  levels: AIThinkingLevel[];
}

/** 存档/注入共用的档位动词表（逐家档位表由此取项，避免各写一份字面量） */
const THINK_AUTO: AIThinkingLevel = { value: 'auto', label: '跟随模型默认', body: null };
const THINK_OFF: AIThinkingLevel = { value: 'off', label: '关闭（省 token）', body: null };
const THINK_LOW: AIThinkingLevel = { value: 'low', label: '低', body: null };
const THINK_MEDIUM: AIThinkingLevel = { value: 'medium', label: '中', body: null };
const THINK_HIGH: AIThinkingLevel = { value: 'high', label: '高', body: null };
const THINK_MAX: AIThinkingLevel = { value: 'max', label: '最高', body: null };

/**
 * 请求协议（2026-11-12 用户拍板「自定义也要支持两套」）：市面上主流只有两种报文格式——
 * - openai：OpenAI 兼容 /chat/completions（Bearer 鉴权，messages 可含 system，SSE 取 delta.content）。
 *   绝大多数服务商（DeepSeek / 智谱 / 通义 / Kimi / 硅基流动 / 火山 / 阶跃 / Groq / xAI /
 *   Mistral / OpenRouter / LM Studio / LocalAI…）以及 Google 的 OpenAI 兼容端点都是这一套。
 * - anthropic：Claude 官方 Messages API /messages（x-api-key + anthropic-version 头，system 走顶层
 *   字段、SSE 是 content_block_delta 事件）。
 * 缺省即 openai——新增服务商不写 protocol 就是 OpenAI 兼容，不必重复声明。
 */
export type AIProtocol = 'openai' | 'anthropic';

export interface AIProviderDescriptor {
  /** 注册表键（settings.aiProvider 取值） */
  id: string;
  /** 设置页下拉展示名 */
  label: string;
  /** 请求协议（缺省 = 'openai'，见 AIProtocol） */
  protocol?: AIProtocol;
  /** 默认 API endpoint */
  endpoint: string;
  /** 默认模型（空 = 沿用调用方默认模型） */
  model: string;
  /** 注册表默认 max_tokens（兜底档：设置 per-provider 覆盖 > 模型查表 > 此默认）。
   *  上限只是封顶、不是目标消耗（ADR-0148）；填超模型真实上限会被服务端拒绝，
   *  故此处只放「该服务商在售主力模型的官方最大档」，其余留给 model-limits 按模型名解析 */
  defaultMaxTokens: number;
  /**
   * 输出上限硬护栏（issue 457/ADR-0193）：官方文档核实过的该通道最大输出——面板填不超它、
   * 解析层也封顶。**缺省 = 该通道无官方上限可依**（模型任意的本地 Ollama 即此例），
   * 此时不设围栏、尊重面板设置值。
   *
   * 与 defaultMaxTokens 的差别是语义不是数值：后者是「未填时用多少」的兜底档，可被覆盖越过；
   * 本字段是「最多能到多少」的墙。只有查不到模型档（model-limits 未收录）时才轮到它兜底，
   * 故 deepseek 这类「默认模型名留空、实际模型由调用方传」的通道也必须显式填上。
   */
  maxOutputCap?: number;
  /** 密钥在 AISettingsLike 的键名。**缺省 = 走 aiApiKeys[id] 这张表**（新服务商不必加设置键）；
   *  只有老三家保留了各自的旧键位（存量数据兼容），新条目一律不填 */
  apiKeyKey?: keyof AISettingsLike;
  /** 设置页密钥行标题（注册表驱动生成密钥行；ticket 171 策略模式完整化） */
  apiKeyLabel: string;
  /** 密钥行描述（设置页；约 20 字自然句，ticket 100 文案规范） */
  apiKeyDesc?: string;
  /** 该 provider 的思考档位表（缺省 = 不注入任何思考参数；设置面板选项与请求注入同源） */
  thinking?: AIThinkingSpec;
}

/** 缺省服务商（注册表首位；设置未显式时用它，全仓不再散写字面量） */
export const DEFAULT_AI_PROVIDER = 'deepseek';

/**
 * 默认最大输出的保守档（2026-11-12 发版 review P1）。
 *
 * 注册表里有些家的「最大输出」是从聚合数据源照抄的，值可疑（有一家直接等于上下文长度、
 * 一家人为地给了 50 万）。把它当默认值发出去，服务端认为超限会**整条请求拒掉**——
 * 用户只看到「AI 请求失败」，想不到去改最大输出。故口径：
 *   - 官方文档写明的值（DeepSeek 384K / 智谱 131072 / OpenAI·Claude 128K / Gemini 64K）照用；
 *   - 只有聚合数据、没法核实的家，默认走这一档；
 *   - `maxOutputCap` 仍保留上游值作面板软上限，用户自己调高是明确动作，不算默认坑人。
 */
const SAFE_DEFAULT_MAX_TOKENS = 32768;

/**
 * 在册提供商（2026-11-12/ADR-0297 扩表：老三家常驻 + 国内常用 + 海外常用 + 本地 + 自定义兜底）。
 * 前三家常驻通道由插件长期负责「选完填密钥就能用」；2026-11-12 起把市面上真正常用的十几家也收进来，
 * 端点与默认模型取自 models.dev（MIT，2026-11-12 抓取），不引任何运行时依赖。
 * 插件没列出的服务商（新的 / 自建的 / 冷门的）都从 custom 接，不必为加一家发一版。
 * 思考档位表见 AIThinkingSpec 注释（逐家参数名与支持档不同；没有表的家 = 不注入思考参数）。
 */
export const AI_PROVIDER_REGISTRY: AIProviderDescriptor[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    model: '', // 空 = 沿用调用方默认模型（原行为：deepseek 不强制模型）
    // 兜底 = 端点在售模型的官方最大档（2026-09-16 核对：上下文 1M / 最大输出 384K）；
    // 用户在「模型名称」行指定模型时，以 model-limits 查表值为准（issue 342/ADR-0151）
    defaultMaxTokens: 393216,
    // 硬护栏同值：此家缺省模型名留空（由调用方传），model-limits 兜不到，须显式声明
    maxOutputCap: 393216,
    apiKeyKey: 'deepseekApiKey',
    apiKeyLabel: 'DeepSeek 密钥',
    apiKeyDesc: 'DeepSeek 官方的接口密钥',
    // 思考：官方 OpenAI 格式开关 thinking.type + 强度 reasoning_effort（默认开、默认 high）
    thinking: {
      levels: [
        THINK_AUTO,
        { ...THINK_OFF, body: { thinking: { type: 'disabled' } } },
        { ...THINK_LOW, body: { thinking: { type: 'enabled' }, reasoning_effort: 'low' } },
        { ...THINK_HIGH, body: { thinking: { type: 'enabled' }, reasoning_effort: 'high' } },
        { ...THINK_MAX, body: { thinking: { type: 'enabled' }, reasoning_effort: 'max' } },
      ],
    },
  },
  {
    // Coding 套餐（Lite/Pro/Max）额度只在 coding 专用端点生效；走标准 paas/v4 会按量计费报余额不足
    id: 'zhipu-plan',
    label: '智谱 Plan',
    endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-5.3-flash',
    // glm-5.3 / 5.3-flash 官方最大输出 131072（默认 65536，上下文 1M）
    defaultMaxTokens: 131072,
    maxOutputCap: 131072, // 硬护栏：glm-5.3 系官方最大输出（填超即服务端 400 / 1210）
    apiKeyKey: 'zhipuPlanApiKey',
    apiKeyLabel: '智谱 Plan 密钥',
    apiKeyDesc: '智谱 Coding 套餐的接口密钥',
    // 思考：glm-5.3 / 5.3-flash **强制思考**（发 disabled 无效），故只给强度档
    thinking: {
      levels: [
        THINK_AUTO,
        { ...THINK_LOW, body: { reasoning_effort: 'low' } },
        { ...THINK_HIGH, body: { reasoning_effort: 'high' } },
        { ...THINK_MAX, body: { reasoning_effort: 'max' } },
      ],
    },
  },
  {
    id: 'ollama',
    label: 'Ollama（本地）',
    endpoint: 'http://localhost:11434/v1',
    model: 'llama3.1',
    defaultMaxTokens: 8192,
    // 有意不设 maxOutputCap：本地模型输出上限因所装模型而异、无官方档位可依；8192 只是兜底档，
    // 面板可自由调大（既有口径，不因本票收紧）

    apiKeyKey: 'ollamaApiKey',
    apiKeyLabel: 'Ollama 密钥',
    apiKeyDesc: '本地服务无需密钥',
    // 思考：兼容层把 reasoning_effort 映射为内部 Think（none = 关；省略 = 有能力则开）
    thinking: {
      levels: [
        THINK_AUTO,
        { ...THINK_OFF, body: { reasoning_effort: 'none' } },
        { ...THINK_LOW, body: { reasoning_effort: 'low' } },
        { ...THINK_MEDIUM, body: { reasoning_effort: 'medium' } },
        { ...THINK_HIGH, body: { reasoning_effort: 'high' } },
      ],
    },
  },

  // ==================== 国内常用（2026-11-12 批量接入） ====================
  // 端点与默认模型取自 models.dev（2026-11-12 拉取），调大默认模型前请先核对该家官方文档。
  // 以下条目都不带 apiKeyKey：密钥统一存 settings.aiApiKeys[id]，不新增设置键。

  {
    id: 'zhipu',
    label: '智谱 GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3-flash',
    // glm-5.3 系官方最大输出 131072（上下文 1M）；与 zhipu-plan 同模型、不同计费端点
    defaultMaxTokens: 131072,
    maxOutputCap: 131072,
    apiKeyLabel: '智谱 GLM 密钥',
    apiKeyDesc: '智谱开放平台的接口密钥',
  },
  {
    id: 'qwen',
    label: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-flash',
    // 阿里云百炼 OpenAI 兼容面（国内站）；上下文 1M / 最大输出 131072
    defaultMaxTokens: 131072,
    maxOutputCap: 131072,
    apiKeyLabel: '通义千问密钥',
    apiKeyDesc: '阿里云百炼的接口密钥',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    endpoint: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3',
    // models.dev 报 k3 输出上限 1048576（与上下文同档，疑为上游数据待核）：默认不敢照抄，
    // 走保守档（SAFE_DEFAULT_MAX_TOKENS）；面板「最大输出 token」要调高随时可调
    defaultMaxTokens: SAFE_DEFAULT_MAX_TOKENS,
    maxOutputCap: 1048576,
    apiKeyLabel: 'Kimi 密钥',
    apiKeyDesc: '月之暗面开放平台的接口密钥',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1',
    model: 'zai-org/GLM-5.3-Flash',
    // 聚合式服务：模型名带厂商前缀（zai-org/… / Qwen/… / deepseek-ai/…），选模型时照抄完整 id
    defaultMaxTokens: 131072,
    maxOutputCap: 131072,
    apiKeyLabel: '硅基流动密钥',
    apiKeyDesc: '硅基流动的接口密钥',
  },
  {
    id: 'volcengine',
    label: '火山方舟',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-1-pro-260628',
    // 豆包模型名带日期后缀（-260628），换版本时在「模型名称」行改；也可填方舟控制台的接入点 id
    // 上游报的 256000 未在官方文档核实，默认走保守档（面板可调高）
    defaultMaxTokens: SAFE_DEFAULT_MAX_TOKENS,
    maxOutputCap: 256000,
    apiKeyLabel: '火山方舟密钥',
    apiKeyDesc: '火山引擎方舟的接口密钥',
  },
  {
    id: 'stepfun',
    label: '阶跃星辰',
    endpoint: 'https://api.stepfun.com/v1',
    model: 'step-3.7-flash',
    // 上游报的 256000 未核实，默认走保守档
    defaultMaxTokens: SAFE_DEFAULT_MAX_TOKENS,
    maxOutputCap: 256000,
    apiKeyLabel: '阶跃星辰密钥',
    apiKeyDesc: '阶跃星辰开放平台的接口密钥',
  },

  // ==================== 海外常用（2026-11-12 批量接入） ====================

  {
    id: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-6-luna',
    // gpt-6 系最大输出 128000 / 上下文 1.05M
    defaultMaxTokens: 128000,
    maxOutputCap: 128000,
    apiKeyLabel: 'OpenAI 密钥',
    apiKeyDesc: 'OpenAI 官方平台的接口密钥',
    // OpenAI 官方支持 reasoning_effort（low/medium/high），但模型档位因款而异——保守不注入
  },
  {
    // Claude 官方：唯一走 Anthropic Messages 协议的常驻通道（与自定义的 anthropic 协议同一实现）
    id: 'anthropic',
    label: 'Claude（Anthropic）',
    protocol: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    // claude-5 系最大输出 128000 / 上下文 1M（haiku 与 sonnet 同档）
    defaultMaxTokens: 128000,
    maxOutputCap: 128000,
    apiKeyLabel: 'Claude 密钥',
    apiKeyDesc: 'Anthropic 官方平台的接口密钥',
    // 思考（extended thinking）走 budget_tokens，须与 max_tokens 联动折算，本版暂不注入
  },
  {
    id: 'google',
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
    // 走 Google 的 OpenAI 兼容面（/v1beta/openai），故与本家其余通道共用一套请求实现
    defaultMaxTokens: 65536,
    maxOutputCap: 65536,
    apiKeyLabel: 'Gemini 密钥',
    apiKeyDesc: 'Google AI Studio 的接口密钥',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1',
    model: 'grok-4.7',
    // 500000 这个量级不可能是输出上限（疑为上下文），默认走保守档
    defaultMaxTokens: SAFE_DEFAULT_MAX_TOKENS,
    maxOutputCap: 500000,
    apiKeyLabel: 'xAI 密钥',
    apiKeyDesc: 'xAI 控制台的接口密钥',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1',
    model: 'mistral-large-4',
    // 上游报的 262144 未核实，默认走保守档
    defaultMaxTokens: SAFE_DEFAULT_MAX_TOKENS,
    maxOutputCap: 262144,
    apiKeyLabel: 'Mistral 密钥',
    apiKeyDesc: 'Mistral 控制台的接口密钥',
  },
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    model: 'qwen/qwen3.8-27b',
    // Groq 主打推理速度，模型名多带上游前缀（qwen/… / openai/…）
    defaultMaxTokens: 16384,
    maxOutputCap: 16384,
    apiKeyLabel: 'Groq 密钥',
    apiKeyDesc: 'Groq 控制台的接口密钥',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    // 不设默认模型：这一家是聚合网关，模型名（vendor/model）必须由用户自己选，
    // 留空即与自定义同理——「获取模型名」拉全量列表后挑一个
    model: '',
    defaultMaxTokens: 8192,
    // 有意不设 maxOutputCap：模型任意（几百个），上限是模型属性，无法用单一常量围栏
    apiKeyLabel: 'OpenRouter 密钥',
    apiKeyDesc: 'OpenRouter 开放平台的密钥',
  },

  // ==================== 本地（2026-11-12） ====================

  {
    id: 'lmstudio',
    label: 'LM Studio（本地）',
    endpoint: 'http://127.0.0.1:1234/v1',
    // 本地模型由用户自行下载，注册表给不出默认；留空必须手填（同自定义）
    model: '',
    defaultMaxTokens: 8192,
    // 同 Ollama：本地模型上限因所装模型而异，不设围栏
    apiKeyLabel: 'LM Studio 密钥',
    apiKeyDesc: '本地服务无需密钥',
  },
  {
    /**
     * 自定义（OpenAI 兼容 / Anthropic 两套协议）：端点、密钥、模型全由用户填，注册表只占一个位置。
     *
     * 2026-11-11 加回（issue 411 时随「只留三条通道」退役）：插件能替用户保证
     * 「选完填密钥就能用」的只有前几家常驻通道；剩下的服务商（自建网关 /
     * 未被收录的新家）都靠这一档接，不必为了加一家就发一版。
     * 2026-11-12：协议可选择（aiCustomProtocol）——OpenAI 兼容与 Anthropic Messages 两种报文，
     * 故连 Claude 或任意 Anthropic 兼容端点也能从自定义接。
     * 缺地址或缺密钥在 getAIProvider 里直接拦下，不拿空端点拼 URL。
     */
    id: 'custom',
    label: '自定义（OpenAI 兼容）',
    // protocol 由 getAIProvider 按 settings.aiCustomProtocol 动态解析（注册表里只作缺省）
    protocol: 'openai',
    endpoint: '',
    model: '',
    /* 兜底档：自定义没有官方上限可依（同 Ollama），面板可自由调大 */
    defaultMaxTokens: 8192,
    apiKeyKey: 'aiCustomApiKey',
    apiKeyLabel: '自定义 API 密钥',
    apiKeyDesc: '在服务官网获取后填入这里',
    /* 不设 thinking：不认识的服务商冒进发思考参数有 400 风险，一律不注入 */
  },
];

/** 取注册表描述（未知名回退缺省服务商，保证设置页与解析一致） */
export function getProviderDescriptor(id?: string): AIProviderDescriptor {
  return (
    AI_PROVIDER_REGISTRY.find((p) => p.id === id) ||
    AI_PROVIDER_REGISTRY.find((p) => p.id === DEFAULT_AI_PROVIDER) ||
    AI_PROVIDER_REGISTRY[0]
  );
}

/** 该 provider 的档位表（设置面板选项与请求注入同源；未知 id 回退缺省服务商档位表） */
export function thinkingLevelsOf(providerId?: string): AIThinkingLevel[] {
  return getProviderDescriptor(providerId).thinking?.levels ?? [];
}

/**
 * 输出上限护栏基准（issue 457/ADR-0193）：先按该 provider **当前生效模型**（面板覆盖 > 注册表
 * 默认）查 model-limits 的官方最大输出；查不到再取注册表 `maxOutputCap`；两者皆无 → `undefined`，
 * 表示**该通道无官方上限可依、不设围栏**（模型任意的本地 Ollama 即此例，面板可自由设值）。
 *
 * 上限是「模型」的属性，不是全局常量——智谱 glm-5.3-flash 131072 / DeepSeek 393216，写死一个数
 * 必然对某家越界。设置面板的输入上界与请求解析共用此函数，禁留第二套判定。
 */
export function maxOutputCapOf(providerId?: string, modelName?: string): number | undefined {
  const desc = getProviderDescriptor(providerId);
  const hit = resolveModelLimits(modelName || desc.model || '');
  return hit ? hit.maxOutput : desc.maxOutputCap;
}

/**
 * 当前 provider + 档位值 → 应注入的请求体键值对；null = 不注入。
 * auto / 空 / 档位不在该 provider 表内（含历史遗留值、provider 已退役的档位）一律不注入——
 * 「不认识的档位宁可不动」优先于「尽力翻译」，避免给端点发它不认识的参数。
 * providerId 为 undefined（对象形态 override，无注册表身份）同样不注入。
 */
export function thinkingBodyFor(providerId: string | undefined, level: string | undefined): Record<string, unknown> | null {
  if (!providerId || !level || level === 'auto') return null;
  const hit = thinkingLevelsOf(providerId).find((l) => l.value === level);
  return hit?.body ?? null;
}


/**
 * modelOptions 是否显式带了思考键（显式优先：调用方在 modelOptions 里直给的思考参数不被设置面板覆盖）。
 * 保留判据的理由：域内确有「与面板档位不同」的实测语义（knowledge/mount-suggest 的 low 档，
 * ADR-0140 实测默认档 143s / low 7s），显式优先让这类调用点不被面板设置改写。
 */
export function hasExplicitThinkingOption(mo: Record<string, any>): boolean {
  return 'enable_thinking' in mo || 'reasoning_effort' in mo || 'thinking' in mo;
}

// ---------------- provider 解析 ----------------

interface AIProvider {
  /** 注册表 id（思考档位表按它查，issue 411/ADR-0179）；对象 override 无 id = 不注入思考参数 */
  id?: string;
  /** 请求协议（缺省 'openai'；对象 override 无协议身份同样按 openai 走） */
  protocol?: AIProtocol;
  endpoint: string;
  apiKey: string;
  model?: string;
  /** 附加请求头（仅对象 override 可带，如非 OpenAI 兼容服务的 anthropic-version） */
  extraHeaders?: Record<string, string>;
  /** 注册表默认 max_tokens（设置 per-provider 覆盖缺省时的兜底档） */
  defaultMaxTokens?: number;
}

/**
 * 读某家服务商的密钥：先查 aiApiKeys 表（新家入口），再回落该家的旧键位（存量兼容）。
 * 2026-11-12 起新增服务商一律走表，故这里看不到 `xxxApiKey` 字段的直接访问。
 */
function keyOf(s: AISettingsLike, desc: AIProviderDescriptor): string {
  const fromTable = String(s.aiApiKeys?.[desc.id] ?? '').trim();
  if (fromTable) return fromTable;
  const legacy = desc.apiKeyKey ? s[desc.apiKeyKey] : '';
  return String(legacy ?? '').trim();
}

/** 该家是否免鉴权（本地服务：Ollama / LM Studio 的默认端点不校验密钥，空 key 放行） */
function isNoAuthProvider(desc: AIProviderDescriptor): boolean {
  return desc.id === 'ollama' || desc.id === 'lmstudio';
}

/** 解析某家的请求协议：注册表声明优先；自定义按 settings.aiCustomProtocol 动态取（缺省 openai） */
function protocolOf(desc: AIProviderDescriptor, s: AISettingsLike): AIProtocol {
  if (desc.id === 'custom') {
    return String(s.aiCustomProtocol || '').toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';
  }
  return desc.protocol === 'anthropic' ? 'anthropic' : 'openai';
}

let _aiProviderCache: AIProvider | null = null;

/** 重置 provider 缓存（设置变更后调用） */
export function resetAIProviderCache(): void {
  _aiProviderCache = null;
}

/** 对象形态 override（调用方直给完整配置，如脚本内指定第三方端点/key） */
interface AIOverrideObject {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
  defaultMaxTokens?: number;
}

/** 解析 AI provider（override 优先级最高），逻辑与 Q3 getAIProvider 逐字一致（ticket 170 起查注册表）。
 *  C2：带 override 的调用只服务本次，解析结果**不写**全局缓存——否则 `getAIProvider('deepseek')`
 *  这类字符串 override 会把非当前设置的 provider 灌进缓存，后续无参调用命中被污染的缓存 */
export async function getAIProvider(override?: string | AIOverrideObject): Promise<AIProvider> {
  if (!override && _aiProviderCache) return _aiProviderCache;
  const cacheable = !override; // 无 override 才代表「当前设置的 provider」，结果可缓存复用
  const cachePut = (p: AIProvider): AIProvider => {
    if (cacheable) _aiProviderCache = p;
    return p;
  };
  const s = getQ3Settings();
  // 调用方直接给完整配置（如脚本内指定第三方端点/key）——不经注册表，故无思考档位可查
  if (override && typeof override === 'object' && override.apiKey) {
    return {
      protocol: 'openai', // 对象形态 = 调用方自带完整配置，无注册表协议身份，一律按 OpenAI 兼容走
      endpoint: String(override.endpoint || 'https://api.deepseek.com').replace(/\/+$/, ''),
      apiKey: override.apiKey,
      model: override.model || undefined,
      extraHeaders: override.extraHeaders || undefined,
      defaultMaxTokens: override.defaultMaxTokens,
    };
  }
  const name = (typeof override === 'string' && override) || s.aiProvider || DEFAULT_AI_PROVIDER;
  const desc = getProviderDescriptor(name);
  /* 自定义（OpenAI 兼容）：端点/密钥/模型全来自设置，注册表描述只给密钥键与兜底档。
     缺一样就拦——空端点拼出来是相对路径，fetch 直接抛 TypeError，报错文案帮不上用户。 */
  if (name === 'custom') {
    const endpoint = String(s.aiCustomEndpoint || '').trim().replace(/\/+$/, '');
    const customKey = String(s.aiCustomApiKey || '').trim();
    if (!endpoint || !customKey) {
      throw new Error(
        '未配置自定义 AI 服务：请在 AI 配置的 LLM 组填写「自定义 API 地址」与「自定义 API 密钥」'
      );
    }
    const overrideModel = s.aiModelOverrides?.['custom'];
    const effModel = overrideModel || '';
    /* 自定义没有注册表默认模型：空的 model 发出去服务端直接 400，报错落在对面，
       用户看不懂。跟地址、密钥一样在入口拦下，文案直接说去哪填。 */
    if (!effModel) {
      throw new Error(
        '未填自定义模型：请在 AI 配置的 LLM 组填写「模型名称」（自定义服务商没有默认模型）'
      );
    }
    // 与在册通道同一套上限解析：模型名命中内置档位表就按它封顶，未收录走兜底档
    const cap = maxOutputCapOf('custom', effModel);
    const requested = Number(s.aiMaxTokensOverrides?.['custom']);
    const defaultMaxTokens =
      requested > 0 ? (cap === undefined ? requested : Math.min(requested, cap)) : cap ?? desc.defaultMaxTokens;
    return cachePut({
      id: 'custom',
      // 协议随设置切换：OpenAI 兼容网关与 Anthropic 兼容端点共用一个「自定义」档
      protocol: protocolOf(desc, s),
      endpoint,
      apiKey: customKey,
      model: effModel || undefined,
      defaultMaxTokens,
    });
  }
  const key = keyOf(s, desc);
  if (!key && name === 'deepseek') {
    // deepseek 兼容兜底：settings 缺 key 时读 QuickAdd data.json（legacy，无 UI）
    try {
      const raw = await getApp().vault.adapter.read('.obsidian/plugins/quickadd/data.json');
      const cfg = JSON.parse(raw);
      const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
      if (provider && provider.endpoint && provider.apiKey) {
        return cachePut({
          id: 'deepseek',
          protocol: 'openai',
          endpoint: String(provider.endpoint).replace(/\/+$/, ''),
          apiKey: provider.apiKey,
          defaultMaxTokens: desc.defaultMaxTokens,
        });
      }
    } catch (e) { /* 读取失败由调用方提示 */ }
  }
  // 本地服务（Ollama / LM Studio）无需鉴权：空密钥放行（其余提供商缺 key 即拦截）
  if (!key && !isNoAuthProvider(desc)) {
    throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
  }
  // ticket 172 per-provider 覆盖：用户设置的模型/上下文/max token 优先于注册表默认；
  // issue 342/ADR-0151 起，中间插入「按当前模型名查官方档位」（model-limits 单一事实源）——
  // 覆盖 > 查表 > 注册表默认，但覆盖值受「该模型官方上限」封顶（issue 457/ADR-0193 护栏）。
  // 查表输入只用面板可见的模型名（覆盖 > 注册表默认），调用点临时传的模型名不参与（ADR-0148）
  const overrideModel = s.aiModelOverrides?.[name];
  const effModel = overrideModel || desc.model || '';
  const cap = maxOutputCapOf(name, effModel);
  // 上界护栏（issue 457/ADR-0193）：面板输入框的 max 只是 UI 软拦——data.json 手改、旧版残留值、
  // 跨 provider 换槽都能绕过它；超限值直送会被服务端拒绝（智谱 1210：max_tokens 需落在
  // [1,131072]），且失败面是全域 AI 而非单次调用。故在唯一的解析出口就近封顶兜底。
  // 未填覆盖：护栏基准优先（模型档 > 注册表 maxOutputCap），基准也没有才回落兜底档；
  // 填了覆盖：`min(覆盖值, 基准)`，基准为 undefined（无官方上限可依的通道，如本地 Ollama）
  // 则不封顶、尊重面板设置值。
  // 0 / 负数 / 非数一律视为「未填」（与面板「填 0 即清除覆盖」语义一致）。
  const requested = Number(s.aiMaxTokensOverrides?.[name]);
  const defaultMaxTokens =
    requested > 0
      ? cap === undefined
        ? requested
        : Math.min(requested, cap)
      : cap ?? desc.defaultMaxTokens;
  return cachePut({
    id: name,
    protocol: protocolOf(desc, s),
    endpoint: desc.endpoint,
    apiKey: (key as string) || '',
    model: effModel || undefined,
    defaultMaxTokens,
  });
}

// ---------------- 请求实现 ----------------

/** 取消异常（AbortError 语义；调用方以 signal.aborted 判定取消路径，ticket 141 对话可取消） */
function abortError(): Error {
  const e = new Error('请求已取消');
  e.name = 'AbortError';
  return e;
}

/**
 * 请求空闲超时（ms，C1）：建连后远端不回包（fetch 等响应头 / reader.read() 等下一段 /
 * requestUrl 等整个响应）超过该时长即中止并报错。对齐 smartcat 60s 先例；流式按「空闲」计
 * （每次读到数据重置计时），长回答不被总时长误杀，死连接 60s 内必 settle 不再转圈到重启。
 */
export const AI_IDLE_TIMEOUT_MS = 60000;

/** 带图请求的空闲超时：图片以 base64 进请求体（可达数 MB），上行慢时 60s 不够用（issue 311） */
export const AI_IMAGE_IDLE_TIMEOUT_MS = 180000;

/** 超时异常（TimeoutError 语义，区别于用户取消的 AbortError——超时允许走 requestUrl 兜底重试） */
function timeoutError(idleMs: number = AI_IDLE_TIMEOUT_MS): Error {
  const e = new Error(`AI 请求超时（${Math.round(idleMs / 1000)} 秒无响应）`);
  e.name = 'TimeoutError';
  return e;
}

/**
 * 本次请求的空闲超时：带图请求放宽到 180s。
 * 图片走 base64 塞在请求体里，可达数 MB——上行慢时「建连不回包」的等待远超 60s，
 * 用默认阈值会把正常上传误判成超时（它还算 TimeoutError，会再走一次 requestUrl 重发，等于白传两遍）。
 */
function idleTimeoutOf(body: any): number {
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const hasImage = msgs.some(
    (m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === 'image_url')
  );
  return hasImage ? AI_IMAGE_IDLE_TIMEOUT_MS : AI_IDLE_TIMEOUT_MS;
}

// ---------------- 协议适配（OpenAI 兼容 / Anthropic Messages） ----------------

/**
 * 一份协议的四点差异：端点、鉴权头、报文转换、增量文本提取。
 * 超时、中止、流式读取、requestUrl 兜底、坏 chunk 容错全部共用——两套协议只在下面这张表里分叉，
 * 避免把 60 行的空闲超时/AbortController 逻辑复制两份（复制出来的两份早晚会漂移）。
 */
interface ProtocolAdapter {
  /** 完整对话端点（endpoint 已去尾斜杠） */
  url(endpoint: string): string;
  /** 鉴权与内容类型请求头 */
  headers(provider: AIProvider): Record<string, string>;
  /** 中立报文（model/messages/max_tokens/stream + modelOptions）→ 该协议请求体 */
  body(body: any): any;
  /** SSE 单个 data JSON → 本次增量文本（无增量返回空串） */
  deltaOf(chunk: any): string;
  /** 流结束标记（OpenAI 是 [DONE] 哨兵单独判，这里指协议自带的事件） */
  isDone(chunk: any): boolean;
  /** SSE 内联错误（Anthropic 把错误当事件发，OpenAI 走 HTTP 状态码） */
  errorOf(chunk: any): string | null;
  /** 非流式完整响应 → 文本；缺 content 返回 null（由调用方按「响应缺少 content」报错） */
  textOf(data: any): string | null;
}

/** Anthropic 报文只接受这几个可选参数（其余字段服务端会以 400 拒绝，故白名单透传） */
const ANTHROPIC_PASSTHROUGH = ['temperature', 'top_p', 'top_k', 'metadata'] as const;

/** 中立 content（OpenAI 形态）→ Anthropic content：图片从 image_url 转 image/source */
function toAnthropicContent(content: any): any {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;
  const out: any[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text') {
      out.push({ type: 'text', text: String(part.text ?? '') });
    } else if (part.type === 'image_url') {
      const url = String(part.image_url?.url ?? '');
      // data URL（本地图）→ base64 source；公网直链 → url source（Anthropic 两种都收）
      const m = /^data:([^;,]+);base64,(.*)$/s.exec(url);
      if (m) out.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      else if (url) out.push({ type: 'image', source: { type: 'url', url } });
    }
    // 其余部件（未来若加 file 等）不转发，避免发出 Anthropic 不认识的 type
  }
  return out;
}

/** 中立报文 → Anthropic Messages 报文：system 抽到顶层、图片换写法、参数走白名单 */
function toAnthropicBody(body: any): any {
  const out: any = { model: body?.model, stream: !!body?.stream };
  if (typeof body?.max_tokens === 'number') out.max_tokens = body.max_tokens;
  const sys: string[] = [];
  const list: any[] = [];
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  for (const m of msgs) {
    if (!m || typeof m !== 'object') continue;
    // Anthropic 的 messages 只认 user/assistant——system 必须抽到顶层字段，塞在数组里会被 400
    if (m.role === 'system') {
      const t = typeof m.content === 'string' ? m.content : '';
      if (t) sys.push(t);
      continue;
    }
    list.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: toAnthropicContent(m.content) });
  }
  // messages 为空数组会被拒（"messages: at least one message is required"），补一条空 user 让报错更可读
  out.messages = list.length ? list : [{ role: 'user', content: '' }];
  if (sys.length) out.system = sys.join('\n\n');
  for (const k of ANTHROPIC_PASSTHROUGH) {
    if (body?.[k] !== undefined) out[k] = body[k];
  }
  // OpenAI 的 stop 在 Anthropic 叫 stop_sequences（名字不同，值同构）
  if (body?.stop !== undefined) out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  return out;
}

const OPENAI_ADAPTER: ProtocolAdapter = {
  url: (endpoint) => `${endpoint}/chat/completions`,
  headers: (provider) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...(provider.extraHeaders || {}),
  }),
  body: (body) => body,
  deltaOf: (chunk) => chunk?.choices?.[0]?.delta?.content || '',
  isDone: () => false, // OpenAI 以 data: [DONE] 收尾，由流解析单独判
  errorOf: () => null,
  textOf: (data) => data?.choices?.[0]?.message?.content ?? null,
};

const ANTHROPIC_ADAPTER: ProtocolAdapter = {
  url: (endpoint) => `${endpoint}/messages`,
  headers: (provider) => ({
    'Content-Type': 'application/json',
    // Anthropic 不走 Bearer：密钥在 x-api-key，且必须声明 API 版本
    'x-api-key': provider.apiKey,
    'anthropic-version': '2023-06-01',
    ...(provider.extraHeaders || {}),
  }),
  body: toAnthropicBody,
  deltaOf: (chunk) => (chunk?.type === 'content_block_delta' && chunk?.delta?.type === 'text_delta'
    ? String(chunk.delta.text ?? '')
    : ''),
  isDone: (chunk) => chunk?.type === 'message_stop',
  errorOf: (chunk) => (chunk?.type === 'error'
    ? String(chunk?.error?.message || chunk?.error?.type || '未知错误')
    : null),
  textOf: (data) => {
    const arr = Array.isArray(data?.content) ? data.content : [];
    if (!arr.length) return null;
    return arr.filter((c: any) => c?.type === 'text').map((c: any) => String(c.text ?? '')).join('');
  },
};

/** 按 provider.protocol 取适配器（缺省 openai） */
function adapterOf(provider: AIProvider): ProtocolAdapter {
  return provider.protocol === 'anthropic' ? ANTHROPIC_ADAPTER : OPENAI_ADAPTER;
}

/** SSE 流式解析（fetch + ReadableStream）；signal 可中止，onDelta 逐段增量回调（ticket 141）。
 *  内部 AbortController 组合外部 signal 与空闲超时（C1）：建连不回包 / 流中途停发超时即中止
 *  （带图请求阈值放宽，见 idleTimeoutOf）。两套协议共用本函数，差异全在 adapter。 */
async function streamChat(provider: AIProvider, body: any, signal?: AbortSignal, onDelta?: (delta: string) => void): Promise<string> {
  const adapter = adapterOf(provider);
  const idleMs = idleTimeoutOf(body);
  const headers = adapter.headers(provider);
  // 内部 controller：外部 signal 转发 + 空闲超时；aborted 且外部未取消 ⇒ 超时
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  let outerLinked = false;
  if (signal) {
    if (signal.aborted) controller.abort();
    else {
      signal.addEventListener('abort', onOuterAbort);
      outerLinked = true;
    }
  }
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdle = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleMs);
  };
  try {
    armIdle();
    const resp = await fetch(adapter.url(provider.endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(adapter.body(body)),
      signal: controller.signal,
    });
    if (!resp.ok) {
      let msg = `API ${resp.status}`;
      try {
        const err = await resp.json();
        if (err.error && err.error.message) msg = err.error.message;
      } catch (e) { /* 保留状态码 */ }
      throw new Error(msg);
    }
    // 响应无流（老 WebView / 非 SSE）→ 直接读完整 JSON（json() 期间空闲超时仍生效）
    if (!resp.body || typeof (resp.body as any).getReader !== 'function') {
      const data: any = await resp.json();
      return adapter.textOf(data) ?? '';
    }
    const reader = (resp.body as any).getReader();
    const decoder = new TextDecoder();
    let full = '', buf = '';
    while (true) {
      armIdle(); // 每段数据之间重置空闲计时（流式长回答不受总时长限制）
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { try { reader.cancel(); } catch (e) { /* 忽略 */ } return full; }
        const chunk = safeJson(payload);
        if (!chunk) continue; // 坏 chunk 跳过（心跳行 / 空行 / 截断数据）
        const errMsg = adapter.errorOf(chunk);
        if (errMsg) throw new Error(errMsg);
        if (adapter.isDone(chunk)) { try { reader.cancel(); } catch (e) { /* 忽略 */ } return full; }
        const delta = adapter.deltaOf(chunk);
        if (delta) {
          full += delta;
          try {
            onDelta?.(delta); // 增量回调异常不影响流式解析
          } catch (e) { /* 忽略 */ }
        }
      }
    }
    return full;
  } catch (e: any) {
    // 超时中止（内部 controller 触发且外部 signal 未取消）→ 人话超时错误（TimeoutError，
    // 非 AbortError——prompt 层按可兜底失败处理，requestUrl 通道重试一次）
    if (controller.signal.aborted && !(signal && signal.aborted)) throw timeoutError(idleMs);
    throw e;
  } finally {
    if (idleTimer !== null) clearTimeout(idleTimer);
    if (outerLinked && signal) signal.removeEventListener('abort', onOuterAbort);
  }
}

/** 解析 SSE 单行 JSON；失败返回 null（心跳 / 半包都算正常损耗，不该打断整条流） */
function safeJson(text: string): any {
  try { return JSON.parse(text); } catch (e) { return null; }
}

/** 非流式（requestUrl：Obsidian 官方 API，无 CORS 限制）；requestUrl 不支持中止 → 前后查 signal，已取消按丢弃处理。
 *  C1：requestUrl 本身无超时也不可中止，这里以 race 兜底——超 60s 未应答 promise 先行 settle 报超时，
 *  调用方不再永久转圈（底层连接无法显式取消，迟到结果由 race 消费侧丢弃不产生 unhandled rejection）。
 *  2026-11-12：两套协议同样共用本函数，端点/头/报文由 adapter 决定。 */
async function chatNonStream(provider: AIProvider, body: any, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw abortError();
  const adapter = adapterOf(provider);
  const idleMs = idleTimeoutOf(body);
  const headers = adapter.headers(provider);
  const resp: any = await new Promise<any>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (fn: () => void) => {
      if (timer !== null) clearTimeout(timer);
      fn();
    };
    timer = setTimeout(() => settle(() => reject(timeoutError(idleMs))), idleMs);
    requestUrl({
      url: adapter.url(provider.endpoint),
      method: 'POST',
      headers,
      body: JSON.stringify({ ...adapter.body(body), stream: false }),
    }).then(
      (r) => settle(() => resolve(r)),
      (e) => settle(() => reject(e))
    );
  });
  if (signal?.aborted) throw abortError();
  const data = JSON.parse(resp.text);
  // 兼容 OpenAI / Anthropic 与部分第三方网关的错误格式（{type, error:{type,message}} 同构）
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
  const content = adapter.textOf(data);
  if (content === undefined || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
  return content;
}

// ---------------- 图像输入（issue 311） ----------------

/** 一次聊天消息（多轮报文用；smartcat 行为流等需要 system/user/assistant 序列的调用方） */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIContentPart[];
}

/**
 * 一次用户消息内容：纯文本（string —— 与旧版报文逐字节一致）、「文本 + 若干图」（多模态数组）
 * 或多轮完整报文（{messages}，原样作为请求 messages，不经单条包装）。
 */
export type AIInput = string | { text: string; images?: string[] } | { messages: AIMessage[] };

/** 图片部件的 url：公网 https 直链（≤8192 字符）或 data URL（本地图，单图 ≤32MiB） */
export interface AIImageInput {
  url: string;
}

/** OpenAI 兼容 content 数组的部件（仅带图时才用到） */
export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: AIImageInput };

/** DeepSeek Vision 接受的格式（其余如 svg / avif / bmp 需先转码）→ MIME */
const AI_IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
};

/** 单图字节上限 32 MiB（DeepSeek Vision 文档口径）；超限应在调用方压缩后再发 */
export const AI_IMAGE_MAX_BYTES = 32 * 1024 * 1024;

/** 路径 / 文件名 → 受支持的图片 MIME；非支持格式返回 null（调用方据此提示或转码） */
export function imageMimeOfPath(path: string): string | null {
  const ext = String(path || '').split('.').pop()?.toLowerCase() || '';
  return AI_IMAGE_MIME[ext] || null;
}

/**
 * 受支持的图片 MIME → 落盘扩展名（`image/jpeg` → `jpg`）；非支持 MIME 返回 null。
 * `imageMimeOfPath` 的逆函数：图片本体落盘（issue 312 图版）时需要按 MIME 定名。
 */
export function imageExtOfMime(mime: string): string | null {
  const m = String(mime || '').toLowerCase();
  for (const [ext, known] of Object.entries(AI_IMAGE_MIME)) {
    if (known === m && ext !== 'jpeg') return ext; // jpeg 归一到 jpg（同一个 MIME 的两个别名，取短名）
  }
  return null;
}

/**
 * 图片字节 → data URL。本地图唯一可行的投喂方式（DeepSeek 只收公网 https 或 base64）。
 * 分块 Base64 编码走 crypto.toBase64 单源（架#7：原内联循环与 crypto 重复实现收编）；
 * 空图与超 32 MiB 直接抛错（由调用方决定压缩还是换图）。
 */
export function imageDataUrl(bytes: ArrayBuffer | Uint8Array, mime: string): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength === 0) throw new Error('图片内容为空');
  if (u8.byteLength > AI_IMAGE_MAX_BYTES) {
    throw new Error(`图片过大（${Math.round(u8.byteLength / 1024 / 1024)} MiB），上限 ${AI_IMAGE_MAX_BYTES / 1024 / 1024} MiB`);
  }
  return `data:${mime};base64,${toBase64(u8)}`;
}

/**
 * 用户消息内容体：纯文本 → 字符串（旧报文不变）；带图 → 多模态数组（文本在前、图在后；
 * DeepSeek 文档示例把图放在前面，顺序对结果无影响）。空串 / 非串图片项一律丢弃；
 * 全被丢弃时退回纯文本，避免发出无内容的图片组。
 */
function buildUserContent(input: string | { text: string; images?: string[] }): string | AIContentPart[] {
  if (typeof input === 'string') return input;
  const text = String(input?.text ?? '');
  const images = (Array.isArray(input?.images) ? input.images : [])
    .map((u) => String(u ?? '').trim())
    .filter((u) => u.length > 0);
  if (!images.length) return text;
  return [
    { type: 'text', text },
    ...images.map<AIContentPart>((url) => ({ type: 'image_url', image_url: { url } })),
  ];
}

/** 报文 messages：{messages} 多轮输入原样用（smartcat 行为流），单条输入包成一条 user 消息 */
function buildMessages(input: AIInput): any[] {
  if (input && typeof input === 'object' && Array.isArray((input as any).messages)) {
    return (input as any).messages;
  }
  return [{ role: 'user', content: buildUserContent(input as string | { text: string; images?: string[] }) }];
}

// ---------------- AIService ----------------

export interface AIOptions {
  provider?: string | { endpoint?: string; apiKey?: string; model?: string };
  modelOptions?: Record<string, any>;
  [key: string]: any;
}

export class AIService {
  defaultModel: string;
  defaultOptions: any;

  constructor(params?: any, defaultModel = 'deepseek-v4-flash', defaultOptions: any = {}) {
    this.defaultModel = defaultModel;
    this.defaultOptions = defaultOptions;
  }

  /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
   *  input 为字符串（纯文本，报文同旧版）、{text, images}（带图 → 多模态 content 数组）
   *  或 {messages}（多轮完整报文，原样进请求）；
   *  options.signal（取消）/ options.onDelta（流式增量回调）为调用方选项（ticket 141），不进请求体，
   *  既有调用（不传这两项）行为零变化 */
  async prompt(input: AIInput, model: string = this.defaultModel, options: AIOptions = {}): Promise<string> {
    const mergedOptions = this._mergeOptions(options);
    const provider = await getAIProvider(mergedOptions.provider);
    const s = getQ3Settings();
    // 模型优先级（ticket 172）：调用方显式指定 > provider 解析结果（含 per-provider 覆盖）> 默认
    const isExplicit = model !== this.defaultModel;
    const effModel = isExplicit ? model : (provider.model || model);
    const mo = mergedOptions.modelOptions || {};
    // max_tokens（issue 334/ADR-0148 面板独裁）：唯一权威 = provider 解析结果
    // （设置面板「最大输出 token」per-provider 覆盖 > 注册表默认）；调用方传 max_tokens 一律忽略
    const effMaxTokens = provider.defaultMaxTokens || 4096;
    const body: Record<string, any> = {
      model: effModel,
      messages: buildMessages(input),
      max_tokens: effMaxTokens,
      stream: true,
    };
    // 透传其余 modelOptions（response_format / temperature / reasoning_effort 等，不支持的字段由
    // API 忽略）；max_tokens 不在透传之列——上限只认设置面板（issue 334/ADR-0148）
    for (const k of Object.keys(mo)) {
      if (k === 'max_tokens') continue;
      body[k] = mo[k];
    }
    // 思考档位注入（issue 411/ADR-0179）：档位与参数名由 provider 档位表决定（thinkingBodyFor）；
    // 调用方显式思考键优先；auto / 档位不在表内 / 无注册表身份（对象 override）一律不注入。
    // 字符串 override 指定的 provider 以其自身档位表为准（provider.id 随解析带出）。
    // Anthropic 协议不注入：本版它没有档位表，且 thinking 在 Messages API 里是 budget_tokens
    // （须与 max_tokens 联动折算），冒进发 OpenAI 形态的字段会被 400 拒绝
    if (provider.protocol !== 'anthropic' && !hasExplicitThinkingOption(mo)) {
      const thinking = thinkingBodyFor(provider.id, s.aiThinkingOverrides?.[provider.id || '']);
      if (thinking) Object.assign(body, thinking);
    }
    const signal = mergedOptions.signal instanceof AbortSignal ? (mergedOptions.signal as AbortSignal) : undefined;
    const onDelta = typeof mergedOptions.onDelta === 'function' ? (mergedOptions.onDelta as (delta: string) => void) : undefined;
    try {
      const content = await streamChat(provider, body, signal, onDelta);
      return content;
    } catch (streamError: any) {
      if (signal?.aborted) throw streamError; // 用户取消：不再走 requestUrl 兜底
      // fetch 失败（CORS/网络）→ requestUrl 非流式兜底
      try {
        const content = await chatNonStream(provider, body, signal);
        return content;
      } catch (e: any) {
        throw new Error(`AI 请求失败: ${streamError.message}（fallback: ${e.message}）`);
      }
    }
  }

  /** 普通对话模型（deepseek-v4-flash；收纯文本或 {text, images}） */
  async chat(input: AIInput, extraOptions: AIOptions = {}): Promise<string> {
    return this.prompt(input, 'deepseek-v4-flash', extraOptions);
  }

  /** 要求 AI 返回 JSON 格式（设置 response_format；知识盒等域走这条，故同样要能吃图） */
  async json(input: AIInput, extraOptions: AIOptions = {}): Promise<string> {
    const options = this._prepareOptions(extraOptions, {
      response_format: { type: 'json_object' },
    });
    return this.prompt(input, 'deepseek-v4-flash', options);
  }

  setDefaultModel(model: string) {
    this.defaultModel = model;
  }

  setDefaultOptions(options: any) {
    this.defaultOptions = options;
  }

  // ---------- 内部辅助方法 ----------

  _mergeOptions(options: AIOptions): any {
    // 浅合并，对于嵌套的 modelOptions 需要特殊处理
    const merged: any = { ...this.defaultOptions, ...options };
    // 如果两者都有 modelOptions，进行合并
    if (this.defaultOptions.modelOptions || options.modelOptions) {
      merged.modelOptions = {
        ...(this.defaultOptions.modelOptions || {}),
        ...(options.modelOptions || {}),
      };
    }
    return merged;
  }

  /** 准备选项：复制 extraOptions，并设置指定的 modelOptions 字段（用户显式传入优先） */
  _prepareOptions(extraOptions: AIOptions, modelSettings: Record<string, any>): AIOptions {
    const options: any = { ...extraOptions };
    if (!options.modelOptions) options.modelOptions = {};
    const userModelOpts = options.modelOptions;
    options.modelOptions = { ...modelSettings, ...userModelOpts };
    return options;
  }
}

/**
 * 工厂函数，快速创建 AIService 实例。
 * issue 334/ADR-0148：不再注入默认 max_tokens（旧第 4 参 defaultMaxTokens 已删）——
 * 输出上限唯一权威 = provider 解析结果（设置面板 per-provider 覆盖 > 注册表默认），
 * 调用方在 modelOptions 里传 max_tokens 也会被 prompt() 忽略。
 */
export function createAI(params?: any, defaultModel = 'deepseek-v4-flash', defaultOptions: any = {}): AIService {
  return new AIService(params, defaultModel, defaultOptions);
}

// ---------------- 连通性测试（issue 433：设置面板密钥行「测试」按钮） ----------------

export interface AITestResult {
  /** 服务商显示名（如 DeepSeek / 智谱 Plan / Ollama） */
  label: string;
  /** 本次测试实际使用的模型名 */
  model: string;
  /** 全程耗时（毫秒） */
  ms: number;
  /** 模型回复文本（回显用） */
  reply: string;
}

/** 测试题面：诱导极短输出，控制真实调用的费用（deepseek/智谱按 token 计费，ollama 本地零成本） */
const AI_TEST_PROMPT = '这是一次连通性测试。请只回复两个字母：OK';

/**
 * 连通性测试：对指定服务商发一次**真实**的极小对话请求，走完整链路（鉴权 / 端点 / 流式 /
 * 兜底全过一遍才算通）。`providerId` 缺省 = 当前设置的 provider；显式传 id 时按该家设置解析
 * （字符串 override 口径：不读不写全局缓存）。失败一律抛错（缺密钥 / 网络 / HTTP 非 2xx），
 * 文案直接可弹通知；回复为空也视为不通（服务端异常的哑响应不该被当成「连着」）。
 */
export async function testAIConnectivity(providerId?: string): Promise<AITestResult> {
  const id = String(providerId || '').trim();
  const s = getQ3Settings();
  const effective = id || String(s.aiProvider || '') || DEFAULT_AI_PROVIDER;
  const desc = getProviderDescriptor(effective);
  const provider = await getAIProvider(effective);
  const model = provider.model || desc.model || undefined; // getAIProvider 已含 desc.model 兜底（review nit 4）
  const t0 = Date.now();
  const svc = createAI();
  const reply = (await svc.prompt(AI_TEST_PROMPT, model, { provider: effective })).trim();
  if (!reply) throw new Error(`${desc.label} 连通异常：请求成功但回复为空`);
  return { label: desc.label, model: model || '默认模型', ms: Date.now() - t0, reply };
}
