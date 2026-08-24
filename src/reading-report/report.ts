/**
 * 阅读数据分析报告 report（ticket 13）：全部 HTML 生成函数，源码逐字移植。
 * 源码：阅读数据分析报告.js（重复函数只保留最终版）
 */
import {
  formatReadingTime,
  formatSessionDuration,
  analyzeReadingHabits,
  analyzeSessionDurationDistribution,
  analyzeReadingTrends,
  analyzeReadingFocus,
  processHeatmapData,
  analyzeReadingSpeed,
  analyzeReadingCategories,
  analyzeNotesInteractions,
  calculateIntensityLevel,
  getHeatmapColor,
} from './stats';
import type { ReadingStats, BookNoteEntry } from './stats';
import { pad2 } from '../core/utils';

// ---------- 主报告 ----------

export function generateFullStatsReport(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  return `
  ${generateStatsReport(stats)}
  ${generateReadingNotesInteractionAnalysis(bookNotes)}
  ${generateReadingHeatmap(stats.readingSessions)}
  ${generateReadingHabitsDeepAnalysis2(stats.readingSessions)}
  ${generateReadingFocusAnalysis(stats, bookNotes)}
  ${generateYearlyStats(stats)}
  ${generateReadingTrendsAnalysis(stats, bookNotes)}
  ${generateAuthorStats(stats)}
  ${generateReadingCategoryAnalysis(bookNotes)}
  ${generateReadingSpeedAnalysis(stats)}
  `;
}

/** 生成主要统计报告 */
export function generateStatsReport(stats: ReadingStats): string {
  const totalFormattedTime = formatReadingTime(stats.totalReadingTime);
  const avgReadingTime = formatReadingTime(stats.totalReadingTime / Math.max(stats.readBooks, 1));

  return `
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">

  <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.totalBooks}</div>
  <div>书库</div>
  </div>
   
  <div style="background: linear-gradient(135deg, #f093fb, #f5576c); padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.readBooks}</div>
  <div>已读</div>
  </div>

  <div style="background: linear-gradient(135deg, #4facfe, #00f2fe); padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.readingBooks}</div>
  <div>在读</div>
  </div>

  <div style="background: linear-gradient(135deg, #43e97b, #38f9d7); padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.unreadBooks}</div>
  <div>未读</div>
  </div>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
  <div style="font-size: 2.5em; font-weight: bold; color: #2c3e50; text-align: center; margin: 20px 0;">
  ${totalFormattedTime.replace('h', '小时').replace('m', '分钟')}
  </div>

  <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 30px;">
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: #e74c3c;">${stats.totalHighlights}</div>
  <div>划线</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${stats.totalThinks}</div>
  <div>想法</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: #9b59b6;">${stats.totalDialogue}</div>
  <div>讨论</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: #9b59b6;">${stats.totalOutlinks}</div>
  <div>出链</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: #27ae60;">${avgReadingTime}</div>
  <div>平均每本</div>
  </div>
  </div>
  </div>
  `;
}

// ---------- 年度 ----------

