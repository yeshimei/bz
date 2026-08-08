/**
 * 入口页域入口（ticket 23）。
 * 命令（bz-launcher-open）由 main.ts 裸注册，此处提供回调。
 * 懒加载：首次命令触发时创建单例弹窗（ADR-0003 幂等语义：单例防重开）。
 */
import { getApp } from '../core/app';
import { openLauncher, unloadLauncher } from './ui';

/** 打开入口页（main.ts 命令回调） */
export function openLauncherPanel(app?: any): void {
  openLauncher(app || getApp());
}

/** 卸载清理（main.ts onunload 调用）：关闭残留弹窗 */
export function unloadLauncherPanel(): void {
  unloadLauncher();
}

export { LauncherModal } from './ui';
export * from './data';
