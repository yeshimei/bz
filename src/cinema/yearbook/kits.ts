/**
 * 观影志 · 工具箱（零依赖；DOM/画布小工具 + 缓动 + 粒子）
 *
 * 设计约束（决定这里有什么）：
 * - **时间驱动表演**：一幕进场后就按自己的时间轴演（不是被滚动进度抽着走），
 *   所以这里给的是 `stagger`（按序错峰）与分档缓动，而不是进度插值；
 * - 画布一律 DPR 缩放 + `resize` 重采，绘制前 `clearRect`，无残留；
 * - 取色只走 `palette()`（读 CSS 变量），画布与 DOM 用同一套色，明暗切换自动同步。
 */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const inv = (x: number): number => 1 - clamp01(x);

/** 时间轴推进：t 秒 → 0..1（dur 秒内走完，超出即 1） */
export const at = (t: number, dur: number, delay = 0): number => clamp01((t - delay) / Math.max(dur, 1e-4));

/* ─────────── 缓动 ─────────── */
export const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number): number => x * x * x;
export const easeInOut = (x: number): number => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeBack = (x: number): number => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export const easeElastic = (x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const p = .42;
  return Math.pow(2, -10 * x) * Math.sin(((x - p / 4) * (2 * Math.PI)) / p) + 1;
};
/** 弹簧（阻尼正弦；用于落位后的小幅回弹，比 back 更像真实物） */
export const spring = (x: number, damp = 6, freq = 3): number =>
  x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * x);

/** 错峰：第 i 个元素在 t 时刻的局部进度（step 秒一个，dur 秒一个走完） */
export const stagger = (t: number, i: number, step = .07, dur = .7): number => at(t, dur, i * step);

