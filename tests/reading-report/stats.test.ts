/**
 * 阅读数据分析报告 stats 测试（ticket 13）：核心公式与纯函数抽样断言。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateReadingStats, formatReadingTime, formatSessionDuration, generateProgressBar,
  calculateCompletionRate, analyzeTrendDirection, calculateFocusScore,
  calculateConsistencyDays, analyzeReadingSessions, analyzeReadingHabits,
  analyzeSessionDurationDistribution, processHeatmapData, calculateIntensityLevel,
  analyzeFocusConsistency, calculateOverallFocusScore, calculateEfficiencyScore,
  calculateThinkRatio, calculateInteractionScore, calculateCategoryDiversity,
  calculateBalanceScore, getSuggestedCategories, analyzeInteractionPattern,
  analyzeConnectionLevel, extractNotesInteractions, getAllBookNotes,
} from '../../src/reading-report/stats';

function book(fm: Record<string, any>): any {
  return { file: { name: 'x.md' }, frontmatter: fm, cache: null };
}

describe('calculateReadingStats', () => {
  it('状态计数 + 汇总 + 进度分布', () => {
    const books = [
      book({ completionDate: '2025-07-01', readingProgress: 100, readingTime: 3600000, highlights: 10, thinks: 2, dialogue: 1, outlinks: 3, pages: 300, wordCount: 80000 }),
      book({ readingDate: '2025-06-01', readingProgress: 50 }),
      book({ readingProgress: 0 }),
    ];
    const s = calculateReadingStats(books);
    expect(s.totalBooks).toBe(3);
    expect(s.readBooks).toBe(1);
    expect(s.readingBooks).toBe(1);
    expect(s.unreadBooks).toBe(1);
    expect(s.totalReadingTime).toBe(3600000);
    expect(s.totalHighlights).toBe(10);
    expect(s.totalThinks).toBe(2);
    expect(s.totalDialogue).toBe(1);
    expect(s.totalOutlinks).toBe(3);
    expect(s.progressDistribution.completed).toBe(1);
    expect(s.progressDistribution.inProgress).toBe(1);
    expect(s.progressDistribution.unread).toBe(1);
  });

  it('阅读速度均值（totalReadingTime>0）', () => {
    const books = [book({ completionDate: '2025-07-01', readingTime: 3600000, pages: 60, wordCount: 12000 })];
    const s = calculateReadingStats(books);
    expect(s.readingSpeed.averagePagesPerHour).toBeCloseTo(60, 5);
    expect(s.readingSpeed.averageWordsPerHour).toBeCloseTo(12000, 5);
  });

  it('月度/年度统计（基于 readingDate + completionDate）', () => {
    const books = [book({ readingDate: '2025-06-10', completionDate: '2025-07-01', readingProgress: 100 })];
    const s = calculateReadingStats(books);
    expect(s.monthlyStats['2025-06'].booksRead).toBe(1);
    expect(s.monthlyStats['2025-07'].booksCompleted).toBe(1);
    expect(s.yearlyStats['2025'].booksRead).toBe(1);
    // 源码行为：completed 书在阅读月+完成月各计一次 booksCompleted
    expect(s.yearlyStats['2025'].booksCompleted).toBe(2);
  });

  it('作者统计', () => {
    const books = [book({ author: '余华', readingProgress: 100 }), book({ author: '余华', readingProgress: 30 })];
    const s = calculateReadingStats(books);
    expect(s.authorStats['余华'].count).toBe(2);
    expect(s.authorStats['余华'].completedBooks).toBe(1);
  });

  it('readingSessions 过滤 duration<=60', () => {
    const books = [book({ readingSessions: [{ start: '2025-01-01T08:00:00', duration: 600 }, { start: '2025-01-02T08:00:00', duration: 30 }] })];
    const s = calculateReadingStats(books);
    expect(s.readingSessions.length).toBe(1);
  });
});

describe('格式化', () => {
  it('formatReadingTime：h/m/s 规则', () => {
    expect(formatReadingTime(3600000)).toBe('1h');
    expect(formatReadingTime(3600000 + 30 * 60000)).toBe('1h30m');
    expect(formatReadingTime(30 * 60000)).toBe('30m');
    expect(formatReadingTime(5000)).toBe('0m');
  });

  it('formatSessionDuration：小时X分钟', () => {
    expect(formatSessionDuration(5400)).toBe('1小时30分钟');
    expect(formatSessionDuration(600)).toBe('10分钟');
  });

  it('generateProgressBar：宽度 clamp 5-100', () => {
    expect(generateProgressBar(50)).toContain('width: 50%');
    expect(generateProgressBar(0)).toContain('width: 5%');
    expect(generateProgressBar(200)).toContain('width: 100%');
  });
});

describe('趋势', () => {
  it('calculateCompletionRate：0 读 → 0%；有读 → 百分比', () => {
    expect(calculateCompletionRate({ readBooks: 0, readingBooks: 0 } as any)).toBe('0%');
    expect(calculateCompletionRate({ readBooks: 3, readingBooks: 1 } as any)).toBe('75%');
  });

  it('analyzeTrendDirection：→ / ↑ / ↓', () => {
    expect(analyzeTrendDirection([])).toBe('→');
    expect(analyzeTrendDirection([{ booksRead: 1 }, { booksRead: 1 }])).toBe('→');
    expect(analyzeTrendDirection(Array.from({ length: 6 }, (_, i) => ({ booksRead: i })))).toBe('↑');
    expect(analyzeTrendDirection(Array.from({ length: 6 }, (_, i) => ({ booksRead: 6 - i })))).toBe('↓');
  });

  it('calculateFocusScore：无完成书 → 0', () => {
    expect(calculateFocusScore([book({ readingDate: '2025-01-01' })])).toBe(0);
  });

  it('calculateConsistencyDays：月数*7 上限 30', () => {
    expect(calculateConsistencyDays({ monthlyStats: { '2025-01': {}, '2025-02': {} } } as any)).toBe(14);
    expect(calculateConsistencyDays({ monthlyStats: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`2025-${i}`, {}])) } as any)).toBe(30);
  });
});

describe('会话分析', () => {
  it('analyzeReadingSessions：时段分桶', () => {
    const r = analyzeReadingSessions([
      { start: '2025-01-01T08:00:00', duration: 600 },
      { start: '2025-01-02T14:00:00', duration: 1200 },
      { start: '2025-01-03T21:00:00', duration: 900 },
      { start: '2025-01-04T03:00:00', duration: 300 },
    ]);
    expect(r.timeSlots.morning).toBe(1);
    expect(r.timeSlots.afternoon).toBe(1);
    expect(r.timeSlots.evening).toBe(1);
    expect(r.timeSlots.night).toBe(1);
    expect(r.avgDuration).toBe(750);
  });

  it('analyzeReadingHabits：碎片化/专注等级', () => {
    const r = analyzeReadingHabits(Array.from({ length: 6 }, () => ({ start: '2025-01-01T08:00:00', duration: 300 })));
    expect(r.readingPattern).toBe('碎片化阅读 (短时间多次)');
    expect(r.peakTime).toBe('早晨时段最活跃');
  });

  it('analyzeSessionDurationDistribution：四档', () => {
    const r = analyzeSessionDurationDistribution([
      { duration: 300 }, { duration: 1200 }, { duration: 2400 }, { duration: 4000 },
    ]);
    expect(r.durationDistribution.short.count).toBe(1);
    expect(r.durationDistribution.medium.count).toBe(1);
    expect(r.durationDistribution.long.count).toBe(1);
    expect(r.durationDistribution.extended.count).toBe(1);
  });
});

describe('热力图', () => {
  it('processHeatmapData：streak 计算', () => {
    const r = processHeatmapData([
      { start: '2025-06-01T08:00:00', duration: 3600 },
      { start: '2025-06-02T08:00:00', duration: 7200 },
      { start: '2025-06-03T08:00:00', duration: 1800 },
      { start: '2025-06-10T08:00:00', duration: 600 },
    ]);
    expect(r.totalDays).toBe(4);
    expect(r.longestStreak).toBe(3);
    expect(r.monthlyData['2025-06'].sessions).toBe(4);
  });

  it('calculateIntensityLevel 分级', () => {
    expect(calculateIntensityLevel(5)).toBe(4);
    expect(calculateIntensityLevel(2)).toBe(3);
    expect(calculateIntensityLevel(1)).toBe(2);
    expect(calculateIntensityLevel(0.6)).toBe(1);
    expect(calculateIntensityLevel(0.1)).toBe(0);
  });

  it('analyzeFocusConsistency：<5 会话 → 5 分数据不足', () => {
    expect(analyzeFocusConsistency([{ start: '2025-01-01T08:00:00', duration: 600 }]).score).toBe(5);
  });

  it('analyzeFocusConsistency：连续天数评分', () => {
    // 源码 toDateString+sort 是字典序（bug 保留）：Mon<Tue 相邻可产生连续对
    const sessions = [
      { start: '2025-06-02T08:00:00', duration: 600 },
      { start: '2025-06-02T14:00:00', duration: 600 },
      { start: '2025-06-02T20:00:00', duration: 600 },
      { start: '2025-06-03T08:00:00', duration: 600 },
      { start: '2025-06-03T14:00:00', duration: 600 },
    ];
    const r = analyzeFocusConsistency(sessions);
    expect(r.maxConsecutiveDays).toBe(2);
    expect(r.score).toBe(4);
  });

  it('calculateOverallFocusScore clamp 100', () => {
    const score = calculateOverallFocusScore(
      { avgDuration: 100000, completionRate: 100 },
      {},
      { score: 10 }
    );
    expect(score).toBe(100);
  });

  it('calculateEfficiencyScore：无完成书 → 5', () => {
    expect(calculateEfficiencyScore([book({ readingDate: '2025-01-01' })])).toBe(5);
  });
});

describe('类别与互动', () => {
  it('calculateThinkRatio：0 除 → 0', () => {
    expect(calculateThinkRatio(0, 5)).toBe(0);
    expect(calculateThinkRatio(100, 25)).toBe(25);
  });

  it('calculateInteractionScore clamp 100', () => {
    expect(calculateInteractionScore({ totalHighlights: 0, totalThinks: 0, totalDialogue: 0, totalOutlinks: 0 })).toBe(0);
    expect(calculateInteractionScore({ totalHighlights: 10000, totalThinks: 10000, totalDialogue: 10000, totalOutlinks: 10000 })).toBe(100);
  });

  it('calculateCategoryDiversity：单类 → 0', () => {
    expect(calculateCategoryDiversity([{ name: '小说', count: 5 }], 5)).toBe(0);
  });

  it('calculateBalanceScore：单类 → 100', () => {
    expect(calculateBalanceScore([{ name: '小说', percentage: '100.0' }])).toBe(100);
  });

  it('getSuggestedCategories：排除已有返回 6 个', () => {
    const r = getSuggestedCategories([{ name: '小说' }, { name: '历史' }]);
    expect(r.length).toBe(6);
    expect(r).not.toContain('小说');
  });

  it('analyzeInteractionPattern：标记型', () => {
    expect(analyzeInteractionPattern({ totalHighlights: 100, totalThinks: 10, totalDialogue: 0, totalOutlinks: 0 })).toBe('标记型读者');
  });

  it('analyzeConnectionLevel 分级', () => {
    expect(analyzeConnectionLevel({ totalHighlights: 100, totalOutlinks: 50 })).toBe('高度连接');
    expect(analyzeConnectionLevel({ totalHighlights: 100, totalOutlinks: 0 })).toBe('初步连接');
  });

  it('extractNotesInteractions：分布与平均值', () => {
    const r = extractNotesInteractions([book({ highlights: 10, thinks: 2, dialogue: 1, outlinks: 3 })]);
    expect(r.totalInteractions).toBe(16);
    expect(r.booksWithInteractions).toBe(1);
    expect(r.avgHighlightsPerBook).toBe('10.0');
  });
});

describe('getAllBookNotes 集成', () => {
  it('mock vault：tags 含 book 才收集', () => {
    const files = [
      { path: '书库/A.md' },
      { path: '书库/B.md' },
      { path: 'Inbox/C.md' },
    ];
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: (f: any) => {
          const tags = f.path.includes('A') ? ['book'] : f.path.includes('B') ? 'book,note' : ['note'];
          return { frontmatter: { tags } };
        },
      },
    };
    const r = getAllBookNotes(app as any);
    expect(r.length).toBe(2);
    expect(r.map((b) => b.file.path)).toEqual(['书库/A.md', '书库/B.md']);
  });
});
