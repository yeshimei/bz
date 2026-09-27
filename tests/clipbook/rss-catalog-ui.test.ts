// @vitest-environment jsdom
/**
 * RSS 管理弹窗「源库」页签面板测试（issue 495 / ADR-0208）——createRssCatalogPane：
 * 未下载空态引导 + 就地下载（走统一清单 mock，同 category-table 口径）、
 * 就绪态渲染（meta 署名 / chips 计数 / 行三件套 名称+域名+标签）、
 * 已订阅态（归一 URL 匹配禁用）、订阅动作（入库 + onChanged + 按钮态机）、
 * 搜索防抖过滤 + 分类 chips 叠加 + 无结果空态、refreshSubscribed 就地刷新。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, type RssFeed } from '../../src/clipbook/news-data';
import { readDataSourceState, addRssFeed } from '../../src/clipbook/news-source-settings';
import { createRssCatalogPane } from '../../src/clipbook/news-sources-group';
import { resetRssCatalogCache, RSS_CATALOG_FILE, RSS_CATALOG_MANIFEST_ID } from '../../src/core/rss-catalog';
import { textSha256 } from '../../src/core/sha256';

const CATALOG_PATH = `.obsidian/plugins/bz/downloads/${RSS_CATALOG_FILE}`;
const MANIFEST_PATH = '.obsidian/plugins/bz/downloads/manifest.json';

function smallCatalog() {
  return {
    version: 1,
    updatedAt: '2026-09-27',
    meta: { sources: [{ id: 't', name: '中文独立博客列表', url: 'https://github.com/timqian/chinese-independent-blogs', license: 'MIT' }] },
    categories: ['编程技术', '生活随笔', '综合'],
    feeds: [
      { url: 'https://a.example/feed.xml', title: 'A 博客', site: 'https://a.example', tags: ['编程'], cats: ['编程技术'] },
      { url: 'https://b.example/rss.xml', title: 'B 随笔', site: 'https://b.example', tags: ['随笔', '生活'], cats: ['生活随笔'] },
      { url: 'https://c.example/atom.xml', title: 'C 杂', site: 'https://c.example', tags: ['冷门'], cats: ['综合'] },
    ],
  };
}
const dataText = () => JSON.stringify(smallCatalog(), null, 2);
const manifestTextFor = (sha256: string) =>
  JSON.stringify({ version: 1, docs: [{ id: RSS_CATALOG_MANIFEST_ID, name: 'RSS 源库', file: RSS_CATALOG_FILE, sha256 }], skins: [] });

function seedVault(feeds: RssFeed[] = []): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: feeds,
  }));
  setApp(mockAppWithVault(vault));
  return vault;
}

/** 源库本地就绪（不联网；任何 requestUrl 调用都会抛 unmocked） */
function seedReady(vault: MockVault): void {
  const data = dataText();
  vault.files.set(CATALOG_PATH, data);
  vault.files.set(MANIFEST_PATH, manifestTextFor(textSha256(data)));
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const rowsOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.bz-rss-cat-row')];
const rowByName = (root: HTMLElement, name: string) =>
  rowsOf(root).find((r) => r.querySelector('.bz-rss-cat-name')?.textContent === name);
const chipByName = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('.bz-rss-cat-chip')].find((c) => c.textContent!.startsWith(label));

beforeEach(() => {
  resetObsidianMocks();
  resetRssCatalogCache();
  vi.mocked(requestUrl).mockReset();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', newsRetentionUnsavedDays: '30', articleDirectory: '归档/网页剪藏' }) as any);
  seedVault();
});

