/**
 * 番茄钟弹窗 UI（ticket 28-31）：中央单例弹窗 + 1s tick 驱动 + 状态栏同步 + 完成通知。
 * 关闭弹窗计时后台继续（tick 常驻，状态栏持续刷新，重开从内存状态渲染）；
 * 阶段自然完成（tick 驱动）→ toast + 提示音 + 落盘；skip 静默；打开时超时恢复（initData 路径不通知）。
 * 设置：预设/自定义时长/N/开关均读 BzSettings（tryGetSettings 缺省回退）；设置入口在设置面板
 * （面板右上角 ⚙ 按钮已移除，2026-09-11 用户拍板）。
 * ticket 63：移除读书番茄钟与专注目标选择（用户决策），保留后台自动暂停/不补算（ticket 62）。
 * 增强包：完成通知挂「开始休息/开始专注」动作（autoCycle 关，文案按实况生成）；
 * 今日行总分钟数 + 近 7 天柱 title 扩分钟 + 今日 12 槽时段分布小方柱；
 * 循环位置 6px 方点行（替代「专注 2/4」文字）；lucide timer 图标替代 🍅；mask 遮罩走
 * --background-modifier-cover token；面板聚焦 Space 切换开始/暂停；
 * startFocusForTask：备忘录「专注这个」联动（归属记入 state/history，弹窗/状态栏展示任务名）。
 */
import type { App } from 'obsidian';
import { setIcon } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { notice, notify } from '../core/notice';
import { numStrBinding } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { PomodoroDataManager, trimHistory } from './data';
// 面板主题清单 / 弹窗骨架：单源在 ./render（ui.ts 与评审壳皮肤页共用）
import {
  POMODORO_SKIN_THEMES,
  skinClassOf,
  popupShellHtml,
} from './render';
export { POMODORO_SKIN_THEMES } from './render';
export type { PomodoroSkinTheme } from './render';
import { playSound } from './sound';
import type { SoundKind } from './sound';
import { syncPomodoroStatusBar } from './statusbar';
import { todayCount, todayMinutes, last7Days } from './stats';
import { PRESETS, CUSTOM_PRESET_ID } from './config';
import type { PomodoroState, HistoryEntry, Durations, PomodoroOptions, Phase, PomodoroAction, PomodoroEvent } from './state';
import { transition, recover, createInitialState, phaseDurationSec } from './state';
import type { PomodoroPhase } from '../core/pomodoro-phase';
import { isFocusingPhase } from '../core/pomodoro-phase';
import { pad2 } from '../core/utils';
import { emitDomainEvent } from '../core/domain-bus';

let dataManager: PomodoroDataManager | null = null;
let state: PomodoroState = createInitialState();
let history: HistoryEntry[] = [];
let loaded = false;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let timerId: number | null = null;
let appRef: App | null = null;
/** 后台自动暂停冻结标记（ticket 62）：仅由本机制冻结的会话在恢复可见时自动 resume（手动暂停不被覆盖） */
let autoPauseMain = false;
/** visibilitychange 监听清理引用（unload 用） */
let visibilityHandler: (() => void) | null = null;

/**
 * 面板主题 → 弹窗皮肤类（未知/空值回落默认）。
 * 清单与取值类型单源 = ./render（POMODORO_SKIN_THEMES / skinClassOf）；
 * 亮/暗两套配色单源 = styles.css 的 :root 变量表，本文件不持有色值。
 */
function applySkinClass(): void {
  const popup = document.getElementById('pomodoro-popup');
  if (!popup) return;
  const want = skinClassOf(tryGetSettings().pomodoroSkinTheme);
  for (const t of POMODORO_SKIN_THEMES) popup.classList.remove(`pomodoro-skin-${t.value}`);
  popup.classList.add(want);
}

