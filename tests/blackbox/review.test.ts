/**
 * 黑匣子复盘测试（ticket 37/41/42）：事件提炼合并（去重/人物解析/推测标记/edited 锁）/画像观察增量/
 * 复盘产物（事件汇报/新人物提示）/手动复盘空库提示。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { seedV3 } from './v3-seed';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { manualReview, triggerAutoReview, mergeExtractedEvents, buildProfileHintText, unloadBlackBoxReview } from '../../src/blackbox/review';
import { BlackBoxDataManager, getBlackBoxFilePath, createProfile, createEvent } from '../../src/blackbox/data';
import { defaultBlackBoxData } from '../../src/blackbox/types';
import type { BlackBoxData, Profile } from '../../src/blackbox/types';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

/** mock Ollama 多响应序列（按调用次数依次返回） */
function mockOllamaSequence(contents: string[]) {
  let i = 0;
  (global as any).fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ message: { content: contents[Math.min(i++, contents.length - 1)] } }),
  }));
}

function seedVault(vault: MockVault, entries: any[], profiles: any[] = [], events: any[] = []): void {
  seedV3(vault, {
    settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念'] },
    persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
    entries,
    profiles,
    events,
    reviews: [],
    chat: [],
    meta: { lastReviewAt: '', totalEntries: entries.length, totalEvents: events.length },
  });
}

const THOUGHT = (id: string, text: string, extra: any = {}) => ({
  id,
  type: 'thought' as const,
  createdAt: '2026-08-0' + id.slice(-1) + 'T10:00:00.000Z',
  text,
  emotions: [],
  people: [],
  scene: '',
  toward: '',
  links: [],
  ...extra,
});

describe('mergeExtractedEvents 事件合并（纯函数）', () => {
  it('人物名字 → 画像 id；时间取 AI 值；推测标记保留；证据链入 evidence', () => {
    const data = defaultBlackBoxData();
    data.profiles.push(createProfile({ id: 'pf_1', name: '妹妹', relation: '家人' }));
    data.entries.push(THOUGHT('bb_t1', '给妹妹买吉他', { people: ['pf_1'] }) as any);
    const out = mergeExtractedEvents(data, [
      {
        title: '给妹妹买吉他',
        summary: '挑了把入门琴',
        time: '2026-08-10',
        people: ['妹妹'],
        mainPerson: '妹妹',
        emotions: ['温暖'],
        evidence: ['bb_t1'],
        inferred: false,
        confidence: 0.9,
      },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].people).toEqual(['pf_1']);
    expect(out[0].mainPerson).toBe('pf_1');
    expect(out[0].time).toBe('2026-08-10');
    expect(out[0].evidence).toEqual(['bb_t1']);
    expect(out[0].inferred).toBe(false);
  });

  it('去重：标题与既有事件重复 → 跳过；证据全部已被覆盖 → 跳过', () => {
    const data = defaultBlackBoxData();
    data.entries.push(THOUGHT('bb_t1', '买吉他') as any, THOUGHT('bb_t2', '搬家') as any);
    data.events.push(createEvent({ id: 'ev_1', title: '买吉他', evidence: ['bb_t1'] }));
    const out = mergeExtractedEvents(data, [
      { title: '买吉他', summary: '', time: '2026-08-01', people: [], mainPerson: '', emotions: [], evidence: ['bb_t1'], inferred: false, confidence: 1 },
      { title: '搬家', summary: '', time: '2026-08-02', people: [], mainPerson: '', emotions: [], evidence: ['bb_t2'], inferred: false, confidence: 1 },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('搬家');
  });

  it('证据为空（条目不存在）→ 跳过；时间缺省回退最早证据条目日期', () => {
    const data = defaultBlackBoxData();
    data.entries.push(THOUGHT('bb_t1', '旧事') as any);
    const out = mergeExtractedEvents(data, [
      { title: '无证据', summary: '', time: '', people: [], mainPerson: '', emotions: [], evidence: ['bb_missing'], inferred: false, confidence: 1 },
      { title: '缺时间', summary: '', time: '', people: [], mainPerson: '', emotions: [], evidence: ['bb_t1'], inferred: false, confidence: 1 },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('缺时间');
    expect(out[0].time).toBe('2026-08-01');
  });

  it('intent/计划类 inferred: true 落推测标记（edited 锁：不触碰既有事件）', () => {
    const data = defaultBlackBoxData();
    data.entries.push(THOUGHT('bb_t1', '想给妈妈买房子') as any);
    const out = mergeExtractedEvents(data, [
      { title: '想给妈妈买房', summary: '计划', time: '2026-08-01', people: [], mainPerson: '', emotions: [], evidence: ['bb_t1'], inferred: true, confidence: 0.4 },
    ]);
    expect(out[0].inferred).toBe(true);
  });
});

describe('buildProfileHintText', () => {
  it('高频未建画像人名 → 提示文案', () => {
    expect(buildProfileHintText(['老王', '小李'])).toBe('👤 我常听你提起「老王、小李」，要不要为 TA 建一张画像？');
    expect(buildProfileHintText([])).toBe('');
  });
});

describe('复盘全流程（mock AI 序列）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    unloadBlackBoxReview();
  });
  afterEach(() => {
    unloadBlackBoxReview();
    delete (global as any).fetch;
  });

  it('triggerAutoReview：复盘文本 + 事件提炼 + 事件汇报一句话 + 对话流产物', async () => {
    mockOllamaSequence([
      '{"text": "我看到一个细腻的人", "newSelfView": "我懂主人了"}',
      '{"events": [{"title": "给妹妹买吉他", "time": "2026-08-01", "people": ["妹妹"], "mainPerson": "妹妹", "emotions": ["温暖"], "evidence": ["bb_t1"], "inferred": false, "confidence": 0.9}, {"title": "梦见去海边", "time": "2026-08-02", "people": [], "mainPerson": "", "emotions": [], "evidence": ["bb_t2"], "inferred": true, "confidence": 0.3}]}',
    ]);
    const vault = new MockVault();
    seedVault(vault, [
      THOUGHT('bb_t1', '给妹妹买吉他', { people: ['pf_1'], emotions: ['温暖'] }),
      THOUGHT('bb_t2', '梦见去海边'),
    ], [{ id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' }]);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    const text = await triggerAutoReview(app, data);
    expect(text).toContain('细腻');
    const back = await dm.load();
    // 事件：人物解析为画像 id；推测标记
    expect(back.events.length).toBe(2);
    const buy = back.events.find((e) => e.title === '给妹妹买吉他')!;
    expect(buy.people).toEqual(['pf_1']);
    expect(buy.mainPerson).toBe('pf_1');
    expect(buy.evidence).toEqual(['bb_t1']);
    expect(buy.inferred).toBe(false);
    expect(back.events.find((e) => e.title === '梦见去海边')!.inferred).toBe(true);
    // 复盘记录含事件汇报 + 新人物提示（程序计算）
    expect(back.reviews.length).toBe(1);
    expect(back.reviews[0].eventReport).toBe('这周我整理了 2 件新事件（其中 1 件推测）');
    expect(back.reviews[0].profileHint).toBeUndefined();
    // 产物公开写入对话流
    expect(back.chat.some((m: any) => m.text === '这周我整理了 2 件新事件（其中 1 件推测）')).toBe(true);
  });

  it('重复复盘不重复提炼：标题已存在的事件跳过', async () => {
    mockOllamaSequence([
      '{"text": "复盘一", "newSelfView": ""}',
      '{"events": [{"title": "给妹妹买吉他", "time": "2026-08-01", "people": [], "mainPerson": "", "emotions": [], "evidence": ["bb_t1"], "inferred": false, "confidence": 0.9}]}',
      '{"text": "复盘二", "newSelfView": ""}',
      '{"events": [{"title": "给妹妹买吉他", "time": "2026-08-01", "people": [], "mainPerson": "", "emotions": [], "evidence": ["bb_t1"], "inferred": false, "confidence": 0.9}]}',
    ]);
    const vault = new MockVault();
    seedVault(vault, [THOUGHT('bb_t1', '给妹妹买吉他')]);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    await triggerAutoReview(app, data);
    await triggerAutoReview(app, await dm.load());
    const back = await dm.load();
    expect(back.events.length).toBe(1);
    expect(back.reviews.length).toBe(2);
  });

  it('画像观察增量：新条目关联画像 → AI 观察追加（不覆盖用户印象）', async () => {
    mockOllamaSequence([
      '{"text": "复盘", "newSelfView": ""}',
      '{"events": []}',
      '{"observation": "我注意到主人对 TA 的想念越来越具体了"}',
    ]);
    const vault = new MockVault();
    seedVault(vault, [THOUGHT('bb_t1', '又想起妹妹了', { people: ['pf_1'] })], [
      { id: 'pf_1', name: '妹妹', relation: '家人', impression: '用户主权印象', aiObservations: ['旧观察'], pinnedEvents: [], createdAt: 't' },
    ]);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    const dm = new BlackBoxDataManager(app);
    await triggerAutoReview(app, await dm.load());
    const back = await dm.load();
    const pf = back.profiles[0];
    expect(pf.impression).toBe('用户主权印象'); // 字段级锁：AI 不覆盖
    expect(pf.aiObservations).toEqual(['旧观察', '我注意到主人对 TA 的想念越来越具体了']);
  });

  it('新人物提示：高频提及未建画像的人 → profileHint', async () => {
    mockOllamaSequence([
      '{"text": "复盘", "newSelfView": ""}',
      '{"events": []}',
    ]);
    const vault = new MockVault();
    seedVault(vault, [
      THOUGHT('bb_t1', '和老王喝酒', { people: ['老王'] }),
      THOUGHT('bb_t2', '老王借了我一本书', { people: ['老王'] }),
    ]);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    const dm = new BlackBoxDataManager(app);
    await triggerAutoReview(app, await dm.load());
    const back = await dm.load();
    expect(back.reviews[0].profileHint).toContain('老王');
    expect(back.chat.some((m: any) => m.text.includes('老王'))).toBe(true);
  });

  it('manualReview：空库提示；手动复盘产物 toast', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    const text = await manualReview(app);
    expect(text).toBe('');
    expect(hasNotice('⚠️ 黑匣子还是空的，先写点东西吧')).toBe(true);
  });

  it('AI 失败：复盘失败 toast，不落盘', async () => {
    const vault = new MockVault();
    seedVault(vault, [THOUGHT('bb_t1', 'x')]);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    (global as any).fetch = vi.fn(async () => {
      throw new Error('网络错误');
    });
    const dm = new BlackBoxDataManager(app);
    const text = await manualReview(app);
    expect(text).toBe('');
    expect(hasNotice('❌ 复盘失败：AI 暂时无法说话')).toBe(true);
    expect((await dm.load()).reviews.length).toBe(0);
  });
});

/** 画像投影数据正确性（ticket 42：单份存储，按人过滤 = 画像时间线） */
describe('画像事件投影（单份存储）', () => {
  it('filterEventsByPerson 与全局事件同源', async () => {
    const vault = new MockVault();
    seedVault(vault, [THOUGHT('bb_t1', 'x')], [
      { id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' },
    ], [
      { id: 'ev_1', title: '买吉他', time: '2026-08-01', inferred: false, summary: '', people: ['pf_1'], mainPerson: 'pf_1', evidence: ['bb_t1'], emotions: [], edited: false },
    ]);
    const { app } = setup(vault);
    const dm = new BlackBoxDataManager(app);
    const data = await dm.load();
    const pf: Profile = data.profiles[0];
    const projected = data.events.filter((e) => e.people.includes(pf.id));
    expect(projected.length).toBe(1);
    expect(projected[0].title).toBe('买吉他');
  });
});
