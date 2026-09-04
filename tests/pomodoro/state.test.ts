// @vitest-environment node
/**
 * 番茄钟状态机纯函数测试（ticket 27）：transition/recover
 * 缝：状态机纯函数（FSRS 先例）——无 DOM 依赖，node 环境。
 */
import { describe, it, expect } from 'vitest';
import { transition, recover, DEFAULT_DURATIONS, DEFAULT_OPTIONS, createInitialState } from '../../src/pomodoro/state';
import type { PomodoroState } from '../../src/pomodoro/state';

const NOW = 1_000_000_000; // 固定基准时间戳
const D = DEFAULT_DURATIONS; // 25/5/15、N=4
const O = DEFAULT_OPTIONS; // forceFocus/autoCycle/autoSkipBreak 全关
const WORK_MS = 25 * 60 * 1000;
const SHORT_MS = 5 * 60 * 1000;
const LONG_MS = 15 * 60 * 1000;

describe('transition：基本控制', () => {
  it('start：idle → focus 运行中（endTime = now + work）', () => {
    const r = transition(createInitialState(), 'start', NOW, D, O);
    expect(r.state.phase).toBe('focus');
    expect(r.state.endTime).toBe(NOW + WORK_MS);
    expect(r.state.paused).toBe(false);
    expect(r.state.remaining).toBe(0);
    expect(r.state.cycleFocusCount).toBe(0);
    expect(r.event.type).toBe('started');
  });

  it('start：运行中 → 无操作', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'start', NOW + 1000, D, O);
    expect(r.state).toBe(running);
    expect(r.event.type).toBe('none');
  });

  it('start：暂停态 → 恢复（resume 语义）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const paused = transition(running, 'pause', NOW + 10_000, D, O).state;
    expect(paused.paused).toBe(true);
    const r = transition(paused, 'start', NOW + 20_000, D, O);
    expect(r.state.paused).toBe(false);
    expect(r.state.endTime).toBe(NOW + 20_000 + paused.remaining * 1000);
    expect(r.event.type).toBe('started');
  });

  it('pause：运行中 → 暂停（remaining 取整、endTime 置空）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'pause', NOW + 90_000, D, O); // 已走 90s，剩 25*60-90=1410s
    expect(r.state.paused).toBe(true);
    expect(r.state.endTime).toBeNull();
    expect(r.state.remaining).toBe(25 * 60 - 90);
    expect(r.event.type).toBe('none');
  });

  it('pause：非运行态 → 无操作', () => {
    const idle = createInitialState();
    const r = transition(idle, 'pause', NOW, D, O);
    expect(r.state).toBe(idle);
    expect(r.event.type).toBe('none');
  });

  it('resume：endTime = now + remaining', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const paused = transition(running, 'pause', NOW + 60_000, D, O).state;
    const r = transition(paused, 'resume', NOW + 120_000, D, O);
    expect(r.state.paused).toBe(false);
    expect(r.state.remaining).toBe(0);
    expect(r.state.endTime).toBe(NOW + 120_000 + paused.remaining * 1000);
  });

  it('resume：非暂停态 → 无操作', () => {
    const idle = createInitialState();
    const r = transition(idle, 'resume', NOW, D, O);
    expect(r.state).toBe(idle);
  });

  it('reset：回满当前阶段时长并停止', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'reset', NOW + 5 * 60_000, D, O);
    expect(r.state.endTime).toBeNull();
    expect(r.state.paused).toBe(false);
    expect(r.state.remaining).toBe(25 * 60);
    expect(r.state.phase).toBe('focus');
    expect(r.event.type).toBe('none');
  });

  it('skip：focus → short-break 未开始（不计历史、cycleFocusCount 不增）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'skip', NOW + 60_000, D, O);
    expect(r.state.phase).toBe('short-break');
    expect(r.state.endTime).toBeNull();
    expect(r.state.remaining).toBe(5 * 60);
    expect(r.state.cycleFocusCount).toBe(0);
    expect(r.event.type).toBe('phase-completed');
  });

  it('skip：short-break → focus 未开始', () => {
    let s = transition(createInitialState(), 'start', NOW, D, O).state;
    s = transition(s, 'skip', NOW + 1000, D, O).state; // → short-break
    const r = transition(s, 'skip', NOW + 2000, D, O);
    expect(r.state.phase).toBe('focus');
    expect(r.state.endTime).toBeNull();
    expect(r.state.remaining).toBe(25 * 60);
  });
});

