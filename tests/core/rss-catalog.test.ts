// @vitest-environment jsdom
/**
 * RSS 源库资产层测试（issue 495 / ADR-0208）——core/rss-catalog.ts：
 * validateRssCatalog 合法/畸形矩阵（含真源 downloads/rss-catalog.json）、
 * downloadRssCatalog 走统一清单（未登记抛错 / sha 不符抛错 / 匹配落盘 + 写缓存 / 本地就绪不联网）、
 * 查询纯函数（feedDomainOf / catalogCategoryCounts / filterCatalogFeeds / subscribedUrlSet）。
 * sha256 与构建脚本同口径（normalizeEol 后取值），与 category-table.test 同款 mock。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';
import {
  downloadRssCatalog,
  feedDomainOf,
  filterCatalogFeeds,
  loadRssCatalog,
  resetRssCatalogCache,
  RSS_CATALOG_FILE,
  RSS_CATALOG_FALLBACK_CATEGORY,
  RSS_CATALOG_MANIFEST_ID,
  subscribedUrlSet,
  validateRssCatalog,
  catalogCategoryCounts,
  type RssCatalog,
} from '../../src/core/rss-catalog';

const appOf = (vault: MockVault) => ({ vault }) as any;
const CATALOG_PATH = `.obsidian/plugins/bz/downloads/${RSS_CATALOG_FILE}`;
const MANIFEST_PATH = '.obsidian/plugins/bz/downloads/manifest.json';

/** 小库（单元断言用，不引 1150 条真源） */
function smallCatalog(): RssCatalog {
  return {
    version: 1,
    updatedAt: '2026-09-27',
    meta: { sources: [{ id: 't', name: '中文独立博客列表', url: 'https://github.com/timqian/chinese-independent-blogs', license: 'MIT' }] },
    categories: ['编程技术', '生活随笔', RSS_CATALOG_FALLBACK_CATEGORY],
    feeds: [
      { url: 'https://a.example/feed.xml', title: 'A 博客', site: 'https://a.example', tags: ['编程'], cats: ['编程技术'] },
      { url: 'https://b.example/rss.xml', title: 'B 随笔', site: 'https://b.example', tags: ['随笔', '生活'], cats: ['生活随笔'] },
      { url: 'https://c.example/atom.xml', title: 'C 杂', site: 'https://c.example', tags: ['冷门'], cats: [RSS_CATALOG_FALLBACK_CATEGORY] },
    ],
  };
}

/** requestUrl 桩：按 URL 分发到统一清单 / 源库数据文本（清单 sha256 由调用方按 dataText 算） */
function routeFetch(manifestText: string | null, dataText: string): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    let body: string | null = null;
    if (req.url.includes('manifest.json')) body = manifestText;
    else if (req.url.includes(RSS_CATALOG_FILE)) body = dataText;
    if (body === null) throw new Error('unmocked url: ' + req.url);
    return { status: 200, text: body } as any;
  }) as any);
}

function manifestTextFor(sha256: string): string {
  return JSON.stringify({
    version: 1,
    docs: [{ id: RSS_CATALOG_MANIFEST_ID, name: 'RSS 源库', file: RSS_CATALOG_FILE, sha256 }],
    skins: [],
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetRssCatalogCache();
  vi.mocked(requestUrl).mockReset();
});

describe('validateRssCatalog', () => {
  it('合法库 → 非 null 且结构还原', () => {
    const c = validateRssCatalog(smallCatalog());
    expect(c).not.toBeNull();
    expect(c!.feeds).toHaveLength(3);
    expect(c!.categories).toHaveLength(3);
  });

  it('真源（downloads/rss-catalog.json，1150 条）也通过——插件端与出版脚本同口径', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const real = JSON.parse(readFileSync(resolve(here, '../../downloads/rss-catalog.json'), 'utf8'));
    expect(validateRssCatalog(real)).not.toBeNull();
  });

  it('version 非数值 / 缺 categories / categories 空数组 → null', () => {
    expect(validateRssCatalog({ ...smallCatalog(), version: '1' })).toBeNull();
    const noCats = smallCatalog() as any;
    delete noCats.categories;
    expect(validateRssCatalog(noCats)).toBeNull();
    expect(validateRssCatalog({ ...smallCatalog(), categories: [] })).toBeNull();
  });

  it('categories 重复 → null', () => {
    const c = smallCatalog();
    c.categories = ['编程技术', '编程技术'];
    expect(validateRssCatalog(c)).toBeNull();
  });

  it('feed url 非法（非 http/https / 含空白）→ null', () => {
    const c = smallCatalog();
    (c.feeds[0] as any).url = 'ftp://a.example/feed.xml';
    expect(validateRssCatalog(c)).toBeNull();
    const c2 = smallCatalog();
    (c2.feeds[0] as any).url = 'https://a.example/has space.xml';
    expect(validateRssCatalog(c2)).toBeNull();
  });

  it('feed url 全表重复 → null（黄页「已订阅」匹配依赖 url 口径干净）', () => {
    const c = smallCatalog();
    c.feeds[1].url = c.feeds[0].url;
    expect(validateRssCatalog(c)).toBeNull();
  });

  it('cats 空 / cats ⊄ categories → null', () => {
    const c = smallCatalog();
    c.feeds[0].cats = [];
    expect(validateRssCatalog(c)).toBeNull();
    const c2 = smallCatalog();
    c2.feeds[0].cats = ['不存在的分类'];
    expect(validateRssCatalog(c2)).toBeNull();
  });

  it('tags 非字符串数组 → null；meta.sources 缺 → null；非对象输入 → null（绝不抛）', () => {
    const c = smallCatalog();
    (c.feeds[0] as any).tags = '编程';
    expect(validateRssCatalog(c)).toBeNull();
    const c2 = smallCatalog() as any;
    delete c2.meta;
    expect(validateRssCatalog(c2)).toBeNull();
    expect(validateRssCatalog(null)).toBeNull();
    expect(validateRssCatalog('garbage')).toBeNull();
  });
});

