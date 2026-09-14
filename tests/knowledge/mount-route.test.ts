// @vitest-environment node
/**
 * 连线路由测试（src/knowledge/mount-route.ts + mount-geom.ts，issues 316 画布一·连线侧）：
 * 端口分配 / 就近出盒 / 18px 栅格 A* / 拉直 / 平滑 五段口径，外加确定性、穿卡 0 条、
 * 端点正确、出口贴近、两种降级直线、A* 无解兜底。boxes 全部自造（不依赖布局模块与 DOM）。
 */
import { describe, expect, it } from 'vitest';
import { ROUTE_PARAMS, routeEdges } from '../../src/knowledge/mount-route';
import { cubicHit, polylineHits, rectOf, segRectHit } from '../../src/knowledge/mount-geom';
import type { Rect } from '../../src/knowledge/mount-geom';
import type {
  LayoutPoint,
  MountSide,
  RouteBox,
  RouteEdgeInput,
  RoutedEdge,
} from '../../src/knowledge/mount-types';

/* ================= 测试自备 helper：d 解析 + 独立判交（不引用实现，避免自证） ================= */

interface LSeg {
  kind: 'L';
  p: LayoutPoint;
  q: LayoutPoint;
}
interface CSeg {
  kind: 'C';
  p: LayoutPoint;
  c1: LayoutPoint;
  c2: LayoutPoint;
  q: LayoutPoint;
}
type Seg = LSeg | CSeg;

/** 解析路由产出的 SVG 串（M/L/C，空格分隔）；遇到不认识的命令直接抛，防口径漂移 */
function parseD(d: string): Seg[] {
  // 产出格式同原型：命令字母与首个数粘连（"M100.0 80.0"）→ 先给字母两侧补空格再切
  const tk = d
    .replace(/([MLC])/g, ' $1 ')
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0);
  expect(tk.length).toBeGreaterThan(0);
  expect(tk[0]).toBe('M');
  const segs: Seg[] = [];
  let cur: LayoutPoint = { x: 0, y: 0 };
  let i = 0;
  const num = (): number => {
    const v = Number(tk[i++]);
    expect(Number.isFinite(v)).toBe(true);
    return v;
  };
  const point = (): LayoutPoint => ({ x: num(), y: num() });
  while (i < tk.length) {
    const cmd = tk[i++];
    if (cmd === 'M') cur = point();
    else if (cmd === 'L') {
      const q = point();
      segs.push({ kind: 'L', p: cur, q });
      cur = q;
    } else if (cmd === 'C') {
      const c1 = point();
      const c2 = point();
      const q = point();
      segs.push({ kind: 'C', p: cur, c1, c2, q });
      cur = q;
    } else throw new Error('未知 SVG 命令：' + cmd);
  }
  return segs;
}

/** 独立实现（不用 src 的 segRectHit）：线段是否穿过矩形内部；端点贴边 / 只擦边不算 */
function segPenetrates(p: LayoutPoint, q: LayoutPoint, r: Rect): boolean {
  const SH = 0.05;
  const xmin = r.left + SH;
  const xmax = r.right - SH;
  const ymin = r.top + SH;
  const ymax = r.bottom - SH;
  if (xmax < xmin || ymax < ymin) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const pv = [-dx, dx, -dy, dy];
  const qv = [p.x - xmin, xmax - p.x, p.y - ymin, ymax - p.y];
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
  return t0 <= t1;
}

/** 曲线按 ~2px 步长采样，任一样本严格落在矩形内即算穿卡 */
function cubicPenetrates(s: CSeg, r: Rect): boolean {
  const L =
    Math.hypot(s.c1.x - s.p.x, s.c1.y - s.p.y) +
    Math.hypot(s.c2.x - s.c1.x, s.c2.y - s.c1.y) +
    Math.hypot(s.q.x - s.c2.x, s.q.y - s.c2.y);
  const n = Math.max(8, Math.ceil(L / 2));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    const x = a * s.p.x + b * s.c1.x + c * s.c2.x + d * s.q.x;
    const y = a * s.p.y + b * s.c1.y + c * s.c2.y + d * s.q.y;
    if (x > r.left && x < r.right && y > r.top && y < r.bottom) return true;
  }
  return false;
}

