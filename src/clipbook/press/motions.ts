/**
 * 读报特刊 · 表演层（时间驱动：翻到哪幕，哪幕从 t=0 演一遍；翻走推到终态）
 *
 * 本轮「报章语法」深挖的手法清单（一幕一套，全围绕报馆/印刷/电传——与影院放映室语言无关）：
 *   c01 开印＝油墨坠落带拖尾 + 落纸晕染涟漪 + 刊名拆字手排节奏砸落 + 竖排报眼 + 期号压角 + 推近运镜；
 *   c02 速览＝大数压左上 + 右列错落 + expo 滚数（时长随位数派生）+ 分层指针视差 + 摇入运镜；
 *   c03 工班钟＝刻度短线逐根画出 + 四班环带扫出 + 主针 spring 摆峰 + 跟随针缓步转向指针（持续响应）；
 *   c04 热力带＝虚线外框沿周长画出来 + 对角波抖动显影 + 光标十字跟随（持续响应）+ 峰值格描金 + 竖排刊字；
 *   c05 读得最久＝头版头条砸落紧版（字距收紧）+ 次榜活字坠落（非等差捡字节奏）；
 *   c06 消息源榜＝滚筒亮带压过双条 + 里程滚数 + 王牌章压右上角 back 落章 + 横摇运镜；
 *   c07 号外＝电传纸左进 + 走纸孔滚动 + 电头虚线 dashoffset 连发 + 行 clip-path 打字机显影；
 *   c08 收录节奏＝滚筒扫过柱 spring 拔起（柱随亮带顺序起）+ 峰值描金纸屑喷发 + 拉远运镜；
 *   c09 驻留日历＝对角波显影 + 连胜线逐段描画（笔尖端点）+ 今天格描边 + 大数 spring + 指针纵向视差；
 *   c10 班次×来源＝堆叠四段接力 + 悬停行提亮余行压暗（余像记忆）+ 斜切运镜；
 *   c11 关键词＝螺旋落位 + 随机方向飞入 + 斥力弹簧回位积分（持续响应）+ 高频词着重号点线；
 *   c12 报库盘点＝墨盘双环 spring 扫出 + 环端墨点 + 环心百分数同步滚 + 右列三格视差飞入；
 *   c13 压库专页＝卷宗掀角入场（perspective rotateY 回正）+ 天数 expo 里程 + 压库戳连落；
 *   c14 未读版图＝行滑入 + 总待读大数压右上角滚数 + 指针视差 + 右进运镜；
 *   c15 总账＝三数视差（三格三种深度）+ 基线错落 + 扫光 + 缓推运镜 + 标题反向微移；
 *   c16 落款＝墨滴礼花两响（拖尾 + 避指针）+ 纸屑自天而降 + 尾章落纸 + 逐字起。
 *
 * 硬规矩（沿用既有纪律）：
 *   1. 目标量 build 期取好，逐帧只写不读（指针命中测试例外——pin 时每帧至多一次 getBoundingClientRect）；
 *   2. 样式/文本写入带同值记忆（S/T），逐帧调用安全；S 会保留行内不冲突的旧声明（条形 width 不被 transform 抹掉）；
 *   3. 画布 DPR 缩放、尺寸变化重采、绘制前 clearRect；拖尾用显式历史点连线，不做半透明残影糊屏；
 *   4. 节奏参数（时长/粒子量/幅度）从数据规模派生——读史越盛大，演出越盛大。
 */
import type { PressData } from './data';

/* ─────────── 小工具（自足，零依赖） ─────────── */

export interface PerfCtx {
  t: number;
  pal: Palette;
  /** 指针归一坐标（-1..1，离场为 0）与屏内坐标；pin=1 表示指针在层内 */
  px: number; py: number; cx: number; cy: number; pin: number;
}
export interface Perf { dur: number; update(ctx: PerfCtx): void }

export interface Palette {
  ink: string; ink2: string; dim: string; muted: string;
  accent: string; accentSoft: string; line: string; paper: string;
}

/** 衬线/黑体栈（画布文本用；与 styles.css --clip-serif 同源） */
const SERIF = 'Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif';
const HEI = `'Microsoft YaHei', sans-serif`;

