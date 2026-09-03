/**
 * FSRS 参数自研拟合优化器（ADR-0077，ticket 174）
 *
 * 现状：fsrs.ts 的 19 权重 DEFAULT_W 写死，从不按个人复习历史学习。
 * 目标：根据 reviewHistory（每条含 timestamp/stage/rating/stability/R）优化权重，
 *      得到个人化记忆曲线。
 *
 * 调研结论（子代理 2026-09-03）：npm 无纯 TS 现成优化器；官方 WASM 包对应 FSRS-5/6 非本插件 v4，
 * 且有 Electron/WASI 集成风险 → 自研纯 JS 优化器（前向传播 + 对数似然 + Adam）。
 * 首版只拟合 w[0..7] 子集（初始稳定性/难度 + 遗忘幂律），跑通后再放开全 19 参数。
 *
 * 样本门槛：≥300 条全参、100~300 子集、<100 跳过（ADR-0077）。
 * 数值：参数范围约束（稳定性/难度为正等）、从 DEFAULT_W 初始化、小学习率 + 退火、log-sum-exp 防溢出。
 */

import { DEFAULT_W } from './fsrs';

/** 训练样本：一次「复习 → 下次评级」的观察 */
export interface FitSample {
  /** 距上次复习的天数 t（>0） */
  t: number;
  /** 上次评级后的稳定性 S */
  S: number;
  /** 上次评级后的难度 D */
  D: number;
  /** 本次实际评级（0=again,1=hard,2=good,3=easy） */
  rating: number;
  /** 该笔记当前阶段（区分阶梯/FSRS 相位；阶梯阶段样本不参与拟合） */
  stage: number;
}

/** 拟合结果 */
export interface FitResult {
  /** 拟合后的 19 权重（首版只填前 8 个，其余为 DEFAULT_W） */
  w: number[];
  /** 对数似然（越大越好） */
  logLikelihood: number;
  /** 迭代轮数 */
  iterations: number;
}

/** 评级 → 0..3（FSRS 内部序） */
const RATING_INDEX: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 };

/** 数值稳定 sigmoid */
function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

/** 将稳定性/难度约束到合法区间 */
function clip(w: number[]): number[] {
  // w[0..3] 初始稳定性：>0.01（again 允许很小但必须正）
  // w[4..7] 遗忘幂律：w[4](again 难度) 在 [0,1]；w[5..7] 为正
  const out = [...w];
  for (let i = 0; i < 4; i++) out[i] = Math.max(0.01, out[i]);
  out[4] = Math.max(0, Math.min(1, out[4]));
  for (let i = 5; i < 8; i++) out[i] = Math.max(0.01, out[i]);
  return out;
}

/**
 * 前向：给定权重 w 与样本，计算「本次评级」的对数似然。
 *
 * 语义：样本记录了上次评级后的 (S, D)，距离 t 天后本次评级为 r。
 * 我们假设「记忆保留度」R = (1 + t/(S·d))^(-d)，遗忘概率 = 1 - R，
 * 评级 good/easy 概率 ∝ R、again/hard 概率 ∝ 1-R，用 softmax 归一化成 4 类概率。
 *
 * 简化近似（首版）：只建模「是否记得住」的二分类——P(remember) = R，
 * rating∈{good,easy} 视为记住，{again,hard} 视为遗忘。对数似然 = 记住则 log R，遗忘则 log(1-R)。
 * 这样梯度解析可算、数值稳定，且抓住核心信号（间隔缩放 vs 遗忘率）。
 */
export function computeSampleLogLikelihood(w: number[], sample: FitSample): number {
  // d（遗忘幂律指数）来自 w[7]（对齐 fsrs.ts 的 d 参数语义：R=(1+t/(S·d))^(-d)）
  const d = w[7] ?? DEFAULT_W[7];
  const S = sample.S;
  const t = sample.t;
  // 记忆保留度（同 fsrs.ts R 公式，d 取 w[7]）
  const denom = Math.max(0.01, S * d);
  const R = Math.pow(1 + t / denom, -d);
  const remember = sample.rating === 2 || sample.rating === 3; // good/easy
  // 数值稳定 log
  const p = remember ? R : 1 - R;
  return Math.log(Math.max(1e-9, Math.min(1 - 1e-9, p)));
}

/** 样本 → 是否需要拟合（仅 FSRS 相位 stage>=10 的样本，阶梯阶段固定表不参与） */
export function isFittableSample(sample: FitSample): boolean {
  return sample.stage >= 9; // LADDER_MAX=9：stage 9 已进入 fsrs 相位（对齐 fsrs.ts LADDER_MAX）
}

/**
 * 从 reviewHistory 构造训练样本。
 * reviewHistory 每条：{ timestamp, stage, rating, stability?, R? }（FSRS 相位记录含 stability/R）。
 * 逐条配对：上一条的 (stability, difficulty) 作为 S/D，本条 timestamp - 上条 timestamp = t，本条 rating 为标签。
 */
