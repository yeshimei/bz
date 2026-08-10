/**
 * 番茄钟弹窗 UI（ticket 28-29）：中央单例弹窗 + 1s tick 驱动 + 状态栏同步 + 完成通知。
 * 关闭弹窗计时后台继续（tick 常驻，状态栏持续刷新，重开从内存状态渲染）；
 * 阶段自然完成（tick 驱动）→ toast + 提示音 + 落盘；skip 静默；打开时超时恢复（initData 路径不通知）。
 * 设置读取：T31 前用默认时长/选项，pomodoroForceFocus/pomodoroSound 等字段已就位（tryGetSettings 缺省回退）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { PomodoroDataManager } from './data';
import { playSound } from './sound';
import { syncPomodoroStatusBar } from './statusbar';
import type { PomodoroState, HistoryEntry, Durations, PomodoroOptions, Phase, PomodoroAction, PomodoroEvent } from './state';
import { transition, recover, createInitialState, DEFAULT_DURATIONS, phaseDurationSec } from './state';

let dataManager: PomodoroDataManager | null = null;
let state: PomodoroState = createInitialState();
let history: HistoryEntry[] = [];
let loaded = false;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let timerId: number | null = null;

/** 时长：T31 前用默认（经典 25/5/15、N=4），设置接入后按预设解析 */
function durations(): Durations {
  return DEFAULT_DURATIONS;
}

/** 选项：读设置（T31 前字段不存在 → 默认全关） */
function options(): PomodoroOptions {
  const s = tryGetSettings() as any;
  return {
    forceFocus: !!s.pomodoroForceFocus,
    autoCycle: !!s.pomodoroAutoCycle,
    autoSkipBreak: !!s.pomodoroAutoSkipBreak,
  };
}

function phaseText(phase: Phase, count: number, d: Durations): string {
  if (phase === 'focus') return `专注 ${count + 1}/${d.longBreakInterval}`;
  if (phase === 'short-break') return '短休息';
  if (phase === 'long-break') return '长休息';
  return '🍅 番茄钟';
}

/** 阶段自然完成（有 historyEntry）→ toast + 提示音；skip 无 historyEntry 不通知 */
function notifyPhaseComplete(e: Extract<PomodoroEvent, { type: 'phase-completed' }>): void {
  const d = durations();
  if (e.completedPhase === 'focus') {
    const rest = e.nextPhase === 'long-break' ? `长休息 ${d.longBreakMin} 分钟` : `休息 ${d.shortBreakMin} 分钟`;
    notice(`专注完成：${rest}`, 'success');
  } else {
    notice('休息结束：开始专注', 'success');
  }
  const s = tryGetSettings() as any;
  if (s.pomodoroSound !== false) {
    playSound(e.completedPhase === 'focus' ? 'focus-end' : 'break-end');
  }
}

