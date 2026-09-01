/**
 * 设置面板域入口（settings-panel，ADR-0080）
 * 命令 bz-settings-panel-open 由 main.ts 裸注册。
 * 懒加载：ensureSettingsPanel 幂等初始化（ADR-0003）。
 * 与既有设置架构（全局设置页 + 域 ⚙️ 弹窗）并存：面板是聚合浏览入口，
 * 设置读写仍走既有声明式 schema 与 settings-provider。
 */
import type { App } from 'obsidian';
import { getApp } from '../core/app';
import { SettingsPanelUI } from './ui';

let initialized = false;
let ui: SettingsPanelUI | null = null;

function getUI(): SettingsPanelUI {
  if (!ui) {
    ui = new SettingsPanelUI();
  }
  return ui;
}

/** 幂等初始化（当前为轻量创建，无需异步准备） */
export async function ensureSettingsPanel(_app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
}

/** 打开设置面板（命令 bz-settings-panel-open） */
export function openSettingsPanel(app: App): void {
  void ensureSettingsPanel(app).then(() => getUI().open());
}

/** 卸载清理（main.ts onunload 调用，幂等） */
export function unloadSettingsPanel(): void {
  if (ui) ui.cleanup();
  ui = null;
  initialized = false;
}
