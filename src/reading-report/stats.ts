/**
 * 阅读数据分析报告 stats（ticket 13）：全部数据采集与纯函数，源码逐字移植。
 * 源码：阅读数据分析报告.js（重复函数只保留最终版）
 */

// ---------- 数据采集 ----------

export interface BookNoteEntry {
  file: any;
  frontmatter: Record<string, any>;
  cache: any;
}

/** 获取所有带 book 标签的笔记 */
export function getAllBookNotes(app: any): BookNoteEntry[] {
  const files = app.vault.getMarkdownFiles();
  const bookNotes: BookNoteEntry[] = [];

  for (const file of files) {
    try {
      const cache = app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;

      const tags = cache.frontmatter.tags;
      let isBook = false;

      if (typeof tags === 'string') {
        isBook = tags.includes('book');
      } else if (Array.isArray(tags)) {
        isBook = tags.some((tag) => typeof tag === 'string' && tag.includes('book'));
      }

      if (isBook) {
        bookNotes.push({
          file,
          frontmatter: cache.frontmatter,
          cache,
        });
      }
    } catch (error) {
      console.warn(`处理文件 ${file.path} 时出错:`, error);
    }
  }

  return bookNotes;
}

export interface ReadingStats {
  totalBooks: number;
  readBooks: number;
  readingBooks: number;
  unreadBooks: number;
  totalReadingTime: number;
  totalHighlights: number;
  totalThinks: number;
  totalDialogue: number;
  totalOutlinks: number;
  monthlyStats: Record<string, any>;
  yearlyStats: Record<string, any>;
  authorStats: Record<string, any>;
  readingSessions: any[];
  progressDistribution: Record<string, number>;
  readingSpeed: { totalPages: number; totalWords: number; averagePagesPerHour: number; averageWordsPerHour: number };
}

/** 空月度统计（惰性初始化用） */
function emptyMonthlyStats() {
  return {
    booksRead: 0,
    booksCompleted: 0,
    totalReadingTime: 0,
    totalHighlights: 0,
    readingProgress: 0,
  };
}

/** 空年度统计（惰性初始化用） */
function emptyYearlyStats() {
  return {
    booksRead: 0,
    booksCompleted: 0,
    totalReadingTime: 0,
    totalHighlights: 0,
    averageProgress: 0,
  };
}


/** 计算阅读统计数据 */
export function calculateReadingStats(books: BookNoteEntry[]): ReadingStats {
  const stats: ReadingStats = {
    totalBooks: books.length,
    readBooks: 0,
    readingBooks: 0,
    unreadBooks: 0,
    totalReadingTime: 0,
    totalHighlights: 0,
    totalThinks: 0,
    totalDialogue: 0,
    totalOutlinks: 0,
    monthlyStats: {},
    yearlyStats: {},
    authorStats: {},
    readingSessions: [],
    progressDistribution: {
      unread: 0,
      justStarted: 0,
      inProgress: 0,
      almostDone: 0,
      completed: 0,
    },
    readingSpeed: {
      totalPages: 0,
      totalWords: 0,
      averagePagesPerHour: 0,
      averageWordsPerHour: 0,
    },
  };

  books.forEach((book, index) => {
    try {
      const fm = book.frontmatter;
      const readingProgress = parseFloat(fm.readingProgress) || 0;
      const readingTime = parseFloat(fm.readingTime) || 0;
      if (fm.readingSessions && Array.isArray(fm.readingSessions)) {
        stats.readingSessions = stats.readingSessions.concat(fm.readingSessions).filter((d) => d.duration > 60);
      }

      // 统计阅读状态
      if (fm.completionDate) {
        stats.readBooks++;
      } else if (fm.readingDate && !fm.completionDate) {
        stats.readingBooks++;
      } else {
        stats.unreadBooks++;
      }

      // 统计阅读时长和笔记
      stats.totalReadingTime += readingTime;
      stats.totalHighlights += parseInt(fm.highlights) || 0;
      stats.totalThinks += parseInt(fm.thinks) || 0;
      stats.totalDialogue += parseInt(fm.dialogue) || 0;
      stats.totalOutlinks += parseInt(fm.outlinks) || 0;

      // 按进度分布统计
      if (readingProgress === 0) stats.progressDistribution.unread++;
      else if (readingProgress <= 20) stats.progressDistribution.justStarted++;
      else if (readingProgress <= 80) stats.progressDistribution.inProgress++;
      else if (readingProgress < 100) stats.progressDistribution.almostDone++;
      else stats.progressDistribution.completed++;

      // 按作者统计
      const author = fm.author || '未知作者';
      if (!stats.authorStats[author]) {
        stats.authorStats[author] = {
          count: 0,
          totalReadingTime: 0,
          totalBooks: 0,
          completedBooks: 0,
        };
      }
      stats.authorStats[author].count++;
      stats.authorStats[author].totalReadingTime += readingTime;
      stats.authorStats[author].totalBooks++;
      if (readingProgress >= 100) stats.authorStats[author].completedBooks++;

      // 阅读速度统计
      const pages = parseInt(fm.pages) || 0;
      const words = parseInt(fm.wordCount) || 0;
      stats.readingSpeed.totalPages += pages;
      stats.readingSpeed.totalWords += words;

      // 月度统计（基于阅读日期）
      if (fm.readingDate) {
        try {
          const date = new Date(fm.readingDate);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          const yearKey = date.getFullYear().toString();

          if (!stats.monthlyStats[monthKey]) stats.monthlyStats[monthKey] = emptyMonthlyStats();
          stats.monthlyStats[monthKey].booksRead++;
          stats.monthlyStats[monthKey].totalReadingTime += readingTime;
          stats.monthlyStats[monthKey].totalHighlights += parseInt(fm.highlights) || 0;
          if (readingProgress >= 100) stats.monthlyStats[monthKey].booksCompleted++;

          if (!stats.yearlyStats[yearKey]) stats.yearlyStats[yearKey] = emptyYearlyStats();
          stats.yearlyStats[yearKey].booksRead++;
          stats.yearlyStats[yearKey].totalReadingTime += readingTime;
          stats.yearlyStats[yearKey].totalHighlights += parseInt(fm.highlights) || 0;
          if (readingProgress >= 100) stats.yearlyStats[yearKey].booksCompleted++;
        } catch (dateError) {
          console.warn(`日期解析错误: ${fm.readingDate}`, dateError);
        }
      }

      // 基于完成日期的统计
      if (fm.completionDate) {
        try {
          const compDate = new Date(fm.completionDate);
          const compMonthKey = `${compDate.getFullYear()}-${(compDate.getMonth() + 1).toString().padStart(2, '0')}`;
          const compYearKey = compDate.getFullYear().toString();

          if (!stats.monthlyStats[compMonthKey]) stats.monthlyStats[compMonthKey] = emptyMonthlyStats();
          stats.monthlyStats[compMonthKey].booksCompleted++;

          if (!stats.yearlyStats[compYearKey]) stats.yearlyStats[compYearKey] = emptyYearlyStats();
          stats.yearlyStats[compYearKey].booksCompleted++;
        } catch (dateError) {
          console.warn(`完成日期解析错误: ${fm.completionDate}`, dateError);
        }
      }
    } catch (error) {
      console.warn(`处理第 ${index + 1} 本书时出错:`, error, book);
    }
  });

  // 计算平均阅读速度
  if (stats.totalReadingTime > 0) {
    const totalHours = stats.totalReadingTime / 3600000; // 转换为h
    stats.readingSpeed.averagePagesPerHour = stats.readingSpeed.totalPages / totalHours;
    stats.readingSpeed.averageWordsPerHour = stats.readingSpeed.totalWords / totalHours;
  }

  return stats;
}

