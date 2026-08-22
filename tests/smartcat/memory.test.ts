/**
 * smartcat 分层记忆测试：短期截断/重要性/固化/检索/索引/清理。
 */
import { describe, it, expect, vi } from 'vitest';
import { MemorySystem, MEMORY_CONFIG, RETRIEVAL_MAX, RETRIEVAL_THRESHOLD } from '../../src/smartcat/memory';
import { defaultSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(): MemorySystem {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  return new MemorySystem({} as any, () => data, saver);
}

describe('addShortTermMemory', () => {
  it('加入短期记忆 + 索引更新 + 落盘', async () => {
    const m = make();
    const mem = await m.addShortTermMemory('用户说：今天开始学 TypeScript', {});
    expect(mem.id).toMatch(/^memory_/);
    expect(data.memory.shortTerm.memories.length).toBe(1);
    expect(data.memory.index.timeIndex).toBeDefined();
    expect(saver).toHaveBeenCalled();
  });

  it('超 100 条截尾（保留最新）', async () => {
    const m = make();
    for (let i = 0; i < 105; i++) await m.addShortTermMemory(`消息 ${i}`, {});
    expect(data.memory.shortTerm.memories.length).toBe(MEMORY_CONFIG.maxShortTerm);
  });

  it('calculateImportance：词数/情感/手动标记', () => {
    const m = make();
    const base = m.calculateImportance('短', {});
    // 原版 split(/\s+/)：单字 1 词 → 0.5 + min(1/500, 0.3) = 0.502
    expect(base).toBeCloseTo(0.502, 3);
    const withEmotion = m.calculateImportance('我非常开心今天', {});
    expect(withEmotion).toBeGreaterThan(0.5);
    const manual = m.calculateImportance('x', { manuallyMarked: true });
    expect(manual).toBeGreaterThanOrEqual(0.8);
  });
});

describe('consolidateMemories 固化', () => {
  it('importance>=0.7 短期 → 长期（新 id + summary + consolidationScore）', async () => {
    const m = make();
    await m.addShortTermMemory('这是一条非常重要的学习记忆，包含很多内容', { isRepetitive: false });
    // 手动拉高重要性
    data.memory.shortTerm.memories[0].metadata.importance = 0.9;
    const longBefore = data.memory.longTerm.memories.length;
    await m.consolidateMemories();
    expect(data.memory.longTerm.memories.length).toBe(longBefore + 1);
    expect(data.memory.longTerm.memories[0].summary).toBeDefined();
    expect(data.memory.longTerm.memories[0].metadata.consolidationScore).toBeDefined();
  });

  it('低于阈值记忆不固化', async () => {
    const m = make();
    await m.addShortTermMemory('普通消息', {});
    data.memory.shortTerm.memories[0].metadata.importance = 0.3;
    await m.consolidateMemories();
    expect(data.memory.longTerm.memories.length).toBe(0);
  });

  it('超 500 删最不重要', async () => {
    const m = make();
    for (let i = 0; i < 502; i++) {
      data.memory.shortTerm.memories.push({
        id: `mem${i}`, timestamp: new Date().toISOString(), type: 'conversation', content: `内容${i}`,
        metadata: { importance: 0.9, topics: [], emotion: 'neutral' }, usage: {},
      });
    }
    data.memory.shortTerm.memories.length = MEMORY_CONFIG.maxShortTerm + 400; // 直灌超限
    await m.consolidateMemories();
    expect(data.memory.longTerm.memories.length).toBeLessThanOrEqual(MEMORY_CONFIG.maxLongTerm);
  });
});

describe('retrieveRelevantMemories 检索', () => {
  it('关键词命中高相关 → 返回且最多 10 条', async () => {
    const m = make();
    await m.addShortTermMemory('用户说：我喜欢 TypeScript 类型系统', {});
    const results = await m.retrieveRelevantMemories('TypeScript');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(RETRIEVAL_MAX);
  });

  it('无相关 → 空数组', async () => {
    const m = make();
    await m.addShortTermMemory('无关内容 AAAA BBBB', {});
    const results = await m.retrieveRelevantMemories('完全不存在关键词xyz');
    expect(results).toEqual([]);
  });
});

describe('cleanupExpiredMemories 清理', () => {
  it('30 天未用且 importance<0.3 删除', async () => {
    const m = make();
    data.memory.longTerm.memories.push({
      id: 'old', timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'conversation', content: '旧', metadata: { importance: 0.1 }, usage: {},
    });
    data.memory.longTerm.memories.push({
      id: 'keep', timestamp: new Date().toISOString(),
      type: 'conversation', content: '新', metadata: { importance: 0.9 }, usage: {},
    });
    await m.cleanupExpiredMemories();
    expect(data.memory.longTerm.memories.some((x: any) => x.id === 'old')).toBe(false);
    expect(data.memory.longTerm.memories.some((x: any) => x.id === 'keep')).toBe(true);
  });
});

describe('getSystemStatus / formatMemoriesForPrompt', () => {
  it('状态计数正确', async () => {
    const m = make();
    await m.addShortTermMemory('abc');
    const s = m.getSystemStatus();
    expect(s.shortTermCount).toBe(1);
  });

  it('formatMemoriesForPrompt 带 [layer] 前缀与 200 字符截断', async () => {
    const m = make();
    const text = m.formatMemoriesForPrompt([{ layer: 'shortTerm', content: 'hello world'.repeat(50) }]);
    expect(text).toContain('[shortTerm]');
    expect(text.length).toBeLessThan(300);
  });
});