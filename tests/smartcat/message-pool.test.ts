// @vitest-environment node
/**
 * smartcat 消息池测试（ADR-0206，取代 messages.test.ts）：
 * 消费=用一条删一条、池空落兜底、setup 恒兜底（UX 54 引导方向保留）、
 * 批量解析畸形容忍、特性快照与生成 prompt、补货三重节流（水位/单飞锁/冷却/日上限，失败静默进冷却）、
 * SmartCatData.messagePool 归一化（缺省容忍零迁移 + 容量截断）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MessagePoolSystem,
  FALLBACK_MESSAGES,
  SETUP_FALLBACK_MESSAGES,
  pickSetupMessage,
  POOL_KEYS,
  BATCH_SIZE,
  buildPoolPrompt,
  buildTraitSnapshot,
  parsePoolBatch,
  describeDaypart,
  ensurePool,
} from '../../src/smartcat/message-pool';
import { defaultSmartCatData, normalizeData } from '../../src/smartcat/data';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';
import type { SmartCatData } from '../../src/smartcat/types';

/** 构造受控系统：saver 桩 + 内存 data 引用（consume/onTick 直接改内存段，断言可见） */
function makeSys(data: SmartCatData = defaultSmartCatData()) {
  const saver = vi.fn(async (_d: SmartCatData) => { /* 测试不真写盘 */ });
  return { data, saver, sys: new MessagePoolSystem(() => data, saver) };
}

/** 预置冷却（消费路径的惰性补货不再真发 AI） */
function coolDown(sys: MessagePoolSystem): void {
  (sys as any).lastRestockAt = Date.now();
}

/** AI 配置开关（配 key = 已配置；「未配」用 zhipuPlan 空 key——deepseek 空 key 会走 QuickAdd 兜底，路径不定） */
function setAI(ok: boolean): void {
  resetAIProviderCache();
  setAISettingsProvider(() => ok
    ? ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' } as any)
    : ({ aiProvider: 'zhipuPlan', zhipuPlanApiKey: '' } as any));
}

/** chat completions fetch mock：返回 {messages: [...]} JSON 通道载荷；echoPrompt 把 system 回显进载荷供断言 */
function mockPoolFetch(payload: any, opts: { fail?: boolean; echoPrompt?: boolean } = {}): ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: string, init?: any) => {
    if (opts.fail) throw new Error('网络挂了');
    if (opts.echoPrompt) {
      const body = JSON.parse((init as any)?.body || '{}');
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ promptEcho: body?.messages?.[0]?.content, ...payload }) } }] }) };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
  });
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
});

afterEach(() => {
  delete (globalThis as any).fetch;
  resetAIProviderCache();
});

describe('消费：用一条删一条（ADR-0206 核心语义）', () => {
  it('池内 shift 消费，取一条少一条', () => {
    const { data, sys } = makeSys();
    data.messagePool = { pet: ['甲', '乙', '丙'], connected: [], welcomeBack: [], thinking: [] };
    coolDown(sys);
    expect(sys.consume('pet')).toBe('甲');
    expect(data.messagePool!.pet).toEqual(['乙', '丙']);
    expect(sys.consume('pet')).toBe('乙');
    expect(data.messagePool!.pet).toEqual(['丙']);
  });

  it('池空回落兜底语料（池空落水姿势）', () => {
    const { sys } = makeSys();
    coolDown(sys);
    const msg = sys.consume('welcomeBack');
    expect(FALLBACK_MESSAGES.welcomeBack).toContain(msg);
  });

  it('消费标脏，onTick 防抖落盘一次；无新消费不重写', async () => {
    const { data, saver, sys } = makeSys();
    data.messagePool = { pet: ['甲'], connected: [], welcomeBack: [], thinking: [] };
    coolDown(sys);
    sys.consume('pet');
    expect(saver).not.toHaveBeenCalled(); // 消费只标脏
    await sys.onTick();
    expect(saver).toHaveBeenCalledTimes(1);
    await sys.onTick();
    expect(saver).toHaveBeenCalledTimes(1); // 脏位已复位
  });

  it('ensurePool：缺段容忍建段（旧数据零迁移）', () => {
    const data = defaultSmartCatData();
    data.messagePool = undefined;
    const pool = ensurePool(data, 'thinking');
    expect(pool).toEqual([]);
    expect(data.messagePool!.thinking).toBe(pool);
  });
});

