/**
 * bz app 补测：被动捕获入口改道（memo→todo 接管迁移第 3 项提前实施）。
 * 启动自动弹出与 file-open 提醒的弹窗触发已自 memo 域移除（落点=待办面板，
 * 见 src/todo/reminder.ts 与 tests/todo/capture.test.ts）——本文件断言 memo 侧旧弹窗
 * 不再出现，并保留 unload 清理回归。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { App } from '../../src/memo/app';
import { UIManager } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  cinemaFolderPath: '我的/影视',
};

function makeApp(vault: MockVault) {
  const handlers: Record<string, Function[]> = {};
  const workspace = {
    on: vi.fn((ev: string, cb: any) => {
      (handlers[ev] ||= []).push(cb);
      return { ref: ev + '-' + handlers[ev].length };
    }),
    offref: vi.fn(),
    getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
    getActiveFile: () => null,
    emit: (ev: string, ...args: any[]) => {
      for (const cb of handlers[ev] || []) cb(...args);
    },
  };
  return { vault, workspace, metadataCache: { getFileCache: () => null }, commands: { removeCommand: vi.fn() } };
}

function pendingItem(extra: any = {}) {
  return {
    id: 't1', title: '待办', scene: '剪藏', priority: 'minor', created: '2025-01-01 10:00:00',
    completed: null, due: null, notePath: null, notePosition: null, url: null, scriptName: null, courseName: null, coursePath: null,
    ...extra,
  };
}

let vault: MockVault;
let app: any;

async function initApp(settings: any = SETTINGS, items: any[] = []) {
  vault = new MockVault();
  if (items.length) vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  app = makeApp(vault);
  setApp(app as any);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await App.init(settings);
  return app;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  try {
    App.unload();
  } catch (e) { /* ignore */ }
  vi.useRealTimers();
});

describe('file-open 提醒改道（memo 侧不再弹窗）', () => {
  it('打开有关联重要条目的笔记 → 不注册监听、不弹备忘录旧面板', async () => {
    await initApp(SETTINGS, [pendingItem({ priority: 'important', notePath: 'A.md' })]);
    expect(app.workspace.on).not.toHaveBeenCalled(); // file-open 提醒监听已迁出本域
    app.workspace.emit('file-open', { path: 'A.md' });
    await new Promise((r) => setTimeout(r, 20));
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).not.toBe('block');
    expect(App.state.remindedFiles.has('A.md')).toBe(false);
  });

  it('file 为空 → 无副作用', async () => {
    await initApp(SETTINGS, [pendingItem({ priority: 'important', notePath: 'A.md' })]);
    expect(() => app.workspace.emit('file-open', null)).not.toThrow();
  });
});

describe('autoPopupOnStart 改道（memo 侧不再弹窗）', () => {
  it('开关开启且存在重要条目 → 不再自动弹备忘录面板（落点=待办面板，todo/reminder.ts）', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await initApp({ ...SETTINGS, autoPopupOnStart: true }, [pendingItem({ priority: 'important' })]);
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).not.toBe('block');
  });
});

describe('unload 清理', () => {
  it('移除注入 DOM 与同源同步监听', async () => {
    await initApp(SETTINGS, []);
    UIManager.showMain(null, false); // 面板在屏 → unload 应清 DOM
    App.unload();
    expect(document.getElementById('todo-mask')).toBeNull();
    expect(document.getElementById('add-todo-mask')).toBeNull();
    expect(vault.listeners['modify']?.length ?? 0).toBe(0); // vault modify 同源同步退订
  });
});

describe('设置开关（第 9 轮设置扩展）', () => {
  it('memoShowArchivedByDefault=true → 面板初始显示归档', async () => {
    await initApp({ ...SETTINGS, memoShowArchivedByDefault: true }, []);
    expect(App.state.showArchived).toBe(true);
  });
});
