/**
 * 备忘录域入口（ticket 04/05）
 * 命令（bz-memo-open-panel / bz-memo-create-item）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureBz 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { App as MemoApp } from './app';
import { UIManager } from './ui';
import type { BzSettingsLike } from './data';

let settingsProvider: (() => BzSettingsLike) | null = null;

/** main.ts 注入插件设置读取器 */
export function setBzSettingsProvider(fn: () => BzSettingsLike): void {
  settingsProvider = fn;
}

function getBzSettings(): BzSettingsLike {
  return settingsProvider ? settingsProvider() : {};
}

export async function ensureBz(app: App): Promise<void> {
  if (MemoApp.initialized) return;
  await MemoApp.init(getBzSettings());
}

export function openBzPanel(app: App): void {
  void ensureBz(app).then(() => {
    UIManager.showMain(null, false);
  });
}

export function createMemoItem(app: App): void {
  void ensureBz(app).then(() => {
    UIManager.showAddDialog(null);
  });
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBz(): void {
  MemoApp.unload();
}