// ---------- 格式化 ----------

/** 格式化阅读时间（最终版 L2072） */
export function formatReadingTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
  } else {
    return `${minutes}m`;
  }
}

/** 格式化会话时长（最终版 L1868） */
export function formatSessionDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

/** 生成进度条 HTML */
export function generateProgressBar(percentage: number, width = 200): string {
  const progressWidth = Math.max(5, Math.min(100, percentage));
  return `
  <div style="width: ${width}px; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; display: inline-block; margin: 0 10px; vertical-align: middle;">
  <div style="width: ${progressWidth}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); border-radius: 4px;"></div>
  </div>
  `;
}

// ---------- 阅读习惯 ----------

/** 分析阅读会话数据 */
export function analyzeReadingSessions(sessions: any[]) {
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
  const avgDuration = totalDuration / totalSessions;
  const completedSessions = sessions.filter((s) => s.type === 'completed').length;

  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  sessions.forEach((session) => {
    const hour = new Date(session.start).getHours();
    if (hour >= 6 && hour < 12) timeSlots.morning++;
    else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
    else if (hour >= 18 && hour < 24) timeSlots.evening++;
    else timeSlots.night++;
  });

  return { totalSessions, totalDuration, avgDuration, completedSessions, timeSlots };
}

/** 深度分析阅读习惯 */
export function analyzeReadingHabits(sessions: any[]) {
  const stats = analyzeReadingSessions(sessions);

  const avgDuration = stats.avgDuration;
  let readingPattern = '';
  if (avgDuration < 600) readingPattern = '碎片化阅读 (短时间多次)';
  else if (avgDuration < 1800) readingPattern = '均衡型阅读';
  else readingPattern = '深度沉浸式阅读';

  const longSessions = sessions.filter((s) => s.duration > 1800).length;
  const focusPercentage = ((longSessions / sessions.length) * 100).toFixed(1);
  let focusLevel = '';
  if (parseFloat(focusPercentage) > 50) focusLevel = '高度专注';
  else if (parseFloat(focusPercentage) > 25) focusLevel = '中等专注';
  else focusLevel = '轻度专注';

  const timeDistribution: Record<string, string> = {};
  Object.entries(stats.timeSlots).forEach(([slot, count]) => {
    timeDistribution[slot] = ((count as number) / sessions.length * 100).toFixed(1);
  });

  const peakTime = Object.entries(stats.timeSlots).reduce((a, b) => ((a[1] as number) > (b[1] as number) ? a : b))[0];
  const peakLabels: Record<string, string> = {
    morning: '早晨时段最活跃',
    afternoon: '下午时段最活跃',
    evening: '晚间时段最活跃',
    night: '深夜时段最活跃',
  };

  return {
    readingPattern,
    focusLevel: `${focusLevel} (${focusPercentage}%长时间会话)`,
    peakTime: peakLabels[peakTime],
    timeDistribution,
  };
}

/** 分析会话时长分布 */
export function analyzeSessionDurationDistribution(sessions: any[]) {
  const durationDistribution: Record<string, { count: number; percentage: string | number }> = {
    short: { count: 0, percentage: 0 },    // 0-10分钟
    medium: { count: 0, percentage: 0 },   // 10-30分钟
    long: { count: 0, percentage: 0 },     // 30-60分钟
    extended: { count: 0, percentage: 0 }, // 60分钟以上
  };

  let totalDuration = 0;
  let maxDuration = 0;

  sessions.forEach((session) => {
    const durationMinutes = session.duration / 60;
    totalDuration += session.duration;
    maxDuration = Math.max(maxDuration, session.duration);

    if (durationMinutes < 10) {
      durationDistribution.short.count++;
    } else if (durationMinutes < 30) {
      durationDistribution.medium.count++;
    } else if (durationMinutes < 60) {
      durationDistribution.long.count++;
    } else {
      durationDistribution.extended.count++;
    }
  });

  Object.keys(durationDistribution).forEach((key) => {
    durationDistribution[key].percentage = sessions.length > 0 ? ((durationDistribution[key].count / sessions.length) * 100).toFixed(1) : 0;
  });

  return {
    durationDistribution,
    totalSessions: sessions.length,
    totalDuration,
    avgDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    maxDuration,
  };
}

// ---------- 趋势 ----------

/** 获取月度趋势数据（最近 12 个月） */
export function getMonthlyTrendData(stats: ReadingStats) {
  const monthlyEntries = Object.entries(stats.monthlyStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12);

  return monthlyEntries.map(([month, data]) => ({
    month,
    booksRead: data.booksRead,
    booksCompleted: data.booksCompleted || 0,
    readingTime: data.totalReadingTime,
    highlights: data.totalHighlights,
  }));
}

/** 计算月度平均值 */
export function calculateMonthlyAverage(monthlyData: any[]): string {
  if (monthlyData.length === 0) return '0.0';
  const total = monthlyData.reduce((sum, data) => sum + data.booksRead, 0);
  return (total / monthlyData.length).toFixed(1);
}