/* ─────────── 数字与格式 ─────────── */
/** 里程表数字：0 → n（含小数位），带位宽（前面补 0 到 width） */
export const rollTo = (n: number, x: number, digits = 0, width = 0): string => {
  const v = n * clamp01(x);
  const s = digits > 0 ? v.toFixed(digits) : String(Math.round(v));
  return width > 0 ? s.padStart(width, '0') : s;
};
/** 千分位（总分钟这种大数要分组） */
export const comma = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 「X 天 Y 小时」 */
export const humanDur = (min: number): string => {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
  return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时 ${Math.round(min % 60)} 分`;
};
/** 紧凑口径「42天18时」（落款四格那种窄栏用它；口径与 humanDur 一致，只是省略空格与「小」） */
export const humanDurShort = (min: number): string => {
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
  return d > 0 ? `${d}天${h}时` : `${h}小时`;
};
/** 2022-08-10 → 2022.08.10 */
export const dotted = (d: string): string => d.replace(/-/g, '.');
/** 只留月日 */
export const monthDay = (d: string): string => {
  const [, m, dd] = d.split('-');
  return `${Number(m)} 月 ${Number(dd)} 日`;
};

/* ─────────── 取色（画布与 DOM 同源） ─────────── */
export interface Palette {
  ink: string; dim: string; faint: string; line: string;
  red: string; blue: string; jade: string; gold: string;
  paper: string;
  inkRgb: string; redRgb: string; blueRgb: string; jadeRgb: string; goldRgb: string;
  /** 深底浅字 / 浅底深字：矩阵这类「色块上压字」的场景按它选字色 */
  onStrong: string;
  dark: boolean;
}
const rgb = (host: HTMLElement, name: string, fallback: string): string => {
  const v = getComputedStyle(host).getPropertyValue(name).trim();
  return v || fallback;
};
/** 取三元组的首通道估亮度（只用来判明暗，不做色彩管理） */
const luma = (triplet: string): number => {
  const n = triplet.split(',').map((x) => Number(x.trim()));
  return .299 * (n[0] ?? 0) + .587 * (n[1] ?? 0) + .114 * (n[2] ?? 0);
};
/** 读宿主上的 `--yb-*-rgb` 三元组（画布用 rgba()，随明暗自动换） */
export function palette(host: HTMLElement): Palette {
  const inkRgb = rgb(host, '--yb-ink-rgb', '32,26,20');
  const redRgb = rgb(host, '--yb-red-rgb', '190,58,38');
  const blueRgb = rgb(host, '--yb-blue-rgb', '44,80,140');
  const jadeRgb = rgb(host, '--yb-jade-rgb', '38,110,96');
  const goldRgb = rgb(host, '--yb-gold-rgb', '168,118,26');
  const paper = rgb(host, '--yb-paper', '#f6f2e9');
  const dim = rgb(host, '--yb-dim-rgb', '120,108,92');
  const faint = rgb(host, '--yb-faint-rgb', '168,156,138');
  const dark = luma(inkRgb) > 140;
  return {
    ink: `rgb(${inkRgb})`, dim: `rgb(${dim})`, faint: `rgb(${faint})`,
    line: `rgb(${inkRgb} / .16)`, red: `rgb(${redRgb})`, blue: `rgb(${blueRgb})`,
    jade: `rgb(${jadeRgb})`, gold: `rgb(${goldRgb})`, paper,
    inkRgb, redRgb, blueRgb, jadeRgb, goldRgb,
    onStrong: dark ? '12,10,8' : '255,255,255',
    dark,
  };
}
/** rgba 助手（画布渐变/透明都用它，避免到处拼字符串） */
export const rgba = (triplet: string, a: number): string => `rgba(${triplet},${a})`;

/* ─────────── 画布 ─────────── */
export interface Cv {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number; h: number;
  /** 尺寸变了就重设（含 DPR）；返回 true = 本帧尺寸已更新 */
  fit(): boolean;
  clear(): void;
}
/** 取画布：`host.querySelector('canvas[data-cv=x]')`；无则 null（jsdom 里没有 getContext） */
export function canvas(host: HTMLElement, key: string): Cv | null {
  const el = host.querySelector<HTMLCanvasElement>(`canvas[data-cv="${key}"]`);
  if (!el) return null;
  const ctx = typeof el.getContext === 'function' ? el.getContext('2d') : null;
  if (!ctx) return null;
  const cv: Cv = {
    el, ctx, w: 0, h: 0,
    fit(): boolean {
      const dpr = Math.min(2, (globalThis.devicePixelRatio || 1));
      // 用布局尺寸而非 getBoundingClientRect：移动竖屏旋转态下 rect 是视觉尺寸（转了 90°），
      // 会让位图按错误比例建、粒子/折线整体拉伸变形
      const w = Math.max(1, el.offsetWidth), h = Math.max(1, el.offsetHeight);
      if (w === cv.w && h === cv.h) return false;
      cv.w = w; cv.h = h;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    },
    clear(): void { ctx.clearRect(0, 0, cv.w, cv.h); },
  };
  return cv;
}

/** 文字取样：把 glyph 画到离屏画布，按 gap 像素采出点阵（粒子汇聚的靶点） */
export function sampleText(text: string, fontPx: number, weight = 800, gap = 5): { x: number; y: number }[] {
  const c = document.createElement('canvas');
  const pad = Math.round(fontPx * .3);
  const ctx = c.getContext('2d');
  if (!ctx) return [];
  const font = `${weight} ${fontPx}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = Math.ceil(fontPx * 1.42);
  c.width = w; c.height = h;
  const c2 = c.getContext('2d')!;
  c2.font = font;
  c2.fillStyle = '#fff';
  c2.textBaseline = 'middle';
  c2.fillText(text, pad, h / 2);
  const data = c2.getImageData(0, 0, w, h).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += gap) {
    for (let x = 0; x < w; x += gap) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
    }
  }
  return pts.map((p) => ({ x: (p.x - w / 2), y: (p.y - h / 2) }));
}

/* ─────────── DOM 小工具 ─────────── */
export const qs = <T extends HTMLElement = HTMLElement>(host: ParentNode, sel: string): T | null =>
  host.querySelector<T>(sel);

export const qsa = <T extends Element = HTMLElement>(host: ParentNode, sel: string): T[] =>
  Array.from(host.querySelectorAll<T>(sel));
/** 一次取好的一场（每幕 perf 都长这样，避免逐帧 querySelector） */
export const refs = <T extends HTMLElement = HTMLElement>(host: ParentNode, names: string[]): Record<string, T | null> => {
  const out: Record<string, T | null> = {};
  for (const n of names) out[n] = host.querySelector<T>(`[data-r="${n}"]`);
  return out;
};
/** 主题/明暗变化时重取色（MutationObserver 在 engine 里挂一次） */
export const setVar = (el: HTMLElement, name: string, v: string): void => { el.style.setProperty(name, v); };

/* ─────────── 指针（鼠标那一层：命中判定 + 跟随浮签） ───────────
   引擎把指针交给**当前这一幕**：`cx/cy` 是客户端坐标（命中判定、浮签定位用），
   `px/py` 是相对整屏归一化的 -1..1（斥力、视差、跟手这类连续量用）。
   两条纪律：
   1. 命中判定一律走 `under()`（浏览器自己的 elementFromPoint），**不要逐元素量 rect**——
      一幕里动辄上百个点，逐帧量 rect 会把布局读爆，而浏览器本来每帧就在算 hover；
   2. 连续量只在 `update()` 里写、`move()` 里只记状态（`move` 的调用频率跟着鼠标事件走，
      和帧率不同步，在 `move` 里写样式会在快速划动时写出抖动）。 */
