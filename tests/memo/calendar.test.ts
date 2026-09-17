/**
 * 备忘录月历视图（issue 355）回归：
 * - 纯层：calHeadHtml/calGridHtml markup 口径（锚点/状态档/补位/超量折叠）；
 * - UI 层：视图切换页签、到期标记（overdue/today/future 沿用状态色）、点日看当日清单、
 *   翻页与回到今天、菜单「移到选中日期」改期（顺延到其他日期）、移动端可切换。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { MemoData } from '../../src/memo/data';
import { CAL_WEEKDAYS, calEmptyHtml, calHeadHtml, calGridHtml, calStatsHtml, panelShellHtml, type CalCell } from '../../src/memo/render';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';

// ---------- 纯层 markup ----------

describe('issue 355 · 月历纯层 markup 口径', () => {
  it('CAL_WEEKDAYS：周一首列七天', () => {
    expect(CAL_WEEKDAYS).toEqual(['一', '二', '三', '四', '五', '六', '日']);
  });

  it('calHeadHtml：翻页/回到今天锚点在场', () => {
    const h = calHeadHtml('2026年9月');
    for (const anchor of ['data-memo-cal-prev', 'data-memo-cal-next', 'data-memo-cal-today']) {
      expect(h).toContain(anchor);
    }
    expect(h).toContain('2026年9月');
  });

  it('calGridHtml：补位空格/今日/选中态/事件 chip/超量折叠', () => {
    const cells: CalCell[] = [
      { day: 0, blank: true, chips: [] },
      { day: 15, today: true, selected: true, chips: [
        { id: 'a', title: '逾期事项', cls: 'is-overdue' },
        { id: 'b', title: '今日事项', cls: 'is-today' },
        { id: 'c', title: '未来事项', cls: 'is-future' },
        { id: '', title: '还有 2 条', cls: 'is-more' },
      ] },
    ];
    const h = calGridHtml(cells);
    expect(h).toContain('data-memo-cal-day="15"');
    expect(h).toContain('is-blank');
    expect(h).toContain('is-today'); // 格子态
    expect(h).toContain('is-selected');
    expect(h).toContain('data-memo-cal-item="a"');
    expect(h).toContain('is-overdue');
    expect(h).toContain('is-future');
    expect(h).toContain('还有 2 条');
    // 折叠 chip 无事件锚点（点了 = 选中格子看全量）
    expect(h).not.toContain('data-memo-cal-item=""');
  });

  it('panelShellHtml：视图切换页签（列表/月历）在场', () => {
    const h = panelShellHtml();
    expect(h).toContain('data-memo-viewtoggle');
    expect(h).toContain('data-memo-view="list"');
    expect(h).toContain('data-memo-view="calendar"');
  });

  it('calStatsHtml：月度概览统计行 markup（issue 355 真机回归）', () => {
    const h = calStatsHtml(3, 1);
    expect(h).toContain('bz-memo-cal-stats');
    expect(h).toContain('本月到期');
    expect(h).toContain('3');
    expect(h).toContain('今日');
    expect(h).toContain('1');
  });

  it('审查 P2 · calStatsHtml：非当月（todayCount=null）不显「今日 N 条」段', () => {
    const h = calStatsHtml(2, null);
    expect(h).toContain('本月到期');
    expect(h).not.toContain('今日');
  });

  it('calEmptyHtml：空月人话提示 markup（issue 355 真机回归）', () => {
    const h = calEmptyHtml(false);
    expect(h).toContain('bz-memo-cal-empt');
    expect(h).toContain('本月没有到期事项');
  });

  it('审查 P2 · calEmptyHtml：筛选滤空时文案附筛选上下文', () => {
    const h = calEmptyHtml(true);
    expect(h).toContain('当前筛选下本月没有到期事项');
    expect(h).toContain('清除搜索或切换场景');
  });
});

// ---------- UI 层 ----------

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

describe('issue 355 · UI（页签切换/到期标记/点日清单/改期/统计与空月）', () => {
  let vault: MockVault;

  // 假时钟钉在当月 15 日 12:00：消除三类时敏翻车（今日条目 due 时刻已过翻 overdue 档、
  // 月初跑 ov=-3d 跨月、月末跑 ft=+5d 跨月）。只 fake Date，setTimeout/vi.waitFor 走真计时。
  const FIXED_NOW = moment().startOf('month').date(15).hour(12).minute(0).second(0).millisecond(0).toDate();

  function seed(items: Record<string, unknown>[]): { app: ReturnType<typeof mockAppWithVault> } {
    vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items));
    const settings: Record<string, unknown> = { ...SETTINGS };
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);
    return { app };
  }

  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    vi.useFakeTimers({ toFake: ['Date'], now: FIXED_NOW });
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function at(dayOffset: number, hm: string): string {
    return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
  }

  function seedEvents(): { app: ReturnType<typeof mockAppWithVault> } {
    return seed([
      { id: 'ov', title: '逾期事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: at(-3, '09:00') },
      // 今日条目时刻取 18:00（> 假时钟 12:00）→ today 档稳定成立
      { id: 'td', title: '今日事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: at(0, '18:00') },
      { id: 'ft', title: '未来事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: at(5, '09:00') },
      // 已完成（不出 chip）+ 无 due（不进月历）
      { id: 'dn', title: '已完成事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: at(-1, '10:00'), due: at(0, '08:00') },
      { id: 'nd', title: '无截止事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: null },
    ]);
  }

  function openCal(app: ReturnType<typeof mockAppWithVault>): void {
    openMemoPanel(app);
    // 默认列表视图
    expect(M.view).toBe('list');
    (document.querySelector('[data-memo-view="calendar"]') as HTMLElement).click();
  }

  it('切到月历：网格渲染当月天数，今日格带事件 chip（状态色沿用 overdue/today/future）', async () => {
    const { app } = seedEvents();
    openCal(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(5);
    });
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    const month = moment().format('YYYY-MM');
    const days = moment().daysInMonth();
    expect(document.querySelectorAll('.bz-memo-cal-cell[data-memo-cal-day]').length).toBe(days);
    // 今日格：today 态 + 今日事项 chip
    const todayNum = moment().date();
    const todayCell = document.querySelector(`[data-memo-cal-day="${todayNum}"]`) as HTMLElement;
    expect(todayCell.className).toContain('is-today');
    expect(todayCell.querySelector('[data-memo-cal-item="td"]')?.textContent).toContain('今日事项');
    expect((todayCell.querySelector('[data-memo-cal-item="td"]') as HTMLElement).className).toContain('is-today');
    // 逾期 / 未来 chip 状态档
    expect((document.querySelector('[data-memo-cal-item="ov"]') as HTMLElement).className).toContain('is-overdue');
    expect((document.querySelector('[data-memo-cal-item="ft"]') as HTMLElement).className).toContain('is-future');
    // 已完成 / 无 due 不出 chip
    expect(document.querySelector('[data-memo-cal-item="dn"]')).toBeNull();
    expect(document.querySelector('[data-memo-cal-item="nd"]')).toBeNull();
    // 头行月份标签
    expect(document.querySelector('.bz-memo-cal-title')?.textContent).toBe(moment().format('YYYY年M月'));
    expect(M.calMonth).toBe(month);
  });

  it('点日看当日清单；再点翻页/回到今天', async () => {
    const { app } = seedEvents();
    openCal(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(5);
    });
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 点未来事项所在日 → 当日清单 1 项
    const futureDay = moment().add(5, 'days').date();
    (document.querySelector(`[data-memo-cal-day="${futureDay}"]`) as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-daypanel')).toBeTruthy();
    });
    expect(document.querySelector('.bz-memo-cal-daypanel')?.textContent).toContain('未来事项');
    expect(document.querySelector('.bz-memo-cal-daypanel')?.textContent).toContain('1 项');
    expect(M.calSelected).toBe(moment().add(5, 'days').format('YYYY-MM-DD'));
    // 翻下月：当日清单收起、月份标签变化
    (document.querySelector('[data-memo-cal-next]') as HTMLElement).click();
    expect(M.calSelected).toBeNull();
    expect(document.querySelector('.bz-memo-cal-daypanel')).toBeNull();
    expect(document.querySelector('.bz-memo-cal-title')?.textContent).toBe(moment().add(1, 'month').format('YYYY年M月'));
    // 回到今天
    (document.querySelector('[data-memo-cal-today]') as HTMLElement).click();
    expect(document.querySelector('.bz-memo-cal-title')?.textContent).toBe(moment().format('YYYY年M月'));
    // 空日提示
    const day = moment().add(6, 'days').date();
    (document.querySelector(`[data-memo-cal-day="${day}"]`) as HTMLElement).click();
    await vi.waitFor(() => {
      if (moment().add(6, 'days').month() === moment().month()) {
        expect(document.querySelector('.bz-memo-cal-noday') ?? document.querySelector('.bz-memo-cal-daypanel')).toBeTruthy();
      }
    });
  });

  it('菜单「移到选中日期」：日历点选目标日 → 列表对事项改期（保留时刻）', async () => {
    const { app } = seedEvents();
    openCal(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(5);
    });
    // 月历上先点目标日（未来事项当天）
    const futureKey = moment().add(5, 'days').format('YYYY-MM-DD');
    const futureDay = moment().add(5, 'days').date();
    (document.querySelector(`[data-memo-cal-day="${futureDay}"]`) as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-daypanel')).toBeTruthy();
    });
    // 切回列表视图，对今日事项右键 →「移到选中日期」
    (document.querySelector('[data-memo-view="list"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="td"]')).toBeTruthy();
    });
    const todayCard = document.querySelector('.bz-memo-card[data-memo-id="td"]') as HTMLElement;
    todayCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    const items = [...document.querySelectorAll('.bz-item-menu-item')];
    const moveBtn = items.find((b) => b.textContent!.includes('移到选中日期')) as HTMLElement;
    expect(moveBtn, '选中日 ≠ 到期日时应出现「移到选中日期」').toBeTruthy();
    moveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      const td = raw.find((i: any) => i.id === 'td');
      expect(td.due.slice(0, 10)).toBe(futureKey);
      expect(td.due.slice(11)).toBe('18:00:00'); // 时刻保留
    });
  });

  it('列表视图的卡菜单不出现「移到选中日期」（月历限定）', async () => {
    const { app } = seedEvents();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="td"]')).toBeTruthy();
    });
    const card = document.querySelector('.bz-memo-card[data-memo-id="td"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    const items = [...document.querySelectorAll('.bz-item-menu-item')];
    expect(items.find((b) => b.textContent!.includes('移到选中日期'))).toBeUndefined();
  });

  it('移动端可切换月历（真全屏同一工具行页签）', async () => {
    const { app } = seedEvents();
    MockPlatform.isMobile = true;
    try {
      openMemoPanel(app);
      await vi.waitFor(() => {
        expect(document.querySelector('[data-memo-view="calendar"]')).toBeTruthy();
      });
      (document.querySelector('[data-memo-view="calendar"]') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
      });
      expect(M.view).toBe('calendar');
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  it('审查体验 P2 · 移动端点月历 chip = 选中当日看清单（不直开编辑器）', async () => {
    const { app } = seedEvents();
    MockPlatform.isMobile = true;
    try {
      openCal(app);
      // 等 item 加载与 chip 渲染完成再点（首次 grid 出现时 items 可能尚未汇入）
      await vi.waitFor(() => {
        expect(document.querySelector('[data-memo-cal-item="td"]')).toBeTruthy();
      });
      // chip 热区外扩后几乎占满格子：点 chip 须落回格子选中当日（点格看清单为主），不开编辑器
      (document.querySelector('[data-memo-cal-item="td"]') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-memo-cal-daypanel')).toBeTruthy();
      });
      expect(M.calSelected).toBe(moment().format('YYYY-MM-DD'));
      expect(document.querySelector('.bz-memo-editor')).toBeNull();
      expect(document.querySelector('.bz-memo-cal-daypanel')?.textContent).toContain('今日事项');
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  // ---------- 统计行与空月提示（issue 355 真机回归：格子全空且无解释） ----------

  it('月度概览统计行：口径与格子 chip 同源（完成/无 due 不计入），有条目月不出空态', async () => {
    const { app } = seedEvents();
    openCal(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(5);
    });
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-stats')).toBeTruthy();
    });
    const stats = document.querySelector('.bz-memo-cal-stats')!.textContent!;
    expect(stats).toContain('本月到期 3 条'); // ov + td + ft
    expect(stats).toContain('今日 1 条'); // 仅 td
    // 有条目月不出现空态提示
    expect(document.querySelector('.bz-memo-cal-empt')).toBeNull();
  });

  it('空月人话提示：全库无 due 条目时格子全空但有统计与解释，翻月仍成立', async () => {
    // 真机复现场景：多数备忘录随手记不设截止 → 修复前月历一片空白且无任何解释
    const { app } = seed([
      { id: 'nd1', title: '无截止一', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: null },
      { id: 'nd2', title: '无截止二', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: null },
    ]);
    openCal(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 格子确无 chip（无 due 不进月历——口径本身正确，缺的是解释）
    expect(document.querySelector('[data-memo-cal-item]')).toBeNull();
    const stats = document.querySelector('.bz-memo-cal-stats')!.textContent!;
    expect(stats).toContain('本月到期 0 条');
    expect(stats).toContain('今日 0 条');
    // 空态人话提示
    expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('本月没有到期事项');
    // 翻下月（也无条目）→ 空态与零统计仍在
    (document.querySelector('[data-memo-cal-next]') as HTMLElement).click();
    expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('本月没有到期事项');
    expect(document.querySelector('.bz-memo-cal-stats')?.textContent).toContain('本月到期 0 条');
  });

  it('跨月统计联动：下月条目不进当月格（当月出空态），翻月后 chip 与统计齐现', async () => {
    const nextMonthDay = moment().add(1, 'month').date(10).format('YYYY-MM-DD 09:00:00');
    const { app } = seed([
      { id: 'nm', title: '下月事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: nextMonthDay },
    ]);
    openCal(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 当月：零条目 → 空态 + 统计 0（含今日 0）
    expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('本月没有到期事项');
    expect(document.querySelector('.bz-memo-cal-stats')?.textContent).toContain('本月到期 0 条');
    expect(document.querySelector('[data-memo-cal-item="nm"]')).toBeNull();
    // 翻下月：chip 出现 + 统计联动为 1，空态退场
    (document.querySelector('[data-memo-cal-next]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-cal-item="nm"]')).toBeTruthy();
    });
    expect((document.querySelector('[data-memo-cal-item="nm"]') as HTMLElement).className).toContain('is-future');
    expect(document.querySelector('.bz-memo-cal-stats')?.textContent).toContain('本月到期 1 条');
    // 非当月不显「今日 N 条」段（审查 P2 修复批：今日不在该月格中，计数无所指）
    expect(document.querySelector('.bz-memo-cal-stats')?.textContent).not.toContain('今日');
    expect(document.querySelector('.bz-memo-cal-empt')).toBeNull();
  });

  it('审查 P2 · 搜索滤空时空态文案附筛选上下文；无筛选恢复人话原文案', async () => {
    const { app } = seed([
      { id: 'nd1', title: '无截止事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: null },
    ]);
    openCal(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 无筛选：原文案
    expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('本月没有到期事项');
    // 输入搜索词滤空：附筛选上下文
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = '不存在的关键词';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('当前筛选下本月没有到期事项');
    });
    // 清掉搜索：恢复原文案
    inp.value = '';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-empt')?.textContent).toContain('本月没有到期事项');
      expect(document.querySelector('.bz-memo-cal-empt')?.textContent).not.toContain('当前筛选下');
    });
  });

  it('审查体验 P3 · 「回到今天」同时选中今日：当日清单直接展开', async () => {
    const { app } = seedEvents();
    openCal(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 翻下月再回来：回到今天 = 翻月 + 选中今日
    (document.querySelector('[data-memo-cal-next]') as HTMLElement).click();
    expect(M.calSelected).toBeNull();
    (document.querySelector('[data-memo-cal-today]') as HTMLElement).click();
    const todayKey = moment().format('YYYY-MM-DD');
    expect(M.calSelected).toBe(todayKey);
    expect(document.querySelector('.bz-memo-cal-daypanel')?.textContent).toContain('今日事项');
  });

  it('审查 P3 · 无 due 条目「排到选中日期」：默认 09:00 时刻落盘', async () => {
    const { app } = seedEvents(); // 含无截止事项 nd
    openCal(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(5);
    });
    // 月历选中一个未来日
    const futureKey = moment().add(4, 'days').format('YYYY-MM-DD');
    (document.querySelector(`[data-memo-cal-day="${moment().add(4, 'days').date()}"]`) as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-daypanel')).toBeTruthy();
    });
    // 列表视图对无 due 条目右键 →「移到选中日期」出现（无 due 也有入口）
    (document.querySelector('[data-memo-view="list"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="nd"]')).toBeTruthy();
    });
    const card = document.querySelector('.bz-memo-card[data-memo-id="nd"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    const items = [...document.querySelectorAll('.bz-item-menu-item')];
    const moveBtn = items.find((b) => b.textContent!.includes('移到选中日期')) as HTMLElement;
    expect(moveBtn, '无 due 条目也应有「移到选中日期」入口').toBeTruthy();
    // sub（「→ MM-DD 09:00」）仅移动端抽屉渲染（既有拍板：桌面菜单不渲染小字），
    // 桌面菜单路径断言入口 + 行为；sub 文案格式由下方 moveDayText 纯函数用例覆盖
    moveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      const nd = raw.find((i: any) => i.id === 'nd');
      expect(nd.due).toBe(`${futureKey} 09:00`);
    });
  });

  it('审查 P3 · moveDayText：跨年目标日带年份，同年只显 MM-DD', async () => {
    const { moveDayText } = await import('../../src/memo/ui');
    const nextYear = moment().add(1, 'year').format('YYYY-MM-DD');
    const thisYear = moment().format('YYYY-MM-DD');
    expect(moveDayText(nextYear)).toBe(moment(nextYear).format('YYYY-MM-DD')); // 跨年带年份
    expect(moveDayText(thisYear)).toBe(moment(thisYear).format('MM-DD')); // 同年只显 MM-DD
    expect(moveDayText(thisYear)).not.toContain(moment().format('YYYY')); // 今年不缀年份
  });
});