export function buildFitSamples(
  history: Array<{ timestamp: string; stage: number; rating: string; stability?: number; difficulty?: number }>,
  opts?: { /** 上一条缺 difficulty 时回退条目级 item.difficulty（生产旧数据 history 无 difficulty） */
    fallbackDifficulty?: number }
): FitSample[] {
  const out: FitSample[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const cur = history[i];
    // 需要上一条的 stability（FSRS 相位才记录）；difficulty 缺失回退条目级值
    if (prev.stability === undefined) continue;
    const prevD = prev.difficulty !== undefined ? prev.difficulty : opts?.fallbackDifficulty;
    if (prevD === undefined) continue;
    const t = (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 86400000;
    if (!(t > 0)) continue;
    const ratingIdx = RATING_INDEX[cur.rating];
    if (ratingIdx === undefined) continue;
    out.push({
      t,
      S: prev.stability,
      D: prevD,
      rating: ratingIdx,
      stage: cur.stage,
    });
  }
  return out;
}

/**
 * 对数似然总和（用于拟合目标与评估）。
 * @param w 权重（长度 ≥8；只读前 8 个参与拟合，其余不参与梯度）
 * @param samples 训练样本
 */
export function totalLogLikelihood(w: number[], samples: FitSample[]): number {
  let sum = 0;
  for (const s of samples) {
    if (!isFittableSample(s)) continue;
    sum += computeSampleLogLikelihood(w, s);
  }
  return sum;
}

/** 数值梯度（中心差分；对 w[0..7] 求导） */
export function numericGradient(w: number[], samples: FitSample[], eps = 1e-5): number[] {
  const grad = new Array(w.length).fill(0);
  const base = totalLogLikelihood(w, samples);
  for (let i = 0; i < Math.min(8, w.length); i++) {
    const wp = [...w];
    const wm = [...w];
    wp[i] += eps;
    wm[i] -= eps;
    const fp = totalLogLikelihood(wp, samples);
    const fm = totalLogLikelihood(wm, samples);
    grad[i] = (fp - fm) / (2 * eps);
  }
  return grad;
}

/**
 * Adam 梯度上升（最大化对数似然）。
 * 首版用数值梯度 + Adam（实现简单、数值稳），跑通后可换解析梯度加速。
 */
export function fitFSRSParams(
  samples: FitSample[],
  opts: {
    initW?: number[];
    iterations?: number;
    lr?: number;
    /** 是否全参拟合（默认 false=只 w[0..7] 子集） */
    full?: boolean;
  } = {}
): FitResult {
  const initW = opts.initW ? [...opts.initW] : [...DEFAULT_W];
  const iterations = opts.iterations ?? 150;
  const lr = opts.lr ?? 0.02;
  const full = opts.full ?? false;

  // 只拟合子集：w[0..7]；full=true 时拟合前 8 个（首版全参也先只到 8，留 19 后续）
  const fitLen = full ? Math.min(19, initW.length) : Math.min(8, initW.length);
  const w = clip(initW);

  // Adam 状态
  const m = new Array(w.length).fill(0);
  const v = new Array(w.length).fill(0);
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;

  let lastLL = totalLogLikelihood(w, samples);
  let bestW = [...w];
  let bestLL = lastLL;
  let stall = 0;

  for (let it = 1; it <= iterations; it++) {
    // 学习率退火：线性衰减到 1/4
    const lrIt = lr * (1 - 0.75 * (it / iterations));
    const grad = numericGradient(w, samples);

    for (let i = 0; i < fitLen; i++) {
      m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
      v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
      const mHat = m[i] / (1 - Math.pow(beta1, it));
      const vHat = v[i] / (1 - Math.pow(beta2, it));
      w[i] += lrIt * mHat / (Math.sqrt(vHat) + eps);
    }

    // 约束
    for (let i = 0; i < fitLen; i++) {
      if (i < 4) w[i] = Math.max(0.01, w[i]);
      else if (i === 4) w[i] = Math.max(0, Math.min(1, w[i]));
      else w[i] = Math.max(0.01, w[i]);
    }

    const ll = totalLogLikelihood(w, samples);
    if (ll > bestLL) {
      bestLL = ll;
      bestW = [...w];
    }
    // 早停：改进 < 1e-6 连续 10 轮
    if (Math.abs(ll - lastLL) < 1e-6) {
      stall++;
      if (stall >= 10) break;
    } else stall = 0;
    lastLL = ll;
  }

  return { w: clip(bestW), logLikelihood: bestLL, iterations };
}

/**
 * 拟合入口：从 reviewItems 的 reviewHistory 构造样本 → 判断门槛 → 拟合。
 * 返回 null 表示样本不足/无可拟合样本（调用方回退默认参数）。
 */
export function fitFromItems(
  items: Array<{
    difficulty?: number;
    reviewHistory?: Array<{ timestamp: string; stage: number; rating: string; stability?: number; difficulty?: number }>;
  }>,
  opts?: { full?: boolean }
): { fit: FitResult; count: number } | null {
  // 按条目分别构样再拍平：配对不跨条目（不同笔记的历史串联会产生假样本）；
  // 上一条缺 difficulty 时回退条目级 item.difficulty（生产旧数据 history 无 difficulty）
  const samples = items.flatMap((i) => buildFitSamples((i.reviewHistory || []) as any, { fallbackDifficulty: i.difficulty }));
  const fittable = samples.filter(isFittableSample);
  const count = fittable.length;
  // 样本门槛（ADR-0077）：≥300 全参、100~300 子集、<100 跳过
  if (count < 100) return null;
  const full = opts?.full ?? count >= 300;
  return { fit: fitFSRSParams(samples, { full }), count };
}

/** 将拟合权重与默认权重合并为完整 19 权重（子集只覆盖前 8，其余取默认） */
export function mergeFittedW(fitted: number[]): number[] {
  const out = [...DEFAULT_W];
  for (let i = 0; i < Math.min(19, fitted.length); i++) out[i] = fitted[i];
  return out;
}
