/**
 * 挂载树连线路由（issues 316 画布一·连线侧，ADR-0137 / ADR-0139）。
 *
 * 口径照原型 `.scratch/mount-canvas/transformer-real.html` 的 `routeEdges()`：
 *   ① 入卡端口：目标卡四边取「离源盒中心最近」的一条；同目标同边多条按源盒坐标排序，
 *      沿该边以 ≥PORT_MIN(14) 错开、两端各留 PORT_PAD(18)；入卡法向 `nIn` **指向卡内**，
 *      入卡桩 `T1 = T - nIn*STUB` 必落在卡外（原型此处曾写反）；
 *   ② 出盒：源锚点对四条边取最近者出盒（**含左缘**——用户定「距离最近优先」，绕卡交给 A*），
 *      出盒点沿外向法向推 STUB(12) 得 E1；
 *   ③ A* 栅格避障：CS=18 栅格、每卡外扩 INF=8 **按格心落墙**（不是「碰到就填」）；
 *      端点开 5×5 口袋 + 沿背离方向凿 ≤6 格短走廊，只解封「格心不在任何真实卡内」的格子、
 *      每个端点用完**立刻还原**；8 邻域、正交 10 / 对角 14、不许剪角；
 *   ④ 拉直：string-pull，精确判交 margin 5px，**不给源卡/目标卡豁免**（豁免会留下穿自己卡的线）；
 *   ⑤ 平滑：逐段三次贝塞尔，切向比例 1 → 0.55 → 0.3 递减，压卡那段保持直线、三档都压卡退回折线。
 * 产物 `d` 起点 = 源锚点、终点 = 入卡点（落在 entry 边上）；A\* 无解 / `strategy:'straight'` /
 * 盒数超 ROUTE_PARAMS.ASTAR_MAX_NODES 时 `fallback=true` 并退化为纯直线。
 * 给定输入 → 输出逐字节相同（端口并列时用 from/to id 兜底排序，不依赖 Map 迭代顺序）。
 */
import { cubicHit, rectOf, segRectHit } from './mount-geom';
import type { Rect } from './mount-geom';
import type {
  LayoutPoint,
  MountSide,
  RouteBox,
  RouteEdgeInput,
  RoutedEdge,
} from './mount-types';

/** 路由选项：`'straight'` = 主动降级直线（渲染层超节点上限 / 视口裁剪时用），不建栅格不避障 */
export interface RouteOptions {
  strategy?: 'astar' | 'straight';
}

/**
 * 栅格与端口常量（渲染层与测试共用）：
 * CS 格边长 / INF 卡外扩 / STUB 端点桩长 / PORT_PAD 端角留白 / PORT_MIN 同边端口最小间距 /
 * ASTAR_MAX_NODES 盒数降级阈值（spec 风险 1 的降级接口）
 */
export const ROUTE_PARAMS: {
  CS: number;
  INF: number;
  STUB: number;
  PORT_PAD: number;
  PORT_MIN: number;
  ASTAR_MAX_NODES: number;
} = { CS: 18, INF: 8, STUB: 12, PORT_PAD: 18, PORT_MIN: 14, ASTAR_MAX_NODES: 120 };

/** 拉直余量：折线离所有卡 ≥5px，给后面平滑留摆动空间 */
const PULL_MARGIN = 5;
/** 平滑余量：曲线离所有卡 ≥2px（比折线松一档，但绝不许进入卡内） */
const SMOOTH_MARGIN = 2;
/** 平滑切向比例三档（原型口径：逐档收紧，三档都压卡就退回折线） */
const TANGENT_SCALES = [1, 0.55, 0.3];
/** 栅格边界外扩格数：容下 ≤6 格端点走廊 + 12px 端点桩，并给 A* 留外圈绕行余地 */
const GRID_MARGIN_CELLS = 8;
/** 栅格安全阀：坐标异常 / 极端散布时宁降级直线也不炸内存 */
const MAX_GRID_CELLS = 2000000;

interface RoutedBox {
  box: RouteBox;
  rect: Rect;
}

