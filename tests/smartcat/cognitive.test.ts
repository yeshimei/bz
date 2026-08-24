// @vitest-environment node
/**
 * 认知能力模块测试（2026-08-23：参考 cognitive-engine 自研——趋势/波动 + Bandit + 矛盾检测）
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeEmotionTrend, buildEmotionSnapshots, describeEmotionTrend, emotionToVAD,
  initBanditArm, sampleThompson, updateBandit,
  checkContradiction, extractStoredFacts,
} from '../../src/smartcat/cognitive';

describe('情绪趋势/波动度（analyzeEmotionTrend）', () => {
  it('开心连续序列 → dominant happy、trend improving/stable、valence 正', () => {
    const snaps = buildEmotionSnapshots([
      { emotion: 'happy', importance: 0.8, created: '2026-08-20T10:00:00' },
      { emotion: 'happy', importance: 0.7, created: '2026-08-21T10:00:00' },
      { emotion: 'excited', importance: 0.9, created: '2026-08-22T10:00:00' },
    ]);
    const t = analyzeEmotionTrend(snaps);
    expect(['happy', 'excited']).toContain(t.dominantEmotion);
    expect(t.trend).not.toBe('declining');
    expect(t.currentVad.valence).toBeGreaterThan(0);
    expect(t.count).toBe(3);
  });

  it('情绪转差序列 → trend declining、valence 为负', () => {
    const snaps = buildEmotionSnapshots([
      { emotion: 'happy', importance: 0.8, created: '2026-08-20T10:00:00' },
      { emotion: 'calm', importance: 0.6, created: '2026-08-21T10:00:00' },
      { emotion: 'sad', importance: 0.9, created: '2026-08-22T10:00:00' },
      { emotion: 'sad', importance: 0.9, created: '2026-08-22T16:00:00' },
    ]);
    const t = analyzeEmotionTrend(snaps);
    expect(t.dominantEmotion).toBe('sad');
    expect(t.trend).toBe('declining');
    expect(t.currentVad.valence).toBeLessThan(0);
  });

  it('空序列 → 中性/平稳/无波动', () => {
    const t = analyzeEmotionTrend([]);
    expect(t.count).toBe(0);
    expect(t.dominantEmotion).toBe('neutral');
    expect(t.trend).toBe('stable');
    expect(t.volatility).toBe(0);
  });

  it('高波动序列（开心↔难过交替）→ volatility ≥ 0.5', () => {
    const snaps = buildEmotionSnapshots([
      { emotion: 'happy', importance: 0.8, created: '2026-08-20T10:00:00' },
      { emotion: 'sad', importance: 0.9, created: '2026-08-20T14:00:00' },
      { emotion: 'happy', importance: 0.8, created: '2026-08-21T10:00:00' },
      { emotion: 'sad', importance: 0.9, created: '2026-08-21T14:00:00' },
    ]);
    const t = analyzeEmotionTrend(snaps);
    expect(t.volatility).toBeGreaterThanOrEqual(0.5);
  });

  it('describeEmotionTrend 产出中文描述', () => {
    const t = analyzeEmotionTrend(buildEmotionSnapshots([{ emotion: 'sad', importance: 0.9, created: '2026-08-22T10:00:00' }]));
    expect(describeEmotionTrend(t)).toContain('难过');
    expect(describeEmotionTrend(analyzeEmotionTrend([]))).toContain('数据不足');
  });
});

describe('emotionToVAD', () => {
  it('已知情绪 → VAD 坐标；未知 → 默认', () => {
    const h = emotionToVAD('happy');
    expect(h.valence).toBeGreaterThan(0);
    const x = emotionToVAD('xzy');
    expect(x).toEqual({ valence: 0, arousal: 0.3, dominance: 0.5 });
  });
});

describe('Thompson Bandit（简化对角近似）', () => {
  it('初始化：平坦先验 σ² 大（探索）', () => {
    const arm = initBanditArm('a1', 2, 1);
    expect(arm.mu).toEqual([0, 0]);
    expect(arm.sigma2).toEqual([1, 1]);
    expect(arm.trials).toBe(0);
  });

  it('采样：从空臂表 → null；有臂 → 返回一个臂', () => {
    expect(sampleThompson([], [1, 1])).toBeNull();
    const arms = [initBanditArm('a1', 2, 1), initBanditArm('a2', 2, 1)];
    const chosen = sampleThompson(arms, [1, 1]);
    expect(chosen).not.toBeNull();
  });

  it('update：正 reward 该维 μ 上升 + 方差收窄', () => {
    let arm = initBanditArm('a1', 1, 1);
    arm = updateBandit(arm, [1], 1);
    expect(arm.mu[0]).toBeGreaterThan(0);
    expect(arm.sigma2[0]).toBeLessThan(1);
    expect(arm.trials).toBe(1);
  });

  it('reward 回填后：正臂的采样期望持续高于负臂（确定性 rng 验证）', () => {
    const rngA = (() => { let c = 0; return () => { c += 0.1; return c; }; })();
    let good = initBanditArm('good', 1, 1);
    let bad = initBanditArm('bad', 1, 1);
    for (let i = 0; i < 5; i++) { good = updateBandit(good, [1], 1); bad = updateBandit(bad, [1], 0); }
    // 直接比 μ：正臂 μ 显著高于负臂
    expect(good.mu[0]).toBeGreaterThan(bad.mu[0]);
    // 采样应倾向选 good（确定性 rng 下多次采样 majority）
    let goodWins = 0;
    const rngB = (() => { let c = 0; return () => { c += 0.01; return c; }; })();
    for (let i = 0; i < 50; i++) {
      const chosen = sampleThompson([bad, good], [1, 1], rngB);
      if (chosen && chosen.actionId === 'good') goodWins++;
    }
    expect(goodWins).toBeGreaterThan(20);
  });
});

describe('元认知矛盾检测（checkContradiction）', () => {
  it('用户说「不再 X」+ 提到存储事实 → 检出', () => {
    const facts = [{ subject: '用户', predicate: '喜欢', object: '跑步', confidence: 0.9 }];
    const r = checkContradiction('用户说：我不再喜欢跑步了', facts);
    expect(r.detected).toBe(true);
    expect(r.detail[0]).toContain('跑步');
  });

  it('无否定词/对象不相关 → 不检出', () => {
    const facts = [{ subject: '用户', predicate: '喜欢', object: '奶茶', confidence: 0.9 }];
    const r = checkContradiction('今天天气很好，出去走了走', facts);
    expect(r.detected).toBe(false);
  });

  it('低置信事实不触发', () => {
    const facts = [{ subject: '用户', predicate: '喜欢', object: '跑步', confidence: 0.3 }];
    const r = checkContradiction('我不再喜欢跑步了', facts);
    expect(r.detected).toBe(false);
  });
});

describe('extractStoredFacts（观察 → 用户事实）', () => {
  it('从「你写了日记：我喜欢 X」模板抽取事实', () => {
    const facts = extractStoredFacts([
      { description: '你写了日记：我喜欢深夜写作', importance: 0.8 },
      { description: '你写了日记：我讨厌下雨天', importance: 0.7 },
      { description: '你写了日记：今天去了公园', importance: 0.5 },
    ]);
    expect(facts.length).toBe(2);
    expect(facts[0].predicate).toContain('喜欢');
    expect(facts[1].predicate).toContain('讨厌');
  });

  it('ADR-0025 补动词：看了/读了/记下 同样抽取（影视/书库/闪念源）', () => {
    const facts = extractStoredFacts([
      { description: '你看了《海边的卡夫卡》，影评：我喜欢这本书的孤独感', importance: 0.8 },
      { description: '你读了《瓦尔登湖》，划线：我认定简单生活是对的', importance: 0.7 },
      { description: '你在卡片盒记下闪念：我决定开始写日记', importance: 0.65 },
    ]);
    expect(facts.length).toBe(3);
    expect(facts[0].predicate).toContain('喜欢');
    expect(facts[1].predicate).toContain('认定');
    expect(facts[2].predicate).toContain('决定');
  });

  it('尾部元信息（关键词…）剥离后再存对象', () => {
    const facts = extractStoredFacts([
      { description: '你写了日记：我喜欢编程（关键词：工作、学习）', importance: 0.8 },
    ]);
    expect(facts.length).toBe(1);
    expect(facts[0].object).toBe('编程');
  });

  it('无匹配 → 空数组', () => {
    expect(extractStoredFacts([{ description: '普通记录', importance: 0.5 }])).toEqual([]);
  });
});