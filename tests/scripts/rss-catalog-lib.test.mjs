// @vitest-environment node
/**
 * RSS 源库出版管线纯函数测试（issue 495 / ADR-0208）——scripts/rss-catalog/lib.mjs：
 * 上游表格解析（[Feed] 行 / None 行 / 坏行 / markdown 转义 / 中西分号标签）、
 * 固定大类映射（大小写不敏感、可多类、未命中兜底「综合」）、目录组装（url 去重、坏址剔除）。
 */
import { describe, it, expect } from 'vitest';
import { buildCatalog, CATEGORIES, FALLBACK_CATEGORY, mapCategories, parseTimqianTable } from '../../scripts/rss-catalog/lib.mjs';

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
});
