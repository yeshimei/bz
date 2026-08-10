/**
 * 番茄钟状态机（ticket 27）：纯函数 transition/recover，无 DOM 依赖。
 * 阶段：idle/focus/short-break/long-break；每 N 个专注（longBreakInterval）后进长休息并清零循环计数。
 * 语义（issue 26 grilling 定稿）：
 * - start：idle/停止态 → 开始当前阶段；暂停态 → 恢复
 * - pause/reset/skip 在强制专注模式下对 focus 阶段禁用
 * - skip 不记历史、不计循环计数
 * - tick 超时 = 阶段完成（自然完成的专注记 history）
 * - autoCycle：完成自动流转并立即开始下一阶段；autoSkipBreak：专注后直接开始下一专注（自动）
 */
export type Phase = 'idle' | 'focus' | 'short-break' | 'long-break';
export type PomodoroAction = 'start' | 'pause' | 'resume' | 'reset' | 'skip' | 'tick';

export interface PomodoroState {
  phase: Phase;
  /** 运行中截止时间戳（ms）；暂停/停止为 null */
  endTime: number | null;
  /** 剩余秒（暂停/停止时有效） */
  remaining: number;
  paused: boolean;
  /** 当前循环内已完成专注数（进长休后清零） */
  cycleFocusCount: number;
}

export interface Durations {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** 几个专注后进长休息（N，默认 4） */
  longBreakInterval: number;
}

export interface PomodoroOptions {
  forceFocus: boolean;
  autoCycle: boolean;
  autoSkipBreak: boolean;
}

export interface HistoryEntry {
  /** 完成时刻时间戳（ms） */
  ts: number;
  /** 实际专注时长（秒） */
  duration: number;
}

export type PomodoroEvent =
  | { type: 'none' }
  | { type: 'started'; phase: Phase }
  | {
      type: 'phase-completed';
      completedPhase: Phase;
      nextPhase: Phase;
      autoStarted: boolean;
      /** focus 完成时是否为长休息 */
      longBreak: boolean;
      /** focus 自然完成时的历史记录（skip 无） */
      historyEntry?: HistoryEntry;
    };

export interface TransitionResult {
  state: PomodoroState;
  event: PomodoroEvent;
}

/** 默认时长（经典 25/5/15、N=4）——settings 注入由 T31 接入 */
export const DEFAULT_DURATIONS: Durations = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakInterval: 4 };
export const DEFAULT_OPTIONS: PomodoroOptions = { forceFocus: false, autoCycle: false, autoSkipBreak: false };

export function createInitialState(): PomodoroState {
  return { phase: 'idle', endTime: null, remaining: 0, paused: false, cycleFocusCount: 0 };
}

/** 合法阶段白名单（数据层校验用） */
export const PHASES: Phase[] = ['idle', 'focus', 'short-break', 'long-break'];

/** 恢复暂停：endTime = now + remaining（start 暂停分支与 resume 共用） */
function resumePhase(state: PomodoroState, now: number): TransitionResult {
  return {
    state: { ...state, paused: false, remaining: 0, endTime: now + state.remaining * 1000 },
    event: { type: 'started', phase: state.phase },
  };
}

/** idle 视作未开始的 focus（start/reset/skip 共用） */
function activePhase(phase: Phase): Phase {
  return phase === 'idle' ? 'focus' : phase;
}

/** 超时重建最大流转步数（防 autoCycle 极端情况死循环） */
const MAX_RECOVER_STEPS = 100;

/** 阶段满时长（秒）——UI 进度条/默认显示共用 */
export function phaseDurationSec(phase: Phase, d: Durations): number {
  if (phase === 'short-break') return d.shortBreakMin * 60;
  if (phase === 'long-break') return d.longBreakMin * 60;
  return d.workMin * 60;
}

/** focus 完成后进入的休息阶段（按循环计数判断长休） */
function breakPhase(count: number, d: Durations): Phase {
  return count >= d.longBreakInterval ? 'long-break' : 'short-break';
}

/** 从「未开始」态启动计时 */
function startPhase(state: PomodoroState, phase: Phase, now: number, d: Durations): TransitionResult {
  return {
    state: { ...state, phase, endTime: now + phaseDurationSec(phase, d) * 1000, paused: false, remaining: 0 },
    event: { type: 'started', phase },
  };
}

