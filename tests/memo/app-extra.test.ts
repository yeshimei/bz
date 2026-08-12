/**
 * bz app 补测（单文件 80% 目标）：file-open 提醒、focus 剪贴板监听、
 * autoPopupOnStart、clipboardFocusHandler 分支、unload 清理。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { App } from '../../src/memo/app';
import { UIManager } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import moment from 'moment';

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  platformMapping: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
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
  App.lastClipboardUrl = null;
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

describe('focus 剪贴板监听', () => {
  it('focus 事件 + 剪贴板含平台 URL → 延迟打开添加弹窗', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await initApp(SETTINGS, []);
    const readSpy = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('https://www.zhihu.com/question/123456');
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    const mask = document.getElementById('add-todo-mask') as HTMLElement;
    expect(mask.style.display).toBe('block');
    expect(App.lastClipboardUrl).toBe('https://www.zhihu.com/question/123456');
    readSpy.mockRestore();
  });

  it('clipboardFocusHandler：添加弹窗已打开时提前返回', async () => {
    await initApp(SETTINGS, []);
    UIManager.showAddDialog(null);
    const readSpy = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('https://www.zhihu.com/question/999');
    await App.clipboardFocusHandler();
    readSpy.mockRestore();
    expect(App.lastClipboardUrl).toBeNull();
  });

  it('clipboardFocusHandler：无平台匹配的 URL 不处理', async () => {
    await initApp(SETTINGS, []);
    const readSpy = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('https://unknown-site.example.com/foo');
    await App.clipboardFocusHandler();
    readSpy.mockRestore();
    expect(App.lastClipboardUrl).toBeNull();
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
    expect(App.focusRegistered).toBe(true);
    // jsdom addEventListener 返回 undefined，手动补齐 _focusRef 触发 focus 清理分支
    (App as any)._focusRef = { ref: 'focus-stub' };
    App.unload();
    expect(App.fileOpenRegistered).toBe(false);
    expect(App.focusRegistered).toBe(false);
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

  it('clipboardMonitor=false → 不注册 focus 剪贴板监听', async () => {
    await initApp({ ...SETTINGS, clipboardMonitor: false }, []);
    expect(App.focusRegistered).toBe(false);
  });

  it('memoShowArchivedByDefault=true → 面板初始显示归档', async () => {
    await initApp({ ...SETTINGS, memoShowArchivedByDefault: true }, []);
    expect(App.state.showArchived).toBe(true);
  });
});

describe('到期通知轮询', () => {
  it('checkDueNotify：到期/逾期待办 Notice 提醒，同状态仅提醒一次', async () => {
    await initApp(
      { ...SETTINGS, memoDueNotify: true },
      [pendingItem({ id: 'd1', title: '过期任务', due: '2020-01-01 10:00:00' })]
    );
    App.checkDueNotify();
    expect(hasNotice('已过期：过期任务')).toBe(true);
    clearNotices();
    App.checkDueNotify();
    expect(hasNotice(/已过期/)).toBe(false);
  });

  it('checkDueNotify：今日到期 → warning 提醒；未来/无 due 不提醒', async () => {
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD 10:00:00');
    const today = moment().add(2, 'hour').format('YYYY-MM-DD HH:mm:00');
    await initApp(
      { ...SETTINGS, memoDueNotify: true },
      [
        pendingItem({ id: 'a', title: '今日任务', due: today }),
        pendingItem({ id: 'b', title: '未来任务', due: tomorrow }),
        pendingItem({ id: 'c', title: '无截止', due: null }),
      ]
    );
    App.checkDueNotify();
    expect(hasNotice(/今日到期：今日任务/)).toBe(true);
    expect(hasNotice(/未来任务/)).toBe(false);
    expect(hasNotice(/无截止/)).toBe(false);
  });

  it('memoDueNotify=false → 不启动轮询', async () => {
    await initApp({ ...SETTINGS, memoDueNotify: false }, [pendingItem({ due: '2020-01-01 10:00:00' })]);
    expect(App.dueNotifyTimer).toBeNull();
  });

  it('间隔定时触发 checkDueNotify（interval 秒数生效，最小 10s）', async () => {
    vi.useFakeTimers();
    await initApp(
      { ...SETTINGS, memoDueNotify: true, memoDueCheckInterval: '1' },
      [pendingItem({ id: 'x', title: '轮询任务', due: '2020-01-01 10:00:00' })]
    );
    expect(App.dueNotifyTimer).not.toBeNull();
    await vi.advanceTimersByTimeAsync(10000);
    expect(hasNotice(/已过期：轮询任务/)).toBe(true);
  });

  it('unload 清理轮询定时器', async () => {
    await initApp(SETTINGS, []);
    expect(App.dueNotifyTimer).not.toBeNull();
    App.unload();
    expect(App.dueNotifyTimer).toBeNull();
  });
});
