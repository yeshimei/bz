/**
 * 读报特刊 · 装配（「我读了什么」的新界面：覆盖剪藏本面板的一层，八幕长片）
 *
 * 形态与影院观影分析同构（ADR-0175 口径）：层框 = 面板矩形（resize 跟随）、点框外/ESC 关、
 * 移动端给关闭钮；内容则是剪藏本自己的报馆语言（press/ 三件套）。
 * 降级：无 WAAPI 宿主（jsdom/老壳）或 readLog 全空 → 落回经典阅读报告弹层
 *（openClipbookReport 自带人话空态与命令直开路径），特刊只在真动画宿主且有账可演时开。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../../core/dom';
import { escManager } from '../../core/esc-manager';
import { fitRotatedBox } from '../../core/landscape';
import { flushReadingSession } from '../flow';
import { readClipbookData } from '../data';
import { readNewsData } from '../news-data';
import { openClipbookReport } from '../report-ui';
import { derivePress, type PressData } from './data';
import { pressHtml } from './view';
import { bindPress, type PressHandle } from './engine';

let pressOvl: HTMLElement | null = null;
let pressHandle: PressHandle | null = null;
let pressEsc: { unregister(): void } | null = null;
let pressSync: (() => void) | null = null;
let pressRo: ResizeObserver | null = null;

/** 移动端判定（关闭钮显隐与软横屏转置同口径）：视口窄即按移动算（原型移动 iframe 也命中） */
const isNarrow = (): boolean => {
  try { return window.matchMedia('(max-width: 768px)').matches; } catch { return false; }
};

/** 层框 = 剪藏本面板矩形（同 ADR-0175 几何口径）；几何与软横屏转置单源 core/landscape
 *  （移动竖屏横屏呈现，影院观影分析同款）。面板没几何时给视口内边距兜底（兜底态不转）。 */
function fitPressBox(box: HTMLElement, panel: HTMLElement | null): void {
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

/** 打开读报特刊（幂等：已开则不叠层）。数据现读（sidecar readLog + news 未读流）。 */
export async function openReadingPress(app?: App): Promise<void> {
  const noStage = typeof requestAnimationFrame !== 'function'
    || typeof HTMLElement === 'undefined'
    || typeof HTMLElement.prototype.animate !== 'function';
  if (pressOvl?.isConnected) {
    const box = pressOvl.querySelector<HTMLElement>('.bz-rp-box');
    if (box) { box.classList.remove('is-nudge'); void box.offsetWidth; box.classList.add('is-nudge'); }
    return;
  }
  await flushReadingSession(); // 读到一半开特刊，刚才那段也要入账
  const sidecar = await readClipbookData();
  const log = sidecar.readLog || [];
  if (noStage || !log.length) {
    await openClipbookReport(app); // 经典弹层：人话空态 / 无动画宿主
    return;
  }
  let raw: Array<Record<string, unknown>> | null = null;
  let totalRead: number | undefined;
  let byDateDays: number | undefined;
  try {
    const res = await readNewsData();
    if (res.ok && !res.missing) {
      raw = ((res.data && res.data.articles) || []) as Array<Record<string, unknown>>;
      const st = (res.data as { stats?: { totalRead?: number; byDate?: Record<string, number> } } | null)?.stats;
      totalRead = st?.totalRead;
      byDateDays = st?.byDate ? Object.keys(st.byDate).length : undefined;
    }
  } catch { raw = null; }
  const data: PressData = derivePress(log, raw, {
    savedCount: sidecar.savedArchive?.length || 0,
    totalRead,
    byDateDays,
  }, new Date());

  const panel = document.querySelector<HTMLElement>('.bz-clip-frame');
  const ovl = document.createElement('div');
  ovl.className = 'bz-rp';
  ovl.innerHTML = pressHtml(data);
  // 移动端面板满屏没有遮罩可点，关闭钮即出口（桌面点框外/ESC）。
  // 钮放**层框内**：跟着软横屏一起转——内容横过来看时它才落在手持视角的右上角（影院同款）
  if (isNarrow()) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bz-rp-close';
    close.setAttribute('data-r', 'close');
    close.setAttribute('title', '关闭');
    close.setAttribute('aria-label', '关闭读报特刊');
    close.textContent = '✕';
    ovl.querySelector<HTMLElement>('.bz-rp-box')?.appendChild(close);
  }
  document.body.appendChild(ovl);
  topifyZ(ovl);
  pressOvl = ovl;
  const box = ovl.querySelector<HTMLElement>('.bz-rp-box');
  if (box) {
    fitPressBox(box, panel);
    pressSync = () => fitPressBox(box, panel);
    window.addEventListener('resize', pressSync);
    if (typeof ResizeObserver === 'function' && panel) {
      pressRo = new ResizeObserver(pressSync);
      pressRo.observe(panel);
    }
  }
  ovl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-r="close"]')) { closeReadingPress(); return; }
    if (!t.closest('.bz-rp-box')) closeReadingPress(); // 点框外 = 遮罩
  });
  pressEsc = escManager.register('clipbook-press', {
    isVisible: () => !!pressOvl?.isConnected,
    close: closeReadingPress,
  });
  pressHandle = bindPress(ovl, data);
}

/** 关闭：引擎先停（rAF/监听自灭），再摘层与几何跟随。幂等。 */
export function closeReadingPress(): void {
  pressHandle?.stop();
  pressHandle = null;
  if (pressEsc) {
    try { pressEsc.unregister(); } catch { /* 幂等 */ }
    pressEsc = null;
  }
  if (pressSync) { window.removeEventListener('resize', pressSync); pressSync = null; }
  pressRo?.disconnect();
  pressRo = null;
  pressOvl?.remove();
  pressOvl = null;
}

/** 域卸载（clipbook unload 链）：同关闭，另保证 ESC 句柄必摘 */
export function unloadReadingPress(): void {
  closeReadingPress();
}