export function palette(root: HTMLElement): Palette {
  const cs = getComputedStyle(root);
  const v = (n: string, fb: string): string => (cs.getPropertyValue(n) || '').trim() || fb;
  return {
    ink: v('--clip-ink', '#1c1a17'), ink2: v('--clip-ink-2', '#3d3a34'),
    dim: v('--clip-dim', '#6b6458'), muted: v('--clip-muted', '#b3aa9a'),
    accent: v('--clip-accent', '#c2410c'), accentSoft: v('--clip-accent-soft', '#e8965a'),
    line: v('--clip-line', '#e4ddd0'), paper: v('--clip-paper', '#faf8f3'),
  };
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 时间轴推进：t 秒、dur 秒走完、delay 延迟 → 0..1 */
const at = (t: number, dur: number, delay = 0): number => clamp01((t - delay) / Math.max(dur, 1e-4));
const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number): number => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeBack = (x: number): number => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOutExpo = (x: number): number => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
/** 弹性拔起（柱/环/大数用，过冲回正） */
const springUp = (x: number): number => (x >= 1 ? 1 : 1 - Math.exp(-5.2 * x) * Math.cos(3.1 * Math.PI * x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 里程表：n × x（clamp01）取整 */
const roll = (n: number, x: number): number => Math.round(n * clamp01(x));
/** 千分位 */
const comma = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 最短角差（跟随针平滑转向用） */
const sdelta = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
/** 确定性伪随机（粒子布点不随帧抖动） */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 写样式（同值不重写；与本次不冲突的行内旧声明保留——bar 的 width 等数据样式不被 transform 抹掉） */
const lastStyle = new WeakMap<HTMLElement, string>();
const lastText = new WeakMap<HTMLElement, string>();
function S(el: Element | null, v: string): void {
  if (!el || lastStyle.get(el as HTMLElement) === v) return;
  const he = el as HTMLElement;
  const prev = he.getAttribute('style') ?? '';
  if (prev) {
    const incoming = new Set(v.split(';').map((d) => d.split(':')[0].trim()).filter(Boolean));
    const keep = prev.split(';').filter((d) => {
      const k = d.split(':')[0].trim();
      return k && !incoming.has(k);
    });
    if (keep.length) v = `${keep.join(';')};${v}`;
  }
  he.setAttribute('style', v);
  lastStyle.set(he, v);
}
function T(el: Element | null, v: string): void {
  if (!el || lastText.get(el as HTMLElement) === v) return;
  (el as HTMLElement).textContent = v;
  lastText.set(el as HTMLElement, v);
}
const q = (root: ParentNode, sel: string): Element | null => root.querySelector(sel);
const qa = (root: ParentNode, sel: string): Element[] => [...root.querySelectorAll(sel)];

/** 画布就位：DPR 缩放 + 尺寸变化重采；返回 2D 上文与 CSS 尺寸（无 ctx → null，jsdom 安全） */
function fit(cv: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (w < 2 || h < 2) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/** hex → rgba（带透明度）；解析失败原样返回 */
function rgba(hex: string, a: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full.slice(0, 6), 16);
  if (!isFinite(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

/** 指针斥力：点 (x,y) 被指针推开后的偏移（R 内按距离衰减，外圈为 0） */
function repel(lx: number, ly: number, pin: number, x: number, y: number, R = 110, force = 26): { dx: number; dy: number } {
  if (!pin) return { dx: 0, dy: 0 };
  const dx = x - lx, dy = y - ly;
  const dist = Math.hypot(dx, dy);
  if (dist > R || dist < 0.001) return { dx: 0, dy: 0 };
  const f = (1 - dist / R) * force;
  return { dx: (dx / dist) * f, dy: (dy / dist) * f };
}

/** 幕运镜：容器从 from 态插回原位（rest=0 时写 none，不残留变换） */
function dolly(el: Element | null, t: number, from: (rest: number) => string, dur = 1.1, delay = 0): void {
  if (!el) return;
  const rest = 1 - easeOut(at(t, dur, delay));
  S(el, rest <= 0.0005 ? 'transform:none' : `transform:${from(rest)}`);
}

/** 画布浮签（纸底 + 墨线框 + 黑体字） */
function drawTip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, pal: Palette): void {
  ctx.font = `12px ${HEI}`;
  const wText = ctx.measureText(text).width;
  const w = wText + 18, h = 24;
  const left = Math.max(6, Math.min(x - w / 2, (ctx.canvas.clientWidth || 9999) - w - 6));
  const top = y - h - 12;
  ctx.fillStyle = pal.paper;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1;
  ctx.fillRect(left, top, w, h);
  ctx.strokeRect(left + .5, top + .5, w - 1, h - 1);
  ctx.fillStyle = pal.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 9, top + h / 2 + .5);
}

/** 分钟 → 人话（里程表中途值用；与 report-stats formatMinutes 同口径） */
function humanish(min: number): string {
  const h = Math.floor(min / 60), r = Math.round(min % 60);
  if (h <= 0) return `${r} 分钟`;
  return r > 0 ? `${h} 小时 ${r} 分` : `${h} 小时`;
}

function shiftOfHour(h: number): string {
  if (h < 6) return '夜班';
  if (h < 12) return '晨班';
  if (h < 18) return '午班';
  return '晚班';
}

/* ─────────── 各幕表演 ─────────── */

/** 幕 1 开印：油墨坠落（拖尾 + 晕染涟漪 + 斥力）+ 刊名拆字手排砸落 + 竖排报眼 + 期号压角 + 推近运镜 */
function perfC01(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c01"]') as HTMLCanvasElement | null;
  const chars = qa(scn, '[data-r="mast"] span');
  const eyeChars = qa(scn, '[data-r="eye"] span');
  const sub = q(scn, '[data-r="sub"]');
  const line = q(scn, '[data-r="line"]');
  const issue = q(scn, '[data-r="issue"]');
  const inn = q(scn, '.bz-rp-in');
  const rand = rng(20260923);
  // 墨滴量随读史派生：读过的篇数越多，开印的墨点越密（上限 110 控帧耗）
  const nDrops = Math.min(110, 40 + Math.round(d.articles * .6));
  interface Drop { x: number; y0: number; y1: number; t0: number; life: number; r: number; wob: number; ph: number; accent: boolean; trail: Array<[number, number]> }
  const drops: Drop[] = Array.from({ length: nDrops }, (_, i) => ({
    x: rand(), y0: rand() * .14, y1: .3 + rand() * .58,
    t0: .15 + rand() * 2.6, life: 1.5 + rand() * 1.7,
    r: .8 + rand() * 2.6, wob: 6 + rand() * 20, ph: rand() * Math.PI * 2,
    accent: i % 9 === 0, trail: [],
  }));
  // 刊名拆字手排节奏：非等差 delay（排字工捡字的错落感）+ 各字独立旋向
  const beat = [0, .26, .1, .52, .34];
  const tilt = [-6, 4, -3, 5, -4];
  const dur = 4.6 + Math.min(.8, (d.articles / 120) * .8);
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      // 运镜：整版从轻推近落定（报纸递到面前）
      dolly(inn, t, (r) => `scale(${(1 + r * .045).toFixed(4)})`, 1.15);
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          const rect = pin ? cv.getBoundingClientRect() : null;
          const lx = rect ? cx - rect.left : -9999;
          const ly = rect ? cy - rect.top : -9999;
          for (const dr of drops) {
            const p = at(t, dr.life, dr.t0);
            if (p <= 0 || p >= 1) { if (dr.trail.length) dr.trail.length = 0; continue; }
            const bx = dr.x * w + Math.sin(dr.ph + t * 1.3) * dr.wob;
            const by = lerp(dr.y0, dr.y1, easeInOut(p)) * h;
            const off = repel(lx, ly, pin, bx, by, 120, 30);
            const x = bx + off.dx, y = by + off.dy;
            // 拖尾：最近几帧位置连成渐淡的一笔（显式历史点，不糊屏）
            dr.trail.push([x, y]);
            if (dr.trail.length > 6) dr.trail.shift();
            if (dr.trail.length > 1) {
              ctx.beginPath();
              ctx.strokeStyle = rgba(dr.accent ? pal.accent : pal.ink, Math.sin(Math.PI * p) * .16);
              ctx.lineWidth = dr.r * .9;
              ctx.moveTo(dr.trail[0][0], dr.trail[0][1]);
              for (let k = 1; k < dr.trail.length; k++) ctx.lineTo(dr.trail[k][0], dr.trail[k][1]);
              ctx.stroke();
            }
            const a = Math.sin(Math.PI * p) * .5;
            ctx.beginPath();
            ctx.fillStyle = rgba(dr.accent ? pal.accent : pal.ink, a);
            ctx.arc(x, y, dr.r, 0, Math.PI * 2);
            ctx.fill();
            // 落纸晕染：后段两圈扩散涟漪（同心圆环，比 radial 渐变省帧）
            if (p > .55) {
              const rp2 = (p - .55) / .45;
              ctx.strokeStyle = rgba(dr.accent ? pal.accent : pal.ink, (1 - rp2) * .2);
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(x, y, dr.r + rp2 * 10, 0, Math.PI * 2); ctx.stroke();
              ctx.beginPath(); ctx.arc(x, y, dr.r + rp2 * 5, 0, Math.PI * 2); ctx.stroke();
            }
          }
        }
      }
      chars.forEach((c, i) => {
        const p = easeBack(at(t, .55, .4 + (beat[i % 5] ?? 0)));
        S(c, `opacity:${clamp01(p * 2).toFixed(3)};transform:translateY(${((1 - p) * -34).toFixed(1)}px) rotate(${((1 - p) * (tilt[i % 5] ?? -4)).toFixed(2)}deg) scale(${(1 + (1 - p) * .28).toFixed(3)})`);
      });
      eyeChars.forEach((c, i) => {
        const p = easeOut(at(t, .4, 1.7 + i * .14));
        S(c, `opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * -14).toFixed(1)}px)`);
      });
      const ps = at(t, .6, 2.3);
      S(sub, `opacity:${ps.toFixed(3)};transform:translateY(${((1 - ps) * 10).toFixed(1)}px)`);
      S(line, `transform:scaleX(${easeOutExpo(at(t, .9, 2.7)).toFixed(4)})`);
      const pi = easeBack(at(t, .6, 2.9));
      S(issue, `opacity:${clamp01(pi * 1.6).toFixed(3)};transform:translateY(${((1 - pi) * 16).toFixed(1)}px) rotate(${(-3 + (1 - pi) * -6).toFixed(2)}deg)`);
    },
  };
}

/** 幕 2 速览：大数压左上 + 右列错落飞入 + expo 滚数 + 分层视差 + 摇入运镜 */
function perfC02(scn: Element, d: PressData): Perf {
  const nums = qa(scn, '[data-r="num"]');
  const cells = qa(scn, '[data-r="cell"]');
  const line = q(scn, '[data-r="inkline"]');
  const brow = q(scn, '[data-r="brow"]');
  const blead = q(scn, '[data-r="blead"]');
  const bday = q(scn, '[data-r="bday"]');
  const bmin = q(scn, '[data-r="bmin"]');
  const deeprow = q(scn, '[data-r="deeprow"]');
  const deeplead = q(scn, '[data-r="deeplead"]');
  const deepv = q(scn, '[data-r="deepv"]');
  const inn = q(scn, '.bz-rp-in');
  // 右列三格手排错落；hero 即 cells[0]
  const sideBeat = [0, .2, .46];
  const beatOf = (i: number): number => (i === 0 ? 0 : sideBeat[i - 1] ?? 0);
  // 滚数时长随位数走：账面越大滚得越久（数据大演出更足）
  const rollDur = (i: number): number => {
    const el = nums[i] as HTMLElement | null;
    const n = Math.round(Number(el?.dataset.n || 0));
    return .9 + Math.min(6, String(n).length) * .12;
  };
  const dur = 4.4 + Math.min(1.2, String(Math.round(d.totalMinutes)).length * .18);
  return {
    dur,
    update({ t, px, py }: PerfCtx): void {
      // 运镜：从左上轻摇入
      dolly(inn, t, (r) => `translate(${(r * -2.2).toFixed(2)}%, ${(r * -1.2).toFixed(2)}%) rotate(${(r * -.5).toFixed(2)}deg)`, 1);
      cells.forEach((c, i) => {
        const p = easeOut(at(t, .6, .25 + beatOf(i)));
        // 视差分层：hero 最浅、右列逐格加深，指针轻推各层（数字幕的呼吸感）
        const depth = i === 0 ? .4 : .8 + i * .35;
        const par = `translate(${(px * depth * 5).toFixed(1)}px, ${(py * depth * 3.4).toFixed(1)}px)`;
        const dir = i === 0 ? `translateY(${((1 - p) * -22).toFixed(1)}px)` : `translateX(${((1 - p) * 30).toFixed(1)}px)`;
        S(c, `opacity:${clamp01(p * 1.5).toFixed(3)};transform:${par} ${dir}`);
      });
      nums.forEach((el, i) => {
        const n = Number(((el as HTMLElement).dataset.n) || 0);
        const p = easeOutExpo(at(t, rollDur(i), .4 + beatOf(i) + .15));
        T(el, el.getAttribute('data-fmt') === 'min' ? humanish(roll(n, p)) : comma(roll(n, p)));
      });
      S(line, `transform:scaleX(${easeInOut(at(t, 1, .3)).toFixed(4)})`);
      if (brow) {
        S(brow, `opacity:${at(t, .7, 2.5).toFixed(3)}`);
        if (blead) S(blead, `transform:scaleX(${easeOut(at(t, .9, 2.7)).toFixed(4)})`);
        S(bday, `opacity:${at(t, .5, 3.1).toFixed(3)}`);
        S(bmin, `opacity:${at(t, .5, 3.3).toFixed(3)}`);
      }
      if (deeprow) {
        S(deeprow, `opacity:${at(t, .7, 2.9).toFixed(3)}`);
        if (deeplead) S(deeplead, `transform:scaleX(${easeOut(at(t, .9, 3.1)).toFixed(4)})`);
        if (deepv) S(deepv, `opacity:${at(t, .5, 3.5).toFixed(3)}`);
      }
    },
  };
}

