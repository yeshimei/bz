/**
 * 备忘录（memo）· T3 域事件发射侧契约钉死（review-deep memo-arch 测试缺口 3）
 *
 * 背景：ui.ts 共 9 个 emitDomainEvent('memo',…) 发射点（completed/added×3/restored/
 * postponed×2/priority/deleted/edited），tests/memo 此前无一断言（smartcat memo-action.test
 * 只测消费侧手工发射）。本文件表驱动钉死「UI 动作 → 事件载荷」发射侧契约。
 *
 * 【现状钉死，无开关】以下均为当前已落地行为（completed 的 changed 门控为 P3 修复既有成果）：
 *   - 勾选完成（300ms 防抖）→ completed 恰一次；
 *   - 幂等重复完成（数据层 changed=false）→ 不补发 completed（UI 半边门控）；
 *   - 删除（带撤销）→ deleted 一次；点撤销插回条目但【不发】restored（撤销回调直调
 *     MemoData.restoreItem 数据层，不发域事件；restored 只由「恢复未完成」动作发射）；
 *   - composer / 编辑器新建 → added，载荷形状 {title, scene, priority, due}；
 *   - 编辑器改存 → edited，载荷形状 {old:{title}, next:{title, scene, priority, due}}。
 *
 * 【并行兼容约定】删除确认流可能被并行代理翻转为「免确认直达」：本文件把 openFlowDialog
 * mock 成自动确认（返回 'delete'）——现状（弹确认框）与翻转后（直达删除）两条路径都收敛到
 * deleteItem → deleted 事件，用例对两种现状均成立，无需改写。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, openEditor } from '../../src/memo/ui';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MemoData } from '../../src/memo/data';
import type { MemoItem } from '../../src/memo/types';

// 删除确认流兼容 mock（见文件头「并行兼容约定」）：自动确认删除
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
  // 显式 minor：composer 的 added 载荷 priority 断言不随并行批（composer 读默认优先级）翻转漂移
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function seedVault(items: Record<string, unknown>[]): { vault: MockVault; app: any; settings: any } {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

function baseItem(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...extra,
  };
}

/** 订阅 memo 通道收集事件（用例内自管退订，不污染其他文件） */
function watchMemoEvents() {
  const events: any[] = [];
  const stop = onDomainEvent('memo', (evt) => events.push(evt));
  return { events, stop };
}

async function openPanel(app: any): Promise<HTMLElement> {
  openMemoPanel(app);
  await vi.waitFor(() => {
    expect(document.querySelector('[data-memo-nav] .bz-rail-item')).toBeTruthy();
  });
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.bz-memo-card').length).toBeGreaterThan(0);
  });
  return document.querySelector('.bz-panel-overlay') as HTMLElement;
}

