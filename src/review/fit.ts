/**
 * FSRS 参数自研拟合优化器（ADR-0077，ticket 174；issue 361 放开全 19 参数）
 *
 * 调研结论（子代理 2026-09-03）：npm 无纯 TS 现成优化器；官方 WASM 包对应 FSRS-5/6 非本插件 v4，
 * 且有 Electron/WASI 集成风险 → 自研纯 JS 优化器（回放前向传播 + 对数似然 + Adam）。
 *
 * issue 361（2026-09）：目标函数重写为「整条历史回放」——以候选权重 w 从条目首次进入 FSRS 起
 * 前向推演（initS → R → nextInterval），对每次实际评级记二分类对数似然
 * （good/easy=记住 ∝ R，again/hard=遗忘 ∝ 1-R）。旧实现（逐对样本 + 录得的 S/D）的似然与 w
 * 无关、梯度恒零（拟合空转回默认），回放式让全部权重真正进入目标：
 *   - 基础档（100~299 条）：拟合 w[0..7] 八参（w[7] 在本插件 v4 模型中不进似然公式，梯度恒零保持初值）
 *   - 全参档（≥300 条）：拟合全部 19 维（w[7]/w[15]/w[16]/w[18] 为 v4 模型未用参数，自动保持初值）
 *
 * 防不收敛拖死（拟合在评级路径 fire-and-forget 后台跑，但仍是主线程同步 CPU）：
 * 迭代上限 + 停滞早停 + 墙钟时限三重护栏。
 *
 * 样本门槛（ADR-0077）：≥300 条全参、100~300 基础八参、<100 跳过。
 * 数值：逐参数合法区间约束、从 DEFAULT_W 初始化、小学习率 + 退火、log 截断防溢出。
 */

import { DEFAULT_W, FSRS, type Rating } from './fsrs';

/** 评级序（FSRS 内部 0..3）↔ 名称（与 fsrs.ts Rating 同源） */
const RATING_NAMES: Rating[] = ['again', 'hard', 'good', 'easy'];
const RATING_INDEX: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 };

/** 回放序列：单个条目 FSRS 相位的复习观察（时间升序） */
export interface ReplaySeries {
  /** 首次进入 FSRS 的评级（0..3）——回放起点（对齐 scheduleNext enteringFsrs 的 initS/initD） */
  initRating: number;
  /** 相邻复习对（前一条 → 本条）：t=间隔天数（>0），rating=本条评级（0..3） */
  pairs: Array<{ t: number; rating: number }>;
}

/**
 * 单条目 reviewHistory → 回放序列；无可回放对（FSRS 相位不足 2 条）返回 null。
 * 只取 FSRS 相位记录：scheduleNext 仅 FSRS 相位（含进入点）写 stability，阶梯阶段固定表
 * 不参与拟合——history.stability 存在即 FSRS 相位标记（旧数据只含 stability 无 difficulty 亦可，
 * 回放从权重重建 S/D，不读录得值）。相邻配对 t<=0 剔除（零间隔重复复习不带信息）。
 */
export function buildReplaySeries(
  history: Array<{ timestamp: string; stage?: number; rating: string; stability?: number }>
): ReplaySeries | null {
  const fsrsEntries = history.filter((h) => h.stability !== undefined);
  if (fsrsEntries.length < 2) return null;
  const initRating = RATING_INDEX[fsrsEntries[0].rating];
  if (initRating === undefined) return null;
  const pairs: Array<{ t: number; rating: number }> = [];
  for (let i = 1; i < fsrsEntries.length; i++) {
    const t = (new Date(fsrsEntries[i].timestamp).getTime() - new Date(fsrsEntries[i - 1].timestamp).getTime()) / 86400000;
    if (!(t > 0)) continue;
    const rating = RATING_INDEX[fsrsEntries[i].rating];
    if (rating === undefined) continue;
    pairs.push({ t, rating });
  }
  if (!pairs.length) return null;
  return { initRating, pairs };
}

/** 全条目 → 回放序列列表（配对不跨条目：不同笔记的历史串联会产生假样本） */
export function buildReplaySeriesFromItems(
  items: Array<{ reviewHistory?: Array<{ timestamp: string; stage?: number; rating: string; stability?: number }> }>
): ReplaySeries[] {
  const out: ReplaySeries[] = [];
  for (const it of items) {
    const s = buildReplaySeries(it.reviewHistory || []);
    if (s) out.push(s);
  }
  return out;
}

