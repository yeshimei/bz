// @vitest-environment node
/**
 * 自动摘要 parser 测试（ticket 10）：frontmatter 解析/重建/正文提取。
 */
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, buildFrontmatter, extractBodyForAI } from '../../src/auto-summary/parser';

describe('parseFrontmatter', () => {
  it('无 frontmatter → fm null + body 原样', () => {
    const r = parseFrontmatter('只有正文\n没有头部');
    expect(r.fm).toBeNull();
    expect(r.body).toBe('只有正文\n没有头部');
  });

  it('基础键值 + 去引号', () => {
    const r = parseFrontmatter('---\ntitle: "你好"\nauthor: 张三\n---\n正文');
    expect(r.fm!.title).toBe('你好');
    expect(r.fm!.author).toBe('张三');
    expect(r.body).toBe('正文');
  });

  it('JSON 数组值', () => {
    const r = parseFrontmatter('---\ntags: ["AI", "阅读"]\n---\n正文');
    expect(r.fm!.tags).toEqual(['AI', '阅读']);
  });

  it('`  - ` 列表项追加到最后一个 key', () => {
    const r = parseFrontmatter('---\ntags:\n  - "AI"\n  - 阅读\n---\n正文');
    expect(r.fm!.tags).toEqual(['AI', '阅读']);
  });

  it('列表项前有非数组值时先转数组', () => {
    const r = parseFrontmatter('---\ntags: 单值\n  - "a"\n  - "b"\n---\n正文');
    expect(r.fm!.tags).toEqual(['a', 'b']);
  });
});

describe('buildFrontmatter', () => {
  it('数组 → key + `  - "x"` 行', () => {
    expect(buildFrontmatter({ tags: ['a', 'b'] })).toBe('---\ntags:\n  - "a"\n  - "b"\n---');
  });

  it('空值 → key: ""', () => {
    expect(buildFrontmatter({ title: '' })).toBe('---\ntitle: ""\n---');
  });

  it('引号转义 + 换行 → 空格', () => {
    const out = buildFrontmatter({ title: '他"说"\n换行' });
    expect(out).toBe('---\ntitle: "他\\"说\\" 换行"\n---');
  });
});

describe('extractBodyForAI', () => {
  it('剔除 dataviewjs 代码块并 trim', () => {
    const body = '```dataviewjs\ndv.list([])\n```\n\n  正文内容  \n';
    expect(extractBodyForAI(body)).toBe('正文内容');
  });
});