interface PortJob {
  idx: number;
  edge: RouteEdgeInput;
  src: RoutedBox;
  dst: RoutedBox;
  entry: MountSide;
  /** 入卡点（tar.get 盒 entry 边上的一个点） */
  T: LayoutPoint;
  /** 入卡法向：指向卡内 */
  nIn: LayoutPoint;
}

/** `{b:[P0,c1,c2,P3]}` = 一段三次贝塞尔，其余元素为直线折点（同原型 pts 结构） */
interface CurveItem {
  b: [LayoutPoint, LayoutPoint, LayoutPoint, LayoutPoint];
}
type PathItem = LayoutPoint | CurveItem;

type AStarFn = (
  a: LayoutPoint,
  b: LayoutPoint,
  dirA: LayoutPoint,
  dirB: LayoutPoint,
) => LayoutPoint[] | null;

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** 入口边：目标卡四边取离源盒中心最近者（候选顺序 L/T/B/R，严小于 → 并列取先者，原型口径） */
function nearestEntrySide(b: Rect, a: Rect): MountSide {
  const ax = (a.left + a.right) / 2;
  const ay = (a.top + a.bottom) / 2;
  const cands: { s: MountSide; x: number; y: number }[] = [
    { s: 'L', x: b.left, y: (b.top + b.bottom) / 2 },
    { s: 'T', x: (b.left + b.right) / 2, y: b.top },
    { s: 'B', x: (b.left + b.right) / 2, y: b.bottom },
    { s: 'R', x: b.right, y: (b.top + b.bottom) / 2 },
  ];
  let best = cands[0];
  let bd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - ax, c.y - ay);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best.s;
}

/**
 * 端口值钳制与错开（原型 spread）：先夹进 [lo,hi]，再从前到后保证 ≥min 间距；
 * 末端越界则整排回推后重新错开一遍。
 */
function spread(vals: number[], lo: number, hi: number, min: number): void {
  if (hi < lo) {
    const mid = (lo + hi) / 2;
    lo = mid;
    hi = mid;
  }
  for (let i = 0; i < vals.length; i++) vals[i] = clamp(vals[i], lo, hi);
  for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] < min) vals[i] = vals[i - 1] + min;
  const over = vals.length > 0 ? vals[vals.length - 1] - hi : 0;
  if (over > 0) {
    for (let i = 0; i < vals.length; i++) vals[i] -= over;
    for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] < min) vals[i] = vals[i - 1] + min;
  }
}

/** 线段是否碰到任一矩形（margin 外扩，不豁免任何卡） */
function segHitsAny(p: LayoutPoint, q: LayoutPoint, rects: Rect[], margin: number): boolean {
  for (let i = 0; i < rects.length; i++) {
    if (segRectHit(p, q, rects[i], margin)) return true;
  }
  return false;
}

/** 曲线是否碰到任一矩形（不豁免任何卡） */
function curveHitsAny(
  P: LayoutPoint,
  c1: LayoutPoint,
  c2: LayoutPoint,
  Q: LayoutPoint,
  rects: Rect[],
  margin: number,
): boolean {
  for (let i = 0; i < rects.length; i++) {
    if (cubicHit(rects[i], P, c1, c2, Q, margin)) return true;
  }
  return false;
}

/** 拉直：能直连就跳过中间点（精确判交 + margin；不给源卡/目标卡豁免，否则会留下穿自己卡的线） */
function pull(pts: LayoutPoint[], rects: Rect[], margin: number): LayoutPoint[] {
  const out: LayoutPoint[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) {
      if (!segHitsAny(pts[i], pts[j], rects, margin)) break;
    }
    out.push(pts[j]);
    i = j;
  }
  return out;
}

function isCurve(it: PathItem): it is CurveItem {
  return (it as CurveItem).b !== undefined;
}

function pt(p: LayoutPoint): string {
  return p.x.toFixed(1) + ' ' + p.y.toFixed(1);
}

/** SVG path 串（原型同款：toFixed(1) + 空格分隔，保证同输入逐字节同结果） */
function pathD(items: PathItem[]): string {
  let d = 'M' + pt(items[0] as LayoutPoint);
  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    if (isCurve(it)) d += ' C' + pt(it.b[1]) + ' ' + pt(it.b[2]) + ' ' + pt(it.b[3]);
    else d += ' L' + pt(it as LayoutPoint);
  }
  return d;
}

