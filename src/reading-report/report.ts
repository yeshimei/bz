/**
 * 阅读数据分析报告 report（ticket 13）：全部 HTML 生成函数，源码逐字移植。
 * 源码：阅读数据分析报告.js（重复函数只保留最终版）
 * 读书报告内嵌化增强：环形图升级水平条形行（时段/分类/互动，用户拍板「圆形统计被否」）、
 * 热力图段头 ‹ › 翻月（去 slice(0,1) 硬编码）、年卡点击展开该年 12 月柱（与趋势图共用月柱生成）、
 * 作者/分类行带 data-rr-* 筛选属性（同面板回书架列表预填，原深链作废）。
 */
import {
  formatReadingTime,
  formatSessionDuration,
  analyzeReadingHabits,
  analyzeReadingTrends,
  analyzeReadingFocus,
  processHeatmapData,
  getHeatmapMonthKeys,
  getYearMonthBars,
  analyzeReadingSpeed,
  analyzeReadingCategories,
  analyzeNotesInteractions,
  calculateIntensityLevel,
  getHeatmapColor,
} from './stats';
import type { ReadingStats, BookNoteEntry } from './stats';
import { escapeHtml, pad2 } from '../core/utils';
import { CHART_PASTEL_SERIES, CHART_INK, CHART_HIGHLIGHT } from '../core/chart-palette';

// ---------- 共享图元（条形行 / 月柱列） ----------

/** 条形行描述（generateBarRows 输入；环形图升级拍板后的统一行模型） */
export interface ReportBarRow {
  label: string;
  /** 条宽百分比 0-100 */
  value: number;
  /** 行尾数值文本（如 25% / 12本 · 33.3%） */
  display: string;
  /** 可点击筛选属性（同面板回书架列表）：data-rr-author / data-rr-cat */
  linkAttr?: { name: 'data-rr-author' | 'data-rr-cat'; value: string };
  /** 排名（1 基；前三名渲染 lucide 奖杯，3/2/1 枚） */
  rank?: number;
}

/** 水平条形行（时段/分类/互动三个环形图的替代范式；pastel 系列色按行循环取色） */
export function generateBarRows(rows: ReportBarRow[]): string {
  return rows
    .map((row, index) => {
      const color = CHART_PASTEL_SERIES[index % CHART_PASTEL_SERIES.length];
      const width = Math.max(0, Math.min(100, row.value));
      const attrs = row.linkAttr
        ? ` ${row.linkAttr.name}="${escapeHtml(row.linkAttr.value)}" title="在书架中查看"`
        : '';
      const cls = row.linkAttr ? 'bz-rr-bar-row bz-rr-bar-row--link' : 'bz-rr-bar-row';
      const trophies =
        row.rank !== undefined && row.rank >= 1 && row.rank <= 3
          ? '<i data-lucide="trophy" class="bz-ic bz-ic--xs bz-rr-trophy"></i>'.repeat(4 - row.rank)
          : '';
      return `
    <div class="${cls}"${attrs}>
    <div class="bz-rr-bar-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</div>
    <div class="bz-rr-bar-track"><div class="bz-rr-bar-fill" style="width:${width}%;background:${color}"></div></div>
    ${trophies}
    <div class="bz-rr-bar-val">${escapeHtml(row.display)}</div>
    </div>`;
    })
    .join('');
}

/** 月柱列描述（generateMonthBarColumns 输入） */
export interface ReportMonthCol {
  label: string;
  count: number;
  /** 强调列（如当前月） */
  accent?: boolean;
}

/**
 * 月柱列（共享月柱生成）：年度卡展开的 12 月柱与阅读趋势近 12 月柱同一生成器。
 * 高度按 count/max 归一（3px 零线 → 56px 满柱）；粉彩底 + 深墨字，两主题一致。
 */