/** 幕 3 工班钟：刻度短线逐根画出 + 四班环带扫出 + 主针 spring 摆峰 + 跟随针缓步转向指针 */
function perfC03(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c03"]') as HTMLCanvasElement | null;
  const rows = qa(scn, '[data-r="shift"]');
  const dialc = q(scn, '[data-r="dialc"]');
  const maxMin = Math.max(1, ...d.hours);
  let follow = -Math.PI / 2; // 跟随针角度状态（跨帧平滑）
  let followA = 0;           // 跟随针浓度（淡入淡出）
  const jit = rng(31);
  const jits = Array.from({ length: 24 }, () => jit() * .16);
  // 读得越猛的报馆，钟演得越久（高峰桶越大，多给一拍）
  const dur = 6 + (maxMin > 90 ? .5 : 0);
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          const cx0 = w * (w > h * 1.2 ? .36 : .5), cy0 = h * .52;
          const R = Math.min(w * .3, h * .34);
          const rect = pin ? cv.getBoundingClientRect() : null;
          const lx = rect ? cx - rect.left : -9999;
          const ly = rect ? cy - rect.top : -9999;
          // 24 根刻度短线逐根画出（点线被画出来的离散式）
          ctx.strokeStyle = rgba(pal.muted, .85);
          ctx.lineWidth = 1;
          for (let i = 0; i < 24; i++) {
            const p = easeOut(at(t, .06, .1 + i * .028 + jits[i]));
            if (p <= 0) continue;
            const ang = (-90 + i * 15) * Math.PI / 180;
            ctx.globalAlpha = p * .8;
            ctx.beginPath();
            ctx.moveTo(cx0 + Math.cos(ang) * (R + 8), cy0 + Math.sin(ang) * (R + 8));
            ctx.lineTo(cx0 + Math.cos(ang) * (R + 13), cy0 + Math.sin(ang) * (R + 13));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          // 四班环带（外圈弧，按班次扫出）
          const ringP = [at(t, .7, .3), at(t, .7, .45), at(t, .7, .6), at(t, .7, .75)];
          const ranges: Array<[number, number]> = [[0, 6], [6, 12], [12, 18], [18, 24]];
          ctx.lineWidth = 3;
          ctx.lineCap = 'butt';
          ranges.forEach(([lo, hi], si) => {
            const p = easeOut(ringP[si]);
            if (p <= 0) return;
            const a0 = (-90 + lo * 15) * Math.PI / 180;
            const a1 = (-90 + lo * 15 + (hi - lo) * 15 * p) * Math.PI / 180;
            ctx.beginPath();
            ctx.strokeStyle = rgba(pal.line, .55);
            ctx.arc(cx0, cy0, R + 22, a0, a1);
            ctx.stroke();
          });
          // 24 刻度点：非均匀点亮，半径/亮度随该小时分钟数；悬停放大 + 浮签
          let hoverText = '';
          for (let i = 0; i < 24; i++) {
            const p = easeOut(at(t, .32, .7 + i * .09 + jits[i]));
            if (p <= 0) continue;
            const ang = (-90 + i * 15) * Math.PI / 180;
            const v = d.hours[i] / maxMin;
            const x = cx0 + Math.cos(ang) * R, y = cy0 + Math.sin(ang) * R;
            const isPeak = i === d.peakHour;
            const hovered = pin && Math.hypot(lx - x, ly - y) < 26;
            const r = (2.2 + v * 9) * p * (hovered ? 1.5 : 1);
            ctx.beginPath();
            ctx.fillStyle = rgba(isPeak || hovered ? pal.accent : pal.ink, (.18 + .82 * p) * (.3 + .7 * (.35 + .65 * v)));
            if (isPeak || hovered) { ctx.shadowColor = rgba(pal.accent, .55 * p); ctx.shadowBlur = 12 * p; }
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (hovered) hoverText = `${i} 点 · ${humanish(d.hours[i])}（${shiftOfHour(i)}）`;
          }
          // 主针：spring 摆到高峰（过冲回正）
          if (d.peakHour >= 0) {
            const sp = springUp(at(t, 1.7, 2.4));
            if (sp > 0.001) {
              const ang = (-90 + d.peakHour * 15 * sp) * Math.PI / 180;
              ctx.beginPath();
              ctx.strokeStyle = pal.accent;
              ctx.lineWidth = 2.4;
              ctx.moveTo(cx0, cy0);
              ctx.lineTo(cx0 + Math.cos(ang) * (R - 16), cy0 + Math.sin(ang) * (R - 16));
              ctx.stroke();
              ctx.beginPath();
              ctx.fillStyle = pal.accent;
              ctx.arc(cx0, cy0, 3.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // 跟随针：指针在层内时，一根细虚针缓步转向指针方位（钟面「活在当下」）
          if (pin) {
            const target = Math.atan2(ly - cy0, lx - cx0);
            follow += sdelta(target, follow) * .13;
            followA = Math.min(1, followA + .08);
          } else {
            followA = Math.max(0, followA - .06);
          }
          if (followA > 0.01) {
            ctx.globalAlpha = followA * .5;
            ctx.strokeStyle = pal.accent;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(cx0 + Math.cos(follow) * (R - 30), cy0 + Math.sin(follow) * (R - 30));
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
          if (hoverText) drawTip(ctx, lx, ly, hoverText, pal);
        }
      }
      rows.forEach((row, i) => {
        const p = easeOut(at(t, .5, 1.1 + i * .2));
        S(row, `opacity:${p.toFixed(3)};transform:translateX(${((1 - p) * 22).toFixed(1)}px)`);
        const b = q(row, '[data-r="shiftb"]');
        if (b) S(b, `transform:scaleX(${easeOutExpo(at(t, .7, 1.35 + i * .2)).toFixed(4)})`);
        const v = q(row, '[data-r="shiftv"]');
        if (v) {
          const n = Number((v as HTMLElement).dataset.n || 0);
          T(v, humanish(roll(n, easeOutExpo(at(t, .9, 1.3 + i * .2)))));
        }
      });
      if (dialc) {
        const p = at(t, .6, 5);
        S(dialc, `opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * 8).toFixed(1)}px)`);
      }
    },
  };
}

/** 幕 4 热力带：虚线外框画出来 + 对角波抖动显影 + 光标十字跟随 + 峰值格描金 + 竖排刊字 */
function perfC04(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c04"]') as HTMLCanvasElement | null;
  const vt = qa(scn, '[data-r="vt"] span');
  const maxMin = Math.max(1, ...d.matrix.flatMap((m) => m.hours));
  // 全史峰值格 build 期找好（逐帧只画不找）
  let pk = { r: -1, c: -1, v: 0 };
  d.matrix.forEach((m, r) => m.hours.forEach((v, c) => { if (v > pk.v) pk = { r, c, v }; }));
  const jit = rng(47);
  const jits = d.matrix.map(() => Array.from({ length: 24 }, () => jit() * .14));
  const dur = 5.6 + Math.min(.8, d.matrix.length * .04);
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      vt.forEach((c, i) => {
        const p = easeOut(at(t, .5, .25 + i * .24));
        S(c, `opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * 18).toFixed(1)}px)`);
      });
      if (!cv) return;
      const f = fit(cv);
      if (!f) return;
      const { ctx, w, h } = f;
      ctx.clearRect(0, 0, w, h);
      const cols = 24, rowsN = d.matrix.length;
      const gx = w * .12, gw = w * .66;
      const gy = h * .24, gh = h * .54;
      const cw = gw / cols, chh = gh / rowsN;
      const rect = pin ? cv.getBoundingClientRect() : null;
      const lx = rect ? cx - rect.left : -9999;
      const ly = rect ? cy - rect.top : -9999;
      let hoverText = '';
      // 光标十字（持续响应）：指针所在列/行整条提亮
      let hcx = -1, hry = -1;
      if (pin && lx >= gx && lx < gx + gw && ly >= gy && ly < gy + gh) {
        hcx = Math.floor((lx - gx) / cw);
        hry = Math.floor((ly - gy) / chh);
        ctx.fillStyle = rgba(pal.accent, .06);
        ctx.fillRect(gx + hcx * cw, gy, cw, gh);
        ctx.fillRect(gx, gy + hry * chh, gw, chh);
      }
      // 虚线外框被画出来：dash 实段长度随 t 沿周长推进（描边路径动画）
      const per = 2 * (gw + gh);
      const fp = easeInOut(at(t, 1.3, .15));
      if (fp > 0) {
        ctx.setLineDash([per * fp, per]);
        ctx.strokeStyle = rgba(pal.muted, .9);
        ctx.lineWidth = 1;
        ctx.strokeRect(gx + .5, gy + .5, gw - 1, gh - 1);
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1;
      for (let r = 0; r < rowsN; r++) {
        const day = d.matrix[r];
        for (let c = 0; c < cols; c++) {
          // 对角波 + 确定性抖动：显影不是匀速推进
          const p = easeOut(at(t, .4, .35 + (r + c) * .018 + jits[r][c]));
          if (p <= 0) continue;
          const v = day.hours[c] / maxMin;
          const x = gx + c * cw, y = gy + r * chh;
          const hot = r === hry && c === hcx;
          ctx.fillStyle = v > 0
            ? rgba(hot ? pal.accent : pal.accentSoft, (.12 + .88 * p) * (.25 + .75 * Math.min(1, v * 1.4)))
            : rgba(pal.line, .35 * p);
          ctx.fillRect(x + 1, y + 1, cw - 2, chh - 2);
          if (hot && day.hours[c] > 0) {
            ctx.strokeStyle = pal.accent;
            ctx.strokeRect(x + .5, y + .5, cw - 1, chh - 1);
            hoverText = `${day.label} ${c} 点 · ${humanish(day.hours[c])}`;
          }
        }
      }
      // 全史峰值格：后期描金
      const gp = at(t, .5, 3.6);
      if (pk.r >= 0 && pk.v > 0 && gp > 0) {
        const x = gx + pk.c * cw, y = gy + pk.r * chh;
        ctx.strokeStyle = rgba(pal.accent, gp);
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + .5, y + .5, cw - 2, chh - 2);
      }
      // 轴标：底部小时 + 左侧日期
      ctx.fillStyle = pal.muted;
      ctx.font = `${Math.max(10, w * .0085)}px ${HEI}`;
      ctx.textAlign = 'center';
      [0, 6, 12, 18, 23].forEach((hc) => ctx.fillText(String(hc), gx + hc * cw + cw / 2, gy + gh + 18));
      ctx.textAlign = 'right';
      d.matrix.forEach((day, r) => {
        const p = at(t, .3, .4 + r * .05);
        ctx.fillStyle = rgba(pal.muted, .4 + .6 * p);
        ctx.fillText(day.label, gx - 8, gy + r * chh + chh / 2 + 4);
      });
      if (hoverText) drawTip(ctx, lx, ly, hoverText, pal);
    },
  };
}

