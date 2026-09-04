/**
 * 书架墙（bookshelf）域状态：模块级可变对象 M（与 cinema 域同构但独立）。
 * 并存式新域：与旧 library 域数据同源（书库目录 md + weave-data.json EPUB 条目），
 * 不改数据格式；日后旧 library 域删除后本域独立承担书库 UI。
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';

/** 书目条目（md 书与 EPUB 聚合条目统一形状；status 为派生展示态） */
export interface BookshelfItem {
  file: TFile | null;
  title: string;
  author: string;
  /** 分类（md 书 frontmatter category，未写回落「未分类」；EPUB 无分类 null，展示层兜底） */
  category: string | null;
  /** 封面 vault 路径（相对路径由解析时补 CONFIG/BOOK 前缀；无封面 null） */
  cover: string | null;
  bookReview: string | null;
  readingDate: string | null;
  completionDate: string | null;
  /** 阅读进度 0-100（已读恒 100） */
  progress: number;
  /** 阅读时长展示文本（frontmatter readingTimeFormat / EPUB 派生「N小时M分」） */
  readingTimeFormat: string | null;
  /** 总阅读时长毫秒（EPUB aggregate 有；md 书无则 0） */
  readingTimeMs: number;
  highlights: number;
  thinks: number;
  /** 派生展示态：未读 / 在读 / 已读 */
  status: string;
  /** true = Weave 数据驱动的 EPUB 条目（ADR-0013 口径） */
  isEpub: boolean;
  /** EPUB 深链源标识（跳转读书笔记/原文用；md 书 null） */
  epubVaultPath: string | null;
}

/** 侧栏/抽屉筛选视图 */
export type SideId = 'all' | 'reading' | 'unread' | 'done';

/** 排序键（对应 SORT_LABEL） */
export type SortKey = 'date' | 'title' | 'author' | 'progress';

/** 面板内视图（读书报告内嵌化拍板：报告不再是独立弹窗，而是面板内的一个视图） */
export type BookshelfView = 'shelf' | 'report';

export interface BookshelfState {
  currentOverlay: HTMLElement | null;
  items: BookshelfItem[];
  /** 当前筛选（全部/在读/未读/已读；侧栏与移动抽屉共用） */
  side: SideId;
  /** 分类筛选（'all' = 全部；与状态正交；值 = category 或「未分类」，左栏与移动抽屉共用） */
  catFilter: string;
  sortMode: SortKey;
  /** 桌面搜索框关键字（移动端独立输入框，共用 currentList 过滤） */
  searchKeyword: string;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  /** 是否已打开过滤抽屉（抽屉关闭时同步视图） */
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
  /** 移动端筛选抽屉元素（互斥单例） */
  drawerEl: HTMLElement | null;
  /** 面板内当前视图：书架列表 / 阅读分析报告（重开面板保持；unload 复位） */
  view: BookshelfView;
}

export const M: BookshelfState = {
  currentOverlay: null,
  items: [],
  side: 'all',
  catFilter: 'all',
  sortMode: 'date',
  searchKeyword: '',
  searchDebounceTimer: null,
  appRef: null,
  folderPath: '书库',
  renderFn: null,
  drawerEl: null,
  view: 'shelf',
};

/**
 * 打开面板时的默认视图接线（issue 194）：每次冷开读设置，非法值回落
 * （side 仅认 all/reading/unread/done 之外回落 all；sortMode 之外回落 date）。
 * 与收藏本 openPanel 同语义：设置是「下次打开的初始值」，面板内改选为会话内临时态。
 */
export function applyDefaultView(): void {
  const s = tryGetSettings() as Record<string, unknown>;
  const side = s.bookshelfDefaultSide;
  M.side = side === 'reading' || side === 'unread' || side === 'done' ? side : 'all';
  const sort = s.bookshelfSortMode;
  M.sortMode = sort === 'title' || sort === 'author' || sort === 'progress' ? sort : 'date';
}

/** 测试/重建用：整体重置模块状态 */
export function resetBookshelfState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.side = 'all';
  M.catFilter = 'all';
  M.sortMode = 'date';
  M.searchKeyword = '';
  M.searchDebounceTimer = null;
  M.appRef = null;
  M.folderPath = '书库';
  M.renderFn = null;
  M.drawerEl = null;
  M.view = 'shelf';
}
