/* ============================================================
 * bz 组件库 · 通用全屏（src/core/ui/global-fullscreen.ts）
 * 命令 bz-core-fullscreen（2026-11-10 用户拍板，承接 GitHub issue #1）：
 *   把当前最上层的 bz 主面板铺满整个 Obsidian 窗口；再执行一次或按 ESC 还原。
 *
 * 与已退役的「剪藏本全屏」（bz-clipbook-fullscreen）的区别：不再绑死某一个域——
 * 找的是挂了 .bz-main-panel 的当前主面板（core/ui/main-panel），任何域都适用；
 * 番茄钟与桌宠不挂标记，天然不参与。
 *
 * 全屏只加一个类、绝不写尺寸记忆：宽度走 100vw、高度走 --bz-vvh（移动端软键盘
 * 收缩），面板自己的拖拽缩放句柄在全屏期间空转（core/ui/resize 判类早退），
 * 退出后内联宽高原样还在——用户原来的窗口大小不会被污染。
 * ============================================================ */
import { notice } from '../notice';
import { isMobileEnv } from '../mobile';
import { escManager } from '../esc-manager';
import { isShown, NO_FULLSCREEN_CLASS, topMainPanel } from './main-panel';

/** 全屏类（CSS 在 core/ui/components.css：只改几何，不改任何域内版式） */
export const GLOBAL_FULL_CLASS = 'bz-global-full';

/** 当前被全屏的面板（只活在 DOM 生命周期内；面板关闭即随 DOM 一起失去意义） */
let activePanel: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

/** 全屏层还在不在（ESC 判活 + 命令复用判据） */
function stillActive(): boolean {
  return !!activePanel && isShown(activePanel) && activePanel.classList.contains(GLOBAL_FULL_CLASS);
}

/** 清掉状态与 ESC 层（退出全屏 / 面板已离场时都走这里；幂等） */
function cleanup(): void {
  escHandle?.unregister();
  escHandle = null;
  activePanel = null;
}

function exitFullscreen(): void {
  activePanel?.classList.remove(GLOBAL_FULL_CLASS);
  cleanup();
}

function enterFullscreen(panel: HTMLElement): void {
  activePanel = panel;
  panel.classList.add(GLOBAL_FULL_CLASS);
  // ESC 层在进入时注册 = 落在栈顶：先退全屏，再轮到面板自己的关闭层
  escHandle = escManager.register('bz-core-fullscreen', {
    isVisible: () => stillActive(),
    close: () => exitFullscreen(),
  });
}

/**
 * 命令落点：全屏 ⇄ 还原。
 *  - 面板已全屏 → 还原；
 *  - 没有主面板（报告层/提示层）→ 只提示，不做动作；
 *  - 手机端本来就是满屏 → 只提示；
 *  - 面板已被关掉（全屏类随 DOM 消失）→ 静默清状态，当作新的一次。
 */
export function toggleGlobalFullscreen(): void {
  if (activePanel && !stillActive()) cleanup();
  if (activePanel) {
    exitFullscreen();
    return;
  }
  if (isMobileEnv()) {
    notice('手机端本来就是满屏', 'info');
    return;
  }
  const panel = topMainPanel();
  if (!panel) {
    notice('当前界面没有可放大的窗口', 'info');
    return;
  }
  // 番茄钟等「不参与全屏」的主面板（bz-no-fullscreen）：只提示，不放大
  if (panel.classList.contains(NO_FULLSCREEN_CLASS)) {
    notice('这个界面不参与全屏', 'info');
    return;
  }
  enterFullscreen(panel);
}

/** 插件卸载：只摘本层状态（ESC 管理器自己软关，无需半路清栈） */
export function unloadGlobalFullscreen(): void {
  if (activePanel) activePanel.classList.remove(GLOBAL_FULL_CLASS);
  cleanup();
}
