/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：常量。
 */
import type { ClipArticle, RailKind } from './types';

/** 聚合讯（news.json）平台显示名（对齐 news 域；剪藏 site 自由字符串不含在内） */
export const NEWS_PLATFORMS: Array<{ platform: string; kind: RailKind }> = [
  { platform: '知乎日报', kind: 'inbox' },
  { platform: '果壳科学人', kind: 'inbox' },
  { platform: 'B站', kind: 'inbox' },
];

/** 稳定标识键（对齐 news/data.ts articleKeyOf：url 优先，其次 title+date） */
export function articleKeyOf(a: any): string {
  if (a && a.url) return 'url:' + String(a.url);
  return 'td:' + String((a && a.title) || '') + '|' + String((a && a.date) || '');
}

/** 空数据侧写（clipbook.json） */
export function emptyData() {
  return { articleOverrides: {}, savedArchive: [], order: [] };
}

/** 摘要截取：正文首段清洗（链接/图片/空白 → 清理），限长后加省略号 */
export function excerpt(body: string, max = 90): string {
  const s = String(body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保文字
    .replace(/[#>*`_~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** HTML 转义（渲染文本统一入口） */
export function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
