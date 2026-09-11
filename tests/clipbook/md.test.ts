/**
 * clipbook 域：md 正文段落化（ADR-0082 / issue 177）
 * 纯函数测试（node 环境）。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { stripClipChrome } from '../../src/clipbook/md';

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
