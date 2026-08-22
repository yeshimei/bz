/**
 * smartcat AI 层测试：走 bz core/ai getAIProvider（mock settings），
 * 验证多轮 messages 请求体/模型参数/失败 fallback requestUrl。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { callChat } from '../../src/smartcat/api';
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

describe('callChat', () => {
  it('fetch 可用：POST chat/completions，模型/参数对齐原版', async () => {
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
        body: expect.stringContaining('"model":"deepseek-chat"'),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(300);
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(false);
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('system');
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

  it('API 错误状态码 → 抛错', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }));
    (globalThis as any).fetch = fetchMock;
    await expect(callChat([{ role: 'user', content: 'x' }])).rejects.toThrow(/Invalid API key/);
  });
});