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
    expect(decideReadingAction(BOOK_A, null, focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } }), false)).toEqual({ action: 'none' });
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

  it('读书专注中 + 换书 → switch（Q6 直接切）', () => {
    const s = focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(BOOK_A, BOOK_B, s, true)).toEqual({ action: 'switch', book: BOOK_B });
  });

  it('读书专注中 + 关闭书 → pause（Q2）', () => {
    const s = focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(BOOK_A, null, s, true)).toEqual({ action: 'pause' });
  });

  it('读书专注中 + forceFocus → pause 照常（豁免由执行层保证，决策层不区分）', () => {
    const s = focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(BOOK_A, null, s, true)).toEqual({ action: 'pause' });
  });

  it('启动恢复：专注正对这本书且运行中（无 prev）→ none 不打扰', () => {
    const s = focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'none' });
  });

  it('用户手动暂停（书一直开着，同书）→ none（尊重用户暂停）', () => {
    const s = focusState({ paused: true, endTime: null, remaining: 600, target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(BOOK_A, BOOK_A, s, true)).toEqual({ action: 'none' });
  });

  it('自动暂停后重开同一本书 → start（Q2 新专注）', () => {
    const s = focusState({ paused: true, endTime: null, remaining: 600, target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('暂停态打开书（他处目标）→ confirm(enter)', () => {
    const s = focusState({ paused: true, endTime: null, remaining: 600, target: { type: 'memo', id: 'm1', label: '写报告' } });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'confirm', book: BOOK_A, mode: 'enter' });
  });

  it('reset 后的未运行 focus（endTime null）→ start（等同 idle）', () => {
    const s = focusState({ endTime: null, remaining: 1500 });
    expect(decideReadingAction(null, BOOK_A, s, true)).toEqual({ action: 'start', book: BOOK_A });
  });

  it('休息中换书 → confirm(skip-break)（等同打开分派）', () => {
    const s = focusState({ phase: 'short-break', endTime: T0 + 60_000 });
    expect(decideReadingAction(BOOK_A, BOOK_B, s, true)).toEqual({ action: 'confirm', book: BOOK_B, mode: 'skip-break' });
  });

  it('非读书场景关闭书 → none', () => {
    expect(decideReadingAction(BOOK_A, null, focusState({ target: { type: 'memo', id: 'm1', label: '写报告' } }), true)).toEqual({ action: 'none' });
    expect(decideReadingAction(BOOK_A, null, focusState({ phase: 'short-break', endTime: T0 + 60_000 }), true)).toEqual({ action: 'none' });
  });

  it('持续无书（prev=null, book=null）+ 读书专注运行中 → none（不重复暂停手动恢复的专注）', () => {
    const s = focusState({ target: { type: 'book', path: BOOK_A.path, label: BOOK_A.title } });
    expect(decideReadingAction(null, null, s, true)).toEqual({ action: 'none' });
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

describe('读书联动集成（ui 流程）', () => {
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

  it('打开书（idle）→ 自动开始读书专注：target 挂书、45 分钟读书预设、后台不弹窗', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径：不弹窗
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.phase).toBe('focus');
    expect(s.endTime).toBe(T0 + 45 * 60 * 1000); // 阅读沉浸 45 分钟
    expect(s.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(document.getElementById('pomodoro-mask')).toBeNull(); // 后台形态：不弹窗
    expect(hasNotice('已开始读书专注：《活着》')).toBe(true); // 自动开始弹通知
  });

  it('读书专注自然完成 → history duration = 45 分钟（读书预设生效）', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(45 * 60 * 1000 + 1000);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history[0].duration).toBe(45 * 60);
    expect(raw.history[0].target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
  });

  it('关闭书 → 自动暂停：paused、remaining 保留、target 保留、预设恢复（下一专注回到 25 分钟）', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(1000); // 走 1 秒（tick 轮询同书 → none）
    // 关书：activeLeaf 置空
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    let s = rawState(vault);
    expect(s.paused).toBe(true);
    expect(s.endTime).toBeNull();
    expect(s.remaining).toBe(45 * 60 - 1); // 已走 1 秒（tick 推进 1000ms）
    expect(s.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' }); // target 保留
    expect(hasNotice('已暂停读书专注')).toBe(true); // 自动暂停弹通知
    // 预设恢复：手动继续后完成 → 25 分钟（经典）
    setSettingsProvider(() => ({ pomodoroPreset: 'classic' } as any));
    // 手动「继续」走 ui 按钮（forceFocus 未开，可用）——恢复暂停剩余（2699s）
    const startBtn = document.getElementById('pomodoro-btn-start') as HTMLButtonElement;
    startBtn.click();
    await vi.advanceTimersByTimeAsync(2699 * 1000 + 1000);
    const raw = JSON.parse(vault.files.get(getPomodoroFilePath())!);
    expect(raw.history[0].duration).toBe(25 * 60); // 恢复后的完成按用户预设（classic 25 分钟）
    expect(raw.state.remaining).toBe(5 * 60); // 后续休息按 classic 5 分钟（读书预设已退出）
  });

  it('强制专注模式 + 关书 → 自动暂停仍生效（豁免）；手动暂停仍禁用', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroForceFocus: true }, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const startBtn = document.getElementById('pomodoro-btn-start') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true); // 强制专注：手动暂停禁用
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.paused).toBe(true); // 自动暂停豁免生效
  });

  it('重开同一本书 → 重新开始新专注（不恢复暂停剩余）', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawState(vault).paused).toBe(true);
    // 重开同一本书
    (app.workspace as any).activeLeaf = { view: readerView(BOOK_A.path, '活着') };
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.paused).toBe(false);
    expect(s.endTime).toBe(T0 + 20 + 45 * 60 * 1000); // 全新 45 分钟（已推进 20ms），不恢复剩余
  });

  it('读书专注中换书 → target 切新书、新专注（无确认）', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    (app.workspace as any).activeLeaf = { view: readerView(BOOK_B.path, '百年孤独') };
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    const s = rawState(vault);
    expect(s.target).toEqual({ type: 'book', path: BOOK_B.path, label: '百年孤独' });
    expect(s.paused).toBe(false);
    expect(s.endTime).toBe(T0 + 10 + 45 * 60 * 1000); // 新专注从当前时刻（已推进 10ms）起 45 分钟
  });

  it('Obsidian 启动时书已打开 → ensure 后延迟检测自动开始', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径（bindPomodoroState）
    ensurePomodoroEpubLink(app);
    await vi.advanceTimersByTimeAsync(1500); // 启动检测延迟
    const s = rawState(vault);
    expect(s.phase).toBe('focus');
    expect(s.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
  });

  it('总开关关 → ensure 不注册监听，check 无动作', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroEpubAuto: false }, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app); // 开关关：不注册
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.files.get(getPomodoroFilePath())).toBeUndefined(); // 无任何落盘（未开始）
  });

  it('同书持续打开（tick 轮询）→ 不重复动作', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    // tick 轮询路径：每秒 checkReadingNow，同书 → none（endTime 不被重置）
    const first = rawState(vault).endTime;
    await vi.advanceTimersByTimeAsync(3000);
    expect(rawState(vault).endTime).toBe(first);
  });

  it('unload 清理：书打开时卸载 → 再 check 无动作', async () => {
    const { app, vault } = setup(new MockVault(), {}, readerView(BOOK_A.path, '活着'));
    await openPomodoro(app);
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    unloadPomodoroEpubLink();
    (app.workspace as any).activeLeaf = null;
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(rawState(vault).paused).toBe(false); // 卸载后不再联动
  });

  // ===== ticket 54：确认弹窗 + 启动形态弹窗模式 =====

  function seedState(vault: MockVault, state: any): void {
    vault.files.set(getPomodoroFilePath(), JSON.stringify({ version: 1, state, history: [] }));
  }

  it('休息中打开书 → 确认弹窗「跳过休息」：是 → 立即开始读书专注（读书预设，休息不计 history）', async () => {
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
    const s = rawState(vault);
    expect(s.phase).toBe('focus');
    expect(s.endTime).toBe(T0 + 10 + 45 * 60 * 1000); // 读书预设 45 分钟
    expect(s.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(document.getElementById('pomodoro-reading-confirm')).toBeNull();
  });

  it('休息中打开书 → 选否：休息继续、弹窗关闭、本次打开不再提示（同书轮询不重复弹）', async () => {
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

  it('他处专注中打开书 → 确认弹窗「进入读书专注」：是 → 立即进入（当前专注不计 history）', async () => {
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
    const s = rawState(vault);
    expect(s.phase).toBe('focus');
    expect(s.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(s.endTime).toBe(T0 + 10 + 45 * 60 * 1000);
  });

  it('他处专注中打开书 → 选否：原专注保持原状（endTime 不变、target 不变）', async () => {
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

  it('启动形态=自动弹窗：idle 打开书 → 自动开始并弹出主弹窗', async () => {
    const { app, vault } = setup(new MockVault(), { pomodoroEpubMode: 'popup' }, readerView(BOOK_A.path, '活着'));
    await ensurePomodoro(app); // 启动恢复路径（不弹窗）
    ensurePomodoroEpubLink(app);
    checkReadingNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.getElementById('pomodoro-mask')).not.toBeNull(); // popup 形态自动弹窗
    expect(rawState(vault).phase).toBe('focus');
  });
});