describe('源库页签面板（createRssCatalogPane，ADR-0208）', () => {
  it('未下载 → 空态引导；就地下载走统一清单 → 就绪面板 + 落盘', async () => {
    const vault = seedVault();
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    expect(root.querySelector('.bz-rss-cat-empty')).toBeTruthy();
    const btn = root.querySelector<HTMLButtonElement>('.bz-rss-cat-download')!;
    expect(btn.textContent).toBe('下载源库');

    // 挂下载桩：统一清单 + 源库数据（sha 匹配）
    const data = dataText();
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      let body: string | null = null;
      if (req.url.includes('manifest.json')) body = manifestTextFor(textSha256(data));
      else if (req.url.includes(RSS_CATALOG_FILE)) body = data;
      if (body === null) throw new Error('unmocked url: ' + req.url);
      return { status: 200, text: body } as any;
    }) as any);

    btn.click();
    await vi.waitFor(() => expect(root.querySelector('.bz-rss-cat-list')).toBeTruthy());
    expect(vault.files.get(CATALOG_PATH)).toBe(data);
    expect(root.querySelector('.bz-rss-cat-meta')!.textContent).toContain('已收录 3 个源');
  });

  it('就绪态：meta 署名 + chips 计数（含全部）+ 行三件套（名称/域名/标签）', async () => {
    const vault = seedVault();
    seedReady(vault);
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    expect(root.querySelector('.bz-rss-cat-meta')!.textContent).toContain('已收录 3 个源');
    expect(root.querySelector('.bz-rss-cat-meta')!.textContent).toContain('更新于 2026-09-27');
    expect(root.querySelector('.bz-rss-cat-src')!.textContent).toContain('中文独立博客列表（MIT）');
    const chipTexts = [...root.querySelectorAll('.bz-rss-cat-chip')].map((c) => c.textContent);
    expect(chipTexts).toEqual(['全部 3', '编程技术 1', '生活随笔 1', '综合 1']);
    expect(rowsOf(root)).toHaveLength(3);
    const rowA = rowByName(root, 'A 博客')!;
    expect(rowA.querySelector('.bz-rss-cat-domain')!.textContent).toBe('a.example');
    expect(rowA.querySelector('.bz-rss-cat-tag')!.textContent).toBe('编程');
    const subA = rowA.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!;
    expect(subA.textContent).toBe('订阅');
    expect(subA.disabled).toBe(false);
    // 命中计数行：无过滤时展示总量
    expect(root.querySelector('.bz-rss-cat-hit')!.textContent).toBe('共 3 个源');
  });

  it('已订阅态：归一 URL 命中的行按钮禁用呈「已订阅」', async () => {
    const vault = seedVault([{ url: 'https://a.example/feed.xml', title: '旧名' }]);
    seedReady(vault);
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    expect(rowByName(root, 'A 博客')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!.disabled).toBe(true);
    expect(rowByName(root, 'A 博客')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!.textContent).toBe('已订阅');
    expect(rowByName(root, 'B 随笔')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!.disabled).toBe(false);
  });

  it('订阅动作：入库 + 按钮态机（订阅→订阅中…→已订阅禁用）+ onChanged', async () => {
    const vault = seedVault();
    seedReady(vault);
    const root = document.createElement('div');
    const onChanged = vi.fn();
    const pane = createRssCatalogPane(root, { onChanged });
    await pane.reload();
    const sub = rowByName(root, 'B 随笔')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!;
    sub.click();
    await vi.waitFor(() => expect(sub.textContent).toBe('已订阅'));
    expect(sub.disabled).toBe(true);
    const st = await readDataSourceState();
    const b = st.rssFeeds.find((f) => f.url === 'https://b.example/rss.xml');
    expect(b?.title).toBe('B 随笔'); // 黄页 title 作为初始标题
    expect(onChanged).toHaveBeenCalledTimes(1);
    // 重复点不可达（已禁用）；数据层 exists 分支也不会重复入库
    expect(st.rssFeeds).toHaveLength(1);
  });

  it('搜索防抖过滤 + 分类 chips 叠加 + 无结果空态 + 命中计数', async () => {
    const vault = seedVault();
    seedReady(vault);
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    const search = root.querySelector<HTMLInputElement>('.bz-rss-cat-search')!;
    search.value = 'a 博客';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 300)); // 防抖 200ms 落定
    expect(root.querySelector('.bz-rss-cat-hit')!.textContent).toBe('命中 1 / 3 个源');
    expect(rowsOf(root).map((r) => r.querySelector('.bz-rss-cat-name')!.textContent)).toEqual(['A 博客']);

    // 叠加分类：A 不属生活随笔 → 无结果空态
    (chipByName(root, '生活随笔') as HTMLButtonElement).click();
    await flush();
    expect(root.querySelector('.bz-rss-cat-none')!.textContent).toContain('没有匹配的源');

    // 清空搜索 → 该分类命中 B，命中计数如实
    search.value = '';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 300));
    expect(rowsOf(root).map((r) => r.querySelector('.bz-rss-cat-name')!.textContent)).toEqual(['B 随笔']);
    expect(root.querySelector('.bz-rss-cat-hit')!.textContent).toBe('命中 1 / 3 个源');
  });

  it('refreshSubscribed：数据层新增订阅后，已订阅标记就地刷新', async () => {
    const vault = seedVault();
    seedReady(vault);
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    expect(rowByName(root, 'C 杂')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!.disabled).toBe(false);
    await addRssFeed('https://c.example/atom.xml', 'C 杂');
    await pane.refreshSubscribed();
    const subC = rowByName(root, 'C 杂')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!;
    expect(subC.disabled).toBe(true);
    expect(subC.textContent).toBe('已订阅');
  });
});