/** 生成年度统计报告 */
export function generateYearlyStats(stats: ReadingStats): string {
  const yearlyData = Object.entries(stats.yearlyStats).sort((a, b) => b[0].localeCompare(a[0]));

  if (yearlyData.length === 0) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666; padding: 40px 0;">暂无年度阅读数据</p>
    </div>`;
  }

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
  ${yearlyData
    .map(([year, data]: [string, any]) => {
      const completionRate = data.booksRead > 0 ? ((data.booksCompleted / data.booksRead) * 100).toFixed(1) : 0;
      return `
    <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 10px; color: white; text-align: center;">
    <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">${year}年</div>
    <div style="font-size: 2em; font-weight: bold;">${data.booksRead}</div>
    <div>阅读数量</div>
    <div style="font-size: 0.8em; opacity: 0.8; margin-top: 3px;">
    ${formatReadingTime(data.totalReadingTime)}
    </div>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>
  `;
}

// ---------- 作者 ----------

/** 生成作者统计模块 */
export function generateAuthorStats(stats: ReadingStats): string {
  const topAuthors = Object.entries(stats.authorStats)
    .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
    .slice(0, 5);

  if (topAuthors.length === 0) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666;">暂无作者统计数据</p>
    </div>`;
  }

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
  ${topAuthors
    .map(([author, data]: [string, any], index) => {
      const completionRate = data.totalBooks > 0 ? ((data.completedBooks / data.totalBooks) * 100).toFixed(1) : 0;
      const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#3498db', '#9b59b6'];

      return `
    <div style="background: linear-gradient(135deg, ${rankColors[index] || '#95a5a6'}, ${rankColors[index] ? rankColors[index] + 'cc' : '#7f8c8d'});
    padding: 15px; border-radius: 8px; color: white; position: relative;">
    <div style="font-size: 2em; position: absolute; top: 10px; right: 15px; opacity: 0.3;">${index + 1}</div>
    <div style="font-weight: bold; font-size: 1.1em;">${author}</div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
    <span>作品数: ${data.totalBooks}</span>
    <span>完成: ${completionRate}%</span>
    </div>
    <div style="margin-top: 5px; font-size: 0.9em;">
    阅读时长: ${formatReadingTime(data.totalReadingTime)}
    </div>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>
  `;
}

// ---------- 速度 ----------

/** 生成移动端优化的阅读速度分析模块（最终版 L1880） */
export function generateReadingSpeedAnalysis(stats: ReadingStats): string {
  if (stats.readingSpeed.totalPages === 0 && stats.readingSpeed.totalWords === 0) {
    return '';
  }

  const speedAnalysis = analyzeReadingSpeed(stats);

  return `
  <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #eaeaea; margin: 16px 0; ">

  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">

  <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">总阅读量</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.totalPages / 1000).toFixed(1)}k</div>
  <div style="font-size: 12px; opacity: 0.8;">页数</div>
  </div>


  <div style="background: linear-gradient(135deg, #4facfe, #00f2fe); padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">阅读速度</div>
  <div style="font-size: 20px; font-weight: 600;">${stats.readingSpeed.averagePagesPerHour.toFixed(0)}</div>
  <div style="font-size: 12px; opacity: 0.8;">页/小时</div>
  </div>


  <div style="background: linear-gradient(135deg, #43e97b, #38f9d7); padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">总字数</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.totalWords / 10000).toFixed(1)}w</div>
  <div style="font-size: 12px; opacity: 0.8;">万字</div>
  </div>


  <div style="background: linear-gradient(135deg, #ff6b6b, #ff8e8e); padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">字速</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.averageWordsPerHour / 1000).toFixed(1)}k</div>
  <div style="font-size: 12px; opacity: 0.8;">字/小时</div>
  </div>
  </div>


  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div style="font-size: 15px; font-weight: 500; color: #2c3e50;">速度等级</div>
  <div style="font-size: 14px; color: #666;">${speedAnalysis.speedLevel}</div>
  </div>


  <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
  <div style="width: ${speedAnalysis.speedPercentage}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); border-radius: 4px;"></div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
  <span>较慢</span>
  <span>适中</span>
  <span>快速</span>
  </div>
  </div>


  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">

  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; text-align: center;">
  <div style="font-size: 12px; color: #666; margin-bottom: 4px;">效率评分</div>
  <div style="font-size: 18px; font-weight: 600; color: #ff6b6b;">${speedAnalysis.efficiencyScore}/10</div>
  </div>


  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; text-align: center;">
  <div style="font-size: 12px; color: #666; margin-bottom: 4px;">阅读类型</div>
  <div style="font-size: 14px; font-weight: 500; color: #667eea;">${speedAnalysis.readingType}</div>
  </div>

  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; text-align: center;">
  <div style="font-size: 12px; color: #666; margin-bottom: 4px;">最佳速度</div>
  <div style="font-size: 18px; font-weight: 600; color: #64d6f3;">${speedAnalysis.bestSpeed}页/小时</div>
  </div>

  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; text-align: center;">
  <div style="font-size: 12px; color: #666; margin-bottom: 4px;">平均时长</div>
  <div style="font-size: 18px; font-weight: 600; color: #ff6b6b;">${speedAnalysis.avgSessionTime}</div>
  </div>
  </div>
  </div>
  `;
}

// ---------- 时段分布 ----------

/** 改进的时间段分布饼图生成函数（最终版 L795） */
export function generateTimeDistributionChart(timeDistribution: Record<string, string>): string {
  const colors: Record<string, string> = {
    morning: '#4facfe',
    afternoon: '#00f2fe',
    evening: '#667eea',
    night: '#764ba2',
  };

  let cumulativePercent = 0;
  return Object.entries(timeDistribution)
    .map(([slot, percentage]) => {
      const percent = parseFloat(percentage) / 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      return `
    <circle cx="50" cy="50" r="40" fill="transparent"
    stroke="${colors[slot]}"
    stroke-width="10"
    stroke-dasharray="${percent * 251.2} ${(1 - percent) * 251.2}"
    stroke-dashoffset="${-startPercent * 251.2}">
    </circle>
    `;
    })
    .join('');
}

// ---------- 习惯深度 ----------

/** 生成阅读习惯深度分析模块（增强版，包含会话时长饼图） */
export function generateReadingHabitsDeepAnalysis2(readingSessions: any[]): string {
  if (!readingSessions || readingSessions.length < 5) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666;">需要更多会话数据进行分析</p>
    </div>`;
  }

  const analysis = analyzeReadingHabits(readingSessions);
  const durationAnalysis = analyzeSessionDurationDistribution(readingSessions);

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

  <!-- 双饼图布局：时间段分布 + 会话时长分布 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin: 30px 0;">

  <!-- 时间段分布饼图 -->
  <div style="text-align: center;">

  <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
  <div style="width: 180px; height: 180px; position: relative;">
  <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 100%; height: 100%;">
  ${generateTimeDistributionChart(analysis.timeDistribution)}
  </svg>
  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
  <div style="font-size: 1.2em; font-weight: bold;">${readingSessions.length}</div>
  <div style="font-size: 0.8em; color: #7f8c8d;">总会话</div>
  </div>
  </div>
  </div>
  <div style="font-size: 0.8rem;">
  ${Object.entries(analysis.timeDistribution)
    .map(([timeSlot, percentage]) => {
      const colors: Record<string, string> = {
        morning: '#4facfe',
        afternoon: '#00f2fe',
        evening: '#667eea',
        night: '#764ba2',
      };
      const labels: Record<string, string> = {
        morning: '早晨 (6-12点)',
        afternoon: '下午 (12-18点)',
        evening: '晚上 (18-24点)',
        night: '深夜 (0-6点)',
      };

      return `
    <div style="display: flex; align-items: center; justify-content: center; margin: 5px 0;">
    <div style="width: 12px; height: 12px; background: ${colors[timeSlot]}; border-radius: 50%; margin-right: 8px;"></div>
    <span style="flex: 1; text-align: left;">${labels[timeSlot]}</span>
    <span style="font-weight: bold; margin-left: 10px;">${percentage}%</span>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>


  </div>
  </div>

  `;
}

// ---------- 趋势 ----------

/** 生成阅读趋势分析模块（移动端优化版） */
export function generateReadingTrendsAnalysis(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  const trends = analyzeReadingTrends(stats, bookNotes);

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

  <!-- 核心指标概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #667eea;">${trends.currentMonth.books}</div>
  <div style="font-size: 0.9em; color: #666;">本月阅读</div>
  </div>
  <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #4facfe;">${trends.quarterlyAvg}</div>
  <div style="font-size: 0.9em; color: #666;">季度平均</div>
  </div>
  <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #43e97b;">${trends.completionRate}</div>
  <div style="font-size: 0.9em; color: #666;">完成率</div>
  </div>
  <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #ff6b6b;">${trends.trendDirection}</div>
  <div style="font-size: 0.9em; color: #666;">趋势方向</div>
  </div>
  </div>

  <!-- 移动端优化的月度趋势 -->
  <div style="margin: 25px 0;">
  <div style="font-weight: bold; color: #2c3e50; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">

  </div>
  ${generateMobileFriendlyTrendChart(trends.recentMonths)}
  </div>
  </div>
  `;
}

/** 移动端优化的趋势图表 */
export function generateMobileFriendlyTrendChart(recentMonths: any[]): string {
  if (recentMonths.length === 0) {
    return '<p style="text-align: center; color: #666; padding: 20px 0;">暂无月度数据</p>';
  }

  const maxBooks = Math.max(...recentMonths.map((data) => data.booksRead));
  const minHeight = 30;
  const maxHeight = 80;

  return `
  <div style="overflow-x: auto; margin: 10px 0; padding: 10px 0;">
  <div style="display: flex; align-items: end; gap: 15px; min-width: ${recentMonths.length * 70}px; padding: 0 10px;">
  ${recentMonths
    .map((data, index) => {
      const height = maxBooks > 0 ? minHeight + (data.booksRead / maxBooks) * (maxHeight - minHeight) : minHeight;
      const isCurrentMonth = index === 0;
      const monthLabel = data.month.split('-')[1] + '月';

      return `
    <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
    <div style="
    width: 100%;
    min-width: 40px;
    height: ${height}px;
    background: ${isCurrentMonth ? 'linear-gradient(to top, #667eea, #764ba2)' : 'linear-gradient(to top, #a8e6cf, #88d8a3)'};
    border-radius: 5px 5px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 0.9em;
    ">${data.booksRead}</div>
    <div style="margin-top: 8px; font-size: 0.8em; color: #666; text-align: center;">
    ${monthLabel}
    </div>
    <div style="font-size: 0.7em; color: #999; margin-top: 3px;">
    
    </div>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>
  `;
}

// ---------- 热力图 ----------

/** 生成阅读会话热力图模块（移动端优化版） */
export function generateReadingHeatmap(readingSessions: any[]): string {
  if (!readingSessions || readingSessions.length === 0) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666;">暂无阅读会话数据，无法生成热力图</p>
    </div>`;
  }

  const heatmapData = processHeatmapData(readingSessions);

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

  <!-- 热力图统计概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${heatmapData.totalDays}</div>
  <div style="font-size: 0.8em; color: #666;">有阅读天数</div>
  </div>

  <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: #ff6b6b;">${heatmapData.longestStreak}</div>
  <div style="font-size: 0.8em; color: #666;">最长连续天数</div>
  </div>
  </div>

  <!-- 热力图主体 -->
  <div style="margin: 25px 0;">
  ${generateHeatmapGrid(heatmapData)}
  </div>


  </div>
  `;
}

/** 生成热力图网格（移动端优化，只取最近 1 个月） */
export function generateHeatmapGrid(heatmapData: any): string {
  const months = Object.keys(heatmapData.monthlyData).sort().reverse().slice(0, 1);

  if (months.length === 0) {
    return '<p style="text-align: center; color: #666; padding: 40px 0;">暂无数据</p>';
  }

  return `
  <div style="overflow-x: auto; margin: 15px 0;">
  <div style="display: flex; flex-direction: column; gap: 15px; min-width: max-content; padding: 10px;">
  ${months
    .map((monthKey) => {
      const monthData = heatmapData.monthlyData[monthKey];
      return generateMonthHeatmap(monthData, monthKey);
    })
    .join('')}
  </div>
  </div>
  `;
}

/** 生成单月热力图 */
export function generateMonthHeatmap(monthData: any, monthKey: string): string {
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const [year, month] = monthKey.split('-');
  const monthName = monthNames[parseInt(month) - 1];

  const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
  const lastDay = new Date(parseInt(year), parseInt(month), 0);
  const daysInMonth = lastDay.getDate();

  let firstWeekday = firstDay.getDay();
  firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const weekRows: any[][] = [];
  let currentWeek: any[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    currentWeek.push({ type: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
    const dayData = monthData.dailyData[dateKey];

    currentWeek.push({
      type: dayData ? 'data' : 'future',
      date: dateKey,
      data: dayData,
      day,
    });

    if (currentWeek.length === 7 || day === daysInMonth) {
      weekRows.push([...currentWeek]);
      currentWeek = [];
    }
  }

  return `
  <div style="margin-bottom: 25px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div style="font-weight: bold; color: #2c3e50; font-size: 1.1em;">
  ${year}年${monthName}
  </div>

  </div>

  <!-- 星期标签 -->
  <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 8px; ">
  ${['一', '二', '三', '四', '五', '六', '日']
    .map(
      (day) => `
    <div style="text-align: center; font-size: 0.75em; color: #999; padding: 2px;">${day}</div>
    `
    )
    .join('')}
  </div>

  <!-- 热力图网格 -->
  <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-right:-20px ">
  ${weekRows.flatMap((week) => week.map((cell) => generateHeatmapCell(cell))).join('')}
  </div>
  </div>
  `;
}

/** 生成热力图单元格 */
export function generateHeatmapCell(cell: any): string {
  const baseSize = '20px';
  const mobileSize = '15px';

  if (cell.type === 'empty') {
    return `<div style="width: ${baseSize}; height: ${baseSize};
    @media (max-width: 768px) { width: ${mobileSize}; height: ${mobileSize}; }"></div>`;
  }

  if (cell.type === 'future') {
    return `<div style="width: ${baseSize}; height: ${baseSize};
    background: #f8f9fa; border-radius: 2px;
    @media (max-width: 768px) { width: ${mobileSize}; height: ${mobileSize}; }"
    title="${cell.date} - 未来日期"></div>`;
  }

  const durationHours = cell.data.duration / 3600;
  // 强度分级/配色复用 stats 纯函数（>=4h→4, >=2h→3, >=1h→2, >=0.5h→1, 其余 0）
  const color = getHeatmapColor(calculateIntensityLevel(durationHours));
  const tooltip = `${cell.date}\n阅读时长: ${(cell.data.duration / 3600).toFixed(1)}小时\n会话次数: ${cell.data.sessions}次`;

  return `
  <div style="width: ${baseSize}; height: ${baseSize};
  background: ${color}; border-radius: 2px; cursor: pointer;
  transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.1);
  @media (max-width: 768px) {
  width: ${mobileSize};
  height: ${mobileSize};
  }
  &:hover {
  transform: scale(1.2);
  z-index: 10;
  }"
  title="${tooltip}">
  </div>
  `;
}

