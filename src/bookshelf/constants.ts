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
 * - 下载量：Obsidian 社区插件统计 community-plugin-stats.json（2026-11-12 抓取；随版本会变，
 *   这里只作展示文案，不参与任何逻辑）
 * - 教程：bz Reader README 顶部「视频教程」
 */
export const READER_GUIDE = {
  name: 'bz Reader',
  desc: '把 Obsidian 变成一个能读书的地方。桌面端 + 移动端、多格式（包括 PDF），AI 全书问答、双向链接，数据全部本地。',
  downloads: '1,550',
  repo: 'https://github.com/yeshimei/bz-reader',
  tutorial: 'https://www.bilibili.com/video/BV1tK4E6KE1B',
  marketBadge: '已上架 Obsidian 社区插件市场',
} as const;
