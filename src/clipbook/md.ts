/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：正文段落化（右栏/移动详情渲染用）。
 * 纯函数，node 可测。
 *
 * 输入 news body / 剪藏正文原样（可能含 markdown 图片/链接/列表/空行、Obsidian 嵌链）；
 * 输出「引文块 / 普通段 / 图片段」三分的段落流（issue 206：图片不再丢弃，独立成段保序），
 * 去 markdown 记号，供渲染器按语义上样式。图片段 text 存原始来源：
 * `![alt](url)` 存 url；`![[path]]` 存原 token——渲染层统一解析（外链直用 / vault 内嵌 getResourcePath）。
 */
import type { ClipParagraph } from './types';

/** 图片 token：markdown 图 `![alt](url)` 或 Obsidian 嵌链 `![[path]]`（含 `|` 别名尺寸） */
const IMG_TOKEN_RE = /(!\[[^\]]*\]\([^)]*\)|!\[\[[^\]]+\]\])/g;

type Piece = { kind: 'text'; text: string } | { kind: 'img'; src: string };

/** 单行拆图片 token：图片独立成 piece，其余文本片段按序返回 */
function splitImageTokens(line: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  IMG_TOKEN_RE.lastIndex = 0;
  while ((m = IMG_TOKEN_RE.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) });
    const tok = m[0];
    const md = tok.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/);
    if (md) {
      out.push({ kind: 'img', src: md[2] });
    } else {
      const wiki = tok.match(/^!\[\[([^\]]+)\]\]$/);
      if (wiki) out.push({ kind: 'img', src: '![[' + wiki[1].split('|')[0].trim() + ']]' }); // 剥 |别名尺寸，渲染层按路径解析
    }
    last = m.index + tok.length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

/** 行内文本清洗（去链接记号保文字/标题/强调/列表前缀；图片 token 已拆出不再经过） */
function cleanLine(s: string): string {
  let t = s;
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 链接保文字
  t = t.replace(/^#{1,6}\s*/, ''); // 标题
  t = t.replace(/[*_`~]/g, '');
  t = t.replace(/^[-•]\s+/, ''); // 列表
  return t.trim();
}

/** 单段：规整成行后逐行拆图片 token——图片独立 img 段保序，文本行清洗合并；> 开头整段判 quote */
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
    const textBuf: string[] = [];
    const flushText = () => {
      const text = textBuf.join(' ').trim();
      textBuf.length = 0;
      if (text) out.push({ type: isQuote ? 'quote' : 'p', text });
    };
    for (const line of lines) {
      const content = isQuote && line.startsWith('>') ? line.replace(/^>\s?/, '') : line;
      for (const piece of splitImageTokens(content)) {
        if (piece.kind === 'img') {
          flushText(); // 图片打断文本流：先落已积累文本，图片独立成段保序
          out.push({ type: 'img', text: piece.src });
        } else {
          const cleaned = cleanLine(piece.text);
          if (cleaned) textBuf.push(cleaned);
        }
      }
    }
    flushText();
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
