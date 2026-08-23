/**
 * 番茄钟专注完成观察挂点（ticket 080 方法监听）：applyAction 在专注自然完成（tick 驱动、
 * historyEntry 存在）→ notifyPomodoroAction({kind:'focus-done', minutes: durations().workMin})；
 * start/pause/reset/skip/休息完成一律不通知（skip 无 historyEntry 天然排除）。
 * smartcat 模块整体 mock（对齐方法监听测试范式——只验证挂点调用契约，不初始化真实小橘）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { notifyPomodoroAction } from '../../src/smartcat/index';

vi.mock('../../src/smartcat/index', () => ({
  notifyPomodoroAction: vi.fn(),
}));

const T0 = new Date('2026-08-10T10:00:00').getTime();

function setup(settings: any = {}) {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app };
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp(null as any);
  setSettingsProvider(() => ({} as any));
  unloadPomodoro();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0));
  vi.mocked(notifyPomodoroAction).mockClear();
});

afterEach(() => {
  unloadPomodoro();
  vi.useRealTimers();
});

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

describe('番茄钟专注完成观察挂点（smartcat 方法监听，ticket 080）', () => {
  it('tick 自然完成专注 → notifyPomodoroAction focus-done，minutes = 默认 25', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(vi.mocked(notifyPomodoroAction)).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注自然完成
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 25 });
  });

  it('自定义工作时长（50 分钟）完成 → minutes 跟随当前配置（durations().workMin）', async () => {
    const { app } = setup({ pomodoroWorkMin: '50' });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-time').textContent).toBe('50:00');
    await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 50 });
  });

  it('start → 不通知', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(vi.mocked(notifyPomodoroAction)).not.toHaveBeenCalled();
  });

  it('pause → 不通知', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-start').click(); // 暂停
    expect(vi.mocked(notifyPomodoroAction)).not.toHaveBeenCalled();
  });

  it('reset → 不通知', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-reset').click();
    expect(vi.mocked(notifyPomodoroAction)).not.toHaveBeenCalled();
  });

  it('skip → 不通知（无 historyEntry 天然排除）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-skip').click();
    expect(vi.mocked(notifyPomodoroAction)).not.toHaveBeenCalled();
  });

  it('休息自然完成 → 只收专注完成的 1 次（historyEntry 仅 focus 产生）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledTimes(1);
    el('pomodoro-btn-start').click(); // 开始短休
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // 休息自然完成
    expect(vi.mocked(notifyPomodoroAction)).toHaveBeenCalledTimes(1); // 休息完成不叠加
  });
});