/** 剩余秒（运行中按 endTime 实时算；暂停/停止取 remaining；idle 显示满时长） */
function remainingSec(): number {
  if (state.endTime !== null) return Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
  if (state.phase === 'idle' && state.remaining === 0) return phaseDurationSec('focus', durations());
  return state.remaining;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render(): void {
  const d = durations();
  const remain = remainingSec();
  // 状态栏不依赖弹窗存在（关闭后继续每秒刷新）
  syncPomodoroStatusBar(state, remain);
  if (!maskEl) return;
  const total = phaseDurationSec(state.phase === 'idle' ? 'focus' : state.phase, d);
  // 环形进度：剩余比例 → dashoffset（dasharray 恒为周长，offset=C*remain/total）
  const C = 2 * Math.PI * 52;
  const progress = total > 0 ? 1 - remain / total : 1;
  const circle = document.getElementById('pomodoro-ring-progress') as SVGElement | null;
  if (circle) {
    circle.setAttribute('stroke-dasharray', String(C));
    circle.setAttribute('stroke-dashoffset', String(C * (1 - progress)));
  }
  const phaseEl = document.getElementById('pomodoro-phase');
  if (phaseEl) phaseEl.textContent = phaseText(state.phase, state.cycleFocusCount, d);
  const timeEl = document.getElementById('pomodoro-time');
  if (timeEl) timeEl.textContent = fmt(remain);
  const startBtn = document.getElementById('pomodoro-btn-start') as HTMLButtonElement | null;
  if (startBtn) {
    const running = state.endTime !== null;
    startBtn.textContent = running ? '暂停' : state.paused ? '继续' : '开始';
    // 强制专注：focus 阶段运行中或暂停态（恢复场景）均锁定
    const locked = options().forceFocus && state.phase === 'focus' && (running || state.paused);
    startBtn.disabled = locked;
    const resetBtn = document.getElementById('pomodoro-btn-reset') as HTMLButtonElement | null;
    const skipBtn = document.getElementById('pomodoro-btn-skip') as HTMLButtonElement | null;
    if (resetBtn) resetBtn.disabled = locked;
    if (skipBtn) skipBtn.disabled = locked;
  }
}

/** 状态变更统一入口：transition → 落盘（完成事件）→ 通知/声音 → tick 生命周期 → 渲染 */
function applyAction(action: PomodoroAction): void {
  const r = transition(state, action, Date.now(), durations(), options());
  state = r.state;
  if (r.event.type === 'phase-completed') {
    if (r.event.historyEntry) history = history.concat(r.event.historyEntry);
    // 仅自然完成（tick 驱动）通知+响；skip（手动）静默
    if (action === 'tick') notifyPhaseComplete(r.event);
  }
  if (r.event.type !== 'none') void save();
  ensureTick();
  render();
}

function onTick(): void {
  applyAction('tick');
}

/** tick 生命周期：有计时才轮询，停止/暂停即停（节省资源） */
function ensureTick(): void {
  if (state.endTime !== null && timerId === null) {
    timerId = window.setInterval(onTick, 1000);
  } else if (state.endTime === null && timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

async function save(): Promise<void> {
  if (dataManager) await dataManager.save({ version: 1, state, history });
}

/** 首次打开：load + 超时恢复（静默） */
async function initData(): Promise<void> {
  const data = await dataManager!.load();
  const r = recover(data.state, data.history, Date.now(), durations(), options());
  state = r.state;
  history = r.history;
  if (r.events.length > 0) await dataManager!.save({ version: 1, state, history });
  loaded = true;
}

function injectStyles(): void {
  if (document.querySelector('style[data-pomodoro-styles]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-pomodoro-styles', '');
  style.textContent = `
    #pomodoro-mask { position: fixed; inset: 0; z-index: 10200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; }
    #pomodoro-popup { width: 320px; padding: 24px; border-radius: 16px; background: var(--background-primary); box-shadow: 0 8px 40px rgba(0,0,0,0.3); text-align: center; position: relative; }
    #pomodoro-ring-svg { width: 160px; height: 160px; margin: 8px auto; display: block; }
    .pomodoro-ring-track { fill: none; stroke: var(--background-modifier-border); stroke-width: 8; }
    .pomodoro-ring-progress { fill: none; stroke: var(--interactive-accent); stroke-width: 8; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
    #pomodoro-phase { font-size: 15px; color: var(--text-muted); margin-top: 8px; }
    #pomodoro-time { font-size: 42px; font-weight: 600; color: var(--text-normal); font-variant-numeric: tabular-nums; }
    .pomodoro-controls { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
    .pomodoro-btn { padding: 6px 14px; border-radius: 8px; background: var(--background-secondary); color: var(--text-normal); cursor: pointer; font-size: 14px; }
    .pomodoro-btn:hover:not(:disabled) { background: var(--background-modifier-hover); }
    .pomodoro-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pomodoro-btn-primary { background: var(--interactive-accent); color: var(--text-on-accent); }
    .pomodoro-btn-primary:hover:not(:disabled) { background: var(--interactive-accent-hover); }
    #pomodoro-btn-settings { position: absolute; top: 12px; right: 12px; padding: 4px 8px; }
  `;
  document.head.appendChild(style);
}

function bindEvents(): void {
  const startBtn = document.getElementById('pomodoro-btn-start')!;
  startBtn.addEventListener('click', () => applyAction(state.paused ? 'resume' : state.endTime !== null ? 'pause' : 'start'));
  document.getElementById('pomodoro-btn-reset')!.addEventListener('click', () => applyAction('reset'));
  document.getElementById('pomodoro-btn-skip')!.addEventListener('click', () => applyAction('skip'));
  // ⚙️ 设置弹窗由 T31 接入（复用 core/settings-modal.ts）
}

function buildDOM(): void {
  const mask = document.createElement('div');
  mask.id = 'pomodoro-mask';
  mask.innerHTML = `
    <div id="pomodoro-popup">
      <button id="pomodoro-btn-settings" class="pomodoro-btn" title="设置">⚙️</button>
      <svg id="pomodoro-ring-svg" viewBox="0 0 120 120">
        <circle class="pomodoro-ring-track" cx="60" cy="60" r="52"></circle>
        <circle id="pomodoro-ring-progress" class="pomodoro-ring-progress" cx="60" cy="60" r="52"></circle>
      </svg>
      <div id="pomodoro-phase"></div>
      <div id="pomodoro-time"></div>
      <div class="pomodoro-controls">
        <button id="pomodoro-btn-start" class="pomodoro-btn pomodoro-btn-primary">开始</button>
        <button id="pomodoro-btn-reset" class="pomodoro-btn">重置</button>
        <button id="pomodoro-btn-skip" class="pomodoro-btn">跳过</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  maskEl = mask;
  escHandle = escManager.register('pomodoro', {
    isVisible: () => maskEl !== null,
    close: closePomodoro,
  });
  injectStyles();
  bindEvents();
  render();
}

/** 打开弹窗（幂等：已存在则仅确保显示；未加载先 load+recover） */
export async function openPomodoro(app: App): Promise<void> {
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!maskEl) {
    if (!loaded) await initData();
    buildDOM();
  }
}

/** 关闭弹窗：移除 DOM，计时后台继续（tick 常驻） */
export function closePomodoro(): void {
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

/** 卸载清理（T32 接入 onunload；测试重置） */
export function unloadPomodoro(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  closePomodoro();
  const style = document.querySelector('style[data-pomodoro-styles]');
  if (style) style.remove();
  state = createInitialState();
  history = [];
  dataManager = null;
  loaded = false;
}