describe('transition：强制专注模式（forceFocus）', () => {
  const FF = { ...O, forceFocus: true };

  it('focus 运行中 pause → 禁止', () => {
    const running = transition(createInitialState(), 'start', NOW, D, FF).state;
    const r = transition(running, 'pause', NOW + 1000, D, FF);
    expect(r.state.paused).toBe(false);
    expect(r.state.endTime).toBe(running.endTime);
    expect(r.event.type).toBe('none');
  });

  it('focus 运行中 reset → 禁止', () => {
    const running = transition(createInitialState(), 'start', NOW, D, FF).state;
    const r = transition(running, 'reset', NOW + 1000, D, FF);
    expect(r.state.remaining).toBe(0);
    expect(r.state.endTime).toBe(running.endTime);
  });

  it('focus 运行中 skip → 禁止', () => {
    const running = transition(createInitialState(), 'start', NOW, D, FF).state;
    const r = transition(running, 'skip', NOW + 1000, D, FF);
    expect(r.state.phase).toBe('focus');
    expect(r.state.endTime).toBe(running.endTime);
  });

  it('休息阶段 pause/reset/skip 不受限', () => {
    let s = transition(createInitialState(), 'start', NOW, D, FF).state;
    s = transition(s, 'tick', NOW + WORK_MS, D, FF).state; // focus 自然完成 → short-break 未开始
    expect(s.phase).toBe('short-break');
    s = transition(s, 'start', NOW + WORK_MS + 1000, D, FF).state; // 开始休息
    const p = transition(s, 'pause', NOW + WORK_MS + 2000, D, FF);
    expect(p.state.paused).toBe(true);
    const r = transition(p.state, 'reset', NOW + WORK_MS + 3000, D, FF);
    expect(r.state.remaining).toBe(5 * 60);
    const k = transition(r.state, 'skip', NOW + WORK_MS + 4000, D, FF);
    expect(k.state.phase).toBe('focus');
  });
});

describe('transition：tick 阶段完成', () => {
  it('tick 未超时 → 无操作', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'tick', NOW + 1000, D, O);
    expect(r.state).toBe(running);
    expect(r.event.type).toBe('none');
  });

  it('focus 超时完成 → short-break 未开始 + focus-completed（historyEntry duration=work）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'tick', NOW + WORK_MS, D, O);
    expect(r.state.phase).toBe('short-break');
    expect(r.state.endTime).toBeNull();
    expect(r.state.remaining).toBe(5 * 60);
    expect(r.state.cycleFocusCount).toBe(1);
    expect(r.event.type).toBe('phase-completed');
    const fc = r.event as any;
    expect(fc.completedPhase).toBe('focus');
    expect(fc.historyEntry).toEqual({ ts: NOW + WORK_MS, duration: 25 * 60 });
  });

  it('第 N 个专注完成 → long-break 且循环计数清零', () => {
    // 完整走 4 个专注（每个：focus → short-break 走完 → 下一 focus），第 4 个后进长休
    const completeFocus = (s: any, t: number): any => {
      s = transition(s, 'start', t, D, O).state;
      s = transition(s, 'tick', t + WORK_MS, D, O).state; // focus 完成
      return s;
    };
    const completeBreak = (s: any, t: number): any => {
      s = transition(s, 'start', t, D, O).state; // short-break 开始
      s = transition(s, 'tick', t + SHORT_MS, D, O).state; // 休息完成 → focus 未开始
      return s;
    };
    let s = createInitialState();
    let t = NOW;
    s = completeFocus(s, t); // #1
    expect(s.cycleFocusCount).toBe(1);
    t = t + WORK_MS + 1000;
    s = completeBreak(s, t);
    s = completeFocus(s, t + SHORT_MS + 1000); // #2
    expect(s.cycleFocusCount).toBe(2);
    t = t + SHORT_MS + WORK_MS + 2000;
    s = completeBreak(s, t);
    s = completeFocus(s, t + SHORT_MS + 1000); // #3
    expect(s.cycleFocusCount).toBe(3);
    t = t + SHORT_MS + WORK_MS + 2000;
    s = completeBreak(s, t);
    s = completeFocus(s, t + SHORT_MS + 1000); // #4 → 长休
    expect(s.phase).toBe('long-break');
    expect(s.cycleFocusCount).toBe(0);
    expect(s.remaining).toBe(15 * 60);
  });

  it('休息超时完成 → focus 未开始', () => {
    let s = transition(createInitialState(), 'start', NOW, D, O).state;
    s = transition(s, 'tick', NOW + WORK_MS, D, O).state; // → short-break
    s = transition(s, 'start', NOW + WORK_MS + 1000, D, O).state;
    const r = transition(s, 'tick', NOW + WORK_MS + 1000 + SHORT_MS, D, O);
    expect(r.state.phase).toBe('focus');
    expect(r.state.endTime).toBeNull();
    expect(r.state.remaining).toBe(25 * 60);
    expect(r.state.cycleFocusCount).toBe(1);
  });

  it('autoCycle：完成自动流转并立即开始下一阶段', () => {
    const AC = { ...O, autoCycle: true };
    const running = transition(createInitialState(), 'start', NOW, D, AC).state;
    const r = transition(running, 'tick', NOW + WORK_MS, D, AC);
    expect(r.state.phase).toBe('short-break');
    expect(r.state.endTime).toBe(NOW + WORK_MS + SHORT_MS); // 自动开始
    expect(r.state.cycleFocusCount).toBe(1);
    expect((r.event as any).autoStarted).toBe(true);
  });

  it('autoSkipBreak：focus 完成后直接进入下一 focus（自动开始）', () => {
    const AS = { ...O, autoSkipBreak: true };
    // 连续 4 个专注：逐段 tick 推进（ticket 62 recover 不补算，改用 transition 显式推进）
    let s = transition(createInitialState(), 'start', NOW, D, AS).state;
    for (let i = 0; i < 4; i++) {
      const r = transition(s, 'tick', NOW + (i + 1) * WORK_MS, D, AS);
      expect(r.state.phase).toBe('focus'); // autoSkipBreak 恒回 focus
      expect(r.state.endTime).toBe(NOW + (i + 2) * WORK_MS);
      // 第 4 个完成 → 计数清零（长休被跳过，仍回 focus）
      expect(r.state.cycleFocusCount).toBe(i === 3 ? 0 : i + 1);
      s = r.state;
    }
    expect(s.phase).toBe('focus');
  });

  it('idle tick → 无操作', () => {
    const r = transition(createInitialState(), 'tick', NOW, D, O);
    expect(r.state.phase).toBe('idle');
    expect(r.event.type).toBe('none');
  });
});

