// @vitest-environment node
/**
 * 每周懂你报告测试（2026-08-23：⑦ 周窗口/格式化/LLM 通道）
 * ticket 160（ADR-0075 三层流水线）：周报只吃洞察——buildWeeklyReportData 统计本周新增 insight
 * （剔除 superseded；主题分布 + 清单），formatWeeklyReport/generateWeeklyReport 输出洞察叙述。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { weekWindow, buildWeeklyReportData, formatWeeklyReport, generateWeeklyReport } from '../../src/smartcat/report';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { requestUrl } from '../mock-obsidian-entry';

function ins(id: string, daysAgo: number, now: number, extra: Record<string, any> = {}): any {
  return {
    id, created: new Date(now - daysAgo * 86400000).toISOString(), lastAccessed: '',
    description: `洞察${id}`, importance: 0.75, type: 'insight', source: 'reflection', ...extra,
  };
}
function obs(id: string, daysAgo: number, now: number): any {
  return {
    id, created: new Date(now - daysAgo * 86400000).toISOString(), lastAccessed: '',
    description: `观察${id}`, importance: 0.5, type: 'observation', source: 'diary',
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

describe('buildWeeklyReportData（ticket 160：只吃洞察）', () => {
  it('只统计本周窗口内 insight；主题分布正确；观察不算；窗口外与被取代洞察剔除', () => {
    const now = new Date('2026-08-23T12:00:00').getTime(); // 周日
    const stream = [
      ins('a', 0, now, { theme: '工作' }),        // 今天（本周）
      ins('b', 1, now, { theme: '工作' }),        // 昨天（本周）
      ins('c', 2, now, { theme: '健康' }),        // 本周早些
      ins('d', 2, now),                           // 无主题 → 未分类
      ins('e', 10, now),                          // 上周 → 窗口外
      { ...ins('f', 0, now), supersededBy: 'x' }, // 被取代 → 剔除
      obs('o1', 0, now),                          // 观察（含日小结产出）不再进周报
    ];
    const d = buildWeeklyReportData(stream, { pleasure: 60, arousal: 50, dominance: 55 }, now);
    expect(d.total).toBe(4);
    expect(d.themeDist).toEqual({ 工作: 2, 健康: 1, 未分类: 1 });
    expect(d.insights.map((x) => x.id)).toEqual(['c', 'd', 'b', 'a']); // created 升序
    expect(d.padAvg).toEqual({ pleasure: 60, arousal: 50, dominance: 55 }); // 洞察无情绪样本 → 当前 PAD
  });

  it('空流 → total 0 + 空 themeDist', () => {
    const now = Date.now();
    const d = buildWeeklyReportData([], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    expect(d.total).toBe(0);
    expect(d.themeDist).toEqual({});
    expect(d.insights).toEqual([]);
  });
});

describe('formatWeeklyReport', () => {
  it('无洞察 → 引导文案；有洞察 → 主题分组 + 编号清单 + PAD', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const empty = buildWeeklyReportData([], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    expect(formatWeeklyReport(empty)).toContain('还没形成对你的新理解');
    const d = buildWeeklyReportData(
      [ins('a', 0, now, { theme: '工作' }), ins('b', 1, now)],
      { pleasure: 60, arousal: 50, dominance: 55 }, now,
    );
    const t = formatWeeklyReport(d);
    expect(t).toContain('新增了 2 条');
    expect(t).toContain('工作（1 条）');
    expect(t).toContain('未分类（1 条）');
    expect(t).toContain('1 洞察b'); // created 升序：b（1 天前）在前
    expect(t).toContain('2 [工作] 洞察a');
    expect(t).toContain('愉悦 60');
  });

  it('ticket 163：洞察描述里「你/用户」替换为称呼（默认包仔）', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const d = buildWeeklyReportData(
      [{ ...ins('a', 0, now), description: '你最近在坚持复习，用户很投入' }],
      { pleasure: 60, arousal: 50, dominance: 55 }, now,
    );
    const t = formatWeeklyReport(d);
    expect(t).toContain('包仔最近在坚持复习，包仔很投入');
    expect(t).not.toContain('你最近在坚持复习');
  });
});

describe('generateWeeklyReport', () => {
  it('AI 未配置 → 洞察清单兜底', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }));
    const now = Date.now();
    const d = buildWeeklyReportData([ins('a', 0, now, { theme: '工作' })], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    const text = await generateWeeklyReport(d);
    expect(text).toContain('洞察a');
  });

  it('AI 配置 → LLM 报告（mock fetch；user 文本含洞察清单）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    let userContent = '';
    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      userContent = JSON.parse((init as any).body).messages[1].content as string;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"report": "这周我更懂你了，继续加油！"}' } }] }),
      };
    });
    (globalThis as any).fetch = fetchMock;
    const now = Date.now();
    const d = buildWeeklyReportData([ins('a', 0, now, { theme: '工作' })], { pleasure: 55, arousal: 50, dominance: 50 }, now);
    const text = await generateWeeklyReport(d);
    expect(text).toContain('这周我更懂你了');
    expect(userContent).toContain('[工作] 洞察a');
  });
});
