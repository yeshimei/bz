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
import { CAL_WEEKDAYS, calHeadHtml, calGridHtml, panelShellHtml, type CalCell } from '../../src/memo/render';
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

describe('issue 355 · UI（页签切换/到期标记/点日清单/改期）', () => {
  let vault: MockVault;

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
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  function at(dayOffset: number, hm: string): string {
    return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
  }

  function seedEvents(): { app: ReturnType<typeof mockAppWithVault> } {
    return seed([
      { id: 'ov', title: '逾期事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: at(-3, '09:00') },
      { id: 'td', title: '今日事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: at(0, '09:00') },
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
      expect(td.due.slice(11)).toBe('09:00:00'); // 时刻保留
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
});