function inRect(p: LayoutPoint, r: Rect): boolean {
  return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
}

/**
 * 一条路由的穿卡清单。
 * 唯一例外：第 0 段（锚点 → 出盒点）按设计落在**源卡**内——锚点圆点在卡里，
 * 「一眼看出从哪句话扯出来」就是这个代价（原型 HANDOFF §3.2 明确保留）；其余所有段、
 * 所有卡（含源卡与目标卡）一律不豁免。
 */
function penetrations(edge: RouteEdgeInput, routed: RoutedEdge, boxes: RouteBox[]): string[] {
  const bad: string[] = [];
  const segs = parseD(routed.d);
  segs.forEach((s, si) => {
    for (const b of boxes) {
      if (si === 0 && b.id === edge.from) continue;
      const r = rectOf(b);
      const hit = s.kind === 'L' ? segPenetrates(s.p, s.q, r) : cubicPenetrates(s, r);
      if (hit) bad.push(`${edge.from}→${edge.to} 段${si}(${s.kind}) 进入 ${b.id}`);
    }
  });
  return bad;
}

function mkBox(id: string, x: number, y: number, w: number, h: number): RouteBox {
  return { id, x, y, w, h };
}

const boxMap = (boxes: RouteBox[]): Map<string, RouteBox> => {
  const m = new Map<string, RouteBox>();
  for (const b of boxes) m.set(b.id, b);
  return m;
};

/* ================= 拥挤样例：16 卡 / 24 边（互指 + 跨代长线 + 窄缝 + 相邻缝隙） ================= */

const SAMPLE_BOXES: RouteBox[] = [
  mkBox('n01', 0, 0, 300, 200),
  mkBox('n02', 420, 0, 240, 150),
  mkBox('n03', 800, 20, 260, 180),
  mkBox('n04', 0, 320, 240, 160),
  mkBox('n05', 360, 300, 300, 140),
  mkBox('n06', 800, 330, 220, 200),
  mkBox('n07', 120, 620, 280, 170),
  mkBox('n08', 520, 600, 200, 220),
  mkBox('n09', 840, 660, 240, 160), // 右侧与 n15（左沿 1120）只留 40px 窄缝
  mkBox('n10', 0, 940, 320, 190),
  mkBox('n11', 440, 960, 240, 150),
  mkBox('n12', 760, 950, 180, 190), // 与 n11 相邻缝 80px
  mkBox('n13', 1120, 0, 240, 300),
  mkBox('n14', 1140, 420, 220, 180),
  mkBox('n15', 1120, 720, 260, 220),
  mkBox('n16', 1100, 1000, 300, 140),
];

