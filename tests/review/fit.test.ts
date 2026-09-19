// @vitest-environment node
/**
 * FSRS 参数拟合测试（ADR-0077，ticket 174；issue 361 全 19 参数放开）：
 * 回放序列构造 / 回放似然 / 分档门槛 / 19 维收敛（合成数据）/ 不劣化 / 降级档位 /
 * review-fit.json 新旧契约兼容 / 护栏（迭代上限/早停/墙钟）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_W, FSRS, type Rating } from '../../src/review/fsrs';
import {
  buildReplaySeries,
  buildReplaySeriesFromItems,
  replayLogLikelihood,
  numericGradient,
  fitFSRSParams,
  fitFromItems,
  mergeFittedW,
  type ReplaySeries,
} from '../../src/review/fit';
import { loadFittedParams, saveFittedParams, FIT_PARAMS_VERSION, getReviewFitFilePath } from '../../src/review/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';

const FIT_PATH = getReviewFitFilePath();
const NAMES: Rating[] = ['again', 'hard', 'good', 'easy'];

// ==================== 合成数据（种子化确定性 RNG + 真权重前向回放） ====================

/** mulberry32 种子随机（测试完全确定，无 Math.random 抖动） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 「真用户」权重：相对 DEFAULT_W 扰动（初始稳定性重排 + 演化参数缩放），供合成数据生成 */
const W_TRUE: number[] = (() => {
  const w = [...DEFAULT_W];
  w[0] = 0.7; // again 初始稳定性
  w[1] = 1.1;
  w[2] = 3.1;
  w[3] = 7.2;
  w[4] = 0.8; // again 难度（W_BOUNDS[4]=[0,10] 界内；F1 后 D 消费域 [1,10]，经 nextDiff 钳制归入）
  w[5] = -0.4;
  w[6] = 1.1;
  w[8] = 0.9;
  w[9] = 0.3;
  w[10] = 1.8;
  w[11] = 0.2;
  w[12] = 0.5;
  w[13] = 1.6;
  w[14] = -0.8;
  w[17] = 0.9;
  return w;
})();

/**
 * 用「真权重」前向生成合成复习历史（与拟合回放同族公式：FSRS.R + nextInterval）。
 * 每条目：进入 FSRS 1 条 + reviews 次后续（均带 stability 相位标记），间隔 1~40 天。
 * flipRate：评级标签翻转概率（噪声鲁棒用）。
 */
function synthItems(seed: number, wTrue: number[], opts: { items: number; reviews: number; flipRate?: number }): any[] {
  const rng = mulberry32(seed);
  const fsrs = new FSRS(wTrue);
  const out: any[] = [];
  for (let i = 0; i < opts.items; i++) {
    const base = Date.UTC(2025, 0, 1) + i * 36e5; // 条目错开 1h
    const initRating: number = rng() < 0.15 ? 1 : rng() < 0.5 ? 2 : 3; // hard/good/easy 进入
    let S = fsrs.initS(NAMES[initRating]);
    let D = initRating === 0 ? fsrs.w[4] : 0.3;
    const history: any[] = [
      { timestamp: new Date(base).toISOString(), stage: 10, rating: NAMES[initRating], stability: S, difficulty: D, R: 100 },
    ];
    let day = 0;
    for (let k = 0; k < opts.reviews; k++) {
      const t = 1 + Math.floor(rng() * 40);
      day += t;
      const R = fsrs.R(t, S);
      let remember = rng() < R;
      if (opts.flipRate && rng() < opts.flipRate) remember = !remember;
      const rating = remember ? (rng() < 0.8 ? 2 : 3) : (rng() < 0.7 ? 0 : 1);
      history.push({
        timestamp: new Date(base + day * 86400000).toISOString(),
        stage: 10,
        rating: NAMES[rating],
        stability: S,
        difficulty: D,
        R: Math.round(R * 100),
      });
      const next = fsrs.nextInterval(S, D, NAMES[rating], R);
      S = next.S;
      D = next.D;
    }
    out.push({ difficulty: D, reviewHistory: history });
  }
  return out;
}

