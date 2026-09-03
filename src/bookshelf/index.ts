/**
 * 书架墙（bookshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 并存式新域（cinema 先例）：与旧 library 域数据同源但独立实现；
 * 用户后续会删除旧 library 域，本域独立承担书库 UI。
 */
import type { App, EventRef } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { M, resetBookshelfState } from './state';
import { resolveFolderPath, rebuildItems, WEAVE_DATA_FILE } from './data';
import { createOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler, renderAll } from './ui';

let initialized = false;
let autoRefreshRegistered = false;
// B5：订阅句柄统一收集（域事件退订函数 + vault modify EventRef），卸载时全部释放
let autoRefreshOffs: (() => void)[] = [];
let weaveVaultRef: EventRef | null = null;

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
 *  数据与旧 library 域同源：library 域写 frontmatter 后本域同样需要刷新，故并听 library 通道。
 *  B2：目录过滤每次用 resolveFolderPath() 动态取（设置改目录后监听跟着新目录走，不一次定格）。 */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: { path?: string }) => {
    if (file && file.path && !file.path.endsWith(WEAVE_DATA_FILE)
      && !file.path.startsWith(resolveFolderPath() + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      void rebuildItems(app).then(() => renderAll(app));
    }, 300);
  };
  for (const kind of ['bookshelf', 'library']) {
    autoRefreshOffs.push(onDomainEvent<{ path: string }>(`${kind}:file-created`, (evt) => schedule({ path: evt.path })));
    autoRefreshOffs.push(onDomainEvent<{ path: string }>(`${kind}:file-deleted`, (evt) => schedule({ path: evt.path })));
    autoRefreshOffs.push(onDomainEvent<{ path: string }>(`${kind}:file-modified`, (evt) => schedule({ path: evt.path })));
  }
  for (const ch of ['vault:md-created', 'vault:md-deleted', 'vault:md-modified']) {
    autoRefreshOffs.push(onDomainEvent<{ path: string }>(ch, (evt) => schedule({ path: evt.path })));
  }
  // B4：EPUB 数据来自 weave-data.json（外部 Weave 阅读器直写，core vault 适配器只转发 .md），
  // 域内自挂 vault modify 补 json 通道；B5：EventRef 一并登记，卸载 offref
  weaveVaultRef = app.vault.on('modify', (file) => {
    schedule({ path: (file as { path?: string })?.path });
  });
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
  // B5：退订全部域事件 + vault modify
  autoRefreshOffs.forEach((off) => off());
  autoRefreshOffs = [];
  if (weaveVaultRef) {
    M.appRef?.vault.offref(weaveVaultRef);
    weaveVaultRef = null;
  }
  unregisterEscapeHandler(); // B1：注销 ESC 层
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