/** 锚点全部落在源卡内圈（离四边 ≥PORT_PAD）——出盒点不需要端角钳制，出口距离可精确断言 */
const SAMPLE_EDGES: RouteEdgeInput[] = [
  { from: 'n01', to: 'n02', anchor: { x: 100, y: 80 } },
  { from: 'n02', to: 'n01', anchor: { x: 520, y: 70 } }, // 互指
  { from: 'n01', to: 'n05', anchor: { x: 60, y: 40 } },
  { from: 'n01', to: 'n09', anchor: { x: 250, y: 170 } }, // 跨代长线
  { from: 'n02', to: 'n06', anchor: { x: 470, y: 120 } },
  { from: 'n03', to: 'n13', anchor: { x: 900, y: 100 } },
  { from: 'n03', to: 'n05', anchor: { x: 820, y: 60 } },
  { from: 'n04', to: 'n07', anchor: { x: 120, y: 400 } },
  { from: 'n04', to: 'n10', anchor: { x: 200, y: 460 } },
  { from: 'n05', to: 'n08', anchor: { x: 500, y: 380 } },
  { from: 'n05', to: 'n07', anchor: { x: 380, y: 340 } },
  { from: 'n06', to: 'n09', anchor: { x: 900, y: 420 } },
  { from: 'n06', to: 'n14', anchor: { x: 990, y: 380 } },
  { from: 'n07', to: 'n08', anchor: { x: 300, y: 700 } },
  { from: 'n07', to: 'n11', anchor: { x: 220, y: 760 } },
  { from: 'n08', to: 'n12', anchor: { x: 600, y: 780 } }, // 目标贴着 n15 的 10px 窄缝
  { from: 'n11', to: 'n12', anchor: { x: 560, y: 1030 } }, // 80px 水平缝穿行
  { from: 'n12', to: 'n16', anchor: { x: 800, y: 1030 } },
  { from: 'n13', to: 'n14', anchor: { x: 1200, y: 260 } },
  { from: 'n14', to: 'n15', anchor: { x: 1250, y: 500 } },
  { from: 'n15', to: 'n16', anchor: { x: 1200, y: 800 } },
  { from: 'n09', to: 'n15', anchor: { x: 950, y: 740 } },
  { from: 'n16', to: 'n03', anchor: { x: 1150, y: 1050 } }, // 跨全图回指
  { from: 'n10', to: 'n04' }, // 无锚点 → 兜底 {left, top+26}
];

const SAMPLE_ROUTED = routeEdges(SAMPLE_BOXES, SAMPLE_EDGES);

/* ============================ 几何原语 ============================ */

