/**
 * 书架墙（bookshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 并存式新域（cinema 先例）：与旧 library 域数据同源但独立实现；
 * 用户后续会删除旧 library 域，本域独立承担书库 UI。
 * 读书报告内嵌化：报告是本域面板内的视图——openBookshelfReport 供命令
 * bz-reading-report-open（home 报告磁贴/剪藏本深链/本域报告入口同一去向）调用。
 */
import type { App, EventRef } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { M, resetBookshelfState, applyDefaultView } from './state';
import { resolveFolderPath, rebuildItems, WEAVE_DATA_FILE } from './data';
import {
  createOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler,
  renderAll, refreshReportView, openReportView,
} from './ui';
import { cancelReadingReport } from '../reading-report';
import { closeBookNoteModals } from './notes-ui';

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

/** 域事件自动刷新（vault 通道 + EPUB json，防抖 300ms，仅 overlay 打开时刷新）。
 *  audit H：bookshelf:file-* / library:file-* 六个订阅已删除——FileDomainKind 不含这两域，
 *  `<域>:file-*` 通道对它们从不发布（白挂 8 个监听）；vault:md-* + vault modify 已覆盖刷新面。
 *  读书报告内嵌化：报告视图存续期间书库数据变化 → 自动重算只更新报告内容区（renderAll 免跑）。 */
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
      void rebuildItems(app).then(() => {
        if (M.view === 'report') refreshReportView(app); // 报告视图：只重算报告内容区
        else renderAll(app);
      });
    }, 300);
  };
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
  applyDefaultView();
  createOverlay(app);
}

/** 打开书架墙并切到阅读分析报告视图（命令 bz-reading-report-open；原独立报告弹窗已退役）。
 *  面板已开则只切视图（重入重算报告内容）；未开则冷开面板直落报告视图。 */
export function openBookshelfReport(app: App): void {
  ensureBookshelf(app);
  openReportView(app);
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
  closeBookNoteModals(); // 读书笔记弹窗（迁移自旧 library 域）：卸载不留孤儿浮层
  cancelReadingReport(); // 报告视图在途分片渲染作废 + progress toast 收起
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
