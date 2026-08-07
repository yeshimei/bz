/**
 * app 引用（各域模块共享，取代原脚本的全局 app / window.__ 状态）。
 * 原 QuickAdd 脚本直接使用 QuickAdd 传入的全局 app；插件版统一经此模块注入。
 */
import type { App } from 'obsidian';

let _app: App | null = null;

export function setApp(app: App) {
  _app = app;
}

export function getApp(): App {
  if (!_app) {
    throw new Error('memo-suite: app 未初始化（setApp 未调用）');
  }
  return _app;
}