// ==================== buildReplaySeries ====================

describe('buildReplaySeries', () => {
  it('FSRS 相位记录配对：首条 initRating，相邻 t=时间差（天）', () => {
    const history = [
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5, difficulty: 0.3 },
      { timestamp: '2026-08-11T10:00:00.000Z', stage: 10, rating: 'easy', stability: 10, difficulty: 0.3 },
    ];
    const s = buildReplaySeries(history)!;
    expect(s.initRating).toBe(2); // good
    expect(s.pairs).toHaveLength(1);
    expect(s.pairs[0]).toEqual({ t: 10, rating: 3 });
  });

  it('阶梯阶段记录（无 stability 标记）不参与；FSRS 记录跨阶梯间隔直接配对', () => {
    const history = [
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 1, rating: 'good' }, // 阶梯：无 stability
      { timestamp: '2026-08-02T10:00:00.000Z', stage: 10, rating: 'good', stability: 2.4 },
      { timestamp: '2026-08-03T10:00:00.000Z', stage: 5, rating: 'good' }, // 阶梯混入：无 stability
      { timestamp: '2026-08-13T10:00:00.000Z', stage: 10, rating: 'hard', stability: 8 },
    ];
    const s = buildReplaySeries(history)!;
    expect(s.initRating).toBe(2);
    expect(s.pairs).toEqual([{ t: 11, rating: 1 }]); // 08-02 → 08-13
  });

  it('t<=0 跳过；未知评级跳过；不足 2 条 FSRS 记录 → null', () => {
    expect(buildReplaySeries([])).toBeNull();
    expect(buildReplaySeries([{ timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5 }])).toBeNull();
    const s = buildReplaySeries([
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5 },
      { timestamp: '2026-08-01T10:00:00.000Z', stage: 10, rating: 'good', stability: 5 }, // t=0
      { timestamp: '2026-08-02T10:00:00.000Z', stage: 10, rating: 'xxx', stability: 5 }, // 未知评级
      { timestamp: '2026-08-06T10:00:00.000Z', stage: 10, rating: 'easy', stability: 5 },
    ])!;
    // 仅 08-02 → 08-06 配对成功（t=0 与未知评级剔除；配对取相邻前一条为锚）
    expect(s.pairs).toEqual([{ t: 4, rating: 3 }]);
  });

  it('buildReplaySeriesFromItems：配对不跨条目（不同笔记历史串联会产生假样本）', () => {
    // 150 条独立条目、各含 1 条 FSRS 记录：逐条目构样恒空
    const items = Array.from({ length: 150 }, (_, i) => ({
      reviewHistory: [
        { timestamp: new Date(2026, 0, 1 + i).toISOString(), stage: 10, rating: 'good', stability: 5 },
      ],
    }));
    expect(buildReplaySeriesFromItems(items)).toHaveLength(0);
    // 单条目多条记录 → 1 个序列
    expect(buildReplaySeriesFromItems(items.slice(0, 1).map((i) => ({ reviewHistory: [...i.reviewHistory!, { timestamp: '2026-09-01T00:00:00.000Z', stage: 10, rating: 'easy', stability: 8 }] })))).toHaveLength(1);
  });
});

// ==================== replayLogLikelihood ====================

