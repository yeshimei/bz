/**
 * 闪念（ticket 18）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 18 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensureFlash(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 18): 闪念七模块初始化（FloatWindow/ReferencePanel/ChatPanel/MobilePanel + TFIDF/VectorStore）
}

export function openFlashReference(app: App): void {
  ensureFlash(app);
  new Notice('「闪念」正在迁移中（ticket 18）');
}

export function openFlashChat(app: App): void {
  ensureFlash(app);
  new Notice('「闪念」正在迁移中（ticket 18）');
}
