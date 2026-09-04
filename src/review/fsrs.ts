/**
 * 复习计划 FSRS 幂律模型（ticket 16，源码 L11-64 逐字移植）
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** 19 个默认参数（FSRS v4；导出供拟合优化器初始化/回退，ADR-0077） */
export const DEFAULT_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 1.26, 0.07, 0.35, 2.06, 0.57, 0.09, 0.05, 0.33, 2.15];
export const DEFAULT_D = 0.9;

export class FSRS {
  w: number[];
  d: number;

  constructor(w: number[] = DEFAULT_W, d: number = DEFAULT_D) {
    this.w = w;
    this.d = d;
  }

  /** 记忆保留度：R(t, S) = (1 + t/(S·d))^-d */
  R(t: number, S: number): number {
    return Math.pow(1 + t / (S * this.d), -this.d);
  }

  /** 初始稳定性 */
  initS(rating: Rating): number {
    const map: Record<Rating, number> = { again: 0, hard: 1, good: 2, easy: 3 };
    return this.w[map[rating]] || 1;
  }

  /** 下一难度 */
  nextDiff(D: number, rating: Rating): number {
    let newD: number;
    if (rating === 'again') newD = this.w[4]; // 4.93
    else if (rating === 'hard') newD = D + this.w[5]; // +0.94
    else if (rating === 'easy') newD = D + this.w[6]; // +0.86
    else newD = D; // good 不变
    return Math.max(0, Math.min(1, newD));
  }

  /** 下一稳定性 */
  nextStab(S: number, D: number, rating: Rating, R: number): number {
    if (rating === 'again') {
      return this.w[11] * Math.pow(D, -this.w[12]) * (Math.pow(S + 1, this.w[13]) - 1) * Math.exp(this.w[14] * R);
    }
    const base = Math.exp(this.w[8]) * (11 - D) * Math.pow(S, -this.w[9]) * (Math.exp(this.w[10] * (1 - R)) - 1);
    if (rating === 'hard') return S * base;
    if (rating === 'good') return S * (base + 1);
    return S * base * (Math.exp(this.w[17]) + 1); // easy
  }

  /** 下一间隔（天） */
  nextInterval(S: number, D: number, rating: Rating, R: number): { S: number; D: number; days: number } {
    const newD = this.nextDiff(D, rating);
    const newS = Math.max(0.01, this.nextStab(S, newD, rating, R));
    return { S: newS, D: newD, days: newS };
  }
}

export const FSRS_FIRST_INTERVALS = [1 / 1440, 1 / 48, 1 / 4, 1, 3, 7, 15, 30, 60, 120]; // 天
export const FSRS_FIRST_TEXTS = ['1m', '30m', '6h', '1d', '3d', '7d', '15d', '30d', '60d', '120d'];
export const TOTAL_STAGES = 10;
export const LADDER_MAX = 9; // stage≥9 进入 fsrs 阶段

// ==================== 调度纯函数（ladder→fsrs 两阶段；markReview 落盘依据） ====================

/** 调度输入快照（条目排期相关字段子集；对齐 ReviewItem 持久化字段） */
export interface ScheduleState {
  stage: number;
  phase: 'ladder' | 'fsrs';
  stability?: number | null;
  difficulty?: number | null;
  lastReviewed?: string | null;
  reviewStart?: string;
}

/** 调度决策（纯数据，无 IO；stability/difficulty 为 null = 阶梯阶段不写记忆参数） */
export interface ScheduleDecision {
  stage: number;
  phase: 'ladder' | 'fsrs';
  /** 写回条目的 S/D（已 round 两位；阶梯阶段 null=不动） */
  stability: number | null;
  difficulty: number | null;
  /** 本次间隔（天，未乘缩放系数） */
  intervalDays: number;
  /** 本次评级是否为阶梯→FSRS 进入点（唯一 initS 时机） */
  enteringFsrs: boolean;
  /** reviewHistory 记录的 stage（阶梯=targetStage+1；FSRS=原 stage+1） */
  historyStage: number;
  /** FSRS 相位本次 R（0-1 原始值；阶梯为 null） */
  R: number | null;
  /** 历史记录附带的 S/D（FSRS 相位；阶梯 null） */
  historyStability: number | null;
  historyDifficulty: number | null;
}

/**
 * 调度纯函数：ladder→fsrs 两阶段（满血 FSRS，2026-09 拍板）。
 * - 阶梯（phase==='ladder' 且 stage<LADDER_MAX）：固定间隔表爬级
 *   （again-1 / hard 不变 / good+1 / easy+2，clamp [0,9]）；爬到 9 = 进入 FSRS，
 *   用本次评分 initS 初始化 S/D（唯一初始化时机），间隔仍取阶梯表 [9]=120d。
 * - FSRS（phase==='fsrs'，含正好爬满 9 级的条目）：满血动态——不再固定 120 天循环、
 *   不再重置记忆参数，间隔由 S/D/评分/当前 R 经 nextInterval 动态算出，stage 不再变化。
 * 存量排期数据零迁移（只读 stage/phase/S/D/lastReviewed，不改字段结构）。
 */
export function scheduleNext(state: ScheduleState, rating: Rating, now: Date, w: number[] = DEFAULT_W): ScheduleDecision {
  const fsrs = new FSRS(w);
  if (state.phase !== 'fsrs' && state.stage < LADDER_MAX) {
    // ===== 阶梯爬级 =====
    let target: number;
    if (rating === 'again') target = Math.max(0, state.stage - 1);
    else if (rating === 'hard') target = state.stage;
    else if (rating === 'good') target = state.stage + 1;
    else target = state.stage + 2; // easy
    target = Math.max(0, Math.min(target, LADDER_MAX));
    if (target >= LADDER_MAX) {
      // 进入 FSRS：按本次评分初始化记忆参数（对齐既有语义：again→w[4]，其余 0.3）
      const S = fsrs.initS(rating);
      const D = rating === 'again' ? fsrs.w[4] : 0.3;
      const rS = Math.round(S * 100) / 100;
      const rD = Math.round(D * 100) / 100;
      return {
        stage: target,
        phase: 'fsrs',
        stability: rS,
        difficulty: rD,
        intervalDays: FSRS_FIRST_INTERVALS[target],
        enteringFsrs: true,
        historyStage: target + 1,
        R: null,
        historyStability: rS,
        historyDifficulty: rD,
      };
    }
    return {
      stage: target,
      phase: 'ladder',
      stability: null,
      difficulty: null,
      intervalDays: FSRS_FIRST_INTERVALS[target],
      enteringFsrs: false,
      historyStage: target + 1,
      R: null,
      historyStability: null,
      historyDifficulty: null,
    };
  }
  // ===== 满血 FSRS（phase==='fsrs'，含正好 9 级） =====
  const S = state.stability || 1;
  const D = state.difficulty || 0.3;
  const last = state.lastReviewed || state.reviewStart;
  const t = last ? (now.getTime() - new Date(last).getTime()) / 86400000 : 0;
  const R = fsrs.R(t, S);
  const result = fsrs.nextInterval(S, D, rating, R);
  return {
    stage: state.stage,
    phase: 'fsrs',
    stability: Math.round(result.S * 100) / 100,
    difficulty: Math.round(result.D * 100) / 100,
    intervalDays: result.days,
    enteringFsrs: false,
    historyStage: state.stage + 1,
    R,
    historyStability: Math.round(result.S * 100) / 100,
    historyDifficulty: Math.round(result.D * 100) / 100,
  };
}
