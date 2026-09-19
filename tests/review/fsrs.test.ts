// @vitest-environment node
/**
 * 复习计划 FSRS 测试（ticket 16）：R/initS/nextDiff/nextStab/nextInterval 数值断言。
 * 增补（2026-09 满血 FSRS 拍板）：scheduleNext 调度纯函数——9 级前爬阶梯、9 级后动态间隔。
 * 改写（2026-09 审查 F1）：D 统一 [1,10] 语义 + easy 负增量——旧「三档 clamp 后全=1」锚定退役。
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
  it('F1 [1,10] 域：again→w[4]=4.93；hard 升（+0.94）；easy 降（−0.86）；good 不变；上界钳 10', () => {
    expect(fsrs.nextDiff(4.93, 'again')).toBe(4.93); // again 恒回 w[4]（天然在界不钳）
    expect(fsrs.nextDiff(2, 'hard')).toBeCloseTo(2.94, 10);
    expect(fsrs.nextDiff(2, 'easy')).toBeCloseTo(1.14, 10);
    expect(fsrs.nextDiff(2, 'good')).toBe(2);
    expect(fsrs.nextDiff(9.9, 'hard')).toBe(10); // 上界
    expect(fsrs.nextDiff(1, 'easy')).toBe(1); // 下界钳 1
  });

  it('F1 回归：easy 降难度 / hard 升难度 / again 大幅升难度（方向与幅度，标准语义）', () => {
    const D0 = 3;
    expect(fsrs.nextDiff(D0, 'easy')).toBeLessThan(D0); // 评「简单」难度下降
    expect(fsrs.nextDiff(D0, 'hard')).toBeGreaterThan(D0); // 评「困难」难度上升
    expect(fsrs.nextDiff(D0, 'again') - D0).toBeCloseTo(1.93, 10); // 评「忘了」大幅升（回 w[4]=4.93）
    // 反复评「简单」vs「困难」的难度分道扬镳（旧缺陷：两序列同向且全钳 1）
    let dEasy = 5;
    let dHard = 5;
    for (let i = 0; i < 4; i++) {
      dEasy = fsrs.nextDiff(dEasy, 'easy');
      dHard = fsrs.nextDiff(dHard, 'hard');
    }
    expect(dEasy).toBeLessThan(dHard);
  });

  it('F1 存量兼容：D<1（旧 initD=0.3 口径）不被钳抬——good 守不变语义，增量路径归入 [1,10]', () => {
    expect(fsrs.nextDiff(0.3, 'good')).toBe(0.3); // 不抬升（good 不变难度）
    expect(fsrs.nextDiff(0.3, 'easy')).toBe(0.3); // 只降不抬
    expect(fsrs.nextDiff(0.3, 'hard')).toBeCloseTo(1.24, 10); // 增量自然入界
    expect(fsrs.nextDiff(0.3, 'again')).toBe(4.93);
  });
});

describe('FSRS.nextInterval', () => {
  it('S=0.4, D=0.3, R=R(30,0.4) 四档（F1 [1,10] 域锚定）', () => {
    const R = fsrs.R(30, 0.4);
    const again = fsrs.nextInterval(0.4, 0.3, 'again', R);
    expect(again.S).toBeCloseTo(0.0405, 2); // again 分支 D^−w12 消费 D=4.93
    expect(again.D).toBe(4.93); // w[4] 全须全尾不再钳成 1
    const hard = fsrs.nextInterval(0.4, 0.3, 'hard', R);
    expect(hard.S).toBeCloseTo(48.14, 1); // D_new=1.24 → (11−1.24) 同域
    const good = fsrs.nextInterval(0.4, 0.3, 'good', R);
    expect(good.S).toBeCloseTo(53.17, 1);
    expect(good.D).toBe(0.3); // 存量 0.3 pass-through
    const easy = fsrs.nextInterval(0.4, 0.3, 'easy', R);
    expect(easy.S).toBeCloseTo(126.18, 1); // D 保持 0.3（不反升钳 1）
    expect(easy.D).toBe(0.3);
  });

  it('F1 回归：D 对间隔调节生效（同 S 同 R，高难度 → 后继稳定性更小）', () => {
    const R = fsrs.R(5, 2.4);
    const sEasy = fsrs.nextInterval(2.4, 2, 'good', R).S; // D=2 → (11−2)=9
    const sHard = fsrs.nextInterval(2.4, 9, 'good', R).S; // D=9 → (11−9)=2
    expect(sEasy).toBeGreaterThan(sHard);
    // strict 比例走 nextStab hard 分支（S·base 原样消费 D：base ∝ (11−D)；good 是 S·(base+1) 不正比）
    expect(fsrs.nextStab(2.4, 2, 'hard', R) / fsrs.nextStab(2.4, 9, 'hard', R)).toBeCloseTo(9 / 2, 5); // 调节幅度与 (11−D) 严格同域（旧钳 [0,1] 时恒 [10,11] 的 10%）
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

  it('F1 回归：难度链经调度演化——easy 降 / hard 升 / D 差异传导到间隔（存盘难度不再失真）', () => {
    // 进入点 D=0.3（initD good 口径）→ easy 不反升钳 1，hard 增量入界
    const st = fsrsState(9, 5.8);
    const dEasy = scheduleNext(st, 'easy', NOW);
    expect(dEasy.difficulty).toBe(0.3);
    const dHard = scheduleNext(st, 'hard', NOW);
    expect(dHard.difficulty).toBeCloseTo(1.24, 10);
    // D=5 的成熟条目：easy 连评难度逐次下降（(11−D) 同域，间隔随之拉长）
    let cur = { ...fsrsState(9, 2), difficulty: 5, lastReviewed: new Date(NOW.getTime() - 86400e3).toISOString() };
    const d0 = scheduleNext(cur, 'good', NOW);
    cur = { ...cur, difficulty: d0.difficulty! };
    const d1 = scheduleNext(cur, 'easy', NOW);
    expect(d1.difficulty!).toBeLessThan(5); // easy 降难度
    expect(d1.difficulty!).toBeCloseTo(Math.max(1, 5 - DEFAULT_W[6]), 10);
  });

  it('lastReviewed 缺失回退 reviewStart；两者皆缺 t=0 不抛错', () => {
    const d1 = scheduleNext({ stage: 9, phase: 'fsrs', stability: 5, reviewStart: new Date(NOW.getTime() - 86400e3).toISOString() }, 'good', NOW);
    expect(d1.R).not.toBeNull();
    const d2 = scheduleNext({ stage: 9, phase: 'fsrs', stability: 5 }, 'good', NOW);
    expect(d2.R).toBeCloseTo(fsrs.R(0, 5), 10); // t=0 → R=1
  });
});
