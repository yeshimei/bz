/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：剪藏笔记外壳剥离。
 * 纯函数，node 可测。
 *
 * 历史注：本文件原承担正文「段落化」（p/quote/img 三分 + markdown 记号清洗），
 * 供阅读面自制渲染；issue 273 review 起正文改走 **Obsidian 内置 MarkdownRenderer**
 * （diary/knowledge 同范式，全保真 markdown），段落化管线（toParagraphs/图片 token
 * 拆分/行内清洗）整体退役，本文件只保留剪藏笔记的外壳剥离。
 */
import { stripLegacyDataviewBlock, stripSummaryCard } from './summary-card';

/**
 * 剥剪藏笔记的「外壳」：frontmatter 段 + 摘要卡 + 旧 dataviewjs 块（右栏读剪藏正文用，
 * enh 包 3）。契约对齐写侧：`--- frontmatter ---` + 正文（摘要卡由 auto-summary 写回时
 * 生成，ADR-0290；旧版写进正文的 dataviewjs 块保留剥离，存量笔记未迁移也能正常读）。
 */
export function stripClipChrome(raw: string): string {
  const afterFm = String(raw || '')
    // C28：闭合 `---` 按行锚定（\n--- 行首）——原实现按首次出现匹配，frontmatter 值里
    // 含 `---` 时提前截断，右栏正文顶部露 YAML 残渣（与 C27 写侧同根因链）
    .replace(/^\s*---\r?\n(?:[\s\S]*?\r?\n)?---\s*/, '');
  return stripSummaryCard(stripLegacyDataviewBlock(afterFm))
    .replace(/```dataviewjs[\s\S]*?```/g, '')
    .trim();
}
