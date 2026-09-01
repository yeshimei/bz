/**
 * 影院（cinema）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 新域与 movie 域并存；用户后续会删除旧 movie 域，本域独立不复用其代码
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { M, resetCinemaState } from './state';
import { rebuildItems } from './data';
import { createOverlay, closeOverlay, registerEscapeHandler, renderAll, openAddModalDirect } from './ui';

let initialized = false;
let autoRefreshRegistered = false;

/** 幂等初始化（懒加载）：设置注入 + ESC + 自动刷新 */
export function ensureCinema(app: App): void {
  if (initialized) return;
  initialized = true;
  M.appRef = app;
  const s = tryGetSettings() as Record<string, unknown>;
  if (typeof s.cinemaFolderPath === 'string' && s.cinemaFolderPath) {
    M.folderPath = s.cinemaFolderPath;
  }
  registerEscapeHandler();
  registerAutoRefresh(app);
}

/** 域事件自动刷新（cinema:file-created/deleted/modified，防抖 300ms，仅 overlay 打开时刷新） */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: { path?: string }) => {
    if (file && file.path && !file.path.startsWith(M.folderPath + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      rebuildItems(app);
      renderAll(app);
    }, 300);
  };
  onDomainEvent<{ path: string }>('cinema:file-created', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('cinema:file-deleted', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('cinema:file-modified', (evt) => schedule({ path: evt.path }));
}

/** 打开影院（命令 bz-cinema-open，toggle 语义） */
export function openCinema(app: App): void {
  ensureCinema(app);
  if (M.currentOverlay) {
    closeOverlay();
    return;
  }
  createOverlay(app);
}

/** 添加影视（命令 bz-cinema-add） */
export function addCinemaItem(app: App): void {
  ensureCinema(app);
  openAddModalDirect(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadCinema(): void {
  initialized = false;
  autoRefreshRegistered = false;
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  document.querySelectorAll('.bz-cinema-mask').forEach((el) => el.remove());
  resetCinemaState();
}
