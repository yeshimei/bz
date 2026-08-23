/**
 * 备忘录 checkbox 完成防抖（ticket 084a A1）：真防抖（每次 onChange 清旧 timer 重设）、
 * 取消勾选清 timer 不通知、回调「当前仍勾选」二次校验、连续勾选/勾→取消→勾只通知一次。
 * notify 侧近 300ms 防重（B6，与抽屉「标记完成」互斥）由 smartcat 集成测试覆盖（memo-action.test.ts）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setBzSettingsProvider } from '../../src/memo';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { App } from '../../src/memo/app';
import { UIManager } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { notifyMemoAction } from '../../src/smartcat';

vi.mock('../../src/smartcat', () => ({ notifyMemoAction: vi.fn() }));

const mockedNotify = vi.mocked(notifyMemoAction);

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
};

async function initApp(vault: MockVault) {
  const workspace = {
    on: vi.fn(() => ({ ref: 'file-open-ref' })),
    offref: vi.fn(),
    getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
    getActiveFile: () => null,
  };
  const app: any = { vault, workspace, metadataCache: { getFileCache: () => null }, commands: { removeCommand: vi.fn() } };
  setApp(app);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  await App.init(SETTINGS);
  return app;
}

/** 单条目场景：渲染一张卡片供点击，返回其 checkbox */
async function seedOne(vault: MockVault): Promise<HTMLInputElement> {
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
    { id: '1', title: '待办A', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
  ], null, 2));
  await App.loadData();
  await App.refresh();
  const checkbox = document.querySelector('.todo-card input[type="checkbox"]') as HTMLInputElement;
  expect(checkbox).toBeTruthy();
  return checkbox;
}

describe('checkbox 完成防抖（ticket 084a A1）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useFakeTimers();
    mockedNotify.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('勾选后取消 → 清 timer 不通知、不写盘', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const checkbox = await seedOne(vault);
    checkbox.click(); // 勾选 → 设 300ms timer
    await vi.advanceTimersByTimeAsync(100);
    checkbox.click(); // 取消 → 清 timer（反悔失效修复：不通知）
    await vi.advanceTimersByTimeAsync(400);
    expect(mockedNotify).not.toHaveBeenCalled();
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].completed).toBeNull();
  });

  it('连续勾选只通知一次（勾→取消→勾 → 仅在最后勾选防抖到点后发一条）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const checkbox = await seedOne(vault);
    checkbox.click(); // 勾（T1）
    await vi.advanceTimersByTimeAsync(100);
    checkbox.click(); // 取消（清 T1）
    await vi.advanceTimersByTimeAsync(50);
    checkbox.click(); // 再勾（T2 重设）
    await vi.advanceTimersByTimeAsync(350); // T2 到点 → 仍勾选 → 完成一次
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify).toHaveBeenCalledWith({ kind: 'completed', title: '待办A' });
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('窗口内快速连按（勾→取消→勾→取消→勾）→ 仍只通知一次', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const checkbox = await seedOne(vault);
    checkbox.click();
    checkbox.click();
    checkbox.click();
    checkbox.click();
    checkbox.click(); // 最终勾选态（每个 onChange 清旧 timer 重设）
    await vi.advanceTimersByTimeAsync(350);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});