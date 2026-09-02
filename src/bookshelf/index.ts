/**
 * 书架墙（bookshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 并存式新域（cinema 先例）：与旧 library 域数据同源但独立实现；
 * 用户后续会删除旧 library 域，本域独立承担书库 UI。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { M, resetBookshelfState } from './state';
import { resolveFolderPath } from './data';
import { createOverlay, closeOverlay, registerEscapeHandler, renderAll } from './ui';
import { rebuildItems } from './data';

let initialized = false;
let autoRefreshRegistered = false;

/** 幂等初始化（懒加载）：目录设置注入 + ESC + 自动刷新 */
export function ensureBookshelf(app: App): void {
  if (initialized) return;
  initialized = true;
  M.appRef = app;
  M.folderPath = resolveFolderPath();
  registerEscapeHandler();
  registerAutoRefresh(app);
}

/** 域事件自动刷新（bookshelf/library/vault 多通道，防抖 300ms，仅 overlay 打开时刷新）。
 *  数据与旧 library 域同源：library 域写 frontmatter 后本域同样需要刷新，故并听 library 通道。 */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: { path?: string }) => {
    if (file && file.path && !file.path.startsWith(M.folderPath + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      void rebuildItems(app).then(() => renderAll(app));
    }, 300);
  };
  for (const kind of ['bookshelf', 'library']) {
    onDomainEvent<{ path: string }>(`${kind}:file-created`, (evt) => schedule({ path: evt.path }));
    onDomainEvent<{ path: string }>(`${kind}:file-deleted`, (evt) => schedule({ path: evt.path }));
    onDomainEvent<{ path: string }>(`${kind}:file-modified`, (evt) => schedule({ path: evt.path }));
  }
  onDomainEvent<{ path: string }>('vault:md-created', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-modified', (evt) => schedule({ path: evt.path }));
}

/** 打开书架墙（命令 bz-bookshelf-open，toggle 语义） */
export function openBookshelf(app: App): void {
  ensureBookshelf(app);
  if (M.currentOverlay) {
    closeOverlay();
    return;
  }
  createOverlay(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBookshelf(): void {
  initialized = false;
  autoRefreshRegistered = false;
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  if (M.drawerEl) {
    M.drawerEl.remove();
    M.drawerEl = null;
  }
  document.querySelectorAll('.bz-bs-overlay, .bz-bs-drawer-mask').forEach((el) => el.remove());
  resetBookshelfState();
}
