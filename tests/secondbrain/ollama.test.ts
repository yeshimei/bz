// @vitest-environment node
/**
 * 闪念 Ollama HTTP 测试（P1-10 / ticket 46）：嵌入端点统一超时 30s（EMBED_TIMEOUT_MS）——
 * 挂起请求到点中止并拒绝「Ollama 无响应」；检索级 10s 上限（SEARCH_TIMEOUT_MS）由 vector-store
 * 检索降级层负责（vector-store.test.ts 有 fake timer 用例）。正常响应不受影响。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEmbedding, ollamaChat, checkRemoteOllama, EMBED_TIMEOUT_MS } from '../../src/secondbrain/ollama';

const BASE = 'http://127.0.0.1:65535';

/** 永不 resolve 的 fetch mock：仅监听 abort 信号后 reject（模拟 Ollama 挂起） */
function stubPendingFetch() {
  const fetchMock = vi.fn((_url: string, opts: any) =>
    new Promise<Response>((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('httpFetch 统一超时（P1-10）', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('getEmbedding：挂起请求在超时后被拒绝，错误含「Ollama 无响应」且定时器清理', async () => {
    const fetchMock = stubPendingFetch();
    vi.useFakeTimers();
    const p = getEmbedding('测试文本', false, BASE);
    const assertion = expect(p).rejects.toThrow('Ollama 无响应');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(EMBED_TIMEOUT_MS + 1); // 跨过阈值 → abort → reject
    await assertion;
    expect((fetchMock.mock.calls[0][1] as any).signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0); // finally 清理 abort 定时器
  });

  it('ollamaChat：同样受超时保护并报「Ollama 无响应」', async () => {
    stubPendingFetch();
    vi.useFakeTimers();
    const p = ollamaChat('你好', undefined, BASE);
    const assertion = expect(p).rejects.toThrow('Ollama 无响应');
    await vi.advanceTimersByTimeAsync(EMBED_TIMEOUT_MS + 1);
    await assertion;
  });

  it('checkRemoteOllama：超时按不可用处理（返回 false，不抛出）', async () => {
    stubPendingFetch();
    vi.useFakeTimers();
    const p = checkRemoteOllama(BASE);
    await vi.advanceTimersByTimeAsync(EMBED_TIMEOUT_MS + 1);
    await expect(p).resolves.toBe(false);
  });

  it('正常响应不受影响：超时定时器被清理，请求即时返回', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: [0.1, 0.2] }), { status: 200 })
    ));
    vi.useFakeTimers();
    const p = getEmbedding('x', false, BASE);
    const assertion = expect(p).resolves.toEqual([0.1, 0.2]);
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(vi.getTimerCount()).toBe(0); // abort 定时器已被 finally 清理
  });
});
