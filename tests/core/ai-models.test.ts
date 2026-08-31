// @vitest-environment node
/**
 * AI 模型列表拉取测试（ticket 173「获取模型名」）：端点解析（custom/Ollama 去 /v1）、
 * OpenAI 兼容 /models 与 Ollama /api/tags 解析、缺 key/空列表/状态码报错文案、
 * fetch 失败回退 requestUrl、noCors 直走 requestUrl、超时报错。node 环境（不触 DOM）。
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
    state.aiProvider = 'openai';
    state.openaiApiKey = 'sk-test';
    const fetchFn = vi.fn(async (_u: string, init: any) => {
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer sk-test');
      return okOpenAI({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini']); // 重复去掉
    expect(models[0].detail).toBe('OpenAI');
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

  it('custom：端点/模型/密钥取设置三件套', async () => {
    state.aiProvider = 'custom';
    state.aiCustomEndpoint = 'https://api.example.com/v1/';
    state.aiCustomApiKey = 'ck';
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://api.example.com/v1/models');
      expect(init.headers['Authorization']).toBe('Bearer ck');
      return okOpenAI({ data: [{ id: 'taste-1' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['taste-1']);
  });

  it('缺 key（非 ollama）：拦截报错文案（对齐 getAIProvider）', async () => {
    state.aiProvider = 'openai';
    state.openaiApiKey = '';
    await expect(fetchProviderModels(undefined, { fetchFn: vi.fn() })).rejects.toThrow(
      '未配置 OpenAI API Key：插件设置 → AI 配置 → OpenAI 密钥'
    );
  });

  it('custom 未填端点：报「未配置 API 地址」', async () => {
    state.aiProvider = 'custom';
    state.aiCustomEndpoint = '';
    await expect(fetchProviderModels(undefined, { fetchFn: vi.fn() })).rejects.toThrow(
      '未配置 API 地址：插件设置 → AI 配置 → 自定义 API 地址'
    );
  });
});

describe('fetchProviderModels：HTTP 通道与错误', () => {
  it('fetch 失败（CORS/网络）自动回退 requestUrl', async () => {
    state.aiProvider = 'openai';
    state.openaiApiKey = 'sk-test';
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const requestUrlFn = vi.fn(async () => ({
      status: 200,
      text: JSON.stringify({ data: [{ id: 'gpt-4o' }] }),
    }));
    const models = await fetchProviderModels(undefined, { fetchFn, requestUrlFn });
    expect(models.map((m) => m.id)).toEqual(['gpt-4o']);
    expect(requestUrlFn).toHaveBeenCalledTimes(1);
    expect((requestUrlFn.mock.calls[0] as any)[0].url).toBe('https://api.openai.com/v1/models');
  });

  it('noCors 提供商（opencode-go）直走 requestUrl，跳过 fetch', async () => {
    state.aiProvider = 'opencode-go';
    state.opencodeGoApiKey = 'k';
    const fetchFn = vi.fn();
    const requestUrlFn = vi.fn(async () => ({
      status: 200,
      text: JSON.stringify({ data: [{ id: 'deepseek-v4-flash' }] }),
    }));
    const models = await fetchProviderModels(undefined, { fetchFn, requestUrlFn });
    expect(models.map((m) => m.id)).toEqual(['deepseek-v4-flash']);
    expect(fetchFn).not.toHaveBeenCalled();
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
    state.aiProvider = 'openai';
    state.openaiApiKey = 'k';
    const fetchFn = vi.fn(
      (_u: string, init: any) =>
        new Promise<{ ok: boolean; status: number; json: () => Promise<any> }>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const p = fetchProviderModels(undefined, { fetchFn });
    p.catch(() => {}); // 预挂忽略 handler，防 advanceTimers 推进时 rejection 先于 await 被报 unhandled
    await vi.advanceTimersByTimeAsync(MODELS_TIMEOUT_MS + 10);
    await expect(p).rejects.toThrow(`OpenAI 无响应（超过 ${MODELS_TIMEOUT_MS / 1000}s 未应答）`);
    vi.useRealTimers();
  });
});

describe('注册表覆盖面（ticket 173 拍板：全部 16 家统一逻辑）', () => {
  it('16 家提供商注册表齐备，custom 兜底解析可用', () => {
    expect(AI_PROVIDER_REGISTRY.length).toBe(16);
    const ids = AI_PROVIDER_REGISTRY.map((p) => p.id);
    for (const id of ['deepseek', 'opencode-go', 'openai', 'anthropic', 'google', 'moonshot', 'zhipu', 'dashscope', 'siliconflow', 'openrouter', 'xai', 'groq', 'mistral', 'together', 'ollama', 'custom']) {
      expect(ids).toContain(id);
    }
  });

  it('未知名 provider 回退 custom 描述（fetch 时按设置三件套解析）', async () => {
    state.aiProvider = 'unknown-provider';
    state.aiCustomEndpoint = 'https://x.example.com/v1/'; // 末尾斜杠 → 解析时去除
    state.aiCustomApiKey = 'k';
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://x.example.com/v1/models');
      expect(init.headers['Authorization']).toBe('Bearer k');
      return okOpenAI({ data: [{ id: 'm1' }] });
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['m1']);
  });
});