/** 时长：按设置预设解析（T31）；自定义/非法值回退默认（经典 25/5/15、N=4） */
function durations(): Durations {
  const s = tryGetSettings();
  const num = (v: string | undefined, def: number): number => {
    const n = parseInt(v ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  const preset = s.pomodoroPreset && s.pomodoroPreset !== CUSTOM_PRESET_ID ? PRESETS[s.pomodoroPreset] : null;
  return {
    workMin: preset ? preset.workMin : num(s.pomodoroWorkMin, 25),
    shortBreakMin: preset ? preset.shortBreakMin : num(s.pomodoroShortBreakMin, 5),
    longBreakMin: preset ? preset.longBreakMin : num(s.pomodoroLongBreakMin, 15),
    longBreakInterval: num(s.pomodoroLongBreakInterval, 4),
  };
}

/** 选项：读设置（四开关，缺省全关） */
function options(): PomodoroOptions {
  const s = tryGetSettings();
  return {
    forceFocus: !!s.pomodoroForceFocus,
    autoCycle: !!s.pomodoroAutoCycle,
    autoSkipBreak: !!s.pomodoroAutoSkipBreak,
  };
}

/** 弹窗阶段短文案（专注不带 N/M——循环位置由圆点行表达；空闲配 lucide timer 图标，不用 emoji） */
function phaseLabel(phase: Phase): string {
  if (phase === 'focus') return '专注';
  if (phase === 'short-break') return '短休息';
  if (phase === 'long-break') return '长休息';
  return '番茄钟';
}

/** 通知/恢复用阶段文案（带循环位置，如「专注 2/4」） */
function phaseText(phase: Phase, count: number, d: Durations): string {
  if (phase === 'focus') return `专注 ${count + 1}/${d.longBreakInterval}`;
  return phaseLabel(phase);
}

/** 阶段开始提示声（专注/短休/长休各一种，听声即知状态；声音开关关闭时静默） */
function playPhaseSound(phase: Phase): void {
  const s = tryGetSettings();
  if (s.pomodoroSound !== false) {
    const kind: SoundKind =
      phase === 'focus' ? 'focus-start' : phase === 'long-break' ? 'long-break-start' : 'short-break-start';
    playSound(kind, pomodoroVolume());
  }
}

/** 阶段开始（手动开始/继续）：toast + 提示音 */
function notifyPhaseStarted(phase: Phase): void {
  const d = durations();
  if (phase === 'focus') {
    notice('专注开始', 'success');
  } else if (phase === 'long-break') {
    notice(`长休息开始：${d.longBreakMin} 分钟`, 'success');
  } else {
    notice(`休息开始：${d.shortBreakMin} 分钟`, 'success');
  }
  playPhaseSound(phase);
}

/** 暂停（手动）：toast + 提示音 */
function notifyPaused(): void {
  notice('已暂停专注', 'pause');
  const s = tryGetSettings();
  if (s.pomodoroSound !== false) playSound('pause', pomodoroVolume());
}

/** 休息阶段标签（专注完成通知里预告下一阶段） */
function breakLabel(phase: Phase, d: Durations): string {
  return phase === 'long-break' ? `长休息 ${d.longBreakMin} 分钟` : `休息 ${d.shortBreakMin} 分钟`;
}

/**
 * 阶段自然完成（tick 驱动）→ toast（完成语义）+ 新阶段开始提示声；skip 无 historyEntry 不通知。
 * 增强包：文案按下一阶段实际是否计时生成（不说「开始专注」却不计时）；
 * 手动流转（autoCycle 关）时挂「开始休息/开始专注」直达动作按钮（core notify action 范式，对齐 review「去复习」）。
 */
function notifyPhaseComplete(e: Extract<PomodoroEvent, { type: 'phase-completed' }>): void {
  const d = durations();
  // 声音 = 新阶段开始提示（听声即知状态，无需打开弹窗）
  playPhaseSound(e.nextPhase);
  // 自动流转（autoCycle/autoSkipBreak）：下一阶段已在计时，toast 只报完成事实
  if (e.autoStarted) {
    if (e.completedPhase === 'focus') {
      notice(e.nextPhase === 'focus' ? '专注完成：开始下一轮专注' : `专注完成：${breakLabel(e.nextPhase, d)}`, 'success');
    } else {
      notice('休息结束：开始专注', 'success');
    }
    return;
  }
  // 手动流转：动作按钮直达开始（6s 停留给足反应窗口；错过也可在弹窗/状态栏手动开始）
  if (e.completedPhase === 'focus') {
    notify(`专注完成：${breakLabel(e.nextPhase, d)}`, {
      type: 'success',
      duration: 6000,
      action: { label: '开始休息', onClick: () => applyAction('start') },
    });
  } else {
    notify('休息结束', {
      type: 'success',
      duration: 6000,
      action: { label: '开始专注', onClick: () => applyAction('start') },
    });
  }
}

/** 提示音音量（0-100，默认最大；旧设置无字段 → 100） */
function pomodoroVolume(): number {
  const v = tryGetSettings().pomodoroVolume;
  return typeof v === 'number' && v >= 0 ? v : 100;
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
  return `${pad2(m)}:${pad2(s)}`;
}

/** 历史统计区：今日计数+总分钟 + 近 7 天柱条；同数据跳过重建（防 tick 每秒 DOM churn） */
let lastStatsKey = '';
function renderStats(): void {
  const now = Date.now();
  const todayEl = document.getElementById('pomodoro-today');
  if (todayEl) todayEl.textContent = `今日 ${todayCount(history, now)} 个 · ${todayMinutes(history, now)} 分钟`;
  const weekEl = document.getElementById('pomodoro-week');
  if (!weekEl) return;
  const days = last7Days(history, now);
  const key = days.map((d) => `${d.date}:${d.count}:${d.minutes}`).join(',');
  if (key === lastStatsKey) return;
  lastStatsKey = key;
  const max = Math.max(1, ...days.map((d) => d.count));
  weekEl.innerHTML = '';
  for (const d of days) {
    const bar = document.createElement('div');
    bar.className = 'pomodoro-stat-day';
    bar.title = `${d.date}：${d.count} 个 · ${d.minutes} 分钟`;
    const col = document.createElement('div');
    col.className = 'pomodoro-stat-col';
    const h = document.createElement('div');
    h.className = 'pomodoro-stat-bar';
    h.style.height = `${Math.max(2, Math.round((d.count / max) * 40))}px`;
    col.appendChild(h);
    const label = document.createElement('span');
    label.className = 'pomodoro-stat-label';
    label.textContent = d.date.slice(8); // DD（完整日期在 title；窄面板不折行）
    col.appendChild(label);
    bar.appendChild(col);
    weekEl.appendChild(bar);
  }
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
  if (phaseEl) {
    const label = phaseLabel(state.phase);
    // 同文案跳过重建（render 每秒跑；idle 需重建 icon span，纯文本直接换）
    if (phaseEl.dataset.label !== label) {
      phaseEl.dataset.label = label;
      phaseEl.innerHTML = '';
      if (state.phase === 'idle') {
        const ic = document.createElement('span');
        ic.className = 'pomodoro-phase-icon';
        setIcon(ic, 'timer'); // lucide timer（替代旧 🍅 emoji，UI 手册禁 emoji 图标）
        phaseEl.appendChild(ic);
        phaseEl.appendChild(document.createTextNode(label));
      } else {
        phaseEl.textContent = label;
      }
    }
  }
  renderCycleDots(d);
  renderTaskLine();
  const timeEl = document.getElementById('pomodoro-time');
  if (timeEl) timeEl.textContent = fmt(remain);
  renderStats();
  updateButtons();
  applySkinClass(); // 面板主题随设置走（设置面板改主题后下一次 render 即生效）
}

/** 本轮循环位置：N 个 6px 方点，已完成填 accent 色（替代旧「专注 2/4」文字小字） */
function renderCycleDots(d: Durations): void {
  const cycleEl = document.getElementById('pomodoro-cycle');
  if (!cycleEl) return;
  const total = Math.max(1, d.longBreakInterval);
  if (cycleEl.childElementCount !== total) {
    cycleEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'pomodoro-cycle-dot';
      cycleEl.appendChild(dot);
    }
  }
  Array.from(cycleEl.children).forEach((dot, i) => {
    dot.className = 'pomodoro-cycle-dot' + (i < state.cycleFocusCount ? ' pomodoro-cycle-dot-on' : '');
  });
}

/** 当前专注任务行（备忘录「专注这个」联动）：有归属显示标题（超长省略 + title 全文），无归属收起 */
function renderTaskLine(): void {
  const taskEl = document.getElementById('pomodoro-task');
  if (!taskEl) return;
  if (state.task) {
    if (taskEl.textContent !== state.task) taskEl.textContent = state.task;
    taskEl.title = state.task;
  } else {
    taskEl.textContent = '';
    taskEl.removeAttribute('title');
  }
}

/** 按钮态渲染（render 内部抽取） */
function updateButtons(): void {
  const startBtn = document.getElementById('pomodoro-btn-start') as HTMLButtonElement | null;
  if (!startBtn) return;
  const running = state.endTime !== null;
  startBtn.textContent = running ? '暂停' : state.paused ? '继续' : '开始';
  const locked = options().forceFocus && state.phase === 'focus' && (running || state.paused);
  // P1-4：后台自动暂停的冻结态在重启后仍放行「开始/继续」（否则 forceFocus 下永久死锁）；
  // 手动暂停（无 pausedBy 标记，含旧数据）维持锁定。
  const startLocked = locked && !(state.paused && state.pausedBy === 'autopause');
  startBtn.disabled = startLocked;
  const resetBtn = document.getElementById('pomodoro-btn-reset') as HTMLButtonElement | null;
  const skipBtn = document.getElementById('pomodoro-btn-skip') as HTMLButtonElement | null;
  if (resetBtn) resetBtn.disabled = locked;
  if (skipBtn) skipBtn.disabled = locked;
}

/** 状态变更统一入口：transition → 落盘（完成事件）→ 通知/声音 → tick 生命周期 → 渲染 */
function applyAction(action: PomodoroAction): void {
  const prev = state;
  const r = transition(state, action, Date.now(), durations(), options());
  state = r.state;
  // F12：冻结标记随「paused 被清除」一并清——resume/start/reset 等任意解冻路径都经此处，
  // 防标记残留后 resumeOnVisible 把后续的手动暂停静默续跑（document.hidden 期间 popout
  // 窗口/通知动作等入口仍可驱动的场景）
  if (!state.paused) autoPauseMain = false;
  if (r.event.type === 'started') notifyPhaseStarted(r.event.phase);
  if (r.event.type === 'phase-completed') {
    if (r.event.historyEntry) history = history.concat(r.event.historyEntry);
    // 仅自然完成（tick 驱动）通知+响；skip（手动）静默
    if (action === 'tick') notifyPhaseComplete(r.event);
    // 番茄钟观察（ticket 080 改域事件派发）：专注自然完成（写 history 路径）才发事件给 smartcat。
    // historyEntry 仅 focus 自然完成产生（skip/休息完成天然排除），start/pause/reset 无本事件；
    // 不随 action === 'tick' 条件写死——以 historyEntry 存在判断（兼容冻结：只加通知挂点）。
    if (r.event.completedPhase === 'focus' && r.event.historyEntry) {
      emitDomainEvent('pomodoro', { kind: 'focus-done', minutes: durations().workMin });
    }
  }
  // 暂停生效（含手动；forceFocus 下 transition 返回 none 不触发）才通知+响
  if (action === 'pause' && state.paused) notifyPaused();
  // 落盘：事件非 none（阶段完成/开始），或手动暂停生效（ticket 62：暂停态与后台冻结应持久化；
  // 手动暂停不带来源标记，重启后 locked 判定维持锁定），或重置/停止生效（F11：reset 恒返回
  // none 事件，不落盘会旧计时复活重启后弹「番茄钟继续」；forceFocus 拦下的 reset 同引用不写）
  if (r.event.type !== 'none' || (action === 'pause' && state.paused) || (action === 'reset' && r.state !== prev)) void save();
  ensureTick();
  render();
}

function onTick(): void {
  applyAction('tick');
}

// ===== 后台自动暂停（ticket 62）：visibilitychange hidden → 冻结，visible → 自动恢复 =====

/** 后台暂停开关（缺省开） */
function autoPauseEnabled(): boolean {
  return tryGetSettings().pomodoroAutoPauseOnHide !== false;
}

/** 冻结运行中状态（绕过 forceFocus——后台暂停是环境事件，非手动；返回是否由本机制冻结）；
 *  写入 pausedBy:'autopause' 来源标记并随落盘持久化（重启后 locked 判定据此放行继续按钮，P1-4） */
function freezeRunning(s: PomodoroState, now: number): PomodoroState {
  if (s.endTime === null || s.paused) return s;
  return {
    ...s,
    paused: true,
    pausedBy: 'autopause',
    remaining: Math.max(0, Math.ceil((s.endTime - now) / 1000)),
    endTime: null,
  };
}

/** 解冻本机制冻结的状态（仅解除 autoPause 标记的；手动暂停的保持暂停） */
function unfreezeRunning(s: PomodoroState, now: number): PomodoroState {
  if (!s.paused) return s;
  return { ...s, paused: false, pausedBy: undefined, remaining: 0, endTime: now + s.remaining * 1000 };
}

/** 窗口 hidden：主番茄钟冻结（仅运行中的；手动暂停的尊重不覆盖） */
function pauseOnHidden(): void {
  if (!autoPauseEnabled()) return;
  const now = Date.now();
  if (state.endTime !== null && !state.paused) {
    state = freezeRunning(state, now);
    autoPauseMain = true;
  }
  if (autoPauseMain) {
    void save(); // 冻结态（含 pausedBy:'autopause' 来源标记）落盘，重启恢复后据此放行继续按钮
    render();
  }
}

/** 窗口恢复 visible：仅自动恢复由本机制冻结的会话；仅解冻（状态实际变化）时落盘 */
function resumeOnVisible(): void {
  const now = Date.now();
  if (autoPauseMain && state.paused) {
    state = unfreezeRunning(state, now);
    autoPauseMain = false;
    void save(); // 仅解冻路径 save：无变化恢复（手动暂停/空闲）不写盘
    render();
    return;
  }
  render();
}

/** 注册/注销 visibilitychange 监听（ensurePomodoro 时注册，unload 时注销）——幂等 */
function registerVisibilityListener(): void {
  if (visibilityHandler) return;
  visibilityHandler = () => {
    if (document.hidden) pauseOnHidden();
    else resumeOnVisible();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

/** 注销 visibilitychange 监听 */
function unregisterVisibilityListener(): void {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

/** tick 生命周期：主计时进行中才轮询（节省资源） */
function ensureTick(): void {
  const needsTick = state.endTime !== null;
  if (needsTick && timerId === null) {
    timerId = window.setInterval(onTick, 1000);
  } else if (!needsTick && timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

async function save(): Promise<void> {
  history = trimHistory(history, Date.now()); // F13：历史按保留窗裁剪后再落盘（pomodoro.json 不线性膨胀）
  if (dataManager) await dataManager.save({ version: 1, state, history });
}

/** 首次打开：load + 主倒计时超时恢复（静默；ticket 62 不补算——超时即回空闲） */
async function initData(): Promise<void> {
  const data = await dataManager!.load();
  const r = recover(data.state, data.history, Date.now(), durations(), options());
  state = r.state;
  history = trimHistory(r.history, Date.now()); // F13：装载即裁剪（此后任何 save 落盘的都是裁剪后历史）
  // 主番茄钟超时回空闲（endTime 从有到无）→ 落盘
  const mainChanged = data.state.endTime !== null && r.state.endTime === null;
  if (mainChanged) await dataManager!.save({ version: 1, state, history });
  loaded = true;
}

/** 外观组主题行 options（issue 246）：由清单单源 map 生成；布局行的配套回落按 layout 字段判定 */
const SKIN_THEME_OPTIONS = POMODORO_SKIN_THEMES.map((t) => ({ value: t.value, label: t.label, layout: 'default', prevClass: `bz-sp-prev-pomo-${t.value}` }));

/** 番茄钟设置 schema（ticket 131；ADR-0064）：时间方案/行为/移动端三组，置于模块顶层供文案 lint 直接引用。
 *  消费方 = 设置面板全域 schema（src/settings-panel/ui.ts）——面板右上角 ⚙ 设置钮已移除
 *  （2026-09-11 用户拍板，设置入口归设置面板），其 onChange 回调仍驱动域内 render() 重绘主面板；
 *  声音提醒/后台自动暂停沿用缺省开语义（键缺失视为开，非键直绑的 === true 口径）。 */
export function pomodoroSettingsSchema(): SettingsSchema {
  // 缺省开语义（旧数据无键视为开）：原 toggleSetting get 口径，键直绑 === true 会翻转初始显示
  const soundToggle = {
    get: () => (tryGetSettings() as any).pomodoroSound !== false,
    set: (v: boolean) => {
      (getSettings() as any).pomodoroSound = v;
    },
    save: () => saveSettings(),
  } as const;
  const autoPauseToggle = {
    get: () => (tryGetSettings() as any).pomodoroAutoPauseOnHide !== false,
    set: (v: boolean) => {
      (getSettings() as any).pomodoroAutoPauseOnHide = v;
    },
    save: () => saveSettings(),
  } as const;
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          {
            type: 'choiceCards', name: '面板布局', binding: { key: 'pomodoroSkin' },
            options: [{ value: 'default', label: '计时盘', prevClass: 'bz-sp-prev-panel' }],
            // 配套回落（issue 246 a2 口径：不建 layoutPairMap）：换布局后若当前主题不属于
            // 新布局的配套（layout 不符）→ 回落第一个适配主题（无适配主题则兜底第一项），
            // 防「布局换了主题还挂旧皮」
            onChange: () => {
              const s = tryGetSettings() as any;
              const cur = String(s.pomodoroSkinTheme ?? '');
              const fit = SKIN_THEME_OPTIONS.filter((o) => o.layout === s.pomodoroSkin);
              if (!fit.some((o) => o.value === cur)) {
                s.pomodoroSkinTheme = (fit[0] ?? SKIN_THEME_OPTIONS[0]).value;
                saveSettings();
              }
              render();
            },
          },
          // 面板主题：10 套皮（清单单源 = render.ts POMODORO_SKIN_THEMES，每套亮/暗两版，CSS 侧同名落皮）；
          // onChange 驱动 render() 重挂皮肤类——设置面板关着弹窗换肤也要即时生效（评审 c1）
          { type: 'choiceCards', name: '面板主题', binding: { key: 'pomodoroSkinTheme' }, layoutKey: 'pomodoroSkin', options: SKIN_THEME_OPTIONS, onChange: () => render() },
        ],
      },
      {
        icon: 'timer',
        name: '时间方案',
        rows: [
          {
            type: 'select',
            name: '预设方案',
            desc: '选择现成的工作与休息时长组合',
            binding: { key: 'pomodoroPreset' },
            options: [
              ...Object.entries(PRESETS).map(([id, p]) => ({
                value: id,
                label: `${p.label}（${p.workMin}/${p.shortBreakMin}/${p.longBreakMin}）`,
              })),
              { value: CUSTOM_PRESET_ID, label: '自定义' },
            ],
            onChange: () => render(),
          },
          {
            type: 'number',
            name: '工作时长',
            desc: '自定义方案的工作阶段分钟数',
            binding: numStrBinding('pomodoroWorkMin', 25),
            min: 1,
            max: 120,
            step: 1,
            visibleWhen: (s) => s.pomodoroPreset === CUSTOM_PRESET_ID,
            onChange: () => render(),
          },
          {
            type: 'number',
            name: '短休息时长',
            desc: '自定义方案的短休息分钟数',
            binding: numStrBinding('pomodoroShortBreakMin', 5),
            min: 1,
            max: 60,
            step: 1,
            visibleWhen: (s) => s.pomodoroPreset === CUSTOM_PRESET_ID,
            onChange: () => render(),
          },
          {
            type: 'number',
            name: '长休息时长',
            desc: '自定义方案的长休息分钟数',
            binding: numStrBinding('pomodoroLongBreakMin', 15),
            min: 1,
            max: 60,
            step: 1,
            visibleWhen: (s) => s.pomodoroPreset === CUSTOM_PRESET_ID,
            onChange: () => render(),
          },
          { type: 'number', name: '长休息间隔', desc: '每隔几个专注进入一次长休息', binding: numStrBinding('pomodoroLongBreakInterval', 4), min: 1, max: 20, step: 1, onChange: () => render() },
        ],
      },
      {
        icon: 'sliders-horizontal',
        name: '行为',
        rows: [
          { type: 'toggle', name: '强制专注模式', desc: '专注进行中无法暂停跳过或重置', binding: { key: 'pomodoroForceFocus' }, onChange: () => render() },
          { type: 'toggle', name: '自动循环', desc: '阶段结束后自动开始下一阶段', binding: { key: 'pomodoroAutoCycle' }, onChange: () => render() },
          { type: 'toggle', name: '自动跳过休息', desc: '专注结束后直接进入下一个专注', binding: { key: 'pomodoroAutoSkipBreak' }, onChange: () => render() },
          { type: 'toggle', name: '声音提醒', desc: '阶段切换时播放提示音', binding: soundToggle, onChange: () => render() },
          { type: 'toggle', name: '后台自动暂停', desc: '窗口隐藏时暂停，恢复可见后自动继续', binding: autoPauseToggle, onChange: () => render() },
          // 提示音音量 + 「试听」：行内附加按钮（actions，渲染器统一实现——custom 插槽已退役）
          { type: 'slider', name: '提示音音量', desc: '提示音大小，默认最大',
            binding: { get: () => (tryGetSettings() as any).pomodoroVolume ?? 100, set: (v) => { (getSettings() as any).pomodoroVolume = v; }, save: () => saveSettings() },
            min: 0, max: 100, step: 5,
            actions: [{ text: '试听', onClick: () => playSound('focus-start', (tryGetSettings() as any).pomodoroVolume ?? 100) }] },
          {
            type: 'select',
            name: '打开时恢复方式',
            desc: '启动时正在倒计时，选择弹窗提醒或后台继续',
            binding: { key: 'pomodoroRestoreMode' },
            options: [
              { value: 'background', label: '后台继续' },
              { value: 'popup', label: '自动弹窗' },
            ],
          },
        ],
      },
    ],
  };
}

function bindEvents(): void {
  const startBtn = document.getElementById('pomodoro-btn-start')!;
  startBtn.addEventListener('click', () => applyAction(state.paused ? 'resume' : state.endTime !== null ? 'pause' : 'start'));
  document.getElementById('pomodoro-btn-reset')!.addEventListener('click', () => applyAction('reset'));
  document.getElementById('pomodoro-btn-skip')!.addEventListener('click', () => applyAction('skip'));
  const popup = document.getElementById('pomodoro-popup')!;
  // Space 键切换开始/暂停（面板聚焦时；按钮聚焦走原生 Space 激活避免双触发，输入类控件跳过）
  popup.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    const t = e.target as HTMLElement;
    const tag = t.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
    e.preventDefault(); // 防页面滚动（Space 默认行为）
    applyAction(state.paused ? 'resume' : state.endTime !== null ? 'pause' : 'start');
  });
}

