/**
 * 归物本域入口（ticket 06 移植 + ticket 177 重构）
 * 命令（belongings-add-item/belongings-open）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureBelongings 幂等初始化（ADR-0003）。归物本无常驻监听。
 */
import type { App } from 'obsidian';
import { openPanel, openForm, cleanupBelongings } from './ui';

let initialized = false;

export function ensureBelongings(app: App): void {
  if (initialized) return;
  initialized = true;
}

/** 添加物品（bz-belongings-add 命令：直接弹记一笔表单） */
export function addBelongingsItem(app: App): void {
  ensureBelongings(app);
  openForm(null);
}

/** 打开归物本面板（bz-belongings-open 命令） */
export function openBelongings(app: App): void {
  ensureBelongings(app);
  void openPanel();
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBelongings(): void {
  cleanupBelongings();
  initialized = false;
}
