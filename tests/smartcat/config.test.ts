/**
 * smartcat 配置测试：默认值/归一化（shortTermMemory 越界、外观/性格非法回退、历史截断）+ 性格 prompt 文案。
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, normalizeConfig, getPersonalityPrompt } from '../../src/smartcat/config';

describe('defaultConfig', () => {
  it('默认值与源码 ConfigManager 一致', () => {
    const c = defaultConfig();
    expect(c.appearance).toBe('orange');
    expect(c.customColors).toEqual({ primary: '#FF6B35', secondary: '#F7931E' });
    expect(c.personality).toBe('lively');
    expect(c.customPersonality).toContain('小橘');
    expect(c.speakInterval).toBe(5);
    expect(c.speakProbability).toBe(0.3);
    expect(c.responseSensitivity).toBe('medium');
    expect(c.contextLength).toBe(500);
    expect(c.contextSplitRatio).toBe(0.5);
    expect(c.shortTermMemory).toBe(50);
    expect(c.conversationHistory).toEqual([]);
  });
});

describe('normalizeConfig', () => {
  it('非法输入 → 默认配置', () => {
    expect(normalizeConfig(null)).toEqual(defaultConfig());
    expect(normalizeConfig('x')).toEqual(defaultConfig());
  });

  it('shortTermMemory 越界（<50 / >200）强制 50（原 loadConfig 语义）', () => {
    expect(normalizeConfig({ shortTermMemory: 10 }).shortTermMemory).toBe(50);
    expect(normalizeConfig({ shortTermMemory: 999 }).shortTermMemory).toBe(50);
    expect(normalizeConfig({ shortTermMemory: 100 }).shortTermMemory).toBe(100);
  });

  it('外观/性格非法 → 回退默认', () => {
    expect(normalizeConfig({ appearance: 'pink' }).appearance).toBe('orange');
    expect(normalizeConfig({ personality: 'angry' }).personality).toBe('lively');
    expect(normalizeConfig({ appearance: 'neon' }).appearance).toBe('neon');
    expect(normalizeConfig({ personality: 'mentor' }).personality).toBe('mentor');
  });

  it('历史超 shortTermMemory*2 截尾（原 saveConfig 语义）', () => {
    // shortTermMemory 合法下限是 50（<50 归一强制 50）；用 60 测截断：
    const history = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    const c = normalizeConfig({ conversationHistory: history, shortTermMemory: 60 });
    expect(c.shortTermMemory).toBe(60); // 合法保留
    expect(c.conversationHistory.length).toBe(40); // 40 ≤ 60*2 不截
    // 超上限 → 截尾到 60*2=120
    const many = Array.from({ length: 200 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    const c2 = normalizeConfig({ conversationHistory: many, shortTermMemory: 60 });
    expect(c2.conversationHistory.length).toBe(120);
    expect(c2.conversationHistory[0].content).toBe('m80');
  });

  it('conversationHistory 非数组 → 重置', () => {
    expect(normalizeConfig({ conversationHistory: 'x' }).conversationHistory).toEqual([]);
  });
});

describe('getPersonalityPrompt', () => {
  it('5 性格均有文案且含小橘角色（原 L1658-1667 逐字）', () => {
    expect(getPersonalityPrompt('lively')).toContain('活泼可爱的小橘');
    expect(getPersonalityPrompt('quiet')).toContain('安静温柔的小橘');
    expect(getPersonalityPrompt('wise')).toContain('聪明智慧的小橘');
    expect(getPersonalityPrompt('cute')).toContain('超级可爱的小橘');
    expect(getPersonalityPrompt('mentor')).toContain('经验丰富的导师小橘');
  });

  it('非法性格回落 lively', () => {
    expect(getPersonalityPrompt('x' as any)).toBe(getPersonalityPrompt('lively'));
  });
});