describe('兜底语料与 setup 引导', () => {
  it('四类型兜底各 3~5 条、非空串、类型内不重复', () => {
    for (const key of POOL_KEYS) {
      expect(FALLBACK_MESSAGES[key].length).toBeGreaterThanOrEqual(3);
      expect(FALLBACK_MESSAGES[key].length).toBeLessThanOrEqual(5);
      expect(new Set(FALLBACK_MESSAGES[key]).size).toBe(FALLBACK_MESSAGES[key].length);
      for (const m of FALLBACK_MESSAGES[key]) expect(m.trim().length).toBeGreaterThan(0);
    }
  });

  it('setup 兜底 3~5 条，保留「配置/接入 AI」引导方向（UX 54）且互不重复', () => {
    expect(SETUP_FALLBACK_MESSAGES.length).toBeGreaterThanOrEqual(3);
    expect(SETUP_FALLBACK_MESSAGES.length).toBeLessThanOrEqual(5);
    for (const m of SETUP_FALLBACK_MESSAGES) {
      expect(m).toContain('AI');
      expect(m).toMatch(/配置|接上|配上/);
    }
    expect(new Set(SETUP_FALLBACK_MESSAGES).size).toBe(SETUP_FALLBACK_MESSAGES.length);
    expect(SETUP_FALLBACK_MESSAGES).toContain(pickSetupMessage());
  });
});

describe('生成批次解析（畸形容忍）', () => {
  it('合法数组原样收、非串/空串/纯空白剥除、去重、超量截断到批量', () => {
    const batch = parsePoolBatch({
      messages: ['甲', ' 乙 ', 42, null, '', '   ', '甲', ...Array.from({ length: 12 }, (_, i) => `第${i}条`)],
    });
    expect(batch[0]).toBe('甲');
    expect(batch[1]).toBe('乙');
    expect(batch).not.toContain('');
    expect(new Set(batch).size).toBe(batch.length);
    expect(batch.length).toBe(BATCH_SIZE);
  });

  it('非数组/undefined → 空批', () => {
    expect(parsePoolBatch(undefined)).toEqual([]);
    expect(parsePoolBatch({})).toEqual([]);
    expect(parsePoolBatch({ messages: '不是数组' })).toEqual([]);
  });
});

describe('特性快照与生成 prompt', () => {
  it('快照含心情档/情绪/性格/关系阶段/时段，默认数据也不空', () => {
    const snap = buildTraitSnapshot(defaultSmartCatData());
    expect(snap).toContain('心情：');
    expect(snap).toContain('关系阶段：');
    expect(snap).toContain('时段：');

    const data = defaultSmartCatData();
    data.mood.pad = { pleasure: 20, arousal: 30, dominance: 40 };
    data.mood.currentEmotion = 'sad';
    data.personalityGrowth.traits.anxiety = 0.9;
    const snap2 = buildTraitSnapshot(data);
    expect(snap2).toContain('当前情绪：sad');
    expect(snap2).toContain('心情：');
  });

  it('时段分界（深夜/早晨/中午/下午/晚上）', () => {
    expect(describeDaypart(4)).toBe('深夜');
    expect(describeDaypart(8)).toBe('早晨');
    expect(describeDaypart(13)).toBe('中午');
    expect(describeDaypart(16)).toBe('下午');
    expect(describeDaypart(20)).toBe('晚上');
    expect(describeDaypart(23)).toBe('深夜');
  });

  it('prompt：system 带场景/风格示例/JSON 契约与快照，user 触发生成', () => {
    const [sys, user] = buildPoolPrompt('pet', '- 心情：很好\n- 时段：早晨');
    expect(sys.role).toBe('system');
    expect(sys.content).toContain('抚摸互动');
    expect(sys.content).toContain('只输出 JSON');
    expect(sys.content).toContain('- 心情：很好');
    expect(sys.content).toMatch(/风格示例/);
    expect(user.role).toBe('user');
  });
});