export function generateMonthBarColumns(cols: ReportMonthCol[]): string {
  const max = Math.max(0, ...cols.map((c) => c.count));
  return `
  <div class="bz-rr-mwrap">
  ${cols
    .map((col) => {
      const height = max > 0 && col.count > 0 ? 12 + Math.round((col.count / max) * 44) : 3;
      const bg = col.accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[0];
      const num = col.count > 0 ? `<span style="color:${CHART_INK}">${col.count}</span>` : '';
      return `
    <div class="bz-rr-mcol">
    <div class="bz-rr-mbar${col.accent ? ' bz-rr-mbar--accent' : ''}" style="height:${height}px;background:${bg}">${num}</div>
    <div class="bz-rr-mlabel">${escapeHtml(col.label)}</div>
    </div>`;
    })
    .join('')}
  </div>`;
}

// ---------- 主报告 ----------

/**
 * 报告分段（懒生成，ticket 40）：index.ts 分片渲染用——逐段 invoke 并让出主线程，
 * 大库不再整串拼装数秒冻结；generateFullStatsReport 复用同一分段，输出口径一致。
 * 分段顺序与既有 generateFullStatsReport 完全一致（报告结构冻结）。
 */
export interface ReportSection {
  /** 段落稳定键（进度提示/调试用） */
  key: string;
  /** 段落进度文案（新增文案，无 emoji） */
  label: string;
  /** 段落生成函数：调用时才拼装该段 HTML */
  generate: () => string;
}

export function buildReportSections(stats: ReadingStats, bookNotes: BookNoteEntry[]): ReportSection[] {
  return [
    { key: 'stats', label: '统计概览', generate: () => generateStatsReport(stats) },
    { key: 'interaction', label: '笔记互动分析', generate: () => generateReadingNotesInteractionAnalysis(bookNotes) },
    { key: 'heatmap', label: '阅读热力图', generate: () => generateReadingHeatmap(stats.readingSessions) },
    { key: 'habits', label: '阅读习惯分析', generate: () => generateReadingHabitsDeepAnalysis2(stats.readingSessions) },
    { key: 'focus', label: '阅读专注度分析', generate: () => generateReadingFocusAnalysis(stats, bookNotes) },
    { key: 'yearly', label: '年度统计', generate: () => generateYearlyStats(stats) },
    { key: 'trends', label: '阅读趋势分析', generate: () => generateReadingTrendsAnalysis(stats, bookNotes) },
    { key: 'authors', label: '作者统计', generate: () => generateAuthorStats(stats) },
    { key: 'categories', label: '分类分析', generate: () => generateReadingCategoryAnalysis(bookNotes) },
    { key: 'speed', label: '阅读速度分析', generate: () => generateReadingSpeedAnalysis(stats) },
  ];
}

