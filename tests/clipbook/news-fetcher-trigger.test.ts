/**
 * clipbook 聚合讯插件内抓取触发链（issue 302 / ADR-0128）：
 * - maybeFetchNews：间隔判定（lastFetchAt + fetchIntervalMin，不足静默跳过）；
 * - fetchNowNews：忽略间隔立即抓；抓取期互斥（running 标记）；
 * - 完成回调 setNewsFetchDoneListener：抓到文章通知（index.ts 接 reloadIfOpen）。
 * fake store + fake httpGet，不走真实网络。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { maybeFetchNews, fetchNowNews, setNewsFetchDoneListener, type FetchStoreDeps, type FetchDiskState } from '../../src/clipbook/news-fetcher';

function fakeDisk(over: Partial<FetchDiskState> = {}): FetchDiskState {
  return {
    articles: [], sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
    bilibiliUps: [], bilibiliMaxItems: 10, bilibiliCookie: '', bilibiliUpInfo: {},
    rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30, ...over,
  };
}

function makeStore(disk: FetchDiskState, written: Array<Record<string, unknown>> = []): FetchStoreDeps {
  let cur = disk;
  return {
    read: async () => ({ ...cur, articles: [...cur.articles] }),
    write: async (set) => {
      written.push({ ...set });
      cur = { ...cur, ...set } as FetchDiskState;
    },
  };
}

const okHttpGet = async () => '';

beforeEach(() => {
  resetObsidianMocks();
  setNewsFetchDoneListener(() => {});
});

describe('maybeFetchNews 间隔判定', () => {
  it('距上次抓取不足间隔：静默跳过（零请求、零写盘）', async () => {
    const written: Array<Record<string, unknown>> = [];
    const store = makeStore(fakeDisk({ lastFetchAt: Date.now() - 10 * 60 * 1000, fetchIntervalMin: 30 }), written);
    const r = await maybeFetchNews({ httpGet: okHttpGet, store });
    expect(r).toBeNull();
    expect(written.length).toBe(0);
  });

  it('超过间隔（或从未抓过）：执行一轮并落 lastFetchAt', async () => {
    const written: Array<Record<string, unknown>> = [];
    const store = makeStore(fakeDisk({ lastFetchAt: 0 }), written);
    let calls = 0;
    const r = await maybeFetchNews({ httpGet: async () => { calls++; return ''; }, store, now: () => 10_000_000 });
    expect(r).not.toBeNull();
    expect(calls).toBeGreaterThan(0);
    expect(written.length).toBe(1);
    expect(written[0].lastFetchAt).toBe(10_000_000);
  });

  it('档位生效：60 分钟档下 30 分钟前抓过 → 跳过', async () => {
    const store = makeStore(fakeDisk({ lastFetchAt: Date.now() - 40 * 60 * 1000, fetchIntervalMin: 60 }));
    const r = await maybeFetchNews({ httpGet: okHttpGet, store });
    expect(r).toBeNull();
  });
});

describe('fetchNowNews 手动触发与互斥', () => {
  it('忽略间隔：刚抓过也立即再抓一轮', async () => {
    const written: Array<Record<string, unknown>> = [];
    const store = makeStore(fakeDisk({ lastFetchAt: Date.now() }), written);
    const r = await fetchNowNews({ httpGet: okHttpGet, store, now: () => 2_000_000 });
    expect(r).not.toBeNull();
    expect(written[0].lastFetchAt).toBe(2_000_000);
  });

  it('抓取进行中：后到的触发返回 null 不重入', async () => {
    const written: Array<Record<string, unknown>> = [];
    const store = makeStore(fakeDisk(), written);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slowHttpGet = async () => { await gate; return ''; };
    const first = fetchNowNews({ httpGet: slowHttpGet, store });
    // 轮内：手动与自动都拿不到执行权
    expect(await fetchNowNews({ httpGet: okHttpGet, store })).toBeNull();
    expect(await maybeFetchNews({ httpGet: okHttpGet, store, now: () => 0 })).toBeNull();
    release();
    const r = await first;
    expect(r).not.toBeNull();
    expect(written.length).toBe(1);
  });
});

describe('完成回调 setNewsFetchDoneListener', () => {
  it('抓取完成后带结果回调（面板开着刷新未读流的接线点）', async () => {
    const results: unknown[] = [];
    setNewsFetchDoneListener((r) => results.push(r));
    const store = makeStore(fakeDisk());
    await fetchNowNews({ httpGet: okHttpGet, store, now: () => 3_000_000 });
    expect(results.length).toBe(1);
    expect((results[0] as { added: number }).added).toBe(0);
  });
});
