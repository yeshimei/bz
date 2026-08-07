/**
 * 剪藏本（ticket 08）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 08 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureClipping(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 08): 剪藏本数据层 + UI 初始化
}

export function openArticleView(app: App): void {
  ensureClipping(app);
  new Notice('「剪藏本」正在迁移中（ticket 08）');
}
