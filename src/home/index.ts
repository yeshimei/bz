/**
 * 内容首页（home 域）入口：懒加载初始化 + 打开/关闭 + 卸载。
 * ADR-0093：旧入口页 launcher 已退役删除，本域为唯一入口首页。
 */
import type { App } from 'obsidian';
import { H, resetHomeState } from './state';
import { createOverlay, showOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler } from './ui';

let initialized = false;

/** 幂等初始化（懒加载）：仅记录 app 引用 */
function ensureHome(app: App): void {
  if (initialized) return;
  initialized = true;
  H.appRef = app;
}

/**
 * 打开内容首页（命令 bz-home-open，toggle 语义；issue 290 三分支）：
 *  - 显示中 → 关闭（隐藏保留 DOM，重开秒显）；
 *  - 隐藏保留中 → 复用同一 DOM：原地秒显上次渲染 + 立即动态刷新时间线；
 *  - 从未创建 → 首次：同步出骨架（秒开），数据异步汇入。
 */
export function openHome(app: App): void {
  ensureHome(app);
  if (H.currentOverlay) {
    if (H.overlayVisible) {
      closeOverlay();
      return;
    }
    showOverlay();
    return;
  }
  registerEscapeHandler();
  createOverlay(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadHome(): void {
  initialized = false;
  unregisterEscapeHandler();
  if (H.currentOverlay) {
    H.currentOverlay.remove();
    H.currentOverlay = null;
  }
  resetHomeState();
}
