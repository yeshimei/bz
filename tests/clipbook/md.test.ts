/**
 * clipbook 域：md 正文段落化（ADR-0082 / issue 177）
 * 纯函数测试（node 环境）。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toParagraphs, stripClipChrome } from '../../src/clipbook/md';

describe('clipbook/md toParagraphs', () => {
  it('空/无正文 → []', () => {
    expect(toParagraphs('')).toEqual([]);
    expect(toParagraphs('  \n\n  ')).toEqual([]);
  });

  it('普通段落按空行切分并去 md 记号（链接记号保留）', () => {
    const out = toParagraphs('第一段 **粗体** 文字。\n\n第二段[链接文字](https://x.com)结尾。');
    expect(out).toEqual([
      { type: 'p', text: '第一段 粗体 文字。' },
      { type: 'p', text: '第二段[链接文字](https://x.com)结尾。' },
    ]);
  });

  it('链接先摘后还原：URL 含 _ ~ 不被强调剥离误伤', () => {
    const out = toParagraphs('看[a_b](https://x.com/a_b?q=1) **粗**');
    expect(out).toEqual([{ type: 'p', text: '看[a_b](https://x.com/a_b?q=1) 粗' }]);
  });

  it('> 引文段判定 quote 且去 > 记号', () => {
    const out = toParagraphs('> 引文内容\n> 第二行引文\n\n普通段');
    expect(out).toEqual([
      { type: 'quote', text: '引文内容 第二行引文' },
      { type: 'p', text: '普通段' },
    ]);
  });

  it('图片 token 独立 img 段；列表记号去前缀（issue 206：图片不再丢弃）', () => {
    const out = toParagraphs('![图](http://a/b.jpg)\n- 列表项一\n- 列表项二\n\n正文');
    expect(out[0]).toEqual({ type: 'img', text: 'http://a/b.jpg' });
    expect(out[1]).toEqual({ type: 'p', text: '列表项一 列表项二' });
    expect(out[2]).toEqual({ type: 'p', text: '正文' });
  });

  it('图片段（issue 206）：Obsidian 嵌链 ![[path]] 原样保留为 img 段', () => {
    const out = toParagraphs('前文\n\n![[CONFIG/IMG/图.png]]\n\n后文');
    expect(out).toEqual([
      { type: 'p', text: '前文' },
      { type: 'img', text: '![[CONFIG/IMG/图.png]]' },
      { type: 'p', text: '后文' },
    ]);
  });

  it('图片段（issue 206）：图文混行——图片打断文本流保序', () => {
    const out = toParagraphs('开头 ![图](https://a/x.png) 结尾');
    expect(out).toEqual([
      { type: 'p', text: '开头' },
      { type: 'img', text: 'https://a/x.png' },
      { type: 'p', text: '结尾' },
    ]);
  });

  it('图片段（issue 206）：嵌链带别名尺寸剥 | 后缀；引文段内图片也拆出', () => {
    expect(toParagraphs('![[图.png|300]]')).toEqual([{ type: 'img', text: '![[图.png]]' }]);
    const quoteMix = toParagraphs('> 引文 ![图](https://a/b.png) 续');
    expect(quoteMix).toEqual([
      { type: 'quote', text: '引文' },
      { type: 'img', text: 'https://a/b.png' },
      { type: 'quote', text: '续' },
    ]);
  });

  it('标题记号去除（## → 正文行）', () => {
    const out = toParagraphs('## 小标题\n\n内容');
    expect(out[0].text).toBe('小标题');
  });
});

describe('clipbook/md stripClipChrome（enh 包 3：右栏读剪藏正文）', () => {
  const RAW = '---\nurl: "https://a.b/1"\ncreated: 2026-08-20 10:00:00\n---\n```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n第一段。\n\n> 引用\n';

  it('剥 frontmatter 与 dataviewjs 块，保留正文与空行结构', () => {
    const out = stripClipChrome(RAW);
    expect(out).not.toContain('url:');
    expect(out).not.toContain('dataviewjs');
    expect(out.startsWith('第一段。')).toBe(true);
    expect(out).toContain('> 引用');
  });

  it('无 frontmatter/空串安全', () => {
    expect(stripClipChrome('正文')).toBe('正文');
    expect(stripClipChrome('')).toBe('');
    expect(stripClipChrome(undefined as any)).toBe('');
  });
});