describe('replayLogLikelihood', () => {
  const series = buildReplaySeriesFromItems(synthItems(7, W_TRUE, { items: 10, reviews: 6 }));

  it('依赖 w：扰动权重 → 似然变化（旧实现似然与 w 无关、梯度恒零的回归）', () => {
    const llA = replayLogLikelihood([...DEFAULT_W], series);
    const perturbed = [...DEFAULT_W];
    perturbed[2] += 1; // good 初始稳定性
    const llB = replayLogLikelihood(perturbed, series);
    expect(llB).not.toBeCloseTo(llA, 6);
    // 也有限（无 NaN/Infinity 泄漏）
    expect(Number.isFinite(llA)).toBe(true);
    expect(Number.isFinite(llB)).toBe(true);
  });

  it('记住(good/easy) 贡献 log R、遗忘(again/hard) 贡献 log(1-R)：与手推单序列逐项一致', () => {
    const w = [...DEFAULT_W];
    const fsrs = new FSRS(w);
    const one = buildReplaySeriesFromItems([
      {
        reviewHistory: [
          { timestamp: '2026-08-01T00:00:00.000Z', stage: 10, rating: 'good', stability: 2.4 },
          { timestamp: '2026-08-06T00:00:00.000Z', stage: 10, rating: 'again', stability: 5 },
        ],
      },
    ]);
    expect(one).toHaveLength(1);
    // 回放起点对齐 scheduleNext enteringFsrs：S0 = w[good] = 2.4，D0 = 0.3
    const R = fsrs.R(5, 2.4);
    const expected = Math.log(Math.max(1e-9, 1 - R)); // again = 遗忘
    expect(replayLogLikelihood(w, one)).toBeCloseTo(expected, 10);
  });

  it('数值梯度有限且非零（有效参数进入目标；w[7]/w[15]/w[16]/w[18] 恒零）', () => {
    const grad = numericGradient([...DEFAULT_W], series, 19);
    expect(grad).toHaveLength(19);
    const inert = [7, 15, 16, 18];
    for (let i = 0; i < 19; i++) {
      expect(Number.isFinite(grad[i])).toBe(true);
      if (inert.includes(i)) expect(grad[i]).toBe(0);
    }
    expect(Math.abs(grad[2])).toBeGreaterThan(0); // good 初始稳定性有信号
    expect(Math.abs(grad[8])).toBeGreaterThan(0); // 成功演化有信号
  });

  it('拟合-调度一致（审查修复回归）：回放起点 S0/D0 与推进式同构于调度 enteringFsrs/nextInterval，w[4]=4.93 全链不被钳', () => {
    const w = [...DEFAULT_W]; // w[4] = 4.93（旧 W_BOUNDS[4]=[0,1] 会钳——既有缺陷回归锚）
    const fsrs = new FSRS(w);
    // again 进入 FSRS：D0 = w[4]，与调度 scheduleNext enteringFsrs 存盘口径同源（FSRS.initD 单源）
    expect(fsrs.initD('again')).toBe(4.93);
    expect(fsrs.initD('good')).toBe(0.3);
    const series: ReplaySeries[] = [{ initRating: 0, pairs: [{ t: 5, rating: 3 }, { t: 12, rating: 0 }] }];
    // 按调度链同式（initS → initD → R → nextInterval 推进）手推累计对数似然，与回放逐位一致
    let S = fsrs.initS('again');
    let D = fsrs.initD('again');
    let ll = 0;
    for (const p of series[0].pairs) {
      const R = fsrs.R(p.t, S);
      ll += Math.log(Math.max(1e-9, Math.min(1 - 1e-9, p.rating >= 2 ? R : 1 - R)));
      const next = fsrs.nextInterval(S, D, NAMES[p.rating], R);
      S = next.S;
      D = next.D;
    }
    expect(replayLogLikelihood(w, series)).toBeCloseTo(ll, 10);
  });
});

// ==================== fitFSRSParams：收敛 / 不劣化 / 护栏 ====================