// ---------- 专注度 ----------

/** 生成阅读专注度分析模块 */
export function generateReadingFocusAnalysis(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  const focusData = analyzeReadingFocus(stats.readingSessions, bookNotes);

  return `
 <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    
    <!-- 核心指标卡片 -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0;">
      
        <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.deepSessions}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">深度会话</div>
        </div>
        
        <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.trendDescription}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">专注趋势</div>
        </div>
        
        <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.bestTimeSlot}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">最佳时段</div>
            
            
        </div>
        
          <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.focusScore}/100</div>
            <div style="font-size: 0.8em; opacity: 0.9;">专注度评分</div>
        </div>
        
        
        <div style="padding: 15px; background: #f0f8f0; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #27ae60;">${focusData.consistencyScore}/10</div>
                <div style="font-size: 0.85em; color: #2c3e50;">连续性评分</div>
            </div>
            
            <div style="padding: 15px; background: #fef7e0; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #e67e22;">${focusData.efficiencyScore}/10</div>
                <div style="font-size: 0.85em; color: #2c3e50;">效率评分</div>
            </div>
    </div>
    
    <!-- 专注度分布图表 -->
    <div style="margin: 25px 0;">
        
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${focusData.sessionDistribution
              .map((item: any, index: number) => {
                const colors = ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb', '#1dd1a1'];
                const labels = ['碎片化 (<10分钟)', '轻度专注 (10-30分钟)', '中等专注 (30-60分钟)', '深度专注 (1-2小时)', '高度专注 (>2小时)'];

                return `
                <div style="display: flex; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <div style="width: 60px; font-size: 0.85em; color: #2c3e50; font-weight: bold;">${labels[index]}</div>
                    <div style="flex: 1; margin: 0 15px;">
                        <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${item.percentage}%; height: 100%; background: ${colors[index]}; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="width: 50px; text-align: right; font-size: 0.9em; color: #666;">${item.count}次 (${item.percentage}%)</div>
                </div>
                `;
              })
              .join('')}
        </div>
    </div>
    
    
    </div>
    
    <!-- 专注度对比 -->
    <div style="margin: 20px 0;">
   
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            
            
            
        </div>
    </div>
</div> `;
}