export interface PointerAt { cx: number; cy: number; px: number; py: number }
/** 指针在宿主内的比例坐标（0..1）；不在宿主内返回 null（画布类命中判定用它） */
export const localAt = (host: HTMLElement | null | undefined, p: PointerAt): { x: number; y: number } | null => {
  if (!host) return null;
  const r = host.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const x = (p.cx - r.left) / r.width, y = (p.cy - r.top) / r.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
};
/** 比例坐标里离指针最近的一枚；超出 radius（比例距离）算没命中，空表返回 -1 */
export function nearest(spots: { x: number; y: number }[], at2: { x: number; y: number } | null, radius = .06): number {
  if (!at2 || !spots.length) return -1;
  let best = -1, bd = radius * radius;
  for (let i = 0; i < spots.length; i++) {
    const dx = spots[i].x - at2.x, dy = spots[i].y - at2.y;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/** 指针下最近的、匹配 `sel` 的祖先（jsdom 没有 elementFromPoint → 一律返回 null，
 *  测试里不会因为「没有真指针」而崩）。 */
export function under<T extends Element = HTMLElement>(p: PointerAt, sel: string): T | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  try {
    const hit = document.elementFromPoint(p.cx, p.cy);
    return hit ? hit.closest<T>(sel) : null;
  } catch (e) {
    return null; // 无头环境没实现命中判定：当作「没悬停」，别把整幕的表演带崩
  }
}
/** 跟随浮签：挂在 `.bz-yb` 上（fixed inset:0，客户端坐标即根内坐标），全片共用一个节点。
 *  传空串即隐藏——翻幕、指针离开画面时由引擎统一清掉，免得浮签挂在上一幕上。 */
const tipNode = new WeakMap<HTMLElement, HTMLElement>();
export function tip(root: HTMLElement, html: string, cx = 0, cy = 0): void {
  let el = tipNode.get(root);
  if (!el) {
    el = document.createElement('span');
    el.className = 'yb-tip';
    el.setAttribute('aria-hidden', 'true');
    root.appendChild(el);
    tipNode.set(root, el);
  }
  if (!html) {
    if (el.style.opacity !== '0') el.style.opacity = '0';
    return;
  }
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  el.style.left = `${cx.toFixed(1)}px`;
  el.style.top = `${cy.toFixed(1)}px`;
  el.style.opacity = '1';
}
/** 平滑跟随（逐帧朝目标挪 k 比例；指针跳变时不会「啪」地弹过去） */
export const toward = (cur: number, target: number, k = .18): number => cur + (target - cur) * k;


/* ─────────── 翻页钟（split-flap） ───────────
   片上四处大数字（片长合计 / 均分 / 两栏均分 / 落款四格）用机械翻页而不是滚动计数：
   逐位翻牌有「一格一格落定」的物理感，且数字变化时不会整片重排。
   逐位比对：只有真变了的位翻牌——整串重刷会把没变的位也翻一遍，看着像抽风。 */
const flapTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
export function setFlap(host: HTMLElement | null | undefined, text: string): void {
  if (!host) return;
  const cells = Array.from(host.querySelectorAll<HTMLElement>('.yb-flap'));
  const chars = [...text];
  if (cells.length !== chars.length) {
    host.innerHTML = chars.map((ch) => flapCell(ch, ch)).join('');
    return;
  }
  chars.forEach((ch, i) => {
    const cell = cells[i];
    const cur = cell.querySelector<HTMLElement>('.cur');
    const nxt = cell.querySelector<HTMLElement>('.nxt');
    if (!cur || !nxt || cell.dataset.v === ch) return;
    cell.dataset.v = ch;
    nxt.textContent = ch;
    cell.classList.add('is-flip');
    const old = flapTimers.get(cell);
    if (old) clearTimeout(old);
    flapTimers.set(cell, setTimeout(() => {
      cur.textContent = ch;
      cell.classList.remove('is-flip');
    }, 210));
  });
}
/** 逐位翻牌的字格（`cur` = 当前位，`nxt` = 翻下来的下一位） */
const flapCell = (cur: string, nxt: string): string =>
  /[0-9]/.test(cur)
    ? `<i class="yb-flap" data-v="${cur}"><span class="cur">${cur}</span><span class="nxt">${nxt}</span></i>`
    : `<i class="yb-flap is-lit"><span class="cur">${cur === ' ' ? '&nbsp;' : cur}</span></i>`;
/** 初始静态字格串（还没翻过：cur = 内容，nxt 同值） */
export const flapHtml = (text: string): string => [...text].map((ch) => flapCell(ch, ch)).join('');
