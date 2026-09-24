/**
 * AI 提供商模型列表拉取（ticket 173「获取模型名」按钮）：
 * 统一 OpenAI 兼容 GET {endpoint}/models（Authorization: Bearer），Ollama 特判 GET {base}/api/tags（无鉴权）。
 * HTTP 通道与 core/ai.ts 请求同口径：fetch 优先，失败回退 requestUrl（无 CORS 限制）。
 * 纯数据层：不触 DOM、不弹 toast（报错文案抛给调用方，由设置页按钮统一提示）。
 * issue 422/ADR-0182：新增向量化模型拉取（fetchEmbeddingModels）——AI 面板「Embedding 模型」行的
 * 「获取模型」按钮消费，端点取第二大脑的 Ollama 服务地址（移动端优先远程地址）。
 */
import { requestUrl } from 'obsidian';
import { getProviderDescriptor, DEFAULT_AI_PROVIDER } from './ai';
import type { AIProviderDescriptor } from './ai';
import { isMobileEnv } from './mobile';
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

/** 当前 settings 里的服务商描述（注册表查找失败回退缺省服务商，与 ai.ts 解析同口径） */
export function providerDescriptorOf(id: string): AIProviderDescriptor {
  return getProviderDescriptor(id);
}

/** 当前服务商的可拉取端点（注册表 endpoint；三条在册通道端点均非空） */
function endpointFor(id: string): string {
  return providerDescriptorOf(id).endpoint.replace(/\/+$/, '');
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

/** 模型列表端点 JSON 拉取（fetch 优先 → requestUrl 回退 → 超时/状态码报错）。
 *  label 只进报错文案（各调用方的服务商/服务名），行为与原内联实现逐字一致。 */
async function fetchModelsJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  label: string,
  deps: ModelsFetchDeps
): Promise<any> {
  const fetchFn = deps.fetchFn || ((u: string, init?: any) => fetch(u, init));
  const requestUrlFn = deps.requestUrlFn || requestUrl;

  // fetch 优先（无 CORS 限制环境直接成功）；fetch 失败（CORS/网络）回退 requestUrl
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
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      attempt = await fetchAttempt(controller.signal);
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`${label} 无响应（超过 ${timeoutMs / 1000}s 未应答）`);
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
      throw new Error(`${label} 拒绝访问（${resp.status}）：请检查 API Key 是否有效`);
    }
    if (resp.status === 404) {
      throw new Error(`${label} 不支持模型列表接口（404）`);
    }
    let msg = `API ${resp.status}`;
    try {
      const err = await resp.json();
      if (err?.error?.message) msg = err.error.message;
    } catch (e) { /* 保留状态码 */ }
    throw new Error(msg);
  }

  return resp.json();
}

/** 拉取当前服务商模型列表（id 去重保序）。desc 可显式传入（测试构造；缺省按注册表查找当前 provider） */
export async function fetchProviderModels(
  providerId?: string,
  deps: ModelsFetchDeps = {}
): Promise<ModelOption[]> {
  const id = providerId || String((tryGetSettings() as any).aiProvider || DEFAULT_AI_PROVIDER);
  const desc = providerDescriptorOf(id);

  // 端点来源：Ollama 用本地根地址（注册表 /v1 兼容面去掉后缀），其余用注册表 endpoint
  const endpoint = desc.id === 'ollama' ? OLLAMA_BASE_URL : endpointFor(id);

  const key = keyFor(id);
  // 除 Ollama 本地服务外，缺 key 即拦截（对齐 getAIProvider 的拦截文案）
  if (!key && desc.id !== 'ollama') {
    throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
  }

  const url = desc.id === 'ollama' ? `${endpoint}/api/tags` : `${endpoint}/models`;
  const headers: Record<string, string> = {};
  if (key) headers['Authorization'] = `Bearer ${key}`;
  const timeoutMs = desc.id === 'ollama' ? OLLAMA_TIMEOUT_MS : MODELS_TIMEOUT_MS;

  const data = await fetchModelsJson(url, headers, timeoutMs, desc.label, deps);
  const ids = parseModelList(desc, data);
  const seen = new Set<string>();
  return ids
    .filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
    .map((m) => ({ id: m, detail: desc.label }));
}

/* ==================== 向量化模型（Embedding；issue 422/ADR-0182） ==================== */

/** Ollama /api/tags 单条：id + 能力标签 + 展示说明（参数量 + 向量维度，缺字段回落服务名） */
export interface OllamaTag {
  id: string;
  capabilities: string[];
  detail: string;
}

