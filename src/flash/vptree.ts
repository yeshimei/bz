/**
 * 闪念 VP-Tree 纯函数（ticket 18，源码 L172-230 语义移植）
 */
export function euclideanSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

export function normalizeVec(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

export interface VPNode {
  idx: number;
  threshold: number;
  left: VPNode | null;
  right: VPNode | null;
}

export function vptree_build(items: number[][], idxs: number[]): VPNode | null {
  if (idxs.length === 0) return null;
  const pivot = idxs[0];
  if (idxs.length === 1) return { idx: pivot, threshold: 0, left: null, right: null };

  const rest = idxs.slice(1);
  // 按到 pivot 距离排序后分半（阈值 = 中位距离）
  const withDist = rest
    .map((i) => ({ i, d: euclideanSq(items[pivot], items[i]) }))
    .sort((a, b) => a.d - b.d);
  const mid = Math.floor(withDist.length / 2);
  const threshold = withDist[mid].d;

  return {
    idx: pivot,
    threshold,
    left: vptree_build(items, withDist.slice(0, mid).map((x) => x.i)),
    right: vptree_build(items, withDist.slice(mid).map((x) => x.i)),
  };
}

export function vptree_search(
  node: VPNode | null,
  items: number[][],
  query: number[],
  k: number,
  results: { idx: number; dist: number }[] = []
): { idx: number; dist: number }[] {
  if (!node) return results;
  const d = euclideanSq(items[node.idx], query);
  results.push({ idx: node.idx, dist: d });
  results.sort((a, b) => a.dist - b.dist);
  if (results.length > k) results.length = k;

  const tau = results.length >= k ? results[results.length - 1].dist : Infinity;
  if (node.left && d - tau <= node.threshold) {
    vptree_search(node.left, items, query, k, results);
  }
  if (node.right && d + tau >= node.threshold) {
    vptree_search(node.right, items, query, k, results);
  }
  return results;
}
