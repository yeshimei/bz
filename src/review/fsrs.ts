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