// ---------- 类别 ----------

/** 生成笔记类别分析模块 */
export function generateReadingCategoryAnalysis(bookNotes: BookNoteEntry[]): string {
  const categoryAnalysis = analyzeReadingCategories(bookNotes);

  if (categoryAnalysis.totalBooks === 0) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666;">暂无书籍分类数据</p>
    </div>`;
  }

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.totalCategories}</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">阅读分类</div>
  </div>

  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.5em; font-weight: bold; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${categoryAnalysis.topCategory.name}</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">最常阅读</div>
  </div>

  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.diversityScore}%</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">多样性</div>
  </div>

  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.balanceScore}%</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">平衡度</div>
  </div>
  </div>

  <div style="margin: 25px 0;">
  <div style="display: flex; flex-direction: column; align-items: center;">
  <div style="width: 200px; height: 200px; position: relative; margin-bottom: 20px;">
  <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 100%; height: 100%;">
  ${generateCategoryDistributionChart(categoryAnalysis.categoryDistribution)}
  </svg>
  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold;">${categoryAnalysis.totalBooks}</div>
  <div style="font-size: 0.8em; color: #7f8c8d;">总书籍</div>
  </div>
  </div>

  <div style="width: 100%; max-height: auto;  padding: 10px; border: 1px solid #f0f0f0; border-radius: 8px;">
  ${categoryAnalysis.categoryDistribution
    .map((category: any, index: number) => {
      const colors = ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff'];
      const color = colors[index % colors.length];

      return `
    <div style="display: flex; align-items: center; margin: 12px 0; padding: 8px; background: #f8f9fa; border-radius: 6px;">
    <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 12px; flex-shrink: 0;"></div>
    <div style="flex: 1; min-width: 0;">
    <div style="font-weight: bold; font-size: 0.9em; color: #2c3e50; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${category.name}</div>
    <div style="font-size: 0.8em; color: #7f8c8d;">${category.count}本书 · ${category.percentage}%</div>
    </div>
    <div style="font-size: 0.8em; color: #999; flex-shrink: 0; margin-left: 10px;">
    ${index < 3 ? '🏆'.repeat(3 - index) : ''}
    </div>
    </div>
    `;
    })
    .join('')}
  </div>
  </div>
  </div>
  </div>
  `;
}

