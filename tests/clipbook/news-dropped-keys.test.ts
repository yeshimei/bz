// @vitest-environment jsdom
/**
 * 删掉的资讯条目不再被下一次抓取拉回来（fb-20261126-qqg-01）。
 *
 * 旧实现的洞：抓取判「哪些是新文章」只拿磁盘现存 articles 做对照（existingUrls /
 * existingTitles）。用户删除后磁盘上没有这行，下一轮抓取就把源里同一篇当成新文章
 * 重新声明、落盘，还带 read=false 重新变未读——删除只对当次有效。
 *
 * 修法：news.json 增加 droppedKeys 段（articleKeyOf 口径），用户主动删除时写入、
 * 撤销删除时撤出；抓取入库前先按名单过滤。保留策略的自动清理不进名单（那不是用户意图，
 * 过几天重新抓到无妨）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  getNewsFilePath,
  readNewsData,
  writeNewsDataMerged,
  normalizeDroppedKeys,
  parseNewsFileContent,
  DROPPED_KEYS_LIMIT,
  emptyData,
} from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowDeleteNews, flowUndoDeleteNews } from '../../src/clipbook/flow';
import { runNewsFetchRound, defaultFetchStore, type HttpGet } from '../../src/clipbook/news-fetcher';
import { articleKeyOf } from '../../src/clipbook/constants';

vi.mock('../../src/knowledge', () => ({ openKnowledgeAddTask: vi.fn() }));

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
});

function seedVault(vault: MockVault, data: Record<string, unknown>): void {
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles: [],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: false, guokr: false, bilibili: false, rss: true },
      rssFeeds: [],
      ...data,
    })
  );
  setApp(mockAppWithVault(vault));
}

const disk = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

describe('normalizeDroppedKeys（纯函数：名单归一 + 上限）', () => {
  it('非数组 / 空 → 空名单', () => {
    expect(normalizeDroppedKeys(undefined)).toEqual([]);
    expect(normalizeDroppedKeys(null)).toEqual([]);
    expect(normalizeDroppedKeys({ a: 1 })).toEqual([]);
    expect(normalizeDroppedKeys('url:x')).toEqual([]);
    expect(normalizeDroppedKeys([])).toEqual([]);
  });

  it('过滤非字符串与空串、去空白、保序去重', () => {
    expect(normalizeDroppedKeys(['url:a', ' url:b ', '', '   ', 42, null, { x: 1 }, 'url:a', 'url:c']))
      .toEqual(['url:a', 'url:b', 'url:c']);
  });

  it('超过上限按 FIFO 保留最后一批（老的先出，防名单无限长）', () => {
    const many = Array.from({ length: DROPPED_KEYS_LIMIT + 5 }, (_, i) => `url:https://a.example/${i}`);
    const out = normalizeDroppedKeys(many);
    expect(out.length).toBe(DROPPED_KEYS_LIMIT);
    expect(out[0]).toBe(`url:https://a.example/5`); // 前 5 条被挤掉
    expect(out[out.length - 1]).toBe(`url:https://a.example/${DROPPED_KEYS_LIMIT + 4}`);
  });
});

describe('news.json 段结构与解析', () => {
  it('emptyData 带空 droppedKeys（新库直接有这一段）', () => {
    expect(emptyData().droppedKeys).toEqual([]);
  });

  it('parseNewsFileContent 归一 droppedKeys；缺失或坏形状回退空数组', () => {
    expect(parseNewsFileContent(JSON.stringify({ droppedKeys: ['url:a', 'url:a', ' url:b ', 7] }))!.droppedKeys)
      .toEqual(['url:a', 'url:b']);
    expect(parseNewsFileContent(JSON.stringify({ articles: [] }))!.droppedKeys).toEqual([]);
    expect(parseNewsFileContent(JSON.stringify({ droppedKeys: 'nope' }))!.droppedKeys).toEqual([]);
    // 旧纯数组形态（wrapArrayToNewsData 迁移）同样补空段
    expect(parseNewsFileContent(JSON.stringify([]))!.droppedKeys).toEqual([]);
  });
});

describe('writeNewsDataMerged 维护名单（drop / restore 意图）', () => {
  it('dropArticleKeys 并入名单并落盘，其余段不动', async () => {
    const vault = new MockVault();
    seedVault(vault, { articles: [{ platform: 'RSS', title: 'A', url: 'https://a.example/1' }] });
    await writeNewsDataMerged({ set: {}, dropArticleKeys: ['url:https://a.example/1'] });
    const d = disk(vault);
    expect(d.droppedKeys).toEqual(['url:https://a.example/1']);
    expect(d.articles.length).toBe(1); // 名单只管抓取过滤，本次不负责删条目
  });

  it('restoreArticleKeys 从名单撤出（撤销删除）', async () => {
    const vault = new MockVault();
    seedVault(vault, { droppedKeys: ['url:https://a.example/1', 'url:https://a.example/2'] });
    await writeNewsDataMerged({ set: {}, restoreArticleKeys: ['url:https://a.example/1'] });
    expect(disk(vault).droppedKeys).toEqual(['url:https://a.example/2']);
  });

  it('同批 drop + restore 同一 key：以 restore 为准（撤销后又删除的中间态不留）', async () => {
    const vault = new MockVault();
    seedVault(vault, {});
    await writeNewsDataMerged({
      set: {},
      dropArticleKeys: ['url:https://a.example/1'],
      restoreArticleKeys: ['url:https://a.example/1'],
    });
    expect(disk(vault).droppedKeys).toEqual([]);
  });

  it('未声明 drop/restore 时不整段覆盖名单（并发写不互相吞）', async () => {
    const vault = new MockVault();
    seedVault(vault, { droppedKeys: ['url:https://a.example/keep'] });
    await writeNewsDataMerged({ set: { articles: [{ platform: 'RSS', title: 'x', url: 'https://a.example/x' }] } });
    expect(disk(vault).droppedKeys).toEqual(['url:https://a.example/keep']);
  });

  it('写入时名单超上限仍按 FIFO 收敛', async () => {
    const vault = new MockVault();
    const many = Array.from({ length: DROPPED_KEYS_LIMIT }, (_, i) => `url:https://a.example/${i}`);
    seedVault(vault, { droppedKeys: many });
    await writeNewsDataMerged({ set: {}, dropArticleKeys: ['url:https://a.example/new'] });
    const out = disk(vault).droppedKeys;
    expect(out.length).toBe(DROPPED_KEYS_LIMIT);
    expect(out[0]).toBe('url:https://a.example/1');
    expect(out[out.length - 1]).toBe('url:https://a.example/new');
  });
});

describe('runNewsFetchRound 按名单过滤（本轮回归核心）', () => {
  const rssXml = `<rss><channel><title>测试源</title>
    <item><title>已删文章</title><link>https://a.example/dropped</link><pubDate>Sun, 26 Nov 2026 06:00:00 GMT</pubDate></item>
    <item><title>正常文章</title><link>https://a.example/keep</link><pubDate>Sun, 26 Nov 2026 06:00:00 GMT</pubDate></item>
  </channel></rss>`;

  const httpGet: HttpGet = async (url) => (url.endsWith('.xml') ? rssXml : null);

  it('清单里的条目即使在源里还挂着，也不再被声明为新增（不复活、不重新变未读）', async () => {
    const vault = new MockVault();
    seedVault(vault, {
      rssFeeds: [{ url: 'https://a.example/rss.xml' }],
      droppedKeys: ['url:https://a.example/dropped'],
    });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => Date.parse('2026-11-26T12:00:00+08:00') });
    expect(r.added).toBe(1);
    const urls = disk(vault).articles.map((a: any) => a.url);
    expect(urls).toEqual(['https://a.example/keep']);
  });

  it('撤销后（名单已撤出）同一条能重新抓到——名单是唯一开关', async () => {
    const vault = new MockVault();
    seedVault(vault, { rssFeeds: [{ url: 'https://a.example/rss.xml' }] });
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => Date.parse('2026-11-26T12:00:00+08:00') });
    expect(r.added).toBe(2);
    expect(disk(vault).articles.map((a: any) => a.url).sort())
      .toEqual(['https://a.example/dropped', 'https://a.example/keep']);
  });
});

describe('flow 删除 / 撤销与名单联动', () => {
  const article = { platform: 'RSS', title: '不想看', url: 'https://a.example/nope', date: '2026-11-26 08:00:00' };

  it('flowDeleteNews：条目从 articles 消失，同时进 droppedKeys（挡下一次抓取）', async () => {
    const vault = new MockVault();
    seedVault(vault, { articles: [article, { platform: 'RSS', title: '留着', url: 'https://a.example/keep' }] });
    await flowDeleteNews({ raw: { ...article } });
    await drainNewsWritesForTests();
    const d = disk(vault);
    expect(d.articles.map((a: any) => a.url)).toEqual(['https://a.example/keep']);
    expect(d.droppedKeys).toEqual([articleKeyOf(article)]);
  });

  it('flowUndoDeleteNews：条目插回 articles，同时从 droppedKeys 撤出', async () => {
    const vault = new MockVault();
    seedVault(vault, { articles: [], droppedKeys: [articleKeyOf(article)] });
    await flowUndoDeleteNews({ ...article });
    await drainNewsWritesForTests();
    const d = disk(vault);
    expect(d.articles.map((a: any) => a.url)).toEqual(['https://a.example/nope']);
    expect(d.droppedKeys).toEqual([]);
  });
});
