// @vitest-environment jsdom
/**
 * clipbook 左栏：订阅了却没抓到文章的源（用户反馈两个 bug 的回归）。
 *
 * ① 站点行是从抓回来的文章倒推的——订阅成功但一条没抓回来（公共 RSSHub 实例限流最常见），
 *    左栏根本没有这个源，界面上看不出「订阅过什么」。现按订阅列表补 0/0 行，抓回来后并成一行。
 * ② 点 0/0 的源（剪藏本空着时最容易）会触发整块并栏，左栏一起收走：切不回别的源，
 *    看起来像整本被清空。现只有「整本真的一无所有」才并栏。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { showPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import type { RssFeed } from '../../src/clipbook/news-data';
import { ago } from '../helpers/date';

const FEED: RssFeed = { url: 'https://rsshub.rssforever.com/sspai/matrix', title: '少数派' };

const GUOKR = {
  platform: '果壳科学人',
  title: '果壳文章一',
  url: 'https://guokr.com/1',
  author: '果壳',
  date: ago(0, '08:00:00'),
  fetchedAt: ago(0, '07:00:00'),
  body: '正文一',
};

function seed(feeds: RssFeed[] = [], articles: any[] = []): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles,
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
    rssFeeds: feeds,
    // 顶到未来：openClipbook 的 maybeFetchNews 间隔判定直接跳过（测试不触网）
    lastFetchAt: Date.now() + 24 * 60 * 60 * 1000,
    fetchIntervalMin: 360,
  }));
  return vault;
}

async function openPanel(feeds: RssFeed[] = [], articles: any[] = []): Promise<void> {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', newsRetentionUnsavedDays: '30' } as any));
  const vault = seed(feeds, articles);
  setApp(mockAppWithVault(vault));
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  // 装载完成（rail 出行为准）后再断言：首开先渲染装载骨架，装载完才 renderAll
  await vi.waitFor(() => expect(document.querySelectorAll('.bz-rail-item').length).toBeGreaterThan(0));
  await vi.waitFor(() => expect(M.articles.length).toBe(articles.length));
  await vi.waitFor(() => expect(M.rssFeeds.length).toBe(feeds.length));
}

const railRows = (): HTMLElement[] => [...document.querySelectorAll('.bz-rail-item')] as HTMLElement[];
const railRow = (label: string): HTMLElement => railRows().find((r) => r.textContent!.includes(label)) as HTMLElement;
const deskBody = (): HTMLElement => document.querySelector('.bz-clip-desk-body') as HTMLElement;
const listText = (): string => (document.querySelector('[data-clip-list]') as HTMLElement | null)?.textContent || '';

beforeEach(() => { document.body.innerHTML = ''; });

describe('左栏订阅补行', () => {
  it('已订阅、一篇没抓回来：左栏有 0/0 行（不是凭空消失）', async () => {
    await openPanel([FEED], [GUOKR]);
    const row = railRow('少数派');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('0/0');
  });

  it('抓回来之后与站点行并成一行（不出现两条同源）', async () => {
    const rssArticle = {
      platform: '少数派', title: '少数派文章', url: 'https://sspai.com/post/1',
      author: '少数派', date: ago(0, '09:00:00'), fetchedAt: ago(0, '09:00:00'), body: '正文',
    };
    await openPanel([FEED], [GUOKR, rssArticle]);
    const rows = railRows().filter((r) => r.textContent!.includes('少数派'));
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('1/1');
  });
});

describe('空源不再整块并栏', () => {
  it('点 0/0 的订阅源：三栏留着，中栏说明「已订阅、还没抓到」并给出地址', async () => {
    await openPanel([FEED], [GUOKR]);
    railRow('少数派').click();
    expect(deskBody().classList.contains('is-void')).toBe(false);
    expect(railRows().length).toBeGreaterThan(0); // 左栏还在，能切回别的源
    expect(listText()).toContain('已订阅，还没抓到文章');
    expect(listText()).toContain(FEED.url);
  });

  it('点 0/0 的剪藏本：书里有 news 时不并栏（旧实现整块收走）', async () => {
    await openPanel([], [GUOKR]);
    railRow('剪藏本').click();
    expect(deskBody().classList.contains('is-void')).toBe(false);
    expect(listText()).toContain('剪藏本为空');
  });

  it('整本真的一无所有才并栏（没 news、没剪藏、没订阅）', async () => {
    await openPanel([], []);
    expect(deskBody().classList.contains('is-void')).toBe(true);
  });
});

describe('会话开头不继承空壳源', () => {
  it('上次停在的站点已经不存在 → 打开面板自动回「全部未读」', async () => {
    await openPanel([FEED], [GUOKR]);
    // 模拟「停在某站点，之后这个源没了」：直接改内存选中态再重开面板
    M.sel = { kind: 'site', platform: '', up: null, site: '早就删掉的源' };
    showPanel();
    expect(M.sel.kind).toBe('all');
  });

  it('会话内点进 0/0 的订阅源不会被弹回（空态要能看到说明）', async () => {
    await openPanel([FEED], [GUOKR]);
    railRow('少数派').click();
    expect(M.sel.kind).toBe('site');
    expect(M.sel.site).toBe('少数派');
  });
});
