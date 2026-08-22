/**
 * 每周懂你报告测试（2026-08-23：⑦ 周窗口/统计/格式化/LLM 通道）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { weekWindow, buildWeeklyReportData, formatWeeklyReport, generateWeeklyReport } from '../../src/smartcat/report';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';

function obs(id: string, daysAgo: number, now: number, extra: Record<string, any> = {}): any {
  return {
    id, created: new Date(now - daysAgo * 86400000).toISOString(), lastAccessed: '',
    description: `记忆${id}`, importance: 0.5, type: 'observation', source: 'diary', ...extra,
  };
}

beforeEach(() => {
  (globalThis as any).fetch = undefined;
  vi.mocked(requestUrl).mockReset();
  resetAIProviderCache();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe('weekWindow', () => {
  it('返回本周周一 00:00 至周日 23:59:59', () => {
    const now = new Date('2026-08-23T12:00:00').getTime(); // 周日
    const [start, end] = weekWindow(now);
    const s = new Date(start);
    expect(s.getDay()).toBe(1); // 周一
    expect(s.getHours()).toBe(0);
    expect(end - start).toBe(7 * 86400000 - 1);
  });
});

describe('buildWeeklyReportData', () => {
  it('只统计本周窗口内条目；来源/情绪分布正确', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const stream = [
      obs('a', 0, now, { source: 'chat', emotion: 'happy' }),       // 今天（本周）
      obs('b', 1, now, { source: 'chat', emotion: 'happy' }),       // 昨天（本周）
      obs('c', 2, now, { source: 'diary', emotion: 'sad' }),        // 前天（本周，周一附近）
      obs('d', 10, now, { source: 'diary' }),                       // 上周，窗口外
      { id: 'i1', created: new Date(now - 3600e3).toISOString(), lastAccessed: '', description: '洞察', importance: 0.8, type: 'insight', source: 'reflection' },
    ];
    const d = buildWeeklyReportData(stream as any, { pleasure: 60, arousal: 50, dominance: 55 }, now);
    expect(d.total).toBe(4); // 3 observation + 1 insight
    expect(d.observationCount).toBe(3);
    expect(d.insightCount).toBe(1);
    expect(d.sourceDist).toEqual({ 聊天: 2, 日记: 1 });
    expect(d.emotionDist).toEqual({ happy: 2, sad: 1 });
    expect(d.topMemories.length).toBe(3);
  });
});

describe('formatWeeklyReport', () => {
  it('无观察 → 引导文案；有观察 → 来源/情绪/重要事件/PAD 汇总', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const empty = buildWeeklyReportData([], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    const t0 = formatWeeklyReport(empty);
    expect(t0).toContain('小橘还没读到太多你的内容');
    const d = buildWeeklyReportData(
      [obs('a', 0, now, { source: 'chat', emotion: 'happy' }), obs('b', 1, now, { source: 'diary' })],
      { pleasure: 60, arousal: 50, dominance: 55 }, now,
    );
    const t = formatWeeklyReport(d);
    expect(t).toContain('小橘观察到 2 条记忆');
    expect(t).toContain('聊天');
    expect(t).toContain('愉悦 60');
  });
});

describe('generateWeeklyReport', () => {
  it('AI 未配置 → 统计兜底', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
    const now = new Date('2026-08-23T12:00:00').getTime();
    const d = buildWeeklyReportData([obs('a', 0, now)], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    const text = await generateWeeklyReport(d);
    expect(text).toContain('小橘观察到 1 条记忆');
  });

  it('AI 配置 → LLM 报告（mock fetch）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"report": "这周你读了很多书，情绪平稳，继续加油！"}' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    const now = new Date('2026-08-23T12:00:00').getTime();
    const d = buildWeeklyReportData([obs('a', 0, now)], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    const text = await generateWeeklyReport(d);
    expect(text).toContain('这周你读了很多书');
  });
});