// @vitest-environment node
/**
 * 两套请求协议（2026-11-12 用户拍板「自定义也要支持两套」）：
 * - Anthropic Messages：/messages、x-api-key + anthropic-version、system 抽顶层、
 *   SSE 取 content_block_delta、message_stop 收尾、图片转 base64 source；
 * - OpenAI 兼容：既有口径不变（回归锚点，本文件只做「没被协议改造弄坏」的抽样）；
 * - 自定义通道按 aiCustomProtocol 切协议；新增服务商的密钥走 aiApiKeys 表。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AIService,
  getAIProvider,
  setAISettingsProvider,
  resetAIProviderCache,
  imageDataUrl,
  AI_PROVIDER_REGISTRY,
  getProviderDescriptor,
} from '../../src/core/ai';
import { fetchProviderModels } from '../../src/core/ai-models';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { requestUrl } from '../mock-obsidian-entry';

/** SSE 流式响应体 */
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

/** Anthropic 风格的 SSE 行（event: 行会被解析器跳过，只认 data:） */
function anthropicChunk(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n`;
}

describe('Anthropic Messages 协议', () => {
  let fetchMock: any;
  let state: Record<string, any>;

  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
    state = { aiProvider: 'anthropic', aiApiKeys: { anthropic: 'sk-ant-test' } };
    setAISettingsProvider(() => state);
    resetAIProviderCache();
    vi.mocked(requestUrl).mockReset();
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('Claude 常驻通道：打 /messages，走 x-api-key + anthropic-version，不发 Authorization', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([anthropicChunk('你好'), 'event: message_stop\ndata: {"type":"message_stop"}\n\n']),
    });
    const ai = new AIService({}, 'claude-haiku-5-5');
    const result = await ai.prompt('请回答');

    expect(result).toBe('你好');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('sk-ant-test');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
    expect(opts.headers.Authorization).toBeUndefined(); // Anthropic 不认 Bearer
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBe(128000); // Messages API 的 max_tokens 必填
    expect(body.stream).toBe(true);
  });

  it('多轮报文：system 抽到顶层字段，messages 里不再留 system 角色', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([anthropicChunk('好'), 'data: {"type":"message_stop"}\n\n']),
    });
    const ai = new AIService({}, 'claude-haiku-5-5');
    await ai.prompt({
      messages: [
        { role: 'system', content: '你是编辑' },
        { role: 'user', content: '改一下这句话' },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe('你是编辑');
    expect(body.messages).toEqual([{ role: 'user', content: '改一下这句话' }]);
  });

  it('图片：data URL 转 base64 source（不是 OpenAI 的 image_url）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([anthropicChunk('一只猫'), 'data: {"type":"message_stop"}\n\n']),
    });
    const dataUrl = imageDataUrl(new Uint8Array([1, 2, 3]), 'image/png');
    const ai = new AIService({}, 'claude-haiku-5-5');
    await ai.prompt({ text: '这是什么？', images: [dataUrl] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: '这是什么？' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AQID' } },
    ]);
  });

  it('SSE 内联错误事件（type=error）当失败抛出，不静默返回半截文本', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([anthropicChunk('开头'), 'data: {"type":"error","error":{"type":"overloaded_error","message":"过载"}}\n\n']),
    });
    const ai = new AIService({}, 'claude-haiku-5-5');
    await expect(ai.prompt('x')).rejects.toThrow(/过载/);
  });

  it('非流式兜底（requestUrl）：读 content[].text，错误格式同样能提消息', async () => {
    fetchMock.mockRejectedValue(new Error('CORS'));
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ content: [{ type: 'text', text: '兜底回复' }] }),
    } as any);
    const ai = new AIService({}, 'claude-haiku-5-5');
    await expect(ai.prompt('x')).resolves.toBe('兜底回复');

    const opts = vi.mocked(requestUrl).mock.calls[0][0] as any;
    expect(opts.url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('sk-ant-test');
  });

  it('缺密钥报该家文案（不是 DeepSeek 的）', async () => {
    state = { aiProvider: 'anthropic', aiApiKeys: {} };
    await expect(getAIProvider()).rejects.toThrow('未配置 Claude（Anthropic） API Key');
  });
});

describe('自定义通道的协议切换（aiCustomProtocol）', () => {
  let fetchMock: any;
  let state: Record<string, any>;

  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
    state = {
      aiProvider: 'custom',
      aiCustomEndpoint: 'https://gw.example.com/v1',
      aiCustomApiKey: 'sk-gw',
      aiModelOverrides: { custom: 'my-model' },
      aiCustomProtocol: 'openai',
    };
    setAISettingsProvider(() => state);
    resetAIProviderCache();
    vi.mocked(requestUrl).mockReset();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"hi"}}]}\n', 'data: [DONE]\n']),
    });
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('缺省 openai：仍打 /chat/completions + Bearer', async () => {
    const ai = new AIService({}, 'my-model');
    await ai.prompt('x');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gw.example.com/v1/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer sk-gw');
  });

  it('切成 anthropic：改打 /messages + x-api-key，同一档自定义即可接 Claude 兼容端点', async () => {
    state.aiCustomProtocol = 'anthropic';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([anthropicChunk('ok'), 'data: {"type":"message_stop"}\n\n']),
    });
    const ai = new AIService({}, 'my-model');
    const result = await ai.prompt('x');

    expect(result).toBe('ok');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gw.example.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('sk-gw');
    expect(opts.headers.Authorization).toBeUndefined();
  });
});

describe('密钥表 aiApiKeys（新增服务商统一走表）', () => {
  let state: Record<string, any>;

  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
    state = { aiProvider: 'qwen' };
    setAISettingsProvider(() => state);
    resetAIProviderCache();
    vi.mocked(requestUrl).mockReset();
  });

  it('新服务商从表里取密钥（不占静态键位）', async () => {
    state.aiApiKeys = { qwen: 'sk-qwen' };
    const p = await getAIProvider('qwen');
    expect(p.apiKey).toBe('sk-qwen');
    expect(p.endpoint).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(p.protocol).toBe('openai');
  });

  it('表里有值优先于旧键（老家的存量键仍作回落）', async () => {
    state = { aiProvider: 'deepseek', deepseekApiKey: 'old-key', aiApiKeys: { deepseek: 'new-key' } };
    resetAIProviderCache();
    const p = await getAIProvider();
    expect(p.apiKey).toBe('new-key');
  });

  it('老三家仍读旧键（存量零迁移回归）', async () => {
    state = { aiProvider: 'deepseek', deepseekApiKey: 'legacy-key', aiApiKeys: {} };
    resetAIProviderCache();
    const p = await getAIProvider();
    expect(p.apiKey).toBe('legacy-key');
  });

  it('本地服务（lmstudio）空密钥放行，不打鉴权头', async () => {
    state = { aiProvider: 'lmstudio', aiApiKeys: {}, aiModelOverrides: { lmstudio: 'local-model' } };
    resetAIProviderCache();
    const p = await getAIProvider();
    expect(p.apiKey).toBe('');
  });

  it('自定义协议解析：缺省 openai，设成 anthropic 才切换', async () => {
    state = { aiProvider: 'custom', aiCustomEndpoint: 'https://x/v1', aiCustomApiKey: 'k', aiModelOverrides: { custom: 'm' } };
    resetAIProviderCache();
    expect((await getAIProvider()).protocol).toBe('openai');
    state.aiCustomProtocol = 'anthropic';
    resetAIProviderCache();
    expect((await getAIProvider()).protocol).toBe('anthropic');
  });
});

describe('模型列表：Anthropic 通道的鉴权头', () => {
  beforeEach(() => {
    // ai-models 读的是 settings-provider（不是 ai.ts 自己的注入），两套各设一次
    const s = { aiProvider: 'anthropic', aiApiKeys: { anthropic: 'sk-ant' } } as Record<string, any>;
    setSettingsProvider(() => s as any);
    setAISettingsProvider(() => s as any);
    resetAIProviderCache();
  });

  it('拉 /models 用 x-api-key（不是 Bearer）', async () => {
    const fetchFn = vi.fn(async (u: string, init: any) => {
      expect(u).toBe('https://api.anthropic.com/v1/models');
      expect(init.headers['x-api-key']).toBe('sk-ant');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
      expect(init.headers.Authorization).toBeUndefined();
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'claude-haiku-5-5' }] }) };
    });
    const models = await fetchProviderModels(undefined, { fetchFn });
    expect(models.map((m) => m.id)).toEqual(['claude-haiku-5-5']);
  });
});

describe('注册表协议标注', () => {
  it('只有 Claude 常驻通道走 anthropic 协议，其余缺省即 openai', () => {
    const anthropicIds = AI_PROVIDER_REGISTRY.filter((p) => p.protocol === 'anthropic').map((p) => p.id);
    expect(anthropicIds).toEqual(['anthropic']);
    // 显式声明 openai 的只有 custom（动态协议，注册表值仅作缺省兜底），其余家不写
    const explicit = AI_PROVIDER_REGISTRY.filter((p) => p.protocol === 'openai').map((p) => p.id);
    expect(explicit).toEqual(['custom']);
  });

  it('未知名回退缺省服务商（协议也随之回落 openai）', () => {
    expect(getProviderDescriptor('not-exist').id).toBe('deepseek');
    expect(getProviderDescriptor('not-exist').protocol).toBeUndefined();
  });
});
