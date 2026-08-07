/**
 * 阅读数据分析报告 report 测试（ticket 13 补）：19 个报告生成纯函数，
 * 覆盖空数据分支与有数据分支。
 */
import { describe, it, expect } from 'vitest';
import {
  generateFullStatsReport, generateStatsReport, generateYearlyStats, generateAuthorStats,
  generateReadingSpeedAnalysis, generateTimeDistributionChart, generateReadingHabitsDeepAnalysis2,
  generateReadingTrendsAnalysis, generateMobileFriendlyTrendChart, generateReadingHeatmap,
  generateHeatmapGrid, generateMonthHeatmap, generateHeatmapCell, generateReadingFocusAnalysis,
  generateReadingCategoryAnalysis, generateCategoryDistributionChart, generateReadingNotesInteractionAnalysis,
  generateInteractionDistributionChart, generateInteractionTrendChart,
} from '../../src/reading-report/report';
import { calculateReadingStats } from '../../src/reading-report/stats';

function book(fm: Record<string, any>): any {
  return { file: { name: 'x.md' }, frontmatter: fm, cache: null };
}

/** 有数据书籍（5 本，覆盖作者/分类/互动/月度） */
function makeBooks() {
  return [
    book({ author: '余华', category: '小说', completionDate: '2025-07-01', readingProgress: 100, readingTime: 3600000, highlights: 10, thinks: 2, dialogue: 1, outlinks: 3, pages: 300, wordCount: 80000 }),
    book({ author: '余华', category: '小说', readingDate: '2025-06-01', readingProgress: 50, readingTime: 1800000, highlights: 5, thinks: 1 }),
    book({ author: '刘慈欣', category: '科幻', readingDate: '2025-06-15', readingProgress: 80, readingTime: 2700000, highlights: 8, dialogue: 4 }),
    book({ author: '村上春树', category: '文学', readingDate: '2025-05-10', readingProgress: 30, readingTime: 900000, outlinks: 6 }),
    book({ author: '未知作者', category: '工具', readingProgress: 0 }),
  ];
}

/** 6 条会话（不同时段，触发习惯深度分析数据分支） */
function makeSessions() {
  return [
    { start: '2025-01-01T08:00:00', duration: 3600 },
    { start: '2025-01-02T14:00:00', duration: 7200 },
    { start: '2025-01-03T21:00:00', duration: 1800 },
    { start: '2025-01-04T03:00:00', duration: 5400 },
    { start: '2025-01-05T09:00:00', duration: 2700 },
    { start: '2025-01-06T20:00:00', duration: 4500 },
  ];
}

