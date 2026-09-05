/* ============================================================
 * bz 组件库 · 平铺单选组（src/core/ui/choice.ts）
 * 表单里替代下拉的「胶囊选项平铺」：可换行、单选、带选中态。
 * 与 uiSegmented（等宽分段条）互补——选项多/文案长时用本组件。
 * 可选每项前置色点（.bz-choice-dot，数据语义色由调用方内联直给）。
 * float = 浮岛 segmented（issue 199 拍板）：轨道收内容宽 + 白卡滑动
 * 指示器——选中切换时指示器平滑滑到新项（transform/width 200ms）。
 * ============================================================ */
import type { BzChoiceOpts } from './types';

/** 平铺单选组（可换行胶囊），返回容器 + setValue/detach 句柄。radiogroup + 方向键导航（L8） */
export function uiChoice<T extends string>(opts: BzChoiceOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void; detach: () => void } {
  const el = document.createElement('div');
  el.className = 'bz-choice' + (opts.float ? ' bz-choice--float' : '') + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', opts.label || '');
  const btns = new Map<T, HTMLButtonElement>();
  let cur: T = opts.value;

  // 浮岛滑动指示器（float 专属；非浮岛档无此节点，样式 display:none 兜底）
  const seg = document.createElement('span');
  seg.className = 'bz-choice-seg';
  let segRAF = 0;
  let segTries = 0;
  /** 量选中项位置 → 指示器 transform/width；animate=false 用于首绘（不播动画）。
   *  未布局（刚挂载/隐藏容器）时限次 rAF 重试；重试上限防 display:none 死循环 */
  const syncSeg = (animate: boolean) => {
    if (!opts.float || !el.isConnected) return;
    const on = el.querySelector('.bz-choice-btn.is-on') as HTMLElement | null;
    if (!on) return;
    const tb = el.getBoundingClientRect();
    const bb = on.getBoundingClientRect();
    if (!tb.width || !bb.width) {
      if (segTries++ > 120) return;
      cancelAnimationFrame(segRAF);
      segRAF = requestAnimationFrame(() => syncSeg(false));
      return;
    }
    segTries = 0;
    if (!animate) seg.style.transition = 'none';
    seg.style.width = `${bb.width}px`;
    seg.style.transform = `translateX(${bb.left - tb.left}px)`;
    if (!animate) { void seg.offsetWidth; seg.style.transition = ''; }
  };
  const onWinResize = () => syncSeg(false);
  if (opts.float) {
    window.addEventListener('resize', onWinResize);
  }

  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-choice-btn' + (o.value === opts.value ? ' is-on' : '');
    b.dataset.value = String(o.value);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === opts.value));
    if (o.dot) {
      const d = document.createElement('span');
      d.className = 'bz-choice-dot';
      d.style.background = o.dot;
      b.appendChild(d);
    }
    b.appendChild(document.createTextNode(o.label));
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    b.addEventListener('keydown', (e) => {
      // 方向键在同组内循环移动选中（radio 组语义：左右/上下切换选中项）
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const vals = opts.options.map((x) => x.value);
      const curIdx = vals.indexOf(cur);
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = (curIdx + delta + vals.length) % vals.length;
      setValue(vals[nextIdx]);
      opts.onChange(vals[nextIdx]);
      btns.get(vals[nextIdx])?.focus();
    });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  if (opts.float) el.appendChild(seg); // 指示器垫在按钮之后（absolute 定位不占流）
  function setValue(v: T) {
    cur = v;
    btns.forEach((b, k) => {
      const on = k === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    if (opts.float) syncSeg(true); // 白卡滑到新选中项
  }
  syncSeg(false); // 首绘定位（未挂载时限次 rAF 重试）
  const detach = () => {
    cancelAnimationFrame(segRAF);
    window.removeEventListener('resize', onWinResize);
  };
  return { el, setValue, detach };
}
