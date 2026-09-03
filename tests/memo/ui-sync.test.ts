/**
 * memo 面板同源 memo.json 跨域同步（对照 todo T1 写法）：
 *   - todo 面板/后台任务改动 memo.json → 已开 memo 面板防抖（150ms）重读刷新（修复前单向：只有 todo 侧装了监听）
 *   - 自写短路：memo 自己 DataManager.write 引发的 modify 不重复刷新（写路径已自 refresh）
 *   - 面板未开 / 无关路径 modify 不刷新；卸载还原 write 包装
 * 注意：showMain 内部会调 App.refresh()，断言「modify 触发刷新」前须 mockClear 排除打开动作本身。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { App } from '../../src/memo/app';
import { DataManager } from '../../src/memo/data';
import { UIManager } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const MEMO_PATH = 'CONFIG/STORAGE/memo.json';
const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  cinemaFolderPath: '我的/影视',
};

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: {
      on: vi.fn(() => ({ ref: 'file-open-ref' })),
      offref: vi.fn(),
      getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
      getActiveFile: () => null,
    },
    metadataCache: { getFileCache: () => null },
    commands: { removeCommand: vi.fn() },
  };
}

async function initApp(vault: MockVault) {
  const app = makeApp(vault);
  setApp(app as any);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await App.init(SETTINGS);
  return app;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
const container = () => document.getElementById('todo-entries-container') as HTMLElement;

describe('memo 面板 memo.json modify 同步', () => {
  let vault: MockVault;
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
    vault = new MockVault();
  });

  afterEach(() => {
    App.unload(); // 退订 + 还原 DataManager.write 包装
    vi.restoreAllMocks(); // 防 spyOn(App, 'refresh') 跨用例残留污染
    document.body.innerHTML = '';
  });

  it('面板开着时外部改动 memo.json + modify → 防抖重读，新条目出现（todo 侧改动不再单向）', async () => {
    await initApp(vault);
    UIManager.showMain(null, false);
    await tick(20);
    expect(container().querySelectorAll('.todo-card').length).toBe(0);
    // 外部写入（模拟 todo 面板/后台任务落盘）后发 modify
    vault.files.set(MEMO_PATH, JSON.stringify([
      { id: 'x1', title: '来自待办面板的条目', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]));
    vault.emit('modify', { path: MEMO_PATH });
    await tick(250); // 过 150ms 防抖窗口
    expect(container().textContent).toContain('来自待办面板的条目');
  });

  it('自写短路：DataManager.write 进行中的 modify 不触发重读刷新（写路径已自 refresh）', async () => {
    await initApp(vault);
    UIManager.showMain(null, false);
    await tick(20);
    const refreshSpy = vi.spyOn(App, 'refresh');
    const p = DataManager.write([
      { id: 'w1', title: '本域写入', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    vault.emit('modify', { path: MEMO_PATH }); // write 进行中（Obsidian modify 随写盘派发）
    await p;
    await tick(250);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('面板未开：modify 不刷新；无关路径 modify（面板开着）也不刷新', async () => {
    await initApp(vault);
    const refreshSpy = vi.spyOn(App, 'refresh');
    vault.emit('modify', { path: MEMO_PATH });
    await tick(250);
    expect(refreshSpy).not.toHaveBeenCalled();
    // 面板开着，但改的是别的文件（showMain 自身的 refresh 计入 spy，先清零再断言）
    UIManager.showMain(null, false);
    await tick(20);
    refreshSpy.mockClear();
    vault.emit('modify', { path: 'CONFIG/STORAGE/other.json' });
    await tick(250);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('卸载还原：App.unload 后 modify 不再触发刷新，DataManager.write 剥离包装还原原始引用', async () => {
    await initApp(vault);
    const wrapped = DataManager.write; // 打开期间为 syncing 包装版
    App.unload();
    const refreshSpy = vi.spyOn(App, 'refresh');
    vault.emit('modify', { path: MEMO_PATH });
    await tick(250);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(DataManager.write).not.toBe(wrapped); // 包装已剥离（还原为被包装前的原始函数）
    // 重新 init（重开面板域）后恢复订阅能力且 write 被重新包装
    await App.init(SETTINGS);
    expect(DataManager.write).not.toBe(wrapped);
    App.unload();
  });
});
