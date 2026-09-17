/**
 * 游戏架（gameshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载（影院同范式）。
 * 打开时自动同步：已配置才拉，间隔判定在 runSync 内（无笔记 syncedAt=0 必过期 → 首次必拉）。
 */
import type { App } from 'obsidian';
import { M, resetGameshelfState, resolveGameshelfFolderPath } from './state';
import { rebuildItems } from './notes';
import { ensurePosters, mediaItemsOf, unloadPosters } from './posters';
import { ensureZhNames, unloadZhNames } from './names';
import { closePanel, openPanel, renderAll } from './ui';

let initialized = false;

/** 幂等初始化：目录每次读设置（域内改目录立即生效），ESC 随面板开关注册注销 */
export function ensureGameshelf(app: App): void {
  M.folderPath = resolveGameshelfFolderPath();
  if (initialized) return;
  initialized = true;
  M.appRef = app;
}

/** 打开游戏架（命令 bz-gameshelf-open，toggle 语义） */
export function openGameshelf(app: App): void {
  ensureGameshelf(app);
  if (M.currentOverlay) {
    closePanel();
    return;
  }
  rebuildItems(app);
  // 面板先出（本地数据立即可见），自动同步后台补新鲜度
  openPanel(app);
  void import('./sync').then(async (m) => {
    await m.autoSyncOnOpen(app);
    renderAll(app);
    ensurePosters(app, mediaItemsOf(M.items));
    ensureZhNames(app, M.items);
  });
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadGameshelf(): void {
  initialized = false;
  closePanel();
  unloadPosters();
  unloadZhNames();
  resetGameshelfState();
}
