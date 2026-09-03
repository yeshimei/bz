// @vitest-environment node
/**
 * 阅读数据分析报告 stats 测试（ticket 13）：核心公式与纯函数抽样断言。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateReadingStats, formatReadingTime, formatSessionDuration,
  calculateCompletionRate, analyzeTrendDirection, calculateFocusScore,
  calculateConsistencyDays, analyzeReadingSessions, analyzeReadingHabits,
  analyzeSessionDurationDistribution, processHeatmapData, calculateIntensityLevel,
  analyzeFocusConsistency, calculateOverallFocusScore, calculateEfficiencyScore,
  calculateThinkRatio, calculateInteractionScore, calculateCategoryDiversity,
  calculateBalanceScore, getSuggestedCategories, analyzeInteractionPattern,
  analyzeConnectionLevel, extractNotesInteractions, getAllBookNotes,
  analyzeReadingTrends, analyzeReadingCategories,
} from '../../src/reading-report/stats';
import { setSettingsProvider } from '../../src/core/settings-provider';

function book(fm: Record<string, any>): any {
  return { file: { name: 'x.md' }, frontmatter: fm, cache: null };
}

/** 本地时区 YYYY-MM-DD（与修复后 toIsoDate / 热力图日桶同口径） */
function localIsoDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('calculateReadingStats', () => {
  it('状态计数 + 汇总 + 进度分布', () => {
    const books = [
      book({ readingDate: '2025-05-01', completionDate: '2025-07-01', readingProgress: 100, readingTime: 3600000, highlights: 10, thinks: 2, dialogue: 1, outlinks: 3, pages: 300, wordCount: 80000 }),
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

  it('audit G：状态口径与 bookshelf/library 双日期统一——只补 completionDate 不算已读', () => {
    // 回归：旧实现「有 completionDate 即已读」，与两面板（双日期口径）状态分叉
    const s = calculateReadingStats([book({ completionDate: '2025-07-01', readingProgress: 100 })]);
    expect(s.readBooks).toBe(0);
    expect(s.readingBooks).toBe(0);
    expect(s.unreadBooks).toBe(1);
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
    // audit H：completed 只在完成日期桶记一次（阅读月不再按 progress>=100 重复计数）
    expect(s.yearlyStats['2025'].booksCompleted).toBe(1);
    expect(s.monthlyStats['2025-06'].booksCompleted).toBe(0);
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

  it('processHeatmapData：日桶键为本地时区日期（P1-20 UTC 偏移修复）', () => {
    // 本地构造 2024-12-24 07:30（UTC+8 下对应 2024-12-23T23:30Z，旧 UTC 切片会错桶到前一天）
    const start = new Date(2024, 11, 24, 7, 30).getTime();
    const r = processHeatmapData([{ start, duration: 600 }]);
    expect(Object.keys(r.dailyData)).toEqual([localIsoDate(start)]);
    expect(Object.keys(r.dailyData)).toContain('2024-12-24');
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

  it('analyzeReadingCategories.categoryTrends：按完成日期倒序取最近 10 本（P2 任意取样修复）', () => {
    // 本地时区 ISO 日期（n 天前）
    const isoDaysAgo = (n: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      const p = (v: number) => String(v).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    // i=0 最旧（170 天前）… i=11 最新（60 天前），全部在近 6 月内；前两本属「远类」
    // 输入顺序故意打乱：旧实现的 slice(0,10) 取的是输入前 10（含 2 本远类），新实现取日期最近 10 本
    const order = [5, 0, 8, 2, 11, 1, 9, 3, 7, 10, 4, 6];
    const notes = order.map((i) =>
      book({ category: i <= 1 ? '远类' : '近类', completionDate: isoDaysAgo(170 - i * 10), readingProgress: 100 })
    );
    const r = analyzeReadingCategories(notes);
    expect(r.categoryTrends).toEqual([{ name: '近类', count: 10 }]);
  });
});

describe('analyzeReadingTrends 趋势修复（P1-17）', () => {
  /** 6 个月升序月度数据（2025-01 → 2025-06） */
  function makeStats(booksReadAsc: number[]): any {
    const monthlyStats: Record<string, any> = {};
    ['01', '02', '03', '04', '05', '06'].forEach((m, i) => {
      monthlyStats[`2025-${m}`] = {
        booksRead: booksReadAsc[i], booksCompleted: 0,
        totalReadingTime: 0, totalHighlights: 0, readingProgress: 0,
      };
    });
    return { monthlyStats, readBooks: 0, readingBooks: 0 };
  }

  it('升序 [1,1,1,2,2,9]：本月=9、季均≈4.33、方向 ↑；recentMonths 反转仅供图表', () => {
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), [], new Date(2025, 5, 15)); // now=2025-06
    expect(t.currentMonth.books).toBe(9);
    expect(t.quarterlyAvg).toBe('4.3'); // (2+2+9)/3 ≈ 4.33
    expect(t.monthlyAvg).toBe('2.7');   // 16/6 ≈ 2.67
    expect(t.trendDirection).toBe('↑');
    // 组合层：图表数据仍是反转后的新→旧，统计字段不受反转影响
    expect(t.recentMonths.map((m: any) => m.month)).toEqual([
      '2025-06', '2025-05', '2025-04', '2025-03', '2025-02', '2025-01',
    ]);
    expect(t.recentMonths.map((m: any) => m.booksRead)).toEqual([9, 2, 2, 1, 1, 1]);
  });

  it('反向样例 [9,2,2,1,1,1]：本月=1、方向 ↓（旧实现会给出全反结论）', () => {
    const t = analyzeReadingTrends(makeStats([9, 2, 2, 1, 1, 1]), [], new Date(2025, 5, 15)); // now=2025-06
    expect(t.currentMonth.books).toBe(1);
    expect(t.trendDirection).toBe('↓');
  });

  it('audit F：当月无数据 → 本月阅读显示 0，不再取「升序末位」旧月份数据', () => {
    // 数据止于 2025-06，「现在」是 2026-09：旧实现把 2025-06 的 9 本当「本月」
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), [], new Date(2026, 8, 4));
    expect(t.currentMonth.books).toBe(0);
    expect(t.currentMonth.completed).toBe(0);
    // 其余统计口径不受影响
    expect(t.quarterlyAvg).toBe('4.3');
    expect(t.trendDirection).toBe('↑');
  });

  it('audit F：当月有数据 → 按当前年月键直查对应桶', () => {
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), [], new Date(2025, 5, 30));
    expect(t.currentMonth.books).toBe(9);
    expect(t.currentMonth.completed).toBe(0);
  });
});

describe('getAllBookNotes 集成', () => {
  it('mock vault：tags 数组项/整串精确等值 bookTag（子串不再误判，P2）', () => {
    setSettingsProvider(() => ({}) as any); // bookTag 缺省 'book'
    const files = [
      { path: '书库/A.md' },   // ['book'] → 收
      { path: '书库/B.md' },   // 'book' 整串 → 收
      { path: 'Inbox/C.md' },  // ['note'] → 不收
      { path: '书库/D.md' },   // ['ebook'] 子串 → 不收（P2 回归）
      { path: '书库/E.md' },   // 'book,note' 复合串 → 不收（与 library/items.ts 口径对齐）
    ];
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: (f: any) => {
          const tags =
            f.path.includes('A') ? ['book'] :
            f.path.includes('B') ? 'book' :
            f.path.includes('D') ? ['ebook'] :
            f.path.includes('E') ? 'book,note' : ['note'];
          return { frontmatter: { tags } };
        },
      },
    };
    const r = getAllBookNotes(app as any);
    expect(r.map((b) => b.file.path)).toEqual(['书库/A.md', '书库/B.md']);
  });

  it('读取 bookTag 设置：自定义标签精确等值', () => {
    setSettingsProvider(() => ({ bookTag: '读书' }) as any);
    const files = [{ path: '书库/A.md' }, { path: '书库/B.md' }];
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: (f: any) => ({
          frontmatter: { tags: f.path.includes('A') ? ['读书'] : ['book'] },
        }),
      },
    };
    const r = getAllBookNotes(app as any);
    expect(r.map((b) => b.file.path)).toEqual(['书库/A.md']);
  });
});
