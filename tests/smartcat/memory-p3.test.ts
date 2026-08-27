// @vitest-environment node
/**
 * P3 用户体验层：记忆管理 API 测试（ticket 123）
 * - promoteToMemory（behavior→memory 字段正确/移除/落盘/向量钩子）
 * - queryBehavior（过滤）
 * - summarizeBehavior（聚合：时间窗/计数）
 * - linkRelatedMemories（同实体关联/窗口过滤/幂等/上限）
 * - buildStoryline（关联记忆回溯）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  promoteToMemory,
  queryBehavior,
  summarizeBehavior,
  linkRelatedMemories,
  buildStoryline,
} from '../../src/smartcat/memory';
import type { SmartCatData, BehaviorItem, MemoryStreamEntry } from '../../src/smartcat/types';

// mock settings-provider (configurable for enableAutoLinking tests)
const mockSettingsData: Record<string, any> = {
  linkWindowDays: 7,
  behaviorMaxDays: 30,
  behaviorMaxCount: 1000,
  showBehaviorLog: true,
  enableAutoLinking: true,
};
vi.mock('../../src/core/settings-provider', () => ({
  tryGetSettings: () => mockSettingsData,
}));

function makeData(overrides: Partial<SmartCatData> = {}): SmartCatData {
  return {
    config: { appearance: 'orange', customColors: { primary: '#fff', secondary: '#000' }, speakInterval: 10, speakProbability: 0.5, responseSensitivity: 'medium', contextLength: 500, contextSplitRatio: 0.5, conversationHistory: [], shortTermMemory: 100, noteSource: true, proactiveCare: true, proactiveWeeklyCap: 2, cloudScoring: 'smart' },
    mood: { pad: { pleasure: 50, arousal: 50, dominance: 50 }, lastUpdate: Date.now(), lastMood: 'neutral', currentEmotion: null },
    personalityGrowth: { ocean: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 }, traits: { anxiety: 0.5, avoidance: 0.5, separation_tol: 0.5, self_worth: 0.5, world_safety: 0.5, others_trust: 0.5, reflectiveness: 0.5, analytical: 0.5, creativity: 0.5, humor: 0.5, intellectual: 0.5, def_avoidance: 0.5, support: 0.5, locus_control: 0.5, self_esteem: 0.5, self_efficacy: 0.5, enhancement: 0.5, transcendence: 0.5, change: 0.5, conservation: 0.5, warmth: 0.5, directness: 0.5, beh_depth: 0.5, conflict: 0.5, optimism: 0.5, serotonin: 0.5, dopamine: 0.5, oxytocin: 0.5, cortisol: 0.5, exist_depth: 0, familiarity: 0, concern: 0 }, relationship: { trust: 0.5, attachment: 0.5 }, behaviorStats: { interactionCount: 0, emotionalTone: 0, preferredHour: 12, sessionCount: 0 }, growthHistory: [], lastSave: Date.now(), version: '1.0' },
    editingData: {},
    memory: {
      version: 2,
      lastUpdated: new Date().toISOString(),
      memoryStream: [],
      behaviorStream: [],
      reflection: { lastReflectAt: 0, count: 0 },
    },
    ...overrides,
  } as SmartCatData;
}

function makeBehavior(overrides: Partial<BehaviorItem> = {}): BehaviorItem {
  return {
    id: `beh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: 'created',
    source: 'memo',
    description: 'memo:created test item',
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryStreamEntry> = {}): MemoryStreamEntry {
  return {
    id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    description: 'test memory',
    importance: 0.5,
    type: 'observation',
    ...overrides,
  };
}

describe('promoteToMemory', () => {
  it('从 behaviorStream 找条目并提升为记忆', () => {
    const data = makeData();
    const beh = makeBehavior({ id: 'beh_001', source: 'pomodoro', type: 'started', description: 'pomodoro:started 写代码' });
    data.memory.behaviorStream.push(beh);

    const result = promoteToMemory(data, 'beh_001');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('pomodoro');
    expect(result!.description).toBe('pomodoro:started 写代码');
    expect(result!.structured?.entityType).toBe('pomodoro');
    expect(result!.structured?.action).toBe('started');
    expect(result!.structured?.extras?.originalType).toBe('started');
    expect(result!.structured?.extras?.originalSource).toBe('pomodoro');
  });

  it('从 behaviorStream 移除条目', () => {
    const data = makeData();
    const beh = makeBehavior({ id: 'beh_002' });
    data.memory.behaviorStream.push(beh);

    promoteToMemory(data, 'beh_002');
    expect(data.memory.behaviorStream.find((b) => b.id === 'beh_002')).toBeUndefined();
  });

  it('未找到条目返回 null', () => {
    const data = makeData();
    const result = promoteToMemory(data, 'nonexistent');
    expect(result).toBeNull();
  });

  it('自定义 importance', () => {
    const data = makeData();
    const beh = makeBehavior({ id: 'beh_003' });
    data.memory.behaviorStream.push(beh);

    const result = promoteToMemory(data, 'beh_003', 0.8);
    expect(result!.importance).toBe(0.8);
  });

  it('snapshot.summary 优先作为 description', () => {
    const data = makeData();
    const beh = makeBehavior({
      id: 'beh_004',
      metadata: { entityType: 'diary', action: 'created', snapshot: { summary: '今天写了一篇日记', tags: [], length: 100 } },
    } as any);
    data.memory.behaviorStream.push(beh);

    const result = promoteToMemory(data, 'beh_004');
    expect(result!.description).toBe('今天写了一篇日记');
  });

  it('更新 memory.lastUpdated', () => {
    const data = makeData();
    // 设置一个固定的旧时间
    data.memory.lastUpdated = '2020-01-01T00:00:00.000Z';
    const beh = makeBehavior({ id: 'beh_005' });
    data.memory.behaviorStream.push(beh);

    promoteToMemory(data, 'beh_005');
    expect(data.memory.lastUpdated).not.toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('queryBehavior', () => {
  it('返回所有行为（无过滤）', () => {
    const data = makeData();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', source: 'memo' }),
      makeBehavior({ id: 'b2', source: 'diary' }),
    );
    const result = queryBehavior(data);
    expect(result.length).toBe(2);
  });

  it('按 source 过滤', () => {
    const data = makeData();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', source: 'memo' }),
      makeBehavior({ id: 'b2', source: 'diary' }),
      makeBehavior({ id: 'b3', source: 'memo' }),
    );
    const result = queryBehavior(data, { source: 'memo' });
    expect(result.length).toBe(2);
    expect(result.every((b) => b.source === 'memo')).toBe(true);
  });

  it('按 type 过滤', () => {
    const data = makeData();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', type: 'created' }),
      makeBehavior({ id: 'b2', type: 'updated' }),
    );
    const result = queryBehavior(data, { type: 'created' });
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('created');
  });

  it('按 since 过滤', () => {
    const data = makeData();
    const now = new Date();
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', timestamp: old }),
      makeBehavior({ id: 'b2', timestamp: recent }),
    );
    const result = queryBehavior(data, { since: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('b2');
  });

  it('limit 截断', () => {
    const data = makeData();
    for (let i = 0; i < 10; i++) {
      data.memory.behaviorStream.push(makeBehavior({ id: `b${i}` }));
    }
    const result = queryBehavior(data, { limit: 3 });
    expect(result.length).toBe(3);
  });

  it('时间倒序排列', () => {
    const data = makeData();
    const old = new Date(Date.now() - 2 * 3600000).toISOString();
    const recent = new Date(Date.now() - 1 * 3600000).toISOString();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b_old', timestamp: old }),
      makeBehavior({ id: 'b_new', timestamp: recent }),
    );
    const result = queryBehavior(data);
    expect(result[0].id).toBe('b_new');
    expect(result[1].id).toBe('b_old');
  });
});

describe('summarizeBehavior', () => {
  it('总条数正确', () => {
    const data = makeData();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1' }),
      makeBehavior({ id: 'b2' }),
      makeBehavior({ id: 'b3' }),
    );
    const result = summarizeBehavior(data);
    expect(result.totalCount).toBe(3);
  });

  it('按天计数', () => {
    const data = makeData();
    const today = new Date().toISOString().slice(0, 10);
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', timestamp: new Date().toISOString() }),
      makeBehavior({ id: 'b2', timestamp: new Date().toISOString() }),
    );
    const result = summarizeBehavior(data);
    expect(result.byDay[today]).toBe(2);
  });

  it('按来源计数', () => {
    const data = makeData();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', source: 'memo' }),
      makeBehavior({ id: 'b2', source: 'memo' }),
      makeBehavior({ id: 'b3', source: 'diary' }),
    );
    const result = summarizeBehavior(data);
    expect(result.bySource['memo']).toBe(2);
    expect(result.bySource['diary']).toBe(1);
  });

  it('小时分布', () => {
    const data = makeData();
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', timestamp: now.toISOString() }),
    );
    const result = summarizeBehavior(data);
    expect(result.hourlyDistribution[14]).toBe(1);
  });

  it('sinceDays 时间窗口过滤', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.behaviorStream.push(
      makeBehavior({ id: 'b1', timestamp: new Date(now - 1 * 86400000).toISOString() }),
      makeBehavior({ id: 'b2', timestamp: new Date(now - 10 * 86400000).toISOString() }),
    );
    const result = summarizeBehavior(data, { sinceDays: 5 });
    expect(result.totalCount).toBe(1);
  });

  it('空行为流返回零值', () => {
    const data = makeData();
    const result = summarizeBehavior(data);
    expect(result.totalCount).toBe(0);
    expect(Object.keys(result.byDay).length).toBe(0);
  });
});

describe('linkRelatedMemories', () => {
  it('同实体+同名+窗口内记忆自动关联', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体' } }),
      makeMemory({ id: 'm2', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体' } }),
    );
    const newLinks = linkRelatedMemories(data);
    expect(newLinks).toBeGreaterThan(0);
    const m1 = data.memory.memoryStream.find((m) => m.id === 'm1')!;
    expect(m1.structured?.relatedIds).toContain('m2');
  });

  it('窗口外记忆不关联', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now - 10 * 86400000).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体' } }),
      makeMemory({ id: 'm2', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体' } }),
    );
    const newLinks = linkRelatedMemories(data, 7);
    expect(newLinks).toBe(0);
  });

  it('幂等：已关联的不重复加', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体', relatedIds: ['m2'] } }),
      makeMemory({ id: 'm2', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体', relatedIds: ['m1'] } }),
    );
    const newLinks = linkRelatedMemories(data);
    expect(newLinks).toBe(0);
  });

  it('上限防爆：单条 relatedIds ≤ 20', () => {
    const data = makeData();
    const now = Date.now();
    // 创建 25 个同实体同名记忆
    for (let i = 0; i < 25; i++) {
      data.memory.memoryStream.push(
        makeMemory({ id: `m${i}`, created: new Date(now + i * 1000).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体' } }),
      );
    }
    linkRelatedMemories(data);
    const m0 = data.memory.memoryStream.find((m) => m.id === 'm0')!;
    expect(m0.structured?.relatedIds!.length).toBeLessThanOrEqual(20);
  });

  it('无 structured 的记忆跳过', () => {
    const data = makeData();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', structured: undefined }),
      makeMemory({ id: 'm2', structured: undefined }),
    );
    const newLinks = linkRelatedMemories(data);
    expect(newLinks).toBe(0);
  });

  it('enableAutoLinking=false 时直接返回 0', () => {
    mockSettingsData.enableAutoLinking = false;
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体' } }),
      makeMemory({ id: 'm2', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体' } }),
    );
    const newLinks = linkRelatedMemories(data);
    expect(newLinks).toBe(0);
    mockSettingsData.enableAutoLinking = true; // 恢复默认
  });
});

describe('buildStoryline', () => {
  it('返回直接关联的记忆（含自身）', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体', relatedIds: ['m2'] } }),
      makeMemory({ id: 'm2', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体', relatedIds: ['m1'] } }),
      makeMemory({ id: 'm3', created: new Date(now + 7200000).toISOString(), structured: { entityType: 'movie', action: 'watched', name: '流浪地球' } }),
    );
    const storyline = buildStoryline(data, 'm1');
    expect(storyline.length).toBe(2);
    expect(storyline.map((m) => m.id)).toContain('m1');
    expect(storyline.map((m) => m.id)).toContain('m2');
    expect(storyline.map((m) => m.id)).not.toContain('m3');
  });

  it('按时间排序', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体', relatedIds: ['m2'] } }),
      makeMemory({ id: 'm2', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体', relatedIds: ['m1'] } }),
    );
    const storyline = buildStoryline(data, 'm1');
    expect(storyline[0].id).toBe('m2');
    expect(storyline[1].id).toBe('m1');
  });

  it('未找到记忆返回空数组', () => {
    const data = makeData();
    const storyline = buildStoryline(data, 'nonexistent');
    expect(storyline).toEqual([]);
  });

  it('同实体记忆也纳入故事线', () => {
    const data = makeData();
    const now = Date.now();
    data.memory.memoryStream.push(
      makeMemory({ id: 'm1', created: new Date(now).toISOString(), structured: { entityType: 'book', action: 'read', name: '三体' } }),
      makeMemory({ id: 'm2', created: new Date(now + 3600000).toISOString(), structured: { entityType: 'book', action: 'finished', name: '三体' } }),
      makeMemory({ id: 'm3', created: new Date(now + 7200000).toISOString(), structured: { entityType: 'book', action: 'rated', name: '三体' } }),
    );
    const storyline = buildStoryline(data, 'm1');
    expect(storyline.length).toBe(3);
  });
});
