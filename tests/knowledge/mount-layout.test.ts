// @vitest-environment node
/**
 * 挂载树画布 · 力导向布局测试（issues/316 前半）
 *
 * 覆盖：确定性（同输入两次逐字节一致）／输入序说明／零重叠（多层 + 链式）／世界尺寸含 PAD／
 * maxNodes 降级 culled／单节点 · 深链 · 孤立节点不 NaN／「子卡在父卡右侧」软约束生效。
 * 纯几何层，自造 boxes/edges，不依赖任何兄弟模块（契约只 import type）。
 */
import { describe, it, expect } from 'vitest';
import { layoutTree, LAYOUT_PARAMS } from '../../src/knowledge/mount-layout';
import type { LayoutBox, LayoutEdge, LayoutPoint } from '../../src/knowledge/mount-types';

/* ---------- 夹具 ---------- */

/** 15 节点多层样例：深度 0–3、大块头尺寸（300–560 × 140–520）、含 1 张孤立卡 */
function fixtureMultiLayer(): { boxes: LayoutBox[]; edges: LayoutEdge[] } {
  const spec: Array<[string, number, number, number]> = [
    ['n0', 560, 320, 0],
    ['n1', 420, 240, 1],
    ['n2', 380, 200, 1],
    ['n3', 480, 260, 1],
    ['n4', 360, 220, 2],
    ['n5', 300, 160, 2],
    ['n6', 440, 280, 2],
    ['n7', 340, 180, 2],
    ['n8', 400, 520, 2],
    ['n9', 320, 200, 3],
    ['n10', 380, 180, 3],
    ['n11', 300, 140, 3],
    ['n12', 420, 260, 3],
    ['n13', 360, 220, 3],
    ['n14', 400, 200, 3], // 孤立：无边相连
  ];
  const boxes = spec.map(([id, w, h, depth]) => ({ id, w, h, depth, kind: 'card' as const }));
  const pairs: Array<[string, string]> = [
    ['n0', 'n1'], ['n0', 'n2'], ['n0', 'n3'],
    ['n1', 'n4'], ['n1', 'n5'],
    ['n2', 'n6'], ['n2', 'n8'],
    ['n3', 'n7'], ['n3', 'n8'],
    ['n4', 'n9'], ['n4', 'n10'],
    ['n5', 'n11'],
    ['n6', 'n12'],
    ['n7', 'n13'],
    ['n8', 'n9'],
  ];
  return { boxes, edges: pairs.map(([from, to]) => ({ from, to })) };
}

/** 20 节点链式样例：depth 0..19，逐代单链（最坏情况的方向约束串联） */
function fixtureChain(n = 20): { boxes: LayoutBox[]; edges: LayoutEdge[] } {
  const boxes: LayoutBox[] = [];
  const edges: LayoutEdge[] = [];
  for (let i = 0; i < n; i++) {
    boxes.push({ id: 'c' + i, w: 320 + (i % 4) * 40, h: 140 + (i % 3) * 60, depth: i, kind: 'card' });
    if (i > 0) edges.push({ from: 'c' + (i - 1), to: 'c' + i });
  }
  return { boxes, edges };
}

function centerOf(box: LayoutBox, pos: Record<string, LayoutPoint>): LayoutPoint {
  return { x: pos[box.id].x + box.w / 2, y: pos[box.id].y + box.h / 2 };
}

/** 返回重叠对（容差 1px：间距 ≥ -1 才算「不重叠」，允许 1px 内贴合） */
function overlapPairs(boxes: LayoutBox[], pos: Record<string, LayoutPoint>): string[] {
  const bad: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i];
      const B = boxes[j];
      const a = centerOf(A, pos);
      const b = centerOf(B, pos);
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dx < (A.w + B.w) / 2 - 1 && dy < (A.h + B.h) / 2 - 1) bad.push(A.id + '×' + B.id);
    }
  }
  return bad;
}

