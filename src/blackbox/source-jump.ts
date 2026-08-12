/**
 * 来源跳转分派（ticket 07 / ADR-0016）：把黑匣子条目的「来源」文本判定为可执行动作。
 * 纯函数，不依赖 App 实例；执行由调用方（panel 等）负责。
 *
 * 三形态 + 不可点：
 * - epub 双链：`[[书路径#定位符|书名]]`（路径以阅读格式扩展名结尾）→ 完整双链交给阅读器公开 API（bz 不复刻 subpath 解析）
 * - `[[笔记]]`（含别名/锚点）→ Obsidian 打开笔记
 * - `http(s)://…` → 浏览器打开
 * - 其他（书名/纯文本/空）→ 不可点
 */
import type { Entry } from './types';

/** 阅读器支持的书籍格式扩展名（与阅读器 SUPPORTED_BOOK_EXTENSIONS 对齐，跳转前由阅读器侧最终校验） */
export const BOOK_EXTENSIONS = ['epub', 'mobi', 'azw3', 'fb2', 'fbz', 'cbz', 'txt'] as const;

export type SourceJumpAction =
  | { kind: 'epub'; link: string }
  | { kind: 'note'; path: string }
  | { kind: 'url'; url: string }
  | { kind: 'none' };

/** 是否书格式路径（大小写不敏感；带子路径 `#…` 也受理，按 `#` 前段判定） */
export function isBookPath(path: string): boolean {
  const head = String(path || '').split('#')[0].trim();
  const dot = head.lastIndexOf('.');
  if (dot < 0 || dot === head.length - 1) return false;
  const ext = head.slice(dot + 1).toLowerCase();
  return (BOOK_EXTENSIONS as readonly string[]).includes(ext);
}

/** 完整 wikilink 串（`[[…]]`）→ 主路径（`#`/`|` 前段）；非 wikilink → null */
export function wikilinkPathFromLink(link: string): string | null {
  const m = String(link || '').trim().match(/^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/);
  return m ? m[1].trim() : null;
}

/** 书内来源双链（ADR-0016 `[[书路径#定位符|书名]]`）→ 纯文字书名：别名优先，无别名取路径尾段去扩展名；非双链返回空 */
export function bookTitleFromSourceLink(sourceLink: string): string {
  const raw = String(sourceLink || '').trim();
  const m = raw.match(/^\[\[[^\]]*\|([^\]|#]+)\][^\]]*\]$/);
  if (m) return m[1].trim();
  const path = wikilinkPathFromLink(raw);
  if (!path) return '';
  const tail = path.split('/').pop() || path;
  const dot = tail.lastIndexOf('.');
  return (dot > 0 ? tail.slice(0, dot) : tail).trim();
}

/** 来源展示文本（面板列表/录入弹窗只读显示）：epub 双链 → 书名；`[[笔记]]` → 显示名（别名→路径尾段→主名）；URL/纯文本原样 */
export function sourceDisplayText(source: string): string {
  const raw = String(source || '').trim();
  if (!raw) return '';
  if (raw.startsWith('[[')) {
    const path = wikilinkPathFromLink(raw);
    if (!path) return raw;
    if (isBookPath(path)) {
      const title = bookTitleFromSourceLink(raw);
      return title || path;
    }
    // 笔记链接：别名优先，其次路径尾段（去扩展名）
    const alias = raw.match(/^\[\[[^\]]*\|([^\]|#]+)\][^\]]*\]$/);
    if (alias) return alias[1].trim();
    const tail = path.split('/').pop() || path;
    const dot = tail.lastIndexOf('.');
    return (dot > 0 ? tail.slice(0, dot) : tail).trim();
  }
  return raw;
}

/** 来源文本 → 跳转动作判定（纯函数） */
export function resolveSourceJump(source: string): SourceJumpAction {
  const raw = String(source || '').trim();
  if (!raw) return { kind: 'none' };
  if (raw.startsWith('[[')) {
    const path = wikilinkPathFromLink(raw);
    if (!path) return { kind: 'none' };
    if (isBookPath(path)) return { kind: 'epub', link: raw };
    return { kind: 'note', path };
  }
  if (/^https?:\/\//i.test(raw)) return { kind: 'url', url: raw };
  return { kind: 'none' };
}

/** 条目的「来源」取值：摘抄 = source 字段；概念 = links[0]（单值约定，ADR-0016）；想法无来源 */
export function entrySourceText(entry: Entry): string {
  if (entry.type === 'literature') return (entry.source || '').trim();
  if (entry.type === 'concept') return entry.links && entry.links.length ? entry.links[0].trim() : '';
  return '';
}
