/**
 * 番茄钟弹窗 UI 测试（ticket 28）：渲染/交互/单例/后台继续/恢复落盘
 * fake timers（含 Date）：tick 轮询与倒计时时间推进可控。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro, ensurePomodoro, startFocusForTask } from '../../src/pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from '../../src/pomodoro/statusbar';
import { getPomodoroFilePath, PomodoroDataManager } from '../../src/pomodoro/data';

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

  it('P3：ensurePomodoro 与 openPomodoro 并发 → 共享初始化 in-flight，只 load 一次', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    const loadSpy = vi.spyOn(PomodoroDataManager.prototype, 'load');
    await Promise.all([ensurePomodoro(app), openPomodoro(app)]);
    expect(loadSpy).toHaveBeenCalledTimes(1); // 原两路各自 initData → 双读盘
    expect(document.getElementById('pomodoro-mask')).not.toBeNull(); // openPomodoro 照常出弹窗
  });

  it('P3：恢复可见但无可解冻状态（未冻结/空闲）→ 仅渲染不落盘', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app); // 运行中、未冻结
    const saveSpy = vi.spyOn(PomodoroDataManager.prototype, 'save');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saveSpy).not.toHaveBeenCalled(); // 无状态变化不写盘（原无条件 save）
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
    // ADR-0067：遮罩 z 动态发号（JS openPomodoro），样式源不再持有静态档
    expect(Number.isFinite(parseInt(el('pomodoro-mask').style.zIndex, 10))).toBe(true);
    const css = readFileSync(resolve(process.cwd(), 'src/pomodoro/styles.css'), 'utf8');
    expect(/#pomodoro-mask\s*\{[^}]*z-index:/.test(css)).toBe(false);
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
    // 增强包：autoCycle 关 → toast 挂「开始休息」动作按钮（点击直达开始）
    const restBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '开始休息');
    expect(restBtn).toBeTruthy();
    expect(audio.createOscillator.mock.calls.length - before).toBe(1);
    expect(audio.createOscillator.mock.results[before].value.frequency.value).toBe(523); // 短休开始
  });

  it('休息完成 → toast 挂「开始专注」动作（autoCycle 关不计时，文案不说「开始专注」）+ 完成提示声', async () => {
    const { app } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成（短休开始 523Hz）
    el('pomodoro-btn-start').click(); // 开始短休
    const before = audio.createOscillator.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // 休息完成
    // 文案按实况：手动流转（autoCycle 关）只报事实，「开始专注」由动作按钮承担
    expect(hasNotice('休息结束：开始专注')).toBe(false);
    expect(hasNotice('休息结束')).toBe(true);
    expect(audio.createOscillator.mock.calls.length - before).toBe(1); // 完成提示声（新阶段预告）
    expect(audio.createOscillator.mock.results[before].value.frequency.value).toBe(880); // 专注开始声
    expect(el('pomodoro-btn-start').textContent).toContain('开始'); // 休息结束未自动计时
    // 动作按钮直达开始专注
    const actionBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '开始专注');
    expect(actionBtn).toBeTruthy();
    (actionBtn as HTMLElement).click();
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 已在计时
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
    expect(el('pomodoro-phase').textContent).toContain('番茄钟'); // 回空闲（增强包：🍅 emoji 已换 lucide timer）
    expect(el('pomodoro-phase').querySelector('.pomodoro-phase-icon')).not.toBeNull(); // 空闲态挂图标
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

describe('增强包：循环圆点 / 时段分布 / 通知动作 / Space / 待办联动', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unmountPomodoroStatusBar(); // 状态栏句柄跨 describe 残留会让 mount 早退
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  it('循环位置圆点行：4 个 6px 方点，完成 1 个专注后点亮 1 个（替代「专注 N/M」文字）', async () => {
    const { app } = setup(new MockVault(), { pomodoroAutoCycle: true });
    await openPomodoro(app);
    const dots = () => [...document.querySelectorAll('.pomodoro-cycle-dot')] as HTMLElement[];
    expect(dots().length).toBe(4);
    expect(dots().every((d) => !d.classList.contains('pomodoro-cycle-dot-on'))).toBe(true);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000 + 500); // 第 1 个完成 → 自动短休
    expect(dots().filter((d) => d.classList.contains('pomodoro-cycle-dot-on')).length).toBe(1);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 25 * 60 * 1000 + 500); // 第 2 个完成
    expect(dots().filter((d) => d.classList.contains('pomodoro-cycle-dot-on')).length).toBe(2);
  });

  it('统计区：今日行带总分钟、7 天柱 title 带「N 个 · M 分钟」、今日 12 槽时段柱按完成时刻点亮', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-today').textContent).toContain('今日 0 个 · 0 分钟');
    expect(document.querySelectorAll('.pomodoro-hour-bar').length).toBe(12);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(el('pomodoro-today').textContent).toContain('今日 1 个 · 25 分钟');
    const dayBars = [...document.querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(dayBars[6].title).toBe('2026-08-10：1 个 · 25 分钟');
    // T0 = 10:00 → [10,12) 槽（第 6 根）点亮
    const hourBars = [...document.querySelectorAll('.pomodoro-hour-bar')] as HTMLElement[];
    expect(hourBars[5].classList.contains('pomodoro-hour-bar-on')).toBe(true);
    expect(hourBars[5].title).toContain('10–12 时');
    expect(hourBars[5].title).toContain('1 个');
    expect(hourBars.filter((b) => b.classList.contains('pomodoro-hour-bar-on')).length).toBe(1);
  });

  it('autoCycle 关：专注完成 toast 挂「开始休息」动作，点击直达开始短休', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    const restBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '开始休息');
    expect(restBtn).toBeTruthy();
    (restBtn as HTMLElement).click();
    expect(el('pomodoro-phase').textContent).toBe('短休息');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 动作按钮已开始计时
  });

  it('autoCycle 开：完成 toast 无动作按钮（下一阶段已自动计时，文案报事实）', async () => {
    const { app } = setup(new MockVault(), { pomodoroAutoCycle: true });
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(hasNotice('专注完成：休息 5 分钟')).toBe(true);
    expect(document.querySelectorAll('.bz-notice-action').length).toBe(0);
  });

  it('Space 快捷键：面板聚焦切换开始/暂停；按钮聚焦走原生激活不双触发', async () => {
    const { app } = setup();
    await openPomodoro(app);
    const popup = el('pomodoro-popup');
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); // 面板焦点 → 开始
    expect(el('pomodoro-btn-start').textContent).toContain('暂停');
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); // 再按 → 暂停
    expect(el('pomodoro-btn-start').textContent).toContain('继续');
    // 事件源是按钮（按钮聚焦）→ 处理器跳过，不双触发
    el('pomodoro-btn-start').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(el('pomodoro-btn-start').textContent).toContain('继续');
    // 非 Space 键不触发
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el('pomodoro-btn-start').textContent).toContain('继续');
  });

  it('startFocusForTask：直接开始归属专注（弹窗任务行 + 状态栏 title 展示；完成落账后收起）', async () => {
    const { app, vault } = setup();
    const container = document.createElement('div');
    container.className = 'status-bar';
    document.body.appendChild(container);
    mountPomodoroStatusBar(container, app);
    await openPomodoro(app);
    expect(el('pomodoro-task').textContent).toBe(''); // 无归属收起
    await startFocusForTask(app, '完成阅读报告');
    expect(el('pomodoro-task').textContent).toBe('完成阅读报告');
    expect(el('pomodoro-task').title).toBe('完成阅读报告');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 已在计时
    const statusEl = container.querySelector('.pomodoro-statusbar') as HTMLElement;
    expect(statusEl.title).toBe('番茄钟：完成阅读报告');
    // 自然完成 → 归属写入历史 + 任务行/状态栏收起
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect(raw.history[0].task).toBe('完成阅读报告');
    expect(raw.state.task).toBeUndefined(); // 落账即清除
    expect(el('pomodoro-task').textContent).toBe('');
    expect(statusEl.title).toBe('番茄钟');
  });

  it('startFocusForTask：已有专注计时中 → 提示不重启，归属维持原任务', async () => {
    const { app } = setup();
    await openPomodoro(app);
    await startFocusForTask(app, '任务 A');
    await startFocusForTask(app, '任务 B');
    expect(hasNotice('已有专注计时中，本次不重复开始')).toBe(true);
    expect(el('pomodoro-task').textContent).toBe('任务 A');
  });

  it('startFocusForTask：休息计时中 → 跳过休息（不记历史）直接开始归属专注', async () => {
    const { app, vault } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成 → 短休未开始
    el('pomodoro-btn-start').click(); // 开始休息
    expect(el('pomodoro-phase').textContent).toBe('短休息');
    await startFocusForTask(app, '给影评加封面');
    expect(el('pomodoro-phase').textContent).toBe('专注');
    expect(el('pomodoro-task').textContent).toBe('给影评加封面');
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1); // 仅此前自然完成的专注记账
    expect(raw.history[0].task).toBeUndefined(); // 无归属完成不带 task 键
    expect(raw.state.task).toBe('给影评加封面'); // 归属在当前专注上
    expect(raw.state.phase).toBe('focus');
  });

  it('样式基线：mask 遮罩走 --background-modifier-cover token；状态栏挂 hover 反馈', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/pomodoro/styles.css'), 'utf8');
    expect(/#pomodoro-mask\s*\{[^}]*--background-modifier-cover/.test(css)).toBe(true);
    expect(/#pomodoro-mask\s*\{[^}]*rgba\(0,0,0,\s*0\.45\)/.test(css)).toBe(false);
    expect(css).toContain('.pomodoro-statusbar:hover');
  });
});
