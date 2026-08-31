// @vitest-environment node
/**
 * AIService 补充覆盖测试（src/core/ai.ts 未触达函数分支）：
 * provider 缓存命中/绕过、QuickAdd data.json 兜底成功与三种失败形态、
 * 流式解析坏 chunk/[DONE] 提前终止/非 SSE 整包响应、HTTP 错误体非 JSON 回退状态码、
 * 非流式错误格式矩阵（message/type/message 兜底/缺 content）、
 * setDefaultModel/setDefaultOptions、search/reasonAndSearch、createAI 与 _mergeOptions 合并优先级。
 * 外部网络全部经 fetch 打桩 + obsidian requestUrl mock，无真实请求。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AIService,
  createAI,
  getAIProvider,
  setAISettingsProvider,
  resetAIProviderCache,
} from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { requestUrl } from '../mock-obsidian-entry';

/** 构造 SSE 流式响应体 */
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

const DEFAULT_SETTINGS = {
  aiProvider: 'deepseek',
  deepseekApiKey: 'sk-deepseek-test',
};

/** 标准 deepseek 测试环境：注入设置/app/fetch 桩 */
function setupAI(settings: any = { ...DEFAULT_SETTINGS }) {
  setApp({ vault: new MockVault() } as any);
  setAISettingsProvider(() => ({ ...settings }));
  resetAIProviderCache();
}

describe('getAIProvider 解析与缓存', () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  afterEach(() => {
    resetAIProviderCache();
  });

  it('同配置二次解析返回缓存对象（同一引用）；override 绕过缓存重算', async () => {
    // 双 provider 均配 key：deepseek 与 opencode-go 可切换
    setupAI({ ...DEFAULT_SETTINGS, opencodeGoApiKey: 'sk-opencode-test' });
    const p1 = await getAIProvider();
    const p2 = await getAIProvider();
    expect(p2).toBe(p1); // !override && cache → 直接返回缓存

    // override 字符串强制重算（并覆盖缓存）
    const p3 = await getAIProvider('opencode-go');
    expect(p3.endpoint).toBe('https://opencode.ai/zen/go/v1');
    expect(p3.noCors).toBe(true);
    expect(p3).not.toBe(p1);
  });

  it('override 对象带 apiKey：直接使用调用方配置，尾斜杠清理、model 缺省为 undefined', async () => {
    setupAI();
    const p = await getAIProvider({ endpoint: 'https://third.example/v1///', apiKey: 'k3' });
    expect(p.endpoint).toBe('https://third.example/v1');
    expect(p.apiKey).toBe('k3');
    expect(p.model).toBeUndefined();
    expect(p.noCors).toBeUndefined();
  });

  it('override 对象无 apiKey → 不走直配分支，回落设置中的 deepseek', async () => {
    setupAI();
    const p = await getAIProvider({ endpoint: 'https://ignored.example' });
    expect(p.endpoint).toBe('https://api.deepseek.com');
    expect(p.apiKey).toBe('sk-deepseek-test');
  });

  it('QuickAdd data.json 兜底：settings 无 key 时读 vault adapter 配置（尾斜杠清理）', async () => {
    setupAI({ aiProvider: 'deepseek' }); // 无 deepseekApiKey
    const app = {
      vault: {
        adapter: {
          read: vi.fn(async () =>
            JSON.stringify({ ai: { providers: [{ endpoint: 'https://qa.example/v1/', apiKey: 'qk' }] } })
          ),
        },
      },
    };
    setApp(app as any);
    const p = await getAIProvider();
    expect(app.vault.adapter.read).toHaveBeenCalledWith('.obsidian/plugins/quickadd/data.json');
    expect(p.endpoint).toBe('https://qa.example/v1');
    expect(p.apiKey).toBe('qk');
  });

  it('QuickAdd 读取抛错 → deepseek 无 key 时报「未配置 DeepSeek API Key」', async () => {
    setupAI({ aiProvider: 'deepseek' });
    setApp({ vault: { adapter: { read: async () => { throw new Error('file not found'); } } } } as any);
    await expect(getAIProvider()).rejects.toThrow('未配置 DeepSeek API Key');
  });

  it('QuickAdd 数据结构不含有效 provider（缺 endpoint/apiKey）→ 同样报未配置', async () => {
    setupAI({ aiProvider: 'deepseek' });
    setApp({
      vault: {
        adapter: {
          read: async () => JSON.stringify({ ai: { providers: [{ endpoint: '', apiKey: '' }] } }),
        },
      },
    } as any);
    await expect(getAIProvider()).rejects.toThrow('未配置 DeepSeek API Key');
  });

  it('custom provider：endpoint/key/model 全部取自设置，尾斜杠清理', async () => {
    setupAI({
      aiProvider: 'custom',
      aiCustomEndpoint: 'https://api.commandcode.ai/v1/',
      aiCustomApiKey: 'sk-custom',
      aiCustomModel: 'taste-1',
    });
    const p = await getAIProvider();
    expect(p.endpoint).toBe('https://api.commandcode.ai/v1');
    expect(p.apiKey).toBe('sk-custom');
    expect(p.model).toBe('taste-1');
    expect(p.noCors).toBeUndefined();
  });

  it('custom provider：无 endpoint → 抛「未配置自定义 AI 服务」', async () => {
    setupAI({ aiProvider: 'custom', aiCustomEndpoint: '', aiCustomApiKey: 'sk-custom' });
    await expect(getAIProvider()).rejects.toThrow('未配置自定义 AI 服务');
  });

  it('custom provider：无 key → 抛「未配置自定义 AI 服务」', async () => {
    setupAI({ aiProvider: 'custom', aiCustomEndpoint: 'https://api.example.com/v1', aiCustomApiKey: '' });
    await expect(getAIProvider()).rejects.toThrow('未配置自定义 AI 服务');
  });

  it('aiMaxTokens 设置生效：>0 时作为请求 max_tokens（ticket 170 默认用模型最大值）', async () => {
    setupAI({ aiProvider: 'deepseek', deepseekApiKey: 'sk-deepseek-test', aiMaxTokens: 16000 });
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"hi"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('q');
    const body = JSON.parse((global as any).fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(16000);
    delete (global as any).fetch;
  });

  it('aiMaxTokens=0 时回落默认 4096', async () => {
    setupAI({ aiProvider: 'deepseek', deepseekApiKey: 'sk-deepseek-test', aiMaxTokens: 0 });
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"hi"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('q');
    const body = JSON.parse((global as any).fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(4096);
    delete (global as any).fetch;
  });

  it('provider.model 存在但显式指定模型 → 显式值优先', async () => {
    setupAI({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-oc' });
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('x', 'my-explicit-model');
    const reqOpts: any = vi.mocked(requestUrl).mock.calls[0][0];
    expect(JSON.parse(reqOpts.body).model).toBe('my-explicit-model');
  });
});

describe('流式与非流式解析边界', () => {
  let fetchMock: any;

  beforeEach(() => {
    setupAI();
    vi.mocked(requestUrl).mockReset();
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('非 SSE 响应（body 无 getReader）→ 整包 JSON 取 content', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: null, // 老 WebView 形态
      json: async () => ({ choices: [{ message: { content: '整包结果' } }] }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).resolves.toBe('整包结果');
  });

  it('非 SSE 响应缺 choices → 返回空串（不抛错）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: {},
      json: async () => ({}),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).resolves.toBe('');
  });

  it('SSE：坏 chunk 忽略、delta 缺失跳过、[DONE] 提前终止（其后内容不再拼接）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        'data: 不是json\n',
        'data: {"choices":[]}\n',
        'data: {"choices":[{"delta":{"content":"A"}}]}\n',
        'data: {"choices":[{"delta":{}}]}\n',
        'data: [DONE]\n',
        'data: {"choices":[{"delta":{"content":"B"}}]}\n',
      ]),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).resolves.toBe('A');
  });

  it('SSE 无 [DONE] 正常收尾 → 已累积内容返回', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"尾巴"}}]}\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).resolves.toBe('尾巴');
  });

  it('HTTP 错误且错误体非 JSON → 回退「API 状态码」消息', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('不是json');
      },
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('API 500');
  });

  it('HTTP 错误后 fallback 成功 → 返回兜底内容', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: '过载' } }),
    });
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: '兜底OK' } }] }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).resolves.toBe('兜底OK');
  });
});

