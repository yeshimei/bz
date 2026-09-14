/**
 * 挂载树几何原语（issues 316 画布一·连线侧，ADR-0137 / ADR-0139）。
 *
 * 只放纯几何、零副作用、零依赖（仅 import type 契约）：路由（mount-route）与测试共用。
 * 移植源：`.scratch/mount-canvas/transformer-real.html` 的 segBlocker / cubicHit / cube。
 */
import type { LayoutPoint } from './mount-types';

/** 轴对齐矩形（世界坐标，left/top/right/bottom） */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 布局盒（左上角 + 宽高）→ 矩形 */
export function rectOf(b: { x: number; y: number; w: number; h: number }): Rect {
  return { left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h };
}

/**
 * 精确线段-矩形判交（Liang-Barsky）；`margin` 为额外外扩（正数 = 判定更保守）。
 * 口径照原型：只判「线段穿过矩形内部」，**端点贴边不算**——入卡桩→入卡点那 12px 直线
 * 正好停在卡边，不能因此被判成压卡。
 */
export function segRectHit(p: LayoutPoint, q: LayoutPoint, r: Rect, margin = 0): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const pv = [-dx, dx, -dy, dy];
  const qv = [
    p.x - (r.left - margin),
    r.right + margin - p.x,
    p.y - (r.top - margin),
    r.bottom + margin - p.y,
  ];
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 4; k++) {
    if (pv[k] === 0) {
      if (qv[k] < 0) return false;
    } else {
      const t = qv[k] / pv[k];
      if (pv[k] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t1 > 0 && t0 < 1;
}

/**
 * 三次贝塞尔（P, c1, c2, Q）是否进入矩形。自适应弧长采样：按控制多边形长度取
 * 「约 2px 一个样本」（下限 4、上限 2000 个），只判采样点**严格落在矩形内**；
 * 两端点（i=0 / i=N）不判——端点桩本来就贴在卡边外 12px。
 * `margin` 为额外外扩：平滑闸门给正 margin，逼曲线比折线更早让路。
 */
export function cubicHit(
  r: Rect,
  P: LayoutPoint,
  c1: LayoutPoint,
  c2: LayoutPoint,
  Q: LayoutPoint,
  margin = 0,
): boolean {
  const len =
    Math.hypot(c1.x - P.x, c1.y - P.y) +
    Math.hypot(c2.x - c1.x, c2.y - c1.y) +
    Math.hypot(Q.x - c2.x, Q.y - c2.y);
  const n = Math.max(4, Math.min(2000, Math.ceil(len / 2)));
  const left = r.left - margin;
  const right = r.right + margin;
  const top = r.top - margin;
  const bottom = r.bottom + margin;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    const x = a * P.x + b * c1.x + c * c2.x + d * Q.x;
    const y = a * P.y + b * c1.y + c * c2.y + d * Q.y;
    if (x > left && x < right && y > top && y < bottom) return true;
  }
  return false;
}

/** 折线是否碰到矩形集合（逐段精确判交；空折线 = false，单点折线退化为点包含判定） */
export function polylineHits(pts: LayoutPoint[], rects: Rect[], margin = 0): boolean {
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    for (let i = 0; i < rects.length; i++) {
      if (segRectHit(pts[0], pts[0], rects[i], margin)) return true;
    }
    return false;
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let j = 0; j < rects.length; j++) {
      if (segRectHit(pts[i], pts[i + 1], rects[j], margin)) return true;
    }
  }
  return false;
}
