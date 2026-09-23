import { makeApp } from '../helpers/app';
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
import { openPomodoro, unloadPomodoro, ensurePomodoro, startFocusForTask, toggleFocus, togglePause, isFocusing, menuPhase } from '../../src/pomodoro';
import { mountPomodoroStatusBar, unmountPomodoroStatusBar } from '../../src/pomodoro/statusbar';
import { getPomodoroFilePath, PomodoroDataManager } from '../../src/pomodoro/data';
import { enqueueFileTask } from '../../src/core/storage';
import { FLOW_DIALOG_CANCEL_ID, FLOW_DIALOG_OK_ID } from '../../src/core/flow-dialog';
import { resetPomodoroFixture } from '../helpers/pomodoro-fixture';

const T0 = new Date('2026-08-10T10:00:00').getTime();


function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

function makeAudioMock(): { createOscillator: ReturnType<typeof vi.fn> } {
  class FakeOscillator {
    type = '';
    frequency = { value: 0, exponentialRampToValueAtTime: vi.fn() };
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

  it('窗口 hidden/visible 不干扰计时（后台自动暂停 2026-09-23 退役：不再监听 visibilitychange）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await openPomodoro(app);
    const startBtn = el('pomodoro-btn-start') as HTMLButtonElement;
    expect(startBtn.textContent).toBe('暂停'); // 运行中
    const saveSpy = vi.spyOn(PomodoroDataManager.prototype, 'save');
    // 最小化/遮挡（hidden）：不暂停、不翻按钮、不落盘
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(startBtn.textContent).toBe('暂停');
    // 恢复可见：同样无副作用（旧版此处解冻并写盘）
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saveSpy).not.toHaveBeenCalled();
    // 关键判据：隐藏期间计时照走（旧版冻结在 remaining 不动、时间字也不刷新）
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const before = el('pomodoro-time').textContent;
    await vi.advanceTimersByTimeAsync(3000);
    expect(el('pomodoro-time').textContent).not.toBe(before);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.paused).toBe(false);
    expect(raw.state.endTime).not.toBeNull();
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

  it('openPomodoro 渲染：遮罩/弹窗/环形进度/阶段文案/时间/按钮（⚙ 设置钮已移除）', async () => {
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
    expect(el('pomodoro-btn-settings')).toBeNull(); // ⚙ 已移除（2026-09-11 用户拍板：设置入口归设置面板）
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
    // 2026-09-23 特效批：阶段开始 = 过渡音（低频铺底）+ 落定音，枚数会随批次变化；
    // 不变量是「落定音恒为本批最后创建的那一枚」，故断言取末枚而非硬编码下标
    const lastFreq = () => {
      const r = audio.createOscillator.mock.results;
      return r[r.length - 1].value.frequency.value;
    };
    el('pomodoro-btn-start').click(); // 开始
    expect(hasNotice('专注开始')).toBe(true);
    expect(audio.createOscillator).toHaveBeenCalledTimes(2);
    expect(lastFreq()).toBe(880); // 专注开始（落定）
    await vi.advanceTimersByTimeAsync(2000);
    el('pomodoro-btn-start').click(); // 暂停
    expect(hasNotice('已暂停专注')).toBe(true);
    expect(audio.createOscillator).toHaveBeenCalledTimes(3);
    expect(lastFreq()).toBe(440); // 暂停
    el('pomodoro-btn-start').click(); // 继续
    expect(hasNotice('专注开始')).toBe(true); // 继续也算开始
    expect(lastFreq()).toBe(880); // 继续＝过渡 + 落定
  });

  it('重置（专注中）→ 确认框（issues/144 拍板）确认后回满时长并停止，且落盘（F11 回归锁）', async () => {
    const { app, vault } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(5000);
    // 2026-09-24：不再弹确认框——首点按钮自己变「确认？」
    el('pomodoro-btn-reset').click();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(el('pomodoro-btn-reset').textContent).toBe('确认？');
    expect(el('pomodoro-btn-reset').classList.contains('pomodoro-btn-armed')).toBe(true);
    expect(el('pomodoro-time').textContent).toBe('24:55');
    // 点别处 → 解除待确认，计时继续
    document.getElementById('pomodoro-phase')!.click();
    expect(el('pomodoro-btn-reset').textContent).toBe('重置');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 仍在计时
    // 再次进入确认 → 点按钮自己即执行
    el('pomodoro-btn-reset').click();
    el('pomodoro-btn-reset').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(el('pomodoro-time').textContent).toBe('25:00');
    expect(el('pomodoro-btn-start').textContent).toContain('开始');
    await vi.advanceTimersByTimeAsync(3000);
    expect(el('pomodoro-time').textContent).toBe('25:00');
    // F11 回归锁：重置生效即落盘（endTime 复位 + remaining 回满）——防重启后旧计时复活弹「番茄钟继续」
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.endTime).toBeNull();
    expect(raw.state.remaining).toBe(1500);
  });

  it('跳过 → 流转到短休息（未开始）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    // 2026-09-24：跳过同口径二次确认——首点只变「确认？」
    el('pomodoro-btn-skip').click();
    expect(el('pomodoro-btn-skip').textContent).toBe('确认？');
    expect(el('pomodoro-phase').textContent).toContain('专注'); // 尚未流转
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
    const { app, vault } = setup(new MockVault(), { pomodoroTickSound: false });
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
    // 2026-09-23 特效批：阶段开始 = 过渡音（低频铺底）+ 落定音；本次是「专注完成 → 短休」，
    // 故另有收工钟 4 枚泛音（钟只在专注完成敲）——合计 6 枚，落定音恒为最后创建的那一枚
    const after = audio.createOscillator.mock.calls.length;
    expect(after - before).toBe(6);
    expect(audio.createOscillator.mock.results[after - 1].value.frequency.value).toBe(523); // 短休开始（落定）
  });

  it('休息完成 → toast 挂「开始专注」动作（autoCycle 关不计时，文案不说「开始专注」）+ 完成提示声', async () => {
    const { app } = setup(new MockVault(), { pomodoroTickSound: false });
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
    expect(audio.createOscillator.mock.calls.length - before).toBe(2); // 过渡音 + 完成提示声
    expect(audio.createOscillator.mock.results[audio.createOscillator.mock.calls.length - 1].value.frequency.value).toBe(880); // 专注开始声（落定）
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
    const { app } = setup(new MockVault(), { pomodoroAutoCycle: true, pomodoroTickSound: false });
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 手动开始：专注开始声
    // 完整走完 4 个专注 + 3 个短休（115min），第 4 个专注完成 → 长休
    await vi.advanceTimersByTimeAsync(4 * 25 * 60 * 1000 + 3 * 5 * 60 * 1000);
    expect(el('pomodoro-phase').textContent).toContain('长休息');
    const calls = audio.createOscillator.mock.calls.length;
    // 2026-09-23 特效批后的构成（32 = 手动专注开始 2 + 3×(专注完成 6) + 3×(短休完成 2) + 第 4 次专注完成 6）：
    //   专注完成 6 = 收工钟 4 泛音 + 过渡音 1 + 短休落定 1；其余每次阶段开始 2 = 过渡 + 落定
    expect(calls).toBe(32);
    expect(audio.createOscillator.mock.results[calls - 1].value.frequency.value).toBe(392); // 长休开始（落定）
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

  it('倒数滴答：最后十秒每秒一记（独立开关默认开）', async () => {
    const { app } = setup();
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    const before = audio.createOscillator.mock.calls.length;
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 走完整个专注
    const freqs = audio.createOscillator.mock.results.slice(before).map((r) => r.value.frequency.value);
    expect(freqs.filter((f) => f === 1900)).toHaveLength(10); // 剩 10…1 秒各一记，同一秒不重播
  });

  it('倒数滴答开关关闭：最后十秒静默，提示音不受影响', async () => {
    const { app } = setup(new MockVault(), { pomodoroTickSound: false });
    const audio = makeAudioMock();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    const before = audio.createOscillator.mock.calls.length;
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    const freqs = audio.createOscillator.mock.results.slice(before).map((r) => r.value.frequency.value);
    expect(freqs.filter((f) => f === 1900)).toHaveLength(0);
    expect(freqs.length).toBeGreaterThan(0); // 收工钟/过渡音/落定音照响
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

describe('增强包：循环圆点 / 时段分布 / 通知动作 / Space / 备忘录联动', () => {
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

  it('面板主题 → 弹窗皮肤类：设置给值即换类，同时只挂一套', async () => {
    const { app } = setup(new MockVault(), { pomodoroSkinTheme: 'night' });
    await openPomodoro(app);
    const popup = el('pomodoro-popup');
    expect(popup.classList.contains('pomodoro-skin-night')).toBe(true);
    expect(popup.classList.contains('pomodoro-skin-tomato')).toBe(false);
  });

  it('面板主题未设 / 未知值 → 回落默认皮肤番茄', async () => {
    const { app } = setup(new MockVault(), { pomodoroSkinTheme: 'no-such-skin' });
    await openPomodoro(app);
    expect(el('pomodoro-popup').classList.contains('pomodoro-skin-tomato')).toBe(true);
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

  it('统计区：今日行带总分钟、7 天柱 title 带「N 个 · M 分钟」（时段分布已移除，2026-09-11）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-today').textContent).toContain('今日 0 个 · 0 分钟');
    expect(document.getElementById('pomodoro-hours')).toBeNull(); // 今日时段分布已删（视觉降噪）
    expect(document.querySelectorAll('.pomodoro-hour-bar').length).toBe(0);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(el('pomodoro-today').textContent).toContain('今日 1 个 · 25 分钟');
    const dayBars = [...document.querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(dayBars[6].title).toBe('2026-08-10：1 个 · 25 分钟');
    expect(dayBars[6].textContent).toBe('10'); // 标签缩为「日」（窄面板不折行；T0 = 2026-08-10）
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
    // D3 可靠写契约：save 走 core per-path 串行队列（微任务级异步）——读盘前排进同队列等写完
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1); // 仅此前自然完成的专注记账
    expect(raw.history[0].task).toBeUndefined(); // 无归属完成不带 task 键
    expect(raw.state.task).toBe('给影评加封面'); // 归属在当前专注上
    expect(raw.state.phase).toBe('focus');
  });

  it('样式基线：mask 遮罩收编 .bz-overlay-mask 单源（issue 365）+ padding 归零覆写；状态栏挂 hover 反馈', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/pomodoro/styles.css'), 'utf8');
    // 底色/blur 归 core 单源后，域块仅剩 padding 归零覆写（320px 弹窗窄屏可用区与收编前等价）；
    // 挂类守卫在 tests/core/overlay-glass.test.ts 收编组
    expect(/#pomodoro-mask\.bz-overlay-mask\s*\{[^}]*padding: 0/.test(css)).toBe(true);
    expect(/#pomodoro-mask[^{]*\{[^}]*background/.test(css)).toBe(false); // 域内不得回潮遮罩底
    expect(/#pomodoro-mask[^{]*\{[^}]*rgba\(0,0,0,\s*0\.45\)/.test(css)).toBe(false);
    expect(css).toContain('.pomodoro-statusbar:hover');
  });

  it('样式基线：环形 SVG 显式 overflow:visible——环光的 drop-shadow 绘到框外才不会被硬切（2026-09-23）', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/pomodoro/styles.css'), 'utf8');
    // 环光 = 挂在 #pomodoro-ring-progress 上的 drop-shadow（motion.ts setGlow）。
    // 环实绘外缘 r=56 用户单位、viewBox 半宽 60 → 余量 4 单位；辉光要 ~7 单位 →
    // UA 默认 overflow:hidden 会在元素框上切出一条直边（用户报「光晕被裁切到一个方块中」）。
    // 量化对照（CDP 探针读像素剖面，环心沿 +x）：置 visible 前在 +60.5 单位一步断到背景色，
    // 置 visible 后同一段平滑衰减到 +74 单位。jsdom 无绘制 → 这条只能钉声明。
    expect(/#pomodoro-ring-svg\s*\{[^}]*overflow:\s*visible/.test(css)).toBe(true);
  });
});

/**
 * isFocusing / toggleFocus（2026-09-10）：首页入口菜单的番茄钟文案是**动态**的
 * （专注中显示「停止专注」，否则「开始专注」）——这条只读相位就是它的数据源。
 */
describe('isFocusing（首页入口菜单动态文案的只读相位）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  /** 暂停中的专注（endTime=null → 不走「继续」恢复分支：无通知、无 tick） */
  function pausedFocusData(): string {
    return JSON.stringify({
      version: 1,
      state: { phase: 'focus', endTime: null, remaining: 900, paused: true, cycleFocusCount: 1, task: '周报' },
      history: [],
    });
  }

  it('未加载 / 空闲 → false；载入暂停中的专注 → true 且不弹「继续」通知', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), pausedFocusData());
    const app = makeApp(vault);
    setApp(app);
    expect(isFocusing()).toBe(false); // 尚未加载（内存态 = 初始 idle）
    await ensurePomodoro(app);
    expect(document.querySelector('.bz-notice')).toBeNull();
    expect(isFocusing()).toBe(true);
  });

  it('toggleFocus：专注中 → 停止（false）；再 toggle → 开始（true）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), pausedFocusData());
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    expect(isFocusing()).toBe(true);

    await toggleFocus(app);
    expect(isFocusing()).toBe(false); // 停止专注

    await toggleFocus(app);
    expect(isFocusing()).toBe(true); // 重新开始
  });

  it('休息计时中 → 不算专注；toggle 跳过休息直接开专注', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'short-break', endTime: T0 + 60_000, remaining: 0, paused: false, cycleFocusCount: 1 },
        history: [],
      })
    );
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    expect(isFocusing()).toBe(false);
    await toggleFocus(app);
    expect(isFocusing()).toBe(true);
  });
});