/**
 * 回放对数似然：给定候选权重，逐条目前向推演并累计「实际评级」的对数似然。
 *  - 起点对齐 scheduleNext enteringFsrs：S0 = initS(initRating)，D0 = again→w[4] / 其余 0.3；
 *  - 每对：R = R(t,S)（遗忘幂律指数 d 固定 DEFAULT_D，与调度同源），good/easy 记 log R、
 *    again/hard 记 log(1-R)；
 *  - 状态推进 nextInterval（nextDiff/nextStab 全走 FSRS 类公式——拟合与调度逐式同源，
 *    拟合出的权重即刻就是调度用的那张记忆曲线）。
 */
export function replayLogLikelihood(w: number[], series: ReplaySeries[]): number {
  const fsrs = new FSRS(w);
  let sum = 0;
  for (const s of series) {
    let S = fsrs.initS(RATING_NAMES[s.initRating]);
    let D = s.initRating === 0 ? fsrs.w[4] : 0.3;
    for (const p of s.pairs) {
      const R = fsrs.R(p.t, S);
      const remember = p.rating >= 2; // good/easy=记住，again/hard=遗忘
      const prob = remember ? R : 1 - R;
      sum += Math.log(Math.max(1e-9, Math.min(1 - 1e-9, prob)));
      const next = fsrs.nextInterval(S, D, RATING_NAMES[p.rating], R);
      S = next.S;
      D = next.D;
    }
  }
  return sum;
}

/** 19 权重合法区间（全参放开后逐参数约束，防 19 维跑飞产出 NaN/无穷记忆曲线；区间恒含 DEFAULT_W 除 w[4] 既有 [0,1] 口径） */
const W_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0.01, 60], // w0  初始稳定性 again
  [0.01, 120], // w1  hard
  [0.01, 240], // w2  good
  [0.01, 480], // w3  easy
  [0, 1], // w4  again 难度（本插件口径）
  [-1.5, 1.5], // w5  hard 难度增量
  [-1.5, 1.5], // w6  easy 难度增量
  [0.01, 10], // w7  （v4 模型未用，兜底约束）
  [0.01, 10], // w8  成功演化 exp 系数
  [0.01, 5], // w9  S 幂
  [0.01, 10], // w10 (1-R) 系数
  [0.01, 10], // w11 again 演化系数
  [0.01, 5], // w12 D 幂
  [0.01, 5], // w13 (S+1) 幂
  [-5, 5], // w14 R 系数
  [0.01, 10], // w15 （v4 模型未用）
  [0.01, 10], // w16 （v4 模型未用）
  [-5, 5], // w17 easy 奖励系数
  [0.01, 10], // w18 （v4 模型未用）
];

/** 将权重约束到合法区间（就地语义的纯拷贝版） */
function clipW(w: number[]): number[] {
  return w.map((x, i) => {
    const b = W_BOUNDS[i];
    return b ? Math.max(b[0], Math.min(b[1], x)) : x;
  });
}

/** 拟合结果 */
export interface FitResult {
  /** 拟合后的 19 权重（基础档只动 w[0..7]，全参档全部可动；模型未用参数保持初值） */
  w: number[];
  /** 对数似然（越大越好） */
  logLikelihood: number;
  /** 实际迭代轮数（早停/时限截断后小于上限） */
  iterations: number;
  /** 拟合档位：true=全参（≥300 条），false=基础八参（100~299 条）——issue 361 */
  full: boolean;
}

/** 数值梯度（中心差分，对前 fitLen 维求导；模型未用参数梯度恒零，Adam 更新量为零自动保持初值） */
export function numericGradient(w: number[], series: ReplaySeries[], fitLen = 8, eps = 1e-5): number[] {
  const grad = new Array(w.length).fill(0);
  const wp = [...w];
  const wm = [...w];
  for (let i = 0; i < Math.min(fitLen, w.length); i++) {
    wp[i] = w[i] + eps;
    wm[i] = w[i] - eps;
    grad[i] = (replayLogLikelihood(wp, series) - replayLogLikelihood(wm, series)) / (2 * eps);
    wp[i] = w[i];
    wm[i] = w[i];
  }
  return grad;
}

