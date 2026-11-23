// @vitest-environment node
/* ============================================================
 * 台历面板固化（QQ 群反馈：面板尺寸不稳定、快速点击误触正文）
 *
 * 根因两条：
 *  1) 网格行数随月份变（平年 2 月 4 行，其余 5～6 行），切月时面板高度跳动；
 *  2) 入场动画 0.3s 内弹层在旋转位移，手快点空落到遮罩上会直接关掉台历，
 *     下一击才碰到遮罩下的正文。
 *
 * 本文件锁两条行为契约：网格恒 42 格（6 行）；入场 300ms 内忽略「点弹层外」。
 * 纯函数断言，不跑 jsdom；CSS 只做静态源断言（与 mobile-press-guard.test.ts 同款）。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCalGridHtml,
  withinEntranceGuard,
  CAL_CELLS,
  CAL_ENTRANCE_GUARD_MS,
} from '../../src/diary/cal-grid';

const css = fs.readFileSync(path.join(process.cwd(), 'src/diary/styles.css'), 'utf8');

describe('buildCalGridHtml · 网格恒 6 行', () => {
  const count = (html: string, cls: string) =>
    (html.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, 'g')) || []).length;

  it('平年 2 月（28 天）也补满 42 格，切月高度不跳', () => {
    const html = buildCalGridHtml({ year: 2026, month: 2, byDay: new Map(), writeMode: false, selectedDate: null });
    expect(count(html, 'bz-diary-cal-cell')).toBe(CAL_CELLS);
  });

  it('31 天的月份同样是 42 格', () => {
    const html = buildCalGridHtml({ year: 2026, month: 1, byDay: new Map(), writeMode: false, selectedDate: null });
    expect(count(html, 'bz-diary-cal-cell')).toBe(CAL_CELLS);
  });

  it('闰年 2 月（29 天）同样是 42 格', () => {
    const html = buildCalGridHtml({ year: 2028, month: 2, byDay: new Map(), writeMode: false, selectedDate: null });
    expect(count(html, 'bz-diary-cal-cell')).toBe(CAL_CELLS);
  });

  it('星期表头恒 7 列', () => {
    const html = buildCalGridHtml({ year: 2026, month: 11, byDay: new Map(), writeMode: false, selectedDate: null });
    expect(count(html, 'bz-diary-cal-wd')).toBe(7);
  });

  it('有落笔的日子仍带可点标与当天几则角标', () => {
    const html = buildCalGridHtml({
      year: 2026, month: 11, byDay: new Map([[3, 2]]), writeMode: false, selectedDate: null,
    });
    expect(html).toMatch(/data-d="3" data-n="2"/);
  });

  it('写作模式所有日子可点，跳日模式只标记落过笔的日子', () => {
    const base = { year: 2026, month: 11, byDay: new Map([[3, 1]]) };
    const jump = buildCalGridHtml({ ...base, writeMode: false, selectedDate: null });
    const write = buildCalGridHtml({ ...base, writeMode: true, selectedDate: null });
    expect(count(jump, 'bz-diary-pickable')).toBe(0);
    expect(count(write, 'bz-diary-pickable')).toBe(30);
  });

  it('选中态只落在该日子上', () => {
    const html = buildCalGridHtml({
      year: 2026, month: 11, byDay: new Map(), writeMode: true, selectedDate: '2026-11-09',
    });
    expect(count(html, 'bz-diary-sel')).toBe(1);
    expect(html).toMatch(/data-d="9"[^>]*class="[^"]*bz-diary-sel|class="[^"]*bz-diary-sel[^"]*"[^>]*data-d="9"/);
  });
});

describe('withinEntranceGuard · 动画期误点守卫', () => {
  it('窗口必须与 CSS 入场动画时长一致（300ms）', () => {
    expect(CAL_ENTRANCE_GUARD_MS).toBe(300);
    expect(css).toMatch(/\.bz-diary-cal\s*\{[^}]*animation:\s*bz-diary-slipIn\s*\.3s/);
  });

  it('刚打开 / 动画未结束：视为误点，忽略关闭', () => {
    expect(withinEntranceGuard(0)).toBe(true);
    expect(withinEntranceGuard(299)).toBe(true);
  });

  it('动画结束后照常允许点外面关闭', () => {
    expect(withinEntranceGuard(300)).toBe(false);
    expect(withinEntranceGuard(1200)).toBe(false);
  });

  it('异常耗时不误判为「动画中」', () => {
    expect(withinEntranceGuard(Number.NaN)).toBe(false);
    expect(withinEntranceGuard(-1)).toBe(false);
  });
});

describe('样式静态契约 · 点击区与固定行高', () => {
  it('日期格子加大点击区，不再只有 8px 上下 padding', () => {
    expect(css).toMatch(/\.bz-diary-cal-cell\s*\{[^}]*padding:\s*12px 0 13px/);
  });

  it('网格固定行高：空格 cell 也会撑满一行，切月不会因空行塌陷而变高', () => {
    // 只补 42 格还不够：补的空格没文本时行高塌到 padding 高度（~25px），
    // 有日期的行是 ~44px —— 行高不一，面板高度仍随「这个月补了几行空格」跳。
    expect(css, '.bz-diary-cal-grid 必须固定 grid-auto-rows').toMatch(
      /\.bz-diary-cal-grid\s*\{[^}]*grid-auto-rows:\s*44px/
    );
  });
});
