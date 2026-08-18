/**
 * 独立读书番茄钟（ticket 56 重构）：与主番茄钟状态机解耦的**独立分段番茄钟**。
 * - 打开 epub 书 → 快照并挂起主番茄钟，另起一个配「阅读沉浸 45/10/20」预设的独立读书番茄钟：
 *   专注 45min 走满 → 记一个读书番茄（target.type=book）→ 读书短休 10min → 每 4 个专注进读书长休 20min。
 * - 复用 state.ts 的 transition（同一阶级模型），以读书预设施时长注入，自成节律；
 *   读书历史 = 完成的读书专注段（duration=45*60）+ 中途关书按实读时长入账。
 * - 关闭/换书 → 结算当前读书段按实读时长入账 → 恢复挂起的主番茄钟快照。
 * - ticket 62：不补算——重启后按 lastActiveAt 结算关闭前实读并结束会话；纯函数（无 DOM），时间一律由调用方传入（now），ui.ts 负责接线与落盘。
 */
import type { PomodoroState, Durations, PomodoroOptions, HistoryEntry } from './state';
import { createInitialState, transition, phaseDurationSec, DEFAULT_OPTIONS } from './state';
import type { ReadingBook } from './epub-link';

/** 独立的读书番茄钟会话 */
export interface ReadingSession {
  /** 读书番茄钟是否进行中（打开书且未关） */
  active: boolean;
  /** 当前阅读的书（无会话为 null） */
  book: ReadingBook | null;
  /** 独立读书番茄钟状态（复用 PomodoroState：phase/endTime/remaining/cycleFocusCount/target） */
  state: PomodoroState;
  /** 进入读书前的主番茄钟快照（关书恢复用；无会话为 null） */
  prevState: PomodoroState | null;
  /** 最近活跃时刻（ticket 62 可选字段）：关闭前实读时长结算基准；旧数据无此字段 → 放弃该段结算 */
  lastActiveAt?: number;
}

/** 空会话（默认） */
export function emptyReadingSession(): ReadingSession {
  return { active: false, book: null, state: createInitialState(), prevState: null };
}

/** 会话是否进行中 */
export function isReadingActive(s: ReadingSession): boolean {
  return s.active;
}

/** 读书番茄钟当前状态（ui 渲染用） */
export function readingState(s: ReadingSession): PomodoroState {
  return s.state;
}

/** 读书专注目标（book 固定） */
function bookTarget(book: ReadingBook): { type: 'book'; path: string; label: string } {
  return { type: 'book', path: book.path, label: book.title };
}

/** 读书预设时长（专注 45/短休 10/长休 20；长休间隔随全局设置注入） */
export function readingDurations(longBreakInterval: number): Durations {
  return { workMin: 45, shortBreakMin: 10, longBreakMin: 20, longBreakInterval };
}

/** 读书读书选项：自动循环（休完自动下一段读书，书开着自成节律）；forceFocus 对读书番茄钟不适用 */
export function readingOptions(o: PomodoroOptions): PomodoroOptions {
  return { ...o, forceFocus: false, autoCycle: true };
}

/**
 * 开始读书番茄钟（打开书）：快照主番茄钟供关书恢复，从读书专注段 45min 开始。
 */
export function startReadingSession(prevState: PomodoroState, book: ReadingBook, now: number, d: Durations): ReadingSession {
  return {
    active: true,
    book,
    state: {
      phase: 'focus',
      endTime: now + phaseDurationSec('focus', d) * 1000,
      remaining: 0,
      paused: false,
      cycleFocusCount: 0,
      target: bookTarget(book),
    },
    prevState,
    lastActiveAt: now,
  };
}

/** 换书（Q6 直接切）：结算旧书当前段按实读时长入账，新书从新读书专注段开始 */
export function switchReadingBook(
  s: ReadingSession,
  book: ReadingBook,
  now: number,
  d: Durations,
  o: PomodoroOptions
): { session: ReadingSession; settled: HistoryEntry[] } {
  const settled = settleReadingSegment(s, now, d);
  return {
    session: startReadingSession(s.prevState ?? createInitialState(), book, now, d),
    settled,
  };
}

/**
 * 读书番茄钟 tick：推进（专注完成 → 记读书历史；休息完成 → 自动下一段）。返回新会话 + 产生的读书历史。
 * 每次推进同步刷新 lastActiveAt（关闭前实读结算基准）。
 */
export function tickReadingSession(
  s: ReadingSession,
  now: number,
  d: Durations,
  o: PomodoroOptions
): { session: ReadingSession; history: HistoryEntry[] } {
  if (s.state.endTime === null || now < s.state.endTime) {
    return { session: { ...s, lastActiveAt: now }, history: [] };
  }
  const r = transition(s.state, 'tick', now, d, readingOptions(o));
  const history: HistoryEntry[] = [];
  if (r.event.type === 'phase-completed' && r.event.historyEntry) {
    // transition 已完成 focus → historyEntry.duration = 读书预设 45min；target 已挂书
    history.push(r.event.historyEntry);
  }
  return { session: { ...s, state: r.state, lastActiveAt: now }, history };
}

