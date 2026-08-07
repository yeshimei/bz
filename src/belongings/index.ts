/**
 * 归物本域入口（ticket 06）
 * 命令（belongings-add-item）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureBelongings 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { openBelongingsPanel, addBelongingsItemCommand, cleanupBelongings } from './ui';

let initialized = false;

export function ensureBelongings(app: App): void {
  if (initialized) return;
  initialized = true;
  // 归物本无常驻监听；首次命令/面板打开时初始化
}

export function addBelongingsItem(app: App): void {
  ensureBelongings(app);
  addBelongingsItemCommand();
}

/** 打开归物本面板（ribbon 无入口，经面板互调/开发用） */
export function openBelongings(app: App): void {
  ensureBelongings(app);
  void openBelongingsPanel();
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBelongings(): void {
  cleanupBelongings();
  initialized = false;
}
