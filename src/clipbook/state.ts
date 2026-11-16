/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：模块状态（M 单例，对齐 cinema state 范式）。
 */
import type { App } from 'obsidian';
import type { ClipArticle } from './types';
import type { ClipNote } from './scan';
import type { ClipbookData } from './data';
import type { RssFeed } from './news-data';

export interface ClipSourceSel {
  /** null = 全部未读；'clip' = 剪藏本；'site' = 站点（site 必填，issue 222）；否则 inbox（platform 必填） */
  kind: 'all' | 'inbox' | 'clip' | 'site';
  platform: string;
  up: string | null;
  /** site 源的站点名（归一见 store normSite；非 site 源为空串） */
  site: string;
}

export interface ClipbookState {
  appRef: App | null;
  /** 面板可见性（dom 挂载即显示；关闭=移除 overlay——打开重新渲染） */
  open: boolean;
  /** news.json 文章（内存面，未处理 + 已处理骨架） */
  articles: any[];
  /** news.json stats 段（只读镜像；rail 脚注「今日已读」取 byDate） */
  stats: { totalRead: number; totalSaved: number; totalSkipped: number; byPlatform: Record<string, number>; byDate: Record<string, number> };
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
  /** RSS 订阅列表（news.json rssFeeds；左栏给「订阅了但还没抓到」的源留 0/0 行） */
  rssFeeds: RssFeed[];
  /** 移动详情打开态 */
  mobDetailOpen: boolean;
}

export function defaultSel(): ClipSourceSel {
  return { kind: 'all', platform: '', up: null, site: '' };
}

export const M: ClipbookState = {
  appRef: null,
  open: false,
  articles: [],
  stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
  sidecar: { articleOverrides: {}, savedArchive: [], order: [], marks: {}, savedImages: {}, pendingSource: {}, readLog: [], readSeconds: {}, readLoggedSeconds: {} },
  clipNotes: null,
  clipUrls: new Set(),
  sel: defaultSel(),
  cur: null,
  list: [],
  upInfo: {},
  rssFeeds: [],
  mobDetailOpen: false,
};

/** 卸载时复位（unload 幂等） */
export function resetClipbookState(): void {
  M.appRef = null;
  M.open = false;
  M.articles = [];
  M.stats = { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
  M.sidecar = { articleOverrides: {}, savedArchive: [], order: [], marks: {}, savedImages: {}, pendingSource: {}, readLog: [], readSeconds: {}, readLoggedSeconds: {} };
  M.clipNotes = null;
  M.clipUrls = new Set();
  M.sel = defaultSel();
  M.cur = null;
  M.list = [];
  M.upInfo = {};
  M.rssFeeds = [];
  M.mobDetailOpen = false;
}

/**
 * 面板脏通知（跨模块单向：数据写入方通知，UI 自己决定要不要重读）。
 * 起因：数据源设置在设置面板里改（订阅增删、实例地址），剪藏本面板不经过域内
 * onClose 钩子——M 是常驻内存面，不重读就会停留在「订阅前」的旧样子。
 * 放 state.ts 而非 ui.ts：news-source-settings 是数据层，反向 import ui 会成环；
 * ui 在 initPanel 注册回调（面板开着立刻刷、关着标脏等下次打开）。
 */
let panelDirtyListener: (() => void) | null = null;
export function markPanelDirty(): void {
  if (panelDirtyListener) panelDirtyListener();
}
export function setPanelDirtyListener(fn: (() => void) | null): void {
  panelDirtyListener = fn;
}

/** 装载代际（state 层单源：ui 装载/卸载递增，loader 写 M 前校验）。
 *  用途 = 作废在途异步：卸载后迟到的装载回调不得把 M 写脏新会话
 *  （ui.loadIfNeeded 只守渲染；loader.readNewsAndSidecar 内部写 M 也必须守）。
 *  放 state 层是因为 loader 与 ui 都要用——ui 导入 loader，loader 不能反向导入 ui（环）。 */
let loadGeneration = 0;
export function bumpLoadGeneration(): number { return ++loadGeneration; }
export function currentLoadGeneration(): number { return loadGeneration; }
