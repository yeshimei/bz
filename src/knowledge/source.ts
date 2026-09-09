/**
 * 术语来源（ADR-0116）：术语录入的可选「来源」——内部笔记（Obsidian 原生双链）或外部链接（URL）。
 * 语义边界：related 是「关联」（卡片↔源文献的双向互链 + Obsidian 原生反向链接），不是出处；
 * 术语文献的出处一律走本模块的 source/sourceTitle 键，不搭 related 便车、不冒充视频文献的 url 键。
 */

/** 单条术语来源（内存态 + 落键值的唯一形态） */
export type TermSource =
  | { kind: 'external'; url: string; title?: string | null }
  | { kind: 'note'; path: string; name?: string };

/** 笔记来源的展示名：显式 name 优先，缺省取去目录去 .md 的文件名 */
export function noteSourceName(path: string, name?: string | null): string {
  const explicit = String(name ?? '').trim();
  if (explicit) return explicit;
  const base = String(path ?? '').replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.md$/i, '') || String(path ?? '');
}

/**
 * 来源文本是否判为「外部链接」（宽松域名字样判定，用户拍板）：
 * 整串无空白 且（http(s):// 前缀 或 形如 域名（≥2 个标签、末标签≥2 字母，含 b23.tv 这类单标签+TLD））。
 * 不校验可达性、不做平台特判（BV 号等纯代码串无域名字样 → 不识别，拍板不带 B 站特判）。
 */
const URL_LIKE_RE = /^(?:[\w-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/;
export function isUrlLikeSourceText(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\/\S+$/i.test(s)) return true;
  return URL_LIKE_RE.test(s);
}

/** 外部 URL 落库前净化：剥尾随中文/英文标点（粘贴常带句号/逗号等），协议缺省不补 */
export function cleanUrlText(text: string): string {
  return String(text ?? '').trim().replace(/[，。！？；、,;.!?…'"’”\])}>】」』]+$/, '');
}

/** 序列化为 frontmatter 键值（数据层唯一入口）；无来源 → null */
export function serializeTermSource(src: TermSource | null | undefined): { source: string; sourceTitle?: string } | null {
  if (!src) return null;
  if (src.kind === 'external') {
    const url = cleanUrlText(src.url);
    if (!url) return null;
    const out: { source: string; sourceTitle?: string } = { source: url };
    if (src.title && String(src.title).trim()) out.sourceTitle = String(src.title).trim();
    return out;
  }
  const path = String(src.path ?? '').trim();
  if (!path) return null;
  const name = noteSourceName(path, src.name);
  return { source: `[[${path}|${name}]]` };
}
