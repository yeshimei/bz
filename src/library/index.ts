/**
 * 书库入口（ticket 12）
 * 命令（open-library/open-book-notes）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 */
import type { App } from 'obsidian';
import { notice } from '../core/dom';
import { showLibrary, showBookNotes, _testResetLibrary } from './ui';
import { deriveBookSettings } from './items';

let initialized = false;

/** 幂等初始化（懒加载；设置快照在每次打开时刷新） */
export function ensureLibrary(app: App): void {
  if (initialized) return;
  initialized = true;
  deriveBookSettings();
}

/** 打开书库（open-library 命令回调） */
export function openLibrary(app: App): void {
  ensureLibrary(app);
  showLibrary(app);
}

/** 打开读书笔记（open-book-notes 命令回调；无活动文件提示） */
export function openBookNotes(app: App): void {
  ensureLibrary(app);
  const activeFile = (app as any).workspace.getActiveFile();
  if (activeFile) {
    showBookNotes(app, activeFile.path);
  } else {
    notice('没有打开的文件');
  }
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadLibrary(): void {
  _testResetLibrary();
  initialized = false;
}
