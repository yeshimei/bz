/**
 * 第二大脑向量数学（issue 425/ADR-0185；自 vptree.ts 拆出，只留检索真正用得上的两条）
 *
 * ADR-0185 起检索层为「归一化 + 暴力全扫余弦」：向量库规模（数千 chunk × 数千维）下全扫
 * 单查询约数十毫秒，结果精确；VP-Tree 已退役（近似召回会丢真实最近邻，且其距离语义
 * cos = 1 − d²/2 只对单位向量成立——零向量经此反推出的假高分正是 issue 425 的病根）。
 */
/** 向量统一类型：number[] 或 Float32Array（索引按位置读取，二者等价） */
export type Vec = number[] | Float32Array;

/**
 * L2 归一化（返回新 number[]，不原地改写入参）。
 * 退化输入（零向量 / 非有限分量）返回等长零向量——调用方经 isValidVector 校验后本不该走到这里，
 * 兜底不返回 NaN 分量，避免脏值静默扩散进点积。
 */
export function normalizeVec(v: Vec): number[] {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v as number[])[i] * (v as number[])[i];
  norm = Math.sqrt(norm);
  if (!Number.isFinite(norm) || norm === 0) return new Array<number>(v.length).fill(0);
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v as number[])[i] / norm;
  return out;
}

/**
 * 向量可用性：非空、全部分量有限、模 > 0。
 * 零向量（含全 NaN 向量）与任何单位向量夹角不定——旧实现把它当「距离 1.0」反推成 0.5 分，
 * 于是每个查询都能搜到它且分数恒定（issue 425）。入库与检索两侧都以此为准绳。
 */
export function isValidVector(v: unknown): v is Vec {
  if (!v || typeof v !== 'object') return false;
  const len = (v as Vec).length;
  if (typeof len !== 'number' || len === 0) return false;
  let norm = 0;
  for (let i = 0; i < len; i++) {
    const x = (v as number[])[i];
    if (typeof x !== 'number' || !Number.isFinite(x)) return false;
    norm += x * x;
  }
  return Number.isFinite(norm) && norm > 0;
}
