/**
 * 性格系统测试（MATE ADR-0023 纯函数）：
 * OCEAN 随机种子/seed 映射/character_transition/softUpdate 饱和/trust 演化/
 * character_from_experience/状态向量格式。
 */
import { describe, it, expect, vi } from 'vitest';
import {
  randomOceanSeed, characterSeed, characterTransition, softUpdate, trustUpdate,
  characterFromExperience, formatStateVector, DEFAULT_TRAITS, DEFAULT_OCEAN,
} from '../../src/smartcat/character';
import { defaultPersonalityGrowth } from '../../src/smartcat/data';

describe('OCEAN 出生种子（nature）', () => {
  it('randomOceanSeed 生成 5 轴落在 [0.1, 0.9]', () => {
    for (let i = 0; i < 50; i++) {
      const o = randomOceanSeed();
      for (const k of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const) {
        expect(o[k]).toBeGreaterThanOrEqual(0.1);
        expect(o[k]).toBeLessThanOrEqual(0.9);
      }
    }
  });

  it('randomOceanSeed 两次调用大概率不同（nature×nurture 前提）', () => {
    const a = randomOceanSeed();
    const b = randomOceanSeed();
    const diff = Object.keys(a).filter((k) => Math.abs((a as any)[k] - (b as any)[k]) > 0.01).length;
    expect(diff).toBeGreaterThan(0);
  });

  it('characterSeed(OCEAN) 生成 30 特质且都在合理域（existential 群出生 0.0 除外）', () => {
    const t = characterSeed(DEFAULT_OCEAN);
    const names = Object.keys(t);
    expect(names.length).toBeGreaterThanOrEqual(29);
    const existential = ['exist_depth', 'familiarity', 'concern'];
    for (const k of names) {
      const v = (t as any)[k];
      expect(v).toBeGreaterThanOrEqual(existential.includes(k) ? 0 : 0.01);
      expect(v).toBeLessThanOrEqual(0.99);
    }
    // OCEAN 轴映射生效：高开放 → creativity 高
    const open = characterSeed({ ...DEFAULT_OCEAN, openness: 0.9 });
    expect(open.creativity).toBeGreaterThan(characterSeed(DEFAULT_OCEAN).creativity);
  });
});

describe('logistic 饱和（softUpdate）', () => {
  it('中心 0.5 增量最大，近边界增量渐弱，永不达 1.0', () => {
    const d0 = softUpdate(0.5, 0.1) - 0.5;      // 中心增量 0.05
    const d9 = softUpdate(0.9, 0.1) - 0.9;      // 近 1 增量小
    expect(d0).toBeCloseTo(0.05, 5);
    expect(d9).toBeLessThan(d0);
    expect(softUpdate(0.999, 0.1)).toBeLessThan(1.0);
    let v = 0.5;
    for (let i = 0; i < 1000; i++) v = softUpdate(v, 0.01);
    expect(v).toBeLessThan(0.9995); // 永不饱和到 1.0（保留 headroom）
  });
});

describe('character_transition（per-message 微移）', () => {
  it('中性（情绪强度 0）→ 不变化', () => {
    const t = characterTransition({ ...DEFAULT_TRAITS }, { emotionIntensity: 0, trust: 0.5 });
    expect(t).toEqual(DEFAULT_TRAITS);
  });

  it('温暖互动 → warmth/self_worth 成长；trust 高时近因小、增量小', () => {
    const lo = characterTransition({ ...DEFAULT_TRAITS }, { emotionIntensity: 0.5, trust: 0.3 });
    const hi = characterTransition({ ...DEFAULT_TRAITS }, { emotionIntensity: 0.5, trust: 0.9 });
    expect(lo.warmth).toBeGreaterThan(DEFAULT_TRAITS.warmth);
    expect(lo.warmth).toBeGreaterThan(hi.warmth); // trust 高 → 近因(1+(1-trust)) 小
  });
});

describe('trust 演化', () => {
  it('温暖互动升、敌意降、冷淡微侵蚀，单事件降幅有界', () => {
    expect(trustUpdate(0.5, { warm: true })).toBeGreaterThan(0.5);
    expect(trustUpdate(0.5, { hostile: true })).toBeCloseTo(0.46, 5); // -0.04
    expect(trustUpdate(0.5, {})).toBeLessThan(0.5);
    expect(trustUpdate(0.05, { hostile: true })).toBeGreaterThanOrEqual(0.05); // 下限兜底
  });

  it('中性事件（ADR-0025 neutral）不动 trust——click/note_* 不再被当成「冷处理」侵蚀', () => {
    expect(trustUpdate(0.5, { neutral: true })).toBe(0.5);
    // 未标记（冷淡/无回应）仍保持侵蚀，敌意仍明确降
    expect(trustUpdate(0.5, {})).toBeLessThan(0.5);
    expect(trustUpdate(0.5, { hostile: true })).toBeLessThan(0.5);
  });
});