export function generateFullStatsReport(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  return buildReportSections(stats, bookNotes)
    .map((section) => section.generate())
    .join('\n');
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
  
  <div style="background: var(--background-secondary); padding: 20px; border-radius: 10px; margin: 20px 0;">
  <div style="font-size: 2.5em; font-weight: bold; color: var(--text-normal); text-align: center; margin: 20px 0;">
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

/** 生成年度统计报告（年卡点击展开该年 12 月柱；展开/收起由面板事件委托切 .open 类） */
export function generateYearlyStats(stats: ReadingStats): string {
  const yearlyData = Object.entries(stats.yearlyStats).sort((a, b) => b[0].localeCompare(a[0]));

  if (yearlyData.length === 0) {
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted); padding: 40px 0;">暂无年度阅读数据</p>
    </div>`;
  }

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
  ${yearlyData
    .map(([year, data]: [string, any]) => {
      // 年卡展开体：该年 12 月柱（与翻月/趋势共用月桶口径 getYearMonthBars + 月柱生成 generateMonthBarColumns）
      const monthCols = generateMonthBarColumns(
        getYearMonthBars(stats.monthlyStats, year).map((b) => ({ label: b.label, count: b.booksRead })),
      );
      return `
    <div class="bz-rr-year-cell">
    <div class="bz-rr-year-card" data-rr-year="${year}" title="点击展开 ${year} 年逐月阅读" role="button">
    <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">${year}年<i data-lucide="chevron-down" class="bz-ic bz-ic--sm bz-rr-year-chev"></i></div>
    <div style="font-size: 2em; font-weight: bold;">${data.booksRead}</div>
    <div>阅读数量</div>
    <div style="font-size: 0.8em; opacity: 0.8; margin-top: 3px;">
    ${formatReadingTime(data.totalReadingTime)}
    </div>
    </div>
    <div class="bz-rr-year-cols" data-rr-year-body="${year}">${monthCols}</div>
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
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无作者统计数据</p>
    </div>`;
  }

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
  ${topAuthors
    .map(([author, data]: [string, any], index) => {
      const completionRate = data.totalBooks > 0 ? ((data.completedBooks / data.totalBooks) * 100).toFixed(1) : 0;
      const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#3498db', '#9b59b6'];

      return `
    <div class="bz-rr-author-card" data-rr-author="${escapeHtml(author)}" title="在书架中搜索该作者" role="button"
    style="background: linear-gradient(135deg, ${rankColors[index] || '#95a5a6'}, ${rankColors[index] ? rankColors[index] + 'cc' : '#7f8c8d'});
    padding: 15px; border-radius: 8px; color: white; position: relative;">
    <div style="font-size: 2em; position: absolute; top: 10px; right: 15px; opacity: 0.3;">${index + 1}</div>
    <div style="font-weight: bold; font-size: 1.1em;">${escapeHtml(author)}</div>
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
  <div style="background: var(--background-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--background-modifier-border); margin: 16px 0; ">

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


  <div style="background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div style="font-size: 15px; font-weight: 500; color: var(--text-normal);">速度等级</div>
  <div style="font-size: 14px; color: var(--text-muted);">${speedAnalysis.speedLevel}</div>
  </div>


  <div style="width: 100%; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
  <div style="width: ${speedAnalysis.speedPercentage}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); border-radius: 4px;"></div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
  <span>较慢</span>
  <span>适中</span>
  <span>快速</span>
  </div>
  </div>


  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">效率评分</div>
  <div style="font-size: 18px; font-weight: 600; color: #ff6b6b;">${speedAnalysis.efficiencyScore}/10</div>
  </div>


  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">阅读类型</div>
  <div style="font-size: 14px; font-weight: 500; color: #667eea;">${speedAnalysis.readingType}</div>
  </div>

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">最佳速度</div>
  <div style="font-size: 18px; font-weight: 600; color: #64d6f3;">${speedAnalysis.bestSpeed}页/小时</div>
  </div>

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">平均时长</div>
  <div style="font-size: 18px; font-weight: 600; color: #ff6b6b;">${speedAnalysis.avgSessionTime}</div>
  </div>
  </div>
  </div>
  `;
}

// ---------- 习惯深度 ----------

/** 时段中文标签（时段条形行用；与专注度分析时段口径一致） */
const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早晨 (6-12点)',
  afternoon: '下午 (12-18点)',
  evening: '晚上 (18-24点)',
  night: '深夜 (0-6点)',
};

/** 生成阅读习惯深度分析模块（环形图升级拍板：时段分布 → 水平条形行） */
export function generateReadingHabitsDeepAnalysis2(readingSessions: any[]): string {
  if (!readingSessions || readingSessions.length < 5) {
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">需要更多会话数据进行分析</p>
    </div>`;
  }

  const analysis = analyzeReadingHabits(readingSessions);
  const slotRows: ReportBarRow[] = Object.entries(analysis.timeDistribution).map(([slot, percentage]) => ({
    label: TIME_SLOT_LABELS[slot] || slot,
    value: parseFloat(String(percentage)),
    display: `${percentage}%`,
  }));

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
  <div class="bz-rr-bar-head"><span>会话时段分布</span><span>共 ${readingSessions.length} 次会话</span></div>
  <div style="margin: 12px 0;">
  ${generateBarRows(slotRows)}
  </div>
  </div>
  `;
}

// ---------- 趋势 ----------

/** 生成阅读趋势分析模块（移动端优化版） */
export function generateReadingTrendsAnalysis(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  const trends = analyzeReadingTrends(stats, bookNotes);

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <!-- 核心指标概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #667eea;">${trends.currentMonth.books}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">本月阅读</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #4facfe;">${trends.quarterlyAvg}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">季度平均</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #43e97b;">${trends.completionRate}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">完成率</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: #ff6b6b;">${trends.trendDirection}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">趋势方向</div>
  </div>
  </div>

  <!-- 移动端优化的月度趋势 -->
  <div style="margin: 25px 0;">
  <div style="font-weight: bold; color: var(--text-normal); margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">

  </div>
  ${generateMobileFriendlyTrendChart(trends.recentMonths)}
  </div>
  </div>
  `;
}