function expectAllFinite(boxes: LayoutBox[], pos: Record<string, LayoutPoint>): void {
  for (const b of boxes) {
    expect(pos[b.id], b.id + ' 缺坐标').toBeTruthy();
    expect(Number.isFinite(pos[b.id].x), b.id + '.x 非有限').toBe(true);
    expect(Number.isFinite(pos[b.id].y), b.id + '.y 非有限').toBe(true);
  }
}

/* ---------- 1. 确定性 ---------- */

describe('LAYOUT_PARAMS：原型已验证口径（防漂移）', () => {
  it('REP=150 / REST=160 / CUTOFF=2.5 / X_STEP=640 / ITER=420 / PAD=60 / MAX_NODES=120', () => {
    expect(LAYOUT_PARAMS).toEqual({
      REP: 150,
      REST: 160,
      CUTOFF: 2.5,
      X_STEP: 640,
      ITER: 420,
      PAD: 60,
      MAX_NODES: 120,
    });
  });
});

describe('确定性（本卡新增硬要求：不吃随机数 / 时间 / 不确定的 Map 迭代）', () => {
  it('同一输入两次 layoutTree → pos 与 world 逐字节一致（JSON 相等）', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const a = layoutTree(boxes, edges);
    const b = layoutTree(boxes, edges);
    expect(JSON.stringify(a.pos)).toBe(JSON.stringify(b.pos));
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
    expect(JSON.stringify(a.culled)).toBe(JSON.stringify(b.culled));
  });

  it('链式样例 + maxNodes 降级同样确定；opts 不影响可复现性', () => {
    const { boxes, edges } = fixtureChain(20);
    const opt = { maxNodes: 12, viewport: { x: 0, y: 0, w: 2000, h: 1500 } };
    const a = layoutTree(boxes, edges, opt);
    const b = layoutTree(boxes, edges, opt);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('输入的 boxes/edges 数组不被改写（纯函数）', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const boxesSnap = JSON.stringify(boxes);
    const edgesSnap = JSON.stringify(edges);
    layoutTree(boxes, edges);
    expect(JSON.stringify(boxes)).toBe(boxesSnap);
    expect(JSON.stringify(edges)).toBe(edgesSnap);
  });
});

/* ---------- 2. 输入序 ---------- */

describe('输入序：种子与降级都按输入 BFS 序取下标', () => {
  it('打乱 boxes 顺序结果不保证逐点相同，但各自自洽（不 NaN / 不重叠 / 世界尺寸同量级）', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const straight = layoutTree(boxes, edges);
    // 固定置换（非随机）：偶数位前置 + 奇数位倒序，模拟「另一棵树的 BFS 序」
    const shuffled: LayoutBox[] = [
      ...boxes.filter((_, i) => i % 2 === 0),
      ...boxes.filter((_, i) => i % 2 === 1).reverse(),
    ];
    const shuffledEdges: LayoutEdge[] = edges.map((e) => ({ ...e }));
    const other = layoutTree(shuffled, shuffledEdges);

    expectAllFinite(shuffled, other.pos);
    expect(overlapPairs(shuffled, other.pos)).toEqual([]);
    // 世界尺寸同量级（不要求相等：代价是种子半径按下标分布）
    expect(other.world.w).toBeGreaterThan(straight.world.w * 0.5);
    expect(other.world.w).toBeLessThan(straight.world.w * 2);
    expect(other.world.h).toBeGreaterThan(straight.world.h * 0.5);
    expect(other.world.h).toBeLessThan(straight.world.h * 2);
  });
});

/* ---------- 3. 零重叠 ---------- */

