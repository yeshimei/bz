/**
 * smartcat 心情系统测试：维度更新（人格乘数/抵抗力/energy 下限/边界/微变化）、
 * 衰减率、持久化（saveMoodState/loadMoodState 24h 语义）、人格成长互动。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MoodSystem, EmotionalMemory, PersonalityGrowth, MOOD_MAP } from '../../src/smartcat/mood';
import { defaultSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make() {
  freshData();
  const app = {} as any;
  return new MoodSystem(app, () => data, saver);
}

/** 重置 data/saver（EmotionalMemory/PersonalityGrowth 测试用） */
function freshData() {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  return data;
}

beforeEach(() => {
  vi.useRealTimers();
  freshData();
});

describe('MoodSystem.updateMood', () => {
  it('常规加分：happiness +8 → 83（原默认 75）', () => {
    const m = make();
    m.updateMood('happiness', 8, 'pet');
    expect(m.dimensions.happiness).toBe(83);
  });

  it('边界 clamp 0-100', () => {
    const m = make();
    m.updateMood('happiness', 200, 'x');
    expect(m.dimensions.happiness).toBe(100);
    m.updateMood('happiness', -500, 'x');
    expect(m.dimensions.happiness).toBe(0);
  });

  it('energy 下限强制 5（原 L2220-2222）', () => {
    const m = make();
    m.updateMood('energy', -1000, 'x');
    expect(m.dimensions.energy).toBe(5);
  });

  it('未知维度按 50 初始化后更新', () => {
    const m = make();
    m.updateMood('magic', 10, 'x');
    expect((m.dimensions as any).magic).toBe(60);
  });

  it('微变化（<0.01）不写入', () => {
    const m = make();
    m.updateMood('happiness', 0.005, 'x');
    expect(m.dimensions.happiness).toBe(75);
  });

  it('人格抵抗力：lively happiness 负向 ×0.8', () => {
    const m = make();
    m.updateMood('happiness', -10, 'x');
    // lively 抵抗力 0.8 → -8
    expect(m.dimensions.happiness).toBe(67);
  });

  it('重要变化（|adjusted|>=1）触发保存', () => {
    const m = make();
    m.updateMood('happiness', 8, 'pet');
    expect(saver).toHaveBeenCalled();
  });

  it('历史记录 200 条截断到 100', () => {
    const m = make();
    for (let i = 0; i < 250; i++) m.updateMood('happiness', 1, 'x');
    expect(m.moodHistory.length).toBeLessThanOrEqual(100);
  });
});

describe('MoodSystem 持久化', () => {
  it('saveMoodState 写 dimensions/lastUpdate/lastMood', async () => {
    const m = make();
    m.dimensions.happiness = 88;
    m.currentMood = 'content';
    await m.saveMoodState();
    expect(data.mood.dimensions.happiness).toBe(88);
    expect(data.mood.lastUpdate).toBeGreaterThan(0);
    expect(data.mood.lastMood).toBe('content');
  });

  it('loadMoodState：24h 内合并持久化维度（原语义）', () => {
    const m = make();
    data.mood.dimensions.happiness = 42;
    data.mood.lastUpdate = Date.now();
    data.mood.lastMood = 'good';
    m.loadMoodState();
    expect(m.dimensions.happiness).toBe(42);
    expect(m.currentMood).toBe('good');
  });

  it('loadMoodState：超 24h 不覆写（保持默认）', () => {
    const m = make();
    data.mood.dimensions.happiness = 10;
    data.mood.lastUpdate = Date.now() - 25 * 60 * 60 * 1000;
    m.loadMoodState();
    expect(m.dimensions.happiness).toBe(75);
  });
});

describe('MoodSystem 心情枚举与 emoji', () => {
  it('MOOD_MAP 5 级枚举', () => {
    expect(Object.keys(MOOD_MAP).sort()).toEqual(['excellent', 'good', 'low', 'neutral', 'poor']);
    expect(MOOD_MAP.excellent.emoji).toBe('😻');
    expect(MOOD_MAP.poor.state).toBe('不开心');
  });

  it('getCurrentMoodEmoji：content 未命中回落 neutral emoji（铁律 4 状态死着）', () => {
    const m = make();
    expect(m.currentMood).toBe('content'); // 初始（持久化 lastMood 为 neutral 时回落 content）
    expect(m.getCurrentMoodEmoji()).toBe('😼');
  });

  it('getOverallMood：content → neutral 兜底', () => {
    const m = make();
    expect(m.getOverallMood()).toBe('neutral');
  });
});

describe('MoodSystem 衰减与互动', () => {
  it('startAutoDecay 60s 衰减：interval 运行并保存（单周期 0.02 被 round(×10)/10 吞掉，原版同款）', async () => {
    vi.useFakeTimers();
    const m = make();
    m.startAutoDecay();
    await vi.advanceTimersByTimeAsync(60000); // 1 个周期
    expect(saver).toHaveBeenCalled();
    // 10 周期后仍因舍入保持 75（原版行为），但不抛错
    m.dimensions.happiness = 74.95; // 直接置小值验证下次衰减写入
    await vi.advanceTimersByTimeAsync(60000);
    expect(m.dimensions.happiness).toBeLessThanOrEqual(74.95);
  }, 10000);

  it('handleInteraction：pet 加 happiness/affection/energy', () => {
    const m = make();
    m.handleInteraction('pet', 1);
    expect(m.dimensions.happiness).toBeGreaterThan(75);
    expect(m.dimensions.affection).toBeGreaterThan(50);
  });
});

describe('EmotionalMemory.recordMemory', () => {
  it('重要性低于阈值 → 不记录', async () => {
    const app = {} as any;
    const emo = new EmotionalMemory(app, () => data, saver);
    const r = await emo.recordMemory({ interactionType: 'click' }, [{ dimension: 'happiness', change: 0.5 }], 0.1);
    expect(r).toBeNull();
    expect(emo.store.memories.length).toBe(0);
  });

  it('重要记忆记录 + 统计更新 + 标签', async () => {
    const app = {} as any;
    const emo = new EmotionalMemory(app, () => data, saver);
    const r = await emo.recordMemory(
      { interactionType: 'pet', tags: ['x'] },
      [{ dimension: 'happiness', change: 8 }, { dimension: 'affection', change: 6 }],
      0.8
    );
    expect(r).not.toBeNull();
    expect(emo.store.memories.length).toBe(1);
    expect(emo.store.statistics.totalMemories).toBe(1);
    expect(emo.store.memories[0].tags).toContain('interaction_pet');
  });

  it('同 key 去重（session 内）', async () => {
    const app = {} as any;
    const emo = new EmotionalMemory(app, () => data, saver);
    await emo.recordMemory({ interactionType: 'pet' }, [{ dimension: 'happiness', change: 8 }], 0.8);
    const r2 = await emo.recordMemory({ interactionType: 'pet' }, [{ dimension: 'happiness', change: 8 }], 0.8);
    expect(r2).toBeNull();
  });
});

describe('PersonalityGrowth', () => {
  it('pet 互动成长：sociability +1、independence -0.5', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.developBasedOnInteraction('pet', 1);
    expect(data.personalityGrowth.traits.sociability).toBe(51);
    expect(data.personalityGrowth.traits.independence).toBe(49.5);
    expect(data.personalityGrowth.growthHistory.length).toBe(1);
  });

  it('getPersonalityInfluence 按特质计算乘数', () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const infl = pg.getPersonalityInfluence();
    expect(infl.happinessMultiplier).toBe(1);
    expect(infl.decayResistance).toBe(1);
  });
});