/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：正文段落化（右栏/移动详情渲染用）。
 * 纯函数，node 可测。
 *
 * 输入 news body 原样（可能含 markdown 图片/链接/列表/空行）；
 * 输出按「引文块 / 普通段」二分的段落流，去 markdown 记号，供渲染器按语义上样式。
 */
import type { ClipParagraph } from './types';

/** 单段：先规整成一行文本（去 md 记号），判断引文（> 开头） */
export function toParagraphs(body: string): ClipParagraph[] {
  const src = String(body || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/);
  const out: ClipParagraph[] = [];
  for (const chunk of src) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const isQuote = lines[0].startsWith('>');
    const text = lines
      .map((l) => {
        let s = l;
        if (isQuote && s.startsWith('>')) s = s.replace(/^>\s?/, '');
        s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // 图片
        s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 链接保文字
        s = s.replace(/^#{1,6}\s*/, ''); // 标题
        s = s.replace(/[*_`~]/g, '');
        s = s.replace(/^[-•]\s+/, ''); // 列表
        return s.trim();
      })
      .filter(Boolean)
      .join(' ');
    if (!text) continue;
    out.push({ type: isQuote ? 'quote' : 'p', text });
  }
  return out;
}

/**
 * 剥剪藏笔记的「外壳」：frontmatter 段 + dataviewjs 摘要块（右栏读剪藏正文用，enh 包 3）。
 * 契约对齐 save.ts 写入侧（--- frontmatter + ```dataviewjs 摘要 view + 正文）。
 */
export function stripClipChrome(raw: string): string {
  return String(raw || '')
    .replace(/^\s*---[\s\S]*?---/, '')
    .replace(/```dataviewjs[\s\S]*?```/g, '')
    .trim();
}
