/**
 * 密码本（ticket 07）
 * 占位骨架：命令入口与幂等初始化已就位，实现随 ticket 07 填充。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';

let initialized = false;

export function ensurePassword(app: App): void {
  if (initialized) return;
  initialized = true;
  // TODO(ticket 07): 密码本数据层 + UI 初始化
}

export function openPasswordManager(app: App): void {
  ensurePassword(app);
  new Notice('「密码本」正在迁移中（ticket 07）');
}

export function addPasswordEntry(app: App): void {
  ensurePassword(app);
  new Notice('「密码本」正在迁移中（ticket 07）');
}

export function generatePassword(app: App): void {
  ensurePassword(app);
  new Notice('「密码本」正在迁移中（ticket 07）');
}
