// @vitest-environment node
/**
 * 闪念 Ollama HTTP 测试（P1-10 / ticket 46）：嵌入端点统一超时 30s（EMBED_TIMEOUT_MS）——
 * 挂起请求到点中止并拒绝「Ollama 无响应」；检索级 10s 上限（SEARCH_TIMEOUT_MS）由 vector-store
 * 检索降级层负责（vector-store.test.ts 有 fake timer 用例）。正常响应不受影响。
 * issue 428：调用方 signal 取消与服务端超时**报错必须分开**——取消抛 AbortError（面板静默收口），
 * 超时才报「Ollama 无响应」。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEmbedding, checkRemoteOllama, EMBED_TIMEOUT_MS } from '../../src/secondbrain/ollama';
import { isAbortError } from '../../src/core/abort';

const BASE = 'http://127.0.0.1:65535';

/** 永不 resolve 的 fetch mock：仅监听 abort 信号后 reject（模拟 Ollama 挂起；
 *  signal 已中断时立即 reject —— 真 fetch 同语义，issue 428 的「已取消」用例依赖它） */
function stubPendingFetch() {
  const fetchMock = vi.fn((_url: string, opts: any) =>
    new Promise<Response>((_resolve, reject) => {
      if (opts.signal?.aborted) {
        reject(new Error('The operation was aborted'));
        return;
      }
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

describe('调用方取消（issue 428）', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('signal 取消：抛 AbortError（不是「Ollama 无响应」），且请求的 signal 被中断', async () => {
    const fetchMock = stubPendingFetch();
    vi.useFakeTimers();
    const ac = new AbortController();
    const removeSpy = vi.spyOn(ac.signal, 'removeEventListener');
    const p = getEmbedding('文本', true, BASE, undefined, ac.signal);
    const assertion = expect(p).rejects.toSatisfy((e: unknown) => isAbortError(e));
    ac.abort();
    await assertion;
    expect((fetchMock.mock.calls[0][1] as any).signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0); // 取消路径同样清定时器、解绑外层监听
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function)); // 外层监听真解绑（ADR-0187 口径）
  });

  it('正常返回：外层监听也被解绑（成功路径同样走 finally，长会话不累积监听）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: [0.3] }), { status: 200 })
    ));
    const ac = new AbortController();
    const removeSpy = vi.spyOn(ac.signal, 'removeEventListener');
    await expect(getEmbedding('x', false, BASE, undefined, ac.signal)).resolves.toEqual([0.3]);
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('取消早于超时：不报超时文案（timedOut 标记只认定时器触发）', async () => {
    stubPendingFetch();
    const ac = new AbortController();
    const p = getEmbedding('文本', true, BASE, undefined, ac.signal);
    const assertion = p.then(
      () => 'resolved',
      (e) => (isAbortError(e) ? 'aborted' : String(e))
    );
    ac.abort();
    await expect(assertion).resolves.toBe('aborted');
  });

  it('已取消的 signal：请求即刻中断（不发第二次调用也拿 AbortError）', async () => {
    stubPendingFetch();
    const ac = new AbortController();
    ac.abort();
    await expect(getEmbedding('文本', true, BASE, undefined, ac.signal)).rejects.toSatisfy((e: unknown) => isAbortError(e));
  });
});