/** 幕 5 读得最久：头版头条砸落紧版 + 次榜活字坠落（非等差捡字节奏） */
function perfC05(scn: Element, _d: PressData): Perf {
  const head = q(scn, '[data-r="head"]');
  const headT = q(scn, '[data-r="head"] .bz-rp-head-t');
  const headRank = q(scn, '[data-r="head"] [data-r="rank"]');
  const headS = q(scn, '[data-r="heads"]');
  const headB = q(scn, '[data-r="headb"]');
  const rows = qa(scn, '[data-r="row"]');
  const dur = 5.2;
  const beat = [0, .16, .38, .66]; // 捡字节奏：不匀速，隔行停顿
  return {
    dur,
    update({ t }: PerfCtx): void {
      // 头条砸落 + 字距从松到紧（排字工紧版）
      const hp = easeBack(at(t, .7, .3));
      if (head) S(head, `opacity:${clamp01(hp * 2).toFixed(3)};transform:translateY(${((1 - hp) * -26).toFixed(1)}px)`);
      if (headT) S(headT, `letter-spacing:${(.5 - .44 * clamp01(hp)).toFixed(3)}em`);
      if (headRank) {
        const rp = easeBack(at(t, .45, .55));
        S(headRank, `opacity:${clamp01(rp * 2).toFixed(3)};transform:scale(${(rp * .4 + .6).toFixed(3)}) rotate(${((1 - rp) * -12).toFixed(2)}deg)`);
      }
      if (headB) S(headB, `transform:scaleX(${easeOutExpo(at(t, .8, .9)).toFixed(4)})`);
      if (headS) S(headS, `opacity:${at(t, .5, 1).toFixed(3)}`);
      rows.forEach((row, i) => {
        const b = beat[i % 4] ?? 0;
        // 活字坠落：上方落下 + 微旋 + 过冲回正
        const p = easeBack(at(t, .6, .9 + b));
        S(row, `opacity:${clamp01(p * 2).toFixed(3)};transform:translateY(${((1 - p) * -44).toFixed(1)}px) rotate(${((1 - p) * (i % 2 ? 1.4 : -1.8)).toFixed(2)}deg)`);
        const rank = q(row, '[data-r="rank"]');
        if (rank) {
          const pr = easeBack(at(t, .4, 1.05 + b));
          S(rank, `opacity:${clamp01(pr * 2).toFixed(3)};transform:scale(${(pr * .4 + .6).toFixed(3)}) rotate(${((1 - pr) * -10).toFixed(2)}deg)`);
        }
        const bar = q(row, '[data-r="minb"]');
        if (bar) S(bar, `transform:scaleX(${easeOutExpo(at(t, .55, 1.25 + b)).toFixed(4)})`);
      });
    },
  };
}

/** 幕 6 消息源榜：滚筒亮带压过双条 + 里程滚数 + 王牌章压右上角落章 + 横摇运镜 */
function perfC06(scn: Element, d: PressData): Perf {
  const rows = qa(scn, '[data-r="row"]');
  const note = q(scn, '[data-r="snote"]');
  const ace = q(scn, '[data-r="ace"]');
  const roller = q(scn, '[data-r="roller"]');
  const inn = q(scn, '.bz-rp-in');
  const dur = 4.6 + Math.min(1.2, d.sources.length * .18);
  return {
    dur,
    update({ t }: PerfCtx): void {
      // 运镜：横摇入
      dolly(inn, t, (r) => `translateX(${(r * 2.6).toFixed(2)}%) rotate(${(r * .5).toFixed(2)}deg)`, 1.05);
      // 滚筒压过：亮带从左扫到右，条在亮带过后展开
      const rp = easeInOut(at(t, 2.2, .45));
      if (roller) S(roller, `opacity:${rp > 0 && rp < 1 ? .9 : 0};transform:translateX(${(rp * 1150).toFixed(1)}%)`);
      rows.forEach((row, i) => {
        const p = easeOut(at(t, .5, .4 + i * .24));
        S(row, `opacity:${p.toFixed(3)}`);
        const bar = q(row, '[data-r="bar"]');
        if (bar) S(bar, `transform:scaleX(${easeInOut(at(t, .9, .7 + i * .24)).toFixed(4)})`);
        const sub = q(row, '[data-r="subbar"]');
        if (sub) S(sub, `transform:scaleX(${easeInOut(at(t, .8, 1 + i * .24)).toFixed(4)})`);
        const cnt = q(row, '[data-r="cnt"]');
        if (cnt) {
          const n = Number((cnt as HTMLElement).dataset.n || 0);
          const x = Number((cnt as HTMLElement).dataset.x || 0);
          const cp = easeOutExpo(at(t, 1, .8 + i * .24));
          T(cnt, `${humanish(roll(n, cp))} · ${roll(x, cp)} 篇`);
        }
      });
      // 王牌章：back 落右上压角（落地震）
      const ap = easeBack(at(t, .55, 3.1));
      S(ace, `opacity:${clamp01(ap * 2).toFixed(3)};transform:scale(${(1 + (1 - ap) * 1.4).toFixed(3)}) rotate(${(-10 + (1 - ap) * -14).toFixed(2)}deg)`);
      if (note) S(note, `opacity:${at(t, .6, 3.6).toFixed(3)}`);
    },
  };
}

