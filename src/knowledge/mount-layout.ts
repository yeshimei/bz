/**
 * 挂载树画布 · 力导向布局（issues/316 前半）
 *
 * 规格来源：`.scratch/mount-canvas/HANDOFF.md` §3.1（原型 `transformer-real.html` L199/L254-354，视觉已验收）。
 * 本文件是纯几何层：不碰 DOM、不吃随机数、不看时间——**同一输入两次调用必得逐字节一致的结果**。
 *
 * 坐标口径：`pos[id]` = 节点**左上角**（世界坐标；全局最小左/上沿已归一化到 `PAD`）。
 * 渲染层把卡绝对定位时 `style.left/top` 直接用 `pos[id].x/y`；`RouteBox.x/y` 同口径，无需再减半宽。
 *
 * `opts.viewport`（**别误用**）：只服务「超大图降级」，**不可当可视区/裁剪区**。语义 = 按**种子位**
 * 判定哪些节点参与施力，未命中的节点原样留在种子位、彼此之间以及与参与节点**都可能重叠**
 * （本模块夹具 wideTree-100 传 900×900 视口 → 411 对重叠、最大互穿 269.8px；审查夹具 429 对 / 298.6px）。
 * 要按真实可视区渲染，请由渲染层自己用 `pos` + `world` 裁剪，别把可视区塞进这里。
 * 默认 `null` = 全量布局（正常路径）。
 *
 * 已知取舍（残重叠兜底，原型没有、本卡新增）：原型只布局 10 张卡，60 轮（余量 40/34）够用；
 * 本卡上限 120，病态稠密集（大卡长链 / 大卡星形）60 轮会往返震荡留残重叠，故加兜底：
 * ① 300 轮 0 余量微调（很便宜）→ ② 单侧 +x 右移松弛（必然终止，只对 ① 收不干净的少数卡生效）。
 * 代价是**个别卡会被明显右移**。实测（RESIDUAL_EPS=1e-3；计量口径 = 兜底阶段内单卡 |Δx| 最大值）：
 *   · star-120（1 根 + 119 子，统一 560×300）单卡 2369px，世界 4536×7511 → 5939×8704（宽 +31% / 高 +16%）；
 *   · 变尺寸 120 卡长链单卡 763px，世界宽度不变；wideTree-100 只走 ①，世界尺寸与全量一致。
 * 审查另测为同一量级（其口径较宽，star-120 3582px、长链世界宽 +22.7%）：数千 px / 十几～三十个百分点。
 * 常规规模（≤60 卡，或带弹簧的宽树）兜底完全不介入，世界尺寸与原型口径一致。
 *
 * 依赖方向（ADR-0002）：core ← mount-types ← 本文件 ← 渲染层（mount-canvas）。**只 import type 契约**，
 * 不 import 任何兄弟模块（mount-data / mount-route / mount-suggest 各自独立可测）。
 */
import type { LayoutBox, LayoutEdge, LayoutOptions, LayoutPoint, LayoutResult } from './mount-types';

/** 关键参数（暴露给渲染层算视口兜底与测试断言）。数值 = 原型已验证口径，勿随手调 */
export const LAYOUT_PARAMS: {
  REP: number;
  REST: number;
  CUTOFF: number;
  X_STEP: number;
  ITER: number;
  PAD: number;
  MAX_NODES: number;
} = {
  /** 斥力系数：rep = REP²/d，近距（d < need）×2.4 */
  REP: 150,
  /** Hooke 弹簧自然长度：rest = half(A)+half(B)+REST */
  REST: 160,
  /** 远距斥力截断倍数（× 作用半径 need），不截断图会炸开 */
  CUTOFF: 2.5,
  /** 每代 x 弱锚步长（只防漂移，单向流方向由「子卡在父卡右侧」软约束给） */
  X_STEP: 640,
  /** 退火轮数 */
  ITER: 420,
  /** 世界内边距：归一化基准（左/上）+ 右/下余量 */
  PAD: 60,
  /** 默认布局上限，超过按输入序降级进 `culled`（spec 风险 1） */
  MAX_NODES: 120,
};

