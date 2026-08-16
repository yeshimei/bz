/**
 * 独立读书番茄钟纯函数测试（ticket 56）：读书专注/短休/长休状态机（复用 state.ts）、
 * 开始/换书/关书实读时长结算、tick 记读书历史、超时恢复、数据归一容错。
 */
import { describe, it, expect } from 'vitest';
import {
  emptyReadingSession,
  startReadingSession,
  switchReadingBook,
  endReadingSession,
  tickReadingSession,
  recoverReadingSession,
  settleReadingSegment,
  readingDurations,
  isReadingActive,
  normalizeReadingSession,
} from '../../src/pomodoro/reading';
import { createInitialState } from '../../src/pomodoro/state';
import type { PomodoroState } from '../../src/pomodoro/state';

const T0 = new Date('2026-08-10T10:00:00').getTime();
const BOOK_A = { path: '书架/活着.epub', title: '活着' };
const BOOK_B = { path: '书架/百年孤独.epub', title: '百年孤独' };
const RD = readingDurations(4); // 45/10/20
const OPT = { forceFocus: false, autoCycle: true, autoSkipBreak: false };

function runningState(): PomodoroState {
  return { phase: 'focus', endTime: T0 + 100_000, remaining: 0, paused: false, cycleFocusCount: 0, target: null };
}

describe('startReadingSession（读书番茄钟开始）', () => {
  it('active、book 挂上、从读书专注 45min 开始、prevState 快照主番茄钟', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    expect(isReadingActive(s)).toBe(true);
    expect(s.book).toEqual(BOOK_A);
    expect(s.state.phase).toBe('focus');
    expect(s.state.endTime).toBe(T0 + 45 * 60 * 1000);
    expect(s.state.target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(s.prevState).toEqual(runningState());
  });
});

describe('tickReadingSession（读书番茄钟推进）', () => {
  it('未到 endTime → 无变化', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    const r = tickReadingSession(s, T0 + 1000, RD, OPT);
    expect(r.history).toEqual([]);
    expect(r.session.state.endTime).toBe(T0 + 45 * 60 * 1000);
  });

  it('专注走满 45min → 记读书历史（duration=2700、target=book）→ 流转读书短休 10min', () => {
    let s = startReadingSession(runningState(), BOOK_A, T0, RD);
    const r = tickReadingSession(s, T0 + 45 * 60 * 1000 + 1000, RD, OPT);
    expect(r.history).toHaveLength(1);
    expect(r.history[0].duration).toBe(45 * 60);
    expect(r.history[0].target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
    expect(r.session.state.phase).toBe('short-break');
    expect(r.session.state.endTime).toBe(T0 + 45 * 60 * 1000 + 1000 + 10 * 60 * 1000);
    // 休息走满 10min → 下一段读书专注
    s = r.session;
    const r2 = tickReadingSession(s, T0 + 45 * 60 * 1000 + 1000 + 10 * 60 * 1000 + 1000, RD, OPT);
    expect(r2.history).toEqual([]); // 休息完成不记历史
    expect(r2.session.state.phase).toBe('focus');
  });

  it('每 4 个读书专注 → 读书长休 20min，循环计数清零', () => {
    let s = startReadingSession(runningState(), BOOK_A, T0, RD);
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t += 45 * 60 * 1000 + 1000;
      const rf = tickReadingSession(s, t, RD, OPT); // 专注完成
      s = rf.session;
      const isLast = i === 3;
      const breakPhase = rf.session.state.phase;
      expect(breakPhase).toBe(isLast ? 'long-break' : 'short-break');
      // 短休/长休完成后回到读书专注
      t += (isLast ? 20 : 10) * 60 * 1000 + 1000;
      const rb = tickReadingSession(s, t, RD, OPT);
      s = rb.session;
      expect(s.state.phase).toBe('focus');
    }
    // 第 4 个专注的长休完成后回 focus，cycleFocusCount 已清零
    expect(s.state.cycleFocusCount).toBe(0);
  });
});

describe('settleReadingSegment（中途关书/换书按实读时长结算）', () => {
  it('在读专注中途关 → duration = 实读秒数', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    // 推进 20 分钟（读满 20min）
    const settled = settleReadingSegment(s, T0 + 20 * 60 * 1000, RD);
    expect(settled).toHaveLength(1);
    expect(settled[0].duration).toBe(20 * 60);
    expect(settled[0].target).toEqual({ type: 'book', path: BOOK_A.path, label: '活着' });
  });

  it('在读短休中关书 → 不记读书时长', () => {
    let s = startReadingSession(runningState(), BOOK_A, T0, RD);
    s = tickReadingSession(s, T0 + 45 * 60 * 1000, RD, OPT).session; // 进短休
    expect(s.state.phase).toBe('short-break');
    const settled = settleReadingSegment(s, T0 + 45 * 60 * 1000 + 5000, RD);
    expect(settled).toEqual([]);
  });
});

describe('endReadingSession（关书结算 + 恢复快照）', () => {
  it('聚焦中关书 → 实读入账 + prevState 恢复 + 空会话', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    const { session, settled, prevState } = endReadingSession(s, T0 + 15 * 60 * 1000, RD);
    expect(settled).toHaveLength(1);
    expect(settled[0].duration).toBe(15 * 60);
    expect(prevState).toEqual(runningState());
    expect(session.active).toBe(false);
  });

  it('关书在读短休 → 无历史入账、仅恢复快照', () => {
    let s = startReadingSession(runningState(), BOOK_A, T0, RD);
    s = tickReadingSession(s, T0 + 45 * 60 * 1000, RD, OPT).session;
    const { settled, prevState } = endReadingSession(s, T0 + 45 * 60 * 1000 + 1000, RD);
    expect(settled).toEqual([]);
    expect(prevState).toEqual(runningState());
  });
});

describe('recoverReadingSession（重启超时恢复）', () => {
  it('关闭期间走满专注 → 补记读书历史 + 流转到短休', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    const rec = recoverReadingSession(s, T0 + 45 * 60 * 1000 + 2000, RD, OPT);
    expect(rec.history).toHaveLength(1);
    expect(rec.history[0].duration).toBe(45 * 60);
    expect(rec.session.state.phase).toBe('short-break');
  });
});

describe('normalizeReadingSession（数据容错）', () => {
  it('正常 round-trip 保留', () => {
    const s = startReadingSession(runningState(), BOOK_A, T0, RD);
    const n = normalizeReadingSession(s);
    expect(n.active).toBe(true);
    expect(n.book).toEqual(BOOK_A);
    expect(n.state.phase).toBe('focus');
  });

  it('旧数据无 reading / null / 非对象 → 空会话', () => {
    expect(normalizeReadingSession(undefined)).toEqual(emptyReadingSession());
    expect(normalizeReadingSession(null)).toEqual(emptyReadingSession());
    expect(normalizeReadingSession('x')).toEqual(emptyReadingSession());
  });

  it('active 真但缺合法 book / 合法 phase → 回退空会话（结构自洽）', () => {
    const badBook = normalizeReadingSession({ active: true, book: { path: 3 }, state: { phase: 'focus', endTime: 1, remaining: 0, paused: false, cycleFocusCount: 0 } });
    expect(badBook.active).toBe(false);
    const badPhase = normalizeReadingSession({ active: true, book: BOOK_A, state: { phase: 'evil' } });
    expect(badPhase.active).toBe(false);
  });
});