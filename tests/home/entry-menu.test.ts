// @vitest-environment node
/**
 * 首页入口菜单纯层契约（core/item-actions 的接线面，2026-09-10）：
 *  - DOMAIN_MENU 形状：只放域自己的快捷动作（无「打开 X」、无「整理顺序」）；
 *  - pomodoroMenuLabel：番茄钟是唯一动态文案项（专注中 → 停止专注 / 否则 → 开始专注）；
 *  - sheetHeadHtml：长按抽屉盒头 = 域彩色图标 + 域名 + **入口行那行灰字**（口径与 riverCountText 同源，
 *    无计数文案回落域副题 —— 与入口行 `riverCountText(...) ?? d.sub` 完全一致）；
 *  - domainColor：入口行 / 瓦片 / 盒头共用同一取色口径，未登记域回落中性灰。
 */
import { describe, it, expect } from 'vitest';
import {
  DOMAIN_MENU, DOMAIN_MAP, DOMAIN_DOT, domainColor,
  pomodoroMenuLabel, sheetHeadHtml, riverCountText, EMPTY_COUNTS,
} from '../../src/home/render';
import type { RiverData, RiverStreak } from '../../src/home/render';

const NOW = new Date(2026, 8, 7, 21, 36).getTime();

function ds(n: number): string {
  const d = new Date(NOW - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function riverData(counts: Partial<typeof EMPTY_COUNTS> = {}, streak?: RiverStreak): RiverData {
  const day = (i: number) => ({
    dateStr: ds(i),
    events: [],
    summary: { diary: 0, movies: 0, books: 0, memoDone: 0, memoCreated: 0, pomodoros: 0, pomodoroMinutes: 0 },
    firstTs: null,
  });
  const wk = (i: number) => ({ dateStr: ds(i), label: ds(i).slice(5), dayOfMonth: Number(ds(i).slice(8)), weekday: '', hit: false });
  return {
    today: day(0),
    yesterday: day(1),
    days: Array.from({ length: 7 }, (_, i) => day(i)),
    week: Array.from({ length: 7 }, (_, i) => wk(i)),
    streak: streak ?? { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS, ...counts },
  };
}

describe('DOMAIN_MENU 形状', () => {
  it('只放域快捷动作：无「打开 X」、无「整理顺序」', () => {
    const ids = Object.keys(DOMAIN_MENU);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(DOMAIN_MAP.has(id), `菜单域 ${id} 必须在 DOMAINS 里`).toBe(true);
      const list = DOMAIN_MENU[id];
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) {
        expect(a.label.trim()).not.toBe('');
        expect(a.label.startsWith('打开')).toBe(false);
        expect(a.label).not.toContain('整理顺序');
        expect(a.commandId).toMatch(/^bz-[a-z0-9-]+$/);
        expect(a.icon).toBeTruthy();
      }
    }
  });

  it('番茄钟是唯一动态文案项', () => {
    const dyn = Object.entries(DOMAIN_MENU)
      .filter(([, list]) => list.some((a) => a.dynamic))
      .map(([id]) => id);
    expect(dyn).toEqual(['pomodoro']);
    expect(DOMAIN_MENU.pomodoro[0].dynamic).toBe('focus');
    expect(DOMAIN_MENU.pomodoro[0].commandId).toBe('bz-pomodoro-focus-toggle');
  });

  it('剪藏本 / 保险库 / 设置不在菜单里（无域快捷动作 → 不挂浮层）', () => {
    for (const id of ['clipping', 'encrypt', 'settings', 'attach']) {
      expect(DOMAIN_MENU[id], id).toBeUndefined();
    }
  });
});

describe('pomodoroMenuLabel', () => {
  it('专注中 → 停止专注；否则 → 开始专注', () => {
    expect(pomodoroMenuLabel(true)).toBe('停止专注');
    expect(pomodoroMenuLabel(false)).toBe('开始专注');
  });

  it('静态 label 即「未专注」兜底（动态改写前的默认值）', () => {
    expect(DOMAIN_MENU.pomodoro[0].label).toBe(pomodoroMenuLabel(false));
  });
});

describe('sheetHeadHtml（长按抽屉盒头）', () => {
  it('版式：上排=彩色域图标+域名同行，下排=入口行那行灰字', () => {
    const data = riverData({ diaryTotal: 518 }, { diaryStreak: 3, diaryWrittenToday: true });
    const d = DOMAIN_MAP.get('diary')!;
    const html = sheetHeadHtml(d, data);
    // 上排：图标占位与域名在同一容器内；该容器收起后才跟下排灰字（灰字不在图标行里）
    expect(html).toMatch(
      /<div class="bz-home-sheet-top">[\s\S]*data-lucide[\s\S]*bz-home-sheet-nm[\s\S]*<\/div>\s*<div class="bz-home-sheet-sub">/
    );
    expect(html).toContain('日记本');
    expect(html).toContain(riverCountText('diary', data)!); // 「518 篇 · 今日已写」
    expect(html).toContain('518 篇 · 今日已写');
    expect(html).toContain(DOMAIN_DOT.diary); // 图标色 = 域色（彩色图标）
  });

  it('无计数文案的域回落域副题（与入口行 `riverCountText ?? sub` 一致）', () => {
    const data = riverData();
    const d = DOMAIN_MAP.get('settings')!;
    expect(riverCountText('settings', data)).toBeNull();
    expect(sheetHeadHtml(d, data)).toContain(d.sub);
  });

  it('未知域色回落中性灰；已登记域取 DOMAIN_DOT', () => {
    expect(domainColor('nope')).toBe('#8a8f99');
    expect(domainColor('diary')).toBe(DOMAIN_DOT.diary);
  });
});