describe('character_from_experience（周深更新）', () => {
  it('高频互动 → warmth 成长（δ≤0.01）', () => {
    const t = characterFromExperience({ ...DEFAULT_TRAITS }, { interactionCount: 50, emotionalTone: 0.5, preferredHour: 12 });
    expect(t.warmth - DEFAULT_TRAITS.warmth).toBeGreaterThan(0);
    expect(t.warmth - DEFAULT_TRAITS.warmth).toBeLessThanOrEqual(0.05);
  });

  it('负情绪基调 → anxiety/cortisol 上升（MATE §5 病理动力学）', () => {
    const t = characterFromExperience({ ...DEFAULT_TRAITS }, { interactionCount: 10, emotionalTone: -0.6, preferredHour: 12 });
    expect(t.anxiety).toBeGreaterThan(DEFAULT_TRAITS.anxiety);
    expect(t.cortisol).toBeGreaterThan(DEFAULT_TRAITS.cortisol);
  });

  it('深夜活跃 → dopamine/creativity 微升', () => {
    const t = characterFromExperience({ ...DEFAULT_TRAITS }, { interactionCount: 10, emotionalTone: 0, preferredHour: 23 });
    expect(t.dopamine).toBeGreaterThan(DEFAULT_TRAITS.dopamine);
  });
});

describe('formatStateVector（MATE §7 压缩注入）', () => {
  it('输出包含 PAD/OCEAN/trust/char 数值', () => {
    const g = defaultPersonalityGrowth();
    const s = formatStateVector(g, { pleasure: 0.45, arousal: 0.33, dominance: 0.18 }, 'curious');
    expect(s).toContain('PAD=');
    expect(s).toContain('OCEAN=');
    expect(s).toContain('trust=');
    expect(s).toContain('char:');
    expect(s).toContain('emo=curious');
    expect(s).toMatch(/PAD=\[[+-]?\d\.\d{2}/);
  });
});

describe('RL 校准常量（ADR-0024）', () => {
  it('温暖增益与侵蚀均为校准值（0.0082×quality / 0.0029），敌意仍 -0.04', () => {
    expect(trustUpdate(0.5, { warm: true })).toBeCloseTo(0.5 + 0.0082 * 0.5, 6);
    expect(trustUpdate(0.5, { hostile: true })).toBeCloseTo(0.46, 5);
    expect(trustUpdate(0.5, {})).toBeCloseTo(0.5 - 0.0029, 6);
  });

  it('trustCap 软收拢（ADR-0024 用户拍板）：v = cap + K(v−cap)，双向收拢（低侧也向 cap 靠）', () => {
    // 高于 cap：0.9 + warm(0.007) = 0.9041 → 软收拢 0.85+0.98×0.0541 = 0.9030（略降，非一刀切 clamp 到 0.85）
    const v = trustUpdate(0.9, { warm: true, trustCap: 0.85 });
    expect(v).toBeCloseTo(0.85 + 0.98 * ((0.9 + 0.0082 * 0.5) - 0.85), 6);
    expect(v).toBeLessThan(0.91);
    expect(v).toBeGreaterThan(0.85);
    // 低于 cap：0.5 + gain(0.0041)=0.5041 → 软收拢向 0.85 靠拢（0.85+0.98×(−0.3459)=0.5110）
    const low = trustUpdate(0.5, { warm: true, trustCap: 0.85 });
    expect(low).toBeCloseTo(0.85 + 0.98 * ((0.5 + 0.0082 * 0.5) - 0.85), 6);
    // 长序列（轻质量 0.15 语义，gain=0.00123）：平衡点 v* = cap + 49·gain ≈ 0.910
    let x = 0.5;
    for (let i = 0; i < 5000; i++) x = trustUpdate(x, { warm: true, quality: 0.15, trustCap: 0.85 });
    expect(x).toBeCloseTo(0.85 + 49 * (0.0082 * 0.15), 2); // ≈0.9103（真实库验收实测 91%）
    // 未设置 cap：保持单调上升（不封顶）
    expect(trustUpdate(0.9, { warm: true })).toBeGreaterThan(0.9);
  });

  it('characterTransition 默认 δbase 为校准值（0.00083：慢速微移但仍单调成长）', () => {
    const t = characterTransition({ ...DEFAULT_TRAITS }, { emotionIntensity: 1, trust: 0.5 });
    expect(t.warmth).toBeGreaterThan(DEFAULT_TRAITS.warmth);
    expect(t.warmth - DEFAULT_TRAITS.warmth).toBeLessThan(0.05);
  });
});