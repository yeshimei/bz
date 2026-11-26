/**
 * 「从宿主设置页进入 bz 设置面板」的交接（2026-11-26 用户反馈修复）。
 *
 * 现象：Obsidian 自带设置 → bz → 点「打开设置面板」，移动端面板里的输入框全部失效——
 * iPad 上打字全落进设置页自己的搜索框，iPhone 与安卓干脆输不进去；同一条路从命令面板 /
 * 首页打开则完全正常（安卓也复现，排除了 iOS 输入法特例）。
 *
 * 原因：宿主设置是 Obsidian 自己的顶层 Modal，开着的时候持有焦点与键盘 scope。bz 面板是
 * 自绘 overlay（挂在 body、z 序更高），视觉上盖住了设置页，但输入焦点仍被宿主 Modal 攥着：
 * 点面板里的输入框，焦点被抢回宿主，字就进了设置搜索框（或根本弹不出输入法）。
 *
 * 做法：先把宿主设置收起来，等它真的从台面上消失再开面板。不按固定延迟拍脑袋——关闭
 * 动画时长随版本和端变：轮询到容器摘除 / 撤掉 .is-visible 为止；最多等 MAX_WAIT_MS，
 * 超时照开——宁可差一帧，也不能让人点了没反应。
 */

/** 收起等待上限：超时直接开面板（比「点了没反应」诚实） */
export const HOST_CLOSE_MAX_WAIT_MS = 1000;
/** 收起重检查间隔：一帧多点；移动端 Modal 关闭是 200ms 量级的动画 */
const POLL_MS = 40;

/** 宿主内部单例（非公开 API，拿不到就静默） */
interface HostSettingCloser {
  setting?: { close?: () => void };
}

/** 关闭装着当前设置页的宿主 Modal；返回该容器（不是 Modal 形态则 null） */
export function closeHostSettings(app: unknown, containerEl: HTMLElement): HTMLElement | null {
  const host = containerEl.closest('.modal-container') as HTMLElement | null;
  if (!host) {
    // 非 Modal 形态（或已被挪出）：退回宿主内部单例，拿不到就算了，不影响后续开面板
    (app as HostSettingCloser | null)?.setting?.close?.();
    return null;
  }
  const closeBtn = host.querySelector('.modal-close-button') as HTMLElement | null;
  if (closeBtn) closeBtn.click();
  else (app as HostSettingCloser | null)?.setting?.close?.();
  return host;
}

/** 宿主还在台面上：容器仍在文档里且没撤 is-visible */
function hostStillVisible(host: HTMLElement): boolean {
  return host.isConnected && host.classList.contains('is-visible');
}

/** 收起宿主设置，确认它离场后执行 run；没有宿主 Modal 时立即执行 */
export function afterHostSettingsClosed(
  app: unknown,
  containerEl: HTMLElement,
  run: () => void,
  maxWaitMs: number = HOST_CLOSE_MAX_WAIT_MS,
): void {
  const host = closeHostSettings(app, containerEl);
  if (!host) {
    run();
    return;
  }
  const started = Date.now();
  const tick = (): void => {
    if (!hostStillVisible(host) || Date.now() - started >= maxWaitMs) {
      run();
      return;
    }
    window.setTimeout(tick, POLL_MS);
  };
  tick();
}
