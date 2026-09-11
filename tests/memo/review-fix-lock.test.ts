/**
 * 锁家族修复批回归（review-all-bugs.md 三节 E 系 memo UI 侧）：
 * E7 file-open 提醒监听器卸载后真正摘除（自持 app，不依赖 M.appRef）、
 * E8 面板重开不再残留旧搜索词、E19 composer 双击防双提交、E20 保存失败保留草稿。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { ensureMemoReminders, unloadMemo } from '../../src/memo';
import { MemoData } from '../../src/memo/data';

const BASE_SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultScene: '',
  autoPopupOnStart: true,
  openNoteReminder: true,
  cinemaFolderPath: '我的/影视',
};

function item(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '剪藏', priority: 'minor', created: moment().format('YYYY-MM-DD HH:mm:ss'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...extra,
  };
}

/** app mock：workspace 支持 on/offref/emit（file-open 捕获流用，照抄 capture.test.ts） */
function makeCaptureApp(vault: MockVault) {
  const app = mockAppWithVault(vault) as any;
  const handlers: Record<string, Function[]> = {};
  app.workspace = {
    ...app.workspace,
    on: (ev: string, cb: any) => {
      (handlers[ev] ||= []).push(cb);
      return { event: ev, cb };
    },
    offref: (ref: any) => {
      if (!ref || !ref.event) return;
      const arr = handlers[ref.event] || [];
      const idx = arr.indexOf(ref.cb);
      if (idx >= 0) arr.splice(idx, 1);
    },
    emit: (ev: string, ...args: any[]) => {
      for (const cb of handlers[ev] || []) cb(...args);
    },
    __handlers: handlers,
  };
  return app;
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
});

afterEach(() => {
  unloadMemo();
  document.body.innerHTML = '';
});

describe('E7：file-open 提醒监听器卸载即摘除', () => {
  it('unloadMemo 后打开带提醒笔记不再自动弹面板（修复前 M.appRef 已空 → offref 短路永不摘除）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      item({ id: 'm1', title: '重要到期', priority: 'important', notePath: '笔记/a.md' }),
    ], null, 2));
    const settings = { ...BASE_SETTINGS };
    const app = makeCaptureApp(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);

    ensureMemoReminders(app);
    unloadMemo(); // uiUnload 先置空 M.appRef，随后 remindersUnload
    expect(M.appRef).toBeNull();

    // 模拟禁用插件后打开带提醒的笔记：监听器已摘除 → 不弹面板
    app.workspace.emit('file-open', { path: '笔记/a.md' });
    await new Promise((r) => setTimeout(r, 60));
    expect(M.overlay).toBeNull();
    expect((app.workspace as any).__handlers['file-open'] ?? []).toHaveLength(0);
  });

  it('卸载后再启用：监听器重新注册且不叠加翻倍', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      item({ id: 'm1', title: '普通', notePath: null }),
    ], null, 2));
    const settings = { ...BASE_SETTINGS, autoPopupOnStart: false };
    const app = makeCaptureApp(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);

    ensureMemoReminders(app);
    expect((app.workspace as any).__handlers['file-open']).toHaveLength(1);
    unloadMemo();
    ensureMemoReminders(app);
    expect((app.workspace as any).__handlers['file-open']).toHaveLength(1); // 修复前：旧监听残留 + 新注册 = 2
    unloadMemo();
  });
});

describe('E8：搜索词跨面板开合不残留', () => {
  it('关闭前搜索过滤，重开面板后列表恢复全量、状态与输入框清空', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      item({ id: 'm1', title: '苹果清单' }),
      item({ id: 'm2', title: '香蕉清单' }),
    ], null, 2));
    const app = makeCaptureApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ ...BASE_SETTINGS }) as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init({ ...BASE_SETTINGS } as any);

    openMemoPanel(app);
    await new Promise((r) => setTimeout(r, 30));
    const input = document.querySelector('[data-memo-search]') as HTMLInputElement;
    input.value = '苹果';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 260)); // 越过 180ms 防抖
    expect(M.search).toBe('苹果');

    closeMemoPanel();
    openMemoPanel(app); // 重开
    await new Promise((r) => setTimeout(r, 30));
    expect(M.search).toBe(''); // 修复前：输入框是空的但列表仍被旧关键词过滤
    const input2 = document.querySelector('[data-memo-search]') as HTMLInputElement;
    expect(input2.value).toBe('');
    // notePath 定位（提醒改道）仍能在重开后正常覆写
    closeMemoPanel();
    openMemoPanel(app, { notePath: '笔记/a.md' });
    await new Promise((r) => setTimeout(r, 30));
    expect(M.search).toBe('笔记/a.md');
  });
});

describe('E19/E20：composer 双提交与草稿保留', () => {
  function seedPanel(app: any, vault: MockVault, settings: any, items: Record<string, unknown>[] = []) {
    if (items.length) vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);
    openMemoPanel(app);
  }

  it('E19：落盘窗口期双击只提交一条（busy 防重入）', async () => {
    const vault = new MockVault();
    const app = makeCaptureApp(vault);
    seedPanel(app, vault, { ...BASE_SETTINGS });
    await new Promise((r) => setTimeout(r, 30));
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '只提交一次';
    const addBtn = document.querySelector('[data-memo-composer-add]') as HTMLElement;
    addBtn.click();
    addBtn.click(); // 第二次落在首次 await 之前（修复前读到相同文本 → 重复条目）
    await new Promise((r) => setTimeout(r, 80));
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(saved.filter((i: any) => i.title === '只提交一次')).toHaveLength(1);
  });

  it('E20：保存失败不清空输入框（草稿保留），成功路径照常清空', async () => {
    const vault = new MockVault();
    const app = makeCaptureApp(vault);
    seedPanel(app, vault, { ...BASE_SETTINGS });
    await new Promise((r) => setTimeout(r, 30));
    const input = document.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '不能丢的草稿';
    const addBtn = document.querySelector('[data-memo-composer-add]') as HTMLElement;

    const spy = vi.spyOn(MemoData, 'addItem').mockRejectedValueOnce(new Error('disk full'));
    addBtn.click();
    await new Promise((r) => setTimeout(r, 80));
    expect(input.value).toBe('不能丢的草稿'); // 修复前：失败仍清空 → 草稿丢失

    spy.mockRestore();
    addBtn.click();
    await new Promise((r) => setTimeout(r, 80));
    expect(input.value).toBe(''); // 成功才清
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(saved.filter((i: any) => i.title === '不能丢的草稿')).toHaveLength(1);
  });
});
