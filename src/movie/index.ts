/**
 * 影视入口（ticket 14：ensureMovie/openMovieManager/addMovieItem/unloadMovie）
 * 命令（movie-manager-open / movie-manager-add）由 main.ts 裸注册。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { M, resetMovieState } from './state';
import { rebuildItems } from './data';
import { registerEscapeHandler, createOverlay, closeOverlay, renderList, openAddModal } from './ui';
import { openAnalysisModal } from './analysis';

let initialized = false;
let autoRefreshRegistered = false;

/** 幂等初始化（懒加载）：设置注入 + ESC + 自动刷新 */
export function ensureMovie(app: App): void {
  if (initialized) return;
  initialized = true;

  M.appRef = app;
  const s = tryGetSettings();
  M.folderPath = (s as any).movieFolderPath || '我的/影视';
  M.pageSize = parseInt((s as any).moviePageSize, 10) || 20; // 每页加载数量（设置可配，默认 20）

  // 默认视图（第 9 轮设置扩展：重启生效——ensureMovie 幂等）
  applyDefaultView(s as any);

  registerEscapeHandler();
  registerAutoRefresh(app);
  (globalThis as any).__MOVIE_FOLDER_PATH = M.folderPath;
}

/** 应用默认视图设置：排序 / 类型筛选 / 状态筛选（仅 ensureMovie 内部使用） */
function applyDefaultView(s: {
  movieDefaultSort?: string;
  movieDefaultTypeFilter?: string;
  movieDefaultStatusFilter?: string;
}): void {
  const sort = s.movieDefaultSort;
  if (sort && typeof sort === 'string') {
    const idx = sort.lastIndexOf('-');
    const key = idx > 0 ? sort.slice(0, idx) : '';
    const order = idx > 0 ? sort.slice(idx + 1) : '';
    if (['date', 'rating', 'name'].includes(key) && (order === 'asc' || order === 'desc')) {
      M.sortState = { key: key as 'date' | 'rating' | 'name', order };
    }
  }
  const t = s.movieDefaultTypeFilter;
  M.typeFilter = t && t !== '全部' ? t : '全部';
  const st = s.movieDefaultStatusFilter;
  M.statusFilter = ['全部', '想看', '在看', '已看'].includes(st as string) ? (st as string) : '全部';
}

/** vault 三事件自动刷新（防抖 300ms，仅 overlay 打开时刷新） */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: any) => {
    if (file && !file.path.startsWith(M.folderPath + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      rebuildItems(app);
      M.renderListFn?.();
    }, 300);
  };

  app.vault.on('create', schedule);
  app.vault.on('delete', schedule);
  app.vault.on('modify', schedule);
}

/** 打开影视管理（命令 movie-manager-open，toggle 语义） */
export function openMovieManager(app: App): void {
  ensureMovie(app);
  if (M.currentOverlay) {
    closeOverlay();
    return;
  }
  M.renderListFn = renderList;
  createOverlay(app);
}

/** 添加影视（命令 movie-manager-add） */
export function addMovieItem(app: App): void {
  ensureMovie(app);
  openAddModal(app);
}

/** 影视报告（movie-report）：观影数据分析窗口（迁移自 QuickAdd《影视数据分析.js》） */
export function openMovieReport(app: App): void {
  ensureMovie(app);
  openAnalysisModal(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadMovie(): void {
  initialized = false;
  autoRefreshRegistered = false;
  resetMovieState();
}
