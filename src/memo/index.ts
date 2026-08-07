/**
 * 备忘录（ticket 04/05）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 04/05 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

/** 幂等初始化（懒加载架构，ADR-0003：UI 域首次打开初始化） */
export function ensureMemo(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 04/05): 备忘录数据层 + UI 初始化
}

export function openMemoPanel(app: App): void {
  ensureMemo(app);
  new Notice('「备忘录」正在迁移中（ticket 04）');
}

export function createMemoItem(app: App): void {
  ensureMemo(app);
  new Notice('「备忘录」正在迁移中（ticket 04）');
}
