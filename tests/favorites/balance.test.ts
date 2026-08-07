/**
 * 收藏本 BalanceService 测试（ticket 11）：findNumberInObject / fetchBalance / 缓存。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BalanceService } from '../../src/favorites/ai';

describe('findNumberInObject', () => {
  let bs: BalanceService;

  beforeEach(() => {
    bs = new BalanceService();
  });

  it('数字直接返回', () => {
    expect(bs.findNumberInObject(42)).toBe(42);
  });

  it('字符串数字解析', () => {
    expect(bs.findNumberInObject('12.5')).toBe(12.5);
    expect(bs.findNumberInObject('abc')).toBeNull();
  });

  it('嵌套对象 + balanceKeys 优先', () => {
    const obj = { data: { balance: '88.8' }, name: 'x' };
    expect(bs.findNumberInObject(obj)).toBe(88.8);
  });

  it('balanceKeys 优先于全字段（amount 在无 balance 时被找到）', () => {
    const obj = { data: { amount: 5, other: 'zzz' } };
    expect(bs.findNumberInObject(obj)).toBe(5);
  });

  it('深度 >5 返回 null', () => {
    let o: any = { a: 1 };
    for (let i = 0; i < 10; i++) o = { next: o };
    expect(bs.findNumberInObject(o)).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(bs.findNumberInObject(null)).toBeNull();
    expect(bs.findNumberInObject(undefined)).toBeNull();
  });
});

describe('fetchBalance', () => {
  let bs: BalanceService;
  const cfg = { apiKeys: 'sk-1\nsk-2', balanceUrl: 'https://api.example.com/user/balance' };

  beforeEach(() => {
    bs = new BalanceService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('成功 → 余额 + timestamp；Authorization 用第一个 key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 66.6 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await bs.fetchBalance(cfg);
    expect(r.balance).toBe('66.6');
    expect(typeof r.timestamp).toBe('number');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(cfg.balanceUrl);
    expect(opts.headers.Authorization).toBe('Bearer sk-1');
    expect(opts.method).toBe('GET');
  });

  it('response.ok=false → HTTP xxx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(bs.fetchBalance(cfg)).rejects.toThrow('HTTP 401');
  });

  it('无数字 → 未找到余额数字', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ msg: 'hello' }) }));
    await expect(bs.fetchBalance(cfg)).rejects.toThrow('未找到余额数字');
  });

  it('配置不完整 → 配置不完整', async () => {
    await expect(bs.fetchBalance({ apiKeys: '', balanceUrl: '' })).rejects.toThrow('配置不完整');
  });

  it('3s 超时信号传入', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
    await bs.fetchBalance(cfg);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});

describe('isCacheValid / fetchAllBalances', () => {
  let bs: BalanceService;

  beforeEach(() => {
    bs = new BalanceService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('5 分钟缓存边界', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(bs.isCacheValid(null)).toBe(false);
    expect(bs.isCacheValid(now - 4 * 60 * 1000)).toBe(true);
    expect(bs.isCacheValid(now - 6 * 60 * 1000)).toBe(false);
  });

  it('fetchAllBalances：缓存命中 / 失败项', async () => {
    const items = [
      { id: 'a', llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://x.com/b' }, balance: '10', balanceCacheTime: Date.now() } as any,
      { id: 'b', llmConfig: { apiKeys: 'sk-2', balanceUrl: 'https://x.com/b' }, balance: null, balanceCacheTime: null } as any,
      { id: 'c', llmConfig: null } as any,
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 3.14 }) }));
    const results = await bs.fetchAllBalances(items);
    expect(results['a']).toEqual({ balance: '10', cached: true });
    expect(results['b'].balance).toBe('3.14');
    expect(results['b'].cached).toBe(false);
    expect(results['c']).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('fetchAllBalances：失败 → error 字段', async () => {
    const items = [
      { id: 'x', llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://x.com/b' }, balance: null, balanceCacheTime: null } as any,
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const results = await bs.fetchAllBalances(items);
    expect(results['x'].error).toBe('HTTP 500');
    expect(results['x'].cached).toBe(false);
    vi.unstubAllGlobals();
  });
});
