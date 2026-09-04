/**
 * 图表配色常量（core 共享层；影院内嵌分析页等统计视图共用的同一套视觉值）
 *
 * 浅色粉彩系（chart 专属装饰色，表达数据分类，非 §6 语义状态色）。
 * 取值源自原独立观影报告既有实现（ADR-0090 报告并入影院后为本文件唯一消费场景，值未改动）。
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
