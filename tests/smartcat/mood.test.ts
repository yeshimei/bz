/**
 * smartcat 心情系统测试（PAD 重构版）：PAD 三轴更新（人格乘数/抵抗力/clamp/微变化）、
 * 原型最近邻判档（断线解除）、registerEmotion、持久化（24h 语义）、衰减、
 * 互动效果表、PersonalityGrowth（互动驱动 + 反思驱动）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoodSystem, PersonalityGrowth, MOOD_MAP, emotionResonanceDelta } from '../../src/smartcat/mood';
import { TRUST_SOFT_K, TRUST_CAP, trustUpdate } from '../../src/smartcat/character';
import { defaultSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData } from '../../src/smartcat/types';

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make() {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  return new MoodSystem({} as any, () => data, saver);
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('MoodSystem.updatePad（PAD 三轴，性格调制后）', () => {
  it('愉悦加分：pleasure 上升（默认 55，性格乘数使增量 ≠8）', () => {
    const m = make();
    m.updatePad('pleasure', 8, 'pet');
    expect(m.pad.pleasure).toBeGreaterThan(55);
    expect(m.pad.pleasure).toBeLessThanOrEqual(63);
  });

  it('边界 clamp 0-100', () => {
    const m = make();
    m.updatePad('pleasure', 200, 'x');
    expect(m.pad.pleasure).toBe(100);
    m.updatePad('pleasure', -500, 'x');
    expect(m.pad.pleasure).toBe(0);
  });

  it('微变化（<0.01）不写入', () => {
    const m = make();
    m.updatePad('pleasure', 0.005, 'x');
    expect(m.pad.pleasure).toBe(55);
  });

  it('负向抵抗力：默认 traits 下 pleasure 负向有缓冲（变化幅度 < 原始值）', () => {
    const m = make();
    m.updatePad('pleasure', -10, 'x');
    // 无性格调制时 -10；有性格抵抗力时跌幅 <10
    expect(m.pad.pleasure).toBeGreaterThan(45);
    expect(m.pad.pleasure).toBeLessThan(55);
  });

  it('重要变化（|adjusted|>=1）触发保存', () => {
    const m = make();
    m.updatePad('pleasure', 8, 'pet');
    expect(saver).toHaveBeenCalled();
  });

  it('死字段 moodHistory 已删除（消费点重构后不存在；大量更新不累积历史）', () => {
    const m = make();
    for (let i = 0; i < 250; i++) m.updatePad('pleasure', 1, 'x');
    expect((m as any).moodHistory).toBeUndefined();
    expect(m.pad.pleasure).toBe(100); // 更新本身照常生效
  });
});

describe('PAD → 5 档（原型最近邻，断线解除）', () => {
  it('computeMoodLevel：PAD 落在 excellent 原型附近 → excellent', () => {
    const m = make();
    m.pad = { pleasure: 88, arousal: 75, dominance: 62 };
    expect(m.computeMoodLevel()).toBe('excellent');
  });

  it('低愉悦低唤醒 → poor', () => {
    const m = make();
    m.pad = { pleasure: 15, arousal: 20, dominance: 35 };
    expect(m.computeMoodLevel()).toBe('poor');
  });

  it('updatePad 后 currentMood 实时跟随（不再恒为 lastMood，断线解除）', () => {
    const m = make();
    expect(m.currentMood).toBe('neutral'); // 默认 55/50/50 距 neutral 最近
    m.updatePad('pleasure', 30, 'x'); // → 85/50/50 → good
    expect(m.currentMood).toBe('good');
    m.pad = { pleasure: 10, arousal: 15, dominance: 30 };
    m.updatePad('pleasure', 5, 'x');
    expect(m.currentMood).toBe('poor');
  });

  it('MOOD_MAP 5 级原型坐标存在（PAD 三维）', () => {
    const keys = Object.keys(MOOD_MAP).sort();
    expect(keys).toEqual(['excellent', 'good', 'low', 'neutral', 'poor']);
    expect(MOOD_MAP.excellent.emoji).toBe('😻');
    expect(MOOD_MAP.poor.state).toBe('不开心');
    expect(MOOD_MAP.excellent.prototype.length).toBe(3);
  });
});

describe('温和共振（ADR-0025：情绪 → PAD 小步差量）', () => {
  it('emotionResonanceDelta：sad 负向（负面增益>正面）、happy 正向、calm/neutral 趋近 0', () => {
    const sad = emotionResonanceDelta('sad');
    const happy = emotionResonanceDelta('happy');
    const calm = emotionResonanceDelta('calm');
    const neutral = emotionResonanceDelta('neutral');
    expect(sad.pleasure).toBeLessThan(0);
    expect(happy.pleasure).toBeGreaterThan(0);
    expect(Math.abs(sad.pleasure)).toBeGreaterThan(happy.pleasure); // 共情：负面略强
    expect(Math.abs(calm.pleasure)).toBeLessThan(1);
    expect(Math.abs(neutral.pleasure)).toBe(0);
  });

  it('applyEmotionResonance：sad 后 PAD 下降；registerEmotion 独立同步瞬时情绪', () => {
    const m = make();
    m.applyEmotionResonance('sad');
    expect(m.pad.pleasure).toBeLessThan(55);
    m.registerEmotion('sad');
    expect(data.mood.currentEmotion).toBe('sad');
    expect(saver).toHaveBeenCalled();
  });

  it('applyEmotionResonance：开心提升愉悦；calm 不误动心情（差量极小）', () => {
    const m = make();
    m.applyEmotionResonance('happy');
    expect(m.pad.pleasure).toBeGreaterThan(55);
    const before = m.pad.pleasure;
    m.applyEmotionResonance('calm');
    expect(Math.abs(m.pad.pleasure - before)).toBeLessThan(2);
  });

  it('applyEmotionResonance scale（ADR-0036）：credibility 0.3 → 差量 ×0.3 缩量（低可信度不猛推 PAD）', () => {
    // 共享同一份默认数据（性格调制一致），两系统同基线 55/50/50
    const shared = defaultSmartCatData();
    const a = new MoodSystem({} as any, () => shared, vi.fn<(d: SmartCatData) => Promise<void>>());
    const b = new MoodSystem({} as any, () => shared, vi.fn<(d: SmartCatData) => Promise<void>>());
    a.applyEmotionResonance('sad', 0.3);
    b.applyEmotionResonance('sad'); // 缺省 scale=1（既有调用不受影响）
    const dropA = 55 - a.pad.pleasure;
    const dropB = 55 - b.pad.pleasure;
    expect(dropA).toBeGreaterThan(0); // 低可信度仍小步共振，非归零
    expect(dropB).toBeGreaterThan(dropA); // 缩量：跌幅更小
    expect(dropA / dropB).toBeCloseTo(0.3, 1);
    // calm ×低可信度更不误动心情
    const before = a.pad.pleasure;
    a.applyEmotionResonance('calm', 0.3);
    expect(Math.abs(a.pad.pleasure - before)).toBeLessThan(2);
  });

  it('applyTrendDrift：declining → 愉悦/支配温和下降；improving → 愉悦回升；高波动 → 唤醒微升', () => {
    const m = make();
    m.pad = { pleasure: 60, arousal: 50, dominance: 55 };
    m.applyTrendDrift({ trend: 'declining', volatility: 0.3 });
    expect(m.pad.pleasure).toBeLessThan(60);
    expect(m.pad.dominance).toBeLessThan(55);
    m.pad = { pleasure: 50, arousal: 50, dominance: 50 };
    m.applyTrendDrift({ trend: 'improving', volatility: 0.3 });
    expect(m.pad.pleasure).toBeGreaterThan(50);
    m.pad = { pleasure: 50, arousal: 50, dominance: 50 };
    m.applyTrendDrift({ trend: 'stable', volatility: 0.8 });
    expect(m.pad.arousal).toBeGreaterThan(50);
    expect(m.pad.pleasure).toBe(50);
  });
});

describe('registerEmotion（瞬时情绪）', () => {
  it('写入 currentEmotion 并落盘', async () => {
    const m = make();
    m.registerEmotion('curious');
    expect(data.mood.currentEmotion).toBe('curious');
    expect(m.getCurrentEmotion()).toBe('curious');
    expect(saver).toHaveBeenCalled();
  });

  it('无情绪时返回 null（不误判）', () => {
    const m = make();
    expect(m.getCurrentEmotion()).toBeNull();
  });
});

describe('MoodSystem 持久化', () => {
  it('saveMoodState 写 pad/lastUpdate/lastMood', async () => {
    const m = make();
    m.pad.pleasure = 88;
    await m.saveMoodState();
    expect(data.mood.pad.pleasure).toBe(88);
    expect(data.mood.lastUpdate).toBeGreaterThan(0);
    expect(data.mood.lastMood).toBe(m.currentMood);
  });

  it('loadMoodState：24h 内合并持久化 PAD', () => {
    const m = make();
    data.mood.pad = { pleasure: 42, arousal: 40, dominance: 45 };
    data.mood.lastUpdate = Date.now();
    m.loadMoodState();
    expect(m.pad.pleasure).toBe(42);
  });

  it('loadMoodState：超 24h 陈旧归中性基线（ticket 095 设计 4，防重启假情绪）', () => {
    const m = make();
    data.mood.pad = { pleasure: 10, arousal: 10, dominance: 10 };
    data.mood.lastUpdate = Date.now() - 25 * 60 * 60 * 1000;
    m.loadMoodState();
    expect(m.pad.pleasure).toBe(50);
    expect(m.pad.arousal).toBe(50);
    expect(m.pad.dominance).toBe(50);
  });
});

describe('MoodSystem 衰减与互动', () => {
  it('startAutoDecay 空转守卫：60s 微小变化不落盘，累计 ≥0.5 才落盘', async () => {
    vi.useFakeTimers();
    const m = make();
    (m as any).lastSavedPad = null;
    m.startAutoDecay();
    // 首 tick 前无基准 → 落盘一次建立基线
    await vi.advanceTimersByTimeAsync(60000);
    (saver as any).mockClear();
    // 单次 60s 指数回摆（λ=0.07/h，默认 pad 距吸引子仅 ~4）变化 ≪0.5 → 空转不落盘
    await vi.advanceTimersByTimeAsync(60000);
    expect(saver).not.toHaveBeenCalled();
    // 累计 2 小时（~0.5 轴变化）→ 触发落盘
    await vi.advanceTimersByTimeAsync(2 * 60 * 60000);
    expect(saver).toHaveBeenCalled();
    vi.useRealTimers();
  }, 10000);

  it('handleInteraction：pet 无操作（072 撸猫退出数据面），note_create 照常加成', () => {
    const m = make();
    m.handleInteraction('pet', 1);
    expect(m.pad.pleasure).toBe(55);
    expect(m.pad.arousal).toBe(50);
    expect(m.pad.dominance).toBe(50);
    m.handleInteraction('note_create', 1);
    expect(m.pad.pleasure).toBeGreaterThan(55);
    expect(m.pad.dominance).toBeGreaterThan(50);
  });
});

describe('PersonalityGrowth（MATE ADR-0023）', () => {
  beforeEach(() => {
    data = defaultSmartCatData();
    saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  });

  it('撸猫（pet）退出一切数据面（ticket 072）：特质/信任/依恋/统计/历史/落盘全不动', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const snapBefore = JSON.parse(JSON.stringify(data.personalityGrowth));
    await pg.developBasedOnInteraction('pet', 1);
    expect(data.personalityGrowth).toEqual(snapBefore);
    expect(saver).not.toHaveBeenCalled();
  });

  it('talk 互动 → character_transition 微移（warmth 成长 + trust 上升 + 历史留痕）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const beforeWarmth = data.personalityGrowth.traits.warmth;
    const beforeTrust = data.personalityGrowth.relationship.trust;
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.traits.warmth).toBeGreaterThan(beforeWarmth);
    expect(data.personalityGrowth.relationship.trust).toBeGreaterThan(beforeTrust);
    expect(data.personalityGrowth.growthHistory.length).toBe(1);
    expect(data.personalityGrowth.growthHistory[0].source).toBe('interaction');
  });

  it('依恋慢跟随信任（ticket 072）：attachment 从死值 0.5 向 trust 方向移动且小于 trust', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.developBasedOnInteraction('talk', 1);
    const r = data.personalityGrowth.relationship;
    expect(r.attachment).toBeGreaterThan(0.5);
    expect(r.attachment).toBeLessThan(r.trust);
  });

  it('写日记/闪念计入信任成长：轻质量 0.15（ticket 025，ADR-0024 决策；软收拢 K=0.85 下增量=向 cap 收拢+gain）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const before = data.personalityGrowth.relationship.trust;
    await pg.developBasedOnInteraction('diary', 0.3, 0.02, 0.15);
    const delta = data.personalityGrowth.relationship.trust - before;
    expect(delta).toBeGreaterThan(0);
    // 0.5 → 软收拢 K=0.85：0.85 + 0.85×((0.5+0.00123)−0.85) ≈ 0.5560（低侧向 cap 收拢）
    expect(data.personalityGrowth.relationship.trust - before).toBeCloseTo(0.85 + TRUST_SOFT_K * ((before + 0.0082 * 0.15) - 0.85) - before, 6);
    // 默认 quality 仍为 0.5（聊天路径不变）：正增长；ticket 072 后 K=0.85 单步增量被
    // 「向 cap 收拢」主导（远低于 cap 时收拢项 >> gain），质量差异体现在平衡点高度而非单步增量
    const pg2 = new PersonalityGrowth(() => data, saver);
    const before2 = data.personalityGrowth.relationship.trust;
    await pg2.developBasedOnInteraction('learn', 1);
    expect(data.personalityGrowth.relationship.trust - before2).toBeGreaterThan(0);
    // 平衡点对比：轻质量档 v*≈cap+0.008，聊天档 v*≈cap+0.03——高质量恒收敛更高
    let light = 0.5;
    for (let i = 0; i < 3000; i++) light = trustUpdate(light, { warm: true, quality: 0.15, trustCap: TRUST_CAP ?? undefined });
    let chat = 0.5;
    for (let i = 0; i < 3000; i++) chat = trustUpdate(chat, { warm: true, quality: 0.5, trustCap: TRUST_CAP ?? undefined });
    expect(chat).toBeGreaterThan(light);
    expect(chat).toBeLessThan(0.9); // 软帽真实生效（旧 K=0.98 会双双顶到 0.999）
  });

  it('tickBehaviorStats：互动计数 + 活跃时段记录', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.behaviorStats.interactionCount).toBe(1);
    expect(data.personalityGrowth.behaviorStats.preferredHour).toBe(new Date().getHours());
  });

  it('applyWeeklyExperience：互动样本 <WEEKLY_MIN_INTERACTIONS 不深更新不清零不留痕（ticket 072 门槛）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    for (let i = 0; i < 20; i++) await pg.developBasedOnInteraction('talk', 1);
    const traitsBefore = { ...data.personalityGrowth.traits };
    const countBefore = data.personalityGrowth.behaviorStats.interactionCount;
    await pg.applyWeeklyExperience();
    expect(data.personalityGrowth.behaviorStats.interactionCount).toBe(countBefore);
    expect(data.personalityGrowth.growthHistory.some((h: any) => h.source === 'weekly')).toBe(false);
    expect(data.personalityGrowth.traits.warmth).toBe(traitsBefore.warmth);
  });

  it('applyWeeklyExperience：≥50 样本深更新——增益 ×DEEP_DELTA_SCALE 后微小、计数清零、历史留痕', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    for (let i = 0; i < 50; i++) await pg.developBasedOnInteraction('talk', 1);
    const beforeWarmth = data.personalityGrowth.traits.warmth;
    await pg.applyWeeklyExperience();
    expect(data.personalityGrowth.behaviorStats.interactionCount).toBe(0);
    expect(data.personalityGrowth.traits.warmth).toBeGreaterThanOrEqual(beforeWarmth);
    expect(data.personalityGrowth.traits.warmth - beforeWarmth).toBeLessThan(0.005); // 不再单次顶格 +0.01
    expect(data.personalityGrowth.growthHistory.some((h: any) => h.source === 'weekly')).toBe(true);
  });

  it('反思驱动：洞察含自我/关于我 → exist_depth 成长（仅反思渠道）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const before = data.personalityGrowth.traits.exist_depth;
    await pg.applyReflectionInsights([{ text: '用户认识到自己是个喜欢深夜写作的人' }]);
    expect(data.personalityGrowth.traits.exist_depth).toBeGreaterThan(before);
    expect(data.personalityGrowth.growthHistory.some((h: any) => h.source === 'reflection')).toBe(true);
  });

  it('反思驱动：情绪温暖洞察 → oxytocin 成长', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const before = data.personalityGrowth.traits.oxytocin;
    await pg.applyReflectionInsights([{ text: '用户和小橘之间建立了温暖信任的陪伴关系' }]);
    expect(data.personalityGrowth.traits.oxytocin).toBeGreaterThan(before);
  });

  it('反思驱动：无匹配关键字 → 不改变量（空洞察安全）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const before = { ...data.personalityGrowth.traits };
    await pg.applyReflectionInsights([]);
    expect(data.personalityGrowth.traits).toEqual(before);
    await pg.applyReflectionInsights([{ text: '与情感无关的描述' }]);
    expect(data.personalityGrowth.traits).toEqual(before);
  });

  it('preferredHour 真众数（ADR-0025）：有记忆数据时取近 30 天创建小时峰值，不再覆盖为最后小时', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    // 造 20 条 23 点创建的记忆（峰在 23 点）——每天一条、从昨天起算：
    // 原写法 now - i*h 再 setHours(23)，白天跑会把当日条目设到未来而被窗口过滤（时间敏感 flake）
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      const d = new Date(now - (i + 1) * 24 * 3600e3);
      d.setHours(23, Math.floor(Math.random() * 60), 0, 0);
      data.memory.stream.push({
        id: `mem${i}`, created: d.toISOString(), lastAccessed: d.toISOString(),
        description: `记忆${i}`, importance: 0.5, type: 'observation',
      });
    }
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.behaviorStats.preferredHour).toBe(23);
  });

  it('preferredHour 兜底（ADR-0025）：无记忆数据时保持当前小时（旧行为不变）', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.behaviorStats.preferredHour).toBe(new Date().getHours());
  });

  it('click/note_* 中性交互不动 trust（ADR-0025 修 warm 恒真）， chat/diary/flash 温暖上升', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    const before = data.personalityGrowth.relationship.trust;
    await pg.developBasedOnInteraction('click', 1);
    expect(data.personalityGrowth.relationship.trust).toBe(before);
    await pg.developBasedOnInteraction('note_read', 1);
    expect(data.personalityGrowth.relationship.trust).toBe(before);
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.relationship.trust).toBeGreaterThan(before);
  });

  it('基调表扩展（ticket 072）：diary/flash 轻正、talk/click/note_* 中性、未知类型轻微侵蚀', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.developBasedOnInteraction('diary', 1);
    expect(data.personalityGrowth.behaviorStats.emotionalTone).toBeGreaterThan(0);
    await pg.developBasedOnInteraction('flash', 1);
    expect(data.personalityGrowth.behaviorStats.emotionalTone).toBeGreaterThan(0);
    const t = data.personalityGrowth.behaviorStats.emotionalTone;
    await pg.developBasedOnInteraction('talk', 1);
    expect(data.personalityGrowth.behaviorStats.emotionalTone).toBe(t); // 中性不动
    await pg.developBasedOnInteraction('mystery', 1);
    expect(data.personalityGrowth.behaviorStats.emotionalTone).toBeLessThan(t); // 未知类型才轻微侵蚀
  });

  it('历史 trim 多样性保留（ticket 072）：互动刷屏时反思记录不被挤掉、互动只留最近 30 条', async () => {
    const pg = new PersonalityGrowth(() => data, saver);
    await pg.applyReflectionInsights([{ text: '用户喜欢深夜写作，习惯固定' }]);
    for (let i = 0; i < 120; i++) await pg.developBasedOnInteraction('talk', 1);
    const h = data.personalityGrowth.growthHistory;
    expect(h.filter((x: any) => x.source === 'reflection').length).toBeGreaterThanOrEqual(1);
    expect(h.filter((x: any) => x.source === 'interaction').length).toBeLessThanOrEqual(30);
    expect(h.length).toBeLessThanOrEqual(90);
  });
});