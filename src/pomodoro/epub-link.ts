/**
 * 读书自动番茄钟（ticket 51/53）：epub 阅读器联动层。
 * - 检测：active-leaf-change 监听 + 番茄钟 tick 顺带轮询（同视图换书兜底，不新增独立定时器）；
 *   active leaf 形状探测（视图类型 + filePath/bookTitle 只读属性），不注册阅读器 API。
 * - 决策：decideReadingAction 纯函数（事件×状态×设置 → 动作），confirm 场景（休息中/他处专注）输出占位动作，ticket 54 接线。
 * - 执行：函数体内延迟 import ui（ADR-0002：UI 内部函数级引用环允许，模块顶层互访禁止）。
 * 依赖方向：ui.ts 顶层 import 本模块（tick 轮询调用）；本模块顶层不 import ui。
 */
import type { App, EventRef } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import type { PomodoroState } from './state';
import { createInitialState } from './state';

/** 阅读器视图类型（fork 构建；形状探测风格） */
export const READER_VIEW_TYPES = ['weave-epub-reader-standalone'] as const;

/** 当前阅读的书（epub 文件路径 + 显示名快照） */
export interface ReadingBook {
  path: string;
  title: string;
}

export type ReadingDecision =
  | { action: 'none' }
  | /** 直接开始读书专注（idle 免确认，Q9） */
    { action: 'start'; book: ReadingBook }
  | /** 读书专注中换书直接切（Q6） */
    { action: 'switch'; book: ReadingBook }
  | /** 关闭书自动暂停（含 forceFocus 豁免，Q11） */
    { action: 'pause' }
  | /** 弹窗确认（ticket 54：休息中 skip-break / 他处专注中 enter，Q5/Q10） */
    { action: 'confirm'; book: ReadingBook; mode: 'skip-break' | 'enter' };

/** 探测当前激活的阅读器视图（无 → null，调用方静默降级） */
export function getEpubBook(app: App): ReadingBook | null {
  const leaf = (app.workspace as any).activeLeaf;
  const view = leaf?.view;
  if (!view || typeof view.getViewType !== 'function') return null;
  if (!(READER_VIEW_TYPES as readonly string[]).includes(view.getViewType())) return null;
  const path = typeof view.filePath === 'string' && view.filePath ? view.filePath : null;
  if (!path) return null;
  const title = typeof view.bookTitle === 'string' && view.bookTitle ? view.bookTitle : basename(path);
  return { path, title };
}

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

/**
 * 决策纯函数：prev（上一轮检测的书）→ book（本轮）+ 当前状态 + 读书会话是否进行中 + 开关 → 动作。
 * 场景表（grilling Q2/Q5/Q6/Q9/Q10/Q12 + ticket 56 独立读书计时改编）：
 * - 读书会话进行中（readingActive）：
 *   - 关书（book null）→ pause（结算并恢复主番茄钟）；同书 → none；换书 → switch（直接切，无确认）
 * - prev null → book（打开书）：
 *   - idle → start；休息 → confirm(skip-break)；专注中 target 非书 → confirm(enter)；
   *   用户暂停态 → none（尊重用户，不自动开始）
 * - 打开书（book 非空，非读书会话中）：按主番茄钟分派（idle start / 休息 confirm / 专注 confirm）
 */
export function decideReadingAction(
  prev: ReadingBook | null,
  book: ReadingBook | null,
  state: PomodoroState,
  epubAuto: boolean,
  readingActive = false,
  currentBook: ReadingBook | null = null
): ReadingDecision {
  if (!epubAuto) return { action: 'none' };
  if (book && prev && book.path === prev.path) return { action: 'none' };
  // 读书会话进行中：关书 → pause（结算+恢复）；换书 → switch（直接切）；同书已拦
  if (readingActive) {
    if (book === null) return { action: 'pause' };
    // ticket 62：换书判定优先对比会话当前书（currentBook，不依赖 prev 连续性——tick 轮询/切走再回来不漏判）；缺失回退 prev
    const same = currentBook !== null ? book.path === currentBook.path : prev !== null && book.path === prev.path;
    if (!same) return { action: 'switch', book };
    return { action: 'none' };
  }
  const running = state.endTime !== null;
  if (book) {
    // 主番茄钟未在倒计时（idle / 暂停 / reset 后未运行）→ 直接开始读书计时（Q9）
    if (!running) return { action: 'start', book };
    // 主番茄钟正在倒计时 → 按阶段确认（不打断用户主动的专注/休息）
    if (state.phase === 'focus') return { action: 'confirm', book, mode: 'enter' }; // Q5
    return { action: 'confirm', book, mode: 'skip-break' }; // Q10
  }
  // 关闭书：非读书会话 → 不动作
  return { action: 'none' };
}