/** 生成分类分布饼图 */
export function generateCategoryDistributionChart(categoryDistribution: any[]): string {
  const colors = ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff'];

  let cumulativePercent = 0;
  return categoryDistribution
    .slice(0, 8)
    .map((category, index) => {
      const percent = parseFloat(category.percentage) / 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      return `
    <circle cx="50" cy="50" r="40" fill="transparent"
    stroke="${colors[index % colors.length]}"
    stroke-width="10"
    stroke-dasharray="${percent * 251.2} ${(1 - percent) * 251.2}"
    stroke-dashoffset="${-startPercent * 251.2}">
    </circle>
    `;
    })
    .join('');
}

// ---------- 互动 ----------

/** 生成笔记互动分析模块 */
export function generateReadingNotesInteractionAnalysis(bookNotes: BookNoteEntry[]): string {
  const interactionAnalysis = analyzeNotesInteractions(bookNotes);

  if (interactionAnalysis.totalBooks === 0) {
    return `<div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="text-align: center; color: #666;">暂无笔记互动数据</p>
    </div>`;
  }

  return `
  <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin: 20px 0;">

    <!-- 互动分布饼图 -->
  <div style="margin: 25px 0;">
  <div style="display: flex; flex-direction: column; align-items: center;">
  <div style="width: 200px; height: 200px; position: relative; margin-bottom: 20px;">
  <svg viewBox="0 0 100 100" style="transform: rotate(-90deg); width: 100%; height: 100%;">
  ${generateInteractionDistributionChart(interactionAnalysis.interactionDistribution)}
  </svg>
  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold;">${interactionAnalysis.totalInteractions}</div>
  <div style="font-size: 0.8em; color: #7f8c8d;">总互动</div>
  </div>
  </div>
  </div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
  <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${interactionAnalysis.avgHighlightsPerBook}</div>
  <div style="font-size: 0.9em; color: #666;">平均每本划线</div>
  </div>

  <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #4facfe;">${interactionAnalysis.thinkRatio}%</div>
  <div style="font-size: 0.9em; color: #666;">想法比例</div>
  </div>

  <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #43e97b;">${interactionAnalysis.interactionScore}/100</div>
  <div style="font-size: 0.9em; color: #666;">互动评分</div>
  </div>

   <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${interactionAnalysis.interactionPattern}</div>
  <div style="font-size: 0.9em; color: #666;">${interactionAnalysis.patternDescription}</div>
  </div>

   <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #9b59b6;">${interactionAnalysis.thinkingDepth}</div>
  <div style="font-size: 0.9em; color: #666;">${interactionAnalysis.thinkingDescription}</div>
  </div>

   <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #ff6b6b;">${interactionAnalysis.connectionLevel}</div>
  <div style="font-size: 0.9em; color: #666;">${interactionAnalysis.connectionDescription}</div>
  </div>
  </div>
  </div>
  `;
}

