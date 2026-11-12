/**
 * 书库（bookshelf）域常量：状态标签/排序键。
 * 数据语义色（状态/统计 accent）一律消费设计 token（--bz-success/--bz-brand/--bz-text-*），
 * 不写裸色——与组件库 tokens.css 同源（数据语义色域内引用 token）。
 */
import type { SortKey } from './state';

/** 状态中文标签（BookshelfItem.status 值；域内 STATUS_COLORS 键用，不作公共 API） */
const STATUS_UNREAD = '未读';
const STATUS_READING = '在读';
const STATUS_DONE = '已读';

/** 状态 → 展示色 token 映射（徽章/色点/统计条用；css 变量名不带 var() 包裹，由调用处内联） */
export const STATUS_COLORS: Record<string, string> = {
  [STATUS_UNREAD]: 'var(--bz-text-3)',
  [STATUS_READING]: 'var(--bz-brand)',
  [STATUS_DONE]: 'var(--bz-success)',
};

/** 排序键 → 展示文案（书脊墙工具行三档，issue 218 原型口径） */
export const SORT_LABEL: Record<SortKey, string> = {
  recent: '最近读完',
  time: '时长最长',
  title: '书名',
};

/** 桌面头行/弹窗图标（lucide 名） */
export const ICON = {
  report: 'bar-chart-3',
  close: 'x',
} as const;

/** 空态/搜索空态图标（lucide） */
export const EMPTY_BOOKS_ICON = 'library-big';
export const EMPTY_SEARCH_ICON = 'search-x';
/** B9：状态筛空态（区别于搜索空态的图标语义） */
export const EMPTY_FILTER_ICON = 'funnel';

/**
 * bz Reader 引导页文案与链接（2026-11-12 用户拍板形态 A「入馆须知」）。
 * - 介绍：取 GitHub 仓库 README 首段
 * - 教程：bz Reader README 顶部「视频教程」
 * - 不写下载量等会过期的统计（写死在源码里几周就对不上真实值）
 */
export const READER_GUIDE = {
  name: 'bz Reader',
  desc: '把 Obsidian 变成一个能读书的地方。桌面端 + 移动端、多格式（包括 PDF），AI 全书问答、双向链接，数据全部本地。',
  repo: 'https://github.com/yeshimei/bz-reader',
  tutorial: 'https://www.bilibili.com/video/BV1tK4E6KE1B',
  marketBadge: '已上架 Obsidian 社区插件市场',
} as const;

/**
 * 书的格式（2026-11-12 用户报「PDF 被认出成 EPUB」后立）：
 * bz Reader 支持 epub / txt / mobi / azw3 / fb2 / cbz / pdf 七种（其 data/schema.ts 的
 * BookFormat），真值写在书目记录的 `fileRef.format`。bz 侧一律以该字段为准，
 * 缺失（老数据）才回落后缀名，两者都没有按 epub 兜底——那是历史上唯一在册的格式。
 *
 * 只做展示（借书卡副标题/书脊提示），不参与任何分支判断：能不能打开由 bz Reader 决定。
 */
export const BOOK_FORMAT_LABEL: Record<string, string> = {
  epub: 'EPUB',
  txt: 'TXT',
  mobi: 'MOBI',
  azw3: 'AZW3',
  fb2: 'FB2',
  cbz: 'CBZ',
  pdf: 'PDF',
};

/** 归一书的格式：fileRef.format → 文件后缀 → 'epub'（返回值必在小写键集内） */
export function bookFormatOf(fileRef: any, vaultPath: string): string {
  const raw = typeof fileRef?.format === 'string' ? fileRef.format.trim().toLowerCase() : '';
  if (BOOK_FORMAT_LABEL[raw]) return raw;
  const ext = String(vaultPath || '').split('.').pop()?.toLowerCase() || '';
  return BOOK_FORMAT_LABEL[ext] ? ext : 'epub';
}
