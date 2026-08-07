/**
 * 影视入口（ticket 14：ensureMovie/openMovieManager/addMovieItem/unloadMovie）
 * 命令（movie-manager-open / movie-manager-add）由 main.ts 裸注册。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { M } from './state';
import { STATUS_WATCHING, STATUS_WANT } from './constants';
import { rebuildItems } from './data';
import { registerEscapeHandler, createOverlay, closeOverlay, renderList, openAddModal } from './ui';

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

  registerEscapeHandler();
  registerAutoRefresh(app);
  (globalThis as any).__MOVIE_FOLDER_PATH = M.folderPath;
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

/** 卸载清理（main.ts onunload 调用） */
export function unloadMovie(): void {
  initialized = false;
  autoRefreshRegistered = false;
  resetMovieState();
}

import { resetMovieState } from './state';
export { STATUS_WATCHING, STATUS_WANT };
