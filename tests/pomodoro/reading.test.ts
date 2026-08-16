/**
 * 独立读书计时纯函数测试（ticket 56）：会话累计（endTime 基准，后台节流/重启不漏时）/开始/换书/结束结算/归一。
 */
import { describe, it, expect } from 'vitest';
import {
  emptyReadingSession,
  startReadingSession,
  switchReadingBook,
  endReadingSession,
  readingElapsedMs,
  isReadingActive,
  normalizeReadingSession,
} from '../../src/pomodoro/reading';
import { createInitialState } from '../../src/pomodoro/state';
import type { PomodoroState } from '../../src/pomodoro/state';

const T0 = new Date('2026-08-10T10:00:00').getTime();
const BOOK_A = { path: '书架/活着.epub', title: '活着' };
const BOOK_B = { path: '书架/百年孤独.epub', title: '百年孤独' };

function runningState(): PomodoroState {
  return { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: null };
}

describe('readingElapsedMs / isReadingActive', () => {
  it('空会话 → active false、累计 0', () => {
    const s = emptyReadingSession();
    expect(isReadingActive(s)).toBe(false);
    expect(readingElapsedMs(s, T0 + 1000)).toBe(0);
  });

  it('开始会话 → 快照 prevState、累计 = now - startedAt（endTime 基准）', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0);
    expect(isReadingActive(s)).toBe(true);
    expect(s.book).toEqual(BOOK_A);
    expect(s.prevState).toEqual(runningState()); // 快照保留主番茄钟完整状态
    expect(readingElapsedMs(s, T0 + 5000)).toBe(5000);
    expect(readingElapsedMs(s, T0 + 30_000)).toBe(30_000); // 直接按时间差算，与 tick 无关
  });

  it('后台节流/重启不漏时：startedAt 较早时累计按真实时差补足', () => {
    const s = startReadingSession(createInitialState(), BOOK_A, T0);
    expect(readingElapsedMs(s, T0 + 120_000)).toBe(120_000);
  });
});

describe('switchReadingBook（换书）', () => {
  it('换书：旧书累计结算 → startedAt 重置为新书', () => {
    let s = startReadingSession(createInitialState(), BOOK_A, T0);
    const { session, settledMs } = switchReadingBook(s, BOOK_B, T0 + 4000);
    expect(settledMs).toBe(4000); // 旧书 A 累计结算
    expect(session.active).toBe(true);
    expect(session.book).toEqual(BOOK_B);
    expect(session.startedAt).toBe(T0 + 4000); // 新书起点
    expect(session.elapsedMs).toBe(0);
    expect(readingElapsedMs(session, T0 + 4000 + 1000)).toBe(1000); // 换书后新累计
    s = session;
    const r2 = switchReadingBook(s, BOOK_A, T0 + 6000);
    expect(r2.settledMs).toBe(2000);
    expect(r2.session.book).toEqual(BOOK_A);
  });
});

describe('endReadingSession（关书结算 + 恢复快照）', () => {
  it('结束：空会话、返回结算时长 + prevState 快照', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0);
    const { session, settledMs, prevState } = endReadingSession(s, T0 + 10_000);
    expect(settledMs).toBe(10_000);
    expect(prevState).toEqual(runningState()); // 关书恢复主番茄钟
    expect(session.active).toBe(false);
    expect(session.book).toBeNull();
    expect(session.startedAt).toBeNull();
    expect(readingElapsedMs(session, T0 + 20_000)).toBe(0);
  });

  it('未进行（idle）结束 → settledMs 0、prevState null', () => {
    const { session, settledMs, prevState } = endReadingSession(emptyReadingSession(), T0 + 1000);
    expect(settledMs).toBe(0);
    expect(prevState).toBeNull();
    expect(session.active).toBe(false);
  });
});

describe('normalizeReadingSession（数据容错）', () => {
  it('正常 round-trip 保留', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0);
    const n = normalizeReadingSession(s);
    expect(n).toEqual(s);
  });

  it('旧数据无 reading / null / 非对象 → 空会话', () => {
    expect(normalizeReadingSession(undefined)).toEqual(emptyReadingSession());
    expect(normalizeReadingSession(null)).toEqual(emptyReadingSession());
    expect(normalizeReadingSession('x')).toEqual(emptyReadingSession());
  });

  it('active 真但缺合法 book / 起点 → 归一为未进行（结构自洽）', () => {
    const n = normalizeReadingSession({ active: true, book: { path: 3 }, startedAt: T0, elapsedMs: 0 });
    expect(n.active).toBe(false);
    expect(n.book).toBeNull();
    expect(n.startedAt).toBeNull();
  });

  it('elapsedMs 负数 / startedAt 非法 → 回退', () => {
    const n = normalizeReadingSession({ active: false, book: null, startedAt: -1, elapsedMs: -5 });
    expect(n.elapsedMs).toBe(0);
    expect(n.startedAt).toBeNull();
    expect(n.active).toBe(false);
  });
});