/**
 * menuPhase（2026-09-11）：首页入口菜单的番茄钟项是**相位敏感的单个动作**
 * （见 home/shared.pomodoroMenuAction —— 未开始→开始专注 / 专注中→停止专注 /
 * 暂停中→继续专注 / 休息中→跳过休息）。四相位互斥，故判定必须是这一个函数。
 * 特别钉住那个坑：**reset/停止后 phase 仍是 'focus'**（state.ts::activePhase 语义），
 * 所以 idle 不能按 phase 判，要看 endTime / paused。
 */
describe('menuPhase（首页入口菜单番茄项的相位派发）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  /** 载入一份番茄 state 到 mock vault 并 init（相位由 state 形状决定，不走 UI） */
  async function loadPhase(state: Record<string, unknown>) {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), JSON.stringify({ version: 1, state, history: [] }));
    const app = makeApp(vault);
    setApp(app);
    await ensurePomodoro(app);
    return app;
  }

  it('未加载 → idle（内存态 = 初始空闲）', () => {
    expect(menuPhase()).toBe('idle');
  });

  it('专注计时中 → focusing', async () => {
    await loadPhase({ phase: 'focus', endTime: T0 + 60_000, remaining: 0, paused: false, cycleFocusCount: 1 });
    expect(menuPhase()).toBe('focusing');
  });

  it('暂停中的专注（=「停止专注」之后）→ paused', async () => {
    await loadPhase({ phase: 'focus', endTime: null, remaining: 900, paused: true, cycleFocusCount: 1, task: '周报' });
    expect(menuPhase()).toBe('paused');
  });

  it('短休计时中 / 长休暂停中 → 都算 break（暂停的休息照样能跳过）', async () => {
    await loadPhase({ phase: 'short-break', endTime: T0 + 60_000, remaining: 0, paused: false, cycleFocusCount: 1 });
    expect(menuPhase()).toBe('break');
    unloadPomodoro();
    await loadPhase({ phase: 'long-break', endTime: null, remaining: 300, paused: true, cycleFocusCount: 0 });
    expect(menuPhase()).toBe('break');
  });

  it('停止专注后 phase 仍是 focus 但 endTime=null → 必须回落 idle（否则菜单卡在「继续专注」）', async () => {
    const app = await loadPhase({ phase: 'focus', endTime: null, remaining: 900, paused: true, cycleFocusCount: 1 });
    expect(menuPhase()).toBe('paused');
    await toggleFocus(app); // 停止（= reset：phase 保持 focus，endTime/paused 归零）
    expect(menuPhase()).toBe('idle');
  });
});

