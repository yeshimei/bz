import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import {
  bookHitToSearchHit,
  readerBooksApi,
  searchSharedBooks,
  sharedBookStats,
  type ReaderBookAiApi,
} from '../../src/secondbrain/reader-books';

function appWith(api: unknown): App {
  return {
    plugins: {
      getPlugin: (id: string) => (id === 'bz-reader' ? { bookAi: api } : null),
    },
  } as unknown as App;
}

const api = (over: Partial<ReaderBookAiApi> = {}): ReaderBookAiApi => ({
  isShared: () => true,
  stats: async () => ({ books: 2, blocks: 30, chars: 900, lastAt: 1, models: ['m'] }),
  search: async () => [
    { bookId: 'b1', title: '心流', chapter: '第一章', chunk: '注意力', score: 0.8 },
  ],
  ...over,
});

/**
 * 共享开关是唯一闸门。
 *
 * 关着的时候第二大脑不该出现任何书籍痕迹——统计不显示、检索也搜不到，
 * 像这个阅读器没装一样；开着才把书并进来。
 */
describe('书籍门面探测', () => {
  it('没装 / 没有门面 / 门面缺函数，都当不可用', () => {
    expect(readerBooksApi(null)).toBe(null);
    expect(readerBooksApi({} as App)).toBe(null);
    expect(readerBooksApi(appWith(undefined))).toBe(null);
    expect(readerBooksApi(appWith({ isShared: () => true }))).toBe(null);
  });

  it('三个函数齐了才算可用', () => {
    expect(readerBooksApi(appWith(api()))).not.toBe(null);
  });
});

describe('统计只在共享打开时给', () => {
  it('关着 → null（界面据此整段不显示）', async () => {
    expect(await sharedBookStats(appWith(api({ isShared: () => false })))).toBe(null);
  });

  it('开着 → 数字原样给出', async () => {
    const s = await sharedBookStats(appWith(api()));
    expect(s).toMatchObject({ books: 2, blocks: 30 });
  });

  it('一本都没有 → null（不显示「0 本书」这种空话）', async () => {
    const empty = api({ stats: async () => ({ books: 0, blocks: 0, chars: 0, lastAt: null, models: [] }) });
    expect(await sharedBookStats(appWith(empty))).toBe(null);
  });

  it('门面抛错 → null，不把第二大脑拖垮', async () => {
    const boom = api({
      stats: async () => {
        throw new Error('x');
      },
    });
    expect(await sharedBookStats(appWith(boom))).toBe(null);
  });
});

describe('检索只在共享打开时给', () => {
  it('关着 → 空数组', async () => {
    expect(await searchSharedBooks(appWith(api({ isShared: () => false })), '注意力')).toEqual([]);
  });

  it('开着 → 命中原样返回', async () => {
    const hits = await searchSharedBooks(appWith(api()), '注意力', 3);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ bookId: 'b1', chunk: '注意力' });
  });

  it('空问题不发请求', async () => {
    let called = 0;
    const spy = api({
      search: async () => {
        called += 1;
        return [];
      },
    });
    expect(await searchSharedBooks(appWith(spy), '   ')).toEqual([]);
    expect(called).toBe(0);
  });

  it('门面抛错 → 空数组（笔记那边照常回答）', async () => {
    const boom = api({
      search: async () => {
        throw new Error('x');
      },
    });
    expect(await searchSharedBooks(appWith(boom), '注意力')).toEqual([]);
  });

  /* 外部插件的实现不可控：卡住的检索不能把整轮问答一起挂死（2026-11-07 发版 review #2） */
  it('门面永不返回 → 到点收敛成空数组', async () => {
    const stuck = api({ search: () => new Promise(() => {}) });
    const t0 = Date.now();
    expect(await searchSharedBooks(appWith(stuck), '注意力', 3, { timeoutMs: 30 })).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('调用方取消 → 立刻收敛成空数组', async () => {
    const stuck = api({ search: () => new Promise(() => {}) });
    const ac = new AbortController();
    const p = searchSharedBooks(appWith(stuck), '注意力', 3, { signal: ac.signal });
    ac.abort();
    expect(await p).toEqual([]);
  });

  it('已取消的调用方 → 一个请求都不发', async () => {
    let called = 0;
    const spy = api({
      search: async () => {
        called += 1;
        return [];
      },
    });
    const ac = new AbortController();
    ac.abort();
    expect(await searchSharedBooks(appWith(spy), '注意力', 3, { signal: ac.signal })).toEqual([]);
    expect(called).toBe(0);
  });
});

describe('书的结果 → 检索结果', () => {
  it('来源名写成「《书名》· 章」，不伪造 .md 路径', () => {
    const hit = bookHitToSearchHit({ bookId: 'b1', title: '心流', chapter: '第一章', chunk: 'x', score: 0.5 });
    expect(hit.path).toBe('《心流》 · 第一章');
    expect(hit.path.endsWith('.md')).toBe(false);
    expect(hit.bookId).toBe('b1');
  });

  it('章名与书名重复时只写一次', () => {
    const hit = bookHitToSearchHit({ bookId: 'b1', title: '心流', chapter: '心流', chunk: 'x', score: 0.5 });
    expect(hit.path).toBe('《心流》');
  });

  it('没有章名也能看；分数非法按 0 处理', () => {
    const hit = bookHitToSearchHit({ bookId: 'b1', title: '心流', chapter: '', chunk: 'x', score: Number.NaN });
    expect(hit.path).toBe('《心流》');
    expect(hit.score).toBe(0);
  });

  /* 书名里可以有斜杠：展示名走 label，别让下游按路径取 basename 截成半截（2026-11-07 review #4） */
  it('书名带斜杠时展示名不被路径处理截断', () => {
    const hit = bookHitToSearchHit({ bookId: 'b1', title: '人类简史/漫画版', chapter: '第一章', chunk: 'x', score: 0.5 });
    expect(hit.label).toBe('《人类简史/漫画版》 · 第一章');
    expect(hit.path).toBe(hit.label);
  });
});
