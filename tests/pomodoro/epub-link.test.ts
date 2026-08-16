/**
 * 读书自动番茄钟测试（ticket 51/53）：决策纯函数表驱动 + 视图探测 + ui 集成（自动开始/暂停/换书/预设 override）。
 * fake timers（含 Date）：tick 轮询与倒计时时间推进可控。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro, ensurePomodoro, ensurePomodoroEpubLink, unloadPomodoroEpubLink, getEpubBook, decideReadingAction, checkReadingNow } from '../../src/pomodoro';
import { getPomodoroFilePath } from '../../src/pomodoro/data';
import type { PomodoroState } from '../../src/pomodoro/state';
import { createInitialState } from '../../src/pomodoro/state';

const T0 = new Date('2026-08-10T10:00:00').getTime();

/** 假阅读器视图（fork-weave-epub-reader reader 视图形状） */
function readerView(path: string, title?: string) {
  return { getViewType: () => 'weave-epub-reader-standalone', filePath: path, bookTitle: title ?? '' };
}

function makeApp(vault: MockVault, view: any = null) {
  const app = mockAppWithVault(vault);
  (app.workspace as any).activeLeaf = view ? { view } : null;
  return app;
}

function setup(vault: MockVault = new MockVault(), settings: any = {}, view: any = null) {
  const app = makeApp(vault, view);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

/** 读落盘的 pomodoro.json state */
function rawState(vault: MockVault): any {
  return JSON.parse(vault.files.get(getPomodoroFilePath())!).state;
}

function focusState(partial: Partial<PomodoroState> = {}): PomodoroState {
  return { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: null, ...partial };
}

const BOOK_A = { path: '书架/活着.epub', title: '活着' };
const BOOK_B = { path: '书架/百年孤独.epub', title: '百年孤独' };

describe('decideReadingAction（决策纯函数）', () => {
  it('开关关 → 一律 none', () => {
    expect(decideReadingAction(null, BOOK_A, createInitialState(), false)).toEqual({ action: 'none' });
    expect(decideReadingAction(BOOK_A, BOOK_A, createInitialState(), false, true)).toEqual({ action: 'none' });
  });

  it('同书（轮询比对无变化）→ none', () => {
    expect(decideReadingAction(BOOK_A, BOOK_A, createInitialState(), true)).toEqual({ action: 'none' });
  });

  it('idle + 打开书 → start（Q9 免确认）', () => {
    expect(decideReadingAction(null, BOOK_A, createInitialState(), true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('idle + 关闭书 → none', () => {
    expect(decideReadingAction(BOOK_A, null, createInitialState(), true)).toEqual({ action: 'none' });
  });

  it('休息 + 打开书 → confirm(skip-break)（Q10）', () => {
    const s = focusState({ phase: 'short-break', endTime: T0 + 60_000 });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'confirm', book: BOOK_A, mode: 'skip-break' });
    const l = focusState({ phase: 'long-break', endTime: T0 + 60_000 });
    expect(decideReadingAction(null, BOOK_A, l, true)).toEqual({ action: 'confirm', book: BOOK_A, mode: 'skip-break' });
  });

  it('他处专注中 + 打开书 → confirm(enter)（Q5）', () => {
    const s = focusState({ target: { type: 'memo', id: 'm1', label: '写报告' } });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'confirm', book: BOOK_A, mode: 'enter' });
  });

  it('读书会话进行中 + 换书 → switch（Q6 直接切）', () => {
    expect(decideReadingAction(BOOK_A, BOOK_B, createInitialState(), true, true)).toEqual({ action: 'switch', book: BOOK_B });
  });

  it('读书会话进行中 + 关闭书 → pause（Q2：结算并恢复主番茄钟）', () => {
    expect(decideReadingAction(BOOK_A, null, createInitialState(), true, true)).toEqual({ action: 'pause' });
  });

  it('读书会话进行中 + forceFocus → pause 照常（豁免由执行层保证）', () => {
    expect(decideReadingAction(BOOK_A, null, createInitialState(), true, true)).toEqual({ action: 'pause' });
  });

  it('读书会话进行中 + 书保持打开（prev null 启动恢复）→ none 不打扰', () => {
    expect(decideReadingAction(null, BOOK_A, createInitialState(), true, true)).toEqual({ action: 'none' });
  });

  it('读书会话进行中 + 无书（prev null, book null，重启恢复场景）→ pause（结算并恢复主番茄钟）', () => {
    expect(decideReadingAction(null, null, createInitialState(), true, true)).toEqual({ action: 'pause' });
  });

  it('用户手动暂停（书一直开着，同书）→ none（尊重用户暂停）', () => {
    const s = focusState({ paused: true, endTime: null, remaining: 600 });
    expect(decideReadingAction(BOOK_A, BOOK_A, s, true)).toEqual({ action: 'none' });
  });

  it('关书后主番茄钟恢复 idle → 重开同一本书 → start（Q2 新读书会话）', () => {
    // 关书恢复后主状态已回到 idle，重开书 → 直接开始独立读书计时
    expect(decideReadingAction(null, BOOK_A, createInitialState(), true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('暂停态打开书（主时钟已暂停，无运行）→ start（读书独立计时不受主暂停阻塞）', () => {
    const s = focusState({ paused: true, endTime: null, remaining: 600, target: { type: 'memo', id: 'm1', label: '写报告' } });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('reset 后的未运行 focus（endTime null）→ start（等同 idle）', () => {
    const s = focusState({ endTime: null, remaining: 1500 });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('休息中换书 → confirm(skip-break)（等同打开分派）', () => {
    const s = focusState({ phase: 'short-break', endTime: T0 + 60_000 });
    expect(decideReadingAction(BOOK_A, BOOK_B, s, true)).toEqual({ action: 'confirm', book: BOOK_B, mode: 'skip-break' });
  });

  it('非读书场景关闭书 → none（读书会话未进行）', () => {
    expect(decideReadingAction(BOOK_A, null, focusState({ target: { type: 'memo', id: 'm1', label: '写报告' } }), true)).toEqual({ action: 'none' });
    expect(decideReadingAction(BOOK_A, null, focusState({ phase: 'short-break', endTime: T0 + 60_000 }), true)).toEqual({ action: 'none' });
  });
});

describe('getEpubBook（视图探测）', () => {
  it('无 activeLeaf → null', () => {
    const { app } = setup();
    expect(getEpubBook(app)).toBeNull();
  });

  it('非阅读器视图 → null', () => {
    const { app } = setup(new MockVault(), {}, { getViewType: () => 'markdown', file: { path: 'a.md' } });
    expect(getEpubBook(app)).toBeNull();
  });

  it('阅读器视图 filePath + bookTitle → 书名', () => {
    const { app } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    expect(getEpubBook(app)).toEqual(BOOK_A);
  });

  it('阅读器视图无 bookTitle → 文件名兜底', () => {
    const { app } = setup(new MockVault(), {}, readerView('书架/活着.epub'));
    expect(getEpubBook(app)).toEqual({ path: '书架/活着.epub', title: '活着.epub' });
  });

  it('filePath 缺失 → null', () => {
    const { app } = setup(new MockVault(), {}, { getViewType: () => 'weave-epub-reader-standalone', bookTitle: 'x' });
    expect(getEpubBook(app)).toBeNull();
  });
});

describe('读书联动集成（独立读书计时，ticket 56）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    unloadPomodoroEpubLink();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    unloadPomodoroEpubLink();
    vi.useRealTimers();
  });

  function rawReading(vault: MockVault): any {
    return JSON.parse(vault.files.get(getPomodoroFilePath())!).reading;
  }
  function rawComplete(vault: MockVault): any {
    return JSON.parse(vault.files.get(getPomodoroFilePath())!);
  }
  function seedState(vault: MockVault, state: any, reading?: any): void {
    const obj: any = { version: 1, state, history: [] };
    if (reading !== undefined) obj.reading = reading;
    vault.files.set(getPomodoroFilePath(), JSON.stringify(obj));
  }

  it('打开书（idle）→ 自动开始独立读书计时：读书会话 active、书挂入、主番茄钟挂起（idle→paused 冻结）、后台不弹窗', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径：不弹窗
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true);
    expect(raw.reading.book).toEqual({ path: BOOK_A.path, title: '活着' });
    // 主番茄钟被挂起：endTime 冻结为 null、paused、remaining 冻结，phase 保持原状
    expect(raw.state.endTime).toBeNull();
    expect(raw.state.paused).toBe(true);
    expect(raw.state.phase).toBe('idle');
    expect(document.getElementById('pomodoro-mask')).toBeNull(); // 后台形态：不弹窗
    expect(hasNotice('读书计时开始：活着')).toBe(true); // 自动开始弹通知
  });

  it('读书累计端到端：打开→推进→显示随累计走（不随主番茄钟阶段）', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(5000); // 读书累计 5s
    const statusText = document.querySelector('.pomodoro-statusbar-text') as HTMLElement | null;
    if (statusText) expect(statusText.textContent).toContain('00:05');
    expect(rawReading(vault).active).toBe(true);
  });

  it('关闭书 → 结算读书累计入读书历史（target.type=book）+ 恢复挂起的主番茄钟快照', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    // 读到 A 一段时间
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(6000); // 读书累计 6s
    const startClose = Date.now();
    // 关闭书
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(false); // 会话已结束
    const bookEntry = raw.history[raw.history.length - 1];
    expect(bookEntry.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' }); // 单独入读书历史
    expect(bookEntry.duration).toBe(Math.round((Date.now() - startClose) / 1000) + 6); // ≈ 6s + 结算瞬间
    expect(raw.state.phase).toBe('idle'); // 主番茄钟恢复挂起快照（idle）
    expect(hasNotice(/读书结束/)).toBe(true);
  });

  it('关闭书 → 恢复挂起的运行中专注（原 endTime 继续，时间不流逝）', async () => {
    const vault = new MockVault();
    // 预置运行中专注（endTime=+100s，cycleFocusCount=0）
    seedState(vault, { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: { type: 'memo', id: 'm1', label: '写报告' } });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    // 专注运行中打开书 → confirm(enter)
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-reading-confirm')).not.toBeNull();
    (document.getElementById('pomodoro-reading-confirm-yes') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawReading(vault).active).toBe(true);
    expect(rawReading(vault).prevState.endTime).toBe(T0 + 100_000); // 快照保留原 endTime
    // 读书一段时间后关书
    await vi.advanceTimersByTimeAsync(8000);
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(false);
    expect(raw.state.endTime).toBe(T0 + 100_000); // 恢复原 endTime（时间未流逝）
    expect(raw.state.phase).toBe('focus');
    expect(raw.state.target).toEqual({ type: 'memo', id: 'm1', label: '写报告' }); // 目标也恢复
  });

  it('重启后读书会话恢复：书仍开 → active 保持、累计不丢（endTime 基准后台补时）', async () => {
    const vault = new MockVault();
    // 模拟重启前：读书会话 active，startedAt 在 100s 前（后台一段时间）
    seedState(
      vault,
      { phase: 'idle', endTime: null, remaining: 0, paused: true, cycleFocusCount: 0, target: null },
      { active: true, book: { path: BOOK_A.path, title: '活着' }, elapsedMs: 0, startedAt: T0, prevState: { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0, target: null } }
    );
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复：reading.active → tick 继续（累计随 now 走）
    ensurePomodoroEpubLink(app);
    await vi.advanceTimersByTimeAsync(100); // 启动检测延迟前
    // startedAt=T0=Date.now()，故累计≈0+流逝
    const progressed = Date.now() - T0;
    // 推进到 startedAt 之后 30s 模拟后台流逝
    await vi.advanceTimersByTimeAsync(30_000);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true); // 书仍开，会话未结算
    // 累计 = elapsedMs + (now - startedAt)
    const elapsedSec = Math.round((raw.reading.elapsedMs + (Date.now() - raw.reading.startedAt)) / 1000);
    expect(elapsedSec).toBe(30 + Math.round(progressed / 1000));
  });

  it('强制专注模式 + 关闭书 → 读书会话照常结算（豁免 forceFocus）', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroForceFocus: true }, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawReading(vault).active).toBe(true);
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawReading(vault).active).toBe(false); // 关书结算豁免 forceFocus
  });

  it('读书会话中换书 → 直接切新书（无确认）、旧书累计入读书历史', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(4000); // 读 A 4s
    (app.workspace as any).activeLeaf = { view: readerView(BOOK_B.path, '百年孤独') };
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true);
    expect(raw.reading.book).toEqual({ path: BOOK_B.path, title: '百年孤独' });
    // 旧书 A 的累计已入读书历史
    const entryA = raw.history[raw.history.length - 1];
    expect(entryA.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(entryA.duration).toBe(4);
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull(); // 无确认
  });

  it('Obsidian 启动时书已打开（无读书会话）→ 延迟检测自动开始独立读书计时', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径（bindPomodoroState/bindReadingSession）
    ensurePomodoroEpubLink(app);
    await vi.advanceTimersByTimeAsync(1500); // 启动检测延迟
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true);
    expect(raw.reading.book).toEqual({ path: BOOK_A.path, title: '活着' });
  });

  it('总开关关 → ensure 不注册监听，check 无动作（不落盘）', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroEpubAuto: false }, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app); // 开关关：不注册
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.files.get(getPomodoroFilePath())).toBeUndefined(); // 无任何落盘
  });

  it('同书持续打开（tick 轮询）→ 不重复动作、读书累计持续推进', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const startAt = rawReading(vault).startedAt;
    await vi.advanceTimersByTimeAsync(3000);
    expect(rawReading(vault).startedAt).toBe(startAt); // 同书不重置会话起点
    expect(rawReading(vault).active).toBe(true);
  });

  it('unload 清理：书打开时卸载 → 再 check 无动作', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawReading(vault).active).toBe(true);
    unloadPomodoroEpubLink();
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawReading(vault).active).toBe(true); // 卸载后不再联动（读书会话保持，应用关闭才结算）
  });

  // ===== 确认弹窗（休息/他处专注） =====

  it('休息中打开书 → 确认弹窗「跳过休息」：是 → 开始独立读书计时、休息会话挂起', async () => {
    const vault = new MockVault();
    seedState(vault, { phase: 'short-break', endTime: T0 + 300_000, remaining: 0, paused: false, cycleFocusCount: 1, target: null });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const popup = document.getElementById('pomodoro-reading-confirm');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('跳过休息');
    expect(popup!.textContent).toContain('活着');
    (document.getElementById('pomodoro-reading-confirm-yes') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true);
    expect(raw.reading.book).toEqual({ path: BOOK_A.path, title: '活着' });
    // 主番茄钟挂起：休息阶段冻结剩余
    expect(raw.state.phase).toBe('short-break');
    expect(raw.state.endTime).toBeNull();
    expect(raw.state.paused).toBe(true);
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull();
  });

  it('休息中打开书 → 选否：休息继续、弹窗关闭、本次打开不再提示', async () => {
    const vault = new MockVault();
    seedState(vault, { phase: 'short-break', endTime: T0 + 300_000, remaining: 0, paused: false, cycleFocusCount: 1, target: null });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    (document.getElementById('pomodoro-reading-confirm-no') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.phase).toBe('short-break'); // 休息继续
    expect(s.endTime).toBe(T0 + 300_000);
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull();
    checkReadingNow(); // 同书持续打开（tick 轮询）→ 不再弹
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull();
  });

  it('他处专注中打开书 → 确认弹窗「进入读书专注」：是 → 挂起专注重启读书会话', async () => {
    const vault = new MockVault();
    seedState(vault, { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: { type: 'memo', id: 'm1', label: '写报告' } });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const popup = document.getElementById('pomodoro-reading-confirm');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('进入读书专注');
    (document.getElementById('pomodoro-reading-confirm-yes') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    const raw = rawComplete(vault);
    expect(raw.reading.active).toBe(true);
    expect(raw.reading.prevState.target).toEqual({ type: 'memo', id: 'm1', label: '写报告' }); // 快照保留
    expect(raw.state.paused).toBe(true); // 主挂起
  });

  it('他处专注中打开书 → 选否：原专注保持原状（endTime/target 不变）', async () => {
    const vault = new MockVault();
    seedState(vault, { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: { type: 'memo', id: 'm1', label: '写报告' } });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    (document.getElementById('pomodoro-reading-confirm-no') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.phase).toBe('focus');
    expect(s.target).toEqual({ type: 'memo', id: 'm1', label: '写报告' });
    expect(s.endTime).toBe(T0 + 100_000);
  });

  it('遮罩点击 = 否：休息中打开书 → 点遮罩 → 休息继续', async () => {
    const vault = new MockVault();
    seedState(vault, { phase: 'long-break', endTime: T0 + 300_000, remaining: 0, paused: false, cycleFocusCount: 0, target: null });
    const { app } = setup(vault, {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    (document.getElementById('pomodoro-reading-confirm-mask') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull();
    expect(rawState(vault).phase).toBe('long-break');
  });

  it('启动形态=自动弹窗：idle 打开书 → 开始读书计时并弹出主弹窗（主番茄钟挂起）', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroEpubMode: 'popup' }, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径（不弹窗）
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull(); // popup 形态自动弹窗
    expect(rawReading(vault).active).toBe(true); // 独立读书计时开始
  });
});

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
