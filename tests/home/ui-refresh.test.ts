/**
 * 内容首页（home 域）运行中统计时效测试：overlay 存续期间 30s 轻量 interval
 * 重拉快照重绘；closeOverlay / unloadHome 清理计时器；重开不叠加计时器。
 * （UI 层：fake timers + 快照模块 spy；vi.mock 仅本文件生效）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resetHomeState } from '../../src/home/state';
import { openHome, unloadHome } from '../../src/home/index';
import { closeOverlay } from '../../src/home/ui';

const collectCalls: number[] = [];

vi.mock('../../src/home/snapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/home/snapshot')>();
  return {
    ...actual,
    collectHomeSnapshot: vi.fn(async () => {
      collectCalls.push(collectCalls.length + 1);
      return { byDomain: {}, ok: true };
    }),
  };
});

describe('home 快照轻刷新（30s interval）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: ['diary'] }));
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetHomeState();
    document.body.innerHTML = '';
    clearNotices();
    collectCalls.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    unloadHome();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('打开即拉一次快照，此后每 30s 自动重拉', async () => {
    openHome(mockAppWithVault(vault) as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(collectCalls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(collectCalls.length).toBe(2);
    await vi.advanceTimersByTimeAsync(30000);
    expect(collectCalls.length).toBe(3);
  });

  it('closeOverlay 清理计时器：关闭后不再重拉', async () => {
    const app = mockAppWithVault(vault) as any;
    openHome(app);
    await vi.advanceTimersByTimeAsync(0);
    expect(collectCalls.length).toBe(1);
    closeOverlay();
    await vi.advanceTimersByTimeAsync(90000);
    expect(collectCalls.length).toBe(1);
  });

  it('重开不叠加计时器（任意时刻只有一个活跃 interval）', async () => {
    const app = mockAppWithVault(vault) as any;
    openHome(app);
    await vi.advanceTimersByTimeAsync(0);
    closeOverlay();
    openHome(app);
    await vi.advanceTimersByTimeAsync(0);
    expect(collectCalls.length).toBe(2); // 每次 open 各拉一次
    await vi.advanceTimersByTimeAsync(30000);
    expect(collectCalls.length).toBe(3); // 只推进一格 = 单一 interval
    // 5 分钟持续运行也线性增长（无叠加放大）
    await vi.advanceTimersByTimeAsync(300000);
    expect(collectCalls.length).toBe(3 + 10);
  });

  it('unloadHome 清理计时器（卸载不走 closeOverlay）', async () => {
    openHome(mockAppWithVault(vault) as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(collectCalls.length).toBe(1);
    unloadHome();
    await vi.advanceTimersByTimeAsync(60000);
    expect(collectCalls.length).toBe(1);
  });
});