/** 生成互动分布饼图 */
export function generateInteractionDistributionChart(distribution: any[]): string {
  const colors = ['#667eea', '#4facfe', '#43e97b', '#ff6b6b'];

  let cumulativePercent = 0;
  return distribution
    .map((item, index) => {
      const percent = parseFloat(item.percentage) / 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      return `
    <circle cx="50" cy="50" r="40" fill="transparent"
    stroke="${colors[index % colors.length]}"
    stroke-width="10"
    stroke-dasharray="${percent * 251.2} ${(1 - percent) * 251.2}"
    stroke-dashoffset="${-startPercent * 251.2}">
    </circle>
    `;
    })
    .join('');
}

/** 生成互动趋势图表（简化版） */
export function generateInteractionTrendChart(interactionAnalysis: any): string {
  return `
  <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #667eea;">${interactionAnalysis.totalHighlights}</div>
  <div style="font-size: 0.8em; color: #666;">划线</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #4facfe;">${interactionAnalysis.totalThinks}</div>
  <div style="font-size: 0.8em; color: #666;">想法</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #43e97b;">${interactionAnalysis.totalDialogue}</div>
  <div style="font-size: 0.8em; color: #666;">讨论</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #ff6b6b;">${interactionAnalysis.totalOutlinks}</div>
  <div style="font-size: 0.8em; color: #666;">链接</div>
  </div>
  </div>
  
  <div style="margin-top: 15px; font-size: 0.9em; color: #666; text-align: center;">
  互动密度：每本书平均 ${interactionAnalysis.avgHighlightsPerBook} 条划线
  </div>
  </div>
  `;
}