describe('downloadRssCatalog（走统一清单）', () => {
  it('清单未登记本库条目 → 抛「尚未登记」（不静默返回空库）', async () => {
    routeFetch(JSON.stringify({ version: 1, docs: [], skins: [] }), JSON.stringify(smallCatalog()));
    await expect(downloadRssCatalog(appOf(new MockVault()))).rejects.toThrow(/尚未登记/);
  });

  it('清单 sha256 与产物不符 → 抛错（不静默返回空库）', async () => {
    const dataText = JSON.stringify(smallCatalog(), null, 2);
    routeFetch(manifestTextFor('0'.repeat(64)), dataText);
    await expect(downloadRssCatalog(appOf(new MockVault()))).rejects.toThrow();
  });

  it('清单 sha256 匹配 → 落盘 + 返回已校验库 + 写缓存', async () => {
    const dataText = JSON.stringify(smallCatalog(), null, 2);
    routeFetch(manifestTextFor(textSha256(dataText)), dataText);
    const vault = new MockVault();
    const c = await downloadRssCatalog(appOf(vault));
    expect(c.feeds).toHaveLength(3);
    expect(vault.files.get(CATALOG_PATH)).toBe(dataText);
    expect(vault.files.get(MANIFEST_PATH)).toBeTruthy();
    // 缓存命中：二次读取走内存缓存（断网也拿得到）
    vi.mocked(requestUrl).mockImplementation((async () => {
      throw new Error('缓存命中后不应再联网');
    }) as any);
    const again = await loadRssCatalog(appOf(vault));
    expect(again).not.toBeNull();
    expect(again!.feeds[0].title).toBe('A 博客');
  });

  it('本地已就绪且 sha 匹配 → 不联网直接复用（ensureAssetWithHash 缓存口径）', async () => {
    const dataText = JSON.stringify(smallCatalog(), null, 2);
    const sha = textSha256(dataText);
    const vault = new MockVault();
    vault.files.set(CATALOG_PATH, dataText);
    vault.files.set(MANIFEST_PATH, manifestTextFor(sha));
    // 不挂 requestUrl 桩：任何联网都会抛——若走了网络即失败
    const c = await downloadRssCatalog(appOf(vault));
    expect(c.feeds).toHaveLength(3);
  });
});

describe('查询纯函数', () => {
  const c = smallCatalog();

  it('feedDomainOf：小写、去 www.、去端口、去路径；解析不出 → 空串', () => {
    expect(feedDomainOf('https://WWW.Example.com:8443/a/feed')).toBe('example.com');
    expect(feedDomainOf('https://blog.example.cn/atom.xml')).toBe('blog.example.cn');
    expect(feedDomainOf('not a url')).toBe('');
    expect(feedDomainOf('')).toBe('');
  });

  it('catalogCategoryCounts：按 categories 序、含零计数分类', () => {
    expect(catalogCategoryCounts(c)).toEqual([
      { cat: '编程技术', count: 1 },
      { cat: '生活随笔', count: 1 },
      { cat: RSS_CATALOG_FALLBACK_CATEGORY, count: 1 },
    ]);
  });

  it('filterCatalogFeeds：query 命中 title / site / url / 标签（不区分大小写）', () => {
    expect(filterCatalogFeeds(c, { query: 'a 博客' }).map((f) => f.url)).toEqual(['https://a.example/feed.xml']);
    expect(filterCatalogFeeds(c, { query: 'B.EXAMPLE' }).map((f) => f.url)).toEqual(['https://b.example/rss.xml']);
    expect(filterCatalogFeeds(c, { query: 'atom.xml' }).map((f) => f.url)).toEqual(['https://c.example/atom.xml']);
    expect(filterCatalogFeeds(c, { query: '随笔' }).map((f) => f.url)).toEqual(['https://b.example/rss.xml']);
    expect(filterCatalogFeeds(c, { query: '   ' })).toHaveLength(3); // 空白 query = 不过滤
  });

  it('filterCatalogFeeds：cat 过滤 + query 叠加', () => {
    expect(filterCatalogFeeds(c, { cat: '生活随笔' }).map((f) => f.url)).toEqual(['https://b.example/rss.xml']);
    expect(filterCatalogFeeds(c, { cat: '生活随笔', query: 'A 博客' })).toEqual([]);
  });

  it('subscribedUrlSet：trim 归一、空白跳过', () => {
    const set = subscribedUrlSet([' https://a.example/feed.xml ', '', '  ']);
    expect(set.has('https://a.example/feed.xml')).toBe(true);
    expect(set.size).toBe(1);
  });
});
