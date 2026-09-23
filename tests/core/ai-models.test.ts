// @vitest-environment node
/**
 * AI 模型列表拉取测试（ticket 173「获取模型名」）：端点解析（Ollama 去 /v1）、
 * OpenAI 兼容 /models 与 Ollama /api/tags 解析、缺 key/空列表/状态码报错文案、
 * fetch 失败回退 requestUrl、超时报错。node 环境（不触 DOM）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { fetchProviderModels, parseModelList, MODELS_TIMEOUT_MS } from '../../src/core/ai-models';
import { AI_PROVIDER_REGISTRY, getProviderDescriptor } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';

const state = { ...DEFAULT_SETTINGS } as Record<string, any>;

beforeEach(() => {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, DEFAULT_SETTINGS);
  setSettingsProvider(() => state as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** OpenAI 兼容 200 响应桩 */
function okOpenAI(data: unknown): any {
  return { ok: true, status: 200, json: async () => data };
}

describe('parseModelList：响应 → 模型 id 列表', () => {
  const desc = getProviderDescriptor('deepseek');

  it('OpenAI 兼容 data[].id 主格式', () => {
    const ids = parseModelList(desc, { data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] });
    expect(ids).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('兼容 data.models[].name 少数格式', () => {
    const ids = parseModelList(desc, { models: [{ name: 'gpt-4o' }, { name: 'gpt-4o-mini' }] });
    expect(ids).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('Ollama /api/tags 格式（models[].name）', () => {
    const ollama = getProviderDescriptor('ollama');
    const ids = parseModelList(ollama, { models: [{ name: 'llama3.1:latest' }, { name: 'qwen2.5:7b' }] });
    expect(ids).toEqual(['llama3.1:latest', 'qwen2.5:7b']);
  });

  it('空列表/畸形响应抛「该服务商未返回可用模型」', () => {
    expect(() => parseModelList(desc, { data: [] })).toThrow('该服务商未返回可用模型');
    expect(() => parseModelList(desc, {})).toThrow('该服务商未返回可用模型');
    expect(() => parseModelList(desc, { data: [{ id: '' }] })).toThrow('该服务商未返回可用模型');
  });
});

describe('fetchProviderModels：端点与请求', () => {
  it('OpenAI 兼容：GET {endpoint}/models + Bearer key，解析 data[].id 去重保序', async () => {
    state.aiProvider = 'zhipu-plan';
    state.zhipuPlanApiKey = 'sk-test';
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://open.bigmodel.cn/api/coding/paas/v4/models');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer sk-test');
      return okOpenAI({ data: [{ id: 'glm-5.3-flash' }, { id: 'glm-5.2' }, { id: 'glm-5.3-flash' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['glm-5.3-flash', 'glm-5.2']); // 重复去掉
    expect(models[0].detail).toBe('智谱 Plan');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('Ollama：GET http://localhost:11434/api/tags（注册表 /v1 后缀去除），无 key 放行', async () => {
    state.aiProvider = 'ollama';
    const fetchFn = vi.fn(async (u: string) => {
      expect(u).toBe('http://localhost:11434/api/tags');
      return okOpenAI({ models: [{ name: 'llama3.1:latest' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['llama3.1:latest']);
  });

  it('DeepSeek：GET {endpoint}/models（官方端点）+ Bearer key', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'sk-d';
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://api.deepseek.com/models');
      expect(init.headers['Authorization']).toBe('Bearer sk-d');
      return okOpenAI({ data: [{ id: 'deepseek-v4-flash' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['deepseek-v4-flash']);
  });

  it('缺 key（非 ollama）：拦截报错文案（对齐 getAIProvider）', async () => {
    state.aiProvider = 'zhipu-plan';
    state.zhipuPlanApiKey = '';
    await expect(fetchProviderModels(undefined, { fetchFn: vi.fn() })).rejects.toThrow(
      '未配置 智谱 Plan API Key：插件设置 → AI 配置 → 智谱 Plan 密钥'
    );
  });
});

describe('fetchProviderModels：HTTP 通道与错误', () => {
  it('fetch 失败（CORS/网络）自动回退 requestUrl', async () => {
    state.aiProvider = 'zhipu-plan';
    state.zhipuPlanApiKey = 'sk-test';
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const requestUrlFn = vi.fn(async () => ({
      status: 200,
      text: JSON.stringify({ data: [{ id: 'glm-5.3-flash' }] }),
    }));
    const models = await fetchProviderModels(undefined, { fetchFn, requestUrlFn });
    expect(models.map((m) => m.id)).toEqual(['glm-5.3-flash']);
    expect(requestUrlFn).toHaveBeenCalledTimes(1);
    expect((requestUrlFn.mock.calls[0] as any)[0].url).toBe('https://open.bigmodel.cn/api/coding/paas/v4/models');
  });

  it('401/403：报「拒绝访问」并提示检查 key', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'bad';
    const fetchFn = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(fetchProviderModels(undefined, { fetchFn })).rejects.toThrow(
      'DeepSeek 拒绝访问（401）：请检查 API Key 是否有效'
    );
  });

  it('404：报「不支持模型列表接口」', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'k';
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(fetchProviderModels(undefined, { fetchFn })).rejects.toThrow('DeepSeek 不支持模型列表接口（404）');
  });

  it('非 2xx：优先取响应 error.message，否则保留状态码', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'k';
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Rate limited' } }) }));
    await expect(fetchProviderModels(undefined, { fetchFn })).rejects.toThrow('Rate limited');
    const fetchFn2 = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchProviderModels(undefined, { fetchFn: fetchFn2 })).rejects.toThrow('API 500');
  });

  it('fetch 超时：报「无响应（超过 Ns 未应答）」', async () => {
    vi.useFakeTimers();
    state.aiProvider = 'zhipu-plan';
    state.zhipuPlanApiKey = 'k';
    const fetchFn = vi.fn(
      (_u: string, init: any) =>
        new Promise<{ ok: boolean; status: number; json: () => Promise<any> }>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const p = fetchProviderModels(undefined, { fetchFn });
    p.catch(() => {}); // 预挂忽略 handler，防 advanceTimers 推进时 rejection 先于 await 被报 unhandled
    await vi.advanceTimersByTimeAsync(MODELS_TIMEOUT_MS + 10);
    await expect(p).rejects.toThrow(`智谱 Plan 无响应（超过 ${MODELS_TIMEOUT_MS / 1000}s 未应答）`);
    vi.useRealTimers();
  });
});

describe('注册表覆盖面（issue 411/ADR-0179：只留在册三条通道）', () => {
  it('三条通道注册表齐备（端点/模型/密钥键/标签）', () => {
    expect(AI_PROVIDER_REGISTRY.map((p) => p.id)).toEqual(['deepseek', 'zhipu-plan', 'ollama']);
    for (const p of AI_PROVIDER_REGISTRY) {
      expect(p.endpoint, p.id).toBeTruthy();
      expect(p.label, p.id).toBeTruthy();
      expect((p as { apiKeyKey: string }).apiKeyKey, p.id).toBeTruthy();
    }
  });

  it('未知名 provider 回退缺省通道描述（deepseek 端点 + deepseek 密钥）', async () => {
    state.aiProvider = 'unknown-provider';
    state.deepseekApiKey = 'sk-d';
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://api.deepseek.com/models');
      expect(init.headers['Authorization']).toBe('Bearer sk-d');
      return okOpenAI({ data: [{ id: 'm1' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['m1']);
  });
});