describe('report 生成函数', () => {
  const books = makeBooks();
  const stats = calculateReadingStats(books);
  stats.readingSessions = makeSessions();
  const emptyStats = calculateReadingStats([]);
  const sessions = makeSessions();

  it('generateStatsReport：汇总卡（书库/已读/在读/未读/时长）', () => {
    const html = generateStatsReport(stats);
    expect(html).toContain('书库');
    expect(html).toContain('已读');
    expect(html).toContain('在读');
    expect(html).toContain('未读');
    expect(html).toContain('平均每本');
    expect(html).toContain(String(stats.totalBooks));
    expect(html).toContain(String(stats.readBooks));
  });

  it('generateYearlyStats：空态 + 有数据（年份卡）', () => {
    expect(generateYearlyStats(emptyStats)).toContain('暂无年度阅读数据');
    const html = generateYearlyStats(stats);
    expect(html).toContain('2025年');
    expect(html).toContain('阅读数量');
  });

  it('generateAuthorStats：空态 + 有数据（排名前 5 作者）', () => {
    expect(generateAuthorStats(emptyStats)).toContain('暂无作者统计数据');
    const html = generateAuthorStats(stats);
    expect(html).toContain('余华');
    expect(html).toContain('作品数');
    expect(html).toContain('完成');
  });

  it('generateReadingSpeedAnalysis：空态返回空串 + 有数据（速度等级）', () => {
    expect(generateReadingSpeedAnalysis(emptyStats)).toBe('');
    const html = generateReadingSpeedAnalysis(stats);
    expect(html).toContain('阅读速度');
    expect(html).toContain('页/小时');
    expect(html).toContain('字速');
    expect(html).toContain('效率评分');
  });

  it('generateTimeDistributionChart：四时段饼图 circle 输出', () => {
    const html = generateTimeDistributionChart({ morning: '25', afternoon: '25', evening: '25', night: '25' });
    expect(html).toContain('<circle');
    expect(html).toContain('stroke="#4facfe"');
    expect(html).toContain('stroke="#764ba2"');
  });

  it('generateReadingHabitsDeepAnalysis2：会话不足 5 条空态 + 数据态', () => {
    expect(generateReadingHabitsDeepAnalysis2([{ start: '2025-01-01T08:00:00', duration: 300 }])).toContain('需要更多会话数据进行分析');
    const html = generateReadingHabitsDeepAnalysis2(sessions);
    expect(html).toContain('总会话');
    expect(html).toContain('早晨 (6-12点)');
    expect(html).toContain('深夜 (0-6点)');
  });

  it('generateReadingTrendsAnalysis + generateMobileFriendlyTrendChart', () => {
    const html = generateReadingTrendsAnalysis(stats, books);
    expect(html).toContain('本月阅读');
    expect(html).toContain('季度平均');
    expect(html).toContain('完成率');
    expect(generateMobileFriendlyTrendChart([])).toContain('暂无月度数据');
    const chart = generateMobileFriendlyTrendChart([{ month: '2025-07', booksRead: 3 }, { month: '2025-06', booksRead: 1 }]);
    expect(chart).toContain('7月');
    expect(chart).toContain('6月');
  });

  it('generateReadingHeatmap：空态 + 数据态（热力图概览）', () => {
    expect(generateReadingHeatmap([])).toContain('暂无阅读会话数据');
    const html = generateReadingHeatmap(sessions);
    expect(html).toContain('有阅读天数');
    expect(html).toContain('最长连续天数');
  });

  it('generateHeatmapGrid：空 monthlyData + 有数据', () => {
    expect(generateHeatmapGrid({ monthlyData: {} })).toContain('暂无数据');
    const html = generateHeatmapGrid({
      monthlyData: { '2025-06': { dailyData: { '2025-06-01': { duration: 3600, sessions: 2 } } } },
    });
    expect(html).toContain('2025年六月');
  });

  it('generateMonthHeatmap：空/未来/数据单元格混合', () => {
    const html = generateMonthHeatmap(
      {
        dailyData: {
          '2025-06-01': { duration: 3600, sessions: 2 },
          '2025-06-02': { duration: 18000, sessions: 3 },
        },
      },
      '2025-06'
    );
    expect(html).toContain('2025年六月');
    expect(html).toContain('一');
    expect(html).toContain('日');
  });

  it('generateHeatmapCell：empty/future/data/高时长四级色', () => {
    expect(generateHeatmapCell({ type: 'empty' })).toContain('width: 20px');
    expect(generateHeatmapCell({ type: 'future', date: '2025-06-30' })).toContain('未来日期');
    const cell1 = generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 1800, sessions: 1 } });
    expect(cell1).toContain('#9be9a8');
    const cell4 = generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 18000, sessions: 3 } });
    expect(cell4).toContain('#216e39');
    expect(cell4).toContain('阅读时长: 5.0小时');
  });

  it('generateReadingFocusAnalysis：专注度指标卡', () => {
    const html = generateReadingFocusAnalysis(stats, books);
    expect(html).toContain('深度会话');
    expect(html).toContain('专注趋势');
    expect(html).toContain('专注度评分');
    expect(html).toContain('连续性评分');
    expect(html).toContain('效率评分');
  });

  it('generateReadingCategoryAnalysis：空态 + 数据态（分类饼图）', () => {
    expect(generateReadingCategoryAnalysis([])).toContain('暂无书籍分类数据');
    const html = generateReadingCategoryAnalysis(books);
    expect(html).toContain('阅读分类');
    expect(html).toContain('多样性');
    expect(html).toContain('平衡度');
  });

  it('generateCategoryDistributionChart：饼图 circle', () => {
    const html = generateCategoryDistributionChart([
      { name: '小说', count: 2, percentage: '50' },
      { name: '科幻', count: 1, percentage: '25' },
    ]);
    expect(html).toContain('<circle');
    expect(html).toContain('stroke="#667eea"');
  });

  it('generateReadingNotesInteractionAnalysis：空态 + 数据态', () => {
    expect(generateReadingNotesInteractionAnalysis([])).toContain('暂无笔记互动数据');
    const html = generateReadingNotesInteractionAnalysis(books);
    expect(html).toContain('平均每本划线');
    expect(html).toContain('想法比例');
    expect(html).toContain('互动评分');
    expect(html).toContain('总互动');
  });

  it('generateInteractionDistributionChart + generateInteractionTrendChart', () => {
    const chart = generateInteractionDistributionChart([
      { name: '划线', percentage: '50' },
      { name: '想法', percentage: '25' },
    ]);
    expect(chart).toContain('<circle');
    const trend = generateInteractionTrendChart({
      totalHighlights: 23, totalThinks: 3, totalDialogue: 5, totalOutlinks: 9, avgHighlightsPerBook: 4.6,
    });
    expect(trend).toContain('划线');
    expect(trend).toContain('想法');
    expect(trend).toContain('讨论');
    expect(trend).toContain('互动密度：每本书平均 4.6 条划线');
  });

  it('generateFullStatsReport：聚合全部分段', () => {
    const html = generateFullStatsReport(stats, books);
    expect(html).toContain('书库');
    expect(html).toContain('2025年');
    // 至少包含主要段落标记
    expect(html.length).toBeGreaterThan(generateStatsReport(stats).length);
  });
});
