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

  it('普通段落按空行切分并去 md 记号', () => {
    const out = toParagraphs('第一段 **粗体** 文字。\n\n第二段[链接文字](https://x.com)结尾。');
    expect(out).toEqual([
      { type: 'p', text: '第一段 粗体 文字。' },
      { type: 'p', text: '第二段链接文字结尾。' },
    ]);
  });

  it('> 引文段判定 quote 且去 > 记号', () => {
    const out = toParagraphs('> 引文内容\n> 第二行引文\n\n普通段');
    expect(out).toEqual([
      { type: 'quote', text: '引文内容 第二行引文' },
      { type: 'p', text: '普通段' },
    ]);
  });

  it('图片整行剔除；列表记号去前缀', () => {
    const out = toParagraphs('![图](http://a/b.jpg)\n- 列表项一\n- 列表项二\n\n正文');
    expect(out[0]).toEqual({ type: 'p', text: '列表项一 列表项二' });
    expect(out[1]).toEqual({ type: 'p', text: '正文' });
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
