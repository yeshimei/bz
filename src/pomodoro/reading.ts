/**
 * 独立读书计时（ticket 56）：与主番茄钟状态机解耦的读书会话累计。
 * - 打开 epub 书 → 快照主番茄钟状态并挂起（主 endTime 冻结），另起独立读书会话端到端累计阅读时长；
 *   累计 = elapsedMs + (now - startedAt)，endTime 基准天然抗 Obsidian 后台节流与重启（不漏时）。
 * - 关闭/换书 → 结算当前会话累计时长 → 以 target.type=book 的历史条目「单独入账」→ 恢复挂起的主番茄钟快照。
 * - 纯函数（无 DOM），时间一律由调用方传入（now），ui.ts 负责接线与落盘。
 */
import type { PomodoroState } from './state';
import { createInitialState } from './state';
import type { ReadingBook } from './epub-link';

export interface ReadingSession {
  /** 读书会话是否进行中（打开书且未关） */
  active: boolean;
  /** 当前阅读的书（无会话为 null） */
  book: ReadingBook | null;
  /** 已结算累计时长（ms，不含当前进行段） */
  elapsedMs: number;
  /** 当前进行段起点时间戳（ms；active 时有效） */
  startedAt: number | null;
  /** 进入读书前的主番茄钟快照（关书恢复用；无会话为 null） */
  prevState: PomodoroState | null;
}

/** 空会话（默认） */
export function emptyReadingSession(): ReadingSession {
  return { active: false, book: null, elapsedMs: 0, startedAt: null, prevState: null };
}

/** 当前累计阅读时长（ms）：进行段已走净值 + 已结算；endTime 基准，后台节流/重启不漏时 */
export function readingElapsedMs(s: ReadingSession, now: number): number {
  return s.active && s.startedAt !== null ? s.elapsedMs + Math.max(0, now - s.startedAt) : s.elapsedMs;
}

/**
 * 开始读书会话：快照主番茄钟（进入读书前的完整状态，含运行中 endTime，供关书恢复）
 * 返回新会话。挂起主番茄钟由调用方处理（冻结主 endTime、停主 tick）。
 */
export function startReadingSession(
  prevState: PomodoroState,
  book: ReadingBook,
  now: number
): ReadingSession {
  return { active: true, book, elapsedMs: 0, startedAt: now, prevState };
}

/** 换书（Q6：直接切）：结算当前书累计，返回新书会话 + 已结算时长（ms） */
export function switchReadingBook(
  s: ReadingSession,
  book: ReadingBook,
  now: number
): { session: ReadingSession; settledMs: number } {
  return {
    session: { ...s, book, elapsedMs: 0, startedAt: now },
    settledMs: readingElapsedMs(s, now),
  };
}

/**
 * 结束读书会话：结算当前累计，返回空会话 + 结算时长（ms） + 主番茄钟快照（关书恢复）。
 * settledMs > 0 才入读书历史；快照用于恢复挂起的主番茄钟。
 */
export function endReadingSession(
  s: ReadingSession,
  now: number
): { session: ReadingSession; settledMs: number; prevState: PomodoroState | null } {
  return {
    session: { active: false, book: null, elapsedMs: 0, startedAt: null, prevState: null },
    settledMs: readingElapsedMs(s, now),
    prevState: s.prevState,
  };
}

/** 会话是否进行中 */
export function isReadingActive(s: ReadingSession): boolean {
  return s.active;
}

/**
 * 数据层容错归一（data.ts 复用）：逐字段校验，非法回退空会话。
 * 保证旧数据（无 reading 字段）或缺字段 → 空会话，不破坏。
 */
export function normalizeReadingSession(raw: any): ReadingSession {
  const def = emptyReadingSession();
  if (!raw || typeof raw !== 'object') return def;
  const book = isValidBook(raw.book) ? raw.book : null;
  // 自洽性：active 为真但缺合法 book / 合法起点 → 视为未进行（防结构不一致）
  const active = raw.active === true && book !== null && typeof raw.startedAt === 'number' && raw.startedAt >= 0;
  return {
    active,
    book,
    elapsedMs: typeof raw.elapsedMs === 'number' && raw.elapsedMs >= 0 ? raw.elapsedMs : 0,
    startedAt: active ? raw.startedAt : null,
    prevState: raw.prevState && typeof raw.prevState === 'object' ? raw.prevState : null,
  };
}

/** ReadingBook 合法性（path 字符串 + title 字符串，依 epub-link 接口） */
function isValidBook(b: any): b is ReadingBook {
  return !!b && typeof b === 'object' && typeof b.path === 'string' && !!b.path && typeof b.title === 'string' && !!b.title;
}

/** 测试钩子：默认空状态（createInitialState 复用语义） */
export function readingPrevDefault(): PomodoroState {
  return createInitialState();
}