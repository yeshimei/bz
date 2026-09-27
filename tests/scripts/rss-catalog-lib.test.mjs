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

  it('via 条目透传路由路径 + 预映射 cats 直通（不走关键词映射）', () => {
    const { catalog } = buildCatalog({
      entries: [
        { url: `${RSS_HUB_DEFAULT_INSTANCE}/bilibili/hot-search`, title: '哔哩哔哩 · 热搜', site: 'https://www.bilibili.com', tags: ['bilibili'], cats: ['新闻资讯'], via: '/bilibili/hot-search' },
        { url: 'https://x.example/feed', title: 'X', site: '', tags: [] },
      ],
      updatedAt: '2026-09-27',
    });
    expect(catalog.feeds).toHaveLength(2);
    expect(catalog.feeds[0].via).toBe('/bilibili/hot-search');
    expect(catalog.feeds[0].cats).toEqual(['新闻资讯']); // 预映射直通，tags 里的 'bilibili' 不触发关键词映射
    expect(catalog.feeds[1].via).toBeUndefined(); // 直连源恒缺省
  });
});

// ===== RSSHub 路由（issue 497 / ADR-0209）=====

/** 蒸馏快照样例（与 distillRssHub 产物同形状） */
const ROUTES_SAMPLE = {
  bilibili: {
    name: '哔哩哔哩 bilibili',
    url: 'https://www.bilibili.com',
    heat: 220330,
    routes: {
      '/bilibili/hot-search': { path: '/bilibili/hot-search', name: '热搜', example: '/bilibili/hot-search', categories: ['new-media'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false } },
      '/bilibili/user/video/:uid': { path: '/bilibili/user/video/:uid', name: 'UP 主动态', example: '/bilibili/user/video/2267573', categories: ['social-media'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false } },
      '/bilibili/need-cookie': { path: '/bilibili/need-cookie', name: '要配置', example: '/bilibili/need-cookie', categories: [], features: { requireConfig: true, requirePuppeteer: false, antiCrawler: false } },
      '/bilibili/need-pptr': { path: '/bilibili/need-pptr', name: '要无头', example: '/bilibili/need-pptr', categories: [], features: { requireConfig: false, requirePuppeteer: true, antiCrawler: false } },
      '/bilibili/anti': { path: '/bilibili/anti', name: '易反爬', example: '/bilibili/anti', categories: [], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: true } },
      '/bilibili/no-example': { path: '/bilibili/no-example', name: '无示例', example: '', categories: [], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false } },
      '/bilibili/param-example': { path: '/bilibili/param/:p', name: '参数没填', example: '/bilibili/param/:p', categories: [], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false } },
    },
  },
  other: {
    name: 'other 分类命名空间',
    url: '',
    heat: 1,
    routes: {
      '/other/thing': { path: '/other/thing', name: '未分类', example: '/other/thing', categories: ['other'], features: { requireConfig: false, requirePuppeteer: false, antiCrawler: false } },
    },
  },
};

describe('parseRssHubRoutes', () => {
  it('三免 + example 无参数占位的路由全收，url 用默认实例拼好，via 存路径，tags 带 ns id', () => {
    const { entries, dropped } = parseRssHubRoutes(ROUTES_SAMPLE);
    expect(entries).toHaveLength(3); // hot-search / user/video / other/thing
    expect(entries[0].url).toBe(`${RSS_HUB_DEFAULT_INSTANCE}/bilibili/hot-search`);
    expect(entries[0].via).toBe('/bilibili/hot-search');
    expect(entries[0].title).toBe('哔哩哔哩 bilibili · 热搜');
    expect(entries[0].site).toBe('https://www.bilibili.com');
    expect(entries[0].tags).toEqual(['bilibili', 'new-media']);
    expect(entries[2].title).toBe('other 分类命名空间 · 未分类');
    expect(dropped).toMatchObject({ needConfig: 1, needPuppeteer: 1, antiCrawler: 1, noExample: 1, paramExample: 1 });
  });

  it('官方分类直映射；未列出分类落「综合」', () => {
    const { entries } = parseRssHubRoutes(ROUTES_SAMPLE);
    expect(entries[0].cats).toEqual(['新闻资讯']); // new-media
    expect(entries[1].cats).toEqual(['数字生活']); // social-media
    expect(entries[2].cats).toEqual([FALLBACK_CATEGORY]); // other 不在映射表
  });

  it('空/坏输入 → 0 条目全零计数', () => {
    expect(parseRssHubRoutes(null).entries).toHaveLength(0);
    expect(parseRssHubRoutes({ bad: 42 }).dropped.malformed).toBe(1);
  });
});

describe('mapRssHubCategories / joinRssHubUrl / 蒸馏', () => {
  it('官方分类映射覆盖三免池实际出现的全部分类（新官方分类加入时此断言提醒补映射）', () => {
    for (const c of Object.keys(RSS_HUB_CATEGORY_MAP)) expect(CATEGORIES).toContain(RSS_HUB_CATEGORY_MAP[c]);
  });

  it('joinRssHubUrl：去尾斜杠拼接；坏形状返回空串', () => {
    expect(joinRssHubUrl('https://a.example/', '/x')).toBe('https://a.example/x');
    expect(joinRssHubUrl('ftp://a.example', '/x')).toBe('');
    expect(joinRssHubUrl('https://a.example', 'x')).toBe('');
    expect(joinRssHubUrl('https://a.example', '/x y')).toBe('');
  });

  it('distillRssHub 只留必要字段；features 三布尔收拢', () => {
    const d = distillRssHub({ bilibili: { ...ROUTES_SAMPLE.bilibili, description: '多余字段', routes: { '/x': { path: '/x', name: 'X', example: '/x', categories: ['game'], features: { requireConfig: false, requirePuppeteer: true, antiCrawler: false, supportRadar: true } } } }, bad: null });
    expect(Object.keys(d)).toEqual(['bilibili']);
    expect(d.bilibili.heat).toBe(220330);
    const r = d.bilibili.routes['/x'];
    expect(r.features).toEqual({ requireConfig: false, requirePuppeteer: true, antiCrawler: false });
    expect(Object.keys(r)).toEqual(['path', 'name', 'example', 'categories', 'features']);
  });

  it('上游登记含 RSSHub-Docs，且出版侧默认实例与 core 常量同值（真源对齐由 core 测试锁）', () => {
    const rsshub = UPSTREAMS.find((u) => u.id === 'rsshub-docs-routes');
    expect(rsshub).toBeTruthy();
    expect(rsshub.format).toBe('json');
    expect(RSS_HUB_DEFAULT_INSTANCE).toBe('https://rsshub.rssforever.com');
  });
});