function buildDOM(): void {
  const mask = document.createElement('div');
  mask.id = 'pomodoro-mask';
  // 域主弹窗层级在 src/pomodoro/styles.css（#pomodoro-mask z-index，低于域设置弹窗与 Obsidian 设置页）——不再 JS 内联 z-index
  mask.innerHTML = popupShellHtml();
  mask.style.zIndex = String(allocZ()); // ADR-0067：创建即显示即发号
  document.body.appendChild(mask);
  maskEl = mask;
  // 点击遮罩本身关闭（弹窗内部点击不关闭）——计时后台继续
  mask.addEventListener('click', (e) => {
    if (e.target === mask) closePomodoro();
  });
  escHandle = escManager.register('pomodoro', {
    isVisible: () => maskEl !== null,
    close: closePomodoro,
  });
  bindEvents();
  render();
  // 面板聚焦（tabindex=-1）：打开即可用 Space 切换开始/暂停
  (document.getElementById('pomodoro-popup') as HTMLElement | null)?.focus();
}

/** 共享初始化 in-flight（P3）：ensurePomodoro 与 openPomodoro 并发调用只跑一次 initData */
let initInflight: Promise<void> | null = null;
function initDataOnce(): Promise<void> {
  if (loaded) return Promise.resolve();
  initInflight ??= initData().finally(() => {
    initInflight = null;
  });
  return initInflight;
}

