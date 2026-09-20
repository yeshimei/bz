/**
 * memo 拍板执行批回归 · 完成动作反馈（呈报#12/#13，2026-09-21 拍板）：
 * - 12A 勾选 300ms 反悔窗口内勾选圈挂「待定」视觉态（bz-memo-pending，呼吸/半亮）；
 *   落定即摘除（refresh 后划线），反悔即摘除且不落盘。修复前必红：窗口内圈无任何变化。
 * - 13A 完成去向轻量反馈：条目挪进已完成折叠区（默认收起）后折叠条短暂高亮
 *   （bz-memo-donebar-bump）+ 计数 +1 可见。不做自动展开（13B 明确不做）。
 *   修复前必红：折叠条无反馈类。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  memoAutoArchive: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  const items = [
    { id: 'f1', title: '待办一条', scene: '学习', priority: 'minor', created: at(-1, '10:00'), completed: null, due: null },
    { id: 'f2', title: '待办两条', scene: '学习', priority: 'minor', created: at(-1, '11:00'), completed: null, due: null },
    { id: 'f3', title: '昨日已完成', scene: '学习', priority: 'minor', created: at(-2, '09:00'), completed: at(-1, '18:00'), due: null },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openSeeded(): Promise<ReturnType<typeof seedVault>> {
  const seeded = seedVault();
  openMemoPanel(seeded.app);
  await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
  return seeded;
}

describe('呈报#12（12A）：勾选 300ms 反悔窗口「待定」视觉态', () => {
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

  it('窗口内勾选圈挂 bz-memo-pending，条目未落盘', async () => {
    await openSeeded();
    const check = document.querySelector('[data-memo-check]') as HTMLElement;
    check.click();
    expect(check.classList.contains('bz-memo-pending')).toBe(true);
    // 尚未落定：列表不变、无完成态
    expect(document.querySelectorAll('.bz-memo-card').length).toBe(2);
    expect(document.querySelector('.bz-memo-card.bz-memo-done')).toBeNull();
  });

  it('窗口内再点 = 反悔：待定态摘除、不落盘', async () => {
    const { vault } = await openSeeded();
    const check = document.querySelector('[data-memo-check]') as HTMLElement;
    check.click();
    expect(check.classList.contains('bz-memo-pending')).toBe(true);
    check.click();
    expect(check.classList.contains('bz-memo-pending')).toBe(false);
    await wait(450); // 越过原防抖窗口
    expect(document.querySelectorAll('.bz-memo-card').length).toBe(2); // 仍 2 条未完成
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.find((r: any) => r.id === 'f1').completed).toBeNull();
  });

  it('落定：待定态摘除，条目划线进已完成折叠区', async () => {
    await openSeeded();
    const check = document.querySelector('[data-memo-check]') as HTMLElement;
    check.click();
    await wait(450); // 300ms 防抖 + 落盘刷新
    await vi.waitFor(() => {
      // 折叠区默认收起：条目从列表消失、计数 +1（与 13A 口径同源）
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(1);
      expect(document.querySelector('[data-memo-donebar] .bz-memo-donebar-cnt')!.textContent).toBe('2');
    });
    // 展开折叠区：完成条目勾选圈 checked、无待定态
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      const doneCard = document.querySelector('.bz-memo-card.bz-memo-done');
      expect(doneCard).toBeTruthy();
      const c = doneCard!.querySelector('[data-memo-check]') as HTMLElement;
      expect(c.classList.contains('bz-memo-pending')).toBe(false);
      expect(c.classList.contains('bz-memo-checked')).toBe(true);
    });
  });
});

describe('呈报#13（13A）：完成去向轻量反馈（不自动展开）', () => {
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

  it('完成后折叠条挂 bz-memo-donebar-bump，计数 +1，折叠区保持收起', async () => {
    await openSeeded();
    const bar = () => document.querySelector('[data-memo-donebar]') as HTMLElement;
    expect(bar().querySelector('.bz-memo-donebar-cnt')!.textContent).toBe('1');
    (document.querySelector('[data-memo-check]') as HTMLElement).click();
    await wait(450);
    await vi.waitFor(() => {
      expect(bar().classList.contains('bz-memo-donebar-bump')).toBe(true);
      expect(bar().querySelector('.bz-memo-donebar-cnt')!.textContent).toBe('2');
      // 13B 拍板不做：折叠区不自动展开（默认收起，无已完成卡直列）
      expect(document.querySelector('.bz-memo-card.bz-memo-done')).toBeNull();
    });
  });
});