/** 幕 7 号外：电传纸左进 + 走纸孔滚动 + 电头虚线连发 + 行打字机显影 + 今日注记 */
function perfC07(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c07"]') as HTMLCanvasElement | null;
  const rows = qa(scn, '[data-r="wire"]');
  const today = q(scn, '[data-r="today"]');
  const inn = q(scn, '.bz-rp-in');
  const dur = 4.4 + Math.min(2.4, d.recent.length * .28); // 电文越长发得越久
  return {
    dur,
    update({ t, pal }: PerfCtx): void {
      // 运镜：电传纸从右往左进纸
      dolly(inn, t, (r) => `translateX(${(r * 2.4).toFixed(2)}%)`, .9);
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          // 走纸孔（两列，随 t 慢滚 = 走纸中）
          ctx.fillStyle = rgba(pal.muted, .3);
          const holeGap = 26, roll = (t * 12) % holeGap;
          for (let y = -holeGap; y < h + holeGap; y += holeGap) {
            const yy = y + roll;
            ctx.beginPath(); ctx.arc(w * .045, yy, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(w * .955, yy, 2.2, 0, Math.PI * 2); ctx.fill();
          }
          // 电头虚线：dashoffset 随 t 走 = 电键不停发报
          ctx.setLineDash([7, 9]);
          ctx.lineDashOffset = -t * 26;
          ctx.strokeStyle = rgba(pal.accent, .4);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(w * .06, h * .16); ctx.lineTo(w * .94, h * .16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w * .06, h * .88); ctx.lineTo(w * .94, h * .88); ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }
      }
      // 行 = 电传连发：clip-path 从左到右显影（打字机），非等差电码节奏
      const beat = [0, .12, .3, .5, .78, 1.02, 1.2, 1.5];
      rows.forEach((row, i) => {
        const b = beat[i % 8] ?? 0;
        const p = easeOut(at(t, .4, .35 + b));
        S(row, `opacity:${p.toFixed(3)};clip-path:inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`);
        const dot = q(row, '[data-r="dot"]');
        if (dot) {
          const pulse = .5 + .5 * Math.sin(t * 5 + i * 1.7);
          S(dot, `opacity:${(p * (.45 + .55 * pulse)).toFixed(3)};transform:scale(${(p * (.8 + .3 * pulse)).toFixed(3)})`);
        }
        const ago = q(row, '[data-r="ago"]');
        if (ago) S(ago, `opacity:${at(t, .4, .55 + b).toFixed(3)}`);
      });
      if (today) S(today, `opacity:${at(t, .6, Math.max(2.2, dur - 1.2)).toFixed(3)}`);
    },
  };
}

/** 幕 8 收录节奏：滚筒亮带横扫 + 柱 spring 拔起（随亮带顺序）+ 峰值描金纸屑 + 拉远运镜 */
function perfC08(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c08"]') as HTMLCanvasElement | null;
  const labels = qa(scn, '[data-r="dl"]');
  const note = q(scn, '[data-r="note"]');
  const inn = q(scn, '.bz-rp-in');
  const lib = d.lib;
  // 纸屑量随单日收录峰值派生：收得越多，峰值庆祝越盛大（上限 40 片）
  const nConf = Math.min(40, 8 + (lib ? lib.byDayPeak * 2 : 0));
  const rand = rng(88);
  const confetti = Array.from({ length: nConf }, () => ({
    ang: rand() * Math.PI * 2, sp: 30 + rand() * 70,
    sz: 2.4 + rand() * 3, rot: rand() * Math.PI, vr: (rand() - .5) * 6,
  }));
  const dur = 5.6;
  return {
    dur,
    update({ t, pal }: PerfCtx): void {
      // 运镜：整体向后退开亮出柱区
      dolly(inn, t, (r) => `scale(${(1 - r * .04).toFixed(4)})`, 1.1);
      if (cv && lib && lib.byDay.length) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          const base = h * .8, top = h * .16;
          const n = lib.byDay.length;
          const bw = Math.min(30, (w * .7) / n * .52);
          const step = (w * .7) / n;
          const x0 = (w - step * n) / 2 + step / 2 + w * .05; // 柱区右移让出左上标题
          const peak = Math.max(1, lib.byDayPeak);
          // 滚筒亮带：从左扫到右，柱按亮带进度顺序弹起
          const rollP = easeInOut(at(t, 2.1, .25));
          const rollX = lerp(-w * .06, w * 1.06, rollP);
          if (rollP > 0 && rollP < 1) {
            const g = ctx.createLinearGradient(rollX - 46, 0, rollX + 46, 0);
            g.addColorStop(0, rgba(pal.accent, 0));
            g.addColorStop(.5, rgba(pal.accent, .1));
            g.addColorStop(1, rgba(pal.accent, 0));
            ctx.fillStyle = g;
            ctx.fillRect(rollX - 46, top - 14, 92, base - top + 22);
          }
          lib.byDay.forEach((day, i) => {
            const p = springUp(at(t, .8, .3 + ((i + 1) / n) * 1.8));
            if (p <= 0) return;
            const x = x0 + i * step;
            const hh = (day.n / peak) * (base - top) * p;
            ctx.fillStyle = rgba(pal.accentSoft, .8);
            ctx.fillRect(x - bw / 2, base - hh, bw, hh);
            if (day.n > 0 && day.n === lib.byDayPeak) {
              const gp = easeOut(at(t, .4, 3.2));
              if (gp > 0) {
                ctx.strokeStyle = pal.accent;
                ctx.lineWidth = 2;
                ctx.strokeRect(x - bw / 2 - 3, base - hh - 3, bw + 6, hh + 3);
                ctx.fillStyle = pal.accent;
                ctx.font = `700 ${Math.max(11, w * .013)}px ${SERIF}`;
                ctx.textAlign = 'center';
                ctx.fillText(String(day.n), x, base - hh - 10);
                // 峰值纸屑：小纸片旋转飘落（纯 t 函数，无帧间状态）
                const cp = at(t, 1.6, 3.3);
                if (cp > 0 && cp < 1) {
                  for (const c of confetti) {
                    const fx = x + Math.cos(c.ang) * c.sp * easeOut(cp);
                    const fy = base - hh - 6 + Math.sin(c.ang) * c.sp * easeOut(cp) + 90 * cp * cp;
                    ctx.save();
                    ctx.translate(fx, fy);
                    ctx.rotate(c.rot + c.vr * cp);
                    ctx.fillStyle = rgba(pal.accent, Math.sin(Math.PI * cp) * .55);
                    ctx.fillRect(-c.sz / 2, -c.sz / 4, c.sz, c.sz / 2);
                    ctx.restore();
                  }
                }
              }
            }
            ctx.fillStyle = rgba(pal.ink, .25);
            ctx.fillRect(x - bw / 2, base, bw, 1.5);
          });
        }
      }
      labels.forEach((lb, i) => {
        const p = at(t, .35, .45 + i * .09);
        S(lb, `opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * 6).toFixed(1)}px)`);
      });
      if (note) S(note, `opacity:${at(t, .6, 3.7).toFixed(3)}`);
    },
  };
}

