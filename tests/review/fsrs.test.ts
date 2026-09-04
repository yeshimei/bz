// @vitest-environment node
/**
 * 复习计划 FSRS 测试（ticket 16）：R/initS/nextDiff/nextStab/nextInterval 数值断言。
 * 增补（2026-09 满血 FSRS 拍板）：scheduleNext 调度纯函数——9 级前爬阶梯、9 级后动态间隔。
 */
import { describe, it, expect } from 'vitest';
import { FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, TOTAL_STAGES, LADDER_MAX, DEFAULT_W, scheduleNext } from '../../src/review/fsrs';

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

// ==================== scheduleNext 调度纯函数（满血 FSRS 回归） ====================

const NOW = new Date('2026-09-04T10:00:00');

describe('scheduleNext 阶梯爬级（9 级前）', () => {
  const ladder = (stage: number) => ({ stage, phase: 'ladder' as const, stability: 1, difficulty: 0.3 });

  it('again-1 / hard 不变 / good+1 / easy+2；间隔取阶梯表', () => {
    expect(scheduleNext(ladder(3), 'again', NOW)).toMatchObject({ stage: 2, phase: 'ladder', enteringFsrs: false });
    expect(scheduleNext(ladder(3), 'hard', NOW).stage).toBe(3);
    expect(scheduleNext(ladder(3), 'good', NOW).stage).toBe(4);
    expect(scheduleNext(ladder(3), 'easy', NOW).stage).toBe(5);
    // 间隔 = 阶梯表 [stage]
    expect(scheduleNext(ladder(3), 'good', NOW).intervalDays).toBe(FSRS_FIRST_INTERVALS[4]);
    expect(scheduleNext(ladder(0), 'good', NOW).intervalDays).toBe(FSRS_FIRST_INTERVALS[1]);
  });

  it('clamp：stage 0 again 不下穿 0；间隔不变 S/D（null=不写记忆参数）', () => {
    const d = scheduleNext(ladder(0), 'again', NOW);
    expect(d.stage).toBe(0);
    expect(d.phase).toBe('ladder');
    expect(d.stability).toBeNull();
    expect(d.difficulty).toBeNull();
    expect(d.historyStability).toBeNull();
    expect(d.historyStage).toBe(1);
    expect(d.R).toBeNull();
  });

  it('easy 从 stage 8 → clamp 9 = 进入 FSRS：initS(good/easy 语义) + 间隔 120d（阶梯表终点）', () => {
    const d = scheduleNext(ladder(8), 'easy', NOW);
    expect(d.stage).toBe(9);
    expect(d.phase).toBe('fsrs');
    expect(d.enteringFsrs).toBe(true);
    expect(d.stability).toBe(fsrs.initS('easy')); // 5.8：唯一 initS 时机
    expect(d.intervalDays).toBe(120);
    expect(d.historyStability).toBe(5.8);
    expect(d.historyStage).toBe(10);
  });

  it('good 从 stage 8 → 9 进入 FSRS：S=initS(good)=2.4', () => {
    const d = scheduleNext(ladder(8), 'good', NOW);
    expect(d.enteringFsrs).toBe(true);
    expect(d.stability).toBe(2.4);
    expect(d.difficulty).toBe(0.3);
  });

  it('again 从 stage 8 → 7 仍阶梯（again 不进 FSRS）', () => {
    const d = scheduleNext(ladder(8), 'again', NOW);
    expect(d.stage).toBe(7);
    expect(d.phase).toBe('ladder');
    expect(d.enteringFsrs).toBe(false);
    expect(d.intervalDays).toBe(FSRS_FIRST_INTERVALS[7]);
  });

  it('again 进入点（理论不可达但边界完整）：D 取 w[4]', () => {
    const d = scheduleNext({ stage: 7, phase: 'ladder' }, 'easy', NOW); // 7+2=9 进入
    expect(d.enteringFsrs).toBe(true);
    expect(d.stability).toBe(fsrs.initS('easy'));
    const dAgain = scheduleNext(ladder(8), 'hard', NOW); // hard 8 → 8 不进
    expect(dAgain.enteringFsrs).toBe(false);
  });
});

