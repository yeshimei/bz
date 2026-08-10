/**
 * 番茄钟状态栏测试（ticket 29）：🍅 mm:ss / 空闲灰态 / 点击开弹窗 / 卸载无残留
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, setIcon } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from '../../src/pomodoro/statusbar';

const T0 = new Date('2026-08-10T10:00:00').getTime();

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

describe('番茄钟状态栏', () => {
  let container: HTMLElement;

  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
    container = document.createElement('div');
    container.className = 'status-bar';
    document.body.appendChild(container);
  });
  afterEach(() => {
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  it('mount：原生 lucide 图标（timer）+ 空闲灰态', () => {
    const app = makeApp(new MockVault());
    mountPomodoroStatusBar(container, app);
    const el = container.querySelector('.pomodoro-statusbar') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.classList.contains('pomodoro-statusbar-idle')).toBe(true);
    const iconEl = el.querySelector('.pomodoro-statusbar-icon') as HTMLElement;
    expect(iconEl).not.toBeNull();
    expect(iconEl.dataset.icon).toBe('timer'); // setIcon mock 记录
    expect(setIcon).toHaveBeenCalledWith(iconEl, 'timer');
    expect((el.querySelector('.pomodoro-statusbar-text') as HTMLElement).textContent).toBe('');
  });

  it('运行中：mm:ss 每秒刷新（图标常驻）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    mountPomodoroStatusBar(container, app);
    await openPomodoro(app);
    const statusEl = container.querySelector('.pomodoro-statusbar') as HTMLElement;
    const textSpan = statusEl.querySelector('.pomodoro-statusbar-text') as HTMLElement;
    document.getElementById('pomodoro-btn-start')!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(textSpan.textContent).toBe('24:58');
    expect(statusEl.classList.contains('pomodoro-statusbar-idle')).toBe(false);
    expect(statusEl.querySelector('.pomodoro-statusbar-icon')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(textSpan.textContent).toBe('24:57');
  });

  it('暂停：回灰态（文本清空、图标保留）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    mountPomodoroStatusBar(container, app);
    await openPomodoro(app);
    document.getElementById('pomodoro-btn-start')!.click(); // 开始
    document.getElementById('pomodoro-btn-start')!.click(); // 暂停
    const statusEl = container.querySelector('.pomodoro-statusbar') as HTMLElement;
    expect((statusEl.querySelector('.pomodoro-statusbar-text') as HTMLElement).textContent).toBe('');
    expect(statusEl.classList.contains('pomodoro-statusbar-idle')).toBe(true);
    expect(statusEl.querySelector('.pomodoro-statusbar-icon')).not.toBeNull();
  });

  it('点击状态栏打开弹窗（幂等单例）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    mountPomodoroStatusBar(container, app);
    (container.querySelector('.pomodoro-statusbar') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull();
  });

  it('弹窗关闭后状态栏继续刷新', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    mountPomodoroStatusBar(container, app);
    await openPomodoro(app);
    const statusEl = container.querySelector('.pomodoro-statusbar') as HTMLElement;
    const textSpan = statusEl.querySelector('.pomodoro-statusbar-text') as HTMLElement;
    document.getElementById('pomodoro-btn-start')!.click();
    await vi.advanceTimersByTimeAsync(2000); // 24:58
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // 关闭弹窗
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(textSpan.textContent).toBe('24:55');
  });

  it('unmount：状态栏元素移除', () => {
    const app = makeApp(new MockVault());
    mountPomodoroStatusBar(container, app);
    expect(container.querySelector('.pomodoro-statusbar')).not.toBeNull();
    unmountPomodoroStatusBar();
    expect(container.querySelector('.pomodoro-statusbar')).toBeNull();
  });
});
