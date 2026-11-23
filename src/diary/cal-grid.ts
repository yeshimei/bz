/**
 * 台历网格纯函数（QQ 群反馈「固化日历面板大小」，2026-11-23）。
 *
 * 原实现在 ui.ts::renderCal 里按当月实际天数拼格子：平年 2 月 4 行、别的月 5～6 行，
 * 切月时台历弹层高度跟着跳，手快点空又容易被入场动画期误判成「点外面」而关掉面板。
 * 这里把网格生成抽成纯函数：恒补满 6 行（42 格），高度不再随月份变化；
 * 另给入场期守卫的窗口一个单一常量，和 CSS 的 .3s 动画对齐。
 *
 * WEEK / pad2 从 render 单源引入，不在本文件重造。
 */
import { WEEK, pad2 } from './render';

/** 台历网格固定 6 行 × 7 列 = 42 格（能容纳任意月份的 6 行布局） */
export const CAL_ROWS = 6;
export const CAL_CELLS = CAL_ROWS * 7;

/** 入场动画时长（CSS .bz-diary-cal 的 slipIn .3s）——这段时间内「点弹层外」当误触忽略 */
export const CAL_ENTRANCE_GUARD_MS = 300;

export interface CalGridOptions {
  year: number;
  /** 1–12 */
  month: number;
  /** 日 → 当天几则 */
  byDay: Map<number, number>;
  /** 写作模式：所有日子可点；跳日模式：只有落过笔的日子可点 */
  writeMode: boolean;
  /** 写作模式当前选中的日期 YYYY-MM-DD */
  selectedDate: string | null;
}

/**
 * 生成台历网格 HTML：表头 7 列 + 前置空格 + 当月格子 + 末尾空格补到 42 格。
 * 补的空格没有 data-d / bz-diary-has，承接原有的 click 选择器（只挂可点格）时天然点不到。
 */
export function buildCalGridHtml(o: CalGridOptions): string {
  const { year, month, byDay, writeMode, selectedDate } = o;
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  let html = WEEK.map((w) => `<span class="bz-diary-cal-wd">${w}</span>`).join('');
  for (let i = 0; i < first; i++) html += '<span class="bz-diary-cal-cell"></span>';
  for (let d = 1; d <= days; d++) {
    const n = byDay.get(d);
    const date = `${year}-${pad2(month)}-${pad2(d)}`;
    const sel = selectedDate === date;
    const cls = ['bz-diary-cal-cell'];
    if (n) cls.push('bz-diary-has');
    if (writeMode) cls.push('bz-diary-pickable');
    if (sel) cls.push('bz-diary-sel');
    html += `<span class="${cls.join(' ')}" data-d="${d}"${n ? ` data-n="${n}"` : ''}>${d}</span>`;
  }
  // 固化尺寸：末尾补空格到满 6 行，切月只换数字不换外形
  for (let i = first + days; i < CAL_CELLS; i++) html += '<span class="bz-diary-cal-cell"></span>';
  return html;
}

/** 入场动画期内（含刚打开的 0ms）视为误点，忽略「点弹层外」的关闭意图。 */
export function withinEntranceGuard(elapsedMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < CAL_ENTRANCE_GUARD_MS;
}