/**
 * 统计两档 + 周归档（issue 357）：弹窗统计区「近 7 天明细 / 近 6 月趋势」并列切换；
 * 月趋势 = 归档行 + 当前 7 天明细合成（两源按日不交不重复累计）；
 * 装载/落盘走 trimWithArchive——离开 7 天保留窗的明细按自然周归档进 pomodoro.json 可选段 archived。
 */
describe('统计两档与周归档（issue 357）', () => {
  const DAY = 86_400_000;

  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0)); // T0 = 2026-08-10 周一 10:00
  });
  afterEach(() => {
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  it('打开弹窗：两档 tab 就位，默认近 7 天（周柱可见、月柱隐藏）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-week').textContent).toBe('近 7 天');
    expect(el('pomodoro-stat-tab-month').textContent).toBe('近 6 月');
    expect(el('pomodoro-stat-tab-week').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    expect(el('pomodoro-stat-tab-month').classList.contains('pomodoro-stat-tab-on')).toBe(false);
    expect(el('pomodoro-week').hidden).toBe(false);
    expect(el('pomodoro-months').hidden).toBe(true);
  });

  it('切近 6 月：空数据渲染 6 根月柱（3 月→8 月），切回近 7 天恢复', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-stat-tab-month').click();
    expect(el('pomodoro-stat-tab-month').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    expect(el('pomodoro-week').hidden).toBe(true);
    expect(el('pomodoro-months').hidden).toBe(false);
    const bars = [...el('pomodoro-months').querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(bars).toHaveLength(6);
    expect(bars.map((b) => b.title)).toEqual([
      '2026-03：0 个 · 0 分钟',
      '2026-04：0 个 · 0 分钟',
      '2026-05：0 个 · 0 分钟',
      '2026-06：0 个 · 0 分钟',
      '2026-07：0 个 · 0 分钟',
      '2026-08：0 个 · 0 分钟',
    ]);
    expect(bars[5].textContent).toBe('8月'); // 短签不带年份（窄面板）
    el('pomodoro-stat-tab-week').click();
    expect(el('pomodoro-week').hidden).toBe(false);
    expect(el('pomodoro-months').hidden).toBe(true);
    expect(document.querySelectorAll('#pomodoro-week .pomodoro-stat-day').length).toBe(7); // 周柱原样
  });

  it('月趋势合成：归档行 + 窗内明细按月归集，不重复累计', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [
          { ts: T0 - 3_600_000, duration: 1500 }, // 今天（窗内明细 → 2026-08）
          { ts: T0 - 30 * DAY, duration: 1500 }, // 2026-07-11 周六（窗外 → 装载即归档并入 2026-07-06 周）
        ],
        archived: [{ week: '2026-07-06', count: 2, minutes: 50 }],
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    el('pomodoro-stat-tab-month').click();
    const bars = [...el('pomodoro-months').querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(bars[4].title).toBe('2026-07：3 个 · 75 分钟'); // 既有 2 + 装载归档 1（周 key 判重增量合并）
    expect(bars[5].title).toBe('2026-08：1 个 · 25 分钟'); // 仅窗内明细（窗外已从 history 移除，不重复）
    expect(el('pomodoro-today').textContent).toContain('今日 1 个 · 25 分钟');
  });

  it('装载即裁剪归档落盘；完成专注再 save 不重复累计；无归档时不写 archived 键', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [{ ts: T0 - 30 * DAY, duration: 1500 }], // 2026-07-11 周六，窗外
      })
    );
    const { app, vault: v } = setup(vault);
    await openPomodoro(app); // initData：裁剪 + 归档增量 → 立即固化落盘
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    let raw = JSON.parse(v.files.get(getPomodoroFilePath())!);
    expect(raw.history).toEqual([]); // 窗外明细已裁
    expect(raw.archived).toEqual([{ week: '2026-07-06', count: 1, minutes: 25 }]); // 归档一行
    // 完成一个专注（今天）→ save 再走 trimWithArchive：明细不重复归档
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    raw = JSON.parse(v.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect(raw.archived).toEqual([{ week: '2026-07-06', count: 1, minutes: 25 }]); // 不增账
  });

  it('save：无归档数据时文件不写 archived 键（文件形状与旧版一致）', async () => {
    const { app, vault: v } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    const raw = JSON.parse(v.files.get(getPomodoroFilePath())!);
    expect(raw.history).toHaveLength(1);
    expect('archived' in raw).toBe(false);
  });
});

/**
 * 深审修复批回归（bz-fix-pomo-core）：PF1/PF2/PF3/PF4/PF5/PF6、ui P2-2、PC1、
 * UI P3-2、PA-2、PE2/PE3、issues/144 重置确认框、F12 冻结标记回归锁。
 * 清理走 PA-4 统一夹具（resetPomodoroFixture：unload + unmount + body 清空 + 通知清空）。
 */
describe('深审修复批回归（bz-fix-pomo-core）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    resetPomodoroFixture(); // PA-4：清理三件套 + 通知清空单源夹具（新用例一律走夹具，存量 describe 不强改）
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    vi.restoreAllMocks(); // 本 describe 有 prototype 级 load/save mock（PF5），逐例还原防跨用例泄漏
    unloadPomodoro();
    unmountPomodoroStatusBar();
    vi.useRealTimers();
  });

  /** 运行中数据：专注阶段还剩 2 分钟 */
  function runningData() {
    return JSON.stringify({
      version: 1,
      state: { phase: 'focus', endTime: T0 + 120_000, remaining: 0, paused: false, cycleFocusCount: 1 },
      history: [],
    });
  }

  /** 暂停中的专注（手动暂停：无 pausedBy 标记） */
  function pausedFocusData() {
    return JSON.stringify({
      version: 1,
      state: { phase: 'focus', endTime: null, remaining: 900, paused: true, cycleFocusCount: 1 },
      history: [],
    });
  }

  it('PF1：关闭再打开弹窗，统计柱区必须重建（修复前同键早退 → 柱区空白）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(document.querySelectorAll('.pomodoro-stat-day').length).toBe(7);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    await openPomodoro(app);
    expect(document.querySelectorAll('.pomodoro-stat-day').length).toBe(7); // 修复前重开为 0
  });

  it('PE3：空闲态「跳过」禁用且点击不产生意外短休息态（静默落盘一并消）', async () => {
    const { app, vault } = setup();
    await openPomodoro(app);
    const skipBtn = el('pomodoro-btn-skip') as HTMLButtonElement;
    expect(skipBtn.disabled).toBe(true); // 修复前 idle 可点 → 一键落「短休息待开始」且 phase-completed 落盘
    skipBtn.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(el('pomodoro-phase').textContent).toContain('番茄钟'); // 仍空闲
    await enqueueFileTask(getPomodoroFilePath(), async () => undefined);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.state.phase).not.toBe('short-break'); // 意外态未落盘
    // 开始后恢复可用（跳的是当前阶段）
    el('pomodoro-btn-start').click();
    expect(skipBtn.disabled).toBe(false);
  });

  it('PF2：forceFocus 下命令链暂停被拦 → warning 提示不再静默（togglePause）', async () => {
    const { app } = setup(new MockVault(), { pomodoroForceFocus: true });
    await openPomodoro(app);
    el('pomodoro-btn-start').click(); // 专注计时中（按钮 disabled 有视觉反馈）
    await togglePause(app);
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 状态未变（仍在计时）
    expect(hasNotice('强制专注模式中，请先在番茄钟面板操作')).toBe(true); // 修复前零提示哑动作
  });

  it('PF2：forceFocus 拦截提示三出口同文案（PC3 单源模板）', async () => {
    // toggleFocus 停止分支：与 togglePause / startFocusForTask 同引 forceFocusHint 单源
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), pausedFocusData());
    const { app } = setup(vault, { pomodoroForceFocus: true });
    await openPomodoro(app);
    await toggleFocus(app);
    expect(hasNotice('强制专注模式中，请先在番茄钟面板操作')).toBe(true);
    expect(el('pomodoro-btn-start').textContent).toContain('继续'); // 未被重置
  });

  it('PF3：休息阶段手动暂停 → toast「已暂停休息」（修复前恒「已暂停专注」）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000); // 专注完成 → 短休息待开始
    el('pomodoro-btn-start').click(); // 开始休息
    el('pomodoro-btn-start').click(); // 暂停休息
    expect(hasNotice('已暂停休息')).toBe(true);
    expect(hasNotice('已暂停专注')).toBe(false);
  });

  it('PF3：专注阶段暂停文案不变（ui.test:300 相位核对：原用例即专注相位，断言无需翻转）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(2000);
    el('pomodoro-btn-start').click();
    expect(hasNotice('已暂停专注')).toBe(true);
  });

  it('PF4：暂停中的专注上「专注这个」→ 提示不重启不改归属（定稿口径 a）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    await startFocusForTask(app, '任务 A');
    await vi.advanceTimersByTimeAsync(3000);
    el('pomodoro-btn-start').click(); // 手动暂停（剩 24:57）
    await startFocusForTask(app, '任务 B');
    expect(hasNotice('已有专注暂停中，本次不重复开始')).toBe(true);
    expect(el('pomodoro-task').textContent).toBe('任务 A'); // 归属未被悄悄改写
    expect(el('pomodoro-btn-start').textContent).toContain('继续'); // 旧会话未被静默续跑
  });

  it('PF4：forceFocus 手动暂停 + 「专注这个」→ 拦截提示出口指向面板（PC3 单源 paused 变体）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), pausedFocusData());
    const { app } = setup(vault, { pomodoroForceFocus: true });
    await openPomodoro(app);
    await startFocusForTask(app, '任务 B');
    expect(hasNotice('强制专注模式暂停中，请先在番茄钟面板操作')).toBe(true);
    expect(el('pomodoro-btn-start').textContent).toContain('继续'); // 未续跑
  });

  it('PF5：openPomodoro load 失败 → 不抛、错误提示带「重试」、不建弹窗；重试成功', async () => {
    const { app } = setup();
    vi.spyOn(PomodoroDataManager.prototype, 'load').mockRejectedValueOnce(new Error('磁盘故障'));
    await expect(openPomodoro(app)).resolves.toBeUndefined(); // 修复前直接 reject（unhandled rejection）
    expect(document.getElementById('pomodoro-mask')).toBeNull();
    expect(document.querySelector('.bz-notice--error')).not.toBeNull();
    const retry = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '重试');
    expect(retry).toBeTruthy();
    (retry as HTMLElement).click(); // 重试 → load 已恢复（Once mock）→ 弹窗照常建立
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull();
  });

  it('PF5：ensurePomodoro load 失败 → 吞错上报；命令链不在空内存态上开新会话覆盖盘上数据', async () => {
    const { app, vault } = setup();
    vault.files.set(getPomodoroFilePath(), runningData());
    vi.spyOn(PomodoroDataManager.prototype, 'load').mockRejectedValue(new Error('磁盘故障'));
    await expect(ensurePomodoro(app)).resolves.toBeUndefined(); // 修复前 unhandled rejection
    expect(document.querySelector('.bz-notice--error')).not.toBeNull();
    await toggleFocus(app); // 盘上明明有运行中会话，加载失败时不得误开新专注
    expect(hasNotice('专注开始')).toBe(false);
    expect(hasNotice('专注已停止')).toBe(false);
    expect(vault.modifiedPaths).toEqual([]); // 无盘写发生（原数据未被覆盖）
  });

  it('PF5：保存失败 toast 挂「重试」出口（notifyActionError onRetry，效率线）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    vi.spyOn(PomodoroDataManager.prototype, 'save').mockRejectedValueOnce(new Error('磁盘故障'));
    el('pomodoro-btn-start').click(); // started 事件 → void save()
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('.bz-notice--error')).not.toBeNull();
    const retry = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '重试');
    expect(retry).toBeTruthy();
  });

  it('PF6：会话中改小时长 → 环形进度钳制在周长内（修复前 dashoffset 超界卷绕）', async () => {
    const settings: any = {};
    const { app } = setup(new MockVault(), settings);
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000); // 剩 5 分钟（300s）
    settings.pomodoroWorkMin = '4'; // total=240s < remain → progress 参负
    await vi.advanceTimersByTimeAsync(1000);
    const C = 2 * Math.PI * 52;
    const offset = parseFloat(el('pomodoro-ring-progress').getAttribute('stroke-dashoffset')!);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(C);
  });

  it('UI P3-2：打开在途时卸载 → 弹窗不复活、无 interval 残留（disposed 统一护栏）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    (vault as any).read = async (f: any) => {
      await gate;
      return vault.files.get(f.path) ?? '';
    };
    const p = openPomodoro(app);
    unloadPomodoro(); // 读盘窗口内插件被禁用/重载
    release();
    await p;
    expect(document.getElementById('pomodoro-mask')).toBeNull(); // 修复前 appendChild 反超复活孤儿弹窗
    expect(vi.getTimerCount()).toBe(0); // interval 不泄漏
  });

  it('PA-2：ensurePomodoro 并发重入 → 恢复通知只弹一次（修复前双弹「番茄钟继续」）', async () => {
    const vault = new MockVault();
    vault.files.set(getPomodoroFilePath(), runningData());
    const app = makeApp(vault);
    setApp(app);
    await Promise.all([ensurePomodoro(app), ensurePomodoro(app)]);
    expect(document.querySelectorAll('.bz-notice').length).toBe(1);
  });

  it('PE2：点内容区焦点落 body 后，点击收回面板焦点 → Space 动线恢复（真实焦点流）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    const popup = el('pomodoro-popup');
    expect(document.activeElement).toBe(popup); // buildDOM 聚焦
    popup.blur(); // 真实焦点流：点无 tabindex 内容区后浏览器把焦点交回 body（jsdom 点击不迁移焦点，手动落底）
    expect(document.activeElement).toBe(document.body);
    el('pomodoro-time').click(); // 真实点击内容区（非合成 keydown 直发）
    expect(document.activeElement).toBe(popup); // 修复后焦点收回面板
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // Space 动线恢复
  });

  it('PE2：按钮上的点击不抢焦点（保留按钮聚焦的原生键盘激活语义）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    const startBtn = el('pomodoro-btn-start');
    startBtn.focus();
    startBtn.click();
    expect(document.activeElement).toBe(startBtn); // 焦点未被 popup 收回（Space 仍走按钮原生激活，防双触发）
  });

  it('ui P2-2：统计两档激活态带 aria-pressed 且互斥（切档即翻转）', async () => {
    const { app } = setup();
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-week').getAttribute('aria-pressed')).toBe('true');
    expect(el('pomodoro-stat-tab-month').getAttribute('aria-pressed')).toBe('false');
    el('pomodoro-stat-tab-month').click();
    expect(el('pomodoro-stat-tab-week').getAttribute('aria-pressed')).toBe('false');
    expect(el('pomodoro-stat-tab-month').getAttribute('aria-pressed')).toBe('true');
  });

  it('ui P2-2：统计档钮触屏热区走 coarse padding 抬档（两钮相邻，外扩类会互盖命中区）', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/pomodoro/styles.css'), 'utf8');
    expect(/@media \(pointer: coarse\)[\s\S]*\.pomodoro-stat-tab\s*\{[^}]*padding:/.test(css)).toBe(true);
  });

  it('PC1：月档柱高按分钟归一 + 柱顶小时签（hoursLabel 接线；0 分钟月无签）', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [{ ts: T0 - 3_600_000, duration: 1500 }], // 2026-08：1 个 25 分钟
        archived: [{ week: '2026-07-06', count: 1, minutes: 180 }], // 2026-07：1 个 180 分钟
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    el('pomodoro-stat-tab-month').click();
    const days = [...el('pomodoro-months').querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    const barH = (i: number) => parseInt((days[i].querySelector('.pomodoro-stat-bar') as HTMLElement).style.height, 10);
    // 次数相同（各 1 个）而分钟悬殊 → 修复前 count 归一下柱高相等，minutes 归一下七月显著更高
    expect(barH(4)).toBeGreaterThan(barH(5));
    expect(days[4].querySelector('.pomodoro-stat-num')?.textContent).toBe('3h'); // 180 分钟柱顶签
    expect(days[5].querySelector('.pomodoro-stat-num')?.textContent).toBe('0.4h'); // 25 分钟 <1h 一位小数
    expect(days[0].querySelector('.pomodoro-stat-num')).toBeNull(); // 0 分钟月不出柱顶签
  });

  it('PC1：hoursLabel ≥100h 取整档（6000 分钟月柱顶签「100h」）', async () => {
    const vault = new MockVault();
    vault.files.set(
      getPomodoroFilePath(),
      JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 },
        history: [],
        archived: [{ week: '2026-06-01', count: 240, minutes: 6000 }], // 2026-06：6000 分钟
      })
    );
    const { app } = setup(vault);
    await openPomodoro(app);
    el('pomodoro-stat-tab-month').click();
    const days = [...el('pomodoro-months').querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(days[3].querySelector('.pomodoro-stat-num')?.textContent).toBe('100h'); // 2026-06（≥100h 取整）
  });
});
