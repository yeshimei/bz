// @vitest-environment node
/**
 * RSS 源库出版管线纯函数测试（issue 495 / ADR-0208；issue 497 / ADR-0209 扩 RSSHub）——
 * scripts/rss-catalog/lib.mjs：上游表格解析（[Feed] 行 / None 行 / 坏行 / markdown 转义 / 中西分号标签）、
 * 固定大类映射（大小写不敏感、可多类、未命中兜底「综合」）、目录组装（url 去重、坏址剔除）、
 * RSSHub 路由解析（三免筛选 / example 无参数占位 / 官方分类直映射 / 默认实例拼接 / via 透传）、
 * 蒸馏（只留必要字段）。
 */
import { describe, it, expect } from 'vitest';
import {
  buildCatalog, CATEGORIES, FALLBACK_CATEGORY, mapCategories, parseTimqianTable,
  parseRssHubRoutes, distillRssHub, mapRssHubCategories, joinRssHubUrl,
  parseRouteTemplate, buildRouteUrl, reverseTemplateExample, isParametrizedTemplate, truncateDesc,
  RSS_HUB_DEFAULT_INSTANCE, RSS_HUB_CATEGORY_MAP, UPSTREAMS,
} from '../../scripts/rss-catalog/lib.mjs';

const SAMPLE = [
  '| RSS feed | Introduction | Address | tags |',
  '| --- | --- | --- | --- |',
  '| [Feed](https://a.example/atom.xml) | A 博客 | https://a.example | 创业; 编程; 开源 |',
  '| [Feed](https://b.example/feed) | B 生活 | https://b.example | 生活；随笔 |',
  '| [Feed](https://c.example/my\\_feed.xml) | C 转义 | https://c.example | AI |',
  '| None | 无源博客 | https://d.example | 编程 |',
  '| 这不是一行表格 |',
].join('\n');

describe('parseTimqianTable', () => {
  it('[Feed] 行全收：url 还原 markdown 转义、标签中西分号都拆', () => {
    const { entries, noFeed, malformed } = parseTimqianTable(SAMPLE);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ url: 'https://a.example/atom.xml', title: 'A 博客', site: 'https://a.example', tags: ['创业', '编程', '开源'] });
    expect(entries[1].tags).toEqual(['生活', '随笔']);
    expect(entries[2].url).toBe('https://c.example/my_feed.xml');
    expect(noFeed).toBe(1);
    expect(malformed).toBe(3); // 表头行 + 分隔行 + 半截行都计入（均非条目）
  });

  it('空输入 → 全零', () => {
    const r = parseTimqianTable('');
    expect(r.entries).toHaveLength(0);
    expect(r.noFeed).toBe(0);
  });
});

describe('mapCategories', () => {
  it('大小写不敏感（AI / ai 同命中）', () => {
    expect(mapCategories(['AI'])).toEqual(['AI 与数据']);
    expect(mapCategories(['linux'])).toEqual(['编程技术']); // 词边界：linux 不得因含「ux」误挂设计创意
  });

  it('ASCII 关键词按词边界：巧合包含不命中（复检发现 linux⊃ux 误挂设计创意）', () => {
    expect(mapCategories(['linux'])).toEqual(['编程技术']);
    expect(mapCategories(['aimless 随笔'])).toEqual(['生活随笔']); // ai 不因前缀命中「AI 与数据」
    expect(mapCategories(['vue 组件'])).toEqual(['前端与移动']); // 独立出现的 ascii 词照常命中
  });

  it('包含匹配：标签含关键词即命中（前端开发 含 前端）', () => {
    expect(mapCategories(['前端开发'])).toEqual(['前端与移动']);
  });

  it('一个条目可属多个大类', () => {
    const cats = mapCategories(['编程', '生活', '摄影']);
    expect(cats).toContain('编程技术');
    expect(cats).toContain('生活随笔');
    expect(cats).toContain('摄影影像');
    expect(cats).toHaveLength(3);
  });

  it('未命中 → 兜底「综合」；空标签同样兜底', () => {
    expect(mapCategories(['玄学'])).toEqual([FALLBACK_CATEGORY]);
    expect(mapCategories([])).toEqual([FALLBACK_CATEGORY]);
  });

  it('兜底类在固定大类表末位', () => {
    expect(CATEGORIES[CATEGORIES.length - 1]).toBe(FALLBACK_CATEGORY);
  });
});

