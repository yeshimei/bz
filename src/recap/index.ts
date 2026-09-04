/**
 * 今日回顾（recap 域）入口：懒加载初始化 + 打开/关闭（toggle 语义）+ 卸载。
 * 对齐 home/index.ts 先例；数据采集在 ui 层（打开即采，不常驻轮询）。
 */
import type { App } from 'obsidian';
import { H, resetRecapState } from './state';
import { createOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler } from './ui';

let initialized = false;
let escRegistered = false;

/** 幂等初始化（懒加载）：仅记录 app 引用 */
export function ensureRecap(app: App): void {
  if (initialized) return;
  initialized = true;
  H.appRef = app;
}

/** 打开今日回顾（命令 bz-recap-today，toggle 语义） */
export function openRecap(app: App): void {
  ensureRecap(app);
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
export function unloadRecap(): void {
  initialized = false;
  if (escRegistered) {
    escRegistered = false;
    unregisterEscapeHandler();
  }
  if (H.currentOverlay) {
    H.currentOverlay.remove();
    H.currentOverlay = null;
  }
  resetRecapState();
}
