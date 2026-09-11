/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：剪藏笔记外壳剥离。
 * 纯函数，node 可测。
 *
 * 历史注：本文件原承担正文「段落化」（p/quote/img 三分 + markdown 记号清洗），
 * 供阅读面自制渲染；issue 273 review 起正文改走 **Obsidian 内置 MarkdownRenderer**
 * （diary/knowledge 同范式，全保真 markdown），段落化管线（toParagraphs/图片 token
 * 拆分/行内清洗）整体退役，本文件只保留剪藏笔记的外壳剥离。
 */

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