describe('fitFSRSParams（合成数据收敛质量，issue 361）', () => {
  it('19 维收敛：全参拟合显著改善似然、不劣化、贴近真模型、迭代有上限', async () => {
    const items = synthItems(42, W_TRUE, { items: 60, reviews: 6 }); // 360 对 ≥300
    const series = buildReplaySeriesFromItems(items);
    const initLL = replayLogLikelihood([...DEFAULT_W], series);
    const trueLL = replayLogLikelihood(W_TRUE, series);

    const t0 = Date.now();
    const res = await fitFSRSParams(series, { full: true });
    const ms = Date.now() - t0;
    console.info(`[issue 361] 全参拟合（360 对）：${ms}ms，${res.iterations} 轮，LL ${initLL.toFixed(1)} → ${res.logLikelihood.toFixed(1)}（真模型 ${trueLL.toFixed(1)}）`);

    expect(res.w).toHaveLength(19);
    expect(res.full).toBe(true);
    // 不劣化：best 追踪保证拟合结果 ≥ 初始
    expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL - 1e-6);
    // 收敛质量：至少吃下「初始 → 真模型」改善量的一半（确定性种子下的稳定下界）
    expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL + 0.5 * (trueLL - initLL));
    // 迭代上限护栏
    expect(res.iterations).toBeLessThanOrEqual(120);
    // 耗时量级：合成 360 对远低于墙钟护栏（3s）——后台拟合不卡启动
    expect(ms).toBeLessThan(3000);
    // 拟合确实动了参数（非空转回退）
    expect(Math.abs(res.w[2] - DEFAULT_W[2])).toBeGreaterThan(1e-3);
    // v4 模型未用参数（梯度恒零）保持初值
    for (const i of [7, 15, 16, 18]) expect(res.w[i]).toBe(DEFAULT_W[i]);
  });

  it('不同规模：基础档（120 对）/ 全参档（840 对）都不劣化，全参档贴真模型', async () => {
    for (const [seed, n, reviews] of [[11, 20, 6], [13, 120, 7]] as const) {
      const series = buildReplaySeriesFromItems(synthItems(seed, W_TRUE, { items: n, reviews }));
      const pairs = series.reduce((a, s) => a + s.pairs.length, 0);
      const initLL = replayLogLikelihood([...DEFAULT_W], series);
      const t0 = Date.now();
      const res = await fitFSRSParams(series, { full: pairs >= 300 });
      const ms = Date.now() - t0;
      if (pairs >= 300) console.info(`[issue 361] 全参拟合（${pairs} 对）：${ms}ms，${res.iterations} 轮`);
      expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL - 1e-6); // 不劣化
      if (pairs >= 300) {
        const trueLL = replayLogLikelihood(W_TRUE, series);
        expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL + 0.5 * (trueLL - initLL)); // 全参收敛质量
      }
    }
  });

  it('噪声鲁棒：10% 评级翻转下拟合仍不劣化', async () => {
    const series = buildReplaySeriesFromItems(synthItems(99, W_TRUE, { items: 60, reviews: 6, flipRate: 0.1 }));
    const initLL = replayLogLikelihood([...DEFAULT_W], series);
    const res = await fitFSRSParams(series, { full: true });
    expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL - 1e-6);
  });

  it('基础八参档：只动 w[0..7]，w[8..18] 保持默认；w[7] 梯度恒零不动', async () => {
    const series = buildReplaySeriesFromItems(synthItems(21, W_TRUE, { items: 20, reviews: 6 })); // 120 对
    const initLL = replayLogLikelihood([...DEFAULT_W], series);
    const res = await fitFSRSParams(series, { full: false });
    expect(res.full).toBe(false);
    expect(res.logLikelihood).toBeGreaterThanOrEqual(initLL - 1e-6);
    for (let i = 8; i < 19; i++) expect(res.w[i]).toBe(DEFAULT_W[i]);
    expect(res.w[7]).toBe(DEFAULT_W[7]); // 不参与遗忘曲线（d 固定），似然对其梯度恒零
  });

  it('护栏：停滞早停提前收轮；墙钟时限截断不收敛也不拖死', async () => {
    // 停滞早停：空序列似然恒 0 → 连续 stallRounds=2 轮零改进即停（远小于上限）
    const stalled = await fitFSRSParams([], { iterations: 50, stallRounds: 2 });
    expect(stalled.iterations).toBeLessThan(10);
    expect(stalled.logLikelihood).toBe(0);
    // 墙钟：360 对 × 19 维单轮 ~毫秒级，50ms 时限必然在 100000 轮上限前截断
    const series = buildReplaySeriesFromItems(synthItems(42, W_TRUE, { items: 60, reviews: 6 }));
    const t0 = Date.now();
    const guarded = await fitFSRSParams(series, { full: true, iterations: 100000, maxMs: 50 });
    const ms = Date.now() - t0;
    expect(guarded.iterations).toBeLessThan(100000); // 未跑满上限
    expect(ms).toBeLessThan(5000); // 且整体很快收住
    expect(Number.isFinite(guarded.logLikelihood)).toBe(true);
  });
});