/** 获取当前月统计 */
export function getCurrentMonthStats(monthlyData: any[]) {
  if (monthlyData.length === 0) return { books: 0, completed: 0 };
  const current = monthlyData[monthlyData.length - 1];
  return {
    books: current.booksRead,
    completed: current.booksCompleted,
  };
}

/** 计算季度平均值 */
export function calculateQuarterlyAverage(monthlyData: any[]): string {
  if (monthlyData.length < 3) return calculateMonthlyAverage(monthlyData);
  const lastThree = monthlyData.slice(-3);
  return calculateMonthlyAverage(lastThree);
}

/** 计算完成率 */
export function calculateCompletionRate(stats: ReadingStats): string {
  const totalRead = stats.readBooks + stats.readingBooks;
  if (totalRead === 0) return '0%';
  const rate = ((stats.readBooks / totalRead) * 100).toFixed(0);
  return rate + '%';
}

/** 分析趋势方向 */
export function analyzeTrendDirection(monthlyData: any[]): string {
  if (monthlyData.length < 2) return '→';

  const recentAvg = calculateMonthlyAverage(monthlyData.slice(-3));
  const previousAvg = monthlyData.length >= 6 ? calculateMonthlyAverage(monthlyData.slice(-6, -3)) : recentAvg;

  const diff = parseFloat(recentAvg) - parseFloat(previousAvg);
  if (Math.abs(diff) < 0.5) return '→';
  return diff > 0 ? '↑' : '↓';
}

/** 分析阅读趋势（完整） */
export function analyzeReadingTrends(stats: ReadingStats, bookNotes: BookNoteEntry[]) {
  const monthlyData = getMonthlyTrendData(stats);
  const recentMonths = monthlyData.slice(-6).reverse(); // 最近6个月

  return {
    recentMonths,
    monthlyAvg: calculateMonthlyAverage(recentMonths),
    currentMonth: getCurrentMonthStats(recentMonths),
    quarterlyAvg: calculateQuarterlyAverage(recentMonths),
    completionRate: calculateCompletionRate(stats),
    trendDirection: analyzeTrendDirection(recentMonths),
    focusScore: calculateFocusScore(bookNotes),
    focusLevel: getFocusLevel(bookNotes),
    consistencyDays: calculateConsistencyDays(stats),
    consistencyLevel: getConsistencyLevel(stats),
    efficiency: calculateReadingEfficiency(stats, bookNotes),
    recommendations: generatePracticalRecommendations(stats, bookNotes),
  };
}

// ---------- 专注度 ----------

/** 计算阅读专注度分数 */
export function calculateFocusScore(bookNotes: BookNoteEntry[]): number {
  const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate && book.frontmatter.readingTime);

  if (completedBooks.length === 0) return 0;

  let totalScore = 0;
  completedBooks.forEach((book) => {
    const pages = parseInt(book.frontmatter.pages) || 200;
    const readingTime = parseFloat(book.frontmatter.readingTime) || 0;
    const hours = readingTime / 3600000;

    if (hours > 0) {
      const pagesPerHour = pages / hours;
      let score = Math.max(0, Math.min(100, ((pagesPerHour - 20) / 40) * 100));
      totalScore += score;
    }
  });

  return Math.round(totalScore / completedBooks.length);
}

/** 获取专注度等级 */
export function getFocusLevel(bookNotes: BookNoteEntry[]): string {
  const score = calculateFocusScore(bookNotes);
  if (score >= 80) return '高度专注';
  if (score >= 60) return '中等专注';
  if (score >= 40) return '一般专注';
  return '需要提升';
}

/** 计算连续阅读天数（简化：月数*7，上限 30） */
export function calculateConsistencyDays(stats: ReadingStats): number {
  const monthlyCount = Object.keys(stats.monthlyStats).length;
  return Math.min(monthlyCount * 7, 30);
}

/** 获取连续性等级 */
export function getConsistencyLevel(stats: ReadingStats): string {
  const days = calculateConsistencyDays(stats);
  if (days >= 20) return '优秀';
  if (days >= 10) return '良好';
  return '待加强';
}

/** 计算阅读效率 */
export function calculateReadingEfficiency(stats: ReadingStats, bookNotes: BookNoteEntry[]) {
  const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate);
  const totalReadingTime = stats.totalReadingTime / 3600000;
  const totalPages = bookNotes.reduce((sum, book) => sum + (parseInt(book.frontmatter.pages) || 0), 0);

  return {
    pagesPerHour: totalReadingTime > 0 ? (totalPages / totalReadingTime).toFixed(1) : '0.0',
    notesPerBook: completedBooks.length > 0 ? (stats.totalHighlights / completedBooks.length).toFixed(1) : '0.0',
    timePerBook: completedBooks.length > 0 ? (totalReadingTime / completedBooks.length).toFixed(1) : '0.0',
  };
}

/** 生成实用建议 */
export function generatePracticalRecommendations(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  const recommendations: string[] = [];

  const completionRate = parseFloat(calculateCompletionRate(stats));
  if (completionRate < 50) {
    recommendations.push('建议优先完成已开始的书籍，提高完成率');
  }

  const efficiency = calculateReadingEfficiency(stats, bookNotes);
  if (parseFloat(efficiency.pagesPerHour) < 20) {
    recommendations.push('阅读速度较慢，可以尝试提升阅读技巧');
  }

  if (calculateConsistencyDays(stats) < 15) {
    recommendations.push('建立每日阅读习惯，保持连续性');
  }

  const focusScore = calculateFocusScore(bookNotes);
  if (focusScore < 60) {
    recommendations.push('提升阅读时的专注度，减少干扰');
  }

  return recommendations.length > 0 ? recommendations.join('；') : '您的阅读习惯很优秀，继续保持！';
}

// ---------- 热力图 ----------

