// @vitest-environment node
/**
 * clipbook 数据层：RSS 订阅段（ADR-0121）——rssFeeds 容错解析、url 归一、feed 标题提取、
 * sources.rss 默认开、merge 写回只声明 rssFeeds 段（插件写守护读契约）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import {
  parseRssFeeds, normalizeRssFeedUrl, extractFeedTitleFromXml, parseNewsFileContent,
  readNewsData, writeNewsDataMerged, getNewsFilePath,
} from '../../src/clipbook/news-data';
import { addRssFeed, removeRssFeed, readDataSourceState } from '../../src/clipbook/news-source-settings';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
});

describe('clipbook/news-data RSS 段（ADR-0121）', () => {
  it('parseRssFeeds：非数组 → []；条目须含 url；title 去空白可缺省', () => {
    expect(parseRssFeeds(null)).toEqual([]);
    expect(parseRssFeeds('x')).toEqual([]);
    expect(parseRssFeeds([{ url: ' https://a.com/rss.xml ', title: ' 名 ' }, { url: '' }, 'junk', null]))
      .toEqual([{ url: 'https://a.com/rss.xml', title: '名' }]);
  });

  it('normalizeRssFeedUrl：仅收 http/https 非空白串', () => {
    expect(normalizeRssFeedUrl(' https://daily.juya.uk/rss.xml ')).toBe('https://daily.juya.uk/rss.xml');
    expect(normalizeRssFeedUrl('http://a.com/f.xml')).toBe('http://a.com/f.xml');
    expect(normalizeRssFeedUrl('ftp://a.com')).toBeNull();
    expect(normalizeRssFeedUrl('not a url')).toBeNull();
    expect(normalizeRssFeedUrl('')).toBeNull();
  });

  it('extractFeedTitleFromXml：RSS title / CDATA / 实体 / Atom，无 title → null', () => {
    expect(extractFeedTitleFromXml('<rss><channel><title>橘鸦AI早报</title></channel></rss>')).toBe('橘鸦AI早报');
    expect(extractFeedTitleFromXml('<rss><channel><title><![CDATA[橘鸦 & AI]]></title></channel></rss>')).toBe('橘鸦 & AI');
    expect(extractFeedTitleFromXml('<feed><title>A&amp;B</title></feed>')).toBe('A&B');
    expect(extractFeedTitleFromXml('<rss><channel/></rss>')).toBeNull();
    expect(extractFeedTitleFromXml('')).toBeNull();
  });

  it('parseNewsFileContent：sources.rss 默认开、rssFeeds 归一；briefs/briefUps 残留键忽略（零兼容）', () => {
    const d = parseNewsFileContent(JSON.stringify({
      articles: [], stats: {}, sources: { zhihu: true },
      rssFeeds: [{ url: 'https://a.com/rss.xml', title: 'A' }, { title: 'no-url' }],
      briefs: [{ bvid: 'BV1' }], briefUps: ['123'],
    }))!;
    expect(d.sources.rss).toBe(true);
    expect(d.sources.zhihu).toBe(true);
    expect(d.rssFeeds).toEqual([{ url: 'https://a.com/rss.xml', title: 'A' }]);
    expect((d as any).briefs).toBeUndefined();
    expect((d as any).briefUps).toBeUndefined();
    const d2 = parseNewsFileContent('{}')!;
    expect(d2.sources.rss).toBe(true);
    expect(d2.rssFeeds).toEqual([]);
  });

  it('writeNewsDataMerged：只声明 rssFeeds 段，其余段取磁盘现值', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [{ url: 'u1', title: 't' }],
      stats: { totalRead: 3, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: ['42'],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: 'ck',
      sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
      rssFeeds: [],
    }));
    setApp(mockAppWithVault(vault));
    await writeNewsDataMerged({ set: { rssFeeds: [{ url: 'https://a.com/rss.xml', title: '橘鸦AI早报' }] } });
    const disk = JSON.parse(vault.files.get(getNewsFilePath())!);
    expect(disk.rssFeeds).toEqual([{ url: 'https://a.com/rss.xml', title: '橘鸦AI早报' }]);
    expect(disk.bilibiliUps).toEqual(['42']);
    expect(disk.bilibiliCookie).toBe('ck');
    expect(disk.stats.totalRead).toBe(3);
  });
});

describe('clipbook/news-source-settings RSS 增删（ADR-0121）', () => {
  it('addRssFeed：非法 url → false；新增去重；title 可缺省', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({ articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: {}, rssFeeds: [] }));
    setApp(mockAppWithVault(vault));
    expect(await addRssFeed('not-a-url')).toBe(false);
    expect(await addRssFeed('https://daily.juya.uk/rss.xml', '橘鸦AI早报')).toBe(true);
    expect(await addRssFeed(' https://daily.juya.uk/rss.xml ', '橘鸦AI早报')).toBe(false); // 归一后去重
    expect(await addRssFeed('https://b.com/rss.xml')).toBe(true);
    const st = await readDataSourceState();
    expect(st.rssFeeds).toEqual([
      { url: 'https://daily.juya.uk/rss.xml', title: '橘鸦AI早报' },
      { url: 'https://b.com/rss.xml' },
    ]);
  });

  it('removeRssFeed：按 url 移除，未命中静默', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: {},
      rssFeeds: [{ url: 'https://a.com/rss.xml', title: 'A' }],
    }));
    setApp(mockAppWithVault(vault));
    await removeRssFeed('https://a.com/rss.xml');
    await removeRssFeed('https://ghost.com/rss.xml');
    const res = await readNewsData();
    expect(res.data.rssFeeds).toEqual([]);
  });
});