describe('零重叠（60 轮最小穿透轴硬推开）', () => {
  it('15 节点 / 4 层样例：任意两盒不重叠（容差 1px）', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const res = layoutTree(boxes, edges);
    expectAllFinite(boxes, res.pos);
    expect(overlapPairs(boxes, res.pos)).toEqual([]);
  });

  it('20 节点链式样例：任意两盒不重叠（容差 1px）', () => {
    const { boxes, edges } = fixtureChain(20);
    const res = layoutTree(boxes, edges);
    expectAllFinite(boxes, res.pos);
    expect(overlapPairs(boxes, res.pos)).toEqual([]);
  });
});

/* ---------- 4. 世界尺寸 ---------- */

describe('世界尺寸（包围盒 + PAD）', () => {
  it('所有节点落在 [PAD, world-PAD] 内，且 world = 包围盒 + 左右各 PAD', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const res = layoutTree(boxes, edges);
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    for (const b of boxes) {
      const p = res.pos[b.id];
      minLeft = Math.min(minLeft, p.x);
      minTop = Math.min(minTop, p.y);
      maxRight = Math.max(maxRight, p.x + b.w);
      maxBottom = Math.max(maxBottom, p.y + b.h);
    }
    expect(minLeft).toBeCloseTo(LAYOUT_PARAMS.PAD, 6);
    expect(minTop).toBeCloseTo(LAYOUT_PARAMS.PAD, 6);
    expect(res.world.w).toBeCloseTo(maxRight + LAYOUT_PARAMS.PAD, 6);
    expect(res.world.h).toBeCloseTo(maxBottom + LAYOUT_PARAMS.PAD, 6);
  });

  it('空输入不 NaN：world 退化但不崩', () => {
    const res = layoutTree([], []);
    expect(res.pos).toEqual({});
    expect(res.culled).toEqual([]);
    expect(Number.isFinite(res.world.w)).toBe(true);
    expect(Number.isFinite(res.world.h)).toBe(true);
  });
});

/* ---------- 5. maxNodes 降级 ---------- */

describe('maxNodes 降级（spec 风险 1：超 120 卡自动降级）', () => {
  it('maxNodes=10 时前 10 个有坐标、其余按输入序进 culled', () => {
    const { boxes } = fixtureChain(30);
    const res = layoutTree(boxes, [], { maxNodes: 10 });
    expect(res.culled).toEqual(boxes.slice(10).map((b) => b.id));
    expect(Object.keys(res.pos)).toHaveLength(10);
    for (const id of res.culled) expect(res.pos[id]).toBeUndefined();
  });

  it('默认上限 = LAYOUT_PARAMS.MAX_NODES：120 个以内全布局，125 个裁 5 个', () => {
    const { boxes } = fixtureChain(125);
    const res = layoutTree(boxes, []);
    expect(LAYOUT_PARAMS.MAX_NODES).toBe(120);
    expect(Object.keys(res.pos)).toHaveLength(120);
    expect(res.culled).toEqual(boxes.slice(120).map((b) => b.id));
    expect(overlapPairs(boxes.slice(0, 120), res.pos)).toEqual([]);
  });
});

/* ---------- 6. 边界输入 ---------- */