/** 处理热力图数据 */
export function processHeatmapData(readingSessions: any[]) {
  const dailyData: Record<string, any> = {};
  let totalDuration = 0;
  let totalSessions = 0;

  readingSessions.forEach((session) => {
    const date = new Date(session.start);
    const dateKey = date.toISOString().split('T')[0];
    const duration = session.duration || 0;

    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        sessions: 0,
        duration: 0,
        weekday: date.getDay(),
      };
    }

    dailyData[dateKey].sessions += 1;
    dailyData[dateKey].duration += duration;
    totalDuration += duration;
    totalSessions += 1;
  });

  // 计算最长连续阅读天数
  const sortedDates = Object.keys(dailyData).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;

  sortedDates.forEach((dateKey) => {
    const currentDate = new Date(dateKey);
    if (lastDate) {
      const diffTime = currentDate.getTime() - lastDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak += 1;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
    lastDate = currentDate;
  });

  return {
    dailyData,
    totalDays: Object.keys(dailyData).length,
    totalSessions,
    totalDuration,
    longestStreak,
    monthlyData: groupByMonth(dailyData),
  };
}

/** 按月份分组数据 */
export function groupByMonth(dailyData: Record<string, any>) {
  const monthlyData: Record<string, any> = {};

  Object.values(dailyData).forEach((day) => {
    const monthKey = day.date.substring(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        days: 0,
        sessions: 0,
        duration: 0,
        dailyData: {},
      };
    }

    monthlyData[monthKey].days += 1;
    monthlyData[monthKey].sessions += day.sessions;
    monthlyData[monthKey].duration += day.duration;
    monthlyData[monthKey].dailyData[day.date] = day;
  });

  return monthlyData;
}

/** 计算强度等级 */
export function calculateIntensityLevel(durationHours: number): number {
  if (durationHours >= 4) return 4;
  if (durationHours >= 2) return 3;
  if (durationHours >= 1) return 2;
  if (durationHours >= 0.5) return 1;
  return 0;
}

/** 获取热力图颜色 */
export function getHeatmapColor(level: number): string {
  const colors = [
    '#ebedf0', // 0级：无阅读
    '#9be9a8', // 1级：0.5-1小时
    '#40c463', // 2级：1-2小时
    '#30a14e', // 3级：2-4小时
    '#216e39', // 4级：4小时以上
  ];
  return colors[level] || colors[0];
}

/** 生成单元格提示信息 */
export function generateCellTooltip(cell: any): string {
  const date = new Date(cell.date);
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const durationHours = (cell.data.duration / 3600).toFixed(1);
  const sessions = cell.data.sessions;

  return `${dateStr}\n阅读时长: ${durationHours}小时\n会话次数: ${sessions}次`;
}

// ---------- 专注度（会话级） ----------

/** 分析阅读专注度数据 */
export function analyzeReadingFocus(readingSessions: any[], bookNotes: BookNoteEntry[]) {
  if (!readingSessions || readingSessions.length === 0) {
    return getDefaultFocusData();
  }

  const sessionAnalysis = analyzeSessionFocus(readingSessions);
  const timeAnalysis = analyzeFocusTimePatterns(readingSessions);
  const trendAnalysis = analyzeFocusTrend(readingSessions);
  const consistencyAnalysis = analyzeFocusConsistency(readingSessions);

  return {
    focusScore: calculateOverallFocusScore(sessionAnalysis, timeAnalysis, consistencyAnalysis),
    deepSessions: sessionAnalysis.deepSessions,
    avgSessionTime: formatSessionDuration(sessionAnalysis.avgDuration),
    bestTimeSlot: timeAnalysis.bestTimeSlot,
    sessionDistribution: sessionAnalysis.distribution,
    completionRate: sessionAnalysis.completionRate,
    trend: trendAnalysis.trend,
    trendDescription: trendAnalysis.description,
    trendIcon: trendAnalysis.icon,
    recommendations: generateFocusRecommendations(sessionAnalysis, timeAnalysis, consistencyAnalysis),
    consistencyScore: consistencyAnalysis.score,
    efficiencyScore: calculateEfficiencyScore(bookNotes),
  };
}

/** 分析会话专注度 */
export function analyzeSessionFocus(sessions: any[]) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.type === 'completed').length;
  const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
  const avgDuration = totalDuration / totalSessions;

  const distribution = [
    { type: 'short', max: 600, count: 0 },      // <10分钟
    { type: 'light', max: 1800, count: 0 },     // 10-30分钟
    { type: 'medium', max: 3600, count: 0 },    // 30-60分钟
    { type: 'deep', max: 7200, count: 0 },      // 1-2小时
    { type: 'intense', max: Infinity, count: 0 }, // >2小时
  ];

  sessions.forEach((session) => {
    const duration = session.duration;
    for (const category of distribution) {
      if (duration <= category.max) {
        category.count++;
        break;
      }
    }
  });

  distribution.forEach((cat) => {
    (cat as any).percentage = totalSessions > 0 ? Math.round((cat.count / totalSessions) * 100) : 0;
  });

  return {
    totalSessions,
    completedSessions,
    completionRate: Math.round((completedSessions / totalSessions) * 100),
    totalDuration,
    avgDuration,
    deepSessions: distribution.slice(2).reduce((sum, cat) => sum + cat.count, 0),
    distribution,
  };
}

/** 分析专注时段模式 */
export function analyzeFocusTimePatterns(sessions: any[]) {
  const timeSlots: Record<string, { count: number; totalDuration: number }> = {
    morning: { count: 0, totalDuration: 0 },    // 6-12
    afternoon: { count: 0, totalDuration: 0 },  // 12-18
    evening: { count: 0, totalDuration: 0 },    // 18-24
    night: { count: 0, totalDuration: 0 },      // 0-6
  };

  sessions.forEach((session) => {
    const hour = new Date(session.start).getHours();
    let slot: string;
    if (hour >= 6 && hour < 12) slot = 'morning';
    else if (hour >= 12 && hour < 18) slot = 'afternoon';
    else if (hour >= 18 && hour < 24) slot = 'evening';
    else slot = 'night';

    timeSlots[slot].count++;
    timeSlots[slot].totalDuration += session.duration;
  });

  let bestSlot = 'morning';
  let maxAvgDuration = 0;

  Object.entries(timeSlots).forEach(([slot, data]) => {
    if (data.count > 0) {
      const avgDuration = data.totalDuration / data.count;
      if (avgDuration > maxAvgDuration) {
        maxAvgDuration = avgDuration;
        bestSlot = slot;
      }
    }
  });

  const slotLabels: Record<string, string> = {
    morning: '早晨 (6-12点)',
    afternoon: '下午 (12-18点)',
    evening: '晚上 (18-24点)',
    night: '深夜 (0-6点)',
  };

  return {
    bestTimeSlot: slotLabels[bestSlot],
    timeSlots,
  };
}

