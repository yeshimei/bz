/**
 * 备忘录（memo）· T4 写路径失败分支表驱动钉死（review-deep memo-arch 测试缺口 4）
 *
 * 背景：E20 只盖了 composer 的写失败；条目卡片动作族（restoreItem/stopRecur/postponeItem/
 * moveToDay/togglePrio/completeItem/deleteItemConfirm）的 catch → notifySaveError 分支此前
 * 零覆盖。本文件逐动作 mock 数据层拒绝，钉死：
 *   1. 各自出「保存失败（<动作名>）」错误通知（动作名与 ui.ts 各 catch 的 what 参数逐字一致）；
 *   2. 不崩：面板仍在、其余条目数据不丢；
 *   3. 写失败分支不发任何域事件（发射点都在 try 内 emit 之前/成功路径）。
 *
 * 删除用例对 openFlowDialog mock 自动确认（现状=弹确认框；若并行批翻转「免确认直达」，
 * mock 自动兼容两种现状，用例无需改写）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MemoData } from '../../src/memo/data';

const mocks = vi.hoisted(() => ({
  openFlowDialog: vi.fn(async () => 'delete'),
  openSettingsPanel: vi.fn(),
}));
vi.mock('../../src/core/flow-dialog', () => ({ openFlowDialog: mocks.openFlowDialog }));
vi.mock('../../src/settings-panel', () => ({ openSettingsPanel: mocks.openSettingsPanel }));

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  // 已完成卡默认展开：「恢复未完成」用例需要看到已完成条目
  memoShowArchivedByDefault: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

/** 表驱动用例：菜单动作 → 数据层方法拒绝 → 期望的错误通知动作名 */
const CASES: {
  label: string; // 菜单项文案
  what: string; // notifySaveError 的动作名（与 ui.ts catch 分支逐字一致）
  item: Record<string, unknown>; // 被操作条目（id 'a'）
  fail: 'updateItem' | 'completeItem' | 'deleteItem'; // mock 拒绝的数据层方法
  calSelectedOffset?: number; // 「移到选中日期」需要月历选中日（与条目 due 不同日）
}[] = [
  { label: '恢复未完成', what: '恢复未完成', item: { completed: at(-1, '18:00') }, fail: 'updateItem' },
  { label: '停止重复', what: '停止重复', item: { recur: { kind: 'weekly' } }, fail: 'updateItem' },
  { label: '延后 1 天', what: '延后备忘录', item: { due: at(3, '09:00') }, fail: 'updateItem' },
  { label: '移到选中日期', what: '改期备忘录', item: { due: at(3, '09:00') }, fail: 'updateItem', calSelectedOffset: 9 },
  { label: '转为重要', what: '切换优先级', item: {}, fail: 'updateItem' },
  { label: '标记完成', what: '标记完成', item: {}, fail: 'completeItem' },
  { label: '删除', what: '删除备忘录', item: {}, fail: 'deleteItem' },
];

function seedVault(itemOverride: Record<string, unknown> = {}): { vault: MockVault; app: any; settings: any } {
  const vault = new MockVault();
  const items = [
    {
      id: 'a', title: '被操作条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
      completed: null, due: null, notePath: null, notePosition: null,
      scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
      ...itemOverride,
    },
    {
      id: 'b', title: '旁观条目', scene: '生活', priority: 'minor', created: at(-2, '10:00'),
      completed: null, due: null, notePath: null, notePosition: null,
      scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

function menuItems(): HTMLElement[] {
  return [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
}

async function openPanelWithMenu(app: any, calSelectedOffset?: number): Promise<void> {
  openMemoPanel(app);
  await vi.waitFor(() => {
    expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy();
  });
  // 「移到选中日期」动作在 buildCardActions 时读取 M.calSelected——先置选中日再重渲，
  // 右键菜单的动作列表才会带上该项
  if (calSelectedOffset !== undefined) {
    M.calSelected = at(calSelectedOffset, '09:00').slice(0, 10);
    M.renderFn?.();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy();
    });
  }
  const card = document.querySelector('.bz-memo-card[data-memo-id="a"]') as HTMLElement;
  card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
  await vi.waitFor(() => {
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
  mocks.openFlowDialog.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  closeMemoPanel();
  document.body.innerHTML = '';
});

describe('memo 写路径失败分支（T4 表驱动）', () => {
  it.each(CASES)('$label：数据层拒绝 → 错误通知「保存失败（$what）」且不崩', async (c) => {
    const { vault, app } = seedVault(c.item);
    const { events, stop } = onDomainEventGuard();
    try {
      await openPanelWithMenu(app, c.calSelectedOffset);
      // 数据层目标方法拒绝（动作链走到 catch → notifySaveError）
      vi.spyOn(MemoData, c.fail).mockRejectedValue(new Error('磁盘已满'));
      clearNotices();

      const hit = menuItems().find((b) => b.querySelector('.bz-item-menu-label')?.textContent === c.label);
      expect(hit, `菜单项「${c.label}」应存在`).toBeTruthy();
      (hit as HTMLElement).click();

      // 人话错误通知（动作名逐字对齐 ui.ts 各 catch 的 what 参数）
      await vi.waitFor(() => {
        expect(hasNotice(new RegExp(`保存失败（${c.what}）`))).toBe(true);
      });
      // 不崩：面板仍在、旁观条目未丢；除「删除」（本就改全表）外被操作条目也还在盘上
      expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      if (c.fail !== 'deleteItem') {
        expect(raw.find((r: any) => r.id === 'a')).toBeTruthy();
      }
      expect(raw.find((r: any) => r.id === 'b')).toBeTruthy();
      // 写失败分支不发域事件（发射点全在 try 内成功路径）
      await new Promise((r) => setTimeout(r, 100));
      expect(events).toHaveLength(0);
    } finally {
      stop();
    }
  });
});

/** memo 通道事件观察（域事件静默断言用） */
function onDomainEventGuard() {
  const events: any[] = [];
  const stop = onDomainEvent('memo', (evt) => events.push(evt));
  return { events, stop };
}
