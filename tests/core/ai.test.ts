// @vitest-environment node
/**
 * AIService 测试（ticket 03）：mock fetch 断言请求参数、流式解析、
 * fallback 非流式（requestUrl）、noCors 直走、chat/json 方法、provider 解析与错误。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService, createAI, getAIProvider, setAISettingsProvider, resetAIProviderCache, imageDataUrl, imageExtOfMime, imageMimeOfPath, AI_IMAGE_MAX_BYTES } from '../../src/core/ai';
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
    expect(body.max_tokens).toBe(8192); // deepseek 注册表 defaultMaxTokens（ticket 172 默认最大值）
    expect(body.stream).toBe(true);
  });

  it('prompt：HTTP 错误抛出状态/消息', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: '限流' } }) });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('限流');
  });

  // ==================== 图像输入（issue 311） ====================

  it('带图 prompt：content 走 OpenAI 多模态数组（文本在前、image_url 在后），纯文本报文零变化', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"一只猫"}}]}\n', 'data: [DONE]\n']),
    });
    const dataUrl = imageDataUrl(new Uint8Array([1, 2, 3]), 'image/png');
    const ai = new AIService({}, 'deepseek-v4-flash');
    const result = await ai.prompt({ text: '这张图里有什么？', images: [dataUrl, '  ', 'https://example.com/a.png'] });

    expect(result).toBe('一只猫');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: '这张图里有什么？' },
      { type: 'image_url', image_url: { url: dataUrl } },
      { type: 'image_url', image_url: { url: 'https://example.com/a.png' } }, // 空白项被丢弃，只留有效图
    ]);
  });

  it('带图 prompt：images 全为空白 → 退回纯文本字符串（不发空图片组）', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: sseBody(['data: [DONE]\n']) });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt({ text: '只有文字', images: ['', '   '] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: 'user', content: '只有文字' }]);
  });

  it('带图请求：空闲超时放宽到 180s（图片 base64 上行慢，60s 会误判超时）', async () => {
    fetchMock.mockImplementation((_url: string, opts: any) => {
      const hasImage = JSON.parse(opts.body).messages[0].content?.some?.((p: any) => p.type === 'image_url');
      expect(hasImage).toBe(true);
      return Promise.resolve({ ok: true, status: 200, body: sseBody(['data: [DONE]\n']) });
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt({ text: 'x', images: ['data:image/png;base64,AAAA'] });
    // 断请求已发出即可（阈值细节由 idleTimeoutOf 单测覆盖）
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('json 便捷方法也吃图：response_format 与多模态 content 同时到位（知识盒走 json 这条）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"{\\"ok\\":1}"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.json({ text: '读这张图，给 JSON', images: ['data:image/png;base64,AAAA'] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[0]).toEqual({ type: 'text', text: '读这张图，给 JSON' });
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
  });

  it('imageDataUrl：字节 → data URL；空图抛错；超 32 MiB 抛错', () => {
    expect(imageDataUrl(new Uint8Array([255, 254]), 'image/png'))
      .toBe('data:image/png;base64,' + Buffer.from([255, 254]).toString('base64'));
    expect(() => imageDataUrl(new Uint8Array(0), 'image/png')).toThrow('图片内容为空');
    const huge = new Uint8Array(AI_IMAGE_MAX_BYTES + 1);
    expect(() => imageDataUrl(huge, 'image/jpeg')).toThrow('图片过大');
  });

  it('imageMimeOfPath：只认 DeepSeek 接受的四种格式，其余返回 null', () => {
    expect(imageMimeOfPath('文献盒/assets/图.PNG')).toBe('image/png');
    expect(imageMimeOfPath('a/b.jpeg')).toBe('image/jpeg');
    expect(imageMimeOfPath('a/b.jpg')).toBe('image/jpeg');
    expect(imageMimeOfPath('a/b.webp')).toBe('image/webp');
    expect(imageMimeOfPath('a/b.gif')).toBe('image/gif');
    expect(imageMimeOfPath('a/b.svg')).toBeNull();
    expect(imageMimeOfPath('a/b.avif')).toBeNull();
    expect(imageMimeOfPath('无扩展名')).toBeNull();
  });

  it('imageExtOfMime：MIME → 落盘扩展名（imageMimeOfPath 的逆函数；jpeg 归一 jpg）', () => {
    expect(imageExtOfMime('image/png')).toBe('png');
    expect(imageExtOfMime('image/jpeg')).toBe('jpg'); // 归一到短名（jpeg 是同一 MIME 的别名）
    expect(imageExtOfMime('image/webp')).toBe('webp');
    expect(imageExtOfMime('image/gif')).toBe('gif');
    expect(imageExtOfMime('IMAGE/PNG')).toBe('png'); // 大小写不敏感
    expect(imageExtOfMime('image/svg+xml')).toBeNull();
    expect(imageExtOfMime('')).toBeNull();
    // 与 imageMimeOfPath 往返一致（图版落盘后仍能读回同一 MIME）
    expect(imageMimeOfPath('x.' + imageExtOfMime('image/jpeg')!)).toBe('image/jpeg');
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

  it('max_tokens 默认注册表值（ticket 172），modelOptions.max_tokens 可覆盖', async () => {
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