/** 阶段完成流转（tick 超时自然完成；skip 走独立分支，不共用本函数） */
function completePhase(state: PomodoroState, now: number, d: Durations, o: PomodoroOptions): TransitionResult {
  const phase = state.phase;
  const isFocus = phase === 'focus';
  let count = state.cycleFocusCount;
  let historyEntry: HistoryEntry | undefined;
  let longBreak = false;
  if (isFocus) {
    count += 1;
    longBreak = count >= d.longBreakInterval;
    if (longBreak) count = 0;
    // duration = 活跃专注时长：暂停期间时间不流逝（endTime 顺延），故恒等于名义工作时长
    historyEntry = { ts: now, duration: d.workMin * 60 };
  }
  // 下一阶段
  let next: Phase;
  let autoStarted = false;
  if (isFocus) {
    if (o.autoSkipBreak) {
      next = 'focus'; // 连续工作模式：直接开始下一专注（自带自动开始）
      autoStarted = true;
    } else {
      next = longBreak ? 'long-break' : 'short-break';
      autoStarted = o.autoCycle;
    }
  } else {
    next = 'focus';
    autoStarted = o.autoCycle;
  }
  const nextState: PomodoroState = { ...state, phase: next, cycleFocusCount: count };
  const res = autoStarted
    ? startPhase(nextState, next, now, d)
    : {
        state: { ...nextState, endTime: null, paused: false, remaining: phaseDurationSec(next, d) },
        event: { type: 'none' as const },
      };
  return {
    ...res,
    event: {
      type: 'phase-completed',
      completedPhase: phase,
      nextPhase: next,
      autoStarted,
      longBreak,
      ...(historyEntry ? { historyEntry } : {}),
    },
  };
}

/**
 * 状态机主入口：纯函数，返回新状态 + 事件。
 * 事件仅供调用方（通知/统计），状态流转本身不依赖事件消费。
 */
export function transition(state: PomodoroState, action: PomodoroAction, now: number, d: Durations, o: PomodoroOptions): TransitionResult {
  if (action === 'start') {
    if (state.paused) return resumePhase(state, now);
    if (state.endTime !== null) return { state, event: { type: 'none' } };
    const phase = activePhase(state.phase);
    return startPhase(state, phase, now, d);
  }
  if (action === 'pause') {
    if (state.endTime === null) return { state, event: { type: 'none' } };
    if (o.forceFocus && state.phase === 'focus') return { state, event: { type: 'none' } };
    return {
      state: { ...state, paused: true, remaining: Math.ceil((state.endTime - now) / 1000), endTime: null },
      event: { type: 'none' },
    };
  }
  if (action === 'resume') {
    if (!state.paused) return { state, event: { type: 'none' } };
    return resumePhase(state, now);
  }
  if (action === 'reset') {
    if (o.forceFocus && state.phase === 'focus') return { state, event: { type: 'none' } };
    const phase = activePhase(state.phase);
    return {
      state: { ...state, phase, endTime: null, paused: false, remaining: phaseDurationSec(phase, d) },
      event: { type: 'none' },
    };
  }
  if (action === 'skip') {
    if (o.forceFocus && state.phase === 'focus') return { state, event: { type: 'none' } };
    const phase = activePhase(state.phase);
    let next: Phase;
    if (phase === 'focus') next = o.autoSkipBreak ? 'focus' : breakPhase(state.cycleFocusCount, d);
    else next = 'focus';
    return {
      state: { ...state, phase: next, endTime: null, paused: false, remaining: phaseDurationSec(next, d) },
      event: { type: 'phase-completed', completedPhase: phase, nextPhase: next, autoStarted: false, longBreak: false },
    };
  }
  if (action === 'tick') {
    if (state.endTime === null || now < state.endTime) return { state, event: { type: 'none' } };
    return completePhase(state, now, d, o);
  }
  return { state, event: { type: 'none' } };
}

/** 超时恢复：循环 tick 直到不再超时（Obsidian 关闭期间时间流逝），返回新状态/历史/事件序列 */
export function recover(
  state: PomodoroState,
  history: HistoryEntry[],
  now: number,
  d: Durations,
  o: PomodoroOptions
): { state: PomodoroState; history: HistoryEntry[]; events: PomodoroEvent[] } {
  let s = state;
  const h = history.slice();
  const events: PomodoroEvent[] = [];
  let guard = 0;
  while (s.endTime !== null && now >= s.endTime && guard < MAX_RECOVER_STEPS) {
    // 完成时刻 = 段自身的 endTime（长时间离开时逐段推进，而非用固定 now）
    const r = transition(s, 'tick', s.endTime, d, o);
    if (r.event.type === 'phase-completed' && r.event.historyEntry) h.push(r.event.historyEntry);
    events.push(r.event);
    s = r.state;
    guard += 1;
  }
  return { state: s, history: h, events };
}
