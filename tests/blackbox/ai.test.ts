/**
 * 黑匣子 AI 服务测试（ticket 64）：ollama 模式走本地 /api/chat（format json）、deepseek 走 createAI。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getBlackBoxAISettings, ollamaJson, getBlackBoxAI } from '../../src/blackbox/ai';

describe('getBlackBoxAISettings', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama', blackboxOllamaUrl: 'http://localhost:11434/', blackboxOllamaModel: 'qwen2.5:14b' }) as any);
  });
  afterEach(() => setSettingsProvider(() => ({}) as any));

  it('读取设置：provider/url（去尾斜杠）/model', () => {
    const cfg = getBlackBoxAISettings();
    expect(cfg.provider).toBe('ollama');
    expect(cfg.url).toBe('http://localhost:11434');
    expect(cfg.model).toBe('qwen2.5:14b');
  });
  it('缺省 → deepseek + 默认值', () => {
    setSettingsProvider(() => ({}) as any);
    const cfg = getBlackBoxAISettings();
    expect(cfg.provider).toBe('deepseek');
    expect(cfg.url).toBe('http://localhost:11434');
    expect(cfg.model).toBe('qwen2.5:14b-instruct');
  });
});

describe('ollamaJson', () => {
  beforeEach(() => resetObsidianMocks());
  it('fetch POST /api/chat → 返回 message.content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"a":1}' } }),
    });
    (globalThis as any).fetch = fetchMock;
    const r = await ollamaJson('你好', 'http://localhost:11434', 'qwen2.5:14b');
    expect(r).toBe('{"a":1}');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('qwen2.5:14b');
    expect(body.format).toBe('json');
    expect(body.stream).toBe(false);
  });
  it('非 2xx → 抛错', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(ollamaJson('x', 'http://localhost:11434', 'm')).rejects.toThrow('Ollama 500');
  });
  it('响应缺 content → 抛错', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: {} }) });
    await expect(ollamaJson('x', 'http://localhost:11434', 'm')).rejects.toThrow('缺少 content');
  });
});

describe('getBlackBoxAI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama', blackboxOllamaUrl: 'http://localhost:11434', blackboxOllamaModel: 'm' }) as any);
  });
  afterEach(() => setSettingsProvider(() => ({}) as any));

  it('ollama 模式 → json 走本地 fetch', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: { content: '{"ok":1}' } }) });
    const ai = getBlackBoxAI();
    const r = await ai.json('提示');
    expect(r).toBe('{"ok":1}');
  });
});