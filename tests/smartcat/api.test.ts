// @vitest-environment node
/**
 * smartcat AI 层测试：issue 334/ADR-0148 起迁移到 core AIService 单通道——
 * 多轮 {messages} 报文、temperature 0.7 任务语义、输出上限跟随设置面板（per-provider 覆盖 >
 * 注册表默认）；fetch 失败 fallback requestUrl 由 core 承载（超时/空闲中止已在
 * tests/core/sweep-core-ai.test.ts 覆盖，此处不重复）。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { callChat, callChatJson } from '../../src/smartcat/api';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { requestUrl } from '../mock-obsidian-entry';

beforeEach(() => {
  resetAIProviderCache();
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  vi.mocked(requestUrl).mockReset();
  (globalThis as any).fetch = undefined;
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('callChat（core AIService 单通道）', () => {
  it('fetch 可用：POST chat/completions，多轮 messages + temperature + 面板独裁上限', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '喵呜~ 你好！' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;

    const r = await callChat([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: '你好' },
    ]);
    expect(r).toBe('喵呜~ 你好！');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
        body: expect.stringContaining('"model":"deepseek-v4-flash"'),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(8192); // 面板独裁：deepseek 注册表默认，不私传 300
    expect(body.temperature).toBe(0.7); // 任务语义保留
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('system');
  });

  it('per-provider「最大输出 token」覆盖生效（面板独裁的价值）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test', aiMaxTokensOverrides: { deepseek: 4096 } }));
    resetAIProviderCache();
    const fetchMock = vi.fn(async (_url: string, init: any) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    await callChat([{ role: 'user', content: 'hi' }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
  });

  it('fetch 失败（CORS/网络）→ fallback requestUrl 非流式', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('Failed to fetch'); });
    (globalThis as any).fetch = fetchMock;
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content: 'fallback ok' } }] }),
    } as any);

    const r = await callChat([{ role: 'user', content: 'hi' }]);
    expect(r).toBe('fallback ok');
    expect(requestUrl).toHaveBeenCalled();
    const opts: any = vi.mocked(requestUrl).mock.calls[0][0];
    expect(opts.url).toContain('/chat/completions');
    expect(opts.body).toContain('"stream":false');
  });

  it('无 AI 配置 → 抛错（引导设置）', async () => {
    resetAIProviderCache();
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
    setApp({ vault: { adapter: { read: async () => { throw new Error('no quickadd'); } } } } as any);
    await expect(callChat([{ role: 'user', content: 'x' }])).rejects.toThrow();
  });

  it('API 错误状态码 → 抛错（含服务端错误消息）', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }));
    (globalThis as any).fetch = fetchMock;
    await expect(callChat([{ role: 'user', content: 'x' }])).rejects.toThrow(/Invalid API key/);
  });
});

describe('callChatJson', () => {
  it('response_format json_object + 解析成功', async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ score: 3 }) } }], sent: body }),
      };
    });
    (globalThis as any).fetch = fetchMock;
    const r = await callChatJson([
      { role: 'system', content: '只输出 JSON' },
      { role: 'user', content: '打分' },
    ]);
    expect(r).toEqual({ score: 3 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('JSON 解析失败 → 抛错（调用方降级）', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '不是 JSON' } }] }),
    }));
    await expect(callChatJson([{ role: 'user', content: 'x' }])).rejects.toThrow(/JSON 解析失败/);
  });
});
