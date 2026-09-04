/**
 * 内容首页（home 域）「本周」轻卡 UI 测试（R1 生活周报）：
 * 真实快照管线出卡、五格 0 值常驻不隐藏、待办完成率两种形态（P% / 完成 N）、
 * 数字格经 data-home-side 既有点击路径直达域面板、快照无 weekly 字段整卡隐藏。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resetHomeState, H } from '../../src/home/state';
import { openHome, unloadHome } from '../../src/home/index';
import { EMPTY_WEEKLY } from '../../src/home/weekly';

/** 带 listCommands/executeCommandById 的 app（记录执行过的命令） */
function homeApp(vault: MockVault, commandIds: string[] = []) {
  const base = mockAppWithVault(vault);
  const executed: string[] = [];
  (base as any).commands.listCommands = () => (commandIds || []).map((id) => ({ id, name: id }));
  (base as any).commands.executeCommandById = async (id: string) => {
    executed.push(id);
  };
  (base as any).__executed = executed;
  return base as any;
}

const executedOf = (app: any): string[] => app.__executed;

function seedHome(vault: MockVault, pinned = ['diary']) {
  vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned }));
}

describe('本周轻卡（R1 生活周报）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetHomeState();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadHome();
    document.body.innerHTML = '';
  });

  /** 注入快照后经编辑开关往返触发重绘（既有测试同款手法，不经私有 renderAll） */
  function rerender(overlay: HTMLElement): void {
    (overlay.querySelector('[data-home-edit]') as HTMLElement).click();
    (overlay.querySelector('[data-home-edit]') as HTMLElement).click();
  }

  it('真实快照管线（空库）：周卡出现、五格齐全且 0 值常驻不隐藏', async () => {
    seedHome(vault);
    openHome(homeApp(vault));
    await new Promise((r) => setTimeout(r, 0)); // 快照采集（含 weekly）完成
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    const week = overlay.querySelector('[data-home-week]') as HTMLElement;
    expect(week).toBeTruthy();
    expect(week.hidden).toBe(false);
    expect(week.querySelector('.bz-home-week-t')!.textContent).toBe('本周');
    const cells = [...overlay.querySelectorAll(".bz-home-week-cell")] as HTMLElement[];
    expect(cells.length).toBe(5); // 影视/读完/番茄/待办/日记
    const ids = cells.map((c) => c.dataset.homeSide);
    expect(ids).toEqual(['cinema', 'bookshelf', 'pomodoro', 'memo', 'diary']);
    // 0 值显示 0 不隐藏（格子稳定不跳变）
    const vals = cells.map((c) => c.querySelector('.bz-home-week-v')!.textContent);
    expect(vals).toEqual(['0', '0', '0', '0', '0']);
  });

  it('注入周数据：数字格展示聚合值（番茄带分钟、日记/影视/读完计数）', async () => {
    seedHome(vault);
    openHome(homeApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    H.snapshot = {
      byDomain: {},
      weekly: { ...EMPTY_WEEKLY, movies: 2, booksFinished: 1, pomodoros: 6, pomodoroMinutes: 150, diary: 5 },
      ok: true,
    };
    rerender(overlay);
    const textOf = (id: string) =>
      (overlay.querySelector(`.bz-home-week-cell[data-home-side="${id}"]`) as HTMLElement).textContent!;
    expect(textOf('cinema')).toContain('2');
    expect(textOf('bookshelf')).toContain('1');
    expect(textOf('pomodoro')).toContain('6');
    expect(textOf('pomodoro')).toContain('150 分');
    expect(textOf('diary')).toContain('5');
  });

  it('待办格：本周有创建显示完成率 P%（完成/创建）；本周创建为 0 显示完成数不带百分号', async () => {
    seedHome(vault);
    openHome(homeApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    // 4/5 → 80%
    H.snapshot = {
      byDomain: {},
      weekly: { ...EMPTY_WEEKLY, todoDone: 4, todoCreated: 5 },
      ok: true,
    };
    rerender(overlay);
    const memoCell = overlay.querySelector('.bz-home-week-cell[data-home-side="memo"]') as HTMLElement;
    expect(memoCell.querySelector('.bz-home-week-v')!.textContent).toBe('80%');
    expect(memoCell.getAttribute('aria-label')).toContain('完成 4 / 创建 5');
    // 创建 0 → 完成 N（无百分号）
    H.snapshot = {
      byDomain: {},
      weekly: { ...EMPTY_WEEKLY, todoDone: 3, todoCreated: 0 },
      ok: true,
    };
    rerender(overlay);
    expect((overlay.querySelector('.bz-home-week-cell[data-home-side="memo"] .bz-home-week-v') as HTMLElement).textContent).toBe('3');
    expect((overlay.querySelector('.bz-home-week-cell[data-home-side="memo"]') as HTMLElement).getAttribute('aria-label')).toContain('完成待办 3 条');
  });

  it('数字格可点：点「影视」格经 data-home-side 既有点击路径直达影院并关首页', async () => {
    seedHome(vault);
    const app = homeApp(vault, ['bz-cinema-open']);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    H.snapshot = { byDomain: {}, weekly: { ...EMPTY_WEEKLY, movies: 2 }, ok: true };
    rerender(overlay);
    const cell = overlay.querySelector('.bz-home-week-cell[data-home-side="cinema"]') as HTMLElement;
    expect(cell).toBeTruthy();
    cell.click();
    expect(executedOf(app)).toEqual(['bz-cinema-open']);
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy(); // 直达后首页关闭
  });

  it('快照无 weekly 字段（旧消费方/手工注入）：周卡整卡隐藏不占位', async () => {
    seedHome(vault);
    openHome(homeApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    H.snapshot = { byDomain: { diary: { text: '12 篇', hl: false, sub: '' } }, ok: true };
    rerender(overlay);
    const week = overlay.querySelector('[data-home-week]') as HTMLElement;
    expect(week.hidden).toBe(true);
    // 域卡统计不受影响（周卡为纯增量）
    expect(overlay.querySelector('[data-home-card="diary"] .bz-home-badge-t')!.textContent).toContain('12 篇');
  });
});
