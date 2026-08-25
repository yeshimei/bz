/**
 * smartcat 配置归一覆盖率补测：非法类型字段回退默认（speakInterval/speakProbability/
 * contextLength/contextSplitRatio/noteSource/proactiveCare）、proactiveWeeklyCap 与
 * shortTermMemory 边界、外观合法表全量通过。基础归一语义见 config.test.ts。
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, normalizeConfig } from '../../src/smartcat/config';

describe('normalizeConfig 非法类型回退（补分支）', () => {
  it('数值型字段为非数字类型 → 逐项回默认值', () => {
    const c = normalizeConfig({
      speakInterval: '10',
      speakProbability: null,
      contextLength: '500',
      contextSplitRatio: {},
    });
    expect(c.speakInterval).toBe(defaultConfig().speakInterval);
    expect(c.speakProbability).toBe(defaultConfig().speakProbability);
    expect(c.contextLength).toBe(defaultConfig().contextLength);
    expect(c.contextSplitRatio).toBe(defaultConfig().contextSplitRatio);
  });

  it('布尔型字段为非布尔类型 → 回默认开', () => {
    const c = normalizeConfig({ noteSource: 'yes', proactiveCare: 1 });
    expect(c.noteSource).toBe(true);
    expect(c.proactiveCare).toBe(true);
  });

  it('proactiveWeeklyCap 合法边界 0 与 7 保留，越界 -1/8 回默认', () => {
    expect(normalizeConfig({ proactiveWeeklyCap: 0 }).proactiveWeeklyCap).toBe(0);
    expect(normalizeConfig({ proactiveWeeklyCap: 7 }).proactiveWeeklyCap).toBe(7);
    expect(normalizeConfig({ proactiveWeeklyCap: -1 }).proactiveWeeklyCap).toBe(2);
    expect(normalizeConfig({ proactiveWeeklyCap: 8 }).proactiveWeeklyCap).toBe(2);
    expect(normalizeConfig({ proactiveWeeklyCap: 'x' }).proactiveWeeklyCap).toBe(2);
  });

  it('shortTermMemory 合法边界 50 与 200 保留', () => {
    expect(normalizeConfig({ shortTermMemory: 50 }).shortTermMemory).toBe(50);
    expect(normalizeConfig({ shortTermMemory: 200 }).shortTermMemory).toBe(200);
  });

  it('13 种合法外观全部保留不回退', () => {
    const appearances = ['orange','gray','black','white','calico','neon','galaxy','liquidMetal','fire','crystal','cyberpunk','rainbow','hologram'];
    for (const a of appearances) {
      expect(normalizeConfig({ appearance: a }).appearance).toBe(a);
    }
  });

  it('历史截尾取 min(shortTermMemory*2, length)——上限小于现有长度时按上限截', () => {
    // 上限 > 现有长度：原样保留
    const few = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    expect(normalizeConfig({ conversationHistory: few, shortTermMemory: 100 }).conversationHistory.length).toBe(10);
    // 恰好等于上限：不裁
    const exact = Array.from({ length: 20 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    expect(normalizeConfig({ conversationHistory: exact, shortTermMemory: 10 }).conversationHistory.length).toBe(20);
  });
});
