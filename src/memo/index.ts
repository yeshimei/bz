/**
 * 备忘录域入口（ticket 04/05）
 * 命令（memo-open-panel / memo-create-item）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureMemo 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { App as MemoApp } from './app';
import { UIManager } from './ui';
import type { MemoSettingsLike } from './data';

let settingsProvider: (() => MemoSettingsLike) | null = null;

/** main.ts 注入插件设置读取器 */
export function setMemoSettingsProvider(fn: () => MemoSettingsLike): void {
  settingsProvider = fn;
}

function getMemoSettings(): MemoSettingsLike {
  return settingsProvider ? settingsProvider() : {};
}

export async function ensureMemo(app: App): Promise<void> {
  if (MemoApp.initialized) return;
  await MemoApp.init(getMemoSettings());
}

export function openMemoPanel(app: App): void {
  void ensureMemo(app).then(() => {
    UIManager.showMain(null, false);
  });
}

export function createMemoItem(app: App): void {
  void ensureMemo(app).then(() => {
    UIManager.showAddDialog(null);
  });
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadMemo(): void {
  MemoApp.unload();
}
