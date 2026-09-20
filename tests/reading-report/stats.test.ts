// @vitest-environment node
/**
 * 阅读数据分析报告 stats 测试（ticket 13）：核心公式与纯函数抽样断言。
 * 深审修复批（bz-fix-rr-core）：EFF-3 单趟归并等价钉死 / RR-F4 progress 钳制 / RR-F5
 * readingTimeFormat 兜底 / RR-F8 原型污染守卫 / RR-F3 分类口径单源+多样性钳 100 /
 * RR-U5 时长中文形制 / C-4 死字段清理后的产出面。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateReadingStats, formatReadingTime, formatSessionDuration,
  calculateCompletionRate, analyzeTrendDirection, calculateFocusScore,
  calculateConsistencyDays, analyzeReadingSessions, analyzeReadingHabits,
  processHeatmapData, calculateIntensityLevel,
  analyzeFocusConsistency, calculateOverallFocusScore, calculateEfficiencyScore,
  calculateThinkRatio, calculateInteractionScore, calculateCategoryDiversity,
  calculateBalanceScore, analyzeInteractionPattern,
  analyzeConnectionLevel, extractNotesInteractions, getAllBookNotes,
  analyzeReadingTrends, analyzeReadingCategories,
  getHeatmapMonthKeys, getYearMonthBars,
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

  it('readingSessions 过滤 duration<=60（EFF-3 单趟归并等价：跨书顺序保持）', () => {
    const books = [
      book({ readingSessions: [{ start: '2025-01-01T08:00:00', duration: 600 }, { start: '2025-01-02T08:00:00', duration: 30 }] }),
      book({ readingSessions: [{ start: '2025-01-03T08:00:00', duration: 45 }, { start: '2025-01-04T08:00:00', duration: 120 }] }),
      book({ readingSessions: [{ start: '2025-01-05T08:00:00', duration: 61 }] }),
    ];
    const s = calculateReadingStats(books);
    // 旧 concat+全量重 filter 与新单趟 push 语义逐字等价：书序 + 书内序 + >60s 阈值
    expect(s.readingSessions.map((d: any) => d.duration)).toEqual([600, 120, 61]);
  });

  it('RR-F4：readingProgress 钳 [0,100]——负数不进「刚开始」桶、超 100 进「已完成」桶', () => {
    const s = calculateReadingStats([
      book({ readingProgress: -5 }),
      book({ readingProgress: 250 }),
    ]);
    expect(s.progressDistribution.unread).toBe(1);  // -5 → 钳 0 → 未读
    expect(s.progressDistribution.completed).toBe(1); // 250 → 钳 100 → 已读
    expect(s.progressDistribution.justStarted).toBe(0);
  });

  it('RR-F5：readingTime 缺失时 readingTimeFormat 兜底（中文 + weave 英文双格式，与宿主同源）', () => {
    const s = calculateReadingStats([
      book({ readingTimeFormat: '2小时30分' }),
      book({ readingTimeFormat: '1h30m' }),
    ]);
    expect(s.totalReadingTime).toBe(9000000 + 5400000);
  });

  it('RR-F8：author/category 为 constructor/__proto__ 键不污染原型', () => {
    const s = calculateReadingStats([
      book({ author: 'constructor', readingProgress: 50 }),
      book({ author: '__proto__', category: '__proto__', readingProgress: 80 }),
    ]);
    expect(s.authorStats['constructor'].count).toBe(1);
    expect(s.authorStats['__proto__'].count).toBe(1);
    // 污染面守卫：全局原型上不得出现 count 等统计字段
    expect(({} as any).count).toBeUndefined();
    expect((Object.prototype as any).count).toBeUndefined();
    const cats = analyzeReadingCategories([
      book({ category: 'constructor' }),
      book({ category: '__proto__' }),
    ]);
    expect(cats.categoryDistribution.map((c: any) => c.name).sort()).toEqual(['__proto__', 'constructor']);
    expect(({} as any).count).toBeUndefined();
  });
});

describe('格式化', () => {
  it('formatReadingTime：中文形制（RR-U5 单源——报告全屏唯一时长格式）', () => {
    expect(formatReadingTime(3600000)).toBe('1小时');
    expect(formatReadingTime(3600000 + 30 * 60000)).toBe('1小时30分钟');
    expect(formatReadingTime(30 * 60000)).toBe('30分钟');
    expect(formatReadingTime(5000)).toBe('0分钟');
  });

  it('formatSessionDuration：秒入口转发同一中文形制（单源）', () => {
    expect(formatSessionDuration(5400)).toBe('1小时30分钟');
    expect(formatSessionDuration(600)).toBe('10分钟');
    expect(formatSessionDuration(3600)).toBe(formatReadingTime(3600000));
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

  it('analyzeReadingHabits：时段分布（C-4 清理后唯一产出面）', () => {
    const r = analyzeReadingHabits(Array.from({ length: 6 }, () => ({ start: '2025-01-01T08:00:00', duration: 300 })));
    expect(r.timeDistribution.morning).toBe('100.0');
    expect(Object.keys(r.timeDistribution).sort()).toEqual(['afternoon', 'evening', 'morning', 'night']);
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

  it('getHeatmapMonthKeys：月键全集升序（翻月 ‹ › 可切换范围）', () => {
    const hm = processHeatmapData([
      { start: '2025-06-01T08:00:00', duration: 600 },
      { start: '2025-01-15T08:00:00', duration: 600 },
      { start: '2024-12-24T08:00:00', duration: 600 },
    ]);
    expect(getHeatmapMonthKeys(hm)).toEqual(['2024-12', '2025-01', '2025-06']);
    expect(getHeatmapMonthKeys({ monthlyData: {} })).toEqual([]);
  });

  it('getYearMonthBars：固定 12 个月柱、缺月补零（年卡展开数据源，与热力图同月桶口径）', () => {
    const monthly = {
      '2025-01': { booksRead: 2, booksCompleted: 1 },
      '2025-07': { booksRead: 5, booksCompleted: 3 },
    };
    const bars = getYearMonthBars(monthly, '2025');
    expect(bars.length).toBe(12);
    expect(bars[0]).toEqual({ month: '2025-01', label: '1月', booksRead: 2, booksCompleted: 1 });
    expect(bars[6]).toEqual({ month: '2025-07', label: '7月', booksRead: 5, booksCompleted: 3 });
    expect(bars[11].label).toBe('12月');
    // 缺月补零
    expect(bars[3].booksRead).toBe(0);
    expect(bars[3].booksCompleted).toBe(0);
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

  it('calculateCategoryDiversity：单类 → 0；溢出输入钳 [0,100]（RR-F3 防御）', () => {
    expect(calculateCategoryDiversity([{ name: '小说', count: 5 }], 5)).toBe(0);
    // 多类口径遗留防御：Σcount > totalBooks 时熵可溢出，钳制后不超 100 不为负
    const overflow = calculateCategoryDiversity([{ name: 'a', count: 15 }, { name: 'b', count: 10 }], 10);
    expect(overflow).toBeGreaterThanOrEqual(0);
    expect(overflow).toBeLessThanOrEqual(100);
  });

  it('calculateBalanceScore：单类 → 100', () => {
    expect(calculateBalanceScore([{ name: '小说', percentage: '100.0' }])).toBe(100);
  });

  it('analyzeInteractionPattern：标记型', () => {
    expect(analyzeInteractionPattern({ totalHighlights: 100, totalThinks: 10, totalDialogue: 0, totalOutlinks: 0 })).toBe('标记型读者');
  });

  it('analyzeConnectionLevel 分级', () => {
    expect(analyzeConnectionLevel({ totalHighlights: 100, totalOutlinks: 50 })).toBe('高度连接');
    expect(analyzeConnectionLevel({ totalHighlights: 100, totalOutlinks: 0 })).toBe('初步连接');
  });

  it('extractNotesInteractions：分布与平均值（C-4 清理后 recommendations 不再产出）', () => {
    const r = extractNotesInteractions([book({ highlights: 10, thinks: 2, dialogue: 1, outlinks: 3 })]);
    expect(r.totalInteractions).toBe(16);
    expect(r.booksWithInteractions).toBe(1);
    expect(r.avgHighlightsPerBook).toBe('10.0');
    expect(r.interactionDistribution.every((d: any) => typeof d.percentage === 'string')).toBe(true);
  });

  it('RR-F3：分类口径与宿主单值恒等——多类数组/斜杠串不再拆分（点分类行回墙能筛中）', () => {
    // 宿主 parseBookFile：String(fm.category) —— 数组 toString = 逗号拼接串，不拆分
    const notes = [
      book({ category: ['小说', '文学'] }),
      book({ category: '科幻/文学' }),
      book({ category: '小说' }),
    ];
    const r = analyzeReadingCategories(notes);
    const names = r.categoryDistribution.map((c: any) => c.name);
    expect(names.sort()).toEqual(['小说', '小说,文学', '科幻/文学'].sort());
    // Σcount === totalBooks（单值口径下多样性恒在 [0,100]）
    expect(r.categoryDistribution.reduce((sum: number, c: any) => sum + c.count, 0)).toBe(3);
  });

  it('C-4：分类产出面收敛——死字段不再产出', () => {
    const r = analyzeReadingCategories([book({ category: '小说' })]);
    expect(Object.keys(r).sort()).toEqual(['balanceScore', 'categoryDistribution', 'diversityScore', 'topCategory', 'totalBooks', 'totalCategories']);
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
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), new Date(2025, 5, 15)); // now=2025-06
    expect(t.currentMonth.books).toBe(9);
    expect(t.quarterlyAvg).toBe('4.3'); // (2+2+9)/3 ≈ 4.33
    expect(t.trendDirection).toBe('↑');
    // 组合层：图表数据仍是反转后的新→旧，统计字段不受反转影响
    expect(t.recentMonths.map((m: any) => m.month)).toEqual([
      '2025-06', '2025-05', '2025-04', '2025-03', '2025-02', '2025-01',
    ]);
    expect(t.recentMonths.map((m: any) => m.booksRead)).toEqual([9, 2, 2, 1, 1, 1]);
  });

  it('反向样例 [9,2,2,1,1,1]：本月=1、方向 ↓（旧实现会给出全反结论）', () => {
    const t = analyzeReadingTrends(makeStats([9, 2, 2, 1, 1, 1]), new Date(2025, 5, 15)); // now=2025-06
    expect(t.currentMonth.books).toBe(1);
    expect(t.trendDirection).toBe('↓');
  });

  it('audit F：当月无数据 → 本月阅读显示 0，不再取「升序末位」旧月份数据', () => {
    // 数据止于 2025-06，「现在」是 2026-09：旧实现把 2025-06 的 9 本当「本月」
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), new Date(2026, 8, 4));
    expect(t.currentMonth.books).toBe(0);
    expect(t.currentMonth.completed).toBe(0);
    // 其余统计口径不受影响
    expect(t.quarterlyAvg).toBe('4.3');
    expect(t.trendDirection).toBe('↑');
  });

  it('audit F：当月有数据 → 按当前年月键直查对应桶', () => {
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), new Date(2025, 5, 30));
    expect(t.currentMonth.books).toBe(9);
    expect(t.currentMonth.completed).toBe(0);
  });

  it('C-4：趋势产出面收敛——死字段（monthlyAvg/focusScore/efficiency 等）不再产出', () => {
    const t = analyzeReadingTrends(makeStats([1, 1, 1, 2, 2, 9]), new Date(2025, 5, 15));
    expect(Object.keys(t).sort()).toEqual(['completionRate', 'currentMonth', 'quarterlyAvg', 'recentMonths', 'trendDirection']);
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

  it('口径：只统计书库目录——库外 book 标签笔记不混入报告（对齐书架墙 scanMarkdownBooks）', () => {
    setSettingsProvider(() => ({}) as any); // 目录缺省回落「书库」
    const files = [
      { path: '书库/库内.md' },     // 书库目录 + book → 收
      { path: '书库/子/嵌套.md' },  // 书库子目录 + book → 收
      { path: 'Inbox/笔记.md' },    // 库外 + book 标签 → 不收（内嵌化口径拍板）
      { path: '读书.md' },          // 同名前缀目录/文件（非「书库/」内）→ 不收
    ];
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { tags: ['book'] } }),
      },
    };
    const r = getAllBookNotes(app as any);
    expect(r.map((b) => b.file.path)).toEqual(['书库/库内.md', '书库/子/嵌套.md']);
  });

  it('口径：目录本身是单个 md 笔记（书库.md）时收录；自定义目录同规则', () => {
    setSettingsProvider(() => ({ bookshelfFolderPath: '我的书' }) as any);
    const files = [
      { path: '我的书.md' },        // 目录本身单文件 → 收
      { path: '我的书/里.md' },     // 目录下 → 收
      { path: '别处.md' },          // 库外 → 不收
    ];
    const app = {
      vault: { getMarkdownFiles: () => files },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { tags: ['book'] } }),
      },
    };
    const r = getAllBookNotes(app as any);
    expect(r.map((b) => b.file.path)).toEqual(['我的书.md', '我的书/里.md']);
  });
});