// ==================== fitFromItems：门槛 + 降级档位 ====================

describe('fitFromItems', () => {
  it('<100 对样本 → null（跳过拟合）', async () => {
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
    expect(await fitFromItems(items)).toBeNull();
  });

  it('降级档位：100~299 对 → 基础八参（full=false）；≥300 对 → 全参（full=true）', async () => {
    const mkItems = (n: number) => [
      {
        reviewHistory: Array.from({ length: n }, (_, i) => ({
          timestamp: new Date(2026, 0, 1 + i).toISOString(),
          stage: 10,
          rating: ['good', 'easy', 'again', 'hard'][i % 4],
          stability: 5,
          difficulty: 0.3,
        })),
      },
    ];
    const subset = (await fitFromItems(mkItems(150)))!; // 149 对
    expect(subset.count).toBeGreaterThanOrEqual(100);
    expect(subset.fit.full).toBe(false);
    expect(subset.fit.w).toHaveLength(DEFAULT_W.length);
    const full = (await fitFromItems(mkItems(350)))!; // 349 对
    expect(full.count).toBeGreaterThanOrEqual(300);
    expect(full.fit.full).toBe(true);
  });

  it('按条目分别构样：不同笔记的历史不跨条目配对（假样本回归）', async () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      difficulty: 0.3,
      reviewHistory: [
        { timestamp: new Date(2026, 0, 1 + i).toISOString(), stage: 10, rating: i % 2 ? 'good' : 'easy', stability: 5, difficulty: 0.3 },
      ],
    }));
    expect(await fitFromItems(items)).toBeNull();
  });

  it('生产旧数据形态（FSRS 记录只含 stability 无 difficulty）可回放构样', async () => {
    const items = [
      {
        reviewHistory: Array.from({ length: 120 }, (_, i) => ({
          timestamp: new Date(2026, 0, 1 + i).toISOString(),
          stage: 10,
          rating: i % 3 === 0 ? 'good' : 'easy',
          stability: 5,
        })),
      },
    ];
    const res = (await fitFromItems(items))!;
    expect(res.count).toBe(119);
    expect(res.fit.full).toBe(false); // 119 对 <300 → 基础档
  });
});

describe('mergeFittedW', () => {
  it('拟合结果 19 维等长覆盖（基础档未动维度本就是默认值）', () => {
    const fitted = [1, 2, 3, 4, 5, 6, 7, 8, ...DEFAULT_W.slice(8)];
    const merged = mergeFittedW(fitted);
    expect(merged).toHaveLength(DEFAULT_W.length);
    for (let i = 0; i < 19; i++) expect(merged[i]).toBe(fitted[i]);
  });
});

// ==================== review-fit.json 契约版本（issue 361） ====================

