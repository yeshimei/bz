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

  it('中文键与连字符键被识别（不再落入未识别行被丢弃）', () => {
    const r = parseFrontmatter('---\n来源: 少数派\npublished-at: 2024-01-01\n标题: 外来标题\n---\n正文');
    expect(r.fm!['来源']).toBe('少数派');
    expect(r.fm!['published-at']).toBe('2024-01-01');
    expect(r.fm!['标题']).toBe('外来标题');
    expect(r.extraLines).toHaveLength(0);
  });

  it('无缩进列表风格（tags:\\n- a）：tags 不再误判缺失', () => {
    const r = parseFrontmatter('---\ntitle: "T"\ntags:\n- 阅读\n- AI\n---\n正文');
    expect(r.fm!.tags).toEqual(['阅读', 'AI']);
  });

  it('块标量（key: |）：后续缩进行收进值，不散落成未识别行', () => {
    const r = parseFrontmatter('---\n摘要: |\n  第一行内容。\n  第二行内容。\ntitle: "T"\n---\n正文');
    expect(r.fm!['摘要']).toBe('第一行内容。\n第二行内容。');
    expect(r.fm!.title).toBe('T');
    expect(r.extraLines).toHaveLength(0);
  });

  it('未识别行（注释/嵌套子映射）原文保留在 extraLines', () => {
    const r = parseFrontmatter('---\ntitle: "T"\n# 剪藏备注\nmeta:\n  inner: v\n---\n正文');
    expect(r.fm!.title).toBe('T');
    expect(r.extraLines).toEqual(['# 剪藏备注', 'meta:', '  inner: v']);
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

  it('extraLines 原样拼回（未识别行不丢失）', () => {
    const out = buildFrontmatter({ title: 'T' }, ['# 剪藏备注', 'meta:', '  inner: v']);
    expect(out).toBe('---\ntitle: "T"\n# 剪藏备注\nmeta:\n  inner: v\n---');
  });

  it('混合 frontmatter round-trip：中文键/无缩进列表/块标量/注释全部保留', () => {
    const src = '---\ntitle: "已有标题"\n来源: 少数派\npublished-at: 2024-01-01\ntags:\n- 阅读\n- AI\n摘要: |\n  首段。\n  次段。\n# 剪藏备注\n---\n\n正文内容';
    const parsed = parseFrontmatter(src);
    const out = buildFrontmatter({ ...parsed.fm!, summary: 'AI 摘要' }, parsed.extraLines) + '\n\n' + parsed.body;
    // 全部原信息保留（键序/格式可归一，值与行不丢）
    expect(out).toContain('title: "已有标题"');
    expect(out).toContain('少数派');
    expect(out).toContain('2024-01-01');
    expect(out).toContain('  - "阅读"');
    expect(out).toContain('  - "AI"');
    expect(out).toContain('首段。 次段。'); // 块标量值保留（换行归一为空格，与既有契约一致）
    expect(out).toContain('# 剪藏备注'); // 注释行原样拼回
    expect(out).toContain('summary: "AI 摘要"'); // 新字段写入
    expect(out.endsWith('\n\n正文内容')).toBe(true); // 正文不动
    // 二次解析不再产生未识别行漂移（幂等）
    const reparsed = parseFrontmatter(out);
    expect(reparsed.fm!['来源']).toBe('少数派');
    expect(reparsed.fm!.tags).toEqual(['阅读', 'AI']);
  });
});

describe('extractBodyForAI', () => {
  it('剔除 dataviewjs 代码块并 trim', () => {
    const body = '```dataviewjs\ndv.list([])\n```\n\n  正文内容  \n';
    expect(extractBodyForAI(body)).toBe('正文内容');
  });
});