/** /api/tags 响应 → 结构化条目列表（畸形项跳过；capabilities 旧版服务不返回，空数组表示「未知」） */
export function parseOllamaTags(data: any): OllamaTag[] {
  const list = data?.models;
  if (!Array.isArray(list)) return [];
  const out: OllamaTag[] = [];
  for (const m of list) {
    if (!m || typeof m.name !== 'string' || !m.name) continue;
    const capabilities = Array.isArray(m.capabilities)
      ? (m.capabilities as unknown[]).filter((c): c is string => typeof c === 'string')
      : [];
    const det = (m.details || {}) as Record<string, unknown>;
    const bits: string[] = [];
    if (typeof det.parameter_size === 'string' && det.parameter_size) bits.push(det.parameter_size);
    if (typeof det.embedding_length === 'number' && det.embedding_length > 0) bits.push(`${det.embedding_length} 维`);
    out.push({ id: m.name, capabilities, detail: bits.join('，') || 'Ollama' });
  }
  return out;
}

/** 向量化模型选项：有 capabilities 的按 embedding 能力过滤（聊天模型不进列表）；
 *  旧版 Ollama 不返回该字段（全部为空）→ 不过滤，全量返回由用户自辨。 */
export function pickEmbeddingModels(data: any): ModelOption[] {
  const tags = parseOllamaTags(data);
  const known = tags.some((t) => t.capabilities.length > 0);
  return (known ? tags.filter((t) => t.capabilities.includes('embedding')) : tags).map((t) => ({
    id: t.id,
    detail: t.detail,
  }));
}

/** Qwen3-Embedding-8B 判定（issue 427/ADR-0186）：AI 面板「启用重排」行的可见性与 secondbrain
 *  检索侧的重排生效条件**共用这一条判定**（行隐藏即不生效，不留「藏着的开关还在起作用」的暗态）。
 *  只认 8b：重排是给 8B 嵌入配的增强档（8b 之外的嵌入模型一律不启用）。 */
export function isQwen3Embedding8b(model: unknown): boolean {
  return /qwen3[-_]?embedding[:\-_.]?8b\b/i.test(String(model ?? ''));
}

/**
 * 向量化服务端点（「获取模型」按钮拉列表用）：与 secondbrain/config.ts buildConfig 同口径——
 * 移动端优先「移动端远程地址」、未配置回落本地；两键留空一律默认 http://localhost:11434。
 * 嵌入与重排两个模型行共用这一个地址（issue 429：重排走的就是同一台 Ollama）。
 * （规则镜像域侧实现：域侧 IS_MOBILE 另有 UA 兜底，此处按 obsidian Platform 判定。）
 */
export function embeddingServiceUrl(): string {
  const s = tryGetSettings() as any;
  const local = String(s.secondBrainOllamaUrl || '').trim() || OLLAMA_BASE_URL;
  const remote = String(s.secondBrainRemoteOllamaUrl || '').trim();
  return isMobileEnv() && remote ? remote : local;
}

/** 拉取向量化模型列表（AI 面板 Embedding 组的行内按钮）：Ollama 原生 GET {service}/api/tags，
 *  按 embedding 能力过滤；空列表抛错由调用方提示。 */
export async function fetchEmbeddingModels(deps: ModelsFetchDeps = {}): Promise<ModelOption[]> {
  const url = `${embeddingServiceUrl().replace(/\/+$/, '')}/api/tags`;
  const data = await fetchModelsJson(url, {}, OLLAMA_TIMEOUT_MS, 'Ollama', deps);
  const models = pickEmbeddingModels(data);
  if (!models.length) throw new Error('Ollama 未返回可用的向量化模型');
  return models;
}

/** 重排模型选项（issue 429）：名字含 rerank 的优先；一个都没有 → 全量返回由用户自辨
 *  （重排模型是社区转换版，命名五花八门且 capabilities 里没有 rerank 这一档——
 *  按能力过滤会把真正的重排模型滤掉，故只按名字软过滤）。 */
export function pickRerankModels(data: any): ModelOption[] {
  const tags = parseOllamaTags(data);
  const rerank = tags.filter((t) => /rerank/i.test(t.id));
  return (rerank.length ? rerank : tags).map((t) => ({ id: t.id, detail: t.detail }));
}

/** 拉取重排模型列表（AI 面板「重排模型」行的行内按钮）：与嵌入侧同一端点，空列表抛错由调用方提示 */
export async function fetchRerankModels(deps: ModelsFetchDeps = {}): Promise<ModelOption[]> {
  const url = `${embeddingServiceUrl().replace(/\/+$/, '')}/api/tags`;
  const data = await fetchModelsJson(url, {}, OLLAMA_TIMEOUT_MS, 'Ollama', deps);
  const models = pickRerankModels(data);
  if (!models.length) throw new Error('Ollama 未返回可用的重排模型');
  return models;
}