describe('边界：单节点 / 深链 / 孤立节点 / 脏输入', () => {
  it('单节点：落在 (PAD, PAD)，世界 = 卡尺寸 + 2×PAD', () => {
    const box: LayoutBox = { id: 'only', w: 400, h: 300, depth: 0, kind: 'card' };
    const res = layoutTree([box], []);
    expect(res.pos.only).toEqual({ x: LAYOUT_PARAMS.PAD, y: LAYOUT_PARAMS.PAD });
    expect(res.world).toEqual({ w: 400 + LAYOUT_PARAMS.PAD * 2, h: 300 + LAYOUT_PARAMS.PAD * 2 });
  });

  it('深链 depth 0..12：不 NaN、不抛、不重叠', () => {
    const { boxes, edges } = fixtureChain(13);
    const res = layoutTree(boxes, edges);
    expectAllFinite(boxes, res.pos);
    expect(boxes.every((b) => res.pos[b.id].x > -1e6 && res.pos[b.id].x < 1e6)).toBe(true);
    expect(overlapPairs(boxes, res.pos)).toEqual([]);
  });

  it('孤立节点（无边）也有确定位置；自环 / 指向未知 id 的边被忽略', () => {
    const boxes: LayoutBox[] = [
      { id: 'a', w: 400, h: 200, depth: 0, kind: 'card' },
      { id: 'z', w: 400, h: 200, depth: 3, kind: 'card' }, // 孤立
    ];
    const edges: LayoutEdge[] = [
      { from: 'a', to: 'a' }, // 自环
      { from: 'a', to: 'ghost' }, // 未知目标
      { from: 'ghost', to: 'a' }, // 未知源
    ];
    const res = layoutTree(boxes, edges);
    expectAllFinite(boxes, res.pos);
    expect(overlapPairs(boxes, res.pos)).toEqual([]);
    const again = layoutTree(boxes, edges);
    expect(JSON.stringify(res.pos)).toBe(JSON.stringify(again.pos));
  });

  it('脏尺寸（NaN / 0 / 负）不会污染坐标', () => {
    const boxes: LayoutBox[] = [
      { id: 'a', w: Number.NaN, h: 0, depth: Number.NaN, kind: 'para' },
      { id: 'b', w: -100, h: 180, depth: 1.9, kind: 'image' },
    ];
    const res = layoutTree(boxes, [{ from: 'a', to: 'b' }]);
    expectAllFinite(boxes, res.pos);
    expect(Number.isFinite(res.world.w)).toBe(true);
  });
});

/* ---------- 7. 软约束 / 视口接口 ---------- */

describe('软约束与视口接口', () => {
  it('「子卡在父卡右侧」软约束生效：同代际多数节点 x 大于父节点 x（宽松断言）', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const res = layoutTree(boxes, edges);
    let ok = 0;
    for (const e of edges) {
      const A = boxes.find((b) => b.id === e.from)!;
      const B = boxes.find((b) => b.id === e.to)!;
      if (centerOf(B, res.pos).x > centerOf(A, res.pos).x) ok++;
    }
    expect(ok / edges.length).toBeGreaterThanOrEqual(0.8);
  });

  it('viewport 接口：视口内的节点照全量施力，视口外节点保持种子位；两次调用仍确定', () => {
    const { boxes, edges } = fixtureChain(20);
    const vp = { x: -400, y: -400, w: 700, h: 700 };
    const a = layoutTree(boxes, edges, { viewport: vp });
    const b = layoutTree(boxes, edges, { viewport: vp });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expectAllFinite(boxes, a.pos);

    const full = layoutTree(boxes, edges);
    // 确实按视口裁了（未参与节点留在种子位 → 与全量不同）
    expect(JSON.stringify(a.pos)).not.toBe(JSON.stringify(full.pos));
    // 但世界尺寸仍覆盖全部节点（含 PAD），未被裁掉的节点也在 pos 里
    expect(overlapPairs(boxes, full.pos)).toEqual([]);
    for (const bx of boxes) {
      expect(a.pos[bx.id].x).toBeGreaterThanOrEqual(LAYOUT_PARAMS.PAD - 1e-6);
      expect(a.pos[bx.id].y).toBeGreaterThanOrEqual(LAYOUT_PARAMS.PAD - 1e-6);
      expect(a.pos[bx.id].x + bx.w).toBeLessThanOrEqual(a.world.w - LAYOUT_PARAMS.PAD + 1e-6);
      expect(a.pos[bx.id].y + bx.h).toBeLessThanOrEqual(a.world.h - LAYOUT_PARAMS.PAD + 1e-6);
    }
  });

  it('viewport 覆盖全部节点时与不传 viewport 等价', () => {
    const { boxes, edges } = fixtureMultiLayer();
    const all = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 };
    const a = layoutTree(boxes, edges, { viewport: all });
    const b = layoutTree(boxes, edges);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
