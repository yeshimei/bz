/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：模块状态（M 单例，对齐 cinema state 范式）。
 */
import type { App } from 'obsidian';
import type { ClipArticle } from './types';
import type { ClipNote } from './scan';
import type { ClipbookData } from './data';

export interface ClipSourceSel {
  /** null = 全部未读；'clip' = 剪藏本；否则 inbox（platform 必填） */
  kind: 'all' | 'inbox' | 'clip';
  platform: string;
  up: string | null;
}

export interface ClipbookState {
  appRef: App | null;
  /** 面板根（overlay 容器） */
  overlay: HTMLElement | null;
  /** 剪藏目录（读设置） */
  dir: string;
  /** 面板可见性（dom 挂载即显示；关闭=移除 overlay——打开重新渲染） */
  open: boolean;
  /** news.json 文章（内存面，未处理 + 已处理骨架） */
  articles: any[];
  /** clipbook.json 侧写 */
  sidecar: ClipbookData;
  /** 剪藏目录解析条目（created 降序） */
  clipNotes: ClipNote[] | null;
  /** 剪藏目录 URL 集合（saved 保底判定） */
  clipUrls: Set<string>;
  /** 左栏选中源 */
  sel: ClipSourceSel;
  /** 当前阅读条目 */
  cur: ClipArticle | null;
  /** 当前列表（派生视图缓存，防抖重查用） */
  list: ClipArticle[];
  /** UP 头像资料（news.json bilibiliUpInfo） */
  upInfo: Record<string, { name?: string; avatar?: string }>;
  /** 右侧菜单/浮层打开态（ESC 归属） */
  ctxOpen: boolean;
  /** 移动详情打开态 */
  mobDetailOpen: boolean;
  /** 移动搜索展开态 */
  mobSearchOpen: boolean;
  /** 移动端搜索关键词 */
  searchKeyword: string;
  /** 移动端环境（初始化判定一次） */
  isMobile: boolean;
}

export function defaultSel(): ClipSourceSel {
  return { kind: 'all', platform: '', up: null };
}

export const M: ClipbookState = {
  appRef: null,
  overlay: null,
  dir: '归档/网页剪藏',
  open: false,
  articles: [],
  sidecar: { articleOverrides: {}, savedArchive: [], order: [] },
  clipNotes: null,
  clipUrls: new Set(),
  sel: defaultSel(),
  cur: null,
  list: [],
  upInfo: {},
  ctxOpen: false,
  mobDetailOpen: false,
  mobSearchOpen: false,
  isMobile: false,
  searchKeyword: '',
};

/** 卸载时复位（unload 幂等） */
export function resetClipbookState(): void {
  M.appRef = null;
  M.overlay = null;
  M.open = false;
  M.articles = [];
  M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
  M.clipNotes = null;
  M.clipUrls = new Set();
  M.sel = defaultSel();
  M.cur = null;
  M.list = [];
  M.upInfo = {};
  M.ctxOpen = false;
  M.mobDetailOpen = false;
  M.mobSearchOpen = false;
  M.searchKeyword = '';
}