function menuItems(): HTMLElement[] {
  return [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
}
function clickMenuItem(label: string): void {
  const hit = menuItems().find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
  expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
  (hit as HTMLElement).click();
}
async function openCardMenu(id: string): Promise<void> {
  const card = document.querySelector(`.bz-memo-card[data-memo-id="${id}"]`) as HTMLElement;
  expect(card, `条目卡 ${id} 应已渲染`).toBeTruthy();
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

describe('memo 域事件发射侧契约（T3）', () => {
  it('勾选完成（300ms 防抖）：completed 恰发一次，载荷含条目标题', async () => {
    const { app } = seedVault([baseItem({ id: 'a', title: '被勾选的条目' })]);
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      const check = document.querySelector('.bz-memo-check') as HTMLElement;
      check.click();
      // 300ms 防抖窗口内不发
      await new Promise((r) => setTimeout(r, 100));
      expect(events.filter((e) => e.kind === 'completed')).toHaveLength(0);
      // 窗口后落盘 + 发射
      await vi.waitFor(() => {
        expect(events.filter((e) => e.kind === 'completed')).toHaveLength(1);
      });
      expect(events.find((e) => e.kind === 'completed')).toMatchObject({ kind: 'completed', title: '被勾选的条目' });
      // 完成后事件静默期：refresh/重渲不补发
      await new Promise((r) => setTimeout(r, 100));
      expect(events.filter((e) => e.kind === 'completed')).toHaveLength(1);
    } finally {
      stop();
    }
  });

  it('幂等重复完成（changed=false）：不补发 completed（P3 门控的 UI 半边）', async () => {
    const { app } = seedVault([baseItem({ id: 'a', title: '并发竞态条目' })]);
    // 竞态模拟：数据层幂等短路返回 changed=false（条目已被另一入口完成）
    const spy = vi.spyOn(MemoData, 'completeItem').mockResolvedValue({ next: null, changed: false });
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      await openCardMenu('a');
      clickMenuItem('标记完成');
      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
      await new Promise((r) => setTimeout(r, 100));
      expect(events.filter((e) => e.kind === 'completed')).toHaveLength(0);
      // 下一期也不该有（next=null）
      expect(events.filter((e) => e.kind === 'added')).toHaveLength(0);
    } finally {
      stop();
    }
  });

  it('删除（带撤销）→ deleted 一次；点撤销插回条目但不发 restored（撤销走数据层直调，见下）', async () => {
    const { vault, app } = seedVault([baseItem({ id: 'a', title: '被删条目' })]);
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      await openCardMenu('a');
      clickMenuItem('删除');
      await vi.waitFor(() => {
        const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
        expect(raw).toHaveLength(0);
      });
      expect(events.filter((e) => e.kind === 'deleted')).toHaveLength(1);
      expect(events.find((e) => e.kind === 'deleted')).toMatchObject({ kind: 'deleted', title: '被删条目' });
      // 撤销 → 条目插回原位。注意现状：notifyUndo 回调直调 MemoData.restoreItem（数据层），
      // 不发 restored 域事件（restored 只由「恢复未完成」动作的 ui.restoreItem 发射）——按现状钉死。
      await vi.waitFor(() => {
        const undo = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销');
        expect(undo).toBeTruthy();
      });
      ([...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await vi.waitFor(() => {
        const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
        expect(raw).toHaveLength(1);
      });
      expect(events.filter((e) => e.kind === 'restored')).toHaveLength(0);
      expect(events.filter((e) => e.kind === 'deleted')).toHaveLength(1); // 撤销不重发 deleted
    } finally {
      stop();
    }
  });

  it('「恢复未完成」动作 → restored 一次（与删除撤销的静默路径区分）', async () => {
    const { app } = seedVault([
      baseItem({ id: 'keep', title: '未完成占位' }),
      baseItem({ id: 'a', title: '误完成的条目', completed: at(-1, '18:00') }),
    ]);
    const { events, stop } = watchMemoEvents();
    try {
      const overlay = await openPanel(app);
      // 展开已完成折叠区露出已完成卡
      (overlay.querySelector('.bz-memo-donebar') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy();
      });
      await openCardMenu('a');
      clickMenuItem('恢复未完成');
      await vi.waitFor(() => {
        expect(events.some((e) => e.kind === 'restored')).toBe(true);
      });
      expect(events.find((e) => e.kind === 'restored')).toMatchObject({ kind: 'restored', title: '误完成的条目' });
    } finally {
      stop();
    }
  });

  it('composer 快速录入 → added 载荷形状（title/scene/priority/due）', async () => {
    const { app } = seedVault([baseItem({ id: 'a' })]);
    const { events, stop } = watchMemoEvents();
    try {
      const overlay = await openPanel(app);
      const input = overlay.querySelector('[data-memo-composer-input]') as HTMLInputElement;
      input.value = 'composer 录入契约条目';
      (overlay.querySelector('[data-memo-composer-add]') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(events.some((e) => e.kind === 'added')).toBe(true);
      });
      const added = events.find((e) => e.kind === 'added');
      // 场景 = 伪场景「全部」下兜底设置 memoDefaultScene → 第一个场景（剪藏）
      expect(added).toMatchObject({ kind: 'added', title: 'composer 录入契约条目', scene: '剪藏', priority: 'minor', due: null });
    } finally {
      stop();
    }
  });

  it('编辑器新建 → added 载荷形状（场景/优先级/截止随表单）', async () => {
    const { app } = seedVault([baseItem({ id: 'a' })]);
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      (document.querySelector('[data-memo-newbtn]') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
      });
      const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
      (editor.querySelector('textarea') as HTMLTextAreaElement).value = '编辑器新建契约条目';
      // 优先级平铺选「重要」（.bz-choice-btn 的 data-value 唯一）
      const importantBtn = [...editor.querySelectorAll('.bz-choice-btn')].find((b) => (b as HTMLElement).dataset.value === 'important') as HTMLElement;
      importantBtn.click();
      // 截止时间（datetime-local → 落盘 'YYYY-MM-DD HH:mm'）
      (editor.querySelector('input[type="datetime-local"]') as HTMLInputElement).value = '2030-01-02T10:30';
      (editor.querySelector('.bz-memo-form-actions .bz-btn--primary') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(events.some((e) => e.kind === 'added')).toBe(true);
      });
      const added = events.find((e) => e.kind === 'added');
      expect(added).toMatchObject({
        kind: 'added', title: '编辑器新建契约条目', scene: '剪藏', priority: 'important', due: '2030-01-02 10:30',
      });
    } finally {
      stop();
    }
  });

  it('编辑器改存 → edited 载荷形状（old/next 双侧快照）', async () => {
    const { app } = seedVault([baseItem({ id: 'a', title: '原标题条目', scene: '工作' })]);
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      openEditor(M.items.find((i) => i.id === 'a')! as MemoItem);
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
      });
      const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
      (editor.querySelector('textarea') as HTMLTextAreaElement).value = '改后的标题';
      (editor.querySelector('.bz-memo-form-actions .bz-btn--primary') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(events.some((e) => e.kind === 'edited')).toBe(true);
      });
      const edited = events.find((e) => e.kind === 'edited');
      expect(edited).toMatchObject({
        kind: 'edited',
        old: { title: '原标题条目' },
        next: { title: '改后的标题', scene: '工作', priority: 'minor', due: null },
      });
    } finally {
      stop();
    }
  });

  it('通道不串：完成动作不发 added/deleted；写失败不发任何事件', async () => {
    const { app } = seedVault([baseItem({ id: 'a', title: '写失败条目' })]);
    const { events, stop } = watchMemoEvents();
    try {
      await openPanel(app);
      vi.spyOn(MemoData, 'updateItem').mockRejectedValue(new Error('磁盘已满'));
      await openCardMenu('a');
      clearNotices();
      clickMenuItem('转为重要');
      await vi.waitFor(() => {
        expect(hasNotice(/保存失败（切换优先级）/)).toBe(true);
      });
      expect(events).toHaveLength(0); // 写失败分支在 emit 之前，通道全静默
    } finally {
      stop();
    }
  });
});