describe('非流式（requestUrl）错误格式矩阵', () => {
  beforeEach(() => {
    setupAI({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-oc' });
    vi.mocked(requestUrl).mockReset();
    (global as any).fetch = vi.fn();
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('opencode 格式：error.message 优先于 error.type', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ type: 'invalid_request_error', error: { type: 'rate_limit', message: '限流了' } }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('API 200: 限流了');
  });

  it('error 仅 type 无 message → 用 type 兜底', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ error: { type: 'rate_limit' } }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('API 200: rate_limit');
  });

  it('顶层 message 字段兜底', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ message: '顶层错误' }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('API 200: 顶层错误');
  });

  it('无任何错误标记但缺 content → 「响应缺少 content」', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: {} }] }),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('响应缺少 content');
  });
});

describe('选项合并与服务方法面', () => {
  let fetchMock: any;

  beforeEach(() => {
    setupAI();
    vi.mocked(requestUrl).mockReset();
    // 每次调用生成全新响应体：流式 body 只能消费一次，复用同一对象会 ReadableStream locked
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    }));
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('setDefaultModel 切换默认模型；setDefaultOptions 注入默认 modelOptions', async () => {
    const ai = new AIService({}, 'deepseek-v4-flash');
    ai.setDefaultModel('my-model');
    ai.setDefaultOptions({ modelOptions: { max_tokens: 777 } });
    await ai.prompt('q');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('my-model');
    expect(body.max_tokens).toBe(777);
  });

  it('search / reasonAndSearch 方法透传对应 modelOptions', async () => {
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.search('q');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).search).toBe(true);

    await ai.reasonAndSearch('q');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.enable_thinking).toBe(true);
    expect(body.search).toBe(true);
  });

  it('_prepareOptions 用户显式传入的 modelSettings 键不被预设覆盖（reason 关思考）', async () => {
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.reason('q', { modelOptions: { enable_thinking: false } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).enable_thinking).toBe(false);
  });

  it('_mergeOptions：defaultOptions 与调用方 options 均含 modelOptions 时浅合并且调用方优先', async () => {
    const ai = new AIService(undefined, 'm', { modelOptions: { a: 1, max_tokens: 100 } });
    await ai.prompt('q', 'm', { modelOptions: { b: 2, max_tokens: 55 } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.a).toBe(1); // 默认侧键保留
    expect(body.b).toBe(2); // 调用方键合入
    expect(body.max_tokens).toBe(55); // 同名键调用方优先
  });

  it('createAI：defaultOptions.modelOptions 合入内部默认（max_tokens 可被显式 defaultMaxTokens 基础上覆盖）', async () => {
    const ai = createAI({}, 'm', { modelOptions: { enable_thinking: true, max_tokens: 2048 } }, 4096);
    await ai.prompt('q');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.enable_thinking).toBe(true);
    expect(body.max_tokens).toBe(2048); // defaultOptions.modelOptions 优先于 defaultMaxTokens
  });
});
