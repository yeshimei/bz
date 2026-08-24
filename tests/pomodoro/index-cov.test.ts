/**
 * 番茄钟域入口测试（src/pomodoro/index.ts）：
 * 命令回调与生命周期经官方 barrel 入口触达——ensureXxx 幂等初始化、openPomodoro 复用已加载数据、
 * unloadPomodoro 清理后可重新初始化。与 ui.test.ts 互补：这里全部经 '../../src/pomodoro' 导入。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
// 域入口 barrel（非 ./ui 直连）：验证公开导出面可用且行为正确
import { ensurePomodoro, openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { getPomodoroFilePath } from '../../src/pomodoro/data';
import { mountPomodoroStatusBar } from '../../src/pomodoro/statusbar';

const T0 = new Date('2026-08-10T10:00:00').getTime();

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 运行中数据：专注阶段还剩 2 分钟 */
function runningData() {
  return JSON.stringify({
    version: 1,
    state: { phase: 'focus', endTime: T0 + 120_000, remaining: 0, paused: false, cycleFocusCount: 1 },
    history: [],
  });
}

describe('番茄钟域入口（src/pomodoro）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    unloadPomodoro();
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({}) as any);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });

  afterEach(() => {
    unloadPomodoro();
    clearNotices();
    vi.useRealTimers();
  });

  it('ensurePomodoro 幂等初始化：空闲态重复调用不弹通知、不建 DOM', async () => {
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    await ensurePomodoro(app); // 第二次 loaded=true 直接跳过
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    expect(document.querySelector('.bz-notice')).toBeNull();
  });

  it('ensurePomodoro 运行中恢复：后台继续 tick + 弹恢复通知；重入不重复加载', async () => {
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPomodoroStatusBar(container, app);

    await ensurePomodoro(app);
    expect(document.querySelector('.bz-notice')).not.toBeNull(); // 恢复通知
    // 幂等：loaded 后再次调用不再走 initData（不重复弹通知）
    await ensurePomodoro(app);
    expect(document.querySelectorAll('.bz-notice').length).toBe(1);

    // 后台 tick 继续走（无弹窗时状态栏持续刷新）
    const textSpan = container.querySelector('.pomodoro-statusbar-text') as HTMLElement;
    await vi.advanceTimersByTimeAsync(2000);
    expect(textSpan.textContent).toBe('01:58');
  });

  it('openPomodoro 在 ensure 之后调用：数据已加载不重复 init，DOM 单例', async () => {
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    await openPomodoro(app); // 已加载 → 只 buildDOM
    expect(document.querySelectorAll('#pomodoro-mask').length).toBe(1);
    expect(document.getElementById('pomodoro-time')!.textContent).toBe('02:00'); // 从内存状态渲染
    await openPomodoro(app); // 已存在 → 仅确保显示
    expect(document.querySelectorAll('#pomodoro-mask').length).toBe(1);
  });

  it('unloadPomodoro 清理后可重新初始化：DOM 移除、状态复位、再开正常', async () => {
    const app = makeApp(vault);
    setApp(app);
    await openPomodoro(app);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull();

    unloadPomodoro();
    expect(document.getElementById('pomodoro-mask')).toBeNull();

    // 清理后重新走完整初始化路径
    await openPomodoro(app);
    expect(document.getElementById('pomodoro-phase')!.textContent).toContain('番茄钟'); // 回空闲初始态
    expect(document.getElementById('pomodoro-time')!.textContent).toBe('25:00');
  });
});