describe('review-fit.json 契约版本', () => {
  beforeEach(() => {
    setApp(null as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  });

  /** 契约测试工装：vault + setApp（storage 层走 core getApp 解析，对齐 d3-reliability 用法） */
  function setup(): MockVault {
    const vault = new MockVault();
    setApp({ vault } as any);
    return vault;
  }

  it('旧八参文件（无 version 字段）载入兼容零迁移：视同基础档继续生效', async () => {
    const vault = setup();
    const legacy = {
      w: [...DEFAULT_W.slice(0, 8), ...DEFAULT_W.slice(8)], // 旧文件本就 19 长度（前 8 有效）
      fitAt: '2026-08-01T00:00:00.000Z',
      fitCount: 150,
      full: false,
    };
    vault.files.set(FIT_PATH, JSON.stringify(legacy));
    const fit = await loadFittedParams({ vault } as any);
    expect(fit).not.toBeNull();
    expect(fit!.version).toBeUndefined(); // 无字段 → 载入侧视同 1，零迁移
    expect(fit!.w).toHaveLength(19);
    expect(fit!.full).toBe(false);
  });

  it('全参结果 version=2 正常载入；声称 v2 但 w<19 → 字段不齐回退 null', async () => {
    const vault = setup();
    const v2 = { w: [...DEFAULT_W], fitAt: '2026-09-01T00:00:00.000Z', fitCount: 356, full: true, version: 2 };
    vault.files.set(FIT_PATH, JSON.stringify(v2));
    const fit = await loadFittedParams({ vault } as any);
    expect(fit).not.toBeNull();
    expect(fit!.version).toBe(FIT_PARAMS_VERSION.FULL);
    expect(fit!.fitCount).toBe(356);

    vault.files.set(FIT_PATH, JSON.stringify({ ...v2, w: DEFAULT_W.slice(0, 10) })); // v2 但缺权重
    expect(await loadFittedParams({ vault } as any)).toBeNull();
  });

  it('saveFittedParams 写入 version 字段往返保留', async () => {
    const vault = setup();
    const fit = { w: [...DEFAULT_W], fitAt: '2026-09-02T00:00:00.000Z', fitCount: 300, full: true, version: FIT_PARAMS_VERSION.FULL };
    await saveFittedParams({ vault } as any, fit);
    const raw = JSON.parse(vault.files.get(FIT_PATH)!);
    expect(raw.version).toBe(2);
    expect((await loadFittedParams({ vault } as any))!.version).toBe(2);
  });

  it('起点不被钳（审查修复回归）：DEFAULT_W（w[4]=4.93）起步，零学习率一轮后 w[4] 保持原值不被 W_BOUNDS 削到 1', async () => {
    // 旧缺陷：W_BOUNDS[4]=[0,1]，clipW 起点即把 4.93 钳到 1——拟合 D0 系统性偏低、似然够不到真值
    const series = buildReplaySeriesFromItems(synthItems(7, W_TRUE, { items: 10, reviews: 6 }));
    const res = await fitFSRSParams(series, { initW: [...DEFAULT_W], iterations: 1, lr: 0, full: true });
    expect(res.w[4]).toBe(DEFAULT_W[4]); // 4.93 全须全尾
  });

  it('载入脏值防御（审查修复回归）：非有限权重 → null 回退默认；越界有限值逐维钳进 W_BOUNDS（w[4]=4.93 不误钳）', async () => {
    const vault = setup();
    const dirty = { w: [...DEFAULT_W], fitAt: '2026-09-03T00:00:00.000Z', fitCount: 200, full: true, version: 2 };
    dirty.w[2] = NaN;
    vault.files.set(FIT_PATH, JSON.stringify(dirty));
    expect(await loadFittedParams({ vault } as any)).toBeNull(); // NaN 毒化整档 → 回退默认

    const over = { ...dirty, w: [...DEFAULT_W] };
    over.w[2] = 9999; // 超 w2 上界 240
    over.w[5] = -99; // 超 w5 下界 -1.5
    vault.files.set(FIT_PATH, JSON.stringify(over));
    const fit = await loadFittedParams({ vault } as any);
    expect(fit).not.toBeNull();
    expect(fit!.w[2]).toBe(240);
    expect(fit!.w[5]).toBe(-1.5);
    expect(fit!.w[4]).toBe(4.93); // 新上界 10 恒含默认值
  });
});
