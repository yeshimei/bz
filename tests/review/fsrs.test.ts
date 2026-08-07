/**
 * 复习计划 FSRS 测试（ticket 16）：R/initS/nextDiff/nextStab/nextInterval 数值断言
 */
import { describe, it, expect } from 'vitest';
import { FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, TOTAL_STAGES, LADDER_MAX } from '../../src/review/fsrs';

const fsrs = new FSRS();

describe('FSRS.R', () => {
  it('R(1,1)=0.5104 / R(7,1)=0.1416 / R(30,1)=0.0415', () => {
    expect(fsrs.R(1, 1)).toBeCloseTo(0.5104344967050664, 10);
    expect(fsrs.R(7, 1)).toBeCloseTo(0.14156434254519065, 10);
    expect(fsrs.R(30, 1)).toBeCloseTo(0.04148161219364989, 10);
  });
});

describe('FSRS.initS', () => {
  it('四档初始稳定性', () => {
    expect(fsrs.initS('again')).toBe(0.4);
    expect(fsrs.initS('hard')).toBe(0.6);
    expect(fsrs.initS('good')).toBe(2.4);
    expect(fsrs.initS('easy')).toBe(5.8);
  });
});

describe('FSRS.nextDiff', () => {
  it('again→4.93；hard→+0.94；easy→+0.86；good 不变；clamp [0,1]', () => {
    expect(fsrs.nextDiff(0.3, 'again')).toBe(1); // w[4]=4.93 被 clamp 到 [0,1]
    expect(fsrs.nextDiff(0.3, 'hard')).toBe(1); // 1.24 clamp 到 1
    expect(fsrs.nextDiff(0.3, 'easy')).toBe(1); // 1.16 clamp 到 1
    expect(fsrs.nextDiff(0.3, 'good')).toBe(0.3);
    expect(fsrs.nextDiff(0.9, 'easy')).toBe(1); // clamp
    expect(fsrs.nextDiff(0.1, 'hard')).toBe(1); // 1.04 clamp 到 1
  });
});

describe('FSRS.nextInterval', () => {
  it('S=0.4, D=0.3, R=R(30,0.4) 四档', () => {
    const R = fsrs.R(30, 0.4);
    const again = fsrs.nextInterval(0.4, 0.3, 'again', R);
    expect(again.S).toBeCloseTo(0.0707, 2);
    expect(again.D).toBe(1);
    const hard = fsrs.nextInterval(0.4, 0.3, 'hard', R);
    expect(hard.S).toBeCloseTo(49.32, 1);
    const good = fsrs.nextInterval(0.4, 0.3, 'good', R);
    expect(good.S).toBeCloseTo(53.17, 1);
    expect(good.D).toBe(0.3);
    const easy = fsrs.nextInterval(0.4, 0.3, 'easy', R);
    expect(easy.S).toBeCloseTo(117.92, 1);
    expect(easy.D).toBe(1);
  });
});

describe('固定阶梯', () => {
  it('10 级数组与文案', () => {
    expect(FSRS_FIRST_INTERVALS).toEqual([1 / 1440, 1 / 48, 1 / 4, 1, 3, 7, 15, 30, 60, 120]);
    expect(FSRS_FIRST_TEXTS).toEqual(['1m', '30m', '6h', '1d', '3d', '7d', '15d', '30d', '60d', '120d']);
    expect(TOTAL_STAGES).toBe(10);
    expect(LADDER_MAX).toBe(9);
  });
});