/** 分析专注度趋势 */
export function analyzeFocusTrend(sessions: any[]) {
  if (sessions.length < 5) {
    return { trend: '数据不足', description: '需要更多会话数据进行趋势分析', icon: '➖' };
  }

  const sortedSessions = [...sessions].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const earlySessions = sortedSessions.slice(0, Math.floor(sessions.length / 2));
  const recentSessions = sortedSessions.slice(-Math.floor(sessions.length / 2));

  const earlyAvg = earlySessions.reduce((sum, s) => sum + s.duration, 0) / earlySessions.length;
  const recentAvg = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;

  const trendPercentage = ((recentAvg - earlyAvg) / earlyAvg) * 100;

  if (trendPercentage > 20) {
    return { trend: '显著提升', description: `+${Math.round(trendPercentage)}%`, icon: '📈' };
  } else if (trendPercentage > 5) {
    return { trend: '稳步提升', description: `+${Math.round(trendPercentage)}%`, icon: '↗️' };
  } else if (trendPercentage < -10) {
    return { trend: '需要关注', description: `-${Math.round(Math.abs(trendPercentage))}%`, icon: '📉' };
  } else {
    return { trend: '保持稳定', description: '0%', icon: '➡️' };
  }
}

/** 分析专注连续性 */
export function analyzeFocusConsistency(sessions: any[]) {
  if (sessions.length < 5) {
    return { score: 5, description: '数据不足' };
  }

  const dates = [...new Set(sessions.map((s) => new Date(s.start).toDateString()))].sort();

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  let score: number;
  if (maxConsecutive >= 7) score = 10;
  else if (maxConsecutive >= 5) score = 8;
  else if (maxConsecutive >= 3) score = 6;
  else if (maxConsecutive >= 2) score = 4;
  else score = 2;

  return {
    score,
    maxConsecutiveDays: maxConsecutive,
    description: `最长连续阅读${maxConsecutive}天`,
  };
}

/** 计算整体专注度评分 */
export function calculateOverallFocusScore(sessionAnalysis: any, timeAnalysis: any, consistencyAnalysis: any): number {
  let score = 0;

  const durationScore = Math.min((sessionAnalysis.avgDuration / 1800) * 40, 40); // 30分钟为满分
  const completionScore = sessionAnalysis.completionRate * 0.3;
  const consistencyScore = consistencyAnalysis.score * 3;

  score = durationScore + completionScore + consistencyScore;

  return Math.min(Math.round(score), 100);
}

/** 计算效率评分 */
export function calculateEfficiencyScore(bookNotes: BookNoteEntry[]): number {
  const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate);
  if (completedBooks.length === 0) return 5;

  let totalEfficiency = 0;

  completedBooks.forEach((book) => {
    const pages = parseInt(book.frontmatter.pages) || 200;
    const readingTime = parseFloat(book.frontmatter.readingTime) || 0;
    const highlights = parseInt(book.frontmatter.highlights) || 0;

    if (readingTime > 0) {
      const hours = readingTime / 3600000;
      const pagesPerHour = pages / hours;
      const notesDensity = highlights / pages;

      let bookEfficiency = 0;
      if (pagesPerHour >= 30 && pagesPerHour <= 60) bookEfficiency += 5;
      if (notesDensity >= 0.1) bookEfficiency += 3;
      if (notesDensity >= 0.05) bookEfficiency += 2;

      totalEfficiency += Math.min(bookEfficiency, 10);
    }
  });

  return Math.round(totalEfficiency / completedBooks.length);
}

/** 生成专注度提升建议 */
export function generateFocusRecommendations(sessionAnalysis: any, timeAnalysis: any, consistencyAnalysis: any): string {
  const recommendations: string[] = [];

  if (sessionAnalysis.avgDuration < 900) {
    recommendations.push('尝试延长单次阅读时间至20-30分钟');
  } else if (sessionAnalysis.avgDuration > 3600) {
    recommendations.push('您的专注时长优秀，注意适当休息');
  }

  if (sessionAnalysis.completionRate < 60) {
    recommendations.push('提高会话完成率，设定明确的阅读目标');
  }

  if (consistencyAnalysis.maxConsecutiveDays < 3) {
    recommendations.push('建立每日固定阅读时段，培养连续性');
  }

  if (timeAnalysis.bestTimeSlot.includes('深夜')) {
    recommendations.push('深夜阅读可能影响睡眠质量，建议调整时段');
  }

  if (recommendations.length === 0) {
    return '您的阅读专注度表现优秀！继续保持良好的阅读习惯。';
  }

  return recommendations.slice(0, 3).join('；');
}

/** 获取默认专注度数据（当无会话数据时） */
export function getDefaultFocusData() {
  return {
    focusScore: 50,
    deepSessions: 0,
    avgSessionTime: '0分钟',
    bestTimeSlot: '暂无数据',
    sessionDistribution: [
      { type: 'short', count: 0, percentage: 0 },
      { type: 'light', count: 0, percentage: 0 },
      { type: 'medium', count: 0, percentage: 0 },
      { type: 'deep', count: 0, percentage: 0 },
      { type: 'intense', count: 0, percentage: 0 },
    ],
    completionRate: 0,
    trend: '暂无趋势',
    trendDescription: '需要更多阅读数据',
    trendIcon: '➖',
    recommendations: '开始记录阅读会话以获得专注度分析',
    consistencyScore: 0,
    efficiencyScore: 0,
  };
}

// ---------- 速度 ----------