describe('buildCatalog', () => {
  const entries = [
    { url: 'https://a.example/atom.xml', title: 'A', site: 'https://a.example', tags: ['编程'] },
    { url: 'https://a.example/atom.xml/', title: 'A 尾斜杠重复', site: '', tags: [] },
    { url: 'ftp://bad.example/x', title: '坏协议', site: '', tags: [] },
    { url: 'https://b.example/feed', title: '', site: 'https://b.example', tags: ['随笔'] },
  ];

  it('去重（去尾斜杠比对、首见为准）+ 坏址剔除 + 归类 + 上游署名', () => {
    const { catalog, duplicates, invalidUrl } = buildCatalog({ entries, updatedAt: '2026-09-27' });
    expect(catalog.feeds).toHaveLength(2);
    expect(duplicates).toBe(1);
    expect(invalidUrl).toBe(1);
    expect(catalog.feeds[0].url).toBe('https://a.example/atom.xml'); // 首见的原串，不改写
    expect(catalog.feeds[0].cats).toEqual(['编程技术']);
    expect(catalog.feeds[1].cats).toEqual(['生活随笔']); // 空标题保留空串，不编造
    expect(catalog.updatedAt).toBe('2026-09-27');
    expect(catalog.categories).toEqual(CATEGORIES);
    expect(catalog.meta.sources[0].license).toBe('MIT');
  });

  it('version 缺省 1', () => {
    const { catalog } = buildCatalog({ entries: [], updatedAt: 'x' });
    expect(catalog.version).toBe(1);
  });

  it('via 条目透传路由路径 + 预映射 cats 直通（不走关键词映射）+ 表单素材三件套', () => {
    const { catalog } = buildCatalog({
      entries: [
        { url: `${RSS_HUB_DEFAULT_INSTANCE}/bilibili/user/video/:uid`, title: '哔哩哔哩 · UP 主投稿', site: 'https://www.bilibili.com', tags: ['bilibili'], cats: ['数字生活'], via: '/bilibili/user/video/:uid', viaExample: '/bilibili/user/video/2267573', params: { uid: '用户 id' }, desc: '订阅 UP 主投稿' },
        { url: `${RSS_HUB_DEFAULT_INSTANCE}/bilibili/hot-search`, title: '哔哩哔哩 · 热搜', site: '', tags: [], cats: ['数字生活'], via: '/bilibili/hot-search' },
        { url: 'https://x.example/feed', title: 'X', site: '', tags: [] },
      ],
      updatedAt: '2026-09-27',
    });
    expect(catalog.feeds).toHaveLength(3);
    expect(catalog.feeds[0].via).toBe('/bilibili/user/video/:uid');
    expect(catalog.feeds[0].viaExample).toBe('/bilibili/user/video/2267573');
    expect(catalog.feeds[0].params).toEqual({ uid: '用户 id' });
    expect(catalog.feeds[0].desc).toBe('订阅 UP 主投稿');
    expect(catalog.feeds[1].viaExample).toBeUndefined(); // 无参数条目不带表单素材
    expect(catalog.feeds[1].params).toBeUndefined();
    expect(catalog.feeds[2].via).toBeUndefined(); // 直连源恒缺省
  });
});

// ===== RSSHub 路由（issue 497 / ADR-0209 全参数化）=====

/** 蒸馏快照样例（与 distillRssHub 产物同形状）。
 *  真数据口径：routes 的键 = 含 ns 前缀的完整路由；r.path = 省略 ns 的子路径（不参与拼 url）。 */
