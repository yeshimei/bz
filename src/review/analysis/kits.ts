/**
 * 记忆分析 · 工具箱（纯本地零依赖；DOM/画布小工具 + 缓动 + 取色）
 *
 * 与域内 motion.ts（面板动效批）分属两套体系：本层是全屏逐幕分析层的时间驱动
 * 表演工具，只服务 analysis/ 内部，不对外导出消费。
 *
 * 纪律（与引擎/表演共同遵守）：
 * - 表演是时间驱动的（翻到一幕从 t=0 演起），工具给 stagger 错峰与分档缓动；
 * - 画布一律 DPR 缩放 + 尺寸变化才重设，绘制前 clearRect，无残留；
 * - 取色只走 palette()（读 CSS 变量 --ra-*），画布与 DOM 同一套色，明暗切换自动同步。
 */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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
/** 弹簧（阻尼正弦；落位后的小幅回弹） */
export const spring = (x: number, damp = 6, freq = 3): number =>
  x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * x);

/** 错峰：第 i 个元素在 t 时刻的局部进度（step 秒一个，dur 秒一个走完） */
export const stagger = (t: number, i: number, step = .07, dur = .7): number => at(t, dur, i * step);

/** 确定性伪随机（build 期用；禁止逐帧 Math.random——每帧随机画面会抖成噪点） */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return (): number => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ─────────── 数字与格式 ─────────── */
/** 里程表数字：0 → n（含小数位），带位宽（前面补 0 到 width） */
export const rollTo = (n: number, x: number, digits = 0, width = 0): string => {
  const v = n * clamp01(x);
  const s = digits > 0 ? v.toFixed(digits) : String(Math.round(v));
  return width > 0 ? s.padStart(width, '0') : s;
};
/** 千分位 */
export const comma = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 天数 → 人话（≥1 天给「N 天」；不足 1 天给「不足一天」） */
export const humanDays = (days: number): string => (days >= 1 ? `${Math.round(days)} 天` : '不足一天');

