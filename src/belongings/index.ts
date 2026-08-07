/**
 * 归物本（ticket 06）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 06 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureBelongings(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 06): 归物本数据层 + UI 初始化
}

export function addBelongingsItem(app: App): void {
  ensureBelongings(app);
  new Notice('「归物本」正在迁移中（ticket 06）');
}