describe('scheduleNext 满血 FSRS（9 级后动态）', () => {
  const fsrsState = (stage: number, stability: number, lastDaysAgo = 1) => ({
    stage,
    phase: 'fsrs' as const,
    stability,
    difficulty: 0.3,
    lastReviewed: new Date(NOW.getTime() - lastDaysAgo * 86400e3).toISOString(),
  });

  it('正好 9 级（phase=fsrs）→ 走 FSRS 动态：stage 不变、间隔 = nextInterval 非 120 固定', () => {
    const st = { ...fsrsState(9, 2.4), lastReviewed: new Date(NOW.getTime() - 3 * 86400e3).toISOString() };
    const d = scheduleNext(st, 'good', NOW);
    expect(d.stage).toBe(9); // 不再递增也不回退
    expect(d.phase).toBe('fsrs');
    expect(d.enteringFsrs).toBe(false);
    // 与 FSRS.nextInterval 同源：间隔非固定 120d 阶梯值
    const R = fsrs.R(3, 2.4);
    const expected = fsrs.nextInterval(2.4, 0.3, 'good', R);
    expect(d.intervalDays).toBeCloseTo(expected.days, 10);
    expect(d.intervalDays).not.toBe(120);
    expect(d.stability).toBe(Math.round(expected.S * 100) / 100);
    expect(d.R).toBeCloseTo(R, 10);
    expect(d.historyStage).toBe(10);
  });

  it('9 级后不再重置记忆参数：S 在原值上演化而非 initS 重置', () => {
    const st = fsrsState(9, 5.8);
    const d = scheduleNext(st, 'good', NOW);
    expect(d.stability).not.toBe(fsrs.initS('good')); // 不得重置为 2.4
    expect(d.stability!).toBeGreaterThan(5.8); // good 通过 → 稳定性上升
    // 老条目（stage 12）同口径
    const d12 = scheduleNext(fsrsState(12, 5.8), 'good', NOW);
    expect(d12.stability).toBe(d.stability);
  });

  it('超长间隔：S=500 且 R 适中（约 45 天后）→ good 间隔远超 120d 阶梯上限，不封顶', () => {
    const st = { ...fsrsState(9, 500), lastReviewed: new Date(NOW.getTime() - 45 * 86400e3).toISOString() };
    const d = scheduleNext(st, 'good', NOW);
    expect(d.intervalDays).toBeGreaterThan(120);
    expect(d.intervalDays).toBeGreaterThan(500);
  });

  it('again → 稳定性显著下降（低 S 遗忘路径动态收缩；对齐 app.test 既有口径）', () => {
    const st = { ...fsrsState(9, 0.4), lastReviewed: new Date(NOW.getTime() - 1 * 86400e3).toISOString() };
    const d = scheduleNext(st, 'again', NOW);
    expect(d.stability!).toBeLessThan(0.4);
    expect(d.intervalDays).toBeLessThan(120);
  });

  it('评分序列：进入点后 again→good 序列全程动态（无 120d 循环、无 initS 重置），good 连续上升', () => {
    let state: { stage: number; phase: 'ladder' | 'fsrs'; stability: number; difficulty: number } = { stage: 8, phase: 'ladder', stability: 1, difficulty: 0.3 };
    let cursor = NOW;
    const path: Array<{ phase: string; interval: number; stability: number | null }> = [];
    for (const rating of ['good', 'again', 'good', 'good'] as const) {
      const d = scheduleNext({ ...state, lastReviewed: state.phase === 'fsrs' ? new Date(cursor.getTime() - 5 * 86400e3).toISOString() : null }, rating, cursor);
      path.push({ phase: d.phase, interval: Math.round(d.intervalDays), stability: d.stability });
      state = { stage: d.stage, phase: d.phase, stability: d.stability ?? 1, difficulty: d.difficulty ?? 0.3 };
      cursor = new Date(cursor.getTime() + d.intervalDays * 86400e3);
    }
    // 1: 阶梯 good 8→9 进入 FSRS（120d 阶梯终点）
    expect(path[0]).toMatchObject({ phase: 'fsrs', interval: 120 });
    // 2-4: 全动态（间隔 ≠ 120），S 始终是演化值而非 initS 重置
    expect(path[1].interval).not.toBe(120);
    expect(path[1].stability).not.toBe(fsrs.initS('good'));
    expect(path[2].interval).not.toBe(120);
    expect(path[3].interval).not.toBe(120);
    expect(path[3].stability!).toBeGreaterThan(path[2].stability!); // good 连续通过 → 稳定性上升
    expect(path.slice(1).every((p) => p.phase === 'fsrs')).toBe(true);
  });

  it('拟合权重参与调度（w 参数生效：不同权重 → 不同间隔）', () => {
    const st = fsrsState(9, 5.8);
    const a = scheduleNext(st, 'good', NOW, DEFAULT_W);
    const w2 = [...DEFAULT_W];
    w2[8] = 3; // exp(w[8]) 放大 base
    const b = scheduleNext(st, 'good', NOW, w2);
    expect(b.intervalDays).toBeGreaterThan(a.intervalDays);
  });

  it('lastReviewed 缺失回退 reviewStart；两者皆缺 t=0 不抛错', () => {
    const d1 = scheduleNext({ stage: 9, phase: 'fsrs', stability: 5, reviewStart: new Date(NOW.getTime() - 86400e3).toISOString() }, 'good', NOW);
    expect(d1.R).not.toBeNull();
    const d2 = scheduleNext({ stage: 9, phase: 'fsrs', stability: 5 }, 'good', NOW);
    expect(d2.R).toBeCloseTo(fsrs.R(0, 5), 10); // t=0 → R=1
  });
});
