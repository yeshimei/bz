// @vitest-environment node
/**
 * AIService 测试（ticket 03）：mock fetch 断言请求参数、流式解析、
 * fallback 非流式（requestUrl）、noCors 直走、chat/json 方法、provider 解析与错误。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService, createAI, getAIProvider, setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
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
  opencodeGoApiKey: 'sk-opencode-test',
};

describe('AIService', () => {
  let fetchMock: any;

  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetAIProviderCache();
    vi.mocked(requestUrl).mockReset();
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('prompt：fetch 流式请求参数（URL/headers/body: model/messages/max_tokens/stream）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n',
        'data: [DONE]\n',
      ]),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    const result = await ai.prompt('请回答');

    expect(result).toBe('你好，世界');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer sk-deepseek-test');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.messages).toEqual([{ role: 'user', content: '请回答' }]);
    expect(body.max_tokens).toBe(4096); // prompt 默认 4096
    expect(body.stream).toBe(true);
  });

  it('prompt：HTTP 错误抛出状态/消息', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: '限流' } }) });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('限流');
  });

  it('prompt：fetch 失败自动 fallback requestUrl 非流式', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: '兜底结果' } }] }),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    const result = await ai.prompt('x');
    expect(result).toBe('兜底结果');
    // requestUrl 收到的 body stream:false
    const reqOpts: any = vi.mocked(requestUrl).mock.calls[0][0];
    expect(JSON.parse(reqOpts.body).stream).toBe(false);
  });

  it('noCors provider（opencode-go）：跳过 fetch 直走 requestUrl', async () => {
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS, aiProvider: 'opencode-go' }));
    resetAIProviderCache();
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: 'opencode 结果' } }] }),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    const result = await ai.prompt('x');
    expect(result).toBe('opencode 结果');
    expect(fetchMock).not.toHaveBeenCalled();
    const reqOpts: any = vi.mocked(requestUrl).mock.calls[0][0];
    expect(reqOpts.url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(reqOpts.headers.Authorization).toBe('Bearer sk-opencode-test');
  });

  it('provider.model 覆盖默认模型（OpenCode Go 设置模型）', async () => {
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS, aiProvider: 'opencode-go' }));
    resetAIProviderCache();
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('x');
    const reqOpts: any = vi.mocked(requestUrl).mock.calls[0][0];
    expect(JSON.parse(reqOpts.body).model).toBe('deepseek-v4-flash'); // 固定默认模型
  });

  it('chat/json/reason：专用方法正确透传 modelOptions', async () => {
    const makeResp = () => ({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    fetchMock.mockImplementation(() => Promise.resolve(makeResp()));

    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.chat('q');
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('deepseek-v4-flash');

    await ai.json('q');
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });

    await ai.reason('q');
    body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.enable_thinking).toBe(true);
  });

  it('用户显式 modelOptions 覆盖默认（enable_thinking: false 关闭）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.reason('q', { modelOptions: { enable_thinking: false } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.enable_thinking).toBe(false);
  });

  it('max_tokens 默认 4096，modelOptions.max_tokens 可覆盖', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('q', 'm', { modelOptions: { max_tokens: 200 } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(200);
  });

  it('fallback 也失败 → 抛出组合错误', async () => {
    fetchMock.mockRejectedValue(new Error('fetch 崩'));
    vi.mocked(requestUrl).mockRejectedValue(new Error('requestUrl 崩'));
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('AI 请求失败: fetch 崩（fallback: requestUrl 崩）');
  });

  it('override 对象直接使用（脚本内指定第三方端点，未显式指定模型时用 provider.model）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"third"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    // 未显式指定模型（用默认）→ provider.model 生效；显式指定则覆盖
    await ai.prompt('x', undefined, { provider: { endpoint: 'https://third.example/v1/', apiKey: 'k3', model: 'm3' } });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://third.example/v1/chat/completions'); // 尾部斜杠被去除
    expect(JSON.parse(opts.body).model).toBe('m3');
  });

  it('deepseek 未配置 key 且 QuickAdd 兜底失败 → 抛「未配置 DeepSeek API Key」', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
    resetAIProviderCache();
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('未配置 DeepSeek API Key');
  });

  it('opencode-go 未配置 key → 抛「未配置 OpenCode Go API Key」', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: '' }));
    resetAIProviderCache();
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('未配置 OpenCode Go API Key');
  });

  it('custom 未配置 endpoint/key → 抛「未配置自定义 AI 服务」', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'custom', aiCustomEndpoint: '', aiCustomApiKey: '' }));
    resetAIProviderCache();
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('未配置自定义 AI 服务');
  });
});

describe('createAI', () => {
  beforeEach(() => {
    setApp({ vault: new MockVault() } as any);
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetAIProviderCache();
  });

  it('工厂创建实例（defaultMaxTokens 8192 生效）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    (global as any).fetch = fetchMock;

    const ai = createAI({}, 'deepseek-v4-flash');
    await ai.prompt('q');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(8192);
    delete (global as any).fetch;
  });
});