/** 分析阅读速度数据 */
export function analyzeReadingSpeed(stats: ReadingStats) {
  const avgPagesPerHour = stats.readingSpeed.averagePagesPerHour || 0;
  const avgWordsPerHour = stats.readingSpeed.averageWordsPerHour || 0;

  let speedLevel: string, speedPercentage: number, efficiencyScore: number, readingType: string;

  if (avgPagesPerHour < 20) {
    speedLevel = '较慢阅读';
    speedPercentage = 30;
    efficiencyScore = 4;
    readingType = '精读型';
  } else if (avgPagesPerHour < 40) {
    speedLevel = '适中速度';
    speedPercentage = 60;
    efficiencyScore = 7;
    readingType = '平衡型';
  } else if (avgPagesPerHour < 60) {
    speedLevel = '快速阅读';
    speedPercentage = 80;
    efficiencyScore = 9;
    readingType = '速读型';
  } else {
    speedLevel = '极速阅读';
    speedPercentage = 95;
    efficiencyScore = 10;
    readingType = '扫描型';
  }

  let recommendation: string;
  if (avgPagesPerHour < 15) {
    recommendation = '建议通过速读训练提高基础阅读速度，目标达到20-30页/小时';
  } else if (avgPagesPerHour < 30) {
    recommendation = '您的阅读速度适中，可以尝试不同的阅读技巧来进一步提升效率';
  } else if (avgPagesPerHour < 50) {
    recommendation = '优秀的阅读速度！继续保持并注意理解深度的平衡';
  } else {
    recommendation = '极佳的阅读速度！建议关注阅读质量与知识吸收效果';
  }

  const monthlyTrend = generateMonthlySpeedTrend(stats);

  return {
    speedLevel,
    speedPercentage,
    efficiencyScore,
    readingType,
    recommendation,
    monthlyTrend,
    bestSpeed: Math.round(avgPagesPerHour * 1.2),
    avgSessionTime: formatReadingTime(stats.totalReadingTime / Math.max(stats.readBooks, 1)),
  };
}

