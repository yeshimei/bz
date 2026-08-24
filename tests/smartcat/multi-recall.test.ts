/**
 * 方向一：多路召回联想检索测试（ticket 096，ADR-0043）：
 *  - 槽位保留制（语义 ≤4 + 情绪 ≥1 + 时间 ≥1，总 ≤6；语义满/不满、保底让渡、保序去重）
 *  - 情绪路 VAD rerank（|affinity| 挑选、反向也入席、非硬过滤）
 *  - 时间路强锚点（星期几 / 周年·去年同期；小时粒度已砍）
 *  - 空 query 显式退化（recency+importance 现行为）
 *  - formatMemoriesForPrompt 兼容（不传 maxEntries 行为不变、superseded 先剔后收缩）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MemorySystem, PROMPT_SLOTS, selectSlotMemories,
  weekdayAnchorHit, anniversaryAnchorHit, padToVadVector,
} from '../../src/smartcat/memory';
import { isSupersededInsight } from '../../src/smartcat/insight-version';
import { emotionAffinity } from '../../src/smartcat/cognitive';
import { defaultSmartCatData } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import type { MemoryStreamEntry, SmartCatData } from '../../src/smartcat/types';

/** 固定「现在」：2026-08-24 00:00 本地时间（票据日期，周一；取午夜使日期差为整天数） */
const NOW = new Date(2026, 7, 24).getTime();
const DAY = 86400000;
const HOUR = 3600000;

function obs(id: string, opts: { daysAgo?: number; date?: Date; emotion?: string; importance?: number; type?: 'observation' | 'insight'; supersededBy?: string; desc?: string } = {}): MemoryStreamEntry {
  const t = opts.date ?? new Date(NOW - (opts.daysAgo ?? 1) * DAY);
  const m: MemoryStreamEntry = {
    id,
    created: t.toISOString(),
    lastAccessed: t.toISOString(),
    description: opts.desc ?? `记忆内容${id}`,
    importance: opts.importance ?? 0.5,
    type: opts.type ?? 'observation',
    source: 'chat',
  };
  if (opts.emotion) m.emotion = opts.emotion;
  if (opts.supersededBy) m.supersededBy = opts.supersededBy;
  return m;
}

/** 10 条 GA 序朴素观察（无情绪无锚点） */
function plain10(): MemoryStreamEntry[] {
  return Array.from({ length: 10 }, (_, i) => obs(`p${i}`, { daysAgo: i + 1 }));
}

beforeEach(() => {
  resetAIProviderCache();
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
});

