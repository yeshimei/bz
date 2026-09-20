/**
 * 阅读数据分析报告 stats（ticket 13）：全部数据采集与纯函数，源码逐字移植。
 * 源码：阅读数据分析报告.js（重复函数只保留最终版）
 *
 * 深审维护注记：
 * - RR-A1 供数面：EPUB 字段映射（progress 归一/subjects 分类/readingDate 生成）与 md 时长
 *   解析（parseReadingTimeMs）单源自 bookshelf/data 导出，本层消费（ADR-0091 宿主供数向），
 *   同输入与书架墙恒同输出（契约对照测试锁死）；不再自持镜像实现。
 * - C-4/EFF-8 一刀清：建议生成器（practical/focus/interaction/category/speed）与衍生死字段
 *   （trends 7 字段/habits 3 字段/focus 3 字段/categories 8 字段）及 generateMonthlySpeedTrend
 *   HTML 死模板（含内联 hex 与模拟数据）已删——上屏消费面 = report.ts 各段模板，未列字段即无产出。
 * - RR-F9 语义拍板：EPUB 会话无 type 字段，mapWeaveSessionToReport 按有效起止派生
 *   type:'completed'（有起止且时长 > 0 即完成会话）——会话完成率不再恒 0 压低专注分。
 * - RR-F10：start 缺失/非法的会话直接丢弃（不再补 0 落 1970 幽灵月）。
 */
import { pad2 } from '../core/utils';
import { CHART_HEATMAP_SERIES } from '../core/chart-palette';
import {
  readWeaveAggregates,
  resolveBookTag,
  resolveFolderPath,
  epubProgress,
  epubCategory,
  epubReadingDate,
  parseReadingTimeMs,
  isBookshelfPath,
} from '../bookshelf/data';

// ---------- 数据采集 ----------

export interface BookNoteEntry {
  file: any;
  frontmatter: Record<string, any>;
  cache: any;
}

/**
 * 阅读会话 → 报告 frontmatter 形状（duration 秒；start 可被 new Date 解析）。
 * RR-F10：start 缺失/非法（非有限数或 <= 0）→ 返回 null 由调用方过滤——不再补 0
 * 落 1970-01-01 幽灵月（热力图翻月可达、连续天数被孤点干扰）。
 * RR-F9：EPUB 会话无 type 字段，按有效起止派生 type:'completed'（有起止且时长 > 0
 * 即完成会话）——analyzeReadingSessions/analyzeSessionFocus 的完成率口径不再恒 0。
 */
function mapWeaveSessionToReport(session: any): any | null {
  const rawStart = session?.start;
  const start = typeof rawStart === 'number' && Number.isFinite(rawStart) && rawStart > 0 ? rawStart : null;
  if (start === null) return null;
  const end = typeof session?.end === 'number' ? session.end : start;
  const durationSeconds =
    typeof session?.durationSeconds === 'number' ? Math.round(session.durationSeconds) : 0;
  return {
    start,
    end,
    duration: durationSeconds,
    type: end > start && durationSeconds > 0 ? 'completed' : undefined,
  };
}

