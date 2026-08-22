/**
 * smartcat 配置测试（ADR-0023 更新）：默认值/归一化（shortTermMemory 越界、外观非法回退、历史截断）。
 * 预设人格（personality/customPersonality/getPersonalityPrompt）已删除——人格由性格系统（character.ts）承担。
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig, normalizeConfig } from '../../src/smartcat/config';

describe('defaultConfig', () => {
  it('默认值与源码 ConfigManager 一致（无预设人格字段）', () => {
    const c = defaultConfig();
    expect(c.appearance).toBe('orange');
    expect(c.customColors).toEqual({ primary: '#FF6B35', secondary: '#F7931E' });
    expect((c as any).personality).toBeUndefined();
    expect((c as any).customPersonality).toBeUndefined();
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

  it('外观非法 → 回退默认（预设人格校验已移除）', () => {
    expect(normalizeConfig({ appearance: 'pink' }).appearance).toBe('orange');
    expect(normalizeConfig({ appearance: 'neon' }).appearance).toBe('neon');
  });

  it('历史超 shortTermMemory*2 截尾（原 saveConfig 语义）', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    const c = normalizeConfig({ conversationHistory: history, shortTermMemory: 60 });
    expect(c.shortTermMemory).toBe(60);
    expect(c.conversationHistory.length).toBe(40);
    const many = Array.from({ length: 200 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }));
    const c2 = normalizeConfig({ conversationHistory: many, shortTermMemory: 60 });
    expect(c2.conversationHistory.length).toBe(120);
    expect(c2.conversationHistory[0].content).toBe('m80');
  });

  it('conversationHistory 非数组 → 重置', () => {
    expect(normalizeConfig({ conversationHistory: 'x' }).conversationHistory).toEqual([]);
  });
});