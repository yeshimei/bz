/**
 * AIService / createAI（Q3.js window.__utils 移植，ticket 03）
 * provider：deepseek / opencode-go（插件设置注入，取代 Q3 的 QuickAdd 宏设置）；
 * override 字符串 'deepseek'/'opencode-go' 或对象 {endpoint, apiKey, model}。
 * prompt：fetch 流式（stream:true），失败自动 fallback requestUrl 非流式；noCors 直接走 requestUrl。
 */
import { requestUrl } from 'obsidian';
import { getApp } from './app';

/** AI 设置（main.ts 将 plugin.settings 注入，语义与 Q3 settings 一致） */
export interface AISettingsLike {
  aiProvider?: string;
  deepseekApiKey?: string;
  opencodeGoEndpoint?: string;
  opencodeGoApiKey?: string;
  opencodeGoModel?: string;
  aiOverride?: { endpoint?: string; apiKey?: string; model?: string } | null;
}

let _settingsProvider: (() => AISettingsLike) | null = null;

/** 注册设置读取器（main.ts onload 时注入） */
export function setAISettingsProvider(fn: () => AISettingsLike): void {
  _settingsProvider = fn;
}

function getQ3Settings(): AISettingsLike {
  return _settingsProvider ? _settingsProvider() : {};
}

// ---------------- provider 解析 ----------------

interface AIProvider {
  endpoint: string;
  apiKey: string;
  model?: string;
  noCors?: boolean;
}

let _aiProviderCache: AIProvider | null = null;

/** 重置 provider 缓存（设置变更后调用） */
export function resetAIProviderCache(): void {
  _aiProviderCache = null;
}

/** 解析 AI provider（override 优先级最高），逻辑与 Q3 getAIProvider 逐字一致 */
export async function getAIProvider(override?: string | { endpoint?: string; apiKey?: string; model?: string }): Promise<AIProvider> {
  if (!override && _aiProviderCache) return _aiProviderCache;
  const s = getQ3Settings();
  // 调用方直接给完整配置（如脚本内指定第三方端点/key）
  if (override && typeof override === 'object' && (override as any).apiKey) {
    return {
      endpoint: String((override as any).endpoint || 'https://api.deepseek.com').replace(/\/+$/, ''),
      apiKey: (override as any).apiKey,
      model: (override as any).model || undefined,
    };
  }
  const name = (typeof override === 'string' && override) || s.aiProvider || 'deepseek';
  if (name === 'opencode-go') {
    if (!s.opencodeGoApiKey) {
      throw new Error('未配置 OpenCode Go API Key：插件设置 → AI 配置 → OpenCode Go API Key');
    }
    _aiProviderCache = {
      endpoint: String(s.opencodeGoEndpoint || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, ''),
      apiKey: s.opencodeGoApiKey,
      model: s.opencodeGoModel || 'deepseek-v4-flash',
      noCors: true, // opencode.ai 无 CORS 头，fetch 必败 → 直接走 requestUrl
    };
    return _aiProviderCache;
  }
  // deepseek：settings 里配的 key 优先，其次 QuickAdd data.json
  if (s.deepseekApiKey) {
    _aiProviderCache = { endpoint: 'https://api.deepseek.com', apiKey: s.deepseekApiKey };
    return _aiProviderCache;
  }
  try {
    const raw = await getApp().vault.adapter.read('.obsidian/plugins/quickadd/data.json');
    const cfg = JSON.parse(raw);
    const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
    if (provider && provider.endpoint && provider.apiKey) {
      _aiProviderCache = { endpoint: String(provider.endpoint).replace(/\/+$/, ''), apiKey: provider.apiKey };
      return _aiProviderCache;
    }
  } catch (e) { /* 读取失败由调用方提示 */ }
  throw new Error('未找到 AI 配置：请在插件设置中配置 API Key（DeepSeek 或 OpenCode Go）');
}

// ---------------- 请求实现 ----------------

/** SSE 流式解析（fetch + ReadableStream） */
async function streamChatCompletions(provider: AIProvider, body: any): Promise<string> {
  const resp = await fetch(`${provider.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = `API ${resp.status}`;
    try {
      const err = await resp.json();
      if (err.error && err.error.message) msg = err.error.message;
    } catch (e) { /* 保留状态码 */ }
    throw new Error(msg);
  }
  // 响应无流（老 WebView / 非 SSE）→ 直接读完整 JSON
  if (!resp.body || typeof (resp.body as any).getReader !== 'function') {
    const data: any = await resp.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  }
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder();
  let full = '', buf = '';
  while (true) {
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
        if (delta) full += delta;
      } catch (e) { /* 忽略坏 chunk */ }
    }
  }
  return full;
}

/** 非流式（requestUrl：Obsidian 官方 API，无 CORS 限制） */
async function chatCompletionsNonStream(provider: AIProvider, body: any): Promise<string> {
  const resp: any = await requestUrl({
    url: `${provider.endpoint}/chat/completions`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ ...body, stream: false }),
  });
  const data = JSON.parse(resp.text);
  // 兼容 OpenAI 与 opencode 的错误格式（opencode: {type, error:{type,message}}）
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (content === undefined || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
  return content;
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

  /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式） */
  async prompt(promptText: string, model: string = this.defaultModel, options: AIOptions = {}): Promise<string> {
    const mergedOptions = this._mergeOptions(options);
    const provider = await getAIProvider(mergedOptions.provider);
    // 调用方未显式指定模型时，用 provider 配置的默认模型（如 OpenCode Go 设置里的模型）
    const effModel = (model === this.defaultModel && provider.model) ? provider.model : model;
    const mo = mergedOptions.modelOptions || {};
    const body: Record<string, any> = {
      model: effModel,
      messages: [{ role: 'user', content: promptText }],
      max_tokens: mo.max_tokens || 4096,
      stream: true,
    };
    // 透传其余 modelOptions（response_format / enable_thinking 等，不支持的字段由 API 忽略）
    for (const k of Object.keys(mo)) {
      if (k === 'max_tokens') continue;
      body[k] = mo[k];
    }
    try {
      // 无 CORS 头的服务（如 opencode.ai）直接走 requestUrl，跳过注定失败的 fetch
      const content = provider.noCors
        ? await chatCompletionsNonStream(provider, body)
        : await streamChatCompletions(provider, body);
      console.log('AI 请求结果:', content);
      return content;
    } catch (streamError: any) {
      // fetch 失败（CORS/网络）→ requestUrl 非流式兜底
      try {
        const content = await chatCompletionsNonStream(provider, body);
        console.log('AI 请求结果(非流式):', content);
        return content;
      } catch (e: any) {
        throw new Error(`AI 请求失败: ${streamError.message}（fallback: ${e.message}）`);
      }
    }
  }

  /** 普通对话模型（deepseek-v4-flash） */
  async chat(promptText: string, extraOptions: AIOptions = {}): Promise<string> {
    return this.prompt(promptText, 'deepseek-v4-flash', extraOptions);
  }

  /** 推理模型，自动开启思考模式 */
  async reason(promptText: string, extraOptions: AIOptions = {}): Promise<string> {
    const options = this._prepareOptions(extraOptions, { enable_thinking: true });
    return this.prompt(promptText, 'deepseek-v4-flash', options);
  }

  /** 联网搜索（实验性，第三方代理平台生效） */
  async search(promptText: string, extraOptions: AIOptions = {}): Promise<string> {
    const options = this._prepareOptions(extraOptions, { search: true });
    return this.prompt(promptText, 'deepseek-v4-flash', options);
  }

  /** 要求 AI 返回 JSON 格式（设置 response_format） */
  async json(promptText: string, extraOptions: AIOptions = {}): Promise<string> {
    const options = this._prepareOptions(extraOptions, {
      response_format: { type: 'json_object' },
    });
    return this.prompt(promptText, 'deepseek-v4-flash', options);
  }

  /** 思考 + 联网搜索（实验性） */
  async reasonAndSearch(promptText: string, extraOptions: AIOptions = {}): Promise<string> {
    const options = this._prepareOptions(extraOptions, {
      enable_thinking: true,
      search: true,
    });
    return this.prompt(promptText, 'deepseek-v4-flash', options);
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
 * 工厂函数，快速创建 AIService 实例
 * @param defaultMaxTokens 默认 8192（createAI 内部 max_tokens 默认）
 */
export function createAI(params?: any, defaultModel = 'deepseek-v4-flash', defaultOptions: any = {}, defaultMaxTokens = 8192): AIService {
  const internalDefaultOptions = {
    modelOptions: {
      max_tokens: defaultMaxTokens,
      ...(defaultOptions.modelOptions || {}),
    },
  };
  const mergedOptions: any = { ...internalDefaultOptions, ...defaultOptions };
  if (defaultOptions.modelOptions) {
    mergedOptions.modelOptions = {
      ...internalDefaultOptions.modelOptions,
      ...defaultOptions.modelOptions,
    };
  }
  return new AIService(params, defaultModel, mergedOptions);
}