function toIsoDate(timestamp: number | undefined): string | null {
  if (!Number.isFinite(timestamp) || !timestamp) return null;
  const d = new Date(timestamp); // 本地时区 YYYY-MM-DD（原 UTC 切片会在时区边界偏移一天）
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 把 Weave 书籍聚合映射为报告书条目（frontmatter 口径与 md 书一致，缺 field 补缺省）。
 * RR-A1：progress 归一 / subjects 分类 / readingDate 生成经 bookshelf/data 共享纯函数，
 * 与书架墙 buildEpubItem 同源（RR-F1 subjects 通道 / RR-F4 progress 前置随刀收敛）。
 */
function buildEpubBookNoteEntry(aggregate: any): BookNoteEntry | null {
  const meta = aggregate?.meta;
  const fileRef = aggregate?.file;
  const reading = aggregate?.reading;
  const notes = aggregate?.notes;
  const stats = reading?.stats;
  const vaultPath = typeof fileRef?.vaultPath === 'string' ? fileRef.vaultPath.trim() : '';
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  if (!vaultPath || !title) return null;

  const progress = epubProgress(reading?.position?.percent);
  const wordCount = typeof meta?.wordCount === 'number' && meta.wordCount > 0 ? meta.wordCount : 0;
  const pages = Math.floor(wordCount / 500);
  const sessions = Array.isArray(reading?.sessions) ? reading.sessions : [];
  const readingDate = epubReadingDate(progress, stats?.lastReadTime);

  return {
    file: {
      path: vaultPath,
      name: vaultPath.split('/').pop() || title,
      basename: vaultPath.split('/').pop()?.replace(/\.[^./]+$/, '') || title,
    },
    frontmatter: {
      title,
      author: typeof meta?.author === 'string' && meta.author.trim() ? meta.author.trim() : '未知作者',
      // ADR-0099 subjects 通道（RR-F1）：与书架墙同源回落，无 subjects 才归「未分类」
      category: epubCategory(meta) || '未分类',
      readingProgress: progress,
      readingTime: typeof stats?.totalReadTime === 'number' ? stats.totalReadTime : 0,
      readingSessions: sessions
        .map(mapWeaveSessionToReport)
        .filter((s: any): s is NonNullable<typeof s> => s !== null),
      readingDate,
      completionDate: toIsoDate(stats?.completedTime),
      highlights: Array.isArray(notes?.highlights) ? notes.highlights.length : 0,
      thinks: Array.isArray(notes?.excerpts) ? notes.excerpts.length : 0,
      dialogue: 0,
      outlinks: 0,
      pages,
      wordCount,
    },
    cache: null,
  };
}

/** 阅读报告的 EPUB 书条目（全库 weave 书，不筛目录；ADR-0013 扩展）。 */
export async function getEpubBookNotes(app: any): Promise<BookNoteEntry[]> {
  const aggregates = await readWeaveAggregates(app);
  const entries: BookNoteEntry[] = [];
  for (const aggregate of aggregates) {
    const entry = buildEpubBookNoteEntry(aggregate);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * 获取书库目录内所有带 book 标签的笔记。
 * 口径（读书报告内嵌化拍板）：只统计书库目录内的书，与书架墙 scanMarkdownBooks 同规则——
 * 路径在书库目录（bookshelfFolderPath 回落链）之下，或目录本身是单个 md 笔记；
 * 库外 book 标签笔记不再混入报告（书架墙看不到的书，报告也不统计）。
 */
export function getAllBookNotes(app: any): BookNoteEntry[] {
  // 旧 library 域退役：book 标签改经 bookshelf 域解析（bookshelfFolderPath/bookTag 同键同源）
  const bookTag = resolveBookTag();
  const folderPath = resolveFolderPath();
  const files = app.vault.getMarkdownFiles();
  const bookNotes: BookNoteEntry[] = [];

  for (const file of files) {
    try {
      // 口径单源（RR-A1）：isBookshelfPath 与书架墙 scanMarkdownBooks 回落分支/宿主刷新
      // schedule 同一谓词——目录前缀 + 目录本身单文件两形态，三处不再各写一份
      if (!isBookshelfPath(file.path, folderPath)) continue;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;

      const tags = cache.frontmatter.tags;
      // 与 bookshelf/data.ts parseBookFile 口径对齐：数组项/整串精确等值（'ebook' 等子串不再误判）
      let isBook = false;

      if (typeof tags === 'string') {
        isBook = tags === bookTag;
      } else if (Array.isArray(tags)) {
        isBook = tags.includes(bookTag);
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
    // RR-F8：用户数据（author/category）直接做键——用无原型空对象防 `constructor`/
    // `__proto__` 键命中 Object.prototype 后把 count++ 写上全局原型（原型污染可达面）
    authorStats: Object.create(null),
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
      // RR-F4：钳 [0,100]——负数手滑不再落「刚开始」桶、超 100 进「已完成」桶（与宿主 data.ts 同款钳制）
      const readingProgress = Math.max(0, Math.min(100, parseFloat(fm.readingProgress) || 0));
      // RR-F5/A1 供数面：parseReadingTimeMs 单源（readingTime 毫秒直读 → readingTimeFormat 中文/weave 双格式兜底）
      const readingTime = parseReadingTimeMs(fm);
      // EFF-3：单趟归并——旧写法逐书 concat + 全量重 filter（O(n²·m) 大库热点），
      // 前缀全为重复劳动；push 直写语义逐字等价（顺序、>60s 阈值不变）
      if (Array.isArray(fm.readingSessions)) {
        for (const d of fm.readingSessions) {
          if (d.duration > 60) stats.readingSessions.push(d);
        }
      }

      // 统计阅读状态（audit G：与 bookshelf/library 双日期口径统一——
      // readingDate && completionDate 才算已读；只补完成日期的书在两面板不再状态分叉）
      if (fm.readingDate && fm.completionDate) {
        stats.readBooks++;
      } else if (fm.readingDate) {
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
          const monthKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
          const yearKey = date.getFullYear().toString();

          if (!stats.monthlyStats[monthKey]) stats.monthlyStats[monthKey] = emptyMonthlyStats();
          stats.monthlyStats[monthKey].booksRead++;
          stats.monthlyStats[monthKey].totalReadingTime += readingTime;
          stats.monthlyStats[monthKey].totalHighlights += parseInt(fm.highlights) || 0;
          // audit H：booksCompleted 只在 completionDate 桶记一次（下方完成日期统计），
          // 不再在阅读月按 progress>=100 重复计数

          if (!stats.yearlyStats[yearKey]) stats.yearlyStats[yearKey] = emptyYearlyStats();
          stats.yearlyStats[yearKey].booksRead++;
          stats.yearlyStats[yearKey].totalReadingTime += readingTime;
          stats.yearlyStats[yearKey].totalHighlights += parseInt(fm.highlights) || 0;
        } catch (dateError) {
          console.warn(`日期解析错误: ${fm.readingDate}`, dateError);
        }
      }

      // 基于完成日期的统计
      if (fm.completionDate) {
        try {
          const compDate = new Date(fm.completionDate);
          const compMonthKey = `${compDate.getFullYear()}-${pad2(compDate.getMonth() + 1)}`;
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

/**
 * 格式化阅读时长（RR-U5 统一中文形制单源：报告全屏唯一时长格式）。
 * 旧实现「Nh/Nm」英文缩写与 formatSessionDuration 中文形制同屏混用，且概览卡
 * 靠 replace('h','小时') 链临时换写法（实现漂移即静默破功）——三处归一于此。
 */
export function formatReadingTime(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}

/** 格式化会话时长（秒入口；形制单源转发 formatReadingTime，RR-U5） */
export function formatSessionDuration(seconds: number): string {
  return formatReadingTime(seconds * 1000);
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

/**
 * 分析阅读习惯（C-4 一刀清：readingPattern/focusLevel/peakTime 从不上屏——
 * 习惯段模板只消费 timeDistribution，产出即删，防「以为在屏上」的断钩）。
 */
export function analyzeReadingHabits(sessions: any[]) {
  const stats = analyzeReadingSessions(sessions);

  const timeDistribution: Record<string, string> = {};
  Object.entries(stats.timeSlots).forEach(([slot, count]) => {
    timeDistribution[slot] = ((count as number) / sessions.length * 100).toFixed(1);
  });

  return { timeDistribution };
}

// ---------- 趋势 ----------

/** 获取月度趋势数据（最近 12 个月） */
function getMonthlyTrendData(stats: ReadingStats) {
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
function calculateMonthlyAverage(monthlyData: any[]): string {
  if (monthlyData.length === 0) return '0.0';
  const total = monthlyData.reduce((sum, data) => sum + data.booksRead, 0);
  return (total / monthlyData.length).toFixed(1);
}

/** 获取当前月统计（audit F：按当前年月键直查；当月无数据 → 0，不再取「升序末位」的旧月份数据） */
function getCurrentMonthStats(monthlyData: any[], now: Date = new Date()) {
  const key = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const current = monthlyData.find((m) => m.month === key);
  return {
    books: current?.booksRead ?? 0,
    completed: current?.booksCompleted ?? 0,
  };
}

/** 计算季度平均值 */
function calculateQuarterlyAverage(monthlyData: any[]): string {
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

/**
 * 分析阅读趋势；now 供测试固定「本月」。
 * C-4/EFF-8 一刀清：趋势段模板只消费 currentMonth/quarterlyAvg/completionRate/
 * trendDirection/recentMonths 五项，monthlyAvg/focusScore/focusLevel/consistencyDays/
 * consistencyLevel/efficiency/recommendations 七个从不上屏的死字段与四个建议生成器
 * （generatePractical/Focus/Interaction/Category + speed.recommendation）已删；
 * calculateFocusScore/calculateConsistencyDays 保留为导出纯函数（独立测试在位）。
 */
export function analyzeReadingTrends(stats: ReadingStats, now: Date = new Date()) {
  const monthlyData = getMonthlyTrendData(stats); // 升序（旧→新）
  const ascendingRecent = monthlyData.slice(-6); // 统计口径：反转前的升序切片
  const recentMonths = [...ascendingRecent].reverse(); // 最近6个月，仅供图表高亮展示（新→旧）

  return {
    recentMonths,
    currentMonth: getCurrentMonthStats(ascendingRecent, now),
    quarterlyAvg: calculateQuarterlyAverage(ascendingRecent),
    completionRate: calculateCompletionRate(stats),
    trendDirection: analyzeTrendDirection(ascendingRecent),
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

/** 计算连续阅读天数（简化：月数*7，上限 30） */
export function calculateConsistencyDays(stats: ReadingStats): number {
  const monthlyCount = Object.keys(stats.monthlyStats).length;
  return Math.min(monthlyCount * 7, 30);
}

// ---------- 热力图 ----------

/** 处理热力图数据 */
export function processHeatmapData(readingSessions: any[]) {
  const dailyData: Record<string, any> = {};
  let totalDuration = 0;
  let totalSessions = 0;

  readingSessions.forEach((session) => {
    const date = new Date(session.start);
    const dateKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; // 本地时区日桶键
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
function groupByMonth(dailyData: Record<string, any>) {
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

/** 热力图月键全集（升序）：翻月导航 ‹ › 的可切换范围（processHeatmapData 已算全部月度数据） */
export function getHeatmapMonthKeys(heatmapData: { monthlyData: Record<string, any> }): string[] {
  return Object.keys(heatmapData?.monthlyData || {}).sort();
}

/**
 * 某年 12 个月柱数据（固定 1..12 月，缺月补零）：年卡展开的月柱数据源。
 * 月桶口径与热力图翻月同源（都按 YYYY-MM 键聚合；本函数读 calculateReadingStats.monthlyStats）。
 */
export function getYearMonthBars(
  monthlyStats: Record<string, any>,
  year: string,
): { month: string; label: string; booksRead: number; booksCompleted: number }[] {
  const bars: { month: string; label: string; booksRead: number; booksCompleted: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${pad2(m)}`;
    const bucket = monthlyStats?.[key];
    bars.push({
      month: key,
      label: `${m}月`,
      booksRead: bucket?.booksRead || 0,
      booksCompleted: bucket?.booksCompleted || 0,
    });
  }
  return bars;
}

/** 计算强度等级 */
export function calculateIntensityLevel(durationHours: number): number {
  if (durationHours >= 4) return 4;
  if (durationHours >= 2) return 3;
  if (durationHours >= 1) return 2;
  if (durationHours >= 0.5) return 1;
  return 0;
}

/** 获取热力图颜色（C-2 收编：色阶常量正典 core/chart-palette，同形系列单源） */
export function getHeatmapColor(level: number): string {
  return CHART_HEATMAP_SERIES[level] || CHART_HEATMAP_SERIES[0];
}

// ---------- 专注度（会话级） ----------

/**
 * 分析阅读专注度数据。
 * C-4 一刀清：专注段模板只消费 focusScore/deepSessions/bestTimeSlot/sessionDistribution/
 * trendDescription/trendIcon/consistencyScore/efficiencyScore——avgSessionTime/completionRate/
 * trend/recommendations（generateFocusRecommendations）从不上屏，产出即删。
 */
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
    bestTimeSlot: timeAnalysis.bestTimeSlot,
    sessionDistribution: sessionAnalysis.distribution,
    trendDescription: trendAnalysis.description,
    trendIcon: trendAnalysis.icon,
    consistencyScore: consistencyAnalysis.score,
    efficiencyScore: calculateEfficiencyScore(bookNotes),
  };
}

/** 分析会话专注度 */
function analyzeSessionFocus(sessions: any[]) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.type === 'completed').length;
  const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
  const avgDuration = totalDuration / totalSessions;

  const distribution: { type: string; max: number; count: number; percentage: number }[] = [
    { type: 'short', max: 600, count: 0, percentage: 0 },      // <10分钟
    { type: 'light', max: 1800, count: 0, percentage: 0 },     // 10-30分钟
    { type: 'medium', max: 3600, count: 0, percentage: 0 },    // 30-60分钟
    { type: 'deep', max: 7200, count: 0, percentage: 0 },      // 1-2小时
    { type: 'intense', max: Infinity, count: 0, percentage: 0 }, // >2小时
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
    cat.percentage = totalSessions > 0 ? Math.round((cat.count / totalSessions) * 100) : 0;
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
function analyzeFocusTimePatterns(sessions: any[]) {
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
function analyzeFocusTrend(sessions: any[]) {
  if (sessions.length < 5) {
    return { trend: '数据不足', description: '需要更多会话数据进行趋势分析', icon: 'minus' };
  }

  const sortedSessions = [...sessions].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const earlySessions = sortedSessions.slice(0, Math.floor(sessions.length / 2));
  const recentSessions = sortedSessions.slice(-Math.floor(sessions.length / 2));

  const earlyAvg = earlySessions.reduce((sum, s) => sum + s.duration, 0) / earlySessions.length;
  const recentAvg = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;

  const trendPercentage = ((recentAvg - earlyAvg) / earlyAvg) * 100;

  if (trendPercentage > 20) {
    return { trend: '显著提升', description: `+${Math.round(trendPercentage)}%`, icon: 'trending-up' };
  } else if (trendPercentage > 5) {
    return { trend: '稳步提升', description: `+${Math.round(trendPercentage)}%`, icon: 'arrow-up-right' };
  } else if (trendPercentage < -10) {
    return { trend: '需要关注', description: `-${Math.round(Math.abs(trendPercentage))}%`, icon: 'trending-down' };
  } else {
    return { trend: '保持稳定', description: '0%', icon: 'arrow-right' };
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

/** 获取默认专注度数据（当无会话数据时；报告层对空会话走独立空态卡，不亮默认分——RR-U12） */
function getDefaultFocusData() {
  return {
    focusScore: 50,
    deepSessions: 0,
    bestTimeSlot: '暂无数据',
    sessionDistribution: [
      { type: 'short', count: 0, percentage: 0 },
      { type: 'light', count: 0, percentage: 0 },
      { type: 'medium', count: 0, percentage: 0 },
      { type: 'deep', count: 0, percentage: 0 },
      { type: 'intense', count: 0, percentage: 0 },
    ],
    trendDescription: '需要更多阅读数据',
    trendIcon: 'minus',
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

  /**
   * C-4/RR-U8 一刀清：recommendation（建议文案不上屏）、monthlyTrend（死字段，原挂
   * generateMonthlySpeedTrend HTML 死模板——含 Math.random() 模拟数据与 5 处内联 hex，
   * RR-A3 分层违例随删）、bestSpeed（均值×1.2 的编造值，无真实统计不上屏）已删。
   */
  return {
    speedLevel,
    speedPercentage,
    efficiencyScore,
    readingType,
    // 平均每本口径（总时长 ÷ 已读本数；标签在 report.ts 如实标「平均每本时长」）
    avgSessionTime: formatReadingTime(stats.totalReadingTime / Math.max(stats.readBooks, 1)),
  };
}

// ---------- 类别 ----------

/**
 * 提取书籍分类（RR-F3 口径单源对齐宿主 parseBookFile：`String(fm.category)` 原串一桶，
 * 不再按逗号/斜杠拆分多类值——拆分展示与墙侧精确等值筛选（categoryLabel === cat）恒不
 * 互洽，多类书点分类行回墙「筛不中该书」；数组经 String() 与宿主 toString 同为拼接串）。
 */
function extractAndCategorizeBooks(bookNotes: BookNoteEntry[]) {
  const categorizedBooks: any[] = [];

  bookNotes.forEach((book) => {
    const raw = book.frontmatter.category;
    // 无分类不入分布（宿主侧书脊由供数面给「未分类」字符串；md 缺 category 维持不入桶）
    const category = raw !== undefined && raw !== null && String(raw).trim() !== '' ? String(raw) : '';
    categorizedBooks.push({
      title: book.file ? book.file.name : '未知书籍',
      categories: category ? [category] : [],
    });
  });

  return { categorizedBooks };
}

/** 计算分类分布 */
function calculateCategoryDistribution(categorizedBooks: any[]) {
  // RR-F8：分类名做键——无原型空对象防 `__proto__`/`constructor` 键写上 Object.prototype
  const categoryCount: Record<string, number> = Object.create(null);

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

/**
 * 计算分类多样性（香农指数归一）。
 * RR-F3 同根防御：p 按 totalBooks 归一，多类口径下 Σcount 可超 totalBooks 使熵溢出
 * （上屏 > 100%）——钳 [0,100]（口径收敛后常态到不了边界，此处只兜数据防御）。
 */
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

  return Math.max(0, Math.min(100, Math.round(score)));
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

/**
 * 分析阅读分类。
 * C-4 一刀清：分类段模板只消费 categoryDistribution/totalBooks/totalCategories/
 * topCategory/diversityScore/balanceScore——top3Percentage/diversityLevel/
 * balanceDescription/categoryTrends/recommendations/suggestedCategories/analyzedBooks/
 * autoCategorized 从不上屏，产出与配套生成器（getSuggestedCategories 等）已删。
 */
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
    diversityScore: calculateCategoryDiversity(categoryDistribution, totalBooks),
    balanceScore: calculateBalanceScore(categoryDistribution),
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
function calculateEngagementLevel(interactionData: any, totalBooks: number): string {
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
function getPatternDescription(interactionData: any): string {
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
function analyzeThinkingDepth(interactionData: any): string {
  const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);

  if (thinkRatio >= 40) return '深度思考';
  if (thinkRatio >= 25) return '中度思考';
  if (thinkRatio >= 10) return '基础思考';
  return '初步思考';
}

/** 获取思考描述 */
function getThinkingDescription(interactionData: any): string {
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
function getConnectionDescription(interactionData: any): string {
  const level = analyzeConnectionLevel(interactionData);
  const linkRatio = interactionData.totalHighlights > 0 ? Math.round((interactionData.totalOutlinks / interactionData.totalHighlights) * 100) : 0;
  return `链接密度 ${linkRatio}%，${level}水平`;
}

/** 分析笔记互动数据（C-4：recommendations 死输出与 generateInteractionRecommendations 随刀删） */
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
  };
}