/* ---------- 力导向常量（原型 199 行同源；作用半径 = (w+h)/4） ---------- */

/** 作用半径之外的额外「需要距离」：need = half(A)+half(B)+NEED_GAP */
const NEED_GAP = 90;
/** 近距斥力加成（d < need 时） */
const REP_OVERLAP_BOOST = 2.4;
/** 弹簧刚度 */
const SPRING_K = 0.34;
/** 子卡在父卡右侧的软约束余量（中心 x 至少隔开 (wA+wB)/2 + ORDER_GAP） */
const ORDER_GAP = 56;
/** 软约束刚度 */
const ORDER_K = 0.16;
/** 每代 x 弱锚刚度（很弱） */
const ANCHOR_K = 0.012;
/** 向心引力（防炸开、控世界尺寸） */
const GRAVITY_X = 0.03;
const GRAVITY_Y = 0.06;
/** 退火：cool = 1 - it/ITER*COOL_SPAN */
const COOL_SPAN = 0.85;
/** 单步位移上限 = STEP_COOL*cool + STEP_BASE，位移再 ×STEP_SCALE */
const STEP_COOL = 12;
const STEP_BASE = 3;
const STEP_SCALE = 0.5;
/** 收尾硬推开：轮数 + 最小穿透轴余量（不重叠，且留缝） */
const SEPARATE_ROUNDS = 60;
const SEPARATE_GAP_X = 40;
const SEPARATE_GAP_Y = 34;
/** 残重叠兜底（原型没有：原型只布局 10 张卡，本卡上限 120，长链下 60 轮可能留残重叠） */
const RESIDUAL_EPS = 1e-3; // 「贴合」判定：互穿 ≤ 1e-3px 才算贴合（与测试同口径，收紧到亚像素）
const RESIDUAL_GAP = 1; // 兜底右移后留 1px 缝
const RESIDUAL_ROUNDS = 300; // 残重叠先做 N 轮最小穿透轴微调（0 余量；很便宜，能大幅少走破坏性的右移）
/** 确定性种子：黄金角螺旋，半径 = SEED_BASE_R + SEED_STEP_R*sqrt(i)（i = 输入下标），θ = i*137.5° */
const SEED_BASE_R = 150;
const SEED_STEP_R = 46;
const GOLDEN_ANGLE_RAD = (137.5 * Math.PI) / 180;

/** 布局中的工作节点（中心坐标 + 参与标记） */
interface WorkNode {
  id: string;
  w: number;
  h: number;
  depth: number;
  /** 视口裁剪：false = 保持种子位、不参与任何力（默认全 true） */
  active: boolean;
  x: number;
  y: number;
}

/** 去重后的有向边（按输入下标） */
interface WorkLink {
  a: number;
  b: number;
}

