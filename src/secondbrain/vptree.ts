/**
 * 第二大脑 VP-Tree 纯函数（ticket 103；逐字对齐 QA 闪念.js L172-230）
 * - 节点存 mu/minD/maxD 三参包络剪枝（bz 旧版单 threshold 不对称剪枝已废弃）；
 * - vp 取 `idxList[depth % len]`（旧版恒取首位）；
 * - 搜索走 best-k + tau 全局阈值，先近侧后远侧（远侧需 diff ∈ [minD-tau, maxD+tau]）。
 */
/** 向量统一类型：number[] 或 Float32Array（索引按位置读取，二者等价） */
export type Vec = number[] | Float32Array;

export function euclideanSq(a: Vec, b: Vec): number {
  let sum = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    const d = (a as number[])[i] - (b as number[])[i];
    sum += d * d;
  }
  return sum;
}

/** 归一化（返回新 number[]，不原地改写入参——调用方语义与 QA 等价） */
export function normalizeVec(v: Vec): number[] {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v as number[])[i] * (v as number[])[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(v);
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v as number[])[i] / norm;
  return out;
}

export interface VPNode {
  idx: number;
  mu: number;
  minD: number;
  maxD: number;
  left: VPNode | null;
  right: VPNode | null;
}

export function vptree_build(items: Vec[], idxs: number[]): VPNode | null {
  if (idxs.length === 0) return null;
  return buildRecursive(idxs, 0);

  function buildRecursive(idxList: number[], depth: number): VPNode | null {
    if (idxList.length === 0) return null;
    if (idxList.length === 1) {
      return { idx: idxList[0], mu: 0, minD: 0, maxD: 0, left: null, right: null };
    }
    const vpIdx = idxList[depth % idxList.length];
    const vp = items[vpIdx];
    const dists = idxList
      .map((i) => ({ i, d: euclideanSq(items[i] as Vec, vp) }))
      .sort((a, b) => a.d - b.d);
    const mid = dists.length >> 1;
    return {
      idx: vpIdx,
      mu: dists[mid].d,
      minD: dists[0].d,
      maxD: dists[dists.length - 1].d,
      left: buildRecursive(
        dists.slice(0, mid).map((x) => x.i),
        depth + 1
      ),
      right: buildRecursive(
        dists.slice(mid).map((x) => x.i),
        depth + 1
      ),
    };
  }
}

export function vptree_search(node: VPNode | null, items: Vec[], query: Vec, k: number): { idx: number; dist: number }[] {
  let best: { idx: number; dist: number }[] = [];
  let tau = Infinity;

  (function searchNode(n: VPNode | null) {
    if (!n) return;
    const d = euclideanSq(query, items[n.idx]);
    if (d < tau) {
      best.push({ idx: n.idx, dist: d });
      if (best.length > k) {
        best.sort((a, b) => a.dist - b.dist);
        best.pop();
        tau = best[best.length - 1].dist;
      }
    }
    const diff = d - n.mu;
    const first = diff < 0 ? n.left : n.right;
    const second = diff < 0 ? n.right : n.left;
    searchNode(first);
    if (second && n.minD - tau <= diff && diff <= n.maxD + tau) {
      searchNode(second);
    }
  })(node);

  return best.sort((a, b) => a.dist - b.dist);
}