describe('补货三重节流（水位 / 单飞锁 / 冷却 / 日上限）', () => {
  it('水位未到（四池各 = 3）不发起生成', async () => {
    setAI(true);
    const { data, sys } = makeSys();
    // 水位按类型独立判定：四池全部到水位才静默
    data.messagePool = { pet: ['一', '二', '三'], connected: ['一', '二', '三'], welcomeBack: ['一', '二', '三'], thinking: ['一', '二', '三'] };
    const fetchMock = mockPoolFetch({ messages: ['x'] });
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('低于水位 + 已配 AI → 生成一批入池并即时落盘，日计数推进', async () => {
    setAI(true);
    const { data, saver, sys } = makeSys();
    const payload = { messages: Array.from({ length: BATCH_SIZE }, (_, i) => `新语料${i}`) };
    const fetchMock = mockPoolFetch(payload);
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    expect(data.messagePool!.pet.length).toBe(BATCH_SIZE);
    expect(data.messagePool!.pet[0]).toBe('新语料0');
    expect(saver).toHaveBeenCalledTimes(1);
    expect((sys as any).batchesToday).toBe(1);
  });

  it('冷却生效：成功一批后紧接的补货门不再发请求', async () => {
    setAI(true);
    const { sys } = makeSys();
    const fetchMock = mockPoolFetch({ messages: ['甲', '乙'] });
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 消费两条降到水位下再试——冷却期内仍不发
    coolDown(sys); // 显式压冷却（成功路径本身已置 lastRestockAt，双保险表达意图）
    await sys.maybeRestock();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('生成失败静默：池不动、不抛错、同样进冷却', async () => {
    setAI(true);
    const { data, sys } = makeSys();
    const fetchMock = mockPoolFetch({}, { fail: true });
    (globalThis as any).fetch = fetchMock;
    await expect(sys.maybeRestock()).resolves.toBeUndefined();
    expect(data.messagePool!.pet).toEqual([]);
    expect((sys as any).lastRestockAt).toBeGreaterThan(0);
    await sys.maybeRestock();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('单飞锁：生成中不再发起', async () => {
    setAI(true);
    const { sys } = makeSys();
    const fetchMock = mockPoolFetch({ messages: ['x'] });
    (globalThis as any).fetch = fetchMock;
    (sys as any).generating = true;
    await sys.maybeRestock();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('日上限：当日批数打满即静默', async () => {
    setAI(true);
    const { sys } = makeSys();
    (sys as any).dayKey = new Date().toDateString();
    (sys as any).batchesToday = 6;
    const fetchMock = mockPoolFetch({ messages: ['x'] });
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('未配 AI：不发起生成（未配 AI 落水姿势恒兜底）', async () => {
    setAI(false);
    const { sys } = makeSys();
    const fetchMock = mockPoolFetch({ messages: ['x'] });
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('生成请求携带场景契约与特性快照（fetch 报文回显断言）', async () => {
    setAI(true);
    const { data, sys } = makeSys();
    data.mood.currentEmotion = 'playful';
    const fetchMock = mockPoolFetch({ messages: ['x'] }, { echoPrompt: true });
    (globalThis as any).fetch = fetchMock;
    await sys.maybeRestock();
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    const system: string = body.messages[0].content;
    expect(system).toContain('抚摸互动');
    expect(system).toContain('当前情绪：playful');
    expect(system).toContain('只输出 JSON');
  });
});

describe('SmartCatData.messagePool 归一化（数据段）', () => {
  it('默认数据：四类型空池', () => {
    const d = defaultSmartCatData();
    expect(d.messagePool).toEqual({ pet: [], connected: [], welcomeBack: [], thinking: [] });
  });

  it('旧数据无 messagePool 段 → 补齐空池（缺省容忍零迁移）', () => {
    const raw: any = { config: {}, mood: { pad: { pleasure: 50, arousal: 50, dominance: 50 } }, memory: { memoryStream: [], behaviorStream: [] } };
    const d = normalizeData(raw);
    expect(d.messagePool).toEqual({ pet: [], connected: [], welcomeBack: [], thinking: [] });
  });

  it('非法条目剥除 + 容量截断（防病态增长）', () => {
    const raw: any = {
      memory: { memoryStream: [], behaviorStream: [] },
      messagePool: {
        pet: ['好的', 42, null, '', '   ', '也是好的'],
        connected: Array.from({ length: 25 }, (_, i) => `超量${i}`),
        welcomeBack: '不是数组',
        thinking: undefined,
      },
    };
    const d = normalizeData(raw);
    expect(d.messagePool!.pet).toEqual(['好的', '也是好的']);
    expect(d.messagePool!.connected.length).toBe(20);
    expect(d.messagePool!.welcomeBack).toEqual([]);
    expect(d.messagePool!.thinking).toEqual([]);
  });
});
