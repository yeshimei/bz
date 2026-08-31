/**
 * AI 提供商模型列表拉取（ticket 173「获取模型名」按钮）：
 * 统一 OpenAI 兼容 GET {endpoint}/models（Authorization: Bearer），Ollama 特判 GET {base}/api/tags（无鉴权）。
 * HTTP 通道与 core/ai.ts 请求同口径：fetch 优先，desc.noCors 或 fetch 失败回退 requestUrl（无 CORS 限制）。
 * 纯数据层：不触 DOM、不弹 toast（报错文案抛给调用方，由设置页按钮统一提示）。
 */
import { requestUrl } from 'obsidian';
import { AI_PROVIDER_REGISTRY, getProviderDescriptor } from './ai';
import type { AIProviderDescriptor } from './ai';
import { tryGetSettings } from './settings-provider';

/** OpenAI 兼容 /models 拉取超时（s）：设置页交互场景，8s 未应答即放弃走回退/报错 */
export const MODELS_TIMEOUT_MS = 8000;
/** Ollama /api/tags 拉取超时：本地服务默认 30s（对齐 secondbrain/ollama.ts 的 httpFetch 默认） */
export const OLLAMA_TIMEOUT_MS = 30000;
/** Ollama 服务根地址（注册表 endpoint 为 /v1 兼容面，模型列表端点挂在根） */
const OLLAMA_BASE_URL = 'http://localhost:11434';

/** 模型选项（选择器展示面：名称 + 来源说明） */
export interface ModelOption {
  id: string;
  detail?: string;
}