/**
 * 读书番茄钟超时恢复（ticket 62 修订：不补算）：Obsidian 关闭/重启期间的时间不折算成历史。
 * 若会话有 lastActiveAt → 按该时刻结算「关闭前实读时长」入读书历史（封顶满段），会话结束（不恢复自动流转）；
 * 无 lastActiveAt（旧数据）→ 放弃该段结算。prevState 保留供 ui 恢复（主番茄钟此时已回空闲则由 ui 忽略）。
 */
export function recoverReadingSession(
  s: ReadingSession,
  now: number,
  d: Durations,
  o: PomodoroOptions
): { session: ReadingSession; history: HistoryEntry[] } {
  const settled: HistoryEntry[] = [];
  if (s.active && s.book && typeof s.lastActiveAt === 'number' && s.state.phase === 'focus' && s.state.endTime !== null) {
    const full = phaseDurationSec('focus', d) * 1000;
    const elapsedMs = Math.max(0, Math.min(full, full - (s.state.endTime - s.lastActiveAt)));
    if (elapsedMs > 0) {
      settled.push({ ts: now, duration: Math.round(elapsedMs / 1000), target: bookTarget(s.book) });
    }
  }
  return {
    session: { ...emptyReadingSession(), prevState: s.prevState, lastActiveAt: undefined },
    history: settled,
  };
}

/**
 * 结算当前读书段按实读时长入账（读专注 → 实读秒数入读书历史；读书休息 → 不计）。
 * 用于：中途关书、换书。实读 = 截至 now 的段内流逝秒数，封顶满段时长。
 */
export function settleReadingSegment(s: ReadingSession, now: number, d: Durations): HistoryEntry[] {
  if (!s.active || !s.book) return [];
  const st = s.state;
  if (st.phase !== 'focus') return []; // 休息段不记读书时长
  const full = phaseDurationSec('focus', d) * 1000;
  const elapsedMs = st.endTime !== null ? Math.max(0, Math.min(full, full - (st.endTime - now))) : Math.max(0, Math.min(full, full - st.remaining * 1000));
  if (elapsedMs <= 0) return [];
  return [{ ts: now, duration: Math.round(elapsedMs / 1000), target: bookTarget(s.book) }];
}

/**
 * 结束读书番茄钟（关闭书）：结算当前段实读时长入读书历史，返回空会话 + 主番茄钟快照。
 */
export function endReadingSession(
  s: ReadingSession,
  now: number,
  d: Durations
): { session: ReadingSession; settled: HistoryEntry[]; prevState: PomodoroState | null } {
  const settled = settleReadingSegment(s, now, d);
  return {
    session: emptyReadingSession(),
    settled,
    prevState: s.prevState,
  };
}

/**
 * 数据层容错归一：段级校验非法即回退空会话；state 用 phase 白名单校验。
 */
export function normalizeReadingSession(raw: any): ReadingSession {
  const def = emptyReadingSession();
  if (!raw || typeof raw !== 'object') return def;
  const book = isValidBook(raw.book) ? raw.book : null;
  const active = raw.active === true && book !== null && isValidPhase(phaseOf(raw.state));
  if (!active) return def;
  const st = normalizeReadingState(raw.state, book);
  return {
    active: true,
    book,
    state: st,
    prevState: raw.prevState && typeof raw.prevState === 'object' ? raw.prevState : null,
    lastActiveAt: typeof raw.lastActiveAt === 'number' ? raw.lastActiveAt : undefined,
  };
}

function phaseOf(st: any): string {
  return st && typeof st === 'object' && typeof st.phase === 'string' ? st.phase : '';
}

function isValidPhase(p: string): boolean {
  return p === 'focus' || p === 'short-break' || p === 'long-break';
}

function normalizeReadingState(st: any, book: ReadingBook): PomodoroState {
  const base: PomodoroState = {
    phase: isValidPhase(st?.phase) ? st.phase : 'focus',
    endTime: typeof st?.endTime === 'number' ? st.endTime : null,
    remaining: typeof st?.remaining === 'number' && st.remaining >= 0 ? st.remaining : 0,
    paused: st?.paused === true,
    cycleFocusCount: typeof st?.cycleFocusCount === 'number' && st.cycleFocusCount >= 0 ? st.cycleFocusCount : 0,
    target: bookTarget(book),
  };
  return base;
}

/** ReadingBook 合法性（path 字符串 + title 字符串，依 epub-link 接口） */
function isValidBook(b: any): b is ReadingBook {
  return !!b && typeof b === 'object' && typeof b.path === 'string' && !!b.path && typeof b.title === 'string' && !!b.title;
}

/** 测试钩子：默认选项（autoCycle 恒真） */
export function readingDefaultOptions(): PomodoroOptions {
  return DEFAULT_OPTIONS;
}