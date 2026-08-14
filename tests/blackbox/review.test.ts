/**
 * 黑匣子复盘测试（ticket 62）：手动触发 → 四段报告 JSON 落盘 reviews[] + 对话流可见 +
 * 新人物提示 + 画像 AI 观察聚合（≤5 裁旧）+ 失败降级。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BlackBoxDataManager, createProfile } from '../../src/blackbox/data';
import { buildReviewPrompt, parseReviewJson, applyReview, manualReview } from '../../src/blackbox/review';
import { defaultBlackBoxData } from '../../src/blackbox/types';
import type { DiarySourceEntry } from '../../src/blackbox/types';

const ENTRIES: DiarySourceEntry[] = [
  { date: '2026-08-10', time: '08:30', content: '和妈妈搬完家，累但踏实。', filename: '2026-08-10', lineNumber: 1 },
  { date: '2026-08-11', time: '09:00', content: '妈妈来新家帮忙收拾。', filename: '2026-08-11', lineNumber: 1 },
];

function makeAI(result: string, reject = false) {
  return { json: reject ? vi.fn().mockRejectedValue(new Error('AI 挂了')) : vi.fn().mockResolvedValue(result) } as any;
}

const REVIEW_JSON = JSON.stringify({
  profileUpdates: ['妈妈（提及 3 次）：搬家期间很可靠（2026-08-10 日记）'],
  eventSummary: ['搬家完成（8/10）', '新人物：老张（提及 2 次）'],
  emotionTrend: '本周以疲惫为主，周末转释然。',
  reflections: ['搬家后作息需要调整。'],
  newPeople: ['老张'],
});

describe('buildReviewPrompt', () => {
  it('含期间条目 + 画像 + 四段结构要求', () => {
    const prompt = buildReviewPrompt(ENTRIES, [{ id: 'pf_1', name: '妈妈' } as any], []);
    expect(prompt).toContain('2026-08-10');
    expect(prompt).toContain('和妈妈搬完家');
    expect(prompt).toContain('妈妈');
    expect(prompt).toContain('profileUpdates');
    expect(prompt).toContain('eventSummary');
    expect(prompt).toContain('emotionTrend');
    expect(prompt).toContain('reflections');
  });
  it('空条目 → null', () => {
    expect(buildReviewPrompt([], [], [])).toBeNull();
  });
});

describe('parseReviewJson', () => {
  it('正常 JSON → 四段结构化', () => {
    const r = parseReviewJson(REVIEW_JSON);
    expect(r).not.toBeNull();
    expect(r!.profileUpdates).toEqual(['妈妈（提及 3 次）：搬家期间很可靠（2026-08-10 日记）']);
    expect(r!.newPeople).toEqual(['老张']);
  });
  it('代码块包裹 → 剥离解析', () => {
    const r = parseReviewJson('```json\n' + REVIEW_JSON + '\n```');
    expect(r!.reflections).toHaveLength(1);
  });
  it('损坏 → null', () => {
    expect(parseReviewJson('坏了')).toBeNull();
  });
  it('字段缺失 → 空数组默认', () => {
    const r = parseReviewJson('{"profileUpdates":["a"]}');
    expect(r!.eventSummary).toEqual([]);
    expect(r!.newPeople).toEqual([]);
  });
});

describe('applyReview', () => {
  it('四段报告落盘 reviews[] + period 范围 + 对话流可见', () => {
    const data = defaultBlackBoxData();
    const result = parseReviewJson(REVIEW_JSON)!;
    applyReview(data, result, ENTRIES);
    expect(data.reviews).toHaveLength(1);
    const rv = data.reviews[0];
    expect(rv.period.from).toBe('2026-08-10');
    expect(rv.period.to).toBe('2026-08-11');
    expect(rv.report.profileUpdates).toHaveLength(1);
    expect(rv.report.reflections).toHaveLength(1);
    // 对话流可见（chat 追加 assistant 消息）
    expect(data.chat.some((c) => c.role === 'assistant' && c.content.includes('复盘'))).toBe(true);
  });

  it('画像 AI 观察聚合：追加观察 ≤5 裁旧 + 不覆盖用户印象', () => {
    const data = defaultBlackBoxData();
    const p = createProfile('妈妈', '2026-08-10');
    p.impression = '用户印象';
    p.aiObservations = [
      { ts: '2026-08-01T00:00:00', text: '旧观察1', source: { path: 'x', lineNumber: 1, time: '08:00' } },
      { ts: '2026-08-02T00:00:00', text: '旧观察2', source: { path: 'x', lineNumber: 1, time: '08:00' } },
      { ts: '2026-08-03T00:00:00', text: '旧观察3', source: { path: 'x', lineNumber: 1, time: '08:00' } },
      { ts: '2026-08-04T00:00:00', text: '旧观察4', source: { path: 'x', lineNumber: 1, time: '08:00' } },
      { ts: '2026-08-05T00:00:00', text: '旧观察5', source: { path: 'x', lineNumber: 1, time: '08:00' } },
    ];
    data.profiles.push(p);
    const result = parseReviewJson(REVIEW_JSON)!;
    applyReview(data, result, ENTRIES);
    // 追加 1 条 → 裁最旧 1 条（保持 5 条上限）
    expect(data.profiles[0].aiObservations).toHaveLength(5);
    expect(data.profiles[0].aiObservations[4].text).toContain('搬家期间很可靠');
    // 用户印象不被覆盖
    expect(data.profiles[0].impression).toBe('用户印象');
  });

  it('新人物提示：result.newPeople 非空 → 保留在 review.newPeople（一键确认建画像由 UI 层提供）', () => {
    const data = defaultBlackBoxData();
    const result = parseReviewJson(REVIEW_JSON)!;
    applyReview(data, result, ENTRIES);
    expect(data.reviews[0].newPeople).toEqual(['老张']);
  });
});

describe('manualReview（命令入口）', () => {
  beforeEach(() => resetObsidianMocks());

  async function setup() {
    const vault = new MockVault();
    vault.create('我的/日记/2026-08-10.md', '# 📖 08:30\n\n和妈妈搬完家。\n');
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    return { vault, app };
  }

  it('触发 → AI 分析 → reviews[] 落盘 + chat 追加', async () => {
    const { app } = await setup();
    const ai = makeAI(REVIEW_JSON);
    const ok = await manualReview(app, ai);
    expect(ok).toBe(true);
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.reviews).toHaveLength(1);
    expect(data.chat.length).toBeGreaterThan(0);
  });

  it('AI 失败 → 返回 false 不崩溃，不落盘', async () => {
    const { app } = await setup();
    const ai = makeAI('', true);
    const ok = await manualReview(app, ai);
    expect(ok).toBe(false);
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.reviews).toHaveLength(0);
  });

  it('无日记 → 返回 false 不调 AI', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    const ai = makeAI(REVIEW_JSON);
    const ok = await manualReview(app, ai);
    expect(ok).toBe(false);
    expect(ai.json).not.toHaveBeenCalled();
  });
});