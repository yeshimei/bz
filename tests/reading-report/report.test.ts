// @vitest-environment node
/**
 * 阅读数据分析报告 report 测试：报告生成纯函数，覆盖空数据分支与有数据分支。
 * 读书报告内嵌化图表升级：环形图 → 水平条形行（时段/分类/互动）、热力图段头 ‹ › 翻月、
 * 年卡展开 12 月柱（与趋势月柱共用 generateMonthBarColumns）、作者/分类行带 data-rr-* 筛选属性。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateFullStatsReport, buildReportSections, generateStatsReport, generateYearlyStats, generateAuthorStats,
  generateReadingSpeedAnalysis, generateReadingHabitsDeepAnalysis2,
  generateReadingTrendsAnalysis, generateMobileFriendlyTrendChart, generateReadingHeatmap,
  generateHeatmapGrid, generateMonthHeatmap, generateHeatmapCell, generateReadingFocusAnalysis,
  generateReadingCategoryAnalysis, generateReadingNotesInteractionAnalysis,
  generateInteractionTrendChart, generateBarRows, generateMonthBarColumns, heatmapMonthTitle,
} from '../../src/reading-report/report';
import { calculateReadingStats, processHeatmapData } from '../../src/reading-report/stats';
import {
  CHART_GRADIENT_VIOLET,
  CHART_GRADIENT_PINK,
  CHART_GRADIENT_AQUA,
  CHART_GRADIENT_MINT,
  CHART_GRADIENT_CORAL,
  CHART_SPEED_BAR_GRADIENT,
  CHART_AUTHOR_RANK_COLORS,
  CHART_FOCUS_SERIES,
  CHART_METRIC_RED,
  CHART_METRIC_PURPLE,
  CHART_METRIC_VIOLET,
  CHART_METRIC_SKY,
  CHART_METRIC_ORANGE,
} from '../../src/core/chart-palette';

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

  it('generateYearlyStats：空态 + 有数据（年卡可点 + 该年 12 月柱展开体预生成）', () => {
    expect(generateYearlyStats(emptyStats)).toContain('暂无年度阅读数据');
    const html = generateYearlyStats(stats);
    expect(html).toContain('2025年');
    expect(html).toContain('阅读数量');
    // 年卡点击展开（data-rr-year）+ 展开体（data-rr-year-body）内固定 12 月柱
    expect(html).toContain('data-rr-year="2025"');
    expect(html).toContain('data-rr-year-body="2025"');
    const body = html.split('data-rr-year-body="2025"')[1] || '';
    expect((body.match(/bz-rr-mcol/g) || []).length).toBe(12);
    expect(body).toContain('7月');
  });

  it('generateAuthorStats：空态 + 有数据（排名前 5 作者；卡片带 data-rr-author 同面板筛选属性）', () => {
    expect(generateAuthorStats(emptyStats)).toContain('暂无作者统计数据');
    const html = generateAuthorStats(stats);
    expect(html).toContain('余华');
    expect(html).toContain('作品数');
    expect(html).toContain('完成');
    expect(html).toContain('data-rr-author="余华"');
    expect(html).toContain('data-rr-author="刘慈欣"');
  });

  it('generateReadingSpeedAnalysis：空态返回空串 + 有数据（速度等级）', () => {
    expect(generateReadingSpeedAnalysis(emptyStats)).toBe('');
    const html = generateReadingSpeedAnalysis(stats);
    expect(html).toContain('阅读速度');
    expect(html).toContain('页/小时');
    expect(html).toContain('字速');
    expect(html).toContain('效率评分');
  });

  it('generateBarRows：水平条形行（图表升级拍板：环形图替代范式）+ 可点筛选属性 + 前三奖杯', () => {
    const html = generateBarRows([
      { label: '小说', value: 50, display: '2本 · 50%', linkAttr: { name: 'data-rr-cat', value: '小说' }, rank: 1 },
      { label: '科幻', value: 25, display: '1本 · 25%' },
    ]);
    expect((html.match(/bz-rr-bar-row/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('data-rr-cat="小说"');
    expect(html).toContain('data-lucide="trophy"'); // rank 1 → 3 枚
    expect(html).toContain('width:50%');
    // XSS：标签/筛选值过 escapeHtml
    const evil = generateBarRows([{ label: '<img src=x>', value: 10, display: '1', linkAttr: { name: 'data-rr-cat', value: '<svg>' } }]);
    expect(evil).not.toContain('<img src=x>');
    expect(evil).not.toContain('data-rr-cat="<svg>"');
  });

  it('generateMonthBarColumns：固定列数、零月空柱、强调列（年卡展开与趋势月柱共用）', () => {
    const html = generateMonthBarColumns([
      { label: '1月', count: 0 },
      { label: '2月', count: 3 },
      { label: '3月', count: 1, accent: true },
    ]);
    expect((html.match(/bz-rr-mcol/g) || []).length).toBe(3);
    expect(html).toContain('2月');
    expect(html).toContain('bz-rr-mbar--accent');
    // 零月柱体无数值文本（与书架近 12 月柱同语义）
    expect(html).not.toContain('<span style="color:#3D4456">0</span>');
  });

  it('generateReadingHabitsDeepAnalysis2：会话不足 5 条空态 + 数据态（时段条形行）', () => {
    expect(generateReadingHabitsDeepAnalysis2([{ start: '2025-01-01T08:00:00', duration: 300 }])).toContain('需要更多会话数据进行分析');
    const html = generateReadingHabitsDeepAnalysis2(sessions);
    expect(html).toContain('会话时段分布');
    expect(html).toContain('早晨 (6-12点)');
    expect(html).toContain('深夜 (0-6点)');
    expect(html).toContain('bz-rr-bar-row');
  });

  it('generateReadingTrendsAnalysis + generateMobileFriendlyTrendChart（月柱共用生成）', () => {
    const html = generateReadingTrendsAnalysis(stats, books);
    expect(html).toContain('本月阅读');
    expect(html).toContain('季度平均');
    expect(html).toContain('完成率');
    expect(generateMobileFriendlyTrendChart([])).toContain('暂无月度数据');
    const chart = generateMobileFriendlyTrendChart([{ month: '2025-07', booksRead: 3 }, { month: '2025-06', booksRead: 1 }]);
    expect(chart).toContain('7月');
    expect(chart).toContain('6月');
    expect(chart).toContain('bz-rr-mcol'); // 与年卡展开同一月柱生成器
  });

  it('heatmapMonthTitle：月键 → 中文标题（翻月段头与单月网格共用）', () => {
    expect(heatmapMonthTitle('2025-06')).toBe('2025年六月');
    expect(heatmapMonthTitle('2024-01')).toBe('2024年一月');
    expect(heatmapMonthTitle('2025-12')).toBe('2025年十二月');
  });

  it('generateReadingHeatmap：空态 + 数据态（翻月段头 ‹ › + 游标月份网格）', () => {
    expect(generateReadingHeatmap([])).toContain('暂无阅读会话数据');
    const html = generateReadingHeatmap(sessions);
    expect(html).toContain('有阅读天数');
    expect(html).toContain('最长连续天数');
    // 段头翻月：‹ › 按钮 + 月份标题 + 主体容器（缺省游标 = 最近有阅读的月份）
    expect(html).toContain('data-rr-hm-prev');
    expect(html).toContain('data-rr-hm-next');
    expect(html).toContain('data-rr-hm-title');
    expect(html).toContain('data-rr-hm-body');
    expect(html).toContain('2025年一月');
    // 去掉 slice(0,1) 硬编码：指定游标渲染对应月份
    expect(generateReadingHeatmap(sessions, '2025-01')).toContain('2025年一月');
  });

  it('generateHeatmapGrid：空 monthlyData + 指定游标月份', () => {
    expect(generateHeatmapGrid({ monthlyData: {} })).toContain('暂无数据');
    const hm = processHeatmapData(sessions);
    const html = generateHeatmapGrid(hm, '2025-01');
    expect(html).toContain('2025年一月');
    // 无效游标回落最近月
    expect(generateHeatmapGrid(hm, '1999-01')).toContain('2025年一月');
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
    // audit H：尺寸/圆角/hover/@media 移入域样式 .bz-rr-hm-cell（内联 @media/&:hover 本就无效）
    expect(generateHeatmapCell({ type: 'empty' })).toContain('bz-rr-hm-cell');
    expect(generateHeatmapCell({ type: 'future', date: '2025-06-30' })).toContain('未来日期');
    const cell1 = generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 1800, sessions: 1 } });
    expect(cell1).toContain('#9be9a8');
    expect(cell1).toContain('bz-rr-hm-cell--data');
    const cell4 = generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 18000, sessions: 3 } });
    expect(cell4).toContain('#216e39');
    expect(cell4).toContain('阅读时长: 5.0小时');
  });

  it('audit H：单元格不再输出无效的内联 @media / &:hover（迁入域样式类）', () => {
    for (const cell of [
      generateHeatmapCell({ type: 'empty' }),
      generateHeatmapCell({ type: 'future', date: '2025-06-30' }),
      generateHeatmapCell({ type: 'nodata', date: '2000-01-15' }),
      generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 1800, sessions: 1 } }),
    ]) {
      expect(cell).not.toContain('@media');
      expect(cell).not.toContain('&:hover');
      expect(cell).not.toContain('mobileSize');
    }
    // 域样式文件承载尺寸/媒体查询/hover（构建聚合进根 styles.css）
    const css = readFileSync(resolve(process.cwd(), 'src/reading-report/styles.css'), 'utf8');
    expect(css).toContain('.bz-rr-hm-cell');
    expect(css).toContain('@media');
    expect(css).toContain('.bz-rr-hm-cell--data:hover');
    // 图表升级新增类亦在域样式内（条形行/月柱/翻月段头/年卡展开体）
    expect(css).toContain('.bz-rr-bar-row');
    expect(css).toContain('.bz-rr-mcol');
    expect(css).toContain('.bz-rr-hm-nav');
    expect(css).toContain('.bz-rr-year-cols.open');
  });

  it('generateMonthHeatmap：历史月份空白格不再是未来日期（P2）', () => {
    // 远古月份：全部空白格应为「无阅读记录」而非「未来日期」
    const past = generateMonthHeatmap({ dailyData: {} }, '2000-01');
    expect(past).not.toContain('未来日期');
    expect(past).toContain('无阅读记录');
    // 未来月份仍标未来
    const upcoming = generateMonthHeatmap({ dailyData: {} }, '2999-12');
    expect(upcoming).toContain('未来日期');
    expect(upcoming).not.toContain('无阅读记录');
  });

  it('generateHeatmapCell：nodata 历史空白格 tooltip 非未来文案（P2）', () => {
    const cell = generateHeatmapCell({ type: 'nodata', date: '2000-01-15' });
    expect(cell).not.toContain('未来日期');
    expect(cell).toContain('无阅读记录');
    expect(cell).toContain('var(--background-secondary)'); // 与 future 同为主题中性底（p1）
  });

  it('generateReadingFocusAnalysis：专注度指标卡', () => {
    const html = generateReadingFocusAnalysis(stats, books);
    expect(html).toContain('深度会话');
    expect(html).toContain('专注趋势');
    expect(html).toContain('专注度评分');
    expect(html).toContain('连续性评分');
    expect(html).toContain('效率评分');
  });

  it('generateReadingCategoryAnalysis：空态 + 数据态（分类条形行 + data-rr-cat 同面板筛选 + lucide 奖杯）', () => {
    expect(generateReadingCategoryAnalysis([])).toContain('暂无书籍分类数据');
    const html = generateReadingCategoryAnalysis(books);
    expect(html).toContain('阅读分类');
    expect(html).toContain('多样性');
    expect(html).toContain('平衡度');
    // 环形图升级拍板：分类分布 → 水平条形行（可点回书架按分类筛）
    expect(html).toContain('分类分布');
    expect(html).toContain('data-rr-cat="小说"');
    expect(html).toContain('data-rr-cat="科幻"');
    expect(html).toContain('data-lucide="trophy"');
  });

  it('generateReadingNotesInteractionAnalysis：空态 + 数据态（互动分布条形行）', () => {
    expect(generateReadingNotesInteractionAnalysis([])).toContain('暂无笔记互动数据');
    const html = generateReadingNotesInteractionAnalysis(books);
    expect(html).toContain('平均每本划线');
    expect(html).toContain('想法比例');
    expect(html).toContain('互动评分');
    expect(html).toContain('总互动');
    // 环形图升级拍板：互动分布 → 水平条形行
    expect(html).toContain('互动分布');
    expect(html).toContain('bz-rr-bar-row');
  });

  it('generateInteractionTrendChart', () => {
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

  it('buildReportSections：分段懒生成、顺序与 generateFullStatsReport 口径一致（ticket 40）', () => {
    const sections = buildReportSections(stats, books);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections[0].key).toBe('stats');
    expect(sections.map((s) => s.key)).toContain('categories');
    // 懒生成：未调用 generate 前不产出 HTML（分片渲染前置条件）
    expect(sections[0].generate()).toContain('书库');
    // 逐段 join 与整串生成输出一致（分片渲染不改变报告内容）
    const joined = sections.map((s) => s.generate()).join('\n');
    expect(generateFullStatsReport(stats, books)).toBe(joined);
  });

  it('s1 XSS：authorStats 作者字段过 escapeHtml（含 data-rr-author 属性值）', () => {
    const evil = book({ author: '<img src=x onerror=alert(1)>', completionDate: '2025-07-01', readingProgress: 100 });
    const s = calculateReadingStats([evil]);
    const html = generateAuthorStats(s);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('data-rr-author="&lt;img src=x onerror=alert(1)&gt;"');
  });

  it('s1 XSS：分类名（topCategory + 分布行 + data-rr-cat）过 escapeHtml', () => {
    const evil = book({ category: '<svg onload=alert(1)>', completionDate: '2025-07-01', readingProgress: 100 });
    const html = generateReadingCategoryAnalysis([evil]);
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('<svg onload=alert(1)>');
  });

  it('lucide 化：报告生成函数输出无 emoji 图标（🧮/❌/🏆 已换 lucide 占位）', () => {
    const html = generateFullStatsReport(stats, books) + generateReadingCategoryAnalysis(books) + generateReadingHeatmap(sessions);
    expect(html).not.toContain('🏆');
    expect(html).not.toContain('🧮');
    expect(html).not.toContain('❌');
    expect(html).toContain('data-lucide="trophy"');
    expect(html).toContain('data-lucide="chevron-left"');
  });

  it('p1 主题适配：整页用主题变量，无硬编码浅色板', () => {
    const html = generateFullStatsReport(stats, books) + generateReadingCategoryAnalysis(books) + generateReadingHeatmap(sessions) + generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 600, sessions: 1 } });
    expect(html).toContain('var(--background-primary)');
    expect(html).toContain('var(--background-secondary)');
    expect(html).toContain('var(--text-normal)');
    expect(html).toContain('var(--text-muted)');
    expect(html).not.toContain('background: white');
    expect(html).not.toContain('#2c3e50');
    expect(html).not.toContain('color: #666');
    expect(html).not.toContain('#f8f9fa');
    // 热力图等级 0（无阅读）用主题中性色（p1）
    expect(generateHeatmapCell({ type: 'data', date: '2025-06-01', data: { duration: 600, sessions: 1 } })).toContain('var(--background-secondary)');
    expect(generateHeatmapCell({ type: 'nodata', date: '2000-01-15' })).toContain('var(--background-secondary)');
  });
});

describe('图表色收编 core/chart-palette（终局 review 批 B-2）', () => {
  const books = makeBooks();
  const stats = calculateReadingStats(books);
  stats.readingSessions = makeSessions();

  it('report.ts 不再持有内联 hex——图表色全部经 chart-palette 语义常量', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/reading-report/report.ts'), 'utf8');
    const hexes = [...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((h) => h[0]);
    expect(hexes, `残留内联 hex: ${hexes.join(', ')}`).toEqual([]);
  });

  it('生成 HTML 引用色板常量（值与收编前逐一一致）', () => {
    // 渐变横幅（概览卡/速度分析/专注度/分类分析）
    expect(generateStatsReport(stats)).toContain(CHART_GRADIENT_VIOLET);
    expect(generateStatsReport(stats)).toContain(CHART_GRADIENT_PINK);
    expect(generateReadingSpeedAnalysis(stats)).toContain(CHART_GRADIENT_AQUA);
    expect(generateReadingSpeedAnalysis(stats)).toContain(CHART_GRADIENT_MINT);
    expect(generateReadingSpeedAnalysis(stats)).toContain(CHART_GRADIENT_CORAL);
    expect(generateReadingFocusAnalysis(stats, books)).toContain(CHART_GRADIENT_AQUA);
    expect(generateReadingCategoryAnalysis(books)).toContain(CHART_GRADIENT_VIOLET);
    // 指标数字强调色
    expect(generateStatsReport(stats)).toContain(`color: ${CHART_METRIC_RED}`);
    expect(generateStatsReport(stats)).toContain(`color: ${CHART_METRIC_PURPLE}`);
    expect(generateReadingTrendsAnalysis(stats, books)).toContain(`color: ${CHART_METRIC_VIOLET}`);
    expect(generateReadingSpeedAnalysis(stats)).toContain(`color: ${CHART_METRIC_SKY}`);
    expect(generateReadingFocusAnalysis(stats, books)).toContain(`color: ${CHART_METRIC_ORANGE}`);
    // 速度条 / 排名卡 / 专注分布系列
    expect(generateReadingSpeedAnalysis(stats)).toContain(`background: ${CHART_SPEED_BAR_GRADIENT}`);
    expect(generateAuthorStats(stats)).toContain(`linear-gradient(135deg, ${CHART_AUTHOR_RANK_COLORS[0]}`);
    expect(generateReadingFocusAnalysis(stats, books)).toContain(`background: ${CHART_FOCUS_SERIES[0]}`);
  });
});
