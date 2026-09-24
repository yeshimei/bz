// @vitest-environment node
/**
 * AIService 测试（ticket 03）：mock fetch 断言请求参数、流式解析、
 * fallback 非流式（requestUrl）、chat/json 方法、provider 解析与错误。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AIService,
  createAI,
  getAIProvider,
  setAISettingsProvider,
  resetAIProviderCache,
  imageDataUrl,
  imageExtOfMime,
  imageMimeOfPath,
  testAIConnectivity,
  AI_IMAGE_MAX_BYTES,
  AI_PROVIDER_REGISTRY,
  DEFAULT_AI_PROVIDER,
  thinkingLevelsOf,
  thinkingBodyFor,
  hasExplicitThinkingOption,
} from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { toBase64 } from '../../src/core/crypto';
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
  zhipuPlanApiKey: 'sk-zhipu-plan-test',
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
    expect(body.max_tokens).toBe(393216); // deepseek 兜底默认 = 端点在售模型最大档（issue 342/ADR-0151）
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

  it('大数组跨分块边界：分块编码 == 一次性编码（架#7 toBase64 单源往返）', () => {
    // 70001 字节确定性伪随机（跨 2 个 32768 分块 + 尾块），避免全零序列掩盖分块错位
    const bytes = new Uint8Array(70001);
    let seed = 12345;
    for (let i = 0; i < bytes.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = seed & 0xff;
    }
    // 分块输出（crypto.toBase64）与一次性编码（Buffer）逐字节等价
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    // data URL 往返：解码回字节一致
    const dataUrl = imageDataUrl(bytes, 'image/png');
    const b64 = dataUrl.slice('data:image/png;base64,'.length);
    expect(Buffer.from(atob(b64), 'binary').equals(Buffer.from(bytes))).toBe(true);
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

  it('已退役的 provider id 回落缺省通道（迁移没跑到时也不炸）', async () => {
    // issue 411/ADR-0179：opencode-go 已退役——getProviderDescriptor 回退缺省服务商描述；
    // 存量脏值由 migrateRetiredAIKeys 改正，这里只兜「未迁移」时的兜底路径
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS, aiProvider: 'opencode-go' }));
    resetAIProviderCache();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('x');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
  });

  it('provider.model 覆盖默认模型（智谱 Plan 注册表默认 glm-5.3-flash）', async () => {
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS, aiProvider: 'zhipu-plan' }));
    resetAIProviderCache();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });

    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt('x');
    // 调用方传的模型 == defaultModel（判为非显式）→ 取注册表默认模型
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('glm-5.3-flash');
  });

  it('chat/json：专用方法正确透传 modelOptions', async () => {
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

    // issue 411/ADR-0179：思考参数不再由语义方法硬编码（reason/search 死 API 已退役）；
    // 档位缺省 auto → 报文里不带任何思考键
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.enable_thinking).toBeUndefined();
  });

  it('显式 modelOptions 思考键原样透传（域内实测档不被面板覆盖）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.json('q', { modelOptions: { enable_thinking: false } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.enable_thinking).toBe(false);
  });

  it('max_tokens 面板独裁（issue 334/ADR-0148）：modelOptions.max_tokens 被忽略，恒取 provider 链解析值', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    // deepseek 兜底默认 393216（issue 342 注册表最大档）；调用方传 200 一律忽略
    await ai.prompt('q', 'm', { modelOptions: { max_tokens: 200 } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(393216);

    // per-provider 覆盖生效：设置「最大输出 token」压过默认档
    setAISettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      aiMaxTokensOverrides: { deepseek: 16384 },
    }));
    resetAIProviderCache();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    await ai.prompt('q2');
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.max_tokens).toBe(16384);
  });

  it('{messages} 多轮输入：原样进请求体（issue 334 smartcat 迁移），max_tokens 仍走面板链', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    await ai.prompt({
      messages: [
        { role: 'system', content: '你是小橘' },
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '喵' },
        { role: 'user', content: '继续' },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0]).toEqual({ role: 'system', content: '你是小橘' });
    expect(body.messages[3]).toEqual({ role: 'user', content: '继续' });
    expect(body.max_tokens).toBe(393216);
  });

  it('默认档位按「当前模型名」解析（issue 342/ADR-0151）：命中取官方最大档，未收录回落服务商默认', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    // 命中：ollama 通道下挂 deepseek-flash（本地/聚合平台常见）→ 取该模型官方档 384K，
    // 而非 ollama 注册表默认 8192（证明查表优先于注册表默认）
    setAISettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      aiProvider: 'ollama',
      aiModelOverrides: { ollama: 'deepseek-flash' },
    }));
    resetAIProviderCache();
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(393216);

    // 未收录：回落该服务商注册表默认，不猜大数（防填超真实上限被服务端拒绝）
    setAISettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      aiProvider: 'ollama',
      aiModelOverrides: { ollama: 'some-unknown-model' },
    }));
    resetAIProviderCache();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    await ai.prompt('q2');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(8192);
  });

  it('fallback 也失败 → 抛出组合错误', async () => {    fetchMock.mockRejectedValue(new Error('fetch 崩'));
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

  it('zhipu-plan 未配置 key → 抛「未配置 智谱 Plan API Key」', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'zhipu-plan', zhipuPlanApiKey: '' }));
    resetAIProviderCache();
    const ai = new AIService({}, 'deepseek-v4-flash');
    await expect(ai.prompt('x')).rejects.toThrow('未配置 智谱 Plan API Key');
  });

  it('ollama 本地服务空密钥放行（无鉴权，走 OpenAI 兼容面）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'ollama', ollamaApiKey: '' }));
    resetAIProviderCache();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    const ai = new AIService({}, 'llama3.1');
    await expect(ai.prompt('x')).resolves.toBe('ok');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
  });

  // ==================== 思考档位注入（issue 411/ADR-0179） ====================

  /** 切 provider + 思考档位（per-provider 存 aiThinkingOverrides）并重置缓存 */
  function useThinking(provider: string, level: string, extra: Record<string, any> = {}): void {
    setAISettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      aiProvider: provider,
      aiThinkingOverrides: level === 'auto' ? {} : { [provider]: level },
      ...extra,
    }));
    resetAIProviderCache();
  }

  const okResp = () => ({
    ok: true,
    status: 200,
    body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
  });

  it('deepseek 档位表：关闭发 thinking.type=disabled；低/高/最高发 thinking.type=enabled + reasoning_effort', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'deepseek-v4-flash');

    // 关闭 = 官方开关（不是 enable_thinking——那是 Qwen/自建端的词表，DeepSeek 会当未知字段丢掉）
    useThinking('deepseek', 'off');
    await ai.prompt('q');
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.enable_thinking).toBeUndefined();

    // 强度档 = 开关 + reasoning_effort（官方样例同时带这两个字段）
    useThinking('deepseek', 'low');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
    });

    useThinking('deepseek', 'high');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).reasoning_effort).toBe('high');

    useThinking('deepseek', 'max');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).reasoning_effort).toBe('max');

    // auto（缺省档）不注入：现状零变化
    useThinking('deepseek', 'auto');
    await ai.prompt('q');
    body = JSON.parse(fetchMock.mock.calls[4][1].body);
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('deepseek 无「中」档（官方映射 medium→high）：历史遗留的 medium 不注入，不冒进发参数', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'deepseek-v4-flash');
    useThinking('deepseek', 'medium');
    await ai.prompt('q');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.thinking).toBeUndefined();
  });

  it('zhipu-plan 档位表：强制思考无「关闭」档（off 不在表内 → 不注入），强度档发 reasoning_effort', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'glm-5.3-flash');

    // glm-5.3 / 5.3-flash 强制思考，发 disabled 无效——表里没有 off，故这里什么都不发
    useThinking('zhipu-plan', 'off');
    await ai.prompt('q');
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();

    useThinking('zhipu-plan', 'low');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reasoning_effort).toBe('low');

    useThinking('zhipu-plan', 'max');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).reasoning_effort).toBe('max');
  });

  it('ollama 档位表：关闭走 reasoning_effort=none（兼容层 none 关思考），低/中/高按档发', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'llama3.1');

    useThinking('ollama', 'off');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning_effort).toBe('none');

    useThinking('ollama', 'medium');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reasoning_effort).toBe('medium');

    useThinking('ollama', 'high');
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).reasoning_effort).toBe('high');
  });

  it('档位只在所属 provider 生效：A 家的档位不落到 B 家、也不串表', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'deepseek-v4-flash');

    // 只有 deepseek 存了 off；切到 ollama 时该键读不到 → ollama 走自己的缺省 auto（不注入）
    setAISettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      aiProvider: 'ollama',
      aiThinkingOverrides: { deepseek: 'off' },
    }));
    resetAIProviderCache();
    await ai.prompt('q');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning_effort).toBeUndefined();
  });

  it('对象 override（无注册表身份）永不注入思考参数', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResp()));
    const ai = new AIService({}, 'deepseek-v4-flash');
    useThinking('deepseek', 'high');
    await ai.prompt('x', undefined, {
      provider: { endpoint: 'https://third.example/v1', apiKey: 'k3', model: 'm3' },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.thinking).toBeUndefined();
  });

  it('thinkingBodyFor / thinkingLevelsOf 纯函数：auto 与未知档不注入；三张表逐条自洽', () => {
    expect(thinkingBodyFor('deepseek', 'auto')).toBeNull();
    expect(thinkingBodyFor('deepseek', '一切')).toBeNull(); // 未知档不注入
    expect(thinkingBodyFor('deepseek', 'medium')).toBeNull(); // 该家没有的档不注入
    expect(thinkingBodyFor(undefined, 'high')).toBeNull(); // 无注册表身份不注入
    expect(thinkingBodyFor('deepseek', 'off')).toEqual({ thinking: { type: 'disabled' } });
    expect(thinkingBodyFor('ollama', 'off')).toEqual({ reasoning_effort: 'none' });

    expect(thinkingLevelsOf('deepseek').map((l) => l.value)).toEqual(['auto', 'off', 'low', 'high', 'max']);
    expect(thinkingLevelsOf('zhipu-plan').map((l) => l.value)).toEqual(['auto', 'low', 'high', 'max']);
    expect(thinkingLevelsOf('ollama').map((l) => l.value)).toEqual(['auto', 'off', 'low', 'medium', 'high']);
    // 注册表每家都要有档位表（issue 411：新增 provider 忘补表会被这里拦住）
    for (const p of AI_PROVIDER_REGISTRY) {
      const levels = thinkingLevelsOf(p.id);
      expect(levels.length, p.id).toBeGreaterThan(1);
      expect(levels[0].value, p.id).toBe('auto');
      expect(levels[0].body, p.id).toBeNull();
      expect(new Set(levels.map((l) => l.value)).size, p.id).toBe(levels.length); // 档位值不重复
      for (const l of levels.slice(1)) {
        expect(l.label, `${p.id}/${l.value}`).toBeTruthy();
        expect(l.body, `${p.id}/${l.value}`).not.toBeNull(); // 非 auto 档必须给出请求体
      }
    }
    expect(DEFAULT_AI_PROVIDER).toBe(AI_PROVIDER_REGISTRY[0].id);
    expect(hasExplicitThinkingOption({ enable_thinking: true })).toBe(true);
    expect(hasExplicitThinkingOption({ reasoning_effort: 'low' })).toBe(true);
    expect(hasExplicitThinkingOption({ thinking: { type: 'enabled' } })).toBe(true);
    expect(hasExplicitThinkingOption({ response_format: { type: 'json_object' } })).toBe(false);
  });
});

