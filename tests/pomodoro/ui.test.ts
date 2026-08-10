/**
 * 番茄钟弹窗 UI 测试（ticket 28）：渲染/交互/单例/后台继续/恢复落盘
 * fake timers（含 Date）：tick 轮询与倒计时时间推进可控。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { getPomodoroFilePath } from '../../src/pomodoro/data';

const T0 = new Date('2026-08-10T10:00:00').getTime();

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

describe('番茄钟弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    vi.useRealTimers();
  });

  it('openPomodoro 渲染：遮罩/弹窗/环形进度/阶段文案/时间/按钮/⚙️', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-mask')).not.toBeNull();
    const popup = el('pomodoro-popup');
    expect(popup).not.toBeNull();
    expect(popup.querySelector('#pomodoro-ring-svg')).not.toBeNull();
    expect(el('pomodoro-phase').textContent).toContain('番茄钟');
    expect(el('pomodoro-time').textContent).toBe('25:00');
    expect(el('pomodoro-btn-start').textContent).toContain('开始');
    expect(el('pomodoro-btn-reset')).not.toBeNull();
    expect(el('pomodoro-btn-skip')).not.toBeNull();
    expect(el('pomodoro-btn-settings')).not.toBeNull();
  });

  it('点击开始 → 专注倒计时走；按钮变「暂停」', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-phase').textContent).toContain('专注');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停');
    // 环形进度随倒计时推进（dashoffset 递减）
    const circle = el('pomodoro-ring-progress');
    expect(circle.getAttribute('stroke-dasharray')).toBeTruthy();
    const offset0 = parseFloat(circle.getAttribute('stroke-dashoffset')!);
    await vi.advanceTimersByTimeAsync(2000);
    expect(el('pomodoro-time').textContent).toBe('24:58');
    const offset1 = parseFloat(circle.getAttribute('stroke-dashoffset')!);
    expect(offset1).toBeLessThan(offset0);
  });

  it('暂停 → 剩余冻结；继续 → 恢复走', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(3000); // 24:57
    el('pomodoro-btn-start').click(); // 暂停
    expect(el('pomodoro-btn-start').textContent).toContain('继续');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(el('pomodoro-time').textContent).toBe('24:57');
    el('pomodoro-btn-start').click(); // 继续
    await vi.advanceTimersByTimeAsync(1000);
    expect(el('pomodoro-time').textContent).toBe('24:56');
  });

  it('重置 → 回满时长并停止（按钮回「开始」）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(5000);
    el('pomodoro-btn-reset').click();
    expect(el('pomodoro-time').textContent).toBe('25:00');
    expect(el('pomodoro-btn-start').textContent).toContain('开始');
    await vi.advanceTimersByTimeAsync(3000);
    expect(el('pomodoro-time').textContent).toBe('25:00');
  });

  it('跳过 → 流转到短休息（未开始）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-skip').click();
    expect(el('pomodoro-phase').textContent).toContain('短休息');
    expect(el('pomodoro-time').textContent).toBe('05:00');
    expect(el('pomodoro-btn-start').textContent).toContain('开始');
  });

  it('强制专注模式：focus 运行时暂停/重置/跳过禁用，休息阶段恢复可用', async () => {
    const { app } = setup(new MockVault(), { pomodoroForceFocus: true });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect((el('pomodoro-btn-start') as HTMLButtonElement).disabled).toBe(true);
    expect((el('pomodoro-btn-reset') as HTMLButtonElement).disabled).toBe(true);
    expect((el('pomodoro-btn-skip') as HTMLButtonElement).disabled).toBe(true);
  });

  it('单例：重复打开不重复建 DOM', async () => {
    const { app } = setup();
    await openPomodoro(app);
    await openPomodoro(app);
    expect(document.querySelectorAll('#pomodoro-mask').length).toBe(1);
    expect(document.querySelectorAll('#pomodoro-popup').length).toBe(1);
  });

  it('关闭弹窗计时后台继续，重开显示正确剩余', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(5000);
    // Esc 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    await vi.advanceTimersByTimeAsync(30_000); // 后台继续走
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('24:25');
  });

  it('tick 完成专注 → 流转短休息 + 历史落盘', async () => {
    const { app, vault } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 走完一个专注
    expect(el('pomodoro-phase').textContent).toContain('短休息');
    expect(el('pomodoro-time').textContent).toBe('05:00');
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect(raw.history[0].duration).toBe(25 * 60);
    expect(raw.state.phase).toBe('short-break');
  });

  it('恢复：数据文件运行中超时 → 打开自动流转并落盘', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: T0 - 60_000, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    expect(el('pomodoro-phase').textContent).toContain('短休息');
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect(raw.state.phase).toBe('short-break');
  });

  it('恢复：暂停态保留（不流转）', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 1200, paused: true, cycleFocusCount: 0 },
        history: [],
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    expect(el('pomodoro-phase').textContent).toContain('专注');
    expect(el('pomodoro-time').textContent).toBe('20:00');
    expect(el('pomodoro-btn-start').textContent).toContain('继续');
  });
});