/** 生成月度速度趋势（模拟数据，源码语义保留） */
export function generateMonthlySpeedTrend(stats: ReadingStats): string {
  const monthlyData = Object.entries(stats.monthlyStats || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);

  if (monthlyData.length === 0) {
    return '<div style="text-align: center; color: #666; padding: 20px 0;">暂无月度数据</div>';
  }

  const trendData = monthlyData.map(([month, data]) => {
    const estimatedSpeed = 25 + Math.random() * 15; // 模拟数据
    return {
      month: month.substring(5),
      speed: Math.round(estimatedSpeed),
      books: data.booksRead || 0,
    };
  });

  const maxSpeed = Math.max(...trendData.map((d) => d.speed));

  return `
  <div style="overflow-x: auto; margin: 8px 0;">
  <div style="display: flex; gap: 8px; min-width: ${trendData.length * 80}px; padding: 8px 0;">
  ${trendData
    .map((data) => {
      const height = (data.speed / maxSpeed) * 40;
      return `
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">${data.month}月</div>
    <div style="width: 100%; height: 40px; display: flex; align-items: end; justify-content: center;">
    <div style="width: 80%; height: ${height}px; background: linear-gradient(to top, #667eea, #764ba2); border-radius: 2px 2px 0 0;"></div>
    </div>
    <div style="font-size: 12px; font-weight: 600; color: #2c3e50; margin-top: 4px;">${data.speed}</div>
    <div style="font-size: 10px; color: #999;">${data.books}本</div>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>
  `;
}

// ---------- 类别 ----------

/** 提取书籍分类并自动分类 */
export function extractAndCategorizeBooks(bookNotes: BookNoteEntry[]) {
  const categorizedBooks: any[] = [];
  const autoCategorizedCount = 0;

  bookNotes.forEach((book) => {
    let categories: string[] = [];

    if (book.frontmatter.category) {
      const rawCategories = Array.isArray(book.frontmatter.category)
        ? book.frontmatter.category
        : String(book.frontmatter.category).split(/[,，\/]/);

      categories = rawCategories.map((cat: string) => cat.trim()).filter((cat) => cat);
    }

    categorizedBooks.push({
      title: book.file ? book.file.name : '未知书籍',
      categories,
      readingDate: book.frontmatter.readingDate,
      completionDate: book.frontmatter.completionDate,
    });
  });

  return { categorizedBooks, autoCategorizedCount };
}

/** 计算分类分布 */
export function calculateCategoryDistribution(categorizedBooks: any[]) {
  const categoryCount: Record<string, number> = {};

  categorizedBooks.forEach((book) => {
    book.categories.forEach((category: string) => {
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
  });

  const totalBooks = categorizedBooks.length;

  return Object.entries(categoryCount)
    .map(([name, count]) => ({
      name,
      count,
      percentage: ((count / totalBooks) * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);
}

/** 计算前3分类占比 */
export function calculateTop3Percentage(categoryDistribution: any[]): number | string {
  if (categoryDistribution.length === 0) return 0;

  const top3Count = categoryDistribution.slice(0, 3).reduce((sum, cat) => sum + cat.count, 0);
  const totalCount = categoryDistribution.reduce((sum, cat) => sum + cat.count, 0);

  return totalCount > 0 ? ((top3Count / totalCount) * 100).toFixed(1) : 0;
}

/** 计算分类多样性（香农指数归一） */
export function calculateCategoryDiversity(categoryDistribution: any[], totalBooks: number): number {
  if (categoryDistribution.length <= 1) return 0;

  let diversity = 0;
  categoryDistribution.forEach((cat) => {
    const p = cat.count / totalBooks;
    if (p > 0) {
      diversity -= p * Math.log(p);
    }
  });

  const maxDiversity = Math.log(categoryDistribution.length);
  const score = maxDiversity > 0 ? (diversity / maxDiversity) * 100 : 0;

  return Math.round(score);
}

/** 获取多样性等级 */
export function getDiversityLevel(categoryDistribution: any[], totalBooks: number): string {
  const score = calculateCategoryDiversity(categoryDistribution, totalBooks);

  if (score >= 80) return '非常广泛';
  if (score >= 60) return '较为多样';
  if (score >= 40) return '相对集中';
  if (score >= 20) return '比较专一';
  return '高度集中';
}

/** 计算平衡度分数（基尼简化） */
export function calculateBalanceScore(categoryDistribution: any[]): number {
  if (categoryDistribution.length <= 1) return 100;

  const percentages = categoryDistribution.map((cat) => parseFloat(cat.percentage) / 100);
  const sortedPercentages = percentages.sort((a, b) => a - b);

  let cumulative = 0;
  let inequality = 0;

  sortedPercentages.forEach((p, i) => {
    cumulative += p;
    inequality += (i + 1) * p;
  });

  const n = sortedPercentages.length;
  const gini = (2 * inequality - n - 1) / n;

  return Math.round((1 - gini) * 100);
}

/** 获取平衡度描述 */
export function getBalanceDescription(categoryDistribution: any[]): string {
  const balanceScore = calculateBalanceScore(categoryDistribution);

  if (balanceScore >= 80) return '非常均衡';
  if (balanceScore >= 60) return '较为均衡';
  if (balanceScore >= 40) return '相对集中';
  return '高度集中';
}

/** 分析分类趋势（近 6 月完成书 top5） */
export function analyzeCategoryTrends(categorizedBooks: any[]) {
  const recentBooks = categorizedBooks.filter((book) => book.completionDate && isRecentDate(book.completionDate)).slice(0, 10);

  const recentCategories: Record<string, number> = {};
  recentBooks.forEach((book) => {
    book.categories.forEach((cat: string) => {
      recentCategories[cat] = (recentCategories[cat] || 0) + 1;
    });
  });

  return Object.entries(recentCategories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** 判断是否为最近日期（6 个月内） */
export function isRecentDate(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return date > sixMonthsAgo;
  } catch {
    return false;
  }
}

/** 生成分类建议 */
export function generateCategoryRecommendations(categoryDistribution: any[], totalBooks: number): string[] {
  const recommendations: string[] = [];
  const diversityScore = calculateCategoryDiversity(categoryDistribution, totalBooks);

  if (diversityScore < 30) {
    recommendations.push('您的阅读分类比较集中，建议尝试不同类型的书籍来扩展视野');
  } else if (diversityScore > 70) {
    recommendations.push('您的阅读分类非常广泛，继续保持这种探索精神');
  } else {
    recommendations.push('您的阅读分类相对均衡，可以在现有基础上尝试相近领域');
  }

  if (categoryDistribution.length < 3 && totalBooks >= 5) {
    recommendations.push('阅读分类较少，建议设定每月尝试一个新分类的目标');
  }

  if (categoryDistribution.length > 0) {
    const topCategory = categoryDistribution[0];
    if (parseFloat(topCategory.percentage) > 40) {
      recommendations.push(`您对"${topCategory.name}"类书籍有强烈偏好，可以尝试该分类下的不同子类型`);
    }
  }

  const uncategorized = categoryDistribution.find((cat) => cat.name === '未分类');
  if (uncategorized && uncategorized.count > 0) {
    recommendations.push(`您有${uncategorized.count}本书未分类，建议为这些书籍添加分类标签`);
  }

  return recommendations;
}

/** 获取推荐分类 */
export function getSuggestedCategories(categoryDistribution: any[]): string[] {
  const allCategories = ['小说', '文学', '历史', '科技', '哲学', '心理学', '经济', '管理', '自我提升', '传记', '科普', '艺术', '教育', '健康', '旅行', '美食', '文化', '社会'];

  const currentCategories = new Set(categoryDistribution.map((cat) => cat.name));
  const suggested = allCategories.filter((cat) => !currentCategories.has(cat));

  return suggested.slice(0, 6);
}

/** 分析阅读分类（完整） */
export function analyzeReadingCategories(bookNotes: BookNoteEntry[]) {
  const categoryData = extractAndCategorizeBooks(bookNotes);
  const categoryDistribution = calculateCategoryDistribution(categoryData.categorizedBooks);
  const totalBooks = bookNotes.length;

  return {
    categoryDistribution,
    totalBooks,
    totalCategories: categoryDistribution.length,
    topCategory:
      categoryDistribution.length > 0
        ? categoryDistribution[0]
        : { name: '无数据', count: 0, percentage: '0' },
    top3Percentage: calculateTop3Percentage(categoryDistribution),
    diversityScore: calculateCategoryDiversity(categoryDistribution, totalBooks),
    diversityLevel: getDiversityLevel(categoryDistribution, totalBooks),
    balanceScore: calculateBalanceScore(categoryDistribution),
    balanceDescription: getBalanceDescription(categoryDistribution),
    categoryTrends: analyzeCategoryTrends(categoryData.categorizedBooks),
    recommendations: generateCategoryRecommendations(categoryDistribution, totalBooks),
    suggestedCategories: getSuggestedCategories(categoryDistribution),
    analyzedBooks: totalBooks,
    autoCategorized: categoryData.autoCategorizedCount,
  };
}

// ---------- 互动 ----------

/** 提取笔记互动数据 */
export function extractNotesInteractions(bookNotes: BookNoteEntry[]) {
  let totalHighlights = 0;
  let totalThinks = 0;
  let totalDialogue = 0;
  let totalOutlinks = 0;
  let booksWithInteractions = 0;

  bookNotes.forEach((book) => {
    const fm = book.frontmatter;

    const highlights = parseInt(fm.highlights) || 0;
    const thinks = parseInt(fm.thinks) || 0;
    const dialogue = parseInt(fm.dialogue) || 0;
    const outlinks = parseInt(fm.outlinks) || 0;

    totalHighlights += highlights;
    totalThinks += thinks;
    totalDialogue += dialogue;
    totalOutlinks += outlinks;

    if (highlights > 0 || thinks > 0 || dialogue > 0 || outlinks > 0) {
      booksWithInteractions++;
    }
  });

  const totalInteractions = totalHighlights + totalThinks + totalDialogue + totalOutlinks;

  const interactionDistribution = [
    {
      type: 'highlights',
      count: totalHighlights,
      percentage: totalInteractions > 0 ? ((totalHighlights / totalInteractions) * 100).toFixed(1) : '0.0',
      avgPerBook: (totalHighlights / Math.max(booksWithInteractions, 1)).toFixed(1),
    },
    {
      type: 'thinks',
      count: totalThinks,
      percentage: totalInteractions > 0 ? ((totalThinks / totalInteractions) * 100).toFixed(1) : '0.0',
      avgPerBook: (totalThinks / Math.max(booksWithInteractions, 1)).toFixed(1),
    },
    {
      type: 'dialogue',
      count: totalDialogue,
      percentage: totalInteractions > 0 ? ((totalDialogue / totalInteractions) * 100).toFixed(1) : '0.0',
      avgPerBook: (totalDialogue / Math.max(booksWithInteractions, 1)).toFixed(1),
    },
    {
      type: 'outlinks',
      count: totalOutlinks,
      percentage: totalInteractions > 0 ? ((totalOutlinks / totalInteractions) * 100).toFixed(1) : '0.0',
      avgPerBook: (totalOutlinks / Math.max(booksWithInteractions, 1)).toFixed(1),
    },
  ];

  return {
    totalHighlights,
    totalThinks,
    totalDialogue,
    totalOutlinks,
    totalInteractions,
    booksWithInteractions,
    interactionDistribution,
    avgHighlightsPerBook: (totalHighlights / Math.max(booksWithInteractions, 1)).toFixed(1),
  };
}

/** 计算想法比例 */
export function calculateThinkRatio(highlights: number, thinks: number): number {
  if (highlights === 0) return 0;
  return Math.round((thinks / highlights) * 100);
}

/** 计算互动评分 */
export function calculateInteractionScore(interactionData: any): number {
  let score = 0;

  score += Math.min(interactionData.totalHighlights * 0.1, 30);

  const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
  score += Math.min(thinkRatio * 0.25, 25);

  score += Math.min(interactionData.totalDialogue * 0.5, 20);

  score += Math.min(interactionData.totalOutlinks * 0.5, 25);

  return Math.min(Math.round(score), 100);
}

/** 计算参与度等级 */
export function calculateEngagementLevel(interactionData: any, totalBooks: number): string {
  const avgInteractionsPerBook = interactionData.totalInteractions / Math.max(totalBooks, 1);

  if (avgInteractionsPerBook >= 20) return '深度参与';
  if (avgInteractionsPerBook >= 10) return '积极参与';
  if (avgInteractionsPerBook >= 5) return '一般参与';
  if (avgInteractionsPerBook >= 1) return '轻度参与';
  return '观察者';
}

/** 分析互动模式 */
export function analyzeInteractionPattern(interactionData: any): string {
  const { totalHighlights, totalThinks, totalDialogue, totalOutlinks } = interactionData;
  const maxType = Math.max(totalHighlights, totalThinks, totalDialogue, totalOutlinks);

  if (maxType === totalHighlights && totalHighlights > totalThinks * 2) return '标记型读者';
  if (maxType === totalThinks && totalThinks > totalHighlights * 0.5) return '思考型读者';
  if (maxType === totalDialogue) return '交流型读者';
  if (maxType === totalOutlinks) return '连接型读者';
  if (totalThinks > totalHighlights * 0.3) return '平衡思考型';

  return '综合型读者';
}

/** 获取模式描述 */
export function getPatternDescription(interactionData: any): string {
  const pattern = analyzeInteractionPattern(interactionData);
  const descriptions: Record<string, string> = {
    标记型读者: '注重重点内容的标记和整理',
    思考型读者: '善于深入思考并提出个人见解',
    交流型读者: '喜欢与他人讨论和分享观点',
    连接型读者: '擅长建立知识之间的联系',
    平衡思考型: '在标记和思考之间保持良好平衡',
    综合型读者: '综合运用多种互动方式',
  };
  return descriptions[pattern] || '独特的阅读互动方式';
}

/** 分析思考深度 */
export function analyzeThinkingDepth(interactionData: any): string {
  const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);

  if (thinkRatio >= 40) return '深度思考';
  if (thinkRatio >= 25) return '中度思考';
  if (thinkRatio >= 10) return '基础思考';
  return '初步思考';
}

/** 获取思考描述 */
export function getThinkingDescription(interactionData: any): string {
  const depth = analyzeThinkingDepth(interactionData);
  const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
  return `想法占比 ${thinkRatio}%，${depth}水平`;
}

/** 分析连接水平 */
export function analyzeConnectionLevel(interactionData: any): string {
  const linkRatio = interactionData.totalHighlights > 0 ? (interactionData.totalOutlinks / interactionData.totalHighlights) * 100 : 0;

  if (linkRatio >= 30) return '高度连接';
  if (linkRatio >= 15) return '中度连接';
  if (linkRatio >= 5) return '基础连接';
  return '初步连接';
}

/** 获取连接描述 */
export function getConnectionDescription(interactionData: any): string {
  const level = analyzeConnectionLevel(interactionData);
  const linkRatio = interactionData.totalHighlights > 0 ? Math.round((interactionData.totalOutlinks / interactionData.totalHighlights) * 100) : 0;
  return `链接密度 ${linkRatio}%，${level}水平`;
}

/** 分析笔记互动数据（完整） */
export function analyzeNotesInteractions(bookNotes: BookNoteEntry[]) {
  const interactionData = extractNotesInteractions(bookNotes);
  const totalBooks = bookNotes.length;

  return {
    ...interactionData,
    totalBooks,
    thinkRatio: calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks),
    interactionScore: calculateInteractionScore(interactionData),
    engagementLevel: calculateEngagementLevel(interactionData, totalBooks),
    interactionPattern: analyzeInteractionPattern(interactionData),
    patternDescription: getPatternDescription(interactionData),
    thinkingDepth: analyzeThinkingDepth(interactionData),
    thinkingDescription: getThinkingDescription(interactionData),
    connectionLevel: analyzeConnectionLevel(interactionData),
    connectionDescription: getConnectionDescription(interactionData),
    recommendations: generateInteractionRecommendations(interactionData, totalBooks),
  };
}

/** 生成互动优化建议 */
export function generateInteractionRecommendations(interactionData: any, totalBooks: number): string[] {
  const recommendations: string[] = [];
  const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
  const avgInteractions = interactionData.totalInteractions / Math.max(totalBooks, 1);

  if (avgInteractions < 5) {
    recommendations.push('建议增加阅读时的互动频率，尝试对重要内容进行标记');
  } else if (avgInteractions > 20) {
    recommendations.push('您的互动频率很高，继续保持这种深度参与的习惯');
  }

  if (thinkRatio < 15) {
    recommendations.push('可以尝试在划线时多加入个人思考和评论');
  } else if (thinkRatio > 40) {
    recommendations.push('您的思考深度很好，考虑将想法整理成更系统的笔记');
  }

  if (interactionData.totalDialogue === 0) {
    recommendations.push('尝试参与书籍讨论，分享观点可以加深理解');
  }

  if (interactionData.totalOutlinks < interactionData.totalHighlights * 0.1) {
    recommendations.push('可以多建立知识之间的连接，构建知识网络');
  }

  if (recommendations.length === 0) {
    recommendations.push('您的笔记互动模式很均衡，继续保持！');
  }

  return recommendations;
}
