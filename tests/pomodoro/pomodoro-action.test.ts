/**
 * 番茄钟专注完成观察挂点（ticket 080 域事件派发）：applyAction 在专注自然完成（tick 驱动、
 * historyEntry 存在）→ emitDomainEvent('pomodoro', {kind:'focus-done', minutes: durations().workMin})；
 * start/pause/reset/skip/休息完成一律不发事件（skip 无 historyEntry 天然排除）。
 * 观测点换线：真实总线 + onDomainEvent('pomodoro', spy) 挂间谍，断言 spy 收到的载荷
 * （挂点契约不变，只换传输层——UI 不再 import smartcat，无模块 mock）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';

const T0 = new Date('2026-08-10T10:00:00').getTime();

/** 'pomodoro' 通道间谍（真实总线挂点；每用例前清调用记录，afterEach 退订） */
let pomodoroSpy: (evt?: unknown) => void = () => {};
let offSpy: () => void = () => {};

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
  pomodoroSpy = vi.fn((_evt?: unknown) => {});
  offSpy = onDomainEvent('pomodoro', (evt) => pomodoroSpy(evt));
});

afterEach(() => {
  offSpy();
  unloadPomodoro();
  vi.useRealTimers();
});

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

describe('番茄钟专注完成观察挂点（域事件派发，ticket 080）', () => {
  it('tick 自然完成专注 → 发 focus-done 事件，minutes = 默认 25', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(pomodoroSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注自然完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    expect(pomodoroSpy).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 25 });
  });

  it('自定义工作时长（50 分钟）完成 → minutes 跟随当前配置（durations().workMin）', async () => {
    const { app } = setup({ pomodoroWorkMin: '50' });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-time').textContent).toBe('50:00');
    await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    expect(pomodoroSpy).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 50 });
  });

  it('start → 不发事件', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(pomodoroSpy).not.toHaveBeenCalled();
  });

  it('pause → 不发事件', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-start').click(); // 暂停
    expect(pomodoroSpy).not.toHaveBeenCalled();
  });

  it('reset → 不发事件', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-reset').click();
    expect(pomodoroSpy).not.toHaveBeenCalled();
  });

  it('skip → 不发事件（无 historyEntry 天然排除）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-skip').click();
    expect(pomodoroSpy).not.toHaveBeenCalled();
  });

  it('休息自然完成 → 只收专注完成的 1 次（historyEntry 仅 focus 产生）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    el('pomodoro-btn-start').click(); // 开始短休
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // 休息自然完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1); // 休息完成不叠加
  });
});
