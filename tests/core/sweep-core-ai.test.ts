// @vitest-environment node
/**
 * 全域审查共享基座修复批回归（C1/C2，src/core/ai.ts）：
 * - C1 流式/非流式 AI 请求空闲超时：建连后不回包或流中途停发超 60s 必 settle 报超时（原先 Promise 永不 settle、任务转圈到重启）；
 * - C2 字符串 override 解析结果不写全局缓存：getAIProvider('openai') 后无参调用仍解析当前设置的 provider。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AIService,
  getAIProvider,
  setAISettingsProvider,
  resetAIProviderCache,
  AI_IDLE_TIMEOUT_MS,
} from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { requestUrl } from '../mock-obsidian-entry';

const BASE_SETTINGS = {
  aiProvider: 'deepseek',
  deepseekApiKey: 'sk-deepseek-test',
  openaiApiKey: 'sk-openai-test',
};

describe('AI 请求超时与缓存隔离（sweep-core C1/C2）', () => {
  let fetchMock: any;

  beforeEach(() => {
    setApp({ vault: new MockVault(), adapter: { read: vi.fn() } } as any);
    setAISettingsProvider(() => ({ ...BASE_SETTINGS }));
    resetAIProviderCache();
    vi.mocked(requestUrl).mockReset();
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
    vi.useRealTimers();
  });

  it('C1 流式建连后不回包：60s 超时中止，fetch 与 requestUrl 兜底两段都报超时（不再永久转圈）', async () => {
    vi.useFakeTimers();
    // 真实 fetch 语义：响应 abort signal（挂死的连接被中止时以 AbortError reject）
    fetchMock.mockImplementation((_url: string, opts: any) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError'))
        );
      });
    });
    // requestUrl 兜底同样挂死（requestUrl 不可中止，race 超时先行 settle）
    vi.mocked(requestUrl).mockImplementation(() => new Promise(() => {}));

    const ai = new AIService({}, 'deepseek-v4-flash');
    const pending = ai.prompt('x');
    const assertion = expect(pending).rejects.toThrow(/超时/);
    await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS); // 流式段超时
    await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS); // requestUrl 兜底段超时
    await assertion;
  });

  it('C1 流中途停发：已出的增量照常回调，空闲 60s 后超时报错（长流不受总时长误杀）', async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    let streamCtl: ReadableStreamDefaultController<Uint8Array> | null = null;
    fetchMock.mockImplementation((_url: string, opts: any) => {
      opts.signal.addEventListener('abort', () => {
        try {
          streamCtl?.error(new DOMException('The operation was aborted', 'AbortError'));
        } catch (e) { /* 已关闭 */ }
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          start(c) {
            streamCtl = c;
            c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第一段"}}]}\n'));
            // 不 close：模拟远端停发
          },
        }),
      });
    });

    const deltas: string[] = [];
    const ai = new AIService({}, 'deepseek-v4-flash');
    const pending = ai.prompt('x', 'deepseek-v4-flash', { onDelta: (d: string) => deltas.push(d) });
    const assertion = expect(pending).rejects.toThrow(/超时/);
    await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS);
    await assertion;
    expect(deltas).toEqual(['第一段']); // 停发前的增量已回调
    // 空闲计时按段重置：出片后再等 59s 不应触发超时（此处已超时，反向验证由用例 3 承担）
  });

  it('C1 正常流式不受超时误杀：60s 内持续出片直至 [DONE] 正常返回', async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    // holder 对象绕开 TS 对闭包赋值的 null 窄化
    const streamRef: { ctl: ReadableStreamDefaultController<Uint8Array> | null } = { ctl: null };
    fetchMock.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          start(c) {
            streamRef.ctl = c;
          },
        }),
      });
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    const pending = ai.prompt('x').then((r) => r);
    // 先刷新微任务让 fetch 被真实调用（prompt 先 await getAIProvider），再开始逐段出片
    await vi.advanceTimersByTimeAsync(0);
    // 逐段推进：每段间隔都小于超时（各段之间 advance 一半超时时长也不会中止）
    for (const part of ['你', '好', '，世', '界']) {
      streamRef.ctl?.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"${part}"}}]}\n`));
      await vi.advanceTimersByTimeAsync(AI_IDLE_TIMEOUT_MS / 2);
    }
    streamRef.ctl?.enqueue(encoder.encode('data: [DONE]\n'));
    await expect(pending).resolves.toBe('你好，世界');
  });

  it('C1 用户取消路径不受影响：外部 signal 中止后按 AbortError 抛出且不走 requestUrl 兜底', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url: string, opts: any) => {
      return new Promise((_resolve, reject) => {
        const abortErr = () => reject(new DOMException('The operation was aborted', 'AbortError'));
        if (opts.signal.aborted) { abortErr(); return; } // 调用时已取消：立即 reject（真实 fetch 语义）
        opts.signal.addEventListener('abort', abortErr);
      });
    });
    const ai = new AIService({}, 'deepseek-v4-flash');
    const pending = ai.prompt('x', 'deepseek-v4-flash', { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(vi.mocked(requestUrl)).not.toHaveBeenCalled();
  });

  it('C2 字符串 override 不写缓存：无参调用仍解析当前设置的 provider，缓存本身照常生效', async () => {
    const viaOverride = await getAIProvider('openai');
    expect(viaOverride.endpoint).toBe('https://api.openai.com/v1');
    expect(viaOverride.apiKey).toBe('sk-openai-test');

    const noArg = await getAIProvider();
    expect(noArg.endpoint).toBe('https://api.deepseek.com'); // 未被 override 的 openai 结果污染
    expect(noArg.apiKey).toBe('sk-deepseek-test');

    const again = await getAIProvider();
    expect(again).toBe(noArg); // 无参调用缓存复用仍然成立
  });

  it('C2 对象 override 本就不写缓存（回归保护）：无参调用解析设置里的 provider', async () => {
    const viaOverride = await getAIProvider({ endpoint: 'https://third.example/v1', apiKey: 'sk-third' });
    expect(viaOverride.endpoint).toBe('https://third.example/v1');
    const noArg = await getAIProvider();
    expect(noArg.endpoint).toBe('https://api.deepseek.com');
  });
});