describe('槽位保留选择（selectSlotMemories 纯函数）', () => {
  const vadHappy = padToVadVector({ pleasure: 90, arousal: 60, dominance: 60 }); // 用户当前偏正向

  it('常量契约：maxEntries=6 / 语义席 4 / 情绪·时间各保底 1', () => {
    expect(PROMPT_SLOTS.maxEntries).toBe(6);
    expect(PROMPT_SLOTS.semanticSeats).toBe(4);
    expect(PROMPT_SLOTS.emotionSeats).toBe(1);
    expect(PROMPT_SLOTS.timeSeats).toBe(1);
  });

  it('未超限直通：pool ≤ maxEntries 时整体返回（不收缩不重排）', () => {
    const pool = [obs('a'), obs('b'), obs('c')];
    const picked = selectSlotMemories(pool, { now: NOW });
    expect(picked).toHaveLength(3);
    expect(picked.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('语义满 + 无情绪候选：语义头部 4 席 + 星期几时间席（p6 恰 7 天前）+ GA 序回填', () => {
    const picked = selectSlotMemories(plain10(), { now: NOW });
    expect(picked).toHaveLength(6);
    // p0-p3 语义席；p6（恰 7 天前）同星期几占时间席；回填 p4 后满 6（p5 落选）
    expect(picked.map((m) => m.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p6']);
  });

  it('情绪席保底：带情绪候选深居 topN 尾部仍被提升入席', () => {
    const pool = plain10();
    pool[8] = obs('emo', { daysAgo: 9, emotion: 'happy' });
    const picked = selectSlotMemories(pool, { currentVad: vadHappy, now: NOW });
    expect(picked).toHaveLength(6);
    expect(picked.some((m) => m.id === 'emo')).toBe(true); // 情绪席占用 → 顶掉一个尾部语义名额
    expect(picked.map((m) => m.id)).not.toContain('p5');   // 被挤出的正是 GA 序最靠后的入选者
  });

  it('反向也有价值：用户当前正向、唯一候选是 sad → 反向亲和入席（rerank 非硬过滤）', () => {
    const pool = plain10();
    pool[7] = obs('sad_deep', { daysAgo: 8, emotion: 'sad' });
    const picked = selectSlotMemories(pool, { currentVad: vadHappy, now: NOW });
    expect(picked.some((m) => m.id === 'sad_deep')).toBe(true);
  });

  it('情绪席按 |affinity| 排序：同向 happy 击败反向 sad（用户当前强正向）', () => {
    const pool = plain10();
    pool[5] = obs('e_sad', { daysAgo: 6, emotion: 'sad' });
    pool[7] = obs('e_happy', { daysAgo: 8, emotion: 'happy' });
    // sanity：反向亲和严格弱于同向满命中（区分度存在才有排序意义）
    expect(Math.abs(emotionAffinity('sad', 'happy'))).toBeLessThan(emotionAffinity('happy', 'happy'));
    const picked = selectSlotMemories(pool, { currentVad: vadHappy, now: NOW });
    expect(picked.some((m) => m.id === 'e_happy')).toBe(true);
    expect(picked.some((m) => m.id === 'e_sad')).toBe(false); // 只有一个情绪席：高 |aff| 者胜出
  });

  it('未提供 currentVad：情绪席让渡给语义序（有候选必保、无输入不强凑）', () => {
    const pool = plain10();
    pool[8] = obs('emo', { daysAgo: 9, emotion: 'happy' });
    const picked = selectSlotMemories(pool, { now: NOW });
    expect(picked).toHaveLength(6);
    expect(picked.some((m) => m.id === 'emo')).toBe(false);
  });

  it('时间席保底：周年锚点 > 星期几锚点（score 2 > 1）', () => {
    const pool = plain10();
    pool[6] = obs('weekday_hit', { daysAgo: 14 });               // 两周前 = 同星期几
    pool[8] = obs('anniv_hit', { date: new Date(2025, 7, 25) }); // 去年同期（2025-08-25，±3 天内）
    const picked = selectSlotMemories(pool, { now: NOW });
    expect(picked).toHaveLength(6);
    expect(picked.some((m) => m.id === 'anniv_hit')).toBe(true);  // 时间席给了更强的周年
    expect(picked.some((m) => m.id === 'weekday_hit')).toBe(false);
  });

  it('只有星期几锚点时入席；洞察条目不参与情绪/时间席', () => {
    const pool = plain10();
    pool[6] = obs('weekday_only', { daysAgo: 14 });
    pool[8] = obs('ins_emotion', { daysAgo: 9, type: 'insight', emotion: 'happy' });
    const picked = selectSlotMemories(pool, { currentVad: vadHappy, now: NOW });
    expect(picked.some((m) => m.id === 'weekday_only')).toBe(true);
    expect(picked.some((m) => m.id === 'ins_emotion')).toBe(false); // insight 无席位资格
  });

  it('总数 ≤6 且保持原 GA 相对顺序、无重复', () => {
    const pool = plain10();
    pool[4] = obs('e1', { daysAgo: 5, emotion: 'excited' });
    pool[6] = obs('w1', { daysAgo: 14 });
    pool[8] = obs('a1', { date: new Date(2025, 7, 26) });
    const picked = selectSlotMemories(pool, { currentVad: vadHappy, now: NOW });
    expect(picked.length).toBeLessThanOrEqual(6);
    const ids = picked.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length); // 无重复
    const orderInPool = pool.filter((m) => ids.includes(m.id)).map((m) => m.id);
    expect(ids).toEqual(orderInPool); // 保序
  });

  it('语义不满：pool 只比 maxEntries 多 1 → 正常收缩不越界，情绪候选入席', () => {
    const pool = [obs('x0'), obs('x1'), obs('x2'), obs('x3'), obs('e_x', { emotion: 'calm' }), obs('x5'), obs('x6')];
    const picked = selectSlotMemories(pool, { currentVad: padToVadVector({ pleasure: 50, arousal: 50, dominance: 50 }), now: NOW });
    expect(picked).toHaveLength(6); // 7 → 6
    expect(picked.some((m) => m.id === 'e_x')).toBe(true); // 唯一情绪候选占情绪席
  });

  it('P2 契约边界：semanticSeats 越界传入时钳制到 maxEntries（返回子集永不突破总名额）', () => {
    const picked = selectSlotMemories(plain10(), { maxEntries: 2, semanticSeats: 8, now: NOW });
    expect(picked).toHaveLength(2); // 旧行为会返回 8 条突破上限
    expect(picked.map((m) => m.id)).toEqual(['p0', 'p1']); // GA 头部按钳制后的席位数保留
  });
});

describe('时间路强锚点（纯函数）', () => {
  it('weekdayAnchorHit：同星期几窗口 [1,42] 天命中；异星期几/当天/超窗/非法不命中', () => {
    expect(weekdayAnchorHit(new Date(NOW - 14 * DAY).toISOString(), NOW)).toBe(true);   // 两周前同星期几
    expect(weekdayAnchorHit(new Date(NOW - 42 * DAY).toISOString(), NOW)).toBe(true);   // 窗口边界内
    expect(weekdayAnchorHit(new Date(NOW - 43 * DAY).toISOString(), NOW)).toBe(false);  // 超窗
    expect(weekdayAnchorHit(new Date(NOW - 5 * HOUR).toISOString(), NOW)).toBe(false);  // 当天（<1 天）
    expect(weekdayAnchorHit(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(false);   // 异星期几
    expect(weekdayAnchorHit('not-a-date', NOW)).toBe(false);                            // 非法日期防御
    expect(weekdayAnchorHit('', NOW)).toBe(false);
  });

  it('anniversaryAnchorHit：去年同期 ±3 天命中；今年不算周年；容差边界精确', () => {
    expect(anniversaryAnchorHit(new Date(2025, 7, 24).toISOString(), NOW)).toBe(true);  // 整一年
    expect(anniversaryAnchorHit(new Date(2025, 7, 21).toISOString(), NOW)).toBe(true);  // −3 天边界
    expect(anniversaryAnchorHit(new Date(2025, 7, 27).toISOString(), NOW)).toBe(true);  // +3 天边界
    expect(anniversaryAnchorHit(new Date(2025, 7, 20).toISOString(), NOW)).toBe(false); // −4 天出界
    expect(anniversaryAnchorHit(new Date(2025, 7, 28).toISOString(), NOW)).toBe(false); // +4 天出界
    expect(anniversaryAnchorHit(new Date(2026, 7, 23).toISOString(), NOW)).toBe(false); // 今年同月日 ≠ 周年
    expect(anniversaryAnchorHit('bad', NOW)).toBe(false);
  });

  it('anniversaryAnchorHit 闰日安全：2024-02-29 的两周年落在 2026-03-01 ±容差内可命中', () => {
    const now = new Date(2026, 2, 1, 12).getTime(); // 2026-03-01
    expect(anniversaryAnchorHit(new Date(2024, 1, 29).toISOString(), now, 3)).toBe(true);
  });
});

describe('padToVadVector 归一', () => {
  it('PAD 0-100 → VAD [-1,1]；50=中性 0；越界钳制；非法值兜中性', () => {
    expect(padToVadVector({ pleasure: 50, arousal: 50, dominance: 50 })).toEqual({ valence: 0, arousal: 0, dominance: 0 });
    const full = padToVadVector({ pleasure: 100, arousal: 0, dominance: 75 });
    expect(full.valence).toBe(1);
    expect(full.arousal).toBe(-1);
    expect(full.dominance).toBe(0.5);
    const clamped = padToVadVector({ pleasure: 120, arousal: -20, dominance: 50 });
    expect(clamped.valence).toBe(1);
    expect(clamped.arousal).toBe(-1);
    expect(padToVadVector({ pleasure: NaN, arousal: 50, dominance: 50 }).valence).toBe(0); // 非法 → 中性
  });
});

describe('formatMemoriesForPrompt 槽位收缩（兼容冻结：不传 maxEntries 行为不变）', () => {
  function make(): { m: MemorySystem; data: SmartCatData } {
    const data = defaultSmartCatData();
    data.mood.pad = { pleasure: 90, arousal: 60, dominance: 60 };
    const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, vi.fn(async () => undefined));
    return { m, data };
  }

  it('不传 maxEntries：全量输出（既有行为回归锁）', () => {
    const { m } = make();
    const pool = Array.from({ length: 9 }, (_, i) => obs(`k${i}`, { daysAgo: i + 1 }));
    const text = m.formatMemoriesForPrompt(pool);
    expect(text.split('\n')).toHaveLength(9);
  });

  it('传 maxEntries=6：输出 ≤6 行且情绪席条目出现在文本中；编号连续', () => {
    const { m } = make();
    const pool = Array.from({ length: 9 }, (_, i) => obs(`k${i}`, { daysAgo: i + 1 }));
    pool[7] = obs('k_emo', { daysAgo: 8, emotion: 'happy', desc: '用户说：今天升职加薪了' });
    const text = m.formatMemoriesForPrompt(pool, PROMPT_SLOTS.maxEntries);
    const lines = text.split('\n').filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(text).toContain('今天升职加薪了'); // 情绪席被保留进 prompt
    lines.forEach((line, i) => expect(line.startsWith(`${i + 1}. `)).toBe(true)); // 编号重排连续
  });

  it('superseded 先剔后收缩：废弃洞察不占槽位名额也不出现', () => {
    const { m } = make();
    const pool = Array.from({ length: 8 }, (_, i) => obs(`s${i}`, { daysAgo: i + 1 }));
    pool.push(obs('dead', { type: 'insight', supersededBy: 's0', desc: '已被推翻的旧结论' }));
    expect(isSupersededInsight(pool[pool.length - 1])).toBe(true);
    const text = m.formatMemoriesForPrompt(pool, PROMPT_SLOTS.maxEntries);
    expect(text).not.toContain('已被推翻的旧结论');
    expect(text.split('\n').filter(Boolean).length).toBeLessThanOrEqual(6);
  });
});

describe('空 query 分支（显式退化：recency+importance 现行为）', () => {
  function makeWithStream(setup: (data: SmartCatData) => void): { m: MemorySystem; data: SmartCatData } {
    const data = defaultSmartCatData();
    setup(data);
    const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, vi.fn(async () => undefined));
    (m as any).ollamaAvailable = false;
    return { m, data };
  }

  it("retrieve('')：relevance 恒 0，GA 退化按 importance 排序（行为冻结）", async () => {
    const { m, data } = makeWithStream(() => {});
    await m.addObservation('完全无关的阿尔法内容', { importance: 0.3, source: 'chat' });
    await m.addObservation('另一条毫不相关的贝塔内容', { importance: 0.95, source: 'chat' });
    const results = await m.retrieve('');
    void data;
    expect(results).toHaveLength(2);
    expect(results[0].description).toContain('贝塔'); // importance 主导，无关键词参与
    expect(m.lexicalRelevance(results[0], '')).toBe(0);
  });

  it('空 query 下情绪/时间槽位修饰照常生效（不依赖 query）', async () => {
    // 直插流模拟「多数条目尚无情绪标注（追标前密度现实）+ 一条已追标的 sad」
    const { m, data } = makeWithStream((d) => {
      d.mood.pad = { pleasure: 15, arousal: 30, dominance: 35 }; // 用户当前低落
      for (let i = 0; i < 8; i++) {
        d.memory.stream.push({
          id: `f${i}`,
          created: new Date(Date.now() - (i + 1) * DAY).toISOString(),
          lastAccessed: new Date(Date.now() - (i + 1) * DAY).toISOString(),
          description: `普通流水记录第${i}条`,
          importance: 0.5,
          type: 'observation',
          source: 'chat',
        });
      }
      d.memory.stream[7].emotion = 'sad'; // H3 追标产物（唯一带情绪候选，深居 GA 尾部）
    });
    const mems = await m.retrieve('');
    const text = m.formatMemoriesForPrompt(mems, PROMPT_SLOTS.maxEntries);
    // 低落时刻想起难过的事——情绪席在空 query 下也生效；f6（恰 7 天前）同时命中星期几时间席
    expect(text).toContain('普通流水记录第7条'); // 情绪席
    expect(text).toContain('普通流水记录第6条'); // 时间席（同星期几）
    expect(text.split('\n').filter(Boolean).length).toBeLessThanOrEqual(6);
  });
});