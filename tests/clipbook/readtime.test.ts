/**
 * clipbook 阅读时长回写（剪藏成书）：秒数累计 + 折进阅读流水。
 *
 * 阅读器在剪藏本里按章计时，切章 / 关书时把这一篇新增的秒数报给 bz。
 * 这里把它累进侧写的 readSeconds（每篇累计，剪藏本列表展示用），并把
 * 凑满的整分钟追加进 readLog（阅读报告的唯一数据源）。
 *
 * 两段分开的理由：
 * - readSeconds 要精确到秒，剪藏本显示「3 分钟」，差几秒没事，但不能每次上报都丢零头；
 * - readLog 沿用 issue 358 的整分钟形状，报告层（report-stats / press）不用动。
 *
 * readLoggedSeconds 是内部对账：已经折进 readLog 的秒数。没有它的话，
 * 每次上报按「本次秒数」独立取整，快速翻篇的零头会被反复丢掉，报告总时长
 * 会比真实少一截。
 */
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { accrueRead, MAX_READ_BATCH_SECONDS, MAX_SECONDS_KEYS, readSecondsView, type ReadBatch } from '../../src/clipbook/readtime';
import {
  buildExportIndex,
  createClipbookFacade,
  type ClipExportIndex,
  type ClipSummaryResult,
  type ExportBuildInput,
} from '../../src/clipbook/facade';

const empty = () => ({ readSeconds: {} as Record<string, number>, readLoggedSeconds: {} as Record<string, number> });

const batch = (patch: Partial<ReadBatch> = {}): ReadBatch => ({
  key: 'url:https://x.com/a',
  seconds: 60,
  title: '标题A',
  src: '果壳科学人',
  ...patch,
});

describe('accrueRead · 秒数累计', () => {
  it('第一次 60 秒：累计 60，流水出一条 1 分钟', () => {
    const out = accrueRead({ ...empty(), batch: [batch()], ts: 1000 });
    expect(out.readSeconds['url:https://x.com/a']).toBe(60);
    expect(out.readLoggedSeconds['url:https://x.com/a']).toBe(60);
    expect(out.log).toEqual([
      { key: 'url:https://x.com/a', title: '标题A', src: '果壳科学人', minutes: 1, ts: 1000 },
    ]);
  });

  it('30 秒两次：第二次才凑出 1 分钟，两次秒数都不丢', () => {
    const first = accrueRead({ ...empty(), batch: [batch({ seconds: 30 })], ts: 1 });
    expect(first.log).toEqual([]);
    expect(first.readSeconds['url:https://x.com/a']).toBe(30);

    const second = accrueRead({
      readSeconds: first.readSeconds,
      readLoggedSeconds: first.readLoggedSeconds,
      batch: [batch({ seconds: 30 })],
      ts: 2,
    });
    expect(second.readSeconds['url:https://x.com/a']).toBe(60);
    expect(second.log).toEqual([
      { key: 'url:https://x.com/a', title: '标题A', src: '果壳科学人', minutes: 1, ts: 2 },
    ]);
  });

  it('同一批多篇各记各的，互不串账', () => {
    const out = accrueRead({
      ...empty(),
      batch: [batch({ key: 'a', seconds: 120 }), batch({ key: 'b', seconds: 45, title: '', src: '' })],
      ts: 9,
    });
    expect(out.readSeconds).toEqual({ a: 120, b: 45 });
    expect(out.readLoggedSeconds).toEqual({ a: 120 });
    expect(out.log).toEqual([{ key: 'a', title: '标题A', src: '果壳科学人', minutes: 2, ts: 9 }]);
  });

  it('已经入账 60 秒后再来 90 秒：只补 1 分钟，剩 30 秒留着', () => {
    const out = accrueRead({
      readSeconds: { k: 60 },
      readLoggedSeconds: { k: 60 },
      batch: [batch({ key: 'k', seconds: 90 })],
      ts: 5,
    });
    expect(out.readSeconds.k).toBe(150);
    expect(out.readLoggedSeconds.k).toBe(120);
    expect(out.log).toEqual([{ key: 'k', title: '标题A', src: '果壳科学人', minutes: 1, ts: 5 }]);
  });

  it('非法条目忽略：空 key、0、负数、NaN 都不落账', () => {
    const out = accrueRead({
      ...empty(),
      batch: [
        batch({ key: '' }),
        batch({ key: 'z', seconds: 0 }),
        batch({ key: 'y', seconds: -10 }),
        batch({ key: 'n', seconds: Number.NaN }),
      ],
      ts: 1,
    });
    expect(out.readSeconds).toEqual({});
    expect(out.log).toEqual([]);
  });

  it('单次超过上限按上限截断（异常脏数据不把统计撑爆）', () => {
    const out = accrueRead({ ...empty(), batch: [batch({ key: 'k', seconds: 999999 })], ts: 1 });
    expect(out.readSeconds.k).toBe(MAX_READ_BATCH_SECONDS);
  });

  it('秒数取整：小数不进累计', () => {
    const out = accrueRead({ ...empty(), batch: [batch({ key: 'k', seconds: 12.9 })], ts: 1 });
    expect(out.readSeconds.k).toBe(12);
    expect(out.log).toEqual([]);
  });

  it('键数超上限时丢最早插入的，最新读的一定留着（账不会无限膨胀）', () => {
    const readSeconds: Record<string, number> = {};
    const readLoggedSeconds: Record<string, number> = {};
    for (let i = 0; i < MAX_SECONDS_KEYS; i++) readSeconds[`old-${i}`] = 60;
    const out = accrueRead({
      readSeconds,
      readLoggedSeconds,
      batch: [batch({ key: 'newest', seconds: 120 })],
      ts: 1,
    });
    expect(Object.keys(out.readSeconds)).toHaveLength(MAX_SECONDS_KEYS);
    expect(out.readSeconds.newest).toBe(120);
    expect(out.readSeconds['old-0']).toBeUndefined();
    expect(out.readSeconds[`old-${MAX_SECONDS_KEYS - 1}`]).toBe(60);
  });
});

describe('readSecondsView · 旧 readLog 折算进展示', () => {
  const log = (minutes: number, key = 'k') => ({ key, title: '', src: '', minutes, ts: 1 });

  it('只有 readLog 的旧数据：按整分钟折成秒显示', () => {
    expect(readSecondsView({}, [log(6)])).toEqual({ k: 360 });
  });

  it('同篇多条 readLog 相加', () => {
    expect(readSecondsView({}, [log(2), log(3)])).toEqual({ k: 300 });
  });

  it('两段都有时取大，不相加（相加就是翻倍）', () => {
    expect(readSecondsView({ k: 95 }, [log(1)])).toEqual({ k: 95 });
    expect(readSecondsView({ k: 30 }, [log(2)])).toEqual({ k: 120 });
  });

  it('空输入给空对象，不抛错', () => {
    expect(readSecondsView(null, null)).toEqual({});
    expect(readSecondsView(undefined, [])).toEqual({});
  });
});

const feed = (title: string, url: string) => ({ title, url });

const newsArticle = (patch: Record<string, any> = {}) => ({
  url: 'https://x.com/a',
  title: '标题A',
  platform: '果壳科学人',
  author: '果壳',
  date: '2026-09-01 10:00:00',
  fetchedAt: '2026-09-01 09:00:00',
  body: '正文A',
  ...patch,
});

const clipNote = (patch: Record<string, any> = {}) => ({
  path: '归档/网页剪藏/标题A.md',
  file: {},
  url: 'https://x.com/a',
  author: '作者A',
  site: '果壳科学人',
  summary: '摘要A',
  tags: ['tag'],
  title: '标题A',
  created: 1790000000000,
  backlinkNames: [],
  domain: 'x.com',
  ...patch,
});

const input = (patch: Partial<ExportBuildInput> = {}): ExportBuildInput => ({
  articles: [],
  clips: [],
  rssFeeds: [],
  upIds: [],
  upInfo: {},
  sources: { zhihu: false, guokr: false, bilibili: true, rss: true },
  ...patch,
});

describe('buildExportIndex · 每篇累计秒数', () => {
  it('readSeconds 按 key 回填到行上；没有记录的给 0', () => {
    const idx = buildExportIndex(
      input({
        articles: [newsArticle({ url: 'https://x.com/read' }), newsArticle({ url: 'https://x.com/none' })],
        clips: [clipNote({ url: 'https://x.com/clip', path: '剪藏/c.md' })],
        readSeconds: { 'url:https://x.com/read': 185, 'clip:剪藏/c.md': 61 },
      }),
    );
    const byUrl = new Map(idx.rows.map((r) => [r.url, r.seconds]));
    expect(byUrl.get('https://x.com/read')).toBe(185);
    expect(byUrl.get('https://x.com/none')).toBe(0);
    expect(byUrl.get('https://x.com/clip')).toBe(61);
  });
});

describe('createClipbookFacade · recordRead', () => {
  const makeFacade = (idx: ClipExportIndex) => {
    const recordRead = vi.fn(async (entries: ReadBatch[]) => entries.length);
    const facade = createClipbookFacade({
      readIndex: async () => idx,
      readNote: async () => '',
      readNewsBody: async () => '',
      markRead: vi.fn(async (raws: any[]) => raws.length),
      save: vi.fn(async () => ({ ok: true })),
      summarize: vi.fn(async (): Promise<ClipSummaryResult> => ({ ok: true, summary: 'x' })),
      recordRead,
      isFolderReady: () => true,
      dataVersion: async () => 'v1',
      open: vi.fn(),
    });
    return { facade, recordRead };
  };

  it('过滤明显非法的条目再交给实现方，返回真正写回的篇数', async () => {
    const idx = buildExportIndex(input({ articles: [newsArticle()] }));
    const { facade, recordRead } = makeFacade(idx);
    const n = await facade.recordRead([
      { key: 'url:https://x.com/a', seconds: 90, title: '标题A', src: '果壳科学人' },
      { key: '', seconds: 60 },
      { key: 'k', seconds: 0 },
      { key: 'k2', seconds: -3 },
    ]);
    expect(n).toBe(1);
    expect(recordRead).toHaveBeenCalledTimes(1);
    expect(recordRead.mock.calls[0][0]).toEqual([
      { key: 'url:https://x.com/a', seconds: 90, title: '标题A', src: '果壳科学人' },
    ]);
  });

  it('空批次直接返回 0，不碰盘', async () => {
    const idx = buildExportIndex(input({}));
    const { facade, recordRead } = makeFacade(idx);
    expect(await facade.recordRead([])).toBe(0);
    expect(recordRead).not.toHaveBeenCalled();
  });
});