/** 打开弹窗（幂等：已存在则仅确保显示；未加载先 load+recover）。
 *  初始化窗口内并发调用复用同一 in-flight Promise，杜绝双遮罩（P2）与双读盘（P3）。 */
let openInflight: Promise<void> | null = null;
export async function openPomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!maskEl) {
    openInflight ??= (async () => {
      await initDataOnce(); // 与 ensurePomodoro 共享 in-flight（并发只跑一次 load+recover）
      buildDOM();
      ensureTick(); // 恢复/首次打开时若在倒计时，启动轮询继续走（修复：恢复后不 tick 的 bug）
    })();
    try {
      await openInflight;
    } finally {
      openInflight = null;
    }
  }
  // 顶距工具类无条件挂载：移动端统一避让 Obsidian 头部安全区（components.css 统一档）
  const popupEl = maskEl ? (maskEl.querySelector('#pomodoro-popup') as HTMLElement) : null;
  popupEl?.classList.add('bz-panel-mtop');
}

/** 插件启动恢复（main.ts onLayoutReady 调用）：load+recover+落盘；正在倒计时 → 后台 tick 继续 + 弹恢复通知；popup 模式自动弹窗 */
export async function ensurePomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  registerVisibilityListener(); // ticket 62：后台自动暂停（幂等）
  if (!loaded) {
    await initDataOnce(); // 与 openPomodoro 共享 in-flight（并发只跑一次 load+recover）
    if (state.endTime !== null) {
      ensureTick(); // 后台继续（无弹窗时 render 只同步状态栏）
      render();
      // 恢复继续 → 弹通知（阶段 + 剩余）；暂停态（endTime 为 null）不弹
      const remainSec = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
      notice(`番茄钟继续：${phaseText(state.phase, state.cycleFocusCount, durations())}，还剩 ${fmt(remainSec)}`);
      const s = tryGetSettings();
      if (s.pomodoroRestoreMode === 'popup') void openPomodoro(app);
    }
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

/**
 * 备忘录「专注这个」联动入口：直接开始一个专注番茄并把归属记到该备忘录（最小实现：只传任务标题）。
 * - 休息中（计时/暂停）→ 先跳过休息（skip 不记历史）再开始专注；
 * - 已有专注计时中 → 不重启，提示后返回；
 * - forceFocus 手动暂停维持与开始按钮同一锁定口径（P1-4）；
 * - 归属随状态持久化，专注自然完成写入 history.task 后清除（skip 作废归属）。
 */
export async function startFocusForTask(app: App, taskTitle: string): Promise<void> {
  await ensurePomodoro(app);
  const o = options();
  const d = durations();
  // 休息阶段（运行/暂停/停止）：跳过休息直接进专注（skip 静默；状态变化即落盘——后续可能提前 return）
  if (state.phase === 'short-break' || state.phase === 'long-break') {
    state = transition(state, 'skip', Date.now(), d, o).state;
    void save();
    render();
  }
  if (state.endTime !== null) {
    notice('已有专注计时中，本次不重复开始', 'warning');
    return;
  }
  if (o.forceFocus && state.paused && state.pausedBy !== 'autopause') {
    notice('强制专注模式暂停中，请先在番茄钟恢复', 'warning');
    return;
  }
  state = { ...state, task: taskTitle };
  applyAction('start'); // 内含通知/落盘/tick 生命周期/渲染（弹窗与状态栏的任务名同步刷新）
}

/**
 * 是否处于「专注进行中」（计时中或暂停中）——只读内存态，**无副作用**（不加载数据、不触发恢复/通知）。
 * 消费方：toggleFocus、home/river.ts::collectFocusing（彩点 warn 条件）。
 * 布尔口径**从相位单源推导**（core/pomodoro-phase.isFocusingPhase，与首页彩点同出一源）；
 * 原始 state → 相位的唯一翻译点是 menuPhase（插件启动即 ensurePomodoro，
 * 首页侧读之前还会先 ensurePomodoro 兜底，原型/竞态时也拿得到真实相位）。
 */
export function isFocusing(): boolean {
  return isFocusingPhase(menuPhase());
}

/**
 * 开始 / 停止专注切换（首页入口菜单命令用，2026-09-10）。
 * 语义 = 面板「开始」与「重置」两颗钮的合并：
 *  - 专注中（计时或暂停）→ 停止（reset 回 idle，不写 history）；
 *  - 休息阶段（计时或暂停）→ 先跳过休息，再开专注；
 *  - idle → 直接开专注。
 * 强制专注（forceFocus）下 transition 会拦下 reset（返回同一 state 引用），此时只提示不改状态。
 */
export async function toggleFocus(app: App): Promise<void> {
  await ensurePomodoro(app);
  if (isFocusing()) {
    const before = state;
    applyAction('reset');
    if (state === before) notice('强制专注模式中，请先在番茄钟面板操作', 'warning');
    else notice('专注已停止');
    return;
  }
  if (state.phase === 'short-break' || state.phase === 'long-break') {
    state = transition(state, 'skip', Date.now(), durations(), options()).state;
    void save();
    render();
  }
  applyAction('start');
}

/**
 * 首页入口菜单用的**界面相位**（只读内存态，无副作用）：四值互斥，决定菜单里那**唯一**的
 * 番茄钟项（见 home/shared.pomodoroMenuAction）。类型单源 = core/pomodoro-phase。
 *  - 休息阶段（短/长休，计时或暂停）→ 'break'（暂停的休息照样能跳过）
 *  - 专注暂停中 → 'paused'；专注计时中 → 'focusing'
 *  - 其余 → 'idle'
 * 注意：reset/停止后 phase 仍是 'focus'（state.ts::activePhase 语义），
 * 所以 idle 不能按 phase 判，要看 endTime / paused。
 */
export function menuPhase(): PomodoroPhase {
  if (state.phase === 'short-break' || state.phase === 'long-break') return 'break';
  if (state.phase !== 'focus') return 'idle';
  if (state.paused) return 'paused';
  return state.endTime !== null ? 'focusing' : 'idle';
}

/**
 * 跳过休息（命令 bz-pomodoro-skip，2026-09-11 首页入口菜单）：
 * 休息阶段（计时或暂停）→ 跳过休息并直接开始下一轮专注；不在休息阶段 → 只提示不改状态。
 * skip 不记历史（面板同款语义）、归属随之作废，故与 toggleFocus 的休息分支同一路径。
 */
export async function skipBreak(app: App): Promise<void> {
  await ensurePomodoro(app);
  if (state.phase !== 'short-break' && state.phase !== 'long-break') {
    notice('当前不在休息阶段', 'warning');
    return;
  }
  state = transition(state, 'skip', Date.now(), durations(), options()).state;
  void save();
  render();
  applyAction('start'); // 内含通知/落盘/tick 生命周期/渲染
}

/**
 * 暂停 / 继续（命令 bz-pomodoro-pause，2026-09-11 首页入口菜单）：
 * 面板「暂停/继续」钮的命令版——有计时在跑则暂停，暂停中则继续；
 * 空闲态（既没在跑也没暂停）只提示，不代开专注（那是「开始专注」的事）。
 */
export async function togglePause(app: App): Promise<void> {
  await ensurePomodoro(app);
  if (state.endTime === null && !state.paused) {
    notice('当前没有进行中的计时', 'warning');
    return;
  }
  applyAction(state.paused ? 'resume' : 'pause');
}

/** 卸载清理（T32 接入 onunload；测试重置） */
export function unloadPomodoro(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  unregisterVisibilityListener(); // ticket 62
  autoPauseMain = false;
  openInflight = null; // 丢弃未完成的初始化（下次 openPomodoro 重新走 init）
  initInflight = null; // P3：共享初始化 in-flight 一并丢弃
  closePomodoro();
  state = createInitialState();
  history = [];
  lastStatsKey = '';
  dataManager = null;
  appRef = null;
  loaded = false;
}