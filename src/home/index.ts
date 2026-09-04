/**
 * 内容首页（home 域）入口：懒加载初始化 + 打开/关闭 + 卸载。
 * ADR-0093：旧入口页 launcher 已退役删除，本域为唯一入口首页。
 */
import type { App } from 'obsidian';
import { H, resetHomeState } from './state';
import { createOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler, stopSnapshotTimer } from './ui';

let initialized = false;
let escRegistered = false;

/** 幂等初始化（懒加载）：仅记录 app 引用 */
export function ensureHome(app: App): void {
  if (initialized) return;
  initialized = true;
  H.appRef = app;
}

/** 打开内容首页（命令 bz-home-open，toggle 语义） */
export function openHome(app: App): void {
  ensureHome(app);
  if (H.currentOverlay) {
    closeOverlay();
    return;
  }
  if (!escRegistered) {
    escRegistered = true;
    registerEscapeHandler();
  }
  createOverlay(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadHome(): void {
  initialized = false;
  if (escRegistered) {
    escRegistered = false;
    unregisterEscapeHandler();
  }
  stopSnapshotTimer(); // 卸载不走 closeOverlay，计时器单独清
  if (H.currentOverlay) {
    H.currentOverlay.remove();
    H.currentOverlay = null;
  }
  resetHomeState();
}
