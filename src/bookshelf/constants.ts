/**
 * 书架墙（bookshelf）域常量：状态标签/侧栏定义/排序键。
 * 数据语义色（状态/统计 accent）一律消费设计 token（--bz-success/--bz-brand/--bz-text-*），
 * 不写裸色——与组件库 tokens.css 同源（数据语义色域内引用 token）。
 */
import type { SideId, SortKey } from './state';

/** 状态中文标签（BookshelfItem.status 值） */
export const STATUS_UNREAD = '未读';
export const STATUS_READING = '在读';
export const STATUS_DONE = '已读';

/** 状态 → 展示色 token 映射（徽章/色点/统计条用；css 变量名不带 var() 包裹，由调用处内联） */
export const STATUS_COLORS: Record<string, string> = {
  [STATUS_UNREAD]: 'var(--bz-text-3)',
  [STATUS_READING]: 'var(--bz-brand)',
  [STATUS_DONE]: 'var(--bz-success)',
};

/** 侧栏/抽屉选项定义（顺序即展示顺序） */
export const SIDE_DEFS: { id: SideId; label: string; sub: string; icon: string }[] = [
  { id: 'all', label: '全部', sub: '书库中所有书（按日期排）', icon: 'library' },
  { id: 'reading', label: STATUS_READING, sub: '正在读的书', icon: 'book-open' },
  { id: 'unread', label: STATUS_UNREAD, sub: '还没开始读', icon: 'book' },
  { id: 'done', label: STATUS_DONE, sub: '已经读完', icon: 'check-circle' },
];

/** 排序键 → 展示文案（排序下拉选项） */
export const SORT_LABEL: Record<SortKey, string> = {
  date: '最近阅读',
  title: '书名',
  author: '作者',
  progress: '进度',
};

/** 桌面头行/弹窗图标（lucide 名） */
export const ICON = {
  search: 'search',
  report: 'bar-chart-3',
  funnel: 'funnel',
  close: 'x',
  books: 'library',
  bookOpen: 'book-open',
  book: 'book',
  checkCircle: 'check-circle',
  highlighter: 'highlighter',
  brain: 'brain',
  clock: 'clock',
  trash: 'trash-2',
  empty: 'library-big',
  sort: 'arrow-up-down',
} as const;

/** 报告命令 id（阅读数据分析报告，reading-report 域；点报告入口执行该命令） */
export const REPORT_COMMAND_ID = 'bz-reading-report-open';

/** 空态/搜索空态图标（lucide） */
export const EMPTY_BOOKS_ICON = 'library-big';
export const EMPTY_SEARCH_ICON = 'search-x';
/** B9：状态筛空态（区别于搜索空态的图标语义） */
export const EMPTY_FILTER_ICON = 'funnel';
