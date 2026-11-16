/**
 * 内容首页（home 域）入口：懒加载初始化 + 打开/关闭 + 卸载。
 * ADR-0093：旧入口页 launcher 已退役删除，本域为唯一入口首页。
 */
import type { App } from 'obsidian';
import { disarmHomeReturn } from '../core/home-return';
import { H, resetHomeState } from './state';
import { prewarmRiver, resetRiverCache } from './river-cache';
import { invalidateHomeOrder, loadHomeOrder } from './order';
import { createOverlay, showOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler, unmountPanelResize } from './ui';

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

/**
 * 启动后台预热活动河数据（2026-11-15）：只填会话缓存，不建 DOM、不实例化面板（ADR-0003 兼容）。
 * 首开首页命中缓存就能省掉一次约 20 轮全库遍历；卸载旗标为真时短路，防幽灵任务（C13）。
 * 幂等；失败静默，真正打开时刷新会自行回源并呈现错误态。
 */
export function prewarmHome(app: App, isUnloaded: () => boolean = () => false): void {
  prewarmRiver(app, isUnloaded);
  // 入口顺序预热（2026-11-15 发版 review）：一次 readFile，比采集便宜得多；先读到缓存，
  // 首开铺壳就能按用户的真实顺序铺，不必「先默认、数据回来再整屏重排」。
  void loadHomeOrder(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadHome(): void {
  initialized = false;
  resetRiverCache(); // 缓存与域事件订阅一并复位，重新启用插件时重新预热
  invalidateHomeOrder(); // 顺序缓存同批作废（换库 / 重新启用都该重新读）
  // 卸载 = 本次会话全部作废：摘掉「关闭功能后回首页」的等待，防插件已经卸载还重建首页
  disarmHomeReturn();
  unregisterEscapeHandler();
  unmountPanelResize(); // 缩放句柄随卸载摘除：模块级句柄不随 DOM 移除自清，漏摘会让重开后的新面板被「已挂」误判跳过
  if (H.currentOverlay) {
    H.currentOverlay.remove();
    H.currentOverlay = null;
  }
  resetHomeState();
}