/* ─────────── 取色（画布与 DOM 同源） ─────────── */
export interface Palette {
  ink: string; dim: string; faint: string;
  jade: string; amber: string; ember: string; indigo: string; paper: string;
  inkRgb: string; jadeRgb: string; amberRgb: string; emberRgb: string; indigoRgb: string;
  /** 深底浅字 / 浅底深字：色块上压字按它选字色 */
  onStrong: string;
  dark: boolean;
}
const cssVar = (host: HTMLElement, name: string, fallback: string): string => {
  const v = getComputedStyle(host).getPropertyValue(name).trim();
  return v || fallback;
};
/** 取三元组的首通道估亮度（只判明暗，不做色彩管理） */
const luma = (triplet: string): number => {
  const n = triplet.split(',').map((x) => Number(x.trim()));
  return .299 * (n[0] ?? 0) + .587 * (n[1] ?? 0) + .114 * (n[2] ?? 0);
};
/** 读宿主上的 --ra-*-rgb 三元组（画布用 rgba()，随明暗自动换） */
export function palette(host: HTMLElement): Palette {
  const inkRgb = cssVar(host, '--ra-ink-rgb', '222,228,236');
  const jadeRgb = cssVar(host, '--ra-jade-rgb', '110,220,196');
  const amberRgb = cssVar(host, '--ra-amber-rgb', '232,168,86');
  const emberRgb = cssVar(host, '--ra-ember-rgb', '226,106,88');
  const indigoRgb = cssVar(host, '--ra-indigo-rgb', '122,152,222');
  const paper = cssVar(host, '--ra-paper', '#10161d');
  const dark = luma(inkRgb) > 140;
  return {
    ink: `rgb(${inkRgb})`, jade: `rgb(${jadeRgb})`, amber: `rgb(${amberRgb})`,
    ember: `rgb(${emberRgb})`, indigo: `rgb(${indigoRgb})`, paper,
    dim: dark ? 'rgba(190,200,214,.66)' : 'rgba(52,64,80,.72)',
    faint: dark ? 'rgba(190,200,214,.34)' : 'rgba(52,64,80,.4)',
    inkRgb, jadeRgb, amberRgb, emberRgb, indigoRgb,
    onStrong: dark ? '10,14,20' : '244,248,252',
    dark,
  };
}
/** rgba 助手 */
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
/** 取画布：host.querySelector('canvas[data-cv=x]')；无则 null（jsdom 没有 getContext） */
export function canvas(host: HTMLElement, key: string): Cv | null {
  const el = host.querySelector<HTMLCanvasElement>(`canvas[data-cv="${key}"]`);
  if (!el) return null;
  const ctx = typeof el.getContext === 'function' ? el.getContext('2d') : null;
  if (!ctx) return null;
  const cv: Cv = {
    el, ctx, w: 0, h: 0,
    fit(): boolean {
      const dpr = Math.min(2, (globalThis.devicePixelRatio || 1));
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
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

/** 文字取样：把 glyph 画到离屏画布，按 gap 像素采出点阵（开卷粒子汇聚的靶点） */
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
  const c2 = c.getContext('2d');
  if (!c2) return [];
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
  return pts.map((p) => ({ x: p.x - w / 2, y: p.y - h / 2 }));
}

/* ─────────── DOM 小工具 ─────────── */
export const qs = <T extends HTMLElement = HTMLElement>(host: ParentNode, sel: string): T | null =>
  host.querySelector<T>(sel);
export const qsa = <T extends Element = HTMLElement>(host: ParentNode, sel: string): T[] =>
  Array.from(host.querySelectorAll<T>(sel));
/** 一次取好一幕的引用点（每幕 perf 都长这样，避免逐帧 querySelector） */
export const refs = <T extends HTMLElement = HTMLElement>(host: ParentNode, names: string[]): Record<string, T | null> => {
  const out: Record<string, T | null> = {};
  for (const n of names) out[n] = host.querySelector<T>(`[data-r="${n}"]`);
  return out;
};

/* ─────────── 指针（命中判定 + 跟随浮签） ───────────
   引擎把指针交给当前这一幕：cx/cy 是客户端坐标（命中判定、浮签定位用），
   px/py 是相对整屏归一化的 -1..1（斥力、视差、跟手这类连续量用）。
   两条纪律：
   1. 命中判定一律走 under()（浏览器自己的 elementFromPoint），不逐元素量 rect；
   2. 连续量只在 update() 里写、move() 里只记状态。 */
export interface PointerAt { cx: number; cy: number; px: number; py: number }
/** 指针在宿主内的比例坐标（0..1）；不在宿主内返回 null */
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
/** 指针下最近的、匹配 sel 的祖先（jsdom 没有 elementFromPoint → 返回 null，不崩） */
export function under<T extends Element = HTMLElement>(p: PointerAt, sel: string): T | null {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
  try {
    const hit = document.elementFromPoint(p.cx, p.cy);
    return hit ? hit.closest<T>(sel) : null;
  } catch {
    return null;
  }
}
/** 跟随浮签：挂在层根（fixed inset:0，客户端坐标即根内坐标），全片共用一个节点。
 *  传空串即隐藏——翻幕、指针离开画面时由引擎统一清掉。 */
const tipNode = new WeakMap<HTMLElement, HTMLElement>();
export function tip(root: HTMLElement, html: string, cx = 0, cy = 0): void {
  let el = tipNode.get(root);
  if (!el) {
    if (typeof document === 'undefined') return;
    el = document.createElement('span');
    el.className = 'ra-tip';
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
/** 平滑跟随（逐帧朝目标挪 k 比例；指针跳变时不「啪」地弹过去） */
export const toward = (cur: number, target: number, k = .18): number => cur + (target - cur) * k;
