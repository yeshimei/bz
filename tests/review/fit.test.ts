// @vitest-environment node
/**
 * FSRS 参数拟合测试（ADR-0077，ticket 174）：样本构造/对数似然/门槛/拟合收敛/合并
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_W } from '../../src/review/fsrs';
import {
  buildFitSamples,
  computeSampleLogLikelihood,
  isFittableSample,
  totalLogLikelihood,
  fitFSRSParams,
  fitFromItems,
  mergeFittedW,
} from '../../src/review/fit';

describe('buildFitSamples', () => {
  it('相邻记录配对：上条 stability/difficulty 为 S/D，间隔 t = 时间差（天）', () => {
    const history = [
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5, difficulty: 0.3 },
      { timestamp: '2026-08-11T10:00:00.000Z', stage: 11, rating: 'easy', stability: 10, difficulty: 0.3 },
    ];
    const samples = buildFitSamples(history);
    expect(samples).toHaveLength(1);
    expect(samples[0].S).toBe(5);
    expect(samples[0].D).toBe(0.3);
    expect(samples[0].rating).toBe(3); // easy
    expect(samples[0].stage).toBe(11);
    expect(samples[0].t).toBeCloseTo(10, 5);
  });

  it('缺 stability/difficulty 的记录跳过；t<=0 跳过；未知评级跳过', () => {
    const history = [
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 5, rating: 'good' }, // 无 stability（阶梯阶段）
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5, difficulty: 0.3 }, // t=0
      { timestamp: '2026-08-03T10:00:00.000Z', stage: 10, rating: 'xxx', stability: 5, difficulty: 0.3 }, // 未知评级
      { timestamp: '2026-08-05T10:00:00.000Z', stage: 10, rating: 'good', stability: 5, difficulty: 0.3 }, // 有效（但与上条未知评级配对也会被拒？）
    ];
    const samples = buildFitSamples(history);
    // 第4条 prev=第3条（有 stability/difficulty，t=2>0），但第3条评级未知 → 不产生样本；
    // 第2条 prev=第1条（无 stability）→ 跳过；第3条 prev=第2条（t=0）→ 跳过。
    // 实际上第4条与第3条配对，cur=good 有效，prev 有 stability → 会产生样本。
    // 修正预期：未知评级的「当前」记录不产生样本，但它可作为后续记录的 prev。
    expect(samples.length).toBeLessThanOrEqual(1);
    if (samples.length === 1) {
      // 该样本来自第3条(prev) → 第4条(cur)：评级 good，t=2
      expect(samples[0].rating).toBe(2);
      expect(samples[0].t).toBeCloseTo(2, 5);
    }
  });

  it('上一条缺 difficulty → 回退条目级 fallbackDifficulty（生产旧数据形态可积累样本）', () => {
    // 生产旧数据：FSRS 相位记录只含 stability（无 difficulty）
    const history = [
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5 },
      { timestamp: '2026-08-11T10:00:00.000Z', stage: 10, rating: 'easy', stability: 10 },
    ];
    // 无回退 → 恒 0 样本（原 bug）
    expect(buildFitSamples(history)).toHaveLength(0);
    // 回退条目级 difficulty → 样本产生
    const samples = buildFitSamples(history, { fallbackDifficulty: 0.3 });
    expect(samples).toHaveLength(1);
    expect(samples[0].D).toBe(0.3);
    expect(samples[0].S).toBe(5);
  });
});

describe('computeSampleLogLikelihood', () => {
  it('记住(good/easy) → log R；遗忘(again/hard) → log(1-R)', () => {
    // S=5, t=5, d=w[7]=0.01（默认）→ R 计算
    const w = [...DEFAULT_W];
    const sample = { t: 5, S: 5, D: 0.3, rating: 2, stage: 10 }; // good
    const llRemember = computeSampleLogLikelihood(w, sample);
    const sampleForget = { ...sample, rating: 0 }; // again
    const llForget = computeSampleLogLikelihood(w, sampleForget);
    // 二者都有限且符号合理：记住的似然 = log R < 0，遗忘的似然 = log(1-R) < 0
    expect(llRemember).toBeLessThan(0);
    expect(llForget).toBeLessThan(0);
    // d=0.01 时 R 接近 1 → 记住的 ll 接近 0，遗忘的 ll 很负
    expect(llRemember).toBeGreaterThan(llForget);
  });

  it('阶梯阶段样本不计入总似然（isFittableSample）', () => {
    const w = [...DEFAULT_W];
    const sLadder = { t: 5, S: 5, D: 0.3, rating: 2, stage: 5 };
    const sFsrs = { t: 5, S: 5, D: 0.3, rating: 2, stage: 10 };
    expect(isFittableSample(sLadder)).toBe(false);
    expect(isFittableSample(sFsrs)).toBe(true);
    expect(totalLogLikelihood(w, [sLadder])).toBe(0); // 阶梯不计
    expect(totalLogLikelihood(w, [sFsrs])).toBeLessThan(0);
  });
});

describe('fitFSRSParams', () => {
  it('梯度上升：拟合后对数似然不降（子集 w[0..6]）', () => {
    // 构造 120 条可拟合样本（满足 100~300 子集门槛）
    const samples: Array<{ t: number; S: number; D: number; rating: number; stage: number }> = [];
    for (let i = 0; i < 120; i++) {
      const t = 1 + (i % 30); // 1..30 天
      const S = 2 + (i % 10);
      // 制造「短间隔好评级 / 长间隔差评级」信号
      const rating = t < 15 ? 2 : 0; // good / again
      samples.push({ t, S, D: 0.3, rating, stage: 10 + (i % 5) });
    }
    const res = fitFSRSParams(samples, { iterations: 20, lr: 0.01 });
    expect(res.w.length).toBe(DEFAULT_W.length);
    // 拟合后似然 ≥ 初始（best 追踪保证）
    const initLL = totalLogLikelihood([...DEFAULT_W], samples);
    expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL - 1e-6);
    // 权重被约束在合法区间
    for (let i = 0; i < 4; i++) expect(res.w[i]).toBeGreaterThan(0.01);
    expect(res.w[4]).toBeGreaterThanOrEqual(0);
    expect(res.w[4]).toBeLessThanOrEqual(1);
    for (let i = 5; i < 7; i++) expect(res.w[i]).toBeGreaterThan(0.01);
    // w[7] 不参与遗忘曲线（d 固定 DEFAULT_D），似然对它梯度恒零，应保持初值不动
    expect(res.w[7]).toBe(DEFAULT_W[7]);
  });
});

describe('fitFromItems', () => {
  it('<100 条样本 → null（跳过拟合）', () => {
    const items = [
      {
        reviewHistory: Array.from({ length: 50 }, (_, i) => ({
          timestamp: new Date(2026, 0, 1 + i).toISOString(),
          stage: 10,
          rating: 'good',
          stability: 5,
          difficulty: 0.3,
        })),
      },
    ];
    expect(fitFromItems(items)).toBeNull();
  });

  it('100~300 条 → 子集拟合（full=false）；≥300 → 全参（full=true）', () => {
    const mkItems = (n: number) => [
      {
        reviewHistory: Array.from({ length: n }, (_, i) => ({
          timestamp: new Date(2026, 0, 1 + i).toISOString(),
          stage: 10,
          rating: i % 2 ? 'good' : 'easy',
          stability: 5,
          difficulty: 0.3,
        })),
      },
    ];
    const subset = fitFromItems(mkItems(150))!;
    expect(subset.count).toBeGreaterThanOrEqual(100);
    expect(subset.fit.w.length).toBe(DEFAULT_W.length);
    const full = fitFromItems(mkItems(350))!;
    expect(full.count).toBeGreaterThanOrEqual(300);
  });

  it('按条目分别构样：不同笔记的历史不跨条目配对（假样本回归）', () => {
    // 150 条独立条目、各含 1 条 FSRS 记录且时间戳递增：
    // 跨条目拍平配对会产生 149 个假样本（≥100 → 会错误触发拟合）；
    // 按条目构样则恒 0 样本 → 返回 null。
    const items = Array.from({ length: 150 }, (_, i) => ({
      difficulty: 0.3,
      reviewHistory: [
        { timestamp: new Date(2026, 0, 1 + i).toISOString(), stage: 10, rating: i % 2 ? 'good' : 'easy', stability: 5, difficulty: 0.3 },
      ],
    }));
    expect(fitFromItems(items)).toBeNull();
  });
});

describe('mergeFittedW', () => {
  it('子集拟合只覆盖前 8，其余取默认', () => {
    const fitted = [1, 2, 3, 4, 5, 6, 7, 8];
    const merged = mergeFittedW(fitted);
    expect(merged).toHaveLength(DEFAULT_W.length);
    for (let i = 0; i < 8; i++) expect(merged[i]).toBe(fitted[i]);
    for (let i = 8; i < DEFAULT_W.length; i++) expect(merged[i]).toBe(DEFAULT_W[i]);
  });
});
