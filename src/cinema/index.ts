/**
 * 影院（cinema）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 自 ADR-0087 起接管原 movie 域（旧 src/movie 已退役）；目录回落 cinemaFolderPath → 默认。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { M, resetCinemaState, DEFAULT_FOLDER } from './state';
import { rebuildItems } from './data';
import { createOverlay, closeOverlay, registerEscapeHandler, renderAll, openAddModalDirect } from './ui';
import { stopAllPosterWatch } from './poster-watch';

let initialized = false;
let autoRefreshRegistered = false;

/** 幂等初始化（懒加载）：设置注入 + ESC + 自动刷新 */
export function ensureCinema(app: App): void {
  if (initialized) return;
  initialized = true;
  M.appRef = app;
  const s = tryGetSettings() as Record<string, unknown>;
  // 目录：cinemaFolderPath 显式配置优先，缺省回落默认（旧 movieFolderPath 键已随 movie 域退役删除）
  M.folderPath =
    typeof s.cinemaFolderPath === 'string' && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : DEFAULT_FOLDER;
  registerEscapeHandler();
  registerAutoRefresh(app);
}

/** 域事件自动刷新（cinema/vault 多通道，防抖 300ms，仅 overlay 打开时刷新）。
 *  订阅 cinema:file-* 与 vault:md-*（movie:file-* 通道已随旧域退役）——按 M.folderPath 前缀过滤 */
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
  for (const kind of ['cinema']) {
    onDomainEvent<{ path: string }>(`${kind}:file-created`, (evt) => schedule({ path: evt.path }));
    onDomainEvent<{ path: string }>(`${kind}:file-deleted`, (evt) => schedule({ path: evt.path }));
    onDomainEvent<{ path: string }>(`${kind}:file-modified`, (evt) => schedule({ path: evt.path }));
  }
  onDomainEvent<{ path: string }>('vault:md-created', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-modified', (evt) => schedule({ path: evt.path }));
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

/**
 * 打开影院并切到影视分析页（命令 bz-cinema-analysis，ADR-0090 报告内嵌化）：
 * 原独立报告窗退役，命令直达影院面板分析页（不新造第二套面板）。
 * 幂等语义：面板未开则开并落分析页；已开则就地切分析页重渲染（不再 toggle 关闭）。
 */
export function openCinemaAnalysis(app: App): void {
  ensureCinema(app);
  M.view = 'stat';
  if (M.currentOverlay) renderAll(app);
  else createOverlay(app);
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
  stopAllPosterWatch(); // 摘除海报轮询 interval（卸载后不再读文件/写通知）
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  resetCinemaState();
}