function positiveSize(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function resolveMaxNodes(v: number | undefined): number {
  if (v === undefined || !Number.isFinite(v)) return LAYOUT_PARAMS.MAX_NODES;
  return Math.max(0, Math.floor(v));
}

function buildNodes(boxes: LayoutBox[], count: number): WorkNode[] {
  const nodes: WorkNode[] = [];
  for (let i = 0; i < count; i++) {
    const b = boxes[i];
    nodes.push({
      id: b.id,
      w: positiveSize(b.w),
      h: positiveSize(b.h),
      depth: Number.isFinite(b.depth) ? Math.max(0, Math.floor(b.depth)) : 0,
      active: true,
      x: 0,
      y: 0,
    });
  }
  return nodes;
}

/** 黄金角螺旋种子：只吃输入下标，绝不吃随机数（确定性硬要求） */
function seedPositions(nodes: WorkNode[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const ang = i * GOLDEN_ANGLE_RAD;
    const r = SEED_BASE_R + SEED_STEP_R * Math.sqrt(i);
    n.x = Math.cos(ang) * r + n.w / 2;
    n.y = Math.sin(ang) * r + n.h / 2;
  }
}

/**
 * 视口降级接口（**不可当可视区用**）：只把与视口相交的节点标记为参与施力/施约束，未命中的保持
 * 种子位（仍计入归一化与世界尺寸，因此彼此可能重叠）。命中按**种子位**判定（布局前没有真坐标）。
 * 默认 `undefined` = 全量。真渲染请由渲染层用 `pos` + `world` 自行裁剪。
 */
function markActive(nodes: WorkNode[], viewport: LayoutOptions['viewport']): void {
  if (!viewport) return;
  const { x, y, w, h } = viewport;
  if (![x, y, w, h].every((v) => Number.isFinite(v)) || w <= 0 || h <= 0) return;
  for (const n of nodes) {
    n.active =
      n.x + n.w / 2 >= x && n.x - n.w / 2 <= x + w && n.y + n.h / 2 >= y && n.y - n.h / 2 <= y + h;
  }
  if (nodes.every((n) => !n.active)) {
    // 视口与所有种子都不相交时不做降级（否则等于没有力）：回退全量，行为可预期
    for (const n of nodes) n.active = true;
  }
}

function buildLinks(nodes: WorkNode[], edges: LayoutEdge[]): WorkLink[] {
  const indexById = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) indexById.set(nodes[i].id, i);
  const links: WorkLink[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!e) continue;
    const a = indexById.get(e.from);
    const b = indexById.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a + '>' + b;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ a, b });
  }
  return links;
}

/** 力导向退火：所有对斥力（截断）+ 连线弹簧 + 「子卡在父卡右侧」软约束 + 每代 x 弱锚 + 向心 */
function relax(nodes: WorkNode[], links: WorkLink[]): void {
  const n = nodes.length;
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const ITER = LAYOUT_PARAMS.ITER;
  const REP = LAYOUT_PARAMS.REP;
  const PAD = LAYOUT_PARAMS.PAD;

  for (let it = 0; it < ITER; it++) {
    const cool = 1 - (it / ITER) * COOL_SPAN;
    fx.fill(0);
    fy.fill(0);

    /* 所有对斥力：力 = REP²/d，远距截断到 CUTOFF×need，近距 ×2.4 */
    for (let i = 0; i < n; i++) {
      const A = nodes[i];
      if (!A.active) continue;
      for (let j = i + 1; j < n; j++) {
        const B = nodes[j];
        if (!B.active) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1;
        const need = (A.w + A.h) / 4 + (B.w + B.h) / 4 + NEED_GAP;
        if (d > LAYOUT_PARAMS.CUTOFF * need) continue;
        const rep = ((REP * REP) / d) * (d < need ? REP_OVERLAP_BOOST : 1);
        const ux = dx / d;
        const uy = dy / d;
        fx[i] -= ux * rep;
        fy[i] -= uy * rep;
        fx[j] += ux * rep;
        fy[j] += uy * rep;
      }
    }

    /* 连线弹簧 + 代际次序软约束（子卡中心 x 必须 ≥ 父卡中心 x + (wA+wB)/2 + 56） */
    for (const l of links) {
      const A = nodes[l.a];
      const B = nodes[l.b];
      if (!A.active || !B.active) continue;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1;
      const rest = (A.w + A.h) / 4 + (B.w + B.h) / 4 + LAYOUT_PARAMS.REST;
      const att = (d - rest) * SPRING_K;
      const ux = dx / d;
      const uy = dy / d;
      fx[l.a] += ux * att;
      fy[l.a] += uy * att;
      fx[l.b] -= ux * att;
      fy[l.b] -= uy * att;
      const minDx = (A.w + B.w) / 2 + ORDER_GAP;
      if (B.x - A.x < minDx) {
        const push = (minDx - (B.x - A.x)) * ORDER_K;
        fx[l.b] += push;
        fx[l.a] -= push;
      }
    }

    /* 向心（防炸开、控尺寸）+ 每代 x 弱锚（防漂移） */
    let gx = 0;
    let gy = 0;
    for (const node of nodes) {
      gx += node.x;
      gy += node.y;
    }
    gx /= n;
    gy /= n;
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (!node.active) continue;
      const want = PAD + node.w / 2 + node.depth * LAYOUT_PARAMS.X_STEP;
      fx[i] += (want - node.x) * ANCHOR_K;
      fx[i] += (gx - node.x) * GRAVITY_X;
      fy[i] += (gy - node.y) * GRAVITY_Y;
    }

    /* 单步位移上限 12*cool+3（退火），位移 ×0.5 */
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (!node.active) continue;
      const f = Math.hypot(fx[i], fy[i]) || 1;
      const cap = STEP_COOL * cool + STEP_BASE;
      const k = f > cap ? cap / f : 1;
      node.x += fx[i] * k * STEP_SCALE;
      node.y += fy[i] * k * STEP_SCALE;
    }
  }
}