/**
 * 建 18px 障碍栅格并返回 A* 求解器；盒数 / 格数超限或坐标异常时返回 null（调用方降级直线）。
 * 栅格整批共享；每次求解只临时解封端点口袋、算完立刻还原——共享栅格越挖越大，后面的边会被放进别的卡里。
 */
function buildAstar(rects: Rect[], cs: number, inf: number): AStarFn | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
    if (r.right > maxX) maxX = r.right;
    if (r.bottom > maxY) maxY = r.bottom;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const margin = GRID_MARGIN_CELLS * cs;
  const ox = minX - margin;
  const oy = minY - margin;
  const gcols = Math.max(4, Math.ceil((maxX + margin - ox) / cs));
  const grows = Math.max(4, Math.ceil((maxY + margin - oy) / cs));
  if (gcols * grows > MAX_GRID_CELLS) return null;

  const blocked = new Uint8Array(gcols * grows);
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < gcols && y < grows;
  /** 格心 x（格索引 → 世界坐标） */
  const cx = (ix: number): number => ox + ix * cs + cs / 2;
  const cy = (iy: number): number => oy + iy * cs + cs / 2;
  const colOf = (px: number): number => Math.floor((px - ox) / cs);
  const rowOf = (py: number): number => Math.floor((py - oy) / cs);

  // 边框封死：不往栅格外跑
  for (let x = 0; x < gcols; x++) {
    blocked[x] = 1;
    blocked[(grows - 1) * gcols + x] = 1;
  }
  for (let y = 0; y < grows; y++) {
    blocked[y * gcols] = 1;
    blocked[y * gcols + gcols - 1] = 1;
  }
  // 按**格心**落墙：只有格心落在 [卡 ± INF] 内才标墙——按「碰到的格子全填」会把膨胀取整放大、卡间缝糊死
  for (const r of rects) {
    const y0 = Math.max(0, Math.floor((r.top - inf - cs / 2 - oy) / cs));
    const y1 = Math.min(grows - 1, Math.ceil((r.bottom + inf - cs / 2 - oy) / cs));
    for (let iy = y0; iy <= y1; iy++) {
      const py = cy(iy);
      if (py < r.top - inf || py > r.bottom + inf) continue;
      const x0 = Math.max(0, Math.floor((r.left - inf - cs / 2 - ox) / cs));
      const x1 = Math.min(gcols - 1, Math.ceil((r.right + inf - cs / 2 - ox) / cs));
      for (let ix = x0; ix <= x1; ix++) {
        const px = cx(ix);
        if (px >= r.left - inf && px <= r.right + inf) blocked[iy * gcols + ix] = 1;
      }
    }
  }

  const scratch: number[] = [];
  /** 格心是否落在任一真实卡内（解封前必查——绝不给自己开穿卡的后门） */
  function cellInCard(ix: number, iy: number): boolean {
    const px = cx(ix);
    const py = cy(iy);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (px > r.left && px < r.right && py > r.top && py < r.bottom) return true;
    }
    return false;
  }
  /** 解封一格（记进 scratch，用完还原）；格心在真卡内 / 越界则拒绝 */
  function free(idx: number, ix: number, iy: number): void {
    if (!inBounds(ix, iy)) return;
    if (cellInCard(ix, iy)) return;
    if (blocked[idx]) {
      blocked[idx] = 0;
      scratch.push(idx);
    }
  }
  /** 端点口袋：5×5 邻域 + 沿背离方向凿 ≤6 格短走廊（接上自由空间即停） */
  function openCell(p: LayoutPoint, dir: LayoutPoint): void {
    const cxi = clamp(colOf(p.x), 0, gcols - 1);
    const cyi = clamp(rowOf(p.y), 0, grows - 1);
    for (let y = cyi - 2; y <= cyi + 2; y++) {
      for (let x = cxi - 2; x <= cxi + 2; x++) free(y * gcols + x, x, y);
    }
    for (let k = 1; k <= 6; k++) {
      const ex = cxi + Math.round((dir.x || 0) * k);
      const ey = cyi + Math.round((dir.y || 0) * k);
      if (!inBounds(ex, ey)) break;
      let reached = false;
      for (let y = ey - 1; y <= ey + 1; y++) {
        for (let x = ex - 1; x <= ex + 1; x++) {
          if (inBounds(x, y) && !cellInCard(x, y) && !blocked[y * gcols + x]) reached = true;
          free(y * gcols + x, x, y);
        }
      }
      if (reached) break;
    }
  }
  function restore(): void {
    for (let i = 0; i < scratch.length; i++) blocked[scratch[i]] = 1;
    scratch.length = 0;
  }
  /** 端点落格：格心在卡内或被墙占 → 7×7 邻域挑最近可走格 */
  function snapCell(p: LayoutPoint): { x: number; y: number } | null {
    const cxi = clamp(colOf(p.x), 0, gcols - 1);
    const cyi = clamp(rowOf(p.y), 0, grows - 1);
    if (!cellInCard(cxi, cyi) && !blocked[cyi * gcols + cxi]) return { x: cxi, y: cyi };
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (let y = Math.max(0, cyi - 3); y <= Math.min(grows - 1, cyi + 3); y++) {
      for (let x = Math.max(0, cxi - 3); x <= Math.min(gcols - 1, cxi + 3); x++) {
        if (cellInCard(x, y) || blocked[y * gcols + x]) continue;
        const d = (x - cxi) * (x - cxi) + (y - cyi) * (y - cyi);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  const DX = [0, 1, 0, -1, 1, 1, -1, -1];
  const DY = [-1, 0, 1, 0, -1, 1, 1, -1];

  /** A*（8 邻域、正交 10 / 对角 14、不许剪角；Dial 桶按累计代价推进，最短路） */
  function solve(
    a: LayoutPoint,
    b: LayoutPoint,
    dirA: LayoutPoint,
    dirB: LayoutPoint,
  ): LayoutPoint[] | null {
    openCell(a, dirA);
    openCell(b, dirB);
    const sC = snapCell(a);
    const gC = snapCell(b);
    if (!sC || !gC) {
      restore();
      return null;
    }
    const n = gcols * grows;
    const start = sC.y * gcols + sC.x;
    const goal = gC.y * gcols + gC.x;
    const dist = new Float64Array(n);
    dist.fill(Infinity);
    const prev = new Int32Array(n);
    prev.fill(-1);
    const done = new Uint8Array(n);
    const buckets: number[][] = [];
    let maxc = 0;
    let found = false;
    dist[start] = 0;
    buckets[0] = [start];
    for (let c = 0; c <= maxc && !found; c++) {
      const q = buckets[c];
      if (!q) continue;
      for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi];
        if (done[cur]) continue;
        done[cur] = 1;
        if (cur === goal) {
          found = true;
          break;
        }
        const ix = cur % gcols;
        const iy = (cur - ix) / gcols;
        for (let d = 0; d < 8; d++) {
          const nx = ix + DX[d];
          const ny = iy + DY[d];
          if (!inBounds(nx, ny)) continue;
          const ni = ny * gcols + nx;
          if (blocked[ni]) continue;
          const diag = DX[d] !== 0 && DY[d] !== 0;
          if (diag && (blocked[iy * gcols + nx] || blocked[ny * gcols + ix])) continue; // 不许剪角
          const nc = c + (diag ? 14 : 10);
          if (nc < dist[ni]) {
            dist[ni] = nc;
            prev[ni] = cur;
            if (!buckets[nc]) buckets[nc] = [];
            buckets[nc].push(ni);
            if (nc > maxc) maxc = nc;
          }
        }
      }
    }
    restore();
    if (!found) return null;
    const points: LayoutPoint[] = [];
    let k = goal;
    while (k >= 0) {
      const kx = k % gcols;
      const ky = (k - kx) / gcols;
      points.push({ x: cx(kx), y: cy(ky) });
      k = prev[k];
    }
    points.reverse();
    points.unshift({ x: a.x, y: a.y });
    points.push({ x: b.x, y: b.y });
    return points;
  }

  return solve;
}

