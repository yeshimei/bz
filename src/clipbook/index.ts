/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：域入口/懒加载（ADR-0003）。
 *
 * 命令（bz-clipbook-open）由 main.ts 裸注册回调 openClipbook；
 * 幂等初始化 ensure → ui.initPanel 建面板（首次）+ show；卸载 unloadClipbook。
 * 旧 news/clipping 入口命令断开后，本域是「剪藏本」唯一入口。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { initPanel, showPanel, unloadPanel, reloadIfOpen } from './ui';

let initialized = false;
let autoRefreshRegistered = false;

/** 幂等初始化（懒加载）：建面板 DOM + 订阅目录自动刷新 */
export function ensureClipbook(app: App): void {
  if (initialized) return;
  initialized = true;
  registerAutoRefresh(app);
  initPanel(app);
}

/** 打开剪藏本（bz-clipbook-open 命令回调） */
export function openClipbook(app: App): void {
  if (!initialized) {
    initialized = true;
    registerAutoRefresh(app);
    initPanel(app, true);
  } else {
    showPanel();
  }
}

/** 卸载清理（main.ts onunload） */
export function unloadClipbook(): void {
  if (!initialized) return;
  initialized = false;
  unloadPanel();
  autoRefreshRegistered = false;
}

/** 目录/数据变化自动刷新（clipping:file-* 域事件，仅面板打开时重载；300ms 防抖） */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const dir = () => {
    const s = tryGetSettings() as any;
    return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
  };
  const schedule = (path?: string) => {
    const d = dir();
    if (path && !path.startsWith(d + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reloadIfOpen();
    }, 300);
  };
  onDomainEvent<{ path: string }>('clipping:file-created', (e) => schedule(e && e.path));
  onDomainEvent<{ path: string }>('clipping:file-modified', (e) => schedule(e && e.path));
  onDomainEvent<{ path: string }>('clipping:file-deleted', (e) => schedule(e && e.path));
  onDomainEvent<{ oldPath: string; newPath: string }>('clipping:file-renamed', (e) => schedule(e && e.newPath));
}
