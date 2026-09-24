/**
 * AIService / createAI（Q3.js window.__utils 移植，ticket 03）
 * provider：注册表驱动（ticket 170/171 策略模式）——**只留三条在用通道**（issue 411/ADR-0179）：
 * deepseek（官方，缺省）/ zhipu-plan（智谱 Coding 套餐）/ ollama（本地）；其余服务商一律退役，
 * 「用到了再按注册表加一行」——注册表加一行即含设置页密钥行与思考档位，解析零分支改动。
 * override 字符串（注册表 id）或对象 {endpoint, apiKey, model, extraHeaders, defaultMaxTokens}
 * （对象形态 = 调用方自带完整配置，不经注册表，脚本内指定第三方端点用）。
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
  /** 🔑 DeepSeek 密钥（留空则回退读外部配置） */
  deepseekApiKey?: string;
  /** 🔑 智谱 Plan（Coding 套餐）密钥 */
  zhipuPlanApiKey?: string;
  /** 🔑 Ollama（本地服务通常无需密钥，留空放行） */
  ollamaApiKey?: string;
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

export interface AIProviderDescriptor {
  /** 注册表键（settings.aiProvider 取值） */
  id: string;
  /** 设置页下拉展示名 */
  label: string;
  /** 默认 API endpoint */
  endpoint: string;
  /** 默认模型（空 = 沿用调用方默认模型） */
  model: string;
  /** 注册表默认 max_tokens（兜底档：设置 per-provider 覆盖 > 模型查表 > 此默认）。
   *  上限只是封顶、不是目标消耗（ADR-0148）；填超模型真实上限会被服务端拒绝，
   *  故此处只放「该服务商在售主力模型的官方最大档」，其余留给 model-limits 按模型名解析 */
  defaultMaxTokens: number;
  /** 密钥在 AISettingsLike 的键名 */
  apiKeyKey: keyof AISettingsLike;
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
 * 在册提供商（issue 411/ADR-0179：只留三条真用通道——deepseek 官方 / 智谱 Coding 套餐 / 本地
 * Ollama；其余服务商随其密钥键、设置行一并退役，用到了再按本表加一行）。
 * 思考档位表见 AIThinkingSpec 注释（逐家参数名与支持档不同）。
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
    apiKeyKey: 'deepseekApiKey',
    apiKeyLabel: 'DeepSeek 密钥',
    apiKeyDesc: '留空则自动回退读取外部配置密钥',
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
    apiKeyKey: 'zhipuPlanApiKey',
    apiKeyLabel: '智谱 Plan 密钥',
    apiKeyDesc: '智谱 Coding 套餐专用端点，密钥与智谱开放平台相同',
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
    apiKeyKey: 'ollamaApiKey',
    apiKeyLabel: 'Ollama 密钥',
    apiKeyDesc: '本地服务无需密钥，留空即可',
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
  endpoint: string;
  apiKey: string;
  model?: string;
  /** 附加请求头（仅对象 override 可带，如非 OpenAI 兼容服务的 anthropic-version） */
  extraHeaders?: Record<string, string>;
  /** 注册表默认 max_tokens（设置 per-provider 覆盖缺省时的兜底档） */
  defaultMaxTokens?: number;
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
      endpoint: String(override.endpoint || 'https://api.deepseek.com').replace(/\/+$/, ''),
      apiKey: override.apiKey,
      model: override.model || undefined,
      extraHeaders: override.extraHeaders || undefined,
      defaultMaxTokens: override.defaultMaxTokens,
    };
  }
  const name = (typeof override === 'string' && override) || s.aiProvider || DEFAULT_AI_PROVIDER;
  const desc = getProviderDescriptor(name);
  const key = s[desc.apiKeyKey];
  if (!key && name === 'deepseek') {
    // deepseek 兼容兜底：settings 缺 key 时读 QuickAdd data.json（legacy，无 UI）
    try {
      const raw = await getApp().vault.adapter.read('.obsidian/plugins/quickadd/data.json');
      const cfg = JSON.parse(raw);
      const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
      if (provider && provider.endpoint && provider.apiKey) {
        return cachePut({
          id: 'deepseek',
          endpoint: String(provider.endpoint).replace(/\/+$/, ''),
          apiKey: provider.apiKey,
          defaultMaxTokens: desc.defaultMaxTokens,
        });
      }
    } catch (e) { /* 读取失败由调用方提示 */ }
  }
  // ollama 本地服务无鉴权：空密钥放行（其余提供商缺 key 即拦截）
  if (!key && name !== 'ollama') {
    throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
  }
  // ticket 172 per-provider 覆盖：用户设置的模型/上下文/max token 优先于注册表默认；
  // issue 342/ADR-0151 起，中间插入「按当前模型名查官方档位」（model-limits 单一事实源）——
  // 覆盖 > 查表 > 注册表默认。查表输入只用面板可见的模型名（覆盖 > 注册表默认），
  // 调用点临时传的模型名不参与（ADR-0148 面板独裁）
  const overrideModel = s.aiModelOverrides?.[name];
  const overrideMaxTokens = s.aiMaxTokensOverrides?.[name];
  const limits = resolveModelLimits(overrideModel || desc.model || '');
  return cachePut({
    id: name,
    endpoint: desc.endpoint,
    apiKey: (key as string) || '',
    model: overrideModel || desc.model || undefined,
    defaultMaxTokens: overrideMaxTokens || limits?.maxOutput || desc.defaultMaxTokens,
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

/** SSE 流式解析（fetch + ReadableStream）；signal 可中止，onDelta 逐段增量回调（ticket 141）。
 *  内部 AbortController 组合外部 signal 与空闲超时（C1）：建连不回包 / 流中途停发超时即中止
 *  （带图请求阈值放宽，见 idleTimeoutOf） */
async function streamChatCompletions(provider: AIProvider, body: any, signal?: AbortSignal, onDelta?: (delta: string) => void): Promise<string> {
  const idleMs = idleTimeoutOf(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...(provider.extraHeaders || {}),
  };
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
    const resp = await fetch(`${provider.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
      return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
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
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
          if (delta) {
            full += delta;
            try {
              onDelta?.(delta); // 增量回调异常不影响流式解析
            } catch (e) { /* 忽略 */ }
          }
        } catch (e) { /* 忽略坏 chunk */ }
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

/** 非流式（requestUrl：Obsidian 官方 API，无 CORS 限制）；requestUrl 不支持中止 → 前后查 signal，已取消按丢弃处理。
 *  C1：requestUrl 本身无超时也不可中止，这里以 race 兜底——超 60s 未应答 promise 先行 settle 报超时，
 *  调用方不再永久转圈（底层连接无法显式取消，迟到结果由 race 消费侧丢弃不产生 unhandled rejection） */
async function chatCompletionsNonStream(provider: AIProvider, body: any, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw abortError();
  const idleMs = idleTimeoutOf(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...(provider.extraHeaders || {}),
  };
  const resp: any = await new Promise<any>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (fn: () => void) => {
      if (timer !== null) clearTimeout(timer);
      fn();
    };
    timer = setTimeout(() => settle(() => reject(timeoutError(idleMs))), idleMs);
    requestUrl({
      url: `${provider.endpoint}/chat/completions`,
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: false }),
    }).then(
      (r) => settle(() => resolve(r)),
      (e) => settle(() => reject(e))
    );
  });
  if (signal?.aborted) throw abortError();
  const data = JSON.parse(resp.text);
  // 兼容 OpenAI 与部分第三方网关的错误格式（如 {type, error:{type,message}}）
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
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
    // 字符串 override 指定的 provider 以其自身档位表为准（provider.id 随解析带出）
    if (!hasExplicitThinkingOption(mo)) {
      const thinking = thinkingBodyFor(provider.id, s.aiThinkingOverrides?.[provider.id || '']);
      if (thinking) Object.assign(body, thinking);
    }
    const signal = mergedOptions.signal instanceof AbortSignal ? (mergedOptions.signal as AbortSignal) : undefined;
    const onDelta = typeof mergedOptions.onDelta === 'function' ? (mergedOptions.onDelta as (delta: string) => void) : undefined;
    try {
      const content = await streamChatCompletions(provider, body, signal, onDelta);
      return content;
    } catch (streamError: any) {
      if (signal?.aborted) throw streamError; // 用户取消：不再走 requestUrl 兜底
      // fetch 失败（CORS/网络）→ requestUrl 非流式兜底
      try {
        const content = await chatCompletionsNonStream(provider, body, signal);
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
  const desc = getProviderDescriptor(id || DEFAULT_AI_PROVIDER);
  const provider = await getAIProvider(id || undefined);
  const model = provider.model || desc.model || undefined;
  const t0 = Date.now();
  const svc = createAI();
  const reply = (await svc.prompt(AI_TEST_PROMPT, model, { provider: id || undefined })).trim();
  if (!reply) throw new Error(`${desc.label} 连通异常：请求成功但回复为空`);
  return { label: desc.label, model: model || '默认模型', ms: Date.now() - t0, reply };
}