describe('recover：超时恢复（ticket 62 不补算）', () => {
  it('运行中已超时 → 回空闲（剩余作废、不记历史、无事件）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const { state, history, events } = recover(running, [], NOW + WORK_MS + 60_000, D, O);
    expect(state.phase).toBe('idle');
    expect(state.endTime).toBeNull();
    expect(state.remaining).toBe(0);
    expect(history.length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('未超时（now < endTime）→ 状态原样', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const { state, history, events } = recover(running, [], NOW + WORK_MS - 60_000, D, O);
    expect(state).toBe(running);
    expect(history.length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('暂停态 → 不流转（保持暂停）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const paused = transition(running, 'pause', NOW + 60_000, D, O).state;
    const { state, history } = recover(paused, [], NOW + 3_600_000, D, O);
    expect(state).toBe(paused);
    expect(history.length).toBe(0);
  });

  it('空闲态 → 不流转', () => {
    const { state, history, events } = recover(createInitialState(), [], NOW + 3_600_000, D, O);
    expect(state.phase).toBe('idle');
    expect(history.length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('autoCycle + 长时间离开 → 回空闲、不把离开时长编造成历史（ticket 62 不再逐段补算）', () => {
    const AC = { ...O, autoCycle: true };
    const running = transition(createInitialState(), 'start', NOW, D, AC).state;
    const awayMs = (WORK_MS + SHORT_MS) * 2 + WORK_MS + SHORT_MS + 60_000;
    const { state, history, events } = recover(running, [], NOW + awayMs, D, AC);
    expect(state.phase).toBe('idle');
    expect(state.endTime).toBeNull();
    expect(history.length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('冻结暂停态（pausedBy=autopause）→ 原样保留不流转（P1-4：标记供重启后 locked 判定放行）', () => {
    const frozen: PomodoroState = {
      phase: 'focus',
      endTime: null,
      remaining: 1200,
      paused: true,
      pausedBy: 'autopause',
      cycleFocusCount: 0,
    };
    const { state, history, events } = recover(frozen, [], NOW + 3_600_000, D, O);
    expect(state).toBe(frozen);
    expect(state.pausedBy).toBe('autopause');
    expect(history.length).toBe(0);
    expect(events.length).toBe(0);
  });
});

describe('pausedBy 暂停来源标记（P1-4：冻结 vs 手动）', () => {
  /** 后台自动暂停冻结态样例 */
  const frozen: PomodoroState = {
    phase: 'focus',
    endTime: null,
    remaining: 1200,
    paused: true,
    pausedBy: 'autopause',
    cycleFocusCount: 0,
  };

  it('resume：清除标记并恢复运行', () => {
    const r = transition(frozen, 'resume', NOW, D, O);
    expect(r.state.paused).toBe(false);
    expect(r.state.endTime).toBe(NOW + 1200 * 1000);
    expect(r.state.pausedBy).toBeUndefined();
    expect(r.event.type).toBe('started');
  });

  it('start：暂停态恢复（resume 语义）同样清除标记', () => {
    const r = transition(frozen, 'start', NOW, D, O);
    expect(r.state.paused).toBe(false);
    expect(r.state.pausedBy).toBeUndefined();
  });

  it('reset / skip：离开暂停态时清除标记', () => {
    const r = transition(frozen, 'reset', NOW, D, O);
    expect(r.state.paused).toBe(false);
    expect(r.state.pausedBy).toBeUndefined();
    const s = transition({ ...frozen, phase: 'short-break' }, 'skip', NOW, D, O);
    expect(s.state.phase).toBe('focus');
    expect(s.state.pausedBy).toBeUndefined();
  });

  it('手动 pause：不携带来源标记（保持 undefined，重启后维持锁定）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'pause', NOW + 60_000, D, O);
    expect(r.state.paused).toBe(true);
    expect(r.state.pausedBy).toBeUndefined();
  });
});

describe('任务归属（增强包：待办「专注这个」联动）', () => {
  const TASK = '完成阅读报告';
  const withTask = (s: PomodoroState): PomodoroState => ({ ...s, task: TASK });

  it('focus 自然完成 → historyEntry 带 task；state.task 落账后清除', () => {
    const running = transition(withTask(createInitialState()), 'start', NOW, D, O).state;
    expect(running.task).toBe(TASK); // 运行中归属随状态保留（弹窗/状态栏展示）
    const r = transition(running, 'tick', NOW + WORK_MS, D, O);
    expect((r.event as any).historyEntry).toEqual({ ts: NOW + WORK_MS, duration: 25 * 60, task: TASK });
    expect(r.state.task).toBeUndefined(); // 不流入下一阶段
  });

  it('无归属开始 → historyEntry 不带 task 键（普通开始兼容）', () => {
    const running = transition(createInitialState(), 'start', NOW, D, O).state;
    const r = transition(running, 'tick', NOW + WORK_MS, D, O);
    expect((r.event as any).historyEntry).toEqual({ ts: NOW + WORK_MS, duration: 25 * 60 });
    expect('task' in (r.event as any).historyEntry).toBe(false);
  });

  it('skip 作废归属：不记历史且 state.task 一并清除', () => {
    const running = transition(withTask(createInitialState()), 'start', NOW, D, O).state;
    const r = transition(running, 'skip', NOW + 60_000, D, O);
    expect(r.event.type).toBe('phase-completed');
    expect((r.event as any).historyEntry).toBeUndefined(); // skip 不记历史
    expect(r.state.task).toBeUndefined();
  });

  it('reset 保留归属（未跳过专注，回满重开仍归属该任务）', () => {
    const running = transition(withTask(createInitialState()), 'start', NOW, D, O).state;
    const r = transition(running, 'reset', NOW + 60_000, D, O);
    expect(r.state.task).toBe(TASK);
  });

  it('暂停/恢复保留归属', () => {
    const running = transition(withTask(createInitialState()), 'start', NOW, D, O).state;
    const paused = transition(running, 'pause', NOW + 60_000, D, O).state;
    expect(paused.task).toBe(TASK);
    const resumed = transition(paused, 'resume', NOW + 120_000, D, O).state;
    expect(resumed.task).toBe(TASK);
  });

  it('休息完成 → 无 historyEntry，不产生归属', () => {
    let s = transition(withTask(createInitialState()), 'start', NOW, D, O).state;
    s = transition(s, 'tick', NOW + WORK_MS, D, O).state; // focus 完成（归属落账、task 清除）
    s = transition(s, 'start', NOW + WORK_MS + 1000, D, O).state; // 开始短休
    const r = transition(s, 'tick', NOW + WORK_MS + 1000 + SHORT_MS, D, O);
    expect((r.event as any).historyEntry).toBeUndefined();
    expect(r.state.task).toBeUndefined();
  });
});