/**
 * Adam 梯度上升（最大化回放对数似然）。
 * 护栏：iterations 迭代上限 + stallRounds 停滞早停（改进 <1e-6 连续 N 轮）+ maxMs 墙钟时限
 * （issue 361：19 维数值梯度的评估量是八参的 ~2.7 倍，三重护栏防大历史用户不收敛拖死后台拟合）。
 */
export function fitFSRSParams(
  series: ReplaySeries[],
  opts: {
    initW?: number[];
    /** 迭代上限（默认：全参 120 / 基础 80） */
    iterations?: number;
    /** Adam 学习率（默认 0.05） */
    lr?: number;
    /** 是否全参拟合（默认 false=基础八参 w[0..7]） */
    full?: boolean;
    /** 墙钟时限 ms（默认 3000） */
    maxMs?: number;
    /** 停滞早停轮数（默认 10） */
    stallRounds?: number;
  } = {}
): FitResult {
  const initW = opts.initW ? [...opts.initW] : [...DEFAULT_W];
  const iterations = Math.max(1, opts.iterations ?? (opts.full ? 120 : 80));
  const lr = opts.lr ?? 0.05;
  const full = opts.full ?? false;
  const maxMs = Math.max(0, opts.maxMs ?? 3000);
  const stallRounds = Math.max(1, opts.stallRounds ?? 10);

  const fitLen = full ? Math.min(19, initW.length) : Math.min(8, initW.length);
  const w = clipW(initW);

  // Adam 状态
  const m = new Array(w.length).fill(0);
  const v = new Array(w.length).fill(0);
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;

  const t0 = Date.now();
  let lastLL = replayLogLikelihood(w, series);
  let bestW = [...w];
  let bestLL = lastLL;
  let stall = 0;
  let done = 0;

  for (let it = 1; it <= iterations; it++) {
    done = it;
    // 学习率退火：线性衰减到 1/4
    const lrIt = lr * (1 - 0.75 * (it / iterations));
    const grad = numericGradient(w, series, fitLen);

    for (let i = 0; i < fitLen; i++) {
      m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
      v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
      const mHat = m[i] / (1 - Math.pow(beta1, it));
      const vHat = v[i] / (1 - Math.pow(beta2, it));
      w[i] += lrIt * mHat / (Math.sqrt(vHat) + eps);
    }

    // 约束（就地逐维收敛到合法区间）
    for (let i = 0; i < fitLen; i++) {
      const b = W_BOUNDS[i];
      if (b) w[i] = Math.max(b[0], Math.min(b[1], w[i]));
    }

    const ll = replayLogLikelihood(w, series);
    if (ll > bestLL) {
      bestLL = ll;
      bestW = [...w];
    }
    // 早停：改进 < 1e-6 连续 stallRounds 轮
    if (Math.abs(ll - lastLL) < 1e-6) {
      stall++;
      if (stall >= stallRounds) break;
    } else stall = 0;
    lastLL = ll;
    // 墙钟护栏：不收敛也不拖死后台（同步 CPU 在主线程）
    if (maxMs > 0 && Date.now() - t0 > maxMs) break;
  }

  return { w: clipW(bestW), logLikelihood: bestLL, iterations: done, full };
}

/**
 * 拟合入口：从 reviewItems 的 reviewHistory 构造回放序列 → 判断门槛 → 分档拟合。
 * 返回 null 表示样本不足/无可回放序列（调用方回退默认参数）。
 */
export function fitFromItems(
  items: Array<{ reviewHistory?: Array<{ timestamp: string; stage?: number; rating: string; stability?: number }> }>,
  opts?: { full?: boolean }
): { fit: FitResult; count: number } | null {
  const series = buildReplaySeriesFromItems(items);
  const count = series.reduce((n, s) => n + s.pairs.length, 0);
  // 样本门槛（ADR-0077）：≥300 全参、100~300 基础八参、<100 跳过
  if (count < 100) return null;
  const full = opts?.full ?? count >= 300;
  return { fit: fitFSRSParams(series, { full }), count };
}

/** 将拟合权重与默认权重合并为完整 19 权重（拟合结果本身 19 维，等长即全量覆盖） */
export function mergeFittedW(fitted: number[]): number[] {
  const out = [...DEFAULT_W];
  for (let i = 0; i < Math.min(19, fitted.length); i++) out[i] = fitted[i];
  return out;
}