describe('路由型源（ADR-0209：via 重拼 + 徽标 + 实例键）', () => {
  /** 带 RSSHub 路由条目的小库（自建数据，不与上面 describe 共用 smallCatalog——避免既有断言计数漂移） */
  function viaCatalog() {
    return {
      version: 1,
      updatedAt: '2026-09-27',
      meta: { sources: [{ id: 'r', name: 'RSSHub 路由目录', url: 'https://github.com/DIYgod/RSSHub-Docs', license: 'AGPL-3.0' }] },
      categories: ['新闻资讯', '综合'],
      feeds: [
        { url: 'https://rsshub.rssforever.com/bilibili/hot-search', title: '哔哩哔哩 · 热搜', site: 'https://www.bilibili.com', tags: ['bilibili'], cats: ['新闻资讯'], via: '/bilibili/hot-search' },
        { url: 'https://d.example/feed.xml', title: 'D 直连', site: 'https://d.example', tags: [], cats: ['综合'] },
      ],
    };
  }
  function seedVia(vault: MockVault, newsExtra: Record<string, unknown> = {}, feeds: RssFeed[] = []): void {
    const data = JSON.stringify(viaCatalog(), null, 2);
    vault.files.set(CATALOG_PATH, data);
    vault.files.set(MANIFEST_PATH, manifestTextFor(textSha256(data)));
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: feeds, ...newsExtra,
    }));
  }

  it('路由条目带 RSSHub 徽标；news.json 无实例段时按默认实例判定已订阅', async () => {
    const vault = seedVault();
    seedVia(vault, {}, [{ url: 'https://rsshub.rssforever.com/bilibili/hot-search', title: '旧' }]);
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    const rowB = rowByName(root, '哔哩哔哩 · 热搜')!;
    expect(rowB.querySelector('.bz-rss-cat-via')!.textContent).toBe('RSSHub');
    expect(rowB.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!.disabled).toBe(true); // 按重拼（=默认实例）URL 匹配
    expect(rowByName(root, 'D 直连')!.querySelector('.bz-rss-cat-via')).toBeNull(); // 直连条目无徽标
  });

  it('订阅路由条目：按 news.json rsshubInstance 段重拼 URL 入库（订阅=拷贝当时 URL）', async () => {
    const vault = seedVault();
    seedVia(vault, { rsshubInstance: 'https://my.rsshub.example/' });
    const root = document.createElement('div');
    const pane = createRssCatalogPane(root, { onChanged: () => {} });
    await pane.reload();
    const sub = rowByName(root, '哔哩哔哩 · 热搜')!.querySelector<HTMLButtonElement>('.bz-rss-cat-sub')!;
    sub.click();
    await vi.waitFor(() => expect(sub.textContent).toBe('已订阅'));
    const st = await readDataSourceState();
    expect(st.rssFeeds.map((f) => f.url)).toEqual(['https://my.rsshub.example/bilibili/hot-search']); // 重拼 + 实例尾斜杠已去
    expect(st.rssFeeds[0].title).toBe('哔哩哔哩 · 热搜');
  });
});