describe('mount-geom 原语', () => {
  const r: Rect = { left: 0, top: 0, right: 100, bottom: 50 };

  it('rectOf：左上角 + 宽高 → 矩形', () => {
    expect(rectOf({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ left: 10, top: 20, right: 40, bottom: 60 });
  });

  it('segRectHit：穿过 / 全在内部 = 命中；整段在外 / 端点贴边 = 不命中；margin 外扩生效', () => {
    expect(segRectHit({ x: -20, y: 25 }, { x: 120, y: 25 }, r)).toBe(true);
    expect(segRectHit({ x: 30, y: 20 }, { x: 40, y: 30 }, r)).toBe(true); // 整段在内部
    expect(segRectHit({ x: -20, y: 80 }, { x: 120, y: 80 }, r)).toBe(false);
    expect(segRectHit({ x: -12, y: 25 }, { x: 0, y: 25 }, r)).toBe(false); // 端点落在卡边 = 入卡桩口径
    expect(segRectHit({ x: -20, y: 25 }, { x: -1, y: 25 }, r)).toBe(false);
    expect(segRectHit({ x: -20, y: 25 }, { x: -1, y: 25 }, r, 5)).toBe(true); // 外扩 5px 后命中
    expect(segRectHit({ x: 50, y: 25 }, { x: 50, y: 25 }, r)).toBe(true); // 退化为点包含
    expect(segRectHit({ x: 150, y: 25 }, { x: 150, y: 25 }, r)).toBe(false);
  });

  it('cubicHit：压卡曲线命中、绕卡曲线不命中；margin 外扩生效', () => {
    const P = { x: -40, y: 25 };
    const Q = { x: 140, y: 25 };
    const straight = cubicHit(r, P, { x: 20, y: 25 }, { x: 80, y: 25 }, Q);
    expect(straight).toBe(true);
    const over: Rect = { left: 0, top: 0, right: 100, bottom: 50 };
    expect(cubicHit(over, { x: -40, y: -60 }, { x: 20, y: -60 }, { x: 80, y: -60 }, { x: 140, y: -60 })).toBe(false);
    expect(
      cubicHit(over, { x: -40, y: -2 }, { x: 20, y: -2 }, { x: 80, y: -2 }, { x: 140, y: -2 }, 5),
    ).toBe(true); // 曲线在卡上方 2px：外扩 5px 后命中
  });

  it('polylineHits：任一折线段压卡即命中；折线干净 / 空输入不命中', () => {
    const rects = [r, { left: 200, top: 200, right: 300, bottom: 300 }];
    expect(polylineHits([{ x: -20, y: 25 }, { x: 120, y: 25 }], rects)).toBe(true);
    expect(polylineHits([{ x: -20, y: -20 }, { x: 120, y: -20 }], rects)).toBe(false);
    expect(polylineHits([{ x: 250, y: 250 }], rects)).toBe(true); // 单点折线 = 点包含判定
    expect(polylineHits([], rects)).toBe(false);
    expect(polylineHits([{ x: -20, y: 25 }, { x: 120, y: 25 }], rects, 0)).toBe(true);
  });

  it('ROUTE_PARAMS 暴露栅格与端口常量（渲染层共用）', () => {
    expect(ROUTE_PARAMS).toEqual({
      CS: 18,
      INF: 8,
      STUB: 12,
      PORT_PAD: 18,
      PORT_MIN: 14,
      ASTAR_MAX_NODES: 120,
    });
  });
});

/* ============================ 端口分配（入口） ============================ */

describe('routeEdges 入卡端口', () => {
  const target = mkBox('t', 600, 0, 240, 400);
  const srcA = mkBox('sa', 0, 0, 200, 120);
  const srcB = mkBox('sb', 0, 140, 200, 120);
  const srcC = mkBox('sc', 0, 280, 200, 120);

  it('同目标同边的多条边：都走 L 边、按源盒坐标排序、间距 ≥PORT_MIN 且落在 [top+18, bottom-18] 内', () => {
    const boxes = [target, srcA, srcB, srcC];
    const inputs = [
      { from: 'sc', to: 't', anchor: { x: 100, y: 340 } },
      { from: 'sa', to: 't', anchor: { x: 100, y: 60 } },
      { from: 'sb', to: 't', anchor: { x: 100, y: 200 } },
    ];
    const routed = routeEdges(boxes, inputs);
    expect(routed.map((r) => r.entry)).toEqual(['L', 'L', 'L']);
    expect(routed.map((r) => r.exit)).toEqual(['T', 'T', 'T']); // 锚点在 120 高卡的中心 → 上/下边最近
    const portOf = new Map<string, number>();
    routed.forEach((r, i) => {
      const segs = parseD(r.d);
      const T = segs[segs.length - 1].q;
      expect(Math.abs(T.x - 600)).toBeLessThan(0.06); // entry = L → 入卡点都在 x=600
      expect(T.y).toBeGreaterThanOrEqual(18 - 0.06);
      expect(T.y).toBeLessThanOrEqual(382 + 0.06);
      portOf.set(inputs[i].from, T.y);
    });
    const sa = portOf.get('sa') as number;
    const sb = portOf.get('sb') as number;
    const sc = portOf.get('sc') as number;
    // 源盒中心 cy = 60 / 200 / 340 → 端口按此顺序递增（无并列，不需要 id 兜底）
    expect(sa).toBeLessThan(sb);
    expect(sb).toBeLessThan(sc);
    expect(sb - sa).toBeGreaterThanOrEqual(14 - 0.12);
    expect(sc - sb).toBeGreaterThanOrEqual(14 - 0.12);
    // 入卡桩在卡外：终点前一点距入卡点 = STUB，方向背离卡内
    routed.forEach((r) => {
      const segs = parseD(r.d);
      const T = segs[segs.length - 1].q;
      const T1 = segs[segs.length - 2].q;
      const tRect = rectOf(target);
      expect(inRect(T1, tRect)).toBe(false);
      expect(Math.hypot(T1.x - T.x, T1.y - T.y)).toBeCloseTo(ROUTE_PARAMS.STUB, 1);
      expect(T1.x).toBeLessThan(T.x); // 入口在 L 边 → 桩在卡的更左侧
    });
  });

  it('端口并列（源盒中心同坐标）按 from id 兜底排序：与入参顺序无关', () => {
    const boxes = [
      mkBox('t', 800, 0, 200, 300),
      mkBox('aa', 0, 0, 200, 200), // 中心 cy = 100
      mkBox('zz', 300, 0, 200, 200), // 中心 cy = 100（与 aa 并列）
    ];
    const eAa: RouteEdgeInput = { from: 'aa', to: 't', anchor: { x: 100, y: 100 } };
    const eZz: RouteEdgeInput = { from: 'zz', to: 't', anchor: { x: 400, y: 100 } };
    const forward = routeEdges(boxes, [eAa, eZz]);
    const reversed = routeEdges(boxes, [eZz, eAa]);
    const portOf = (r: RoutedEdge): number => {
      const segs = parseD(r.d);
      return segs[segs.length - 1].q.y;
    };
    const fAa = forward[0];
    const fZz = forward[1];
    const rZz = reversed[0];
    const rAa = reversed[1];
    expect(portOf(fAa)).toBeLessThan(portOf(fZz)); // id 小的排前 → 端口小
    expect(portOf(rAa)).toBe(portOf(fAa)); // 换入参顺序结果不变
    expect(portOf(rZz)).toBe(portOf(fZz));
    expect(rAa.d).toBe(fAa.d);
    expect(rZz.d).toBe(fZz.d);
  });

  it('入卡法向指向卡内：四种 entry 边的入卡桩都在卡外', () => {
    const boxes = [
      mkBox('c', 600, 600, 200, 200),
      mkBox('w', 0, 600, 200, 200), // 西
      mkBox('e', 1200, 600, 200, 200), // 东
      mkBox('n', 600, 0, 200, 200), // 北
      mkBox('s', 600, 1200, 200, 200), // 南
    ];
    const routed = routeEdges(boxes, [
      { from: 'w', to: 'c', anchor: { x: 100, y: 700 } },
      { from: 'e', to: 'c', anchor: { x: 1300, y: 700 } },
      { from: 'n', to: 'c', anchor: { x: 700, y: 100 } },
      { from: 's', to: 'c', anchor: { x: 700, y: 1300 } },
    ]);
    expect(routed.map((r) => r.entry)).toEqual(['L', 'R', 'T', 'B']);
    const cRect = rectOf(boxes[0]);
    routed.forEach((r) => {
      const segs = parseD(r.d);
      const T = segs[segs.length - 1].q;
      const T1 = segs[segs.length - 2].q;
      expect(inRect(T1, cRect)).toBe(false);
    });
  });
});

/* ============================ 确定性 + 穿卡 0 条 ============================ */

describe('routeEdges 拥挤样例（16 卡 24 边）', () => {
  it('确定性：同一输入两次 → 每条边逐字段（含 d 串）完全相同', () => {
    const again = routeEdges(SAMPLE_BOXES, SAMPLE_EDGES);
    expect(again.length).toBe(SAMPLE_ROUTED.length);
    again.forEach((r, i) => expect(r).toEqual(SAMPLE_ROUTED[i]));
    expect(JSON.stringify(again)).toBe(JSON.stringify(SAMPLE_ROUTED));
  });

  it('样例全部走 A*（无降级）——降级直线可能合法穿卡，不参与穿卡断言', () => {
    const fb = SAMPLE_ROUTED.filter((r) => r.fallback).map((r) => `${r.from}→${r.to}`);
    expect(fb).toEqual([]);
  });

  it('穿卡 0 条：L 段精确判交 + C 段 ~2px 采样，源卡/目标卡同样不豁免', () => {
    expect(SAMPLE_EDGES.length).toBeGreaterThanOrEqual(20);
    expect(SAMPLE_BOXES.length).toBeGreaterThanOrEqual(15);
    const bad: string[] = [];
    SAMPLE_EDGES.forEach((e, i) => bad.push(...penetrations(e, SAMPLE_ROUTED[i], SAMPLE_BOXES)));
    expect(bad).toEqual([]);
    // 断言不是空转：样例里绝大多数边画了曲线、且有一批边绕了远路（>4 段 = A* 真的在绕卡）
    const withCurve = SAMPLE_ROUTED.filter((r) => r.d.includes(' C')).length;
    const detoured = SAMPLE_ROUTED.filter((r) => parseD(r.d).length > 4).length;
    const totalSegs = SAMPLE_ROUTED.reduce((a, r) => a + parseD(r.d).length, 0);
    expect(withCurve).toBeGreaterThanOrEqual(15);
    expect(detoured).toBeGreaterThanOrEqual(10);
    expect(totalSegs).toBeGreaterThanOrEqual(100);
  });

  it('对照：同一输入只降级直线时确实压卡 → 证明上面的穿卡判据不是空转', () => {
    const boxes = [mkBox('s', 0, 0, 120, 120), mkBox('mid', 300, -40, 160, 200), mkBox('t', 700, 0, 120, 120)];
    const edges: RouteEdgeInput[] = [{ from: 's', to: 't', anchor: { x: 60, y: 60 } }];
    const straight = routeEdges(boxes, edges, { strategy: 'straight' })[0];
    expect(straight.fallback).toBe(true);
    expect(penetrations(edges[0], straight, boxes).length).toBeGreaterThan(0); // 直线穿 mid
    const astar = routeEdges(boxes, edges)[0];
    expect(astar.fallback).toBe(false);
    expect(penetrations(edges[0], astar, boxes)).toEqual([]); // 绕开 mid
  });

  it('端点正确：起点 = 锚点（或兜底 {left, top+26}）、终点落在 entry 边上', () => {
    const map = boxMap(SAMPLE_BOXES);
    SAMPLE_ROUTED.forEach((r, i) => {
      const e = SAMPLE_EDGES[i];
      const src = map.get(e.from) as RouteBox;
      const dst = map.get(e.to) as RouteBox;
      const segs = parseD(r.d);
      const S = segs.length > 0 ? segs[0].p : { x: NaN, y: NaN };
      const expectS = e.anchor ?? { x: src.x, y: src.y + 26 };
      expect(Math.abs(S.x - expectS.x)).toBeLessThan(0.06);
      expect(Math.abs(S.y - expectS.y)).toBeLessThan(0.06);
      const T = segs[segs.length - 1].q;
      const side: MountSide = r.entry;
      const eps = 0.06;
      if (side === 'L') {
        expect(Math.abs(T.x - dst.x)).toBeLessThan(eps);
        expect(T.y).toBeGreaterThanOrEqual(dst.y - eps);
        expect(T.y).toBeLessThanOrEqual(dst.y + dst.h + eps);
      } else if (side === 'R') {
        expect(Math.abs(T.x - (dst.x + dst.w))).toBeLessThan(eps);
        expect(T.y).toBeGreaterThanOrEqual(dst.y - eps);
        expect(T.y).toBeLessThanOrEqual(dst.y + dst.h + eps);
      } else if (side === 'T') {
        expect(Math.abs(T.y - dst.y)).toBeLessThan(eps);
        expect(T.x).toBeGreaterThanOrEqual(dst.x - eps);
        expect(T.x).toBeLessThanOrEqual(dst.x + dst.w + eps);
      } else {
        expect(Math.abs(T.y - (dst.y + dst.h))).toBeLessThan(eps);
        expect(T.x).toBeGreaterThanOrEqual(dst.x - eps);
        expect(T.x).toBeLessThanOrEqual(dst.x + dst.w + eps);
      }
    });
  });

  it('出口贴近：锚点到出盒点 ≤「该点到四条边最近距离 + 0.2」（锚点在内圈 → 无端角钳制）', () => {
    const map = boxMap(SAMPLE_BOXES);
    SAMPLE_ROUTED.forEach((r, i) => {
      const e = SAMPLE_EDGES[i];
      const src = map.get(e.from) as RouteBox;
      const S = e.anchor ?? { x: src.x, y: src.y + 26 };
      const E = parseD(r.d)[0].q; // 段 0 = 锚点 → 出盒点
      const m = Math.min(S.x - src.x, src.x + src.w - S.x, S.y - src.y, src.y + src.h - S.y);
      expect(Math.hypot(E.x - S.x, E.y - S.y)).toBeLessThanOrEqual(m + 0.2);
    });
  });
});

/* ============================ 降级与兜底 ============================ */

describe('routeEdges 降级', () => {
  it("strategy:'straight' → 全部 fallback 且 d 只有直线（无 C）", () => {
    const routed = routeEdges(SAMPLE_BOXES, SAMPLE_EDGES, { strategy: 'straight' });
    expect(routed.length).toBe(SAMPLE_EDGES.length);
    routed.forEach((r) => {
      expect(r.fallback).toBe(true);
      expect(r.d.includes(' C')).toBe(false);
      expect(parseD(r.d).length).toBeGreaterThan(0);
    });
    // 终点仍是入卡点、起点仍是锚点
    const segs = parseD(routed[0].d);
    const e0 = SAMPLE_EDGES[0];
    expect(Math.abs(segs[0].p.x - (e0.anchor as LayoutPoint).x)).toBeLessThan(0.06);
  });

  it('盒数超 ASTAR_MAX_NODES（121 > 120）→ 全部 fallback 且 d 可解析', () => {
    const boxes: RouteBox[] = [];
    for (let i = 0; i < 121; i++) boxes.push(mkBox('b' + i, (i % 11) * 120, Math.floor(i / 11) * 120, 80, 80));
    const routed = routeEdges(boxes, [{ from: 'b0', to: 'b120', anchor: { x: 40, y: 40 } }]);
    expect(routed[0].fallback).toBe(true);
    expect(parseD(routed[0].d).length).toBeGreaterThan(0);
    // 边界值：正好 120 盒（＝阈值）仍走 A*
    const at120: RouteBox[] = [];
    for (let i = 0; i < 120; i++) at120.push(mkBox('c' + i, (i % 12) * 120, Math.floor(i / 12) * 120, 80, 80));
    const boundary = routeEdges(at120, [{ from: 'c0', to: 'c119', anchor: { x: 40, y: 40 } }]);
    expect(boundary[0].fallback).toBe(false);
    // 简单两卡：A* 正常可用（对照，证明上面的 fallback 来自阈值而非无解）
    const small = routeEdges(
      [mkBox('a', 0, 0, 200, 200), mkBox('b', 600, 0, 200, 200)],
      [{ from: 'a', to: 'b', anchor: { x: 100, y: 100 } }],
    );
    expect(small[0].fallback).toBe(false);
  });

  it('A* 无解（目标被四张卡围死）→ fallback=true、d 可解析、不抛异常', () => {
    const boxes: RouteBox[] = [
      mkBox('target', 0, 0, 200, 200),
      mkBox('up', -60, -260, 320, 248), // 下沿 -12：与目标留 12px 缝，A* 外扩 8px 后封死
      mkBox('down', -60, 212, 320, 248), // 上沿 212
      mkBox('left', -260, -260, 248, 720), // 右沿 -12
      mkBox('right', 224, -260, 236, 720), // 左沿 224
      mkBox('src', 700, 0, 200, 200),
    ];
    const routed = routeEdges(boxes, [{ from: 'src', to: 'target', anchor: { x: 800, y: 100 } }]);
    expect(routed.length).toBe(1);
    expect(routed[0].fallback).toBe(true);
    expect(routed[0].entry).toBe('R');
    const segs = parseD(routed[0].d);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[segs.length - 1].q.x).toBeCloseTo(200, 1); // 终点仍是目标卡 R 边上的入卡点
  });

  it('端点缺盒：不抛异常，返回 fallback 产物且顺序与入参一一对应', () => {
    const routed = routeEdges([mkBox('a', 0, 0, 100, 100)], [
      { from: 'a', to: '不存在', anchor: { x: 50, y: 50 } },
      { from: '也不存在', to: 'a' },
    ]);
    expect(routed.length).toBe(2);
    expect(routed[0].fallback).toBe(true);
    expect(routed[1].fallback).toBe(true);
  });
});