describe('createAI', () => {
  beforeEach(() => {
    setApp({ vault: new MockVault() } as any);
    setAISettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetAIProviderCache();
  });

  it('工厂创建实例（默认档位生效：deepseek 兜底 393216）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']),
    });
    (global as any).fetch = fetchMock;

    const ai = createAI({}, 'deepseek-v4-flash');
    await ai.prompt('q');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(393216);
    delete (global as any).fetch;
  });
});
;
// ==================== 连通性测试（issue 433 密钥行「测试」按钮的数据层） ====================

describe('testAIConnectivity', () => {
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

  it('按服务商 id 发一次真实极小请求：走该家设置密钥，回传服务商/模型/耗时/回复', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"OK"}}]}\n', 'data: [DONE]\n']),
    });
    const r = await testAIConnectivity('deepseek');
    expect(r.label).toBe('DeepSeek');
    expect(r.reply).toBe('OK');
    expect(r.ms).toBeGreaterThanOrEqual(0);
    expect(r.model).toBeTruthy();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer sk-deepseek-test');
    const body = JSON.parse(opts.body);
    expect(body.messages).toEqual([{ role: 'user', content: '这是一次连通性测试。请只回复两个字母：OK' }]);
  });

  it('缺密钥 → 抛错（文案含「未配置」），不冒充连通', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'zhipu-plan', zhipuPlanApiKey: '' }));
    resetAIProviderCache();
    await expect(testAIConnectivity('zhipu-plan')).rejects.toThrow(/未配置/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('回复为空 → 视为不通（服务端哑响应不该被当成「连着」）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":""}}]}\n', 'data: [DONE]\n']),
    });
    await expect(testAIConnectivity('deepseek')).rejects.toThrow(/回复为空/);
  });
});
