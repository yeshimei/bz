/**
 * 番茄钟弹窗 UI 测试（ticket 28）：渲染/交互/单例/后台继续/恢复落盘
 * fake timers（含 Date）：tick 轮询与倒计时时间推进可控。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro, ensurePomodoro } from '../../src/pomodoro';
import { mountPomodoroStatusBar } from '../../src/pomodoro/statusbar';
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

function makeAudioMock(): { createOscillator: ReturnType<typeof vi.fn> } {
  class FakeOscillator {
    type = '';
    frequency = { value: 0 };
    connect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }
  class FakeGain {
    gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    connect = vi.fn();
  }
  const createOscillator = vi.fn(() => new FakeOscillator());
  (window as any).AudioContext = class {
    currentTime = 0;
    destination = {};
    createOscillator = createOscillator;
    createGain = vi.fn(() => new FakeGain());
    close = vi.fn(() => Promise.resolve());
  };
  return { createOscillator };
}

describe('ensurePomodoro（插件启动恢复）', () => {
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

  function runningData() {
    return JSON.stringify({
      version: 1,
      state: { phase: 'focus', endTime: T0 + 120_000, remaining: 0, paused: false, cycleFocusCount: 1 },
      history: [],
    });
  }

  it('默认（后台继续）：弹恢复通知，不弹窗，tick 启动，状态栏同步', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPomodoroStatusBar(container, app);
    await ensurePomodoro(app);
    expect(document.getElementById('pomodoro-mask')).toBeNull(); // 不自动弹窗
    // 恢复继续 → 弹通知（阶段 + 剩余时间）
    const n = document.querySelector('.bz-notice');
    expect(n).not.toBeNull();
    expect(n!.textContent).toContain('专注');
    expect(n!.textContent).toContain('还剩 02:00');
    const textSpan = container.querySelector('.pomodoro-statusbar-text') as HTMLElement;
    expect(textSpan.textContent).toBe('02:00');
    await vi.advanceTimersByTimeAsync(2000);
    expect(textSpan.textContent).toBe('01:58'); // 后台继续走
  });

  it('restoreMode=popup：正在倒计时 → 自动弹窗 + 恢复通知', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ pomodoroRestoreMode: 'popup' } as any));
    await ensurePomodoro(app);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull();
    expect(el('pomodoro-phase').textContent).toContain('专注');
    expect(document.querySelector('.bz-notice')).not.toBeNull(); // 弹窗模式也弹通知
  });

  it('restoreMode=popup 但未在倒计时 → 不弹窗', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ pomodoroRestoreMode: 'popup' } as any));
    await ensurePomodoro(app);
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    expect(document.querySelector('.bz-notice')).toBeNull(); // 无倒计时 → 不弹通知
  });

  it('幂等：重复调用不重复加载', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    await ensurePomodoro(app);
    expect(document.getElementById('pomodoro-mask')).toBeNull();
  });

  it('后台自动暂停：hidden → 主番茄钟冻结（paused/endTime null），visible → 自动恢复（ticket 62）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    // 运行中（endTime 非空）→ 模拟窗口最小化 hidden
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    const frozen = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(frozen.state.paused).toBe(true);
    expect(frozen.state.endTime).toBeNull();
    expect(frozen.state.remaining).toBeGreaterThan(0);
    expect(frozen.state.pausedBy).toBe('autopause'); // 冻结来源标记随落盘持久化（P1-4）
    // 恢复 visible → 自动继续
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    const resumed = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(resumed.state.paused).toBe(false);
    expect(resumed.state.endTime).not.toBeNull();
  });

  it('后台自动暂停开关关闭 → hidden 不冻结（ticket 62）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ pomodoroAutoPauseOnHide: false } as any));
    await ensurePomodoro(app);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(false);
    expect(raw.state.endTime).not.toBeNull();
  });

  it('手动暂停后 hidden → 不被自动覆盖，visible → 不自动恢复（ticket 62 尊重手动暂停）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await openPomodoro(app);
    // 手动暂停（点开始按钮 → 暂停）
    (document.getElementById('pomodoro-btn-start') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);
    let raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(true);
    // hidden + visible：手动暂停保持
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(true);
    expect(raw.state.endTime).toBeNull(); // 保持暂停
  });
});


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
    expect(el('pomodoro-mask').style.zIndex).toBe('9998'); // 域主弹窗层级：低于设置页/设置弹窗
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

  it('开始/暂停：toast + 提示音（手动操作也有声音）', async () => {
    const { app } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 开始
    expect(hasNotice('专注开始')).toBe(true);
    expect(audio.createOscillator).toHaveBeenCalledTimes(1);
    expect(audio.createOscillator.mock.results[0].value.frequency.value).toBe(880); // 专注开始
    await vi.advanceTimersByTimeAsync(2000);
    el('pomodoro-btn-start').click(); // 暂停
    expect(hasNotice('已暂停专注')).toBe(true);
    expect(audio.createOscillator).toHaveBeenCalledTimes(2);
    expect(audio.createOscillator.mock.results[1].value.frequency.value).toBe(440); // 暂停
    el('pomodoro-btn-start').click(); // 继续
    expect(hasNotice('专注开始')).toBe(true); // 继续也算开始
    expect(audio.createOscillator.mock.results[2].value.frequency.value).toBe(880);
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

  it('并发打开：初始化窗口内二次调用复用同一 Promise，不产生双遮罩（P2）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({}) as any);
    // 延迟 vault.read 拉开初始化窗口：首个 openPomodoro 卡在 load 时第二个进入
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    (vault as any).read = async (f: any) => {
      await gate;
      return vault.files.get(f.path) ?? '';
    };
    const p1 = openPomodoro(app);
    const p2 = openPomodoro(app);
    release();
    await Promise.all([p1, p2]);
    expect(document.querySelectorAll('#pomodoro-mask').length).toBe(1);
    expect(document.querySelectorAll('#pomodoro-popup').length).toBe(1);
  });

  it('P1-4：冻结态落盘 → 重启恢复后继续按钮可用且能继续（forceFocus 对 autopause 来源放行）', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 1200, paused: true, cycleFocusCount: 1, pausedBy: 'autopause' },
        history: [],
      })
    );
    const { app, vault: v } = setup(vault, { pomodoroForceFocus: true });
    await openPomodoro(app);
    const startBtn = el('pomodoro-btn-start') as HTMLButtonElement;
    expect(startBtn.textContent).toContain('继续');
    expect(startBtn.disabled).toBe(false); // 冻结来源放行开始/继续
    // 重置/跳过仍维持锁定（仅放行开始/继续）
    expect((el('pomodoro-btn-reset') as HTMLButtonElement).disabled).toBe(true);
    expect((el('pomodoro-btn-skip') as HTMLButtonElement).disabled).toBe(true);
    // 点击继续 → 恢复倒计时并重新锁定
    startBtn.click();
    expect(startBtn.textContent).toContain('暂停');
    expect(startBtn.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(el('pomodoro-time').textContent).toBe('19:58');
    const raw = JSON.parse(v.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(false);
    expect(raw.state.endTime).not.toBeNull();
    expect(raw.state.pausedBy).toBeUndefined(); // 标记随 resume 清除
  });

  it('P1-4：手动暂停态（无来源标记）重启后仍锁定', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 1200, paused: true, cycleFocusCount: 1 },
        history: [],
      })
    );
    const { app } = setup(vault, { pomodoroForceFocus: true });
    await openPomodoro(app);
    const startBtn = el('pomodoro-btn-start') as HTMLButtonElement;
    expect(startBtn.textContent).toContain('继续');
    expect(startBtn.disabled).toBe(true); // 手动暂停维持 forceFocus 锁定
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

  it('tick 完成专注 → 流转短休息 + 历史落盘 + toast + 短休开始声（523Hz）', async () => {
    const { app, vault } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 手动开始：专注开始声（880Hz）
    const before = audio.createOscillator.mock.calls.length;
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 走完一个专注
    expect(el('pomodoro-phase').textContent).toContain('短休息');
    expect(el('pomodoro-time').textContent).toBe('05:00');
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect(raw.history[0].duration).toBe(25 * 60);
    expect(raw.state.phase).toBe('short-break');
    expect(hasNotice('专注完成：休息 5 分钟')).toBe(true);
    expect(document.querySelector('.bz-notice--success')).not.toBeNull();
    expect(audio.createOscillator.mock.calls.length - before).toBe(1);
    expect(audio.createOscillator.mock.results[before].value.frequency.value).toBe(523); // 短休开始
  });

  it('休息完成 → toast + 专注开始声（880Hz 一声）', async () => {
    const { app } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成（短休开始 523Hz）
    el('pomodoro-btn-start').click(); // 开始短休
    const before = audio.createOscillator.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // 休息完成
    expect(hasNotice('休息结束：开始专注')).toBe(true);
    expect(audio.createOscillator.mock.calls.length - before).toBe(1);
    expect(audio.createOscillator.mock.results[before].value.frequency.value).toBe(880); // 专注开始
  });

  it('skip：不通知不响（仅自然完成发 toast）', async () => {
    const { app } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 开始有专注开始声（正常）
    const before = audio.createOscillator.mock.calls.length;
    el('pomodoro-btn-skip').click();
    expect(hasNotice('专注完成')).toBe(false);
    expect(audio.createOscillator.mock.calls.length - before).toBe(0); // skip 本身不响
  });

  it('第 4 个专注完成 → 长休开始声（392Hz）', async () => {
    const { app } = setup(new MockVault(), { pomodoroAutoCycle: true });
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 手动开始：专注开始声
    // 完整走完 4 个专注 + 3 个短休（115min），第 4 个专注完成 → 长休
    await vi.advanceTimersByTimeAsync(4 * 25 * 60 * 1000 + 3 * 5 * 60 * 1000);
    expect(el('pomodoro-phase').textContent).toContain('长休息');
    const calls = audio.createOscillator.mock.calls.length;
    expect(calls).toBe(8); // 手动专注开始 1 + 专注开始 3 次（休息完成）+ 短休开始 3 次 + 长休开始 1 次
    expect(audio.createOscillator.mock.results[calls - 1].value.frequency.value).toBe(392); // 长休开始
  });

  it('声音开关关闭：完成时不响（toast 仍发）', async () => {
    const { app } = setup(new MockVault(), { pomodoroSound: false });
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(hasNotice('专注完成：休息 5 分钟')).toBe(true);
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });

  it('unloadPomodoro：清理轮询无残留', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 手动开始：触发提示音（其 close 定时器随播完自动过期）
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(3500); // 走完提示音 close 定时器 + toast 3s 自动消失
    unloadPomodoro();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById('pomodoro-mask')).toBeNull();
  });

  it('弹窗内展示今日计数与近 7 天柱条，完成专注后刷新', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-today').textContent).toContain('今日 0 个');
    expect(document.querySelectorAll('.pomodoro-stat-day').length).toBe(7);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 完成一个专注
    expect(el('pomodoro-today').textContent).toContain('今日 1 个');
    const bars = Array.from(document.querySelectorAll('.pomodoro-stat-bar')).map((b) => (b as HTMLElement).style.height);
    expect(bars[6]).toBe('40px'); // 今天最高
  });

  it('关闭重开历史不丢（数据来自 pomodoro.json）', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [
          { ts: T0 - 3_600_000, duration: 1500 },
          { ts: T0 - 7_200_000, duration: 1500 },
        ],
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    expect(el('pomodoro-today').textContent).toContain('今日 2 个');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await openPomodoro(app);
    expect(el('pomodoro-today').textContent).toContain('今日 2 个');
  });

  it('点击遮罩关闭弹窗（计时后台继续，重开剩余正确）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(2000); // 24:58
    el('pomodoro-mask').click();
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    await vi.advanceTimersByTimeAsync(3000); // 后台继续
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('24:55');
  });

  it('点击弹窗内部不关闭', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-popup').click();
    expect(document.getElementById('pomodoro-mask')).not.toBeNull();
  });

  it('恢复运行中状态（未超时）→ tick 自动启动继续倒计时', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('01:40');
    await vi.advanceTimersByTimeAsync(2000);
    expect(el('pomodoro-time').textContent).toBe('01:38'); // 倒计时继续走
  });

  it('设置按钮默认隐藏，hover 弹窗显示', async () => {
    const { app } = setup();
    await openPomodoro(app);
    const btn = el('pomodoro-btn-settings');
    expect(btn.classList.contains('pomodoro-settings-hidden')).toBe(true);
    const popup = el('pomodoro-popup');
    popup.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(btn.classList.contains('pomodoro-settings-hidden')).toBe(false);
    popup.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(btn.classList.contains('pomodoro-settings-hidden')).toBe(true);
  });

  it('恢复：数据文件运行中超时 → 回空闲（ticket 62 不补算，不再流转补历史）', async () => {
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
    expect(el('pomodoro-phase').textContent).toContain('🍅 番茄钟'); // 回空闲
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(0); // 不补算历史
    expect(raw.state.phase).toBe('idle');
    expect(raw.state.endTime).toBeNull();
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

  it('ensurePomodoro：暂停态恢复 → 保持暂停，不弹恢复通知', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: null, remaining: 1200, paused: true, cycleFocusCount: 0 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    expect(document.querySelector('.bz-notice')).toBeNull(); // 暂停态不弹通知
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(true);
    expect(raw.state.remaining).toBe(1200); // 暂停保留
  });
});