const ROUTES_SAMPLE = {
  bilibili: {
    name: '哔哩哔哩 bilibili',
    url: 'https://www.bilibili.com',
    heat: 220330,
    routes: {
      '/bilibili/hot-search': { path: '/hot-search', name: '热搜', example: '/bilibili/hot-search', categories: ['new-media'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false }, parameters: {}, heat: 900, desc: '热搜榜' },
      '/bilibili/user/video/:uid/:embed?': { path: '/user/video/:uid/:embed?', name: 'UP 主投稿', example: '/bilibili/user/video/2267573', categories: ['social-media'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false }, parameters: { uid: '用户 id, 可在 UP 主主页中找到', embed: '默认为开启内嵌视频' }, heat: 800, desc: '投稿视频' },
      '/bilibili/need-cookie': { path: '/need-cookie', name: '要配置', example: '', categories: [], features: { requireConfig: true, requirePuppeteer: false, antiCrawler: false }, parameters: {}, heat: 0, desc: '' },
      '/bilibili/need-pptr': { path: '/need-pptr', name: '要无头', example: '', categories: [], features: { requireConfig: false, requirePuppeteer: true, antiCrawler: false }, parameters: {}, heat: 0, desc: '' },
      '/bilibili/anti': { path: '/anti', name: '易反爬', example: '', categories: [], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: true }, parameters: {}, heat: 0, desc: '' },
      '/bilibili/param-example/:p': { path: '/param-example/:p', name: '参数没填', example: '/bilibili/param-example/:p', categories: [], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false }, parameters: {}, heat: 0, desc: '' },
    },
  },
  other: {
    name: 'other 分类命名空间',
    url: '',
    heat: 1,
    routes: {
      '/other/thing': { path: '/thing', name: '未分类', example: '/other/thing', categories: ['other'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false }, parameters: {}, heat: 5, desc: '' },
    },
  },
};

describe('parseRssHubRoutes（全参数化）', () => {
  it('三免全收不再依赖 example：无参数直订、带参数带表单素材三件套', () => {
    const { entries, dropped } = parseRssHubRoutes(ROUTES_SAMPLE);
    expect(entries).toHaveLength(4); // 热搜 / UP 主投稿 / 参数没填 / 未分类
    expect(dropped).toMatchObject({ needConfig: 1, needPuppeteer: 1, antiCrawler: 1 });
    // 路由 heat 降序：热搜 900 → UP 投稿 800 → 未分类 5 → 参数没填 0
    expect(entries.map((e) => e.via)).toEqual([
      '/bilibili/hot-search', '/bilibili/user/video/:uid/:embed?', '/other/thing', '/bilibili/param-example/:p',
    ]);
  });

  it('模板用 routes 键（含 ns 前缀），url 用默认实例拼好', () => {
    const { entries } = parseRssHubRoutes(ROUTES_SAMPLE);
    const hot = entries.find((e) => e.title.includes('热搜'));
    expect(hot.url).toBe(`${RSS_HUB_DEFAULT_INSTANCE}/bilibili/hot-search`);
    const up = entries.find((e) => e.title.includes('UP 主投稿'));
    expect(up.via).toBe('/bilibili/user/video/:uid/:embed?');
    expect(up.viaExample).toBe('/bilibili/user/video/2267573');
    expect(up.params).toEqual({ uid: '用户 id, 可在 UP 主主页中找到', embed: '默认为开启内嵌视频' });
    expect(up.desc).toBe('投稿视频');
    const hot0 = entries.find((e) => e.title.includes('热搜'));
    expect(hot0.viaExample).toBeUndefined(); // 无参数条目不带表单素材
    expect(hot0.params).toBeUndefined();
  });

  it('官方分类直映射；未列出分类落「综合」', () => {
    const { entries } = parseRssHubRoutes(ROUTES_SAMPLE);
    expect(entries.find((e) => e.title.includes('热搜')).cats).toEqual(['新闻资讯']);
    expect(entries.find((e) => e.title.includes('未分类')).cats).toEqual([FALLBACK_CATEGORY]);
  });

  it('空/坏输入 → 0 条目全零计数', () => {
    expect(parseRssHubRoutes(null).entries).toHaveLength(0);
    expect(parseRssHubRoutes({ bad: 42 }).dropped.malformed).toBe(1);
  });
});

