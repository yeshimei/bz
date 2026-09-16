// @vitest-environment node
/**
 * core/http 单源测试（issue 365 复用上收批第 1 项）：
 * - httpGetText 四态：2xx → 正文、非 2xx / 网络错 / 超时 → null（全部 fetchImpl 注入，不发真请求）；
 * - withTimeout：超时 reject（label 与时限进错误信息）、原 Promise 超时后照旧 settle
 *   （结果弃用、无 unhandled rejection）、先落定一侧透传并清计时器；
 * - requestUrlAsFetch：生产通道适配（throw:false、2xx 判 ok）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { httpGetText, withTimeout, requestUrlAsFetch } from '../../src/core/http';
import { requestUrl } from '../mock-obsidian-entry';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 罐头 2xx 响应（fetch 形状最小视图） */
const okResp = (text: string) => ({ ok: true, status: 200, text: async () => text });

describe('httpGetText 四态', () => {
  it('2xx → 正文（headers 原样传给 fetchImpl）', async () => {
    const fetchImpl = vi.fn(async () => okResp('正文内容'));
    const r = await httpGetText('https://x.test/a', { timeoutMs: 1000, headers: { 'X-A': 'b' }, fetchImpl });
    expect(r).toBe('正文内容');
    expect(fetchImpl).toHaveBeenCalledWith('https://x.test/a', { headers: { 'X-A': 'b' } });
  });

  it('非 2xx → null', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, text: async () => 'nope' }));
    expect(await httpGetText('https://x.test/a', { timeoutMs: 1000, fetchImpl })).toBeNull();
  });

  it('网络错（fetchImpl reject）→ null（静默，不上抛）', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    expect(await httpGetText('https://x.test/a', { timeoutMs: 1000, fetchImpl })).toBeNull();
  });

  it('超时 → null（挂起请求弃果，不悬挂）', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<never>(() => {}));
    const p = httpGetText('https://x.test/a', { timeoutMs: 30, fetchImpl });
    const assertion = expect(p).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(31);
    await assertion;
  });

  it('缺省走 globalThis.fetch（stub 验证默认通道，不发真请求）', async () => {
    const fetchMock = vi.fn(async () => okResp('via-global'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await httpGetText('https://x.test/a', { timeoutMs: 1000 })).toBe('via-global');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('超时 → reject，label 与时限进错误信息', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise<never>(() => {}), 50, '慢请求');
    const assertion = expect(p).rejects.toThrow('请求超时（慢请求，50ms）');
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });

  it('原 Promise 超时后照旧 settle（结果弃用，迟到 resolve 不报 unhandled）', async () => {
    vi.useFakeTimers();
    let resolveP!: (v: string) => void;
    const p = new Promise<string>((r) => { resolveP = r; });
    const guarded = withTimeout(p, 40, '慢请求');
    const rejection = expect(guarded).rejects.toThrow('请求超时');
    await vi.advanceTimersByTimeAsync(41);
    await rejection;
    resolveP('迟到结果');
    expect(await p).toBe('迟到结果');
  });

  it('原 Promise 超时后迟到 reject 同样被消化（C23：无 unhandled rejection）', async () => {
    vi.useFakeTimers();
    let rejectP!: (e: Error) => void;
    const p = new Promise<string>((_r, rej) => { rejectP = rej; });
    const guarded = withTimeout(p, 40, '慢请求');
    const rejection = expect(guarded).rejects.toThrow('请求超时');
    await vi.advanceTimersByTimeAsync(41);
    await rejection;
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown): void => { unhandled.push(e); };
    process.on('unhandledRejection', onUnhandled);
    rejectP(new Error('迟到的失败'));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('原 Promise 先 reject → 原样透传并清计时器', async () => {
    const boom = new Error('提前失败');
    await expect(withTimeout(Promise.reject(boom), 5000, 'x')).rejects.toBe(boom);
  });

  it('原 Promise 先 resolve → 正常放行并清计时器', async () => {
    vi.useFakeTimers();
    const assertion = expect(withTimeout(Promise.resolve('ok'), 5000, 'x')).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('requestUrlAsFetch（生产通道适配）', () => {
  it('2xx → ok:true，text 可取；requestUrl 收到 throw:false 与 headers', async () => {
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: 'hello' } as any);
    const resp = await requestUrlAsFetch()('https://x.test/a', { headers: { 'X-A': 'b' } });
    expect(resp.ok).toBe(true);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('hello');
    expect(requestUrl).toHaveBeenCalledWith({ url: 'https://x.test/a', method: 'GET', headers: { 'X-A': 'b' }, throw: false });
  });

  it('非 2xx → ok:false（HTTP 错误状态不 reject，交 ok 判定）', async () => {
    vi.mocked(requestUrl).mockResolvedValue({ status: 412, text: 'blocked' } as any);
    const resp = await requestUrlAsFetch()('https://x.test/b');
    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(412);
  });
});