/** 路由：节点盒 + 要画的边 → 每条边的 SVG 命令串（顺序与入参 edges 一一对应） */
export function routeEdges(boxes: RouteBox[], edges: RouteEdgeInput[], opts?: RouteOptions): RoutedEdge[] {
  const out: RoutedEdge[] = new Array(edges.length);
  if (edges.length === 0) return out;
  const { CS, INF, STUB, PORT_PAD, PORT_MIN, ASTAR_MAX_NODES } = ROUTE_PARAMS;
  const strategy = opts?.strategy ?? 'astar';

  const nodes: RoutedBox[] = boxes.map((b) => ({ box: b, rect: rectOf(b) }));
  const byId = new Map<string, RoutedBox>();
  for (const n of nodes) if (!byId.has(n.box.id)) byId.set(n.box.id, n);
  const rects: Rect[] = nodes.map((n) => n.rect);

  /* ---------- ① 入卡端口：目标卡四边取最近 → 同目标同边分组 → 排序 → 错开 ---------- */
  const jobs: PortJob[] = [];
  const groupKeys: string[] = [];
  const groups = new Map<string, PortJob[]>();
  edges.forEach((e, idx) => {
    const src = byId.get(e.from);
    const dst = byId.get(e.to);
    if (!src || !dst) {
      // 端点缺盒（布局未含该节点）：不抛异常，给一条空 d 的降级产物
      out[idx] = { from: e.from, to: e.to, d: '', exit: 'L', entry: 'L', fallback: true };
      return;
    }
    const entry = nearestEntrySide(dst.rect, src.rect);
    const key = dst.box.id + '\u0000' + entry;
    let g = groups.get(key);
    if (!g) {
      g = [];
      groups.set(key, g);
      groupKeys.push(key);
    }
    const job: PortJob = {
      idx,
      edge: e,
      src,
      dst,
      entry,
      T: { x: 0, y: 0 },
      nIn: { x: 0, y: 0 },
    };
    g.push(job);
    jobs.push(job);
  });

  for (const key of groupKeys) {
    const g = groups.get(key) as PortJob[];
    const side = g[0].entry;
    const b = g[0].dst.rect;
    const vert = side === 'L' || side === 'R';
    const lo = vert ? b.top + PORT_PAD : b.left + PORT_PAD;
    const hi = vert ? b.bottom - PORT_PAD : b.right - PORT_PAD;
    const coord = (j: PortJob): number =>
      vert ? (j.src.rect.top + j.src.rect.bottom) / 2 : (j.src.rect.left + j.src.rect.right) / 2;
    const sorted = g.slice().sort((a, c) => {
      const d = coord(a) - coord(c);
      if (d < 0) return -1;
      if (d > 0) return 1;
      if (a.edge.from !== c.edge.from) return a.edge.from < c.edge.from ? -1 : 1; // 并列：id 兜底，杜绝依赖迭代顺序
      if (a.edge.to !== c.edge.to) return a.edge.to < c.edge.to ? -1 : 1;
      return a.idx - c.idx;
    });
    const mid = vert ? (b.top + b.bottom) / 2 : (b.left + b.right) / 2;
    const vals: number[] = [];
    for (let i = 0; i < sorted.length; i++) vals.push(mid + (i - (sorted.length - 1) / 2) * PORT_MIN);
    spread(vals, lo, hi, PORT_MIN);
    sorted.forEach((j, i) => {
      const v = vals[i];
      j.T = vert
        ? { x: side === 'L' ? b.left : b.right, y: v }
        : { x: v, y: side === 'T' ? b.top : b.bottom };
      j.nIn = vert ? { x: side === 'L' ? 1 : -1, y: 0 } : { x: 0, y: side === 'T' ? 1 : -1 };
    });
  }

  /* ---------- ③ 栅格（整批共享；端点口袋逐边开/还原） ---------- */
  const astar =
    strategy === 'astar' && nodes.length > 0 && boxes.length <= ASTAR_MAX_NODES
      ? buildAstar(rects, CS, INF)
      : null;

  /* ---------- ②④⑤ 逐边：就近出盒 → A* → 拉直 → 平滑 → 产物 ---------- */
  for (const j of jobs) {
    const e = j.edge;
    const sb = j.src.rect;
    const S: LayoutPoint =
      e.anchor && Number.isFinite(e.anchor.x) && Number.isFinite(e.anchor.y)
        ? { x: e.anchor.x, y: e.anchor.y }
        : { x: sb.left, y: sb.top + 26 }; // 缺锚点兜底：源盒左上角内缩（原型同款）

    // 就近出盒：四条边挑离锚点最近的一条（含左缘），出盒点沿外向法向推 STUB
    const dl = S.x - sb.left;
    const dr = sb.right - S.x;
    const dt = S.y - sb.top;
    const db = sb.bottom - S.y;
    const m = Math.min(dl, dr, dt, db);
    let exit: MountSide;
    let E: LayoutPoint;
    let nOut: LayoutPoint;
    if (m === dl) {
      exit = 'L';
      E = { x: sb.left, y: clamp(S.y, sb.top + PORT_PAD, sb.bottom - PORT_PAD) };
      nOut = { x: -1, y: 0 };
    } else if (m === dr) {
      exit = 'R';
      E = { x: sb.right, y: clamp(S.y, sb.top + PORT_PAD, sb.bottom - PORT_PAD) };
      nOut = { x: 1, y: 0 };
    } else if (m === dt) {
      exit = 'T';
      E = { x: clamp(S.x, sb.left + PORT_PAD, sb.right - PORT_PAD), y: sb.top };
      nOut = { x: 0, y: -1 };
    } else {
      exit = 'B';
      E = { x: clamp(S.x, sb.left + PORT_PAD, sb.right - PORT_PAD), y: sb.bottom };
      nOut = { x: 0, y: 1 };
    }
    const E1: LayoutPoint = { x: E.x + nOut.x * STUB, y: E.y + nOut.y * STUB };
    const T = j.T;
    const nOutT: LayoutPoint = { x: -j.nIn.x, y: -j.nIn.y }; // 目标卡外向法向（背离方向）
    const T1: LayoutPoint = { x: T.x - j.nIn.x * STUB, y: T.y - j.nIn.y * STUB }; // 入卡桩：必在卡外

    const raw = astar ? astar(E1, T1, nOut, nOutT) : null;
    const items: PathItem[] = [S, E, E1];
    if (raw) {
      const base = pull(raw, rects, PULL_MARGIN);
      // 逐段平滑：切向 [1, 0.55, 0.3] 三档递减；压卡那段保持直线，三档都压卡就退回折线
      for (let i = 0; i < base.length - 1; i++) {
        const P0 = base[i];
        const P3 = base[i + 1];
        const len = Math.hypot(P3.x - P0.x, P3.y - P0.y) || 1;
        let done = false;
        for (let si = 0; si < TANGENT_SCALES.length && !done; si++) {
          const sc = TANGENT_SCALES[si];
          const c1: LayoutPoint =
            i === 0
              ? { x: P0.x + nOut.x * len * 0.34 * sc, y: P0.y + nOut.y * len * 0.34 * sc }
              : { x: P0.x + ((P3.x - base[i - 1].x) / 6) * sc, y: P0.y + ((P3.y - base[i - 1].y) / 6) * sc };
          const c2: LayoutPoint =
            i === base.length - 2
              ? { x: P3.x - j.nIn.x * len * 0.34 * sc, y: P3.y - j.nIn.y * len * 0.34 * sc }
              : { x: P3.x - ((base[i + 2].x - P0.x) / 6) * sc, y: P3.y - ((base[i + 2].y - P0.y) / 6) * sc };
          if (!curveHitsAny(P0, c1, c2, P3, rects, SMOOTH_MARGIN)) {
            items.push({ b: [P0, c1, c2, P3] });
            done = true;
          }
        }
        if (!done) items.push(P3);
      }
    } else {
      items.push(T1); // 降级直线：不走 A* 也不平滑，端点桩直连（可能穿卡，降级代价）
    }
    items.push(T); // 入卡桩 → 入卡点：12px 直线落在 entry 边上（终点 = 入卡点）
    out[j.idx] = { from: e.from, to: e.to, d: pathD(items), exit, entry: j.entry, fallback: !raw };
  }

  return out;
}