/** 移动端优化的趋势图表（月柱与年度卡展开共用 generateMonthBarColumns 生成） */
export function generateMobileFriendlyTrendChart(recentMonths: any[]): string {
  if (recentMonths.length === 0) {
    return '<p style="text-align: center; color: var(--text-muted); padding: 20px 0;">暂无月度数据</p>';
  }

  return generateMonthBarColumns(
    recentMonths.map((data, index) => ({
      label: data.month.split('-')[1] + '月',
      count: data.booksRead,
      accent: index === 0, // 首位 = 最近月份（图表高亮语义保留）
    })),
  );
}

// ---------- 热力图 ----------

const HEATMAP_MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 月键 → 中文标题（2025-06 → 2025年六月；翻月段头与单月网格共用） */
export function heatmapMonthTitle(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const name = HEATMAP_MONTH_NAMES[parseInt(month, 10) - 1] || month;
  return `${year}年${name}`;
}

/** 生成阅读会话热力图模块（移动端优化版；段头 ‹ › 翻月——去原 slice(0,1) 硬编码） */
export function generateReadingHeatmap(readingSessions: any[], cursorMonth?: string): string {
  if (!readingSessions || readingSessions.length === 0) {
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无阅读会话数据，无法生成热力图</p>
    </div>`;
  }

  const heatmapData = processHeatmapData(readingSessions);
  const monthKeys = getHeatmapMonthKeys(heatmapData);
  // 翻月游标：缺省落在最近有阅读的月份（原 slice(0,1) 语义，现在可 ‹ › 在全部月份间移动）
  const cursor = cursorMonth && monthKeys.includes(cursorMonth) ? cursorMonth : monthKeys[monthKeys.length - 1];
  const idx = monthKeys.indexOf(cursor);
  const navBtn = (dir: 'prev' | 'next', disabled: boolean) =>
    `<button class="bz-rr-hm-nav" data-rr-hm-${dir}${disabled ? ' disabled' : ''} title="${dir === 'prev' ? '上一月' : '下一月'}" aria-label="${dir === 'prev' ? '上一月' : '下一月'}"><i data-lucide="chevron-${dir === 'prev' ? 'left' : 'right'}" class="bz-ic bz-ic--sm"></i></button>`;

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <!-- 热力图统计概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 12px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${heatmapData.totalDays}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">有阅读天数</div>
  </div>

  <div style="text-align: center; padding: 12px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: #ff6b6b;">${heatmapData.longestStreak}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">最长连续天数</div>
  </div>
  </div>

  <!-- 热力图主体（段头翻月：processHeatmapData 已算全部月度数据，‹ › 逐月切换） -->
  <div style="margin: 25px 0;">
  <div class="bz-rr-hm-head">
  ${navBtn('prev', idx <= 0)}
  <div class="bz-rr-hm-title" data-rr-hm-title>${heatmapMonthTitle(cursor)}</div>
  ${navBtn('next', idx >= monthKeys.length - 1)}
  </div>
  <div class="bz-rr-hm-body" data-rr-hm-body>
  ${generateHeatmapGrid(heatmapData, cursor)}
  </div>
  </div>


  </div>
  `;
}

/** 生成热力图网格（只渲染游标月份；翻月由段头 ‹ › 切换——原 slice(0,1) 硬编码已去） */
export function generateHeatmapGrid(heatmapData: any, cursorMonth?: string): string {
  const months = getHeatmapMonthKeys(heatmapData);

  if (months.length === 0) {
    return '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">暂无数据</p>';
  }

  const cursor = cursorMonth && months.includes(cursorMonth) ? cursorMonth : months[months.length - 1];
  return generateMonthHeatmap(heatmapData.monthlyData[cursor], cursor);
}

/** 生成单月热力图 */
export function generateMonthHeatmap(monthData: any, monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthName = HEATMAP_MONTH_NAMES[parseInt(month, 10) - 1] || month;

  const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
  const lastDay = new Date(parseInt(year), parseInt(month), 0);
  const daysInMonth = lastDay.getDate();

  let firstWeekday = firstDay.getDay();
  firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const weekRows: any[][] = [];
  let currentWeek: any[] = [];

  // 只有今天之后的日期才算「未来」；历史月份的空白格不是未来日期
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  for (let i = 0; i < firstWeekday; i++) {
    currentWeek.push({ type: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
    const dayData = monthData.dailyData[dateKey];
    const isFuture = new Date(parseInt(year), parseInt(month) - 1, day) > todayEnd;

    currentWeek.push({
      type: dayData ? 'data' : isFuture ? 'future' : 'nodata',
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
  <div style="font-weight: bold; color: var(--text-normal); font-size: 1.1em;">
  ${year}年${monthName}
  </div>

  </div>

  <!-- 星期标签 -->
  <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 8px; ">
  ${['一', '二', '三', '四', '五', '六', '日']
    .map(
      (day) => `
    <div style="text-align: center; font-size: 0.75em; color: var(--text-faint); padding: 2px;">${day}</div>
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

/** 生成热力图单元格（audit H：尺寸/圆角/hover/@media 移入域样式 .bz-rr-hm-cell——
 *  内联 style 无法承载 @media 与 &:hover，原写法在移动端与 hover 态全部失效；
 *  颜色为数据驱动值仍按等级内联） */
export function generateHeatmapCell(cell: any): string {
  if (cell.type === 'empty') {
    return '<div class="bz-rr-hm-cell"></div>';
  }

  if (cell.type === 'future') {
    return `<div class="bz-rr-hm-cell" style="background: var(--background-secondary);"
    title="${cell.date} - 未来日期"></div>`;
  }

  if (cell.type === 'nodata') {
    // 历史月份无阅读记录的空白格（非未来日期）
    return `<div class="bz-rr-hm-cell" style="background: var(--background-secondary);"
    title="${cell.date} - 无阅读记录"></div>`;
  }

  const durationHours = cell.data.duration / 3600;
  // 强度分级/配色复用 stats 纯函数（>=4h→4, >=2h→3, >=1h→2, >=0.5h→1, 其余 0）
  const color = getHeatmapColor(calculateIntensityLevel(durationHours));
  const tooltip = `${cell.date}\n阅读时长: ${(cell.data.duration / 3600).toFixed(1)}小时\n会话次数: ${cell.data.sessions}次`;

  return `
  <div class="bz-rr-hm-cell bz-rr-hm-cell--data" style="background: ${color};"
  title="${tooltip}">
  </div>
  `;
}

// ---------- 专注度 ----------

/** 生成阅读专注度分析模块 */
export function generateReadingFocusAnalysis(stats: ReadingStats, bookNotes: BookNoteEntry[]): string {
  const focusData = analyzeReadingFocus(stats.readingSessions, bookNotes);

  return `
 <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    
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
        
        
        <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #27ae60;">${focusData.consistencyScore}/10</div>
                <div style="font-size: 0.85em; color: var(--text-normal);">连续性评分</div>
            </div>
            
            <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #e67e22;">${focusData.efficiencyScore}/10</div>
                <div style="font-size: 0.85em; color: var(--text-normal);">效率评分</div>
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
                <div style="display: flex; align-items: center; background: var(--background-secondary); padding: 10px; border-radius: 8px;">
                    <div style="width: 60px; font-size: 0.85em; color: var(--text-normal); font-weight: bold;">${labels[index]}</div>
                    <div style="flex: 1; margin: 0 15px;">
                        <div style="width: 100%; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${item.percentage}%; height: 100%; background: ${colors[index]}; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="width: 50px; text-align: right; font-size: 0.9em; color: var(--text-muted);">${item.count}次 (${item.percentage}%)</div>
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
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无书籍分类数据</p>
    </div>`;
  }

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.totalCategories}</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">阅读分类</div>
  </div>

  <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.5em; font-weight: bold; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(categoryAnalysis.topCategory.name)}</div>
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
  <div class="bz-rr-bar-head">
  <span>分类分布 · 共 ${categoryAnalysis.totalBooks} 本 / ${categoryAnalysis.totalCategories} 类</span>
  <span>点分类行回书架查看</span>
  </div>
  <div style="margin: 12px 0;">
  ${generateBarRows(
    categoryAnalysis.categoryDistribution.map((category: any, index: number): ReportBarRow => ({
      label: category.name,
      value: parseFloat(category.percentage),
      display: `${category.count}本 · ${category.percentage}%`,
      linkAttr: { name: 'data-rr-cat', value: String(category.name) },
      rank: index + 1,
    })),
  )}
  </div>
  </div>
  </div>
  </div>
  `;
}

// ---------- 互动 ----------

/** 互动类型中文标签（互动分布条形行用） */
const INTERACTION_TYPE_LABELS: Record<string, string> = {
  highlights: '划线',
  thinks: '想法',
  dialogue: '讨论',
  outlinks: '出链',
};

/** 生成笔记互动分析模块 */
export function generateReadingNotesInteractionAnalysis(bookNotes: BookNoteEntry[]): string {
  const interactionAnalysis = analyzeNotesInteractions(bookNotes);

  if (interactionAnalysis.totalBooks === 0) {
    return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无笔记互动数据</p>
    </div>`;
  }

  return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div class="bz-rr-bar-head"><span>互动分布</span><span>总互动 ${interactionAnalysis.totalInteractions}</span></div>
  <div style="margin: 12px 0;">
  ${generateBarRows(
    interactionAnalysis.interactionDistribution.map((item: any): ReportBarRow => ({
      label: INTERACTION_TYPE_LABELS[item.type] || item.type,
      value: parseFloat(item.percentage),
      display: `${item.count}条 · ${item.percentage}%`,
    })),
  )}
  </div>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${interactionAnalysis.avgHighlightsPerBook}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">平均每本划线</div>
  </div>

  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #4facfe;">${interactionAnalysis.thinkRatio}%</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">想法比例</div>
  </div>

  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #43e97b;">${interactionAnalysis.interactionScore}/100</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">互动评分</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${interactionAnalysis.interactionPattern}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.patternDescription}</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #9b59b6;">${interactionAnalysis.thinkingDepth}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.thinkingDescription}</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: #ff6b6b;">${interactionAnalysis.connectionLevel}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.connectionDescription}</div>
  </div>
  </div>
  </div>
  `;
}

/** 生成互动趋势图表（简化版） */
export function generateInteractionTrendChart(interactionAnalysis: any): string {
  return `
  <div style="background: var(--background-secondary); padding: 15px; border-radius: 8px;">
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #667eea;">${interactionAnalysis.totalHighlights}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">划线</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #4facfe;">${interactionAnalysis.totalThinks}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">想法</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #43e97b;">${interactionAnalysis.totalDialogue}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">讨论</div>
  </div>
  <div>
  <div style="font-size: 1.2em; font-weight: bold; color: #ff6b6b;">${interactionAnalysis.totalOutlinks}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">链接</div>
  </div>
  </div>
  
  <div style="margin-top: 15px; font-size: 0.9em; color: var(--text-muted); text-align: center;">
  互动密度：每本书平均 ${interactionAnalysis.avgHighlightsPerBook} 条划线
  </div>
  </div>
  `;
}