/** 拉取通道注入（测试桩；缺省用插件运行时真实实现） */
export interface ModelsFetchDeps {
  /** 最小响应面：ok/status/json（测试桩无需完整 Response；缺省用全局 fetch 形态） */
  fetchFn?: (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
  requestUrlFn?: (opts: { url: string; method: string; headers: Record<string, string>; throw?: boolean }) => Promise<{
    status: number;
    text: string;
  }>;
}

/** 当前 settings 里的服务商描述（注册表查找失败回退 custom） */
export function providerDescriptorOf(id: string): AIProviderDescriptor {
  return getProviderDescriptor(id);
}

/** 当前服务商的可拉取端点：custom（含未知名回退）用设置里的 aiCustomEndpoint，其余用注册表 endpoint */
function endpointFor(id: string): string {
  const s = tryGetSettings() as any;
  const desc = providerDescriptorOf(id);
  if (desc.id === 'custom') return String(s.aiCustomEndpoint || '').replace(/\/+$/, '');
  return desc.endpoint.replace(/\/+$/, '');
}

/** 当前服务商的 API key（Ollama 本地无鉴权返回空串） */
function keyFor(id: string): string {
  const s = tryGetSettings() as any;
  const desc = providerDescriptorOf(id);
  if (desc.id === 'ollama') return '';
  return String(s[desc.apiKeyKey] || '');
}

/** Ollama /api/tags 响应 → 模型 id 列表（Ollama 原生格式，非 OpenAI 兼容面） */
function ollamaModelIds(data: any): string[] {
  const list = data?.models;
  if (Array.isArray(list)) {
    const ids = list.map((m: any) => (m && typeof m.name === 'string' ? m.name : '')).filter(Boolean);
    if (ids.length) return ids;
  }
  throw new Error('该服务商未返回可用模型');
}

/** OpenAI 兼容 /models 响应 → 模型 id 列表（兼容 data[].id 主格式与 data.models[].name 少数格式） */
function openaiModelIds(data: any): string[] {
  if (Array.isArray(data?.data)) {
    const ids = (data.data as any[])
      .map((m: any) => (m && typeof m.id === 'string' ? m.id : ''))
      .filter(Boolean);
    if (ids.length) return ids;
  }
  if (Array.isArray(data?.models)) {
    const ids = (data.models as any[])
      .map((m: any) => (m && typeof m.name === 'string' ? m.name : ''))
      .filter(Boolean);
    if (ids.length) return ids;
  }
  throw new Error('该服务商未返回可用模型');
}

/** 响应 → 模型 id 列表；空列表统一抛「未返回可用模型」（由调用方 toast） */
export function parseModelList(desc: AIProviderDescriptor, data: any): string[] {
  return desc.id === 'ollama' ? ollamaModelIds(data) : openaiModelIds(data);
}

/** 拉取当前服务商模型列表（id 去重保序）。desc 可显式传入（测试构造；缺省按注册表查找当前 provider） */
export async function fetchProviderModels(
  providerId?: string,
  deps: ModelsFetchDeps = {}
): Promise<ModelOption[]> {
  const id = providerId || String((tryGetSettings() as any).aiProvider || 'opencode-go');
  const desc = providerDescriptorOf(id);
  const s = tryGetSettings() as any;

  // 端点来源：custom 用设置里的 aiCustomEndpoint；Ollama 用本地根地址（注册表 /v1 兼容面去掉后缀）
  let endpoint: string;
  if (desc.id === 'ollama') {
    endpoint = OLLAMA_BASE_URL;
  } else {
    endpoint = endpointFor(id);
    if (!endpoint) throw new Error('未配置 API 地址：插件设置 → AI 配置 → 自定义 API 地址');
  }

  const key = keyFor(id);
  // 除 Ollama 本地服务外，缺 key 即拦截（对齐 getAIProvider 的拦截文案）
  if (!key && desc.id !== 'ollama') {
    throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
  }

  const url = desc.id === 'ollama' ? `${endpoint}/api/tags` : `${endpoint}/models`;
  const headers: Record<string, string> = {};
  if (key) headers['Authorization'] = `Bearer ${key}`;
  const timeoutMs = desc.id === 'ollama' ? OLLAMA_TIMEOUT_MS : MODELS_TIMEOUT_MS;

  const fetchFn = deps.fetchFn || ((u: string, init?: any) => fetch(u, init));
  const requestUrlFn = deps.requestUrlFn || requestUrl;

  // fetch 优先（无 CORS 限制环境直接成功）；desc.noCors 或 fetch 失败（CORS/网络）回退 requestUrl
  const fetchAttempt = async (signal: AbortSignal): Promise<any> => {
    const resp = await fetchFn(url, { method: 'GET', headers, signal });
    return { resp, via: 'fetch' as const };
  };
  const requestUrlAttempt = async (): Promise<any> => {
    const r = await requestUrlFn({ url, method: 'GET', headers, throw: false });
    return { resp: { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => JSON.parse(r.text) }, via: 'requestUrl' as const };
  };

  let attempt:
    | { resp: { ok: boolean; status: number; json: () => Promise<any> }; via: 'fetch' | 'requestUrl' };
  if (desc.noCors) {
    attempt = await requestUrlAttempt();
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      attempt = await fetchAttempt(controller.signal);
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`${desc.label} 无响应（超过 ${timeoutMs / 1000}s 未应答）`);
      }
      // CORS/网络失败 → requestUrl 兜底（对齐 streamChatCompletions 的 fallback 口径）
      attempt = await requestUrlAttempt();
    } finally {
      clearTimeout(timer);
    }
  }

  const { resp } = attempt;
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`${desc.label} 拒绝访问（${resp.status}）：请检查 API Key 是否有效`);
    }
    if (resp.status === 404) {
      throw new Error(`${desc.label} 不支持模型列表接口（404）`);
    }
    let msg = `API ${resp.status}`;
    try {
      const err = await resp.json();
      if (err?.error?.message) msg = err.error.message;
    } catch (e) { /* 保留状态码 */ }
    throw new Error(msg);
  }

  const data = await resp.json();
  const ids = parseModelList(desc, data);
  const seen = new Set<string>();
  return ids
    .filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
    .map((m) => ({ id: m, detail: desc.label }));
}
