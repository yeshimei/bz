/**
 * bz app 补测（单文件 80% 目标）：file-open 提醒、autoPopupOnStart、unload 清理。
 * ticket 59：剪贴板监听与到期轮询已删除（到期合并入启动自动弹窗）。
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

describe('file-open 提醒', () => {
  it('匹配重要未完成任务 → 打开面板并标记提醒；重复打开跳过', async () => {
    await initApp(SETTINGS, [pendingItem({ priority: 'important', notePath: 'A.md' })]);
    app.workspace.emit('file-open', { path: 'A.md' });
    await new Promise((r) => setTimeout(r, 20));
    expect(App.state.remindedFiles.has('A.md')).toBe(true);
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).toBe('block');
    app.workspace.emit('file-open', { path: 'A.md' });
    await new Promise((r) => setTimeout(r, 10));
    expect(App.state.remindedFiles.has('A.md')).toBe(true);
  });

  it('file 为空 → 直接返回；非重要任务不提醒', async () => {
    await initApp(SETTINGS, [pendingItem({ priority: 'minor', notePath: 'B.md' })]);
    app.workspace.emit('file-open', null);
    app.workspace.emit('file-open', { path: 'B.md' });
    await new Promise((r) => setTimeout(r, 20));
    expect(App.state.remindedFiles.has('B.md')).toBe(false);
  });
});

describe('autoPopupOnStart', () => {
  it('开启且有待办重要条目 → 300ms 后自动弹窗', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await initApp({ ...SETTINGS, autoPopupOnStart: true }, [pendingItem({ priority: 'important' })]);
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).toBe('block');
  });

  it('开启但无重要条目 → 不弹窗', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await initApp({ ...SETTINGS, autoPopupOnStart: true }, [pendingItem({ priority: 'minor' })]);
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).not.toBe('block');
  });
});

describe('unload 清理', () => {
  it('移除监听并清理 DOM', async () => {
    await initApp(SETTINGS, []);
    expect(App.fileOpenRegistered).toBe(true);
    App.unload();
    expect(App.fileOpenRegistered).toBe(false);
    expect(document.getElementById('todo-mask')).toBeNull();
    expect(document.getElementById('add-todo-mask')).toBeNull();
    expect(app.workspace.offref).toHaveBeenCalled();
  });
});

describe('设置开关（第 9 轮设置扩展）', () => {
  it('openNoteReminder=false → 不注册 file-open 提醒监听', async () => {
    await initApp({ ...SETTINGS, openNoteReminder: false }, [pendingItem({ priority: 'important', notePath: 'A.md' })]);
    expect(App.fileOpenRegistered).toBe(false);
    // 即使手动触发事件也不弹面板
    app.workspace.emit('file-open', { path: 'A.md' });
    await new Promise((r) => setTimeout(r, 20));
    const mask = document.getElementById('todo-mask') as HTMLElement;
    expect(mask.style.display).not.toBe('block');
  });

  it('memoShowArchivedByDefault=true → 面板初始显示归档', async () => {
    await initApp({ ...SETTINGS, memoShowArchivedByDefault: true }, []);
    expect(App.state.showArchived).toBe(true);
  });
});

