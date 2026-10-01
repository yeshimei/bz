// @vitest-environment node
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
  buildRouteUrl,
  downloadRssCatalog,
  feedDomainOf,
  filterCatalogFeeds,
  isParametrizedRoute,
  joinRssHubUrl,
  loadRssCatalog,
  parseRouteTemplate,
  resetRssCatalogCache,
  resolveCatalogFeedUrl,
  reverseTemplateExample,
  RSS_CATALOG_FILE,
  RSS_CATALOG_FALLBACK_CATEGORY,
  RSS_CATALOG_MANIFEST_ID,
  RSS_HUB_DEFAULT_INSTANCE,
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

  it('真源（downloads/rss-catalog.json，直连 + RSSHub 路由混编）也通过——插件端与出版脚本同口径', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const real = JSON.parse(readFileSync(resolve(here, '../../downloads/rss-catalog.json'), 'utf8'));
    const c = validateRssCatalog(real);
    expect(c).not.toBeNull();
    expect(c!.feeds.length).toBeGreaterThan(4000); // 497 出版：直连 ~1150 + 路由 ~3305
    const via = c!.feeds.filter((f) => f.via);
    expect(via.length).toBeGreaterThan(3000);
    // 全参数化：带参数条目携带表单素材（params/viaExample），无参数条目不带
    const param = via.filter((f) => f.via && isParametrizedRoute(f.via));
    expect(param.length).toBeGreaterThan(2000);
    expect(param.every((f) => f.viaExample || f.params || f.desc)).toBe(true);
    expect(via.filter((f) => !isParametrizedRoute(f.via!)).every((f) => !f.viaExample && !f.params)).toBe(true);
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

  it('feed url 去尾斜杠孪生 → null（与出版脚本去重 key 同口径，issue 495 复检 P2-3）', () => {
    const c = smallCatalog();
    c.feeds[1].url = 'https://a.example/feed.xml/';
    expect(validateRssCatalog(c)).toBeNull();
  });

  it('条目内 cats 重复 → null（重复会让分类计数虚高，issue 495 复检 P2-3）', () => {
    const c = smallCatalog();
    c.feeds[0].cats = ['编程技术', '编程技术'];
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

  it('via 形状门（ADR-0209）：非 / 开头或含空白 → null（坏路径会在订阅重拼时产出垃圾地址）', () => {
    const c = smallCatalog();
    c.feeds[0].via = '/bilibili/hot-search';
    expect(validateRssCatalog(c)).not.toBeNull(); // 合法路由路径
    const bad = smallCatalog();
    (bad.feeds[0] as any).via = 'bilibili/hot-search';
    expect(validateRssCatalog(bad)).toBeNull();
    const spaced = smallCatalog();
    (spaced.feeds[0] as any).via = '/has space';
    expect(validateRssCatalog(spaced)).toBeNull();
  });

  it('表单素材三件套校验：viaExample 同形状门、params 键值约束（ADR-0209 全参数化）', () => {
    const ok = smallCatalog();
    ok.feeds[0].via = '/x/:id';
    ok.feeds[0].viaExample = '/x/123';
    ok.feeds[0].params = { id: '用户 id' };
    ok.feeds[0].desc = '说明';
    expect(validateRssCatalog(ok)).not.toBeNull();
    const badEx = smallCatalog();
    (badEx.feeds[0] as any).viaExample = 'x/123';
    expect(validateRssCatalog(badEx)).toBeNull();
    const badParam = smallCatalog();
    (badParam.feeds[0] as any).params = { '': '无键' };
    expect(validateRssCatalog(badParam)).toBeNull();
    const badParamV = smallCatalog();
    (badParamV.feeds[0] as any).params = { id: 42 };
    expect(validateRssCatalog(badParamV)).toBeNull();
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

  it('缓存随落盘事件失效（issue 495 复检 P1-1）：设置面板行直写磁盘不经 downloadRssCatalog 也能读到新库', async () => {
    const { emitDomainEvent } = await import('../../src/core/domain-bus');
    const { DOWNLOADS_CHANGED_EVENT } = await import('../../src/core/remote-asset');
    const dataV1 = JSON.stringify(smallCatalog(), null, 2);
    const vault = new MockVault();
    vault.files.set(CATALOG_PATH, dataV1);
    vault.files.set(MANIFEST_PATH, manifestTextFor(textSha256(dataV1)));
    const app = appOf(vault);
    expect((await loadRssCatalog(app))!.feeds).toHaveLength(3);
    // 磁盘换 v2（两条款）——模拟设置面板行 ensureAssetWithHash 直写
    const v2 = smallCatalog();
    v2.feeds = v2.feeds.slice(0, 2);
    vault.files.set(CATALOG_PATH, JSON.stringify(v2, null, 2));
    expect((await loadRssCatalog(app))!.feeds).toHaveLength(3); // 事件前缓存仍旧
    emitDomainEvent(DOWNLOADS_CHANGED_EVENT, { fileName: RSS_CATALOG_FILE });
    expect((await loadRssCatalog(app))!.feeds).toHaveLength(2); // 事件后重读磁盘
    // 别的资产落盘不失效本库缓存
    const v3 = smallCatalog();
    vault.files.set(CATALOG_PATH, JSON.stringify(v3, null, 2));
    emitDomainEvent(DOWNLOADS_CHANGED_EVENT, { fileName: 'skins/clipbook/x.css' });
    expect((await loadRssCatalog(app))!.feeds).toHaveLength(2); // 仍是 v2 缓存
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

describe('RSSHub 路由纯函数（ADR-0209 全参数化）', () => {
  const template = { url: 'https://rsshub.rssforever.com/bilibili/user/video/:uid/:embed?', via: '/bilibili/user/video/:uid/:embed?' };
  const flat = { url: 'https://rsshub.rssforever.com/bilibili/hot-search', via: '/bilibili/hot-search' };

  it('joinRssHubUrl 与出版脚本同口径；插件侧默认实例与 lib.mjs 常量同值', async () => {
    expect(joinRssHubUrl('https://my.example/inst/', '/x/y')).toBe('https://my.example/inst/x/y');
    expect(joinRssHubUrl('not-url', '/x')).toBe('');
    expect(joinRssHubUrl('https://a.example', 'no-slash')).toBe('');
    const lib = await import('../../scripts/rss-catalog/lib.mjs');
    expect(RSS_HUB_DEFAULT_INSTANCE).toBe(lib.RSS_HUB_DEFAULT_INSTANCE);
  });

  it('resolveCatalogFeedUrl：无参数路由按实例重拼，直连原样；实例损坏回退出版期 url', () => {
    expect(resolveCatalogFeedUrl(flat, 'https://my.example/')).toBe('https://my.example/bilibili/hot-search');
    expect(resolveCatalogFeedUrl({ url: 'https://a.example/feed.xml' }, 'https://my.example/')).toBe('https://a.example/feed.xml');
    expect(resolveCatalogFeedUrl(flat, '垃圾')).toBe('https://rsshub.rssforever.com/bilibili/hot-search');
  });

  it('parseRouteTemplate / isParametrizedRoute：剥正则尾巴、识别可选段', () => {
    expect(parseRouteTemplate('/bilibili/user/video/:uid/:embed?')).toEqual([
      { name: 'uid', optional: false },
      { name: 'embed', optional: true },
    ]);
    expect(parseRouteTemplate('/81/81rc/:category{.+}?')).toEqual([{ name: 'category', optional: true }]);
    expect(isParametrizedRoute(template.via)).toBe(true);
    expect(isParametrizedRoute(flat.via)).toBe(false);
  });

  it('buildRouteUrl：填参拼接、按段 encode 保留通配段斜杠、可选空剥段、必选空返回空串', () => {
    expect(buildRouteUrl('https://my.example/', template.via, { uid: '2267573' }))
      .toBe('https://my.example/bilibili/user/video/2267573');
    expect(buildRouteUrl('https://my.example', '/81/81rc/:category{.+}?', { category: 'sy/gzdt_210283' }))
      .toBe('https://my.example/81/81rc/sy/gzdt_210283');
    expect(buildRouteUrl('https://my.example', template.via, {})).toBe(''); // uid 必选空
  });

  it('buildRouteUrl 守卫（评审 P1-2/P2-5）：正则尾巴含 / 的参数段与乱序可选段拼不出', () => {
    // npm 包名段：正则尾巴含 /，split 切断后无法替换 → 不得产出含占位的垃圾地址
    const npm = '/npm/package/:name{(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*}';
    expect(buildRouteUrl('https://my.example', npm, { name: 'vue' })).toBe('');
    // 连续可选段乱序填：`/:category?/:type?` 只填 type 留空 category 会静默错绑
    expect(buildRouteUrl('https://my.example', '/x/:category?/:type?', { type: 'day' })).toBe('');
    // 填前空后（y 在 x 之后有值、x 也有值）合法；填 x 空 y 也空剥段合法
    expect(buildRouteUrl('https://my.example', '/x/:category?/:type?', { category: 'a', type: 'day' }))
      .toBe('https://my.example/x/a/day');
    expect(buildRouteUrl('https://my.example', '/x/:category?/:type?', {})).toBe('https://my.example/x');
  });

  it('reverseTemplateExample：示例反解预填值（表单默认值素材）', () => {
    expect(reverseTemplateExample(template.via, '/bilibili/user/video/2267573')).toEqual({ uid: '2267573' });
    expect(reverseTemplateExample('/a/:x', '/b/1')).toEqual({});
  });

  it('filterCatalogFeeds：via 路由路径纳入搜索命中', () => {
    const c = smallCatalog();
    c.feeds[2].via = '/zhihu/user/:id';
    expect(filterCatalogFeeds(c, { query: '/zhihu' }).map((f) => f.url)).toEqual(['https://c.example/atom.xml']);
    expect(filterCatalogFeeds(c, { query: '不存在的路由' })).toHaveLength(0); // 其余条目不因 via 误命中
  });
});