/** 幕 9 驻留日历：对角波显影 + 连胜线逐段描画（笔尖端点）+ 今天格描边 + 大数 spring + 指针视差 */
function perfC09(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c09"]') as HTMLCanvasElement | null;
  const maxMin = Math.max(1, ...d.cal.map((c) => c.minutes));
  const jit = rng(99);
  const jits = d.cal.map(() => jit() * .12);
  const dur = 5.6;
  return {
    dur,
    update({ t, pal, cx, cy, py, pin }: PerfCtx): void {
      if (!cv) return;
      const f = fit(cv);
      if (!f) return;
      const { ctx, w, h } = f;
      ctx.clearRect(0, 0, w, h);
      const n = d.cal.length;
      const cols = 8, rowsN = 7;
      const size = Math.min((w * .5) / cols, (h * .52) / rowsN, 44);
      const gx = w * .1, gy = h * .3; // 格区左移，右侧留给连胜大数
      const rect = pin ? cv.getBoundingClientRect() : null;
      const lx = rect ? cx - rect.left : -9999;
      const ly = rect ? cy - rect.top : -9999;
      let hoverText = '';
      d.cal.forEach((day, i) => {
        const col = Math.floor(i / rowsN), row = i % rowsN;
        const p = easeOut(at(t, .3, .25 + (col + row) * .05 + jits[i]));
        if (p <= 0) return;
        const x = gx + col * size * 1.35, y = gy + row * size * 1.35;
        const v = day.minutes / maxMin;
        const hovered = pin && Math.hypot(lx - (x + size / 2), ly - (y + size / 2)) < size * .8;
        if (day.minutes > 0) {
          ctx.fillStyle = rgba(hovered ? pal.accent : pal.accentSoft, (.15 + .85 * p) * (.3 + .7 * Math.min(1, v * 1.5)));
          ctx.fillRect(x, y, size, size);
        } else {
          ctx.strokeStyle = rgba(pal.line, .7 * p);
          ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
        }
        // 今天格：细橙描边（本报出版到今天）
        if (i === n - 1) {
          ctx.strokeStyle = rgba(pal.accent, p);
          ctx.lineWidth = 1.6;
          ctx.strokeRect(x - 2.5, y - 2.5, size + 5, size + 5);
          ctx.lineWidth = 1;
        }
        if (hovered) hoverText = `${day.label} · ${day.minutes > 0 ? humanish(day.minutes) : '没翻报'}`;
      });
      // 连胜线：逐段描画（最后一段插值 = 点线被画出来），带笔尖端点
      const streak = Math.min(d.streak, n);
      if (streak > 1) {
        const pts: Array<[number, number]> = [];
        for (let i = n - streak; i < n; i++) {
          const col = Math.floor(i / rowsN), row = i % rowsN;
          pts.push([gx + col * size * 1.35 + size / 2, gy + row * size * 1.35 + size / 2]);
        }
        const sp = easeInOut(at(t, 1.3, 2.5));
        const p0 = pts[0], p1 = pts[1];
        if (sp > 0 && p0 && p1) {
          const total = pts.length - 1;
          const fp = sp * total;
          const k = Math.min(Math.floor(fp), total - 1);
          const frac = fp - k;
          const pk2 = pts[k] ?? p0;
          const pk3 = pts[k + 1] ?? p1;
          ctx.beginPath();
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 2;
          ctx.moveTo(p0[0], p0[1]);
          for (let m = 1; m <= k; m++) {
            const pm = pts[m];
            if (pm) ctx.lineTo(pm[0], pm[1]);
          }
          const tipX = lerp(pk2[0], pk3[0], frac);
          const tipY = lerp(pk2[1], pk3[1], frac);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
          ctx.beginPath();
          ctx.fillStyle = pal.accent;
          ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 右侧连胜大数：spring 落位 + 指针纵向视差
      const tp = springUp(at(t, .8, 3.2));
      if (tp > 0.01) {
        ctx.globalAlpha = clamp01(tp * 1.4);
        ctx.fillStyle = pal.accent;
        ctx.font = `700 ${Math.max(26, w * .035)}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(d.streak), w * .78, h * .46 + py * 7);
        ctx.fillStyle = pal.dim;
        ctx.font = `${Math.max(12, w * .011)}px ${HEI}`;
        ctx.fillText('连 续 天 数', w * .78, h * .46 + 30 + py * 4);
        ctx.globalAlpha = 1;
      }
      if (hoverText) drawTip(ctx, lx, ly, hoverText, pal);
    },
  };
}

/** 幕 10 班次×来源：堆叠四段接力 + 悬停行提亮余行压暗（余像记忆）+ 斜切运镜 */
function perfC10(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c10"]') as HTMLCanvasElement | null;
  const lgs = qa(scn, '[data-r="lg"]');
  const inn = q(scn, '.bz-rp-in');
  let hoverRow = -1; // 悬停行记忆：指针离开后保持最后的高亮（余像），回幕再更新
  const dur = 5.6;
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      // 运镜：斜切入场
      dolly(inn, t, (r) => `translate(${(r * -2).toFixed(2)}%, ${(r * 1).toFixed(2)}%) rotate(${(r * -.4).toFixed(2)}deg)`, 1);
      if (cv && d.srcShift.length) {
        const f = fit(cv);
        if (!f) return;
        const { ctx, w, h } = f;
        ctx.clearRect(0, 0, w, h);
        const rows = d.srcShift;
        const gx = w * .17, gw = w * .6;
        const gy = h * .3, rowH = Math.min(34, (h * .52) / rows.length);
        const maxTotal = Math.max(1, ...rows.map((r) => r.shifts.reduce((s, x) => s + x, 0)));
        const segColors = [rgba(pal.line, .9), rgba(pal.accentSoft, .5), rgba(pal.accentSoft, .8), pal.accent];
        const rect = pin ? cv.getBoundingClientRect() : null;
        const lx = rect ? cx - rect.left : -9999;
        const ly = rect ? cy - rect.top : -9999;
        let hoverText = '';
        let hotRow = -1;
        rows.forEach((r, i) => {
          const y = gy + i * rowH * 1.5;
          if (pin && lx >= gx && lx <= gx + gw && ly >= y && ly <= y + rowH * .52) hotRow = i;
        });
        // 指针在场才更新记忆；离场保持余像，翻幕重演时随 t 重置高亮节奏
        if (pin) hoverRow = hotRow;
        rows.forEach((r, i) => {
          const y = gy + i * rowH * 1.5;
          const barH = rowH * .52;
          const p = easeOut(at(t, .9, .35 + i * .22));
          const total = r.shifts.reduce((s, x) => s + x, 0);
          const dimmed = hoverRow >= 0 && hoverRow !== i;
          ctx.fillStyle = rgba(pal.ink2, clamp01(p * 2) * (dimmed ? .4 : 1));
          ctx.font = `600 ${Math.max(13, w * .012)}px ${SERIF}`;
          ctx.textAlign = 'right';
          ctx.fillText(r.name.slice(0, 8), gx - 12, y + barH / 2 + 4);
          // 四段堆叠（段接力：段 j 在总进度 p 的子窗内生长）
          let acc = 0;
          const segP = clamp01(p * 1.35 - .1);
          r.shifts.forEach((min, j) => {
            const segW = (min / maxTotal) * gw;
            const gp = clamp01(segP * 4 - j);
            if (gp > 0) {
              ctx.globalAlpha = dimmed ? .35 : 1;
              ctx.fillStyle = segColors[j];
              ctx.fillRect(gx + acc * segP, y, segW * gp, barH);
              ctx.globalAlpha = 1;
            }
            acc += min;
          });
          if (total > 0) {
            ctx.fillStyle = rgba(pal.dim, dimmed ? .35 : 1);
            ctx.textAlign = 'left';
            ctx.font = `${Math.max(11, w * .0105)}px ${HEI}`;
            ctx.fillText(humanish(total), gx + gw + 10, y + barH / 2 + 4);
          }
          if (hotRow === i) {
            ctx.strokeStyle = pal.accent;
            ctx.lineWidth = 1;
            ctx.strokeRect(gx + .5, y + .5, gw - 1, barH - 1);
            hoverText = `${r.name} · ${humanish(total)}（夜 ${r.shifts[0]} / 晨 ${r.shifts[1]} / 午 ${r.shifts[2]} / 晚 ${r.shifts[3]}）`;
          }
        });
        if (hoverText) drawTip(ctx, lx, ly, hoverText, pal);
      }
      lgs.forEach((lg, i) => {
        S(lg, `opacity:${at(t, .5, 1.6 + i * .14).toFixed(3)}`);
      });
    },
  };
}

/** 幕 11 关键词：螺旋落位 + 随机方向飞入 + 斥力弹簧回位（持续响应）+ 高频词着重号 */
function perfC11(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c11"]') as HTMLCanvasElement | null;
  let laidW = 0, laidH = 0;
  interface LaidWord { w: string; n: number; x: number; y: number; size: number; width: number; ox: number; oy: number; vx: number; vy: number; dx: number; dy: number; dl: number }
  let laid: LaidWord[] = [];
  const rand = rng(7);
  const maxN = Math.max(1, ...d.words.map((x) => x.n));
  const dur = 5.6;
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      if (!cv || !d.words.length) return;
      const f = fit(cv);
      if (!f) return;
      const { ctx, w, h } = f;
      if (laidW !== w || laidH !== h || !laid.length) {
        // 螺旋落位：按词频从大到小，从中心阿基米德螺旋找不重叠位（词云心偏左让出标题）
        laidW = w; laidH = h;
        laid = [];
        const minN = Math.min(...d.words.map((x) => x.n));
        const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
        ctx.font = `700 20px ${SERIF}`;
        d.words.forEach((word) => {
          const scale = (word.n - minN) / Math.max(1, maxN - minN);
          const size = Math.round(14 + scale * (h * .062));
          ctx.font = `700 ${size}px ${SERIF}`;
          const tw = ctx.measureText(word.w).width;
          const th = size * 1.15;
          const cxp = w * .46, cyp = h * .55;
          let placedOk = false;
          let px2 = cxp, py2 = cyp;
          for (let step = 0; step < 640 && !placedOk; step++) {
            const ang = step * .35;
            const rad = 6 + step * (Math.min(w, h) / 340);
            px2 = cxp + Math.cos(ang) * rad * 1.5;
            py2 = cyp + Math.sin(ang) * rad;
            const box = { x: px2 - tw / 2 - 6, y: py2 - th / 2 - 3, w: tw + 12, h: th + 6 };
            if (box.x < w * .06 || box.x + box.w > w * .94 || box.y < h * .2 || box.y + box.h > h * .92) continue;
            placedOk = !placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
          }
          if (placedOk) {
            placed.push({ x: px2 - tw / 2 - 6, y: py2 - th / 2 - 3, w: tw + 12, h: th + 6 });
            laid.push({
              w: word.w, n: word.n, x: px2, y: py2, size, width: tw,
              ox: 0, oy: 0, vx: 0, vy: 0,
              dx: (rand() - .5) * 70, dy: (rand() - .5) * 70, dl: rand() * 1.4,
            });
          }
        });
      }
      ctx.clearRect(0, 0, w, h);
      const rect = pin ? cv.getBoundingClientRect() : null;
      const lx = rect ? cx - rect.left : -9999;
      const ly = rect ? cy - rect.top : -9999;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      laid.forEach((lw) => {
        const p = easeBack(at(t, .5, .3 + lw.dl));
        if (p <= 0) return;
        const fly = 1 - clamp01(p); // 入场位移系数（easeBack 过冲时为负 = 越位回弹）
        // 斥力目标 + 弹簧积分：词被指针推开后弹性回位（持续响应，带余劲）
        const want = repel(lx, ly, pin, lw.x, lw.y, 130, 34);
        lw.vx += (want.dx - lw.ox) * .16; lw.vy += (want.dy - lw.oy) * .16;
        lw.vx *= .74; lw.vy *= .74;
        lw.ox += lw.vx; lw.oy += lw.vy;
        const big = lw.n >= maxN - 1;
        ctx.font = `700 ${lw.size}px ${SERIF}`;
        ctx.fillStyle = rgba(big ? pal.accent : pal.ink, (.25 + .75 * clamp01(p)) * (big ? 1 : .82));
        ctx.fillText(lw.w, lw.x + lw.ox + lw.dx * fly, lw.y + lw.oy + lw.dy * fly);
        // 高频词下划点线（报章着重号语法）
        if (big && p >= 1) {
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = rgba(pal.accent, .7);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(lw.x + lw.ox - lw.width / 2, lw.y + lw.oy + lw.size * .68);
          ctx.lineTo(lw.x + lw.ox + lw.width / 2, lw.y + lw.oy + lw.size * .68);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    },
  };
}

/** 幕 12 报库盘点：墨盘双环 spring 扫出 + 环端墨点 + 环心百分数同步滚 + 右列三格视差飞入 */
function perfC12(scn: Element, _d: PressData): Perf {
  const cv = q(scn, '[data-cv="c12"]') as HTMLCanvasElement | null;
  const nums = qa(scn, '[data-r="num"]');
  const cells = qa(scn, '[data-r="cell"]');
  const ringc = q(scn, '[data-r="ringc"]');
  const ringv = q(scn, '[data-r="ringv"]');
  const rate = Number((ringv as HTMLElement | null)?.textContent?.replace('%', '') || 0);
  const inn = q(scn, '.bz-rp-in');
  const dur = 5.4;
  return {
    dur,
    update({ t, pal, px, py }: PerfCtx): void {
      // 运镜：轻推近（墨盘转起来）
      dolly(inn, t, (r) => `scale(${(1 - r * .035).toFixed(4)})`, 1.1);
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          const cx0 = w * .26, cy0 = h * .55;
          const R = Math.min(w * .13, h * .21);
          // 墨盘双环：底环整圈淡墨，前环按已读率 spring 扫出
          const p = springUp(at(t, 1.7, .5));
          ctx.lineWidth = 3;
          ctx.strokeStyle = rgba(pal.line, .9);
          ctx.beginPath(); ctx.arc(cx0, cy0, R + 12, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 10;
          ctx.strokeStyle = rgba(pal.line, .5);
          ctx.beginPath(); ctx.arc(cx0, cy0, R, 0, Math.PI * 2); ctx.stroke();
          if (p > 0.001) {
            const a1 = (-90 + 360 * (rate / 100) * p) * Math.PI / 180;
            ctx.strokeStyle = pal.accent;
            ctx.beginPath(); ctx.arc(cx0, cy0, R, -Math.PI / 2, a1); ctx.stroke();
            // 环端墨点（印刷落墨的头）
            ctx.beginPath();
            ctx.fillStyle = pal.accent;
            ctx.arc(cx0 + Math.cos(a1) * R, cy0 + Math.sin(a1) * R, 5.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // 环心百分数与环同步滚（含 -50% 居中位移，与 CSS 初始一致）
      if (ringc) {
        const p = springUp(at(t, 1.7, .5));
        S(ringc, `opacity:${clamp01(p * 2).toFixed(3)};transform:translate(-50%, -50%) scale(${(.9 + .1 * clamp01(p)).toFixed(3)})`);
        if (ringv) T(ringv, `${Math.round(rate * clamp01(p))}%`);
      }
      // 三格右列：飞入 + 滚数 + 逐格加深的指针视差
      cells.forEach((c, i) => {
        const el = q(c, '[data-r="num"]');
        const n = Number(((el as HTMLElement | null)?.dataset.n) || 0);
        const p = easeOutExpo(at(t, 1.1, .7 + i * .22));
        T(el, comma(roll(n, p)));
        const depth = .6 + i * .4;
        S(c, `opacity:${clamp01(p * 1.6).toFixed(3)};transform:translate(${(px * depth * 6).toFixed(1)}px, ${(py * depth * 4 + (1 - p) * 20).toFixed(1)}px)`);
      });
    },
  };
}

/** 幕 13 压库专页：卷宗掀角入场（perspective rotateY 回正）+ 天数 expo 里程 + 压库戳连落 */
function perfC13(scn: Element, _d: PressData): Perf {
  const rows = qa(scn, '[data-r="old3"]');
  const inn = q(scn, '.bz-rp-in');
  const dur = 5.6;
  return {
    dur,
    update({ t }: PerfCtx): void {
      // 运镜：页缘轻掀（perspective 微转）
      dolly(inn, t, (r) => `perspective(900px) rotateY(${(r * 3).toFixed(2)}deg)`, 1.05);
      rows.forEach((row, i) => {
        // 掀角入场：纸页从折角翻开回正（transform-origin 在 CSS 设 left center）
        const p = easeOut(at(t, .7, .4 + i * .42));
        S(row, `opacity:${p.toFixed(3)};transform:perspective(700px) rotateY(${((1 - p) * -16).toFixed(2)}deg) translateX(${((1 - p) * -18).toFixed(1)}px)`);
        const rank = q(row, '[data-r="o3rank"]');
        if (rank) {
          const pr = easeBack(at(t, .45, .6 + i * .42));
          S(rank, `opacity:${clamp01(pr * 2).toFixed(3)};transform:scale(${(pr * .4 + .6).toFixed(3)}) rotate(${((1 - pr) * -12).toFixed(2)}deg)`);
        }
        const on = q(row, '[data-r="o3n"]');
        if (on) T(on, String(roll(Number((on as HTMLElement).dataset.n || 0), easeOutExpo(at(t, 1, .9 + i * .42)))));
        const tag = q(row, '[data-r="o3tag"]');
        if (tag) {
          const tp = easeBack(at(t, .5, 1.4 + i * .42));
          S(tag, `opacity:${clamp01(tp * 2).toFixed(3)};transform:scale(${(1 + (1 - tp) * 1.3).toFixed(3)}) rotate(${(-2 + (1 - tp) * -14).toFixed(2)}deg)`);
        }
      });
    },
  };
}

/** 幕 14 未读版图：行滑入 + 总待读大数压右上角（滚数 + 指针视差）+ 右进运镜 */
function perfC14(scn: Element, _d: PressData): Perf {
  const rows = qa(scn, '[data-r="row"]');
  const ghost = q(scn, '[data-r="ghost"]');
  const gN = Math.round(Number((ghost as HTMLElement | null)?.textContent || 0));
  const inn = q(scn, '.bz-rp-in');
  const dur = 5;
  return {
    dur,
    update({ t, px, py }: PerfCtx): void {
      dolly(inn, t, (r) => `translateX(${(r * 2.2).toFixed(2)}%)`, .95);
      rows.forEach((row, i) => {
        const p = easeOut(at(t, .5, .3 + i * .24));
        S(row, `opacity:${p.toFixed(3)};transform:translateX(${((1 - p) * 30).toFixed(1)}px)`);
        const bar = q(row, '[data-r="bar"]');
        if (bar) S(bar, `transform:scaleX(${easeInOut(at(t, .9, .55 + i * .24)).toFixed(4)})`);
        const cnt = q(row, '[data-r="cnt"]');
        if (cnt) T(cnt, `${roll(Number((cnt as HTMLElement).dataset.n || 0), easeOutExpo(at(t, .9, .6 + i * .24)))} 篇`);
      });
      // 总待读大数：back 落角 + 滚数（滚完同值记忆挡住重复写）+ 指针视差
      if (ghost) {
        const p = easeBack(at(t, .9, 1.6));
        S(ghost, `opacity:${clamp01(p * 1.4).toFixed(3)};transform:translate(${(px * 7).toFixed(1)}px, ${(py * 5).toFixed(1)}px) rotate(${(-3 + (1 - p) * -5).toFixed(2)}deg) scale(${(1 + (1 - p) * .3).toFixed(3)})`);
        T(ghost, comma(roll(gN, easeOutExpo(at(t, 1.2, 1.7)))));
      }
    },
  };
}

/** 幕 15 总账：三数视差（三格三种深度）+ 基线错落 + 扫光 + 缓推运镜 + 标题反向微移 */
function perfC15(scn: Element, _d: PressData): Perf {
  const cv = q(scn, '[data-cv="c15"]') as HTMLCanvasElement | null;
  const cells = qa(scn, '[data-r="tcell"]');
  const nums = qa(scn, '[data-r="tnum"]');
  const avgrow = q(scn, '[data-r="avgrow"]');
  const avglead = q(scn, '[data-r="avglead"]');
  const avgv = q(scn, '[data-r="avgv"]');
  const h2 = q(scn, '.bz-rp-h');
  const inn = q(scn, '.bz-rp-in');
  const depths = [.5, 1.2, .8]; // 中格最深、左右浅：总账的进深层次
  const dur = 5.6;
  return {
    dur,
    update({ t, pal, px, py }: PerfCtx): void {
      // 运镜：缓推近（凑近看总账）
      dolly(inn, t, (r) => `scale(${(1 + r * .035).toFixed(4)})`, 1.5, .1);
      if (h2) S(h2, `transform:translateX(${(px * -5).toFixed(1)}px)`); // 标题反向微移（反差视差）
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          // 斜向扫光（一道宽墨影随 t 走一遍，衬托「总账翻页」）
          const p = easeInOut(at(t, 2.4, .2));
          if (p > 0 && p < 1) {
            const x = lerp(-w * .3, w * 1.1, p);
            const g = ctx.createLinearGradient(x - 120, 0, x + 120, h);
            g.addColorStop(0, rgba(pal.ink, 0));
            g.addColorStop(.5, rgba(pal.ink, .035));
            g.addColorStop(1, rgba(pal.ink, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
      cells.forEach((c, i) => {
        const el = nums[i] ?? null;
        const n = Number((((el as HTMLElement | null))?.dataset.n) || 0);
        const p = easeOutExpo(at(t, 1.3, .4 + i * .28));
        T(el, comma(roll(n, p)));
        const depth = depths[i] ?? 1;
        const dip = i === 1 ? 12 : 0; // 中格基线下沉（报头错落，常量项不归零）
        S(c, `opacity:${clamp01(p * 1.6).toFixed(3)};transform:translate(${(px * depth * 9).toFixed(1)}px, ${(py * depth * 6 + (1 - p) * 18).toFixed(1)}px) translateY(${dip}px)`);
      });
      if (avgrow) S(avgrow, `opacity:${at(t, .7, 2.4).toFixed(3)}`);
      if (avglead) S(avglead, `transform:scaleX(${easeOut(at(t, .9, 2.6)).toFixed(4)})`);
      if (avgv) S(avgv, `opacity:${at(t, .5, 2.9).toFixed(3)}`);
    },
  };
}

/** 幕 16 落款：墨滴礼花两响（拖尾 + 避指针）+ 纸屑自天而降 + 尾章落纸 + 逐字起 */
function perfC16(scn: Element, d: PressData): Perf {
  const cv = q(scn, '[data-cv="c16"]') as HTMLCanvasElement | null;
  const chars = qa(scn, '[data-r="end"] span');
  const seal = q(scn, '[data-r="seal"]');
  const inn = q(scn, '.bz-rp-in');
  // 纸屑量随全史会话数派生（上限 60 片）
  const nConf = Math.min(60, 14 + Math.round(d.sessions / 3));
  const rand = rng(66);
  const flakes = Array.from({ length: nConf }, () => ({
    x: rand(), y0: -.05 - rand() * .2, sp: .1 + rand() * .12,
    sz: 2.6 + rand() * 3.4, rot: rand() * Math.PI * 2, vr: (rand() - .5) * 5, sw: rand() * Math.PI * 2,
  }));
  const dur = 5.2;
  return {
    dur,
    update({ t, pal, cx, cy, pin }: PerfCtx): void {
      // 运镜：整版从极轻的缩放里浮现
      dolly(inn, t, (r) => `scale(${(1 - r * .015).toFixed(4)})`, 1.2);
      if (cv) {
        const f = fit(cv);
        if (f) {
          const { ctx, w, h } = f;
          ctx.clearRect(0, 0, w, h);
          const rect = pin ? cv.getBoundingClientRect() : null;
          const lx = rect ? cx - rect.left : -9999;
          const ly = rect ? cy - rect.top : -9999;
          // 墨滴礼花两响（避指针）
          const bursts: Array<{ x: number; y: number; t0: number; seed: number }> = [
            { x: w * .38, y: h * .42, t0: .5, seed: 7 },
            { x: w * .62, y: h * .4, t0: 1, seed: 91 },
          ];
          for (const b of bursts) {
            const rand2 = rng(b.seed);
            for (let i = 0; i < 26; i++) {
              const ang = (i / 26) * Math.PI * 2 + rand2() * .5;
              const sp = 60 + rand2() * 130;
              const p = at(t, 1.5, b.t0);
              if (p <= 0 || p >= 1) continue;
              let x = b.x + Math.cos(ang) * sp * easeOut(p);
              let y = b.y + Math.sin(ang) * sp * easeOut(p) + 130 * p * p;
              const off = repel(lx, ly, pin, x, y, 90, 40);
              x += off.dx; y += off.dy;
              const a = Math.sin(Math.PI * p) * .6;
              ctx.beginPath();
              ctx.fillStyle = rgba(i % 7 === 0 ? pal.accent : pal.ink, a);
              ctx.arc(x, y, 1 + rand2() * 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // 纸屑自天而降（矩形纸片摇摆飘落，纯 t 函数）
          for (const fk of flakes) {
            const p = at(t, 3.4, .4 + fk.sp * 2);
            if (p <= 0 || p >= 1) continue;
            const fx = fk.x * w + Math.sin(fk.sw + t * 2) * 16;
            const fy = (fk.y0 + p * 1.1) * h;
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(fk.rot + t * fk.vr);
            ctx.fillStyle = rgba(pal.muted, Math.sin(Math.PI * p) * .5);
            ctx.fillRect(-fk.sz / 2, -fk.sz / 4, fk.sz, fk.sz / 2);
            ctx.restore();
          }
        }
      }
      chars.forEach((c, i) => {
        const p = easeBack(at(t, .6, .4 + i * .22));
        S(c, `opacity:${clamp01(p).toFixed(3)};transform:translateY(${((1 - p) * 26).toFixed(1)}px) rotate(${((1 - p) * 4).toFixed(2)}deg)`);
      });
      // 尾章：back 落纸 + 微旋（落定即静）
      const sp = easeBack(at(t, .6, 1.9));
      S(seal, `opacity:${clamp01(sp * 2).toFixed(3)};transform:scale(${(1 + (1 - sp) * 1.5).toFixed(3)}) rotate(${(-8 + (1 - sp) * -12).toFixed(2)}deg)`);
    },
  };
}

/** 装配十六幕表演（id → Perf）；引擎逐帧调 update，翻走时推 t=dur 收终态 */
export function buildPressPerfs(film: HTMLElement, data: PressData): Map<string, Perf> {
  const m = new Map<string, Perf>();
  const bind = (id: string, fn: (scn: Element, d: PressData) => Perf): void => {
    const scn = film.querySelector(`[data-id="${id}"]`);
    if (scn) m.set(id, fn(scn, data));
  };
  bind('c01', perfC01);
  bind('c02', perfC02);
  bind('c03', perfC03);
  bind('c04', perfC04);
  bind('c05', perfC05);
  bind('c06', perfC06);
  bind('c07', perfC07);
  bind('c08', perfC08);
  bind('c09', perfC09);
  bind('c10', perfC10);
  bind('c11', perfC11);
  bind('c12', perfC12);
  bind('c13', perfC13);
  bind('c14', perfC14);
  bind('c15', perfC15);
  bind('c16', perfC16);
  return m;
}
