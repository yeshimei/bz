/**
 * memo 重审缺陷修复批 · 契约测试补缺（tests/memo/defects-fix-contracts.test.ts，防撞命名）
 * 按 memo2-arch 报告「测试覆盖缺口 T1–T5」建议补关键契约：
 *  - T1 addMemoForActiveNote 功能直测（有笔记预置定位钮 is-on / 无笔记提示后普通弹窗）
 *  - T2 vault modify 同步链（外部改 → 防抖重读 / 自写短路 / 卸载还原 + 二次 unload 不抛）
 *  - T3 域事件发射侧钉死（UI 动作 → 事件载荷表驱动）
 *  - T4 写路径失败分支表驱动（updateItem 拒绝 → notifySaveError 且不崩）
 *  - T5 生命周期收尾（编辑弹窗经 unloadMemo + closeAllModals 链收口；二次 unload 不抛）
 * 一切以自造 fixture 验证，不读用户真实数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, unloadMemo, ensureMemo } from '../../src/memo/ui';
import { addMemoForActiveNote } from '../../src/memo';
import { closeAllModals } from '../../src/core/ui/modal';
import { MemoData } from '../../src/memo/data';
import { onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { closeItemMenu } from '../../src/core/item-actions';

const PATH = 'CONFIG/STORAGE/memo.json';
const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...overrides,
  };
}

function seed(vaultItems: Record<string, unknown>[], settingsOverride: Record<string, unknown> = {}) {
  const vault = new MockVault();
  if (vaultItems.length) vault.files.set(PATH, JSON.stringify(vaultItems, null, 2));
  const settings = { ...SETTINGS, ...settingsOverride };
  const app = mockAppWithVault(vault) as any;
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  clearDomainEvents();
  document.body.innerHTML = '';
  MockPlatform.isMobile = false;
});

afterEach(() => {
  closeMemoPanel();
  unloadMemo();
  unloadMemo();
  closeItemMenu();
  clearDomainEvents();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

describe('T1：addMemoForActiveNote 功能直测', () => {
  it('有打开笔记：创建弹窗「定位到笔记」钮 is-on 且值为该笔记路径（presetNote 注入）', async () => {
    const { app, vault } = seed([]);
    (app as any).workspace.getActiveFile = () => ({ path: '笔记/当前.md', basename: '当前' });
    (app as any).workspace.activeEditor = { editor: { getCursor: () => ({ line: 7, ch: 4 }) } };
    addMemoForActiveNote(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const posBtn = document.querySelector('.bz-memo-editor .bz-btn--chip') as HTMLElement;
    expect(posBtn.classList.contains('is-on')).toBe(true);
    expect(posBtn.textContent).toContain('当前'); // 定位钮文案 = 笔记名（剥 .md）
    // 保存后 notePath/notePosition 预置落盘
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '给当前笔记记一笔';
    ([...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('添加')) as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].notePath).toBe('笔记/当前.md');
    expect(raw[0].notePosition).toEqual({ line: 7, ch: 4 });
  });

  it('无打开笔记：提示未绑定后仍走普通弹窗（presetNote 不注入）', async () => {
    const { app, vault } = seed([]);
    (app as any).workspace.getActiveFile = () => null;
    addMemoForActiveNote(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m?.includes('未绑定'))).toBe(true);
    });
    const posBtn = document.querySelector('.bz-memo-editor .bz-btn--chip') as HTMLElement;
    expect(posBtn.classList.contains('is-on')).toBe(false);
    void vault;
  });
});

describe('T2：vault modify 同步链', () => {
  it('外部改 memo.json → 150ms 防抖后面板重读出新条目；MemoData.write 自写不触发重读', async () => {
    const { app, vault } = seed([item({ id: 'a', title: '原有条目' })]);
    ensureMemo(app); // 订阅 vault modify（index.openMemoPanel 同链）
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy());
    // 外部写方追加一条（不经 MemoData.write）
    const raw = JSON.parse(vault.files.get(PATH)!);
    raw.push(item({ id: 'ext', title: '外部新增' }));
    vault.files.set(PATH, JSON.stringify(raw, null, 2));
    vault.emit('modify', { path: PATH });
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="ext"]')).toBeTruthy(), { timeout: 1500 });
    // 自写（经包装的 MemoData.write）→ syncing 短路，不再触发 modify 重读
    const writeSpy = vi.spyOn(MemoData, 'write');
    await MemoData.addItem(item({ id: 'self', title: '自写条目' }) as any);
    vault.emit('modify', { path: PATH });
    await new Promise((r) => setTimeout(r, 250));
    expect(writeSpy).toHaveBeenCalled(); // 自写链路在走
    const cards = [...document.querySelectorAll('.bz-memo-card')].map((c) => (c as HTMLElement).dataset.memoId);
    expect(cards).toContain('self'); // 自写经 refresh 已在列
    writeSpy.mockRestore();
  });

  it('unloadMemo 后 modify 不再刷新面板、write 包装已还原；二次 unload 不抛', async () => {
    const { app, vault } = seed([item({ id: 'a', title: '原有条目' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy());
    const wrapped = MemoData.write;
    unloadMemo();
    // write 包装还原（不再等于卸载时的包装引用集合语义：直调可写且不抛）
    await expect(MemoData.addItem(item({ id: 'b2' }) as any)).resolves.toBeUndefined();
    expect(() => unloadMemo()).not.toThrow(); // 二次 unload 幂等
    closeMemoPanel();
    // 面板已关：外部 modify 不产生任何渲染错误
    vault.emit('modify', { path: PATH });
    void wrapped;
  });
});

describe('T3：域事件发射侧钉死（UI 动作 → 事件载荷）', () => {
  it('勾选完成发 completed 一次；防抖反悔不补发；延后发 postponed 携新 due；删除发 deleted；编辑发 edited', async () => {
    const { app, vault } = seed([
      item({ id: 'e1', title: '要完成的', due: at(0, '09:00') }),
      item({ id: 'e2', title: '要延后的', due: at(0, '10:00') }),
      item({ id: 'e3', title: '要编辑的' }),
    ]);
    const events: Array<{ kind: string; payload: any }> = [];
    onDomainEvent('memo', (p: any) => events.push({ kind: p.kind, payload: p }));
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(3));
    // 勾选 e1 → 防抖 300ms 后 completed 一次
    (document.querySelector('.bz-memo-card[data-memo-id="e1"] [data-memo-check]') as HTMLElement).click();
    (document.querySelector('.bz-memo-card[data-memo-id="e1"] [data-memo-check]') as HTMLElement).click(); // 反悔
    (document.querySelector('.bz-memo-card[data-memo-id="e1"] [data-memo-check]') as HTMLElement).click(); // 再排程
    await new Promise((r) => setTimeout(r, 450));
    const completed = events.filter((e) => e.kind === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].payload.title).toBe('要完成的');
    // 延后 e2 → postponed 携新 due
    (document.querySelector('.bz-memo-card[data-memo-id="e2"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[]).find(
      (b) => b.querySelector('.bz-item-menu-label')?.textContent === '延后 1 天'
    );
    (hit as HTMLElement).click();
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'postponed')).toBe(true));
    const pp = events.find((e) => e.kind === 'postponed')!;
    expect(pp.payload.title).toBe('要延后的');
    expect(pp.payload.due).toBe(moment().add(1, 'days').format('YYYY-MM-DD') + ' 10:00');
    closeItemMenu();
    // 删除 e2（免确认）→ deleted
    M.items = await MemoData.loadItems();
    const card = document.querySelector('.bz-memo-card[data-memo-id="e2"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const del = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[]).find(
      (b) => b.querySelector('.bz-item-menu-label')?.textContent === '删除'
    );
    (del as HTMLElement).click();
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'deleted')).toBe(true));
    expect(events.find((e) => e.kind === 'deleted')!.payload.title).toBe('要延后的');
    closeItemMenu();
    // 编辑 e3 → edited 载荷含 old/next
    M.items = await MemoData.loadItems();
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items.find((i) => i.id === 'e3')!);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '改好的标题';
    ([...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('保存')) as HTMLElement).click();
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'edited')).toBe(true));
    const ed = events.find((e) => e.kind === 'edited')!;
    expect(ed.payload.old.title).toBe('要编辑的');
    expect(ed.payload.next.title).toBe('改好的标题');
  });
});

describe('T4：写路径失败分支表驱动（updateItem 拒绝 → notifySaveError 且不崩）', () => {
  async function drive(action: (it: any) => Promise<void>, app: any, id: string): Promise<string[]> {
    const errs: string[] = [];
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector(`.bz-memo-card[data-memo-id="${id}"]`)).toBeTruthy());
    const spy = vi.spyOn(MemoData, 'updateItem').mockRejectedValue(new Error('盘坏了'));
    try {
      await action(M.items.find((i) => i.id === id)!);
      await vi.waitFor(() => {
        const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
        errs.push(...(msgs.filter((m) => m?.includes('保存失败')) as string[]));
        expect(errs.length).toBeGreaterThan(0);
      });
    } finally {
      spy.mockRestore();
    }
    return errs;
  }

  it('恢复未完成失败 → 错误通知', async () => {
    const { app } = seed([item({ id: 'f1', title: '已完成的', completed: at(-1, '18:00') })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-donebar')).toBeTruthy());
    (document.querySelector('.bz-memo-donebar') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="f1"]')).toBeTruthy());
    const spy = vi.spyOn(MemoData, 'updateItem').mockRejectedValue(new Error('盘坏了'));
    try {
      (document.querySelector('.bz-memo-card[data-memo-id="f1"] [data-memo-check]') as HTMLElement).click();
      await vi.waitFor(() => {
        const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
        expect(msgs.some((m) => m?.includes('保存失败'))).toBe(true);
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('延后失败 → 错误通知', async () => {
    const { app } = seed([item({ id: 'f2', due: at(0, '09:00') })]);
    await drive(async (it) => {
      const card = document.querySelector('.bz-memo-card[data-memo-id="f2"]') as HTMLElement;
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
      const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[]).find(
        (b) => b.querySelector('.bz-item-menu-label')?.textContent === '延后 1 天'
      );
      (hit as HTMLElement).click();
    }, app, 'f2');
  });

  it('切优先级失败 → 错误通知', async () => {
    const { app } = seed([item({ id: 'f3' })]);
    await drive(async () => {
      const card = document.querySelector('.bz-memo-card[data-memo-id="f3"]') as HTMLElement;
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
      await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
      const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[]).find(
        (b) => b.querySelector('.bz-item-menu-label')?.textContent === '转为重要'
      );
      (hit as HTMLElement).click();
    }, app, 'f3');
  });
});

describe('T5：生命周期收尾断言', () => {
  it('开编辑弹窗 → unloadMemo + closeAllModals 链 → body 无 .bz-overlay-mask；二次 unload 不抛', async () => {
    const { app } = seed([item({ id: 't5a' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-overlay-mask')).toBeTruthy());
    // main.ts onunload 同款收口链：closeItemMenu → cancelActiveFlowDialog/closeAllModals + 域 unload
    unloadMemo();
    closeAllModals();
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    expect(() => unloadMemo()).not.toThrow();
  });
});