/**
 * 一轮「最小穿透轴」推开（原型同款）：两轴各有余量 `gapX/gapY`，互穿 ≤ `eps` 视为已贴合。
 * 返回本轮是否推过（false = 已到不动点）。
 */
function pushRound(nodes: WorkNode[], gapX: number, gapY: number, eps: number): boolean {
  const n = nodes.length;
  let moved = false;
  for (let i = 0; i < n; i++) {
    const A = nodes[i];
    if (!A.active) continue;
    for (let j = i + 1; j < n; j++) {
      const B = nodes[j];
      if (!B.active) continue;
      const ox = (A.w + B.w) / 2 + gapX - Math.abs(B.x - A.x);
      const oy = (A.h + B.h) / 2 + gapY - Math.abs(B.y - A.y);
      if (ox <= eps || oy <= eps) continue;
      moved = true;
      if (ox <= oy) {
        const s = (B.x >= A.x ? 1 : -1) * (ox / 2);
        A.x -= s;
        B.x += s;
      } else {
        const s = (B.y >= A.y ? 1 : -1) * (oy / 2);
        A.y -= s;
        B.y += s;
      }
    }
  }
  return moved;
}

/** 收尾：60 轮最小穿透轴硬推开（任意两盒不重叠，允许 1px 内贴合；原型同款余量 40/34） */
function separate(nodes: WorkNode[]): void {
  for (let round = 0; round < SEPARATE_ROUNDS; round++) {
    if (!pushRound(nodes, SEPARATE_GAP_X, SEPARATE_GAP_Y, 0)) return; // 原型路径：60 轮内收敛
  }
  resolveResidual(nodes);
}

/**
 * 残重叠兜底（确定性、必然终止）。原型只布局 10 张卡，60 轮（带 40/34 余量）够用；
 * 本卡上限 120（含长链 / 宽树等最坏情况）会留下残重叠，且逐对 ±ox/2 的对称推法在那边往返震荡：
 * ① 先 30 轮「0 余量」最小穿透轴微调——残重叠通常只有十几 px，这一级就把常见情况收干净；
 * ② 仍震荡的才走单侧收敛：只把还有真重叠的节点沿 +x 右移让位。y 不动 ⇒ 约束图 i→j 无环，
 *    反复松弛最多 n 遍必到不动点（不会死循环），对网状的扰动也只剩真正重叠的那几个节点。
 */