describe('模板解析与填参（全参数化核心）', () => {
  it('parseRouteTemplate：剥 {...} 正则尾巴、识别 ? 可选标记', () => {
    expect(parseRouteTemplate('/81/81rc/:category{.+}?')).toEqual([{ name: 'category', optional: true }]);
    expect(parseRouteTemplate('/bilibili/user/video/:uid/:embed?')).toEqual([
      { name: 'uid', optional: false },
      { name: 'embed', optional: true },
    ]);
    expect(parseRouteTemplate('/bilibili/hot-search')).toEqual([]);
  });

  it('buildRouteUrl：填参拼接、按段 encode 保留段内斜杠、可选空剥段、必选空拼不出', () => {
    expect(buildRouteUrl('https://a.example/', '/81/81rc/:category{.+}?', { category: 'sy/gzdt_210283' }))
      .toBe('https://a.example/81/81rc/sy/gzdt_210283'); // 通配段保留 /
    expect(buildRouteUrl('https://a.example', '/bilibili/user/video/:uid/:embed?', { uid: '2267573' }))
      .toBe('https://a.example/bilibili/user/video/2267573'); // 可选 embed 空整段剥掉
    expect(buildRouteUrl('https://a.example', '/bilibili/user/video/:uid/:embed?', { uid: '张 三', embed: '0' }))
      .toBe('https://a.example/bilibili/user/video/' + encodeURIComponent('张 三') + '/0');
    expect(buildRouteUrl('https://a.example', '/x/:must', {})).toBe(''); // 必选空 → 拼不出
    expect(buildRouteUrl('bad', '/x', {})).toBe('');
  });

  it('reverseTemplateExample：示例反解预填；段数不齐回空', () => {
    expect(reverseTemplateExample('/bilibili/user/video/:uid/:embed?', '/bilibili/user/video/2267573'))
      .toEqual({ uid: '2267573' });
    expect(reverseTemplateExample('/a/:x', '/b/1')).toEqual({});
    expect(reverseTemplateExample('/other/thing', '/other/thing')).toEqual({});
  });

  it('isParametrizedTemplate / truncateDesc', () => {
    expect(isParametrizedTemplate('/x/:id')).toBe(true);
    expect(isParametrizedTemplate('/x')).toBe(false);
    expect(truncateDesc('a'.repeat(201))).toBe('a'.repeat(200) + '…');
    expect(truncateDesc('短')).toBe('短');
  });

  it('distillRssHub 只留必要字段；parameters/heat/desc 进白名单', () => {
    const d = distillRssHub({
      bilibili: { ...ROUTES_SAMPLE.bilibili, description: '多余', routes: { '/bilibili/x': { path: '/x', name: 'X', example: '/bilibili/x', categories: ['game'], features: { requireConfig: false, requirePuppeteer: true, antiCrawler: false, supportRadar: true }, parameters: { p: '说明' }, heat: 7, description: '::: tip\n说明' } } },
      bad: null,
    });
    expect(Object.keys(d)).toEqual(['bilibili']);
    const r = d.bilibili.routes['/bilibili/x'];
    expect(Object.keys(r)).toEqual(['path', 'name', 'example', 'categories', 'features', 'parameters', 'heat', 'desc']);
    expect(r.features).toEqual({ requireConfig: false, requirePuppeteer: true, antiCrawler: false });
    expect(r.parameters).toEqual({ p: '说明' });
    expect(r.heat).toBe(7);
    expect(r.desc).toBe('::: tip\n说明'); // 短文本原样（截断逻辑由 truncateDesc 单测覆盖）
  });
});
