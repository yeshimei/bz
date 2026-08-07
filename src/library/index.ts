/**
 * 书库（ticket 12）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 12 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureLibrary(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 12): 书库数据层 + UI 初始化
}

export function openLibrary(app: App): void {
  ensureLibrary(app);
  new Notice('「书库」正在迁移中（ticket 12）');
}

export function openBookNotes(app: App): void {
  ensureLibrary(app);
  new Notice('「书库」正在迁移中（ticket 12）');
}
