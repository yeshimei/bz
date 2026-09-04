/**
 * 图表配色常量（core 共享层；统计视图共用的同一套视觉值）
 *
 * 浅色粉彩系（chart 专属装饰色，表达数据分类，非 §6 语义状态色）。
 * 取值源自原独立观影报告既有实现（ADR-0090 报告并入影院；后书架墙阅读分析报告
 * 内嵌化复用同一套，值未改动）——消费场景：影院内嵌分析页与 reading-report 报告两处。
 * 两主题同值：粉彩底 + 深墨字（CHART_INK）自成对比，不随明暗翻转。
 */

/** 类型 → 图表色（环形图扇区/图例；键 = 影院类型组名） */
export const CHART_TYPE_COLORS: Record<string, string> = {
  电影: '#FFE5CC',
  剧集: '#D6E4FF',
  动漫: '#FADDE1',
  纪录片: '#D8F3DC',
  公开课: '#E6DFF5',
};

/** 柱状/统计卡粉彩系列（按序循环取色） */
export const CHART_PASTEL_SERIES: string[] = ['#D6E4FF', '#D8F3DC', '#CDF0EA', '#FADDE1', '#FFE5CC', '#E6DFF5'];

/** 排行榜前三徽章底色（金/绿/蓝浅底） */
export const CHART_RANK_BADGES: string[] = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];

/** 柱内/卡内数字墨色（粉彩底上的深字，两主题一致） */
export const CHART_INK = '#3D4456';

/** 类型不在色板时的兜底色 */
export const CHART_FALLBACK = '#95a5a6';

/** 柱状图高亮柱（当月等）填充色 */
export const CHART_HIGHLIGHT = '#FFE5CC';

// ---------- 阅读报告（reading-report/report.ts）图表语义色 ----------
// 与上方粉彩系同原则：数据分类装饰色，两主题同值（值 = 内嵌化移植原实现，未改动）。

/** 指标横幅/卡片渐变底（135deg）：紫蓝/粉红/蓝青/绿青/珊瑚红五档 */
export const CHART_GRADIENT_VIOLET = 'linear-gradient(135deg, #667eea, #764ba2)';
export const CHART_GRADIENT_PINK = 'linear-gradient(135deg, #f093fb, #f5576c)';
export const CHART_GRADIENT_AQUA = 'linear-gradient(135deg, #4facfe, #00f2fe)';
export const CHART_GRADIENT_MINT = 'linear-gradient(135deg, #43e97b, #38f9d7)';
export const CHART_GRADIENT_CORAL = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';

/** 指标数字强调色（数据分类色；前四色与横幅渐变端色同源） */
export const CHART_METRIC_VIOLET = '#667eea';
export const CHART_METRIC_AQUA = '#4facfe';
export const CHART_METRIC_MINT = '#43e97b';
export const CHART_METRIC_CORAL = '#ff6b6b';
export const CHART_METRIC_RED = '#e74c3c';
export const CHART_METRIC_BLUE = '#3498db';
export const CHART_METRIC_PURPLE = '#9b59b6';
export const CHART_METRIC_GREEN = '#27ae60';
export const CHART_METRIC_ORANGE = '#e67e22';
export const CHART_METRIC_SKY = '#64d6f3';

/** 作者榜排名卡渐变底（按名次取色：金/银/铜/蓝/紫；越界用 CHART_FALLBACK + 深化端） */
export const CHART_AUTHOR_RANK_COLORS: string[] = ['#ffd700', '#c0c0c0', '#cd7f32', '#3498db', '#9b59b6'];

/** 排名卡渐变兜底深化端（无名次时与 CHART_FALLBACK 配对的渐变终点） */
export const CHART_RANK_FALLBACK_DEEP = '#7f8c8d';

/** 速度等级进度条渐变（90deg 绿） */
export const CHART_SPEED_BAR_GRADIENT = 'linear-gradient(90deg, #4CAF50, #45a049)';

/** 专注度会话分布条形色（碎片化→高度专注按序取色） */
export const CHART_FOCUS_SERIES: string[] = ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb', '#1dd1a1'];
