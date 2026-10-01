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

/**
 * 本文件不再单独放宽 testTimeout（2026-10-01 校正）。
 * 番茄钟 onTick 每秒整屏 render 一次（src/pomodoro/ui.ts），jsdom 里约 10ms/次——「推进 50 分钟
 * 假时钟」= 3000 次 render ≈ 30s 真墙钟。原注释断言「推进量本身是被测语义（minutes 跟随配置），
 * 不能靠缩短推进量省时间」，那是把「验数字 25/50」误当成「验跟随配置」了：**「minutes 跟随配置」
 * 只需「值取自 durations().workMin、不是硬编码」，用几个不同的短时长即可证明**；而「默认配置是
 * 25」由 settings/config 层覆盖，不必在这里推满 25 分钟。故两个用例改压到 1 / 2 分钟。
 */

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
  it('tick 自然完成专注 → 发 focus-done 事件，minutes 取 durations().workMin', async () => {
    const { app } = setup({ pomodoroWorkMin: '1' }); // 只为触发「自然完成」；minutes 语义与具体分钟数无关
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(pomodoroSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60 * 1000); // 专注自然完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    expect(pomodoroSpy).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 1 });
  });

  it('自定义工作时长完成 → minutes 跟随当前配置（durations().workMin）', async () => {
    // 与上一条用不同的值（2 ≠ 1）即证明「不是硬编码」；「默认 25」由 settings/config 层覆盖
    const { app } = setup({ pomodoroWorkMin: '2' });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-time').textContent).toBe('02:00');
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    expect(pomodoroSpy).toHaveBeenCalledWith({ kind: 'focus-done', minutes: 2 });
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
    const { app } = setup({ pomodoroWorkMin: '1', pomodoroShortBreakMin: '1' });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(60 * 1000); // 专注完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1);
    el('pomodoro-btn-start').click(); // 开始短休
    await vi.advanceTimersByTimeAsync(60 * 1000); // 休息自然完成
    expect(pomodoroSpy).toHaveBeenCalledTimes(1); // 休息完成不叠加
  });
});