/** 读书联动开关（缺省开） */
export function readingEpubAutoEnabled(): boolean {
  return tryGetSettings().pomodoroEpubAuto !== false;
}

// ===== 接线（常驻监听，ADR-0003 事件常驻域按设置开关注册）=====

let appRef: App | null = null;
let prevBook: ReadingBook | null = null;
let leafListener: EventRef | null = null;
let initialized = false;
let initTimer: ReturnType<typeof setTimeout> | null = null;
/** ui 注入的状态快照 getter（ui.ts ensure 时绑定；避免顶层循环 import） */
let stateGetter: () => PomodoroState = () => createInitialState();
/** ui 注入的读书会话当前书 getter（ticket 62：换书判断以会话书为准；null = 会话未进行） */
let readingBookGetter: () => ReadingBook | null = () => null;

/** ui.ts 绑定当前番茄钟状态（ensurePomodoro 时调用） */
export function bindPomodoroState(getter: () => PomodoroState): void {
  stateGetter = getter;
}

/** ui.ts 绑定读书会话当前书（ensurePomodoro 时调用；未进行 → null） */
export function bindReadingSession(getter: () => ReadingBook | null): void {
  readingBookGetter = getter;
}

/** 读书启动形态：popup（自动弹窗）时返回 true（ticket 54，Q1 默认后台） */
export function readingModePopupEnabled(): boolean {
  return tryGetSettings().pomodoroEpubMode === 'popup';
}

/** 执行决策动作（函数体内延迟 import ui，ADR-0002） */
function execute(decision: ReadingDecision): void {
  if (decision.action === 'start') {
    void import('./ui').then(async (m) => {
      await m.startReadingFocus(decision.book);
      // 启动形态=自动弹窗（Q1）：idle 自动开始后弹出番茄钟主弹窗
      if (readingModePopupEnabled()) void m.openPomodoro(appRef!);
    });
  } else if (decision.action === 'switch') {
    void import('./ui').then((m) => m.switchReadingFocus(decision.book));
  } else if (decision.action === 'pause') {
    void import('./ui').then((m) => m.closeReadingSession());
  } else if (decision.action === 'confirm') {
    // 确认弹窗（Q5/Q10）：是 → 立即开始读书专注；否/ESC/遮罩 → 保持原样（ticket 54）
    void import('./ui').then((m) => m.showReadingConfirm(decision));
  }
}

/** 检测一次并驱动决策（active-leaf-change 与 tick 轮询共用；prev 更新保证同书不重复触发） */
export function checkReadingNow(): void {
  if (!appRef) return;
  const book = getEpubBook(appRef);
  const current = readingBookGetter();
  const decision = decideReadingAction(prevBook, book, stateGetter(), readingEpubAutoEnabled(), current !== null, current);
  prevBook = book;
  execute(decision);
}

/** 幂等初始化：active-leaf-change 监听 + 启动检测（书已打开视为打开事件）；开关关 → 静默不注册 */
export function ensurePomodoroEpubLink(app: App): void {
  if (initialized) return;
  if (!readingEpubAutoEnabled()) return;
  initialized = true;
  appRef = app;
  leafListener = app.workspace.on('active-leaf-change', () => checkReadingNow());
  // 启动检测：上次未关书即退出 → 视为打开事件（等 onLayoutReady 后事件循环稳定）
  initTimer = setTimeout(() => checkReadingNow(), 1500);
}

/** 卸载清理（main.ts onunload；测试重置） */
export function unloadPomodoroEpubLink(): void {
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
  if (leafListener) appRef?.workspace?.offref?.(leafListener);
  leafListener = null;
  appRef = null;
  prevBook = null;
  initialized = false;
  stateGetter = () => createInitialState();
  readingBookGetter = () => null;
}

/** 测试钩子：直接检查当前状态（绕过监听时序） */
export function _testCheckNow(): void {
  checkReadingNow();
}
