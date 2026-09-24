/**
 * 记忆分析 · 装配（覆盖复习面板的一层，十六幕长片）
 *
 * 形态与影院观影分析 / 剪藏读报特刊同构（ADR-0175 口径）：层框 = 复习面板矩形
 * （resize 跟随）、点框外/ESC 关、移动端给关闭钮；内容是复习域自己的「守火」语言
 * （analysis/ 四件套）。降级（参照 press 口径）：
 *  - 无动画宿主（jsdom/老壳）或全库无条目 → 落回经典统计弹层 showStatsModal；
 *  - 打开链路任何异常 → 同样落回经典统计弹层，分析层绝不挡住统计主路径。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../../core/z-order';
import { escManager } from '../../core/esc-manager';
import { fitRotatedBox } from '../../core/landscape';
import { ensureReview, dataManager } from '../index';
import { reviewApp } from '../app';
import type { RaData } from './data';
import { deriveAnalysis } from './data';
import { analysisHtml, analysisFixedHtml } from './view';
import { bindAnalysis, type RaHandle } from './engine';

let raOvl: HTMLElement | null = null;
let raHandle: RaHandle | null = null;
let raEsc: { unregister(): void } | null = null;
let raSync: (() => void) | null = null;
let raRo: ResizeObserver | null = null;

/** 移动端判定（关闭钮显隐与软横屏转置同口径）：视口窄即按移动算（原型移动 iframe 也命中） */
const isNarrow = (): boolean => {
  try { return window.matchMedia('(max-width: 768px)').matches; } catch { return false; }
};

/** 层框 = 复习面板矩形（同 ADR-0175 几何口径）；几何与软横屏转置单源 core/landscape
 *  （移动竖屏横屏呈现，影院观影分析同款）。面板没几何时给视口内边距兜底（兜底态不转）。 */
function fitRaBox(box: HTMLElement, panel: HTMLElement | null): void {
  const fit = fitRotatedBox(box, panel, isNarrow());
  if (!fit || !panel) {
    box.style.left = '16px';
    box.style.top = '16px';
    box.style.width = 'calc(100vw - 32px)';
    box.style.height = 'calc(100vh - 32px)';
    box.style.fontSize = '16px';
    return;
  }
  const base = Math.max(12, Math.min(19, 12 * Math.min(fit.w / 900, fit.h / 620)));
  box.style.fontSize = `${base.toFixed(2)}px`;
  box.style.borderRadius = getComputedStyle(panel).borderTopLeftRadius || '';
}

/**
 * 打开记忆分析（幂等：已开则不叠层，晃一下提示还在）。
 * R 口径与调度同源：读拟合权重 reviewApp.currentW()（取不到回退默认——deriveAnalysis 自兜底）。
 */
export async function openReviewAnalysis(app: App): Promise<void> {
  const noStage = typeof requestAnimationFrame !== 'function'
    || typeof HTMLElement === 'undefined'
    || typeof HTMLElement.prototype.animate !== 'function';
  if (raOvl?.isConnected) {
    const box = raOvl.querySelector<HTMLElement>('.bz-ra-box');
    if (box) { box.classList.remove('is-nudge'); void box.offsetWidth; box.classList.add('is-nudge'); }
    return;
  }
  // 数据装配失败/无账可演 → 经典统计弹层（自带人话空态）
  let data: RaData;
  try {
    ensureReview(app);
    const dm = dataManager;
    if (!dm || noStage) throw new Error('no-stage');
    const items = await dm.loadItems();
    if (!items.length) throw new Error('empty');
    let w: number[] | undefined;
    try { w = reviewApp.currentW(); } catch { w = undefined; }
    data = deriveAnalysis(items, { w });
  } catch {
    const { openReviewReport } = await import('../index');
    await openReviewReport(app);
    return;
  }

  const panel = document.querySelector<HTMLElement>('#review-popup');
  const ovl = document.createElement('div');
  ovl.className = 'bz-ra';
  ovl.innerHTML = `
    <div class="bz-ra-box">
      ${analysisFixedHtml()}
      <div class="bz-ra-scroll">${analysisHtml(data)}</div>
    </div>`;
  // 移动端面板满屏没有遮罩可点，关闭钮即出口（桌面点框外/ESC）。
  // 钮放**层框内**：跟着软横屏一起转——内容横过来看时它才落在手持视角的右上角（影院同款）
  if (isNarrow()) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bz-ra-close';
    close.setAttribute('data-ra-close', '');
    close.title = '关闭';
    close.setAttribute('aria-label', '关闭');
    close.textContent = '✕';
    ovl.querySelector<HTMLElement>('.bz-ra-box')?.appendChild(close);
  }
  document.body.appendChild(ovl);
  topifyZ(ovl); // 显示即发号（ADR-0067）：叠在复习面板之上，关掉即销号
  raOvl = ovl;
  const box = ovl.querySelector<HTMLElement>('.bz-ra-box');
  if (box) {
    fitRaBox(box, panel);
    raSync = () => fitRaBox(box, panel);
    window.addEventListener('resize', raSync);
    if (typeof ResizeObserver === 'function' && panel) {
      raRo = new ResizeObserver(raSync);
      raRo.observe(panel);
    }
  }
  ovl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-ra-close]')) { closeReviewAnalysis(); return; }
    if (!t.closest('.bz-ra-box')) closeReviewAnalysis(); // 点框外 = 遮罩
  });
  raEsc = escManager.register('bz-review-analysis', {
    isVisible: () => !!raOvl?.isConnected,
    close: closeReviewAnalysis,
  });
  raHandle = bindAnalysis(ovl, data);
}

/** 关闭：引擎先停（rAF/监听/观察者自灭），再摘层与几何跟随。幂等。 */
export function closeReviewAnalysis(): void {
  raHandle?.stop();
  raHandle = null;
  if (raEsc) {
    try { raEsc.unregister(); } catch { /* 幂等 */ }
    raEsc = null;
  }
  if (raSync) { window.removeEventListener('resize', raSync); raSync = null; }
  raRo?.disconnect();
  raRo = null;
  raOvl?.remove();
  raOvl = null;
}

/** 域卸载（review unload 链）：同关闭，另保证 ESC 句柄必摘 */
export function unloadReviewAnalysis(): void {
  closeReviewAnalysis();
}