function resolveResidual(nodes: WorkNode[]): void {
  const n = nodes.length;
  for (let round = 0; round < RESIDUAL_ROUNDS; round++) {
    if (!pushRound(nodes, 0, 0, RESIDUAL_EPS)) return;
  }
  for (let sweep = 0; sweep < n; sweep++) {
    let moved = false;
    for (let j = 1; j < n; j++) {
      const B = nodes[j];
      if (!B.active) continue;
      for (let i = 0; i < j; i++) {
        const A = nodes[i];
        if (!A.active) continue;
        const ox = (A.w + B.w) / 2 - Math.abs(B.x - A.x);
        const oy = (A.h + B.h) / 2 - Math.abs(B.y - A.y);
        if (ox <= RESIDUAL_EPS || oy <= RESIDUAL_EPS) continue;
        const want = A.x + A.w / 2 + B.w / 2 + RESIDUAL_GAP;
        if (want > B.x) {
          B.x = want;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/**
 * 归一化到 `PAD`（全局最小左/上沿，不是逐节点半宽——原型此处 bug 已修）+ 输出世界尺寸。
 * 世界尺寸 = 包围盒 + 左右各 PAD（右/下取「最大右/下沿 + PAD」）；空输入退化为 2×PAD 的方形。
 */
function finalize(nodes: WorkNode[], culled: string[]): LayoutResult {
  let minLeft = Infinity;
  let minTop = Infinity;
  for (const n of nodes) {
    if (n.x - n.w / 2 < minLeft) minLeft = n.x - n.w / 2;
    if (n.y - n.h / 2 < minTop) minTop = n.y - n.h / 2;
  }
  const shiftX = LAYOUT_PARAMS.PAD - minLeft;
  const shiftY = LAYOUT_PARAMS.PAD - minTop;

  const pos: Record<string, LayoutPoint> = {};
  let right = LAYOUT_PARAMS.PAD;
  let bottom = LAYOUT_PARAMS.PAD;
  for (const n of nodes) {
    const x = n.x - n.w / 2 + shiftX;
    const y = n.y - n.h / 2 + shiftY;
    pos[n.id] = { x, y };
    if (x + n.w > right) right = x + n.w;
    if (y + n.h > bottom) bottom = y + n.h;
  }
  return { pos, world: { w: right + LAYOUT_PARAMS.PAD, h: bottom + LAYOUT_PARAMS.PAD }, culled };
}

/**
 * 力导向网状布局（确定性）。输入 `boxes` 必须是**输入 BFS 序**（种子、降级都按下标取），
 * 返回每个节点的左上角坐标 + 世界尺寸 + 被 `maxNodes` 裁掉的 id。
 *
 * - 斥力 REP=150（半径 (w+h)/4，远距截断 2.5×）+ 弹簧 REST=160 + 「子卡在父卡右侧」软约束
 *   + 每代弱 x 锚 depth*X_STEP + 向心（fx .03 / fy .06），单步上限 12*cool+3，ITER=420 轮退火；
 * - 收尾 60 轮最小穿透轴硬推开 → 任意两盒不重叠（互穿 ≤ 1e-3px）；病态稠密集再走残重叠兜底（见文件头）；
 * - 超过 `opts.maxNodes`（默认 120）：只布局前 N 个，其余进 `culled`（无坐标）；
 * - `opts.viewport`：**仅超大图降级**，按种子位判定、未命中节点留种子位（会互相重叠），
 *   不可当可视区用；默认 null = 全量。
 */
export function layoutTree(
  boxes: LayoutBox[],
  edges: LayoutEdge[],
  opts?: LayoutOptions,
): LayoutResult {
  const maxNodes = resolveMaxNodes(opts?.maxNodes);
  const keptCount = Math.min(boxes.length, maxNodes);
  const culled: string[] = [];
  for (let i = keptCount; i < boxes.length; i++) culled.push(boxes[i].id);

  const nodes = buildNodes(boxes, keptCount);
  if (nodes.length === 0) {
    return { pos: {}, world: { w: LAYOUT_PARAMS.PAD * 2, h: LAYOUT_PARAMS.PAD * 2 }, culled };
  }
  seedPositions(nodes);
  markActive(nodes, opts?.viewport);
  relax(nodes, buildLinks(nodes, edges));
  separate(nodes);
  return finalize(nodes, culled);
}
