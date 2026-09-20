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

  it('基础键值 + 去引号（管辖键）', () => {
    const r = parseFrontmatter('---\ntitle: "你好"\nsummary: 张三\n---\n正文');
    expect(r.fm!.title).toBe('你好');
    expect(r.fm!.summary).toBe('张三');
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

  it('中文键与连字符键原文保留（A1 非管辖键：进 extraLines 不再丢弃，也不被重序列化）', () => {
    const r = parseFrontmatter('---\n来源: 少数派\npublished-at: 2024-01-01\ntitle: 外来标题\n---\n正文');
    expect(r.fm!.title).toBe('外来标题');
    expect(r.extraLines).toEqual(['来源: 少数派', 'published-at: 2024-01-01']);
  });

  it('无缩进列表风格（tags:\\n- a）：tags 不再误判缺失', () => {
    const r = parseFrontmatter('---\ntitle: "T"\ntags:\n- 阅读\n- AI\n---\n正文');
    expect(r.fm!.tags).toEqual(['阅读', 'AI']);
  });

  it('块标量：管辖键后续缩进行收进值；AS2 顺带核验标准闭合', () => {
    const r = parseFrontmatter('---\nsummary: |\n  第一行内容。\n  第二行内容。\ntitle: "T"\n---\n正文');
    expect(r.fm!.summary).toBe('第一行内容。\n第二行内容。');
    expect(r.fm!.title).toBe('T');
    expect(r.extraLines).toHaveLength(0);
  });

  it('非管辖键块标量原文行保留（A1）', () => {
    const r = parseFrontmatter('---\ntitle: "T"\n备注: |\n  块内容。\n---\n正文');
    expect(r.fm!.title).toBe('T');
    expect(r.extraLines).toEqual(['备注: |', '  块内容。']);
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

  it('混合 frontmatter round-trip：管辖键/无缩进列表/注释全保留，非管辖键原文行不丢（A1）', () => {
    const src = '---\ntitle: "已有标题"\n来源: 少数派\npublished-at: 2024-01-01\ntags:\n- 阅读\n- AI\n# 剪藏备注\n---\n\n正文内容';
    const parsed = parseFrontmatter(src);
    const out = buildFrontmatter({ ...parsed.fm!, summary: 'AI 摘要' }, parsed.extraLines) + '\n\n' + parsed.body;
    // 管辖键照常序列化
    expect(out).toContain('title: "已有标题"');
    expect(out).toContain('summary: "AI 摘要"');
    expect(out).toContain('  - "阅读"');
    expect(out).toContain('  - "AI"');
    // 非管辖键与注释行原文拼回（值/缩进零改动——A1 保形）
    expect(out).toContain('来源: 少数派');
    expect(out).toContain('published-at: 2024-01-01');
    expect(out).toContain('# 剪藏备注');
    expect(out.endsWith('\n\n正文内容')).toBe(true); // 正文不动
    // 二次解析幂等：非管辖键仍在原文行、tags 不漂移
    const reparsed = parseFrontmatter(out);
    expect(reparsed.fm!.tags).toEqual(['阅读', 'AI']);
    expect(reparsed.extraLines).toContain('来源: 少数派');
    expect(reparsed.extraLines).toContain('published-at: 2024-01-01');
  });
});

describe('extractBodyForAI', () => {
  it('剔除 dataviewjs 代码块并 trim', () => {
    const body = '```dataviewjs\ndv.list([])\n```\n\n  正文内容  \n';
    expect(extractBodyForAI(body)).toBe('正文内容');
  });
});
