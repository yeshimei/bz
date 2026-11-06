/**
 * clipbook：RSSHub 实例换址与写盘结果回传（用户反馈「订阅了 RSS 却看不到」的两条根因）。
 *
 * - remapRssFeedInstance：路由型订阅在订阅时按旧实例拼死地址，改「RSSHub 实例」时必须
 *   同一次写里把 origin 指向旧实例的订阅重拼到新实例，否则用户换自建实例等于没换；
 * - writeRsshubInstance：返回 { ok, remapped }——调用方据此提示成功/失败与重拼条数；
 * - writeNewsDataMerged：F8 放弃写时返回 false，不再让设置项静默假成功。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  getNewsFilePath,
  readNewsData,
  remapRssFeedInstance,
  writeNewsDataMerged,
  type RssFeed,
} from '../../src/clipbook/news-data';
import { writeRsshubInstance } from '../../src/clipbook/news-source-settings';

const DEFAULT_INST = 'https://rsshub.rssforever.com';

function seedVault(raw: string): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), raw);
  setApp(mockAppWithVault(vault));
  return vault;
}

function seedNews(feeds: RssFeed[], instance?: string): MockVault {
  return seedVault(JSON.stringify({
    articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: feeds,
    ...(instance ? { rsshubInstance: instance } : {}),
  }));
}

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', newsRetentionUnsavedDays: '30', articleDirectory: '归档/网页剪藏' }) as any);
  seedVault('{}');
});

describe('remapRssFeedInstance（纯函数）', () => {
  it('只改 origin 命中旧实例的订阅：路由路径与查询串原样保留', () => {
    const feeds: RssFeed[] = [
      { url: `${DEFAULT_INST}/sspai/matrix`, title: '少数派' },
      { url: `${DEFAULT_INST}/bilibili/user/video/2267573?limit=10`, title: 'UP' },
      { url: 'https://daily.juya.uk/rss.xml', title: '自备地址' },
    ];
    const r = remapRssFeedInstance(feeds, DEFAULT_INST, 'https://my.rsshub.example');
    expect(r.changed).toBe(2);
    expect(r.feeds.map((f) => f.url)).toEqual([
      'https://my.rsshub.example/sspai/matrix',
      'https://my.rsshub.example/bilibili/user/video/2267573?limit=10',
      'https://daily.juya.uk/rss.xml',
    ]);
    expect(r.feeds[0].title).toBe('少数派'); // 标题不动
  });

  it('旧实例本身是 http、换成 https 同 host：照 origin 命中，一并跟随', () => {
    const feeds: RssFeed[] = [{ url: 'http://rsshub.rssforever.com/sspai/matrix' }];
    const r = remapRssFeedInstance(feeds, 'http://rsshub.rssforever.com', 'https://rsshub.rssforever.com');
    expect(r.changed).toBe(1);
    expect(r.feeds[0].url).toBe('https://rsshub.rssforever.com/sspai/matrix');
  });

  it('新旧实例相同 / 非法地址 → 一条不改', () => {
    const feeds: RssFeed[] = [{ url: `${DEFAULT_INST}/a/b` }];
    expect(remapRssFeedInstance(feeds, DEFAULT_INST, DEFAULT_INST).changed).toBe(0);
    expect(remapRssFeedInstance(feeds, 'not a url', 'https://x.example').changed).toBe(0);
    expect(remapRssFeedInstance(undefined as unknown as RssFeed[], DEFAULT_INST, 'https://x.example').changed).toBe(0);
  });

  it('其他实例的地址一个字都不动（用户自建两套实例时互不串台）', () => {
    const feeds: RssFeed[] = [{ url: 'https://other.example:8080/feed/a' }];
    const r = remapRssFeedInstance(feeds, DEFAULT_INST, 'https://my.rsshub.example');
    expect(r.changed).toBe(0);
    expect(r.feeds).toBe(feeds); // 无改动复用原数组（调用方可据此跳过写声明）
  });
});

describe('writeRsshubInstance（落盘 + 重拼）', () => {
  it('改实例：rsshubInstance 归一落盘，命中旧实例的订阅同一次写里重拼', async () => {
    const vault = seedNews([
      { url: `${DEFAULT_INST}/sspai/matrix`, title: '少数派' },
      { url: 'https://daily.juya.uk/rss.xml', title: '自备' },
    ], DEFAULT_INST);

    const r = await writeRsshubInstance('my.rsshub.example/');
    expect(r).toEqual({ ok: true, remapped: 1 });

    const res = await readNewsData();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.rsshubInstance).toBe('https://my.rsshub.example');
    expect(res.data.rssFeeds).toEqual([
      { url: 'https://my.rsshub.example/sspai/matrix', title: '少数派' },
      { url: 'https://daily.juya.uk/rss.xml', title: '自备' },
    ]);
    expect(vault.files.get(getNewsFilePath())).toContain('my.rsshub.example');
  });

  it('实例未变：remapped 0，订阅列表原样', async () => {
    seedNews([{ url: `${DEFAULT_INST}/sspai/matrix`, title: '少数派' }], DEFAULT_INST);
    const r = await writeRsshubInstance(DEFAULT_INST);
    expect(r).toEqual({ ok: true, remapped: 0 });
    const res = await readNewsData();
    expect(res.ok && res.data.rssFeeds[0].url).toBe(`${DEFAULT_INST}/sspai/matrix`);
  });

  it('news.json 损坏：ok=false（不清盘、不假成功）', async () => {
    const broken = '{"articles": [ 坏 JSON';
    const vault = seedVault(broken);
    const r = await writeRsshubInstance('https://my.rsshub.example');
    expect(r).toEqual({ ok: false, remapped: 0 });
    expect(vault.files.get(getNewsFilePath())).toBe(broken); // F8：原文件保留，没被空库覆盖
  });
});

describe('writeNewsDataMerged 写盘结果（C4 假成功收口）', () => {
  it('正常库 → true；损坏库 → false 且原文件保留', async () => {
    seedNews([]);
    expect(await writeNewsDataMerged({ set: { fetchIntervalMin: 60 } })).toBe(true);

    const broken = '{"articles": [ 坏 JSON';
    const vault = seedVault(broken);
    expect(await writeNewsDataMerged({ set: { fetchIntervalMin: 120 } })).toBe(false);
    expect(vault.files.get(getNewsFilePath())).toBe(broken); // F8：不清盘保原文件
  });
});
