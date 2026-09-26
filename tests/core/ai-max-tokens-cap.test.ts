// @vitest-environment node
/**
 * 输出上限护栏（issue 457/ADR-0193）。
 *
 * 背景：面板「最大输出 token」原用全局硬编码上界 200000，而智谱 glm-5.3-flash 的真实上界是
 * 131072——填 20 万直送服务端被 400 / 1210 拒（2026-09-26 实测），且失败面是全域 AI 调用。
 * 护栏两条：① 面板输入上界按「当前 provider 当前模型」动态取（见 settings-schema-ui 测试）；
 * ② 解析出口对超限覆盖值就近封顶（本文件）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAI,
  getAIProvider,
  maxOutputCapOf,
  resetAIProviderCache,
  setAISettingsProvider,
} from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

/** 构造 SSE 流式响应体（与 ai.test.ts 同口径） */
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

/** 注入 settings 快照并清 provider 缓存（覆盖值与 provider 都变了，必须重解析） */
function useSettings(patch: Record<string, unknown>): void {
  setAISettingsProvider(
    () =>
      ({
        aiProvider: 'deepseek',
        deepseekApiKey: 'sk-ds-test',
        zhipuPlanApiKey: 'sk-zp-test',
        ...patch,
      }) as any,
  );
  resetAIProviderCache();
}

describe('maxOutputCapOf：上限按 provider / 模型取，不是全局常量', () => {
  it('智谱 131072 / DeepSeek 393216；Ollama 无官方档 → undefined（不设围栏）', () => {
    expect(maxOutputCapOf('zhipu-plan')).toBe(131072);
    expect(maxOutputCapOf('deepseek')).toBe(393216);
    expect(maxOutputCapOf('ollama')).toBeUndefined();
  });

  it('「模型名称」覆盖参与查表：DeepSeek 换 gpt-4o-mini → 16384', () => {
    expect(maxOutputCapOf('deepseek', 'gpt-4o-mini')).toBe(16384);
  });

  it('别名命中；本地模型名未收录 → undefined（不猜大数，也不给本地模型套围栏）', () => {
    expect(maxOutputCapOf('deepseek', 'deepseek-v4-flash')).toBe(393216);
    expect(maxOutputCapOf('ollama', 'qwen2.5:14b-instruct-q4_K_M')).toBeUndefined();
  });

  it('未知 provider 回退缺省服务商（与 getProviderDescriptor 同口径）', () => {
    expect(maxOutputCapOf('nope')).toBe(393216);
  });
});

describe('getAIProvider：面板覆盖值受官方上限封顶', () => {
  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
  });

  it('智谱填 200000 → 封顶到 131072（原样直送即 400 / 1210 的复现条件）', async () => {
    useSettings({ aiProvider: 'zhipu-plan', aiMaxTokensOverrides: { 'zhipu-plan': 200000 } });
    expect((await getAIProvider('zhipu-plan')).defaultMaxTokens).toBe(131072);
  });

  it('未超限的覆盖值原样保留（护栏只封顶、不缩值）', async () => {
    useSettings({ aiProvider: 'zhipu-plan', aiMaxTokensOverrides: { 'zhipu-plan': 65536 } });
    expect((await getAIProvider('zhipu-plan')).defaultMaxTokens).toBe(65536);
  });

  it('DeepSeek 填同样的 200000 不被砍——它上限 393216', async () => {
    useSettings({ aiProvider: 'deepseek', aiMaxTokensOverrides: { deepseek: 200000 } });
    expect((await getAIProvider('deepseek')).defaultMaxTokens).toBe(200000);
  });

  it('换了小上限模型同样受护栏：deepseek + gpt-4o-mini + 200000 → 16384', async () => {
    useSettings({
      aiProvider: 'deepseek',
      aiModelOverrides: { deepseek: 'gpt-4o-mini' },
      aiMaxTokensOverrides: { deepseek: 200000 },
    });
    expect((await getAIProvider('deepseek')).defaultMaxTokens).toBe(16384);
  });

  it('0 / 负数 / 非数一律按「未填」处理，回落基准档（与面板「填 0 清覆盖」一致）', async () => {
    for (const bad of [0, -5, Number.NaN]) {
      useSettings({ aiProvider: 'zhipu-plan', aiMaxTokensOverrides: { 'zhipu-plan': bad } });
      expect((await getAIProvider('zhipu-plan')).defaultMaxTokens).toBe(131072);
    }
  });

  it('无官方上限的通道不设围栏：Ollama 填 32000 原样保留（8192 只是兜底档，不回退既有口径）', async () => {
    useSettings({ aiProvider: 'ollama', aiMaxTokensOverrides: { ollama: 32000 } });
    expect((await getAIProvider('ollama')).defaultMaxTokens).toBe(32000);
  });

  it('DeepSeek 填超护栏（500000 > 393216）同样封顶——护栏不只对智谱生效', async () => {
    useSettings({ aiProvider: 'deepseek', aiMaxTokensOverrides: { deepseek: 500000 } });
    expect((await getAIProvider('deepseek')).defaultMaxTokens).toBe(393216);
  });

  it('端到端：prompt 真正发出的 max_tokens 是封顶后的值（所配即所发）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody(['data: {"choices":[{"delta":{"content":"OK"}}]}\n', 'data: [DONE]\n']),
    });
    const originalFetch = (global as any).fetch;
    (global as any).fetch = fetchMock;
    try {
      useSettings({ aiProvider: 'zhipu-plan', aiMaxTokensOverrides: { 'zhipu-plan': 200000 } });
      await createAI().prompt('q');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe('glm-5.3-flash');
      expect(body.max_tokens).toBe(131072);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });
});
