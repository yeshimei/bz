/**
 * 番茄钟弹窗 UI（ticket 28-31）：中央单例弹窗 + 1s tick 驱动 + 状态栏同步 + 完成通知 + ⚙️ 设置弹窗。
 * 关闭弹窗计时后台继续（tick 常驻，状态栏持续刷新，重开从内存状态渲染）；
 * 阶段自然完成（tick 驱动）→ toast + 提示音 + 落盘；skip 静默；打开时超时恢复（initData 路径不通知）。
 * 设置：预设/自定义时长/N/四开关均读 BzSettings（tryGetSettings 缺省回退）。
 */
import { Setting } from 'obsidian';
import type { App } from 'obsidian';
import { setIcon } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { openSettingsModal } from '../core/settings-modal';
import { createOverlay } from '../core/dom';
import { jsonStore } from '../core/json-store';
import { PomodoroDataManager } from './data';
import { playSound } from './sound';
import type { SoundKind } from './sound';
import { syncPomodoroStatusBar } from './statusbar';
import { todayCount, last7Days, bookCountToday } from './stats';
import { PRESETS, CUSTOM_PRESET_ID } from './config';
import type { PomodoroState, HistoryEntry, Durations, PomodoroOptions, Phase, PomodoroAction, PomodoroEvent, FocusTarget } from './state';
import { transition, recover, createInitialState, DEFAULT_DURATIONS, phaseDurationSec } from './state';
import { bindPomodoroState, bindReadingSession, checkReadingNow } from './epub-link';
import type { ReadingBook } from './epub-link';
import type { ReadingSession } from './reading';
import {
  startReadingSession as newReadingSession,
  switchReadingBook as switchReadingSessionPure,
  endReadingSession as endReadingSessionPure,
  readingElapsedMs,
  isReadingActive,
} from './reading';
import { escapeHtml, pad2 } from '../core/utils';

let dataManager: PomodoroDataManager | null = null;
let state: PomodoroState = createInitialState();
let history: HistoryEntry[] = [];
let reading: ReadingSession = { active: false, book: null, elapsedMs: 0, startedAt: null, prevState: null };
let loaded = false;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let timerId: number | null = null;
let appRef: App | null = null;
let pickerMask: HTMLElement | null = null;
let pickerPopupEl: HTMLElement | null = null;
let pickerEsc: { unregister: () => void } | null = null;

/** 备忘录数据文件路径（storagePath 优先，todoFilePath 兼容兜底）——目标选择器读取 */
function getMemoFilePath(): string {
  const s = tryGetSettings();
  const dir = ((s && (s.storagePath || s.todoFilePath)) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/memo.json`;
}
/** 时长：按设置预设解析（T31）；自定义/非法值回退默认（经典 25/5/15、N=4）。
 * 注（ticket 56）：读书不再替换主番茄钟状态机，主预设始终为用户所选（读书记时独立累计）。 */
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

function phaseText(phase: Phase, count: number, d: Durations): string {
  if (phase === 'focus') return `专注 ${count + 1}/${d.longBreakInterval}`;
  if (phase === 'short-break') return '短休息';
  if (phase === 'long-break') return '长休息';
  return '🍅 番茄钟';
}

/** 阶段开始（手动开始/继续）：toast + 提示音（专注/短休/长休各一种，听声即知状态） */
function notifyPhaseStarted(phase: Phase): void {
  const d = durations();
  if (phase === 'focus') {
    notice('专注开始', 'success');
  } else if (phase === 'long-break') {
    notice(`长休息开始：${d.longBreakMin} 分钟`, 'success');
  } else {
    notice(`休息开始：${d.shortBreakMin} 分钟`, 'success');
  }
  const s = tryGetSettings();
  if (s.pomodoroSound !== false) {
    const kind: SoundKind =
      phase === 'focus' ? 'focus-start' : phase === 'long-break' ? 'long-break-start' : 'short-break-start';
    playSound(kind, pomodoroVolume());
  }
}

/** 暂停（手动）：toast + 提示音 */
function notifyPaused(): void {
  notice('已暂停专注', 'pause');
  const s = tryGetSettings();
  if (s.pomodoroSound !== false) playSound('pause', pomodoroVolume());
}

/** 阶段自然完成（tick 驱动）→ toast（完成语义）+ 新阶段开始提示声；skip 无 historyEntry 不通知 */
function notifyPhaseComplete(e: Extract<PomodoroEvent, { type: 'phase-completed' }>): void {
  const d = durations();
  if (e.completedPhase === 'focus') {
    const rest = e.nextPhase === 'long-break' ? `长休息 ${d.longBreakMin} 分钟` : `休息 ${d.shortBreakMin} 分钟`;
    notice(`专注完成：${rest}`, 'success');
  } else {
    notice('休息结束：开始专注', 'success');
  }
  // 声音 = 新阶段开始提示（专注/短休/长休各一声，听声即知状态，无需打开弹窗）
  const s = tryGetSettings();
  if (s.pomodoroSound !== false) {
    const kind: SoundKind =
      e.nextPhase === 'focus' ? 'focus-start' : e.nextPhase === 'long-break' ? 'long-break-start' : 'short-break-start';
    playSound(kind, pomodoroVolume());
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

/** 历史统计区：今日计数 + 近 7 天柱条（ticket 30）；同日同计数跳过重建（防 tick 每秒 DOM churn） */
let lastStatsKey = '';
function renderStats(): void {
  const now = Date.now();
  const todayEl = document.getElementById('pomodoro-today');
  if (todayEl) todayEl.textContent = `今日 ${todayCount(history, now)} 个 🍅`;
  const bookEl = document.getElementById('pomodoro-book');
  if (bookEl) {
    const c = bookCountToday(history, now);
    bookEl.textContent = c > 0 ? `📚 读书 ${c} 个 🍅` : '';
  }
  const weekEl = document.getElementById('pomodoro-week');
  if (!weekEl) return;
  const days = last7Days(history, now);
  const key = days.map((d) => `${d.date}:${d.count}`).join(',');
  if (key === lastStatsKey) return;
  lastStatsKey = key;
  const max = Math.max(1, ...days.map((d) => d.count));
  weekEl.innerHTML = '';
  for (const d of days) {
    const bar = document.createElement('div');
    bar.className = 'pomodoro-stat-day';
    bar.title = `${d.date}：${d.count} 个`;
    const col = document.createElement('div');
    col.className = 'pomodoro-stat-col';
    const h = document.createElement('div');
    h.className = 'pomodoro-stat-bar';
    h.style.height = `${Math.max(2, Math.round((d.count / max) * 40))}px`;
    col.appendChild(h);
    const label = document.createElement('span');
    label.className = 'pomodoro-stat-label';
    label.textContent = d.date.slice(5); // MM-DD
    col.appendChild(label);
    bar.appendChild(col);
    weekEl.appendChild(bar);
  }
}

function render(): void {
  const d = durations();
  const remain = remainingSec();
  // 读书中：状态栏与弹窗显示独立读书累计时长（主番茄钟挂起）
  if (reading.active && reading.startedAt !== null) {
    const readingRemain = fmt(Math.floor(readingElapsedMs(reading, Date.now()) / 1000));
    syncPomodoroStatusBar(state, remain, reading.active, Math.floor(readingElapsedMs(reading, Date.now()) / 1000));
    if (maskEl) {
      setRingProgress(1); // 读书累计无「剩余」概念，环形显示为满
      const phaseEl = document.getElementById('pomodoro-phase');
      if (phaseEl) phaseEl.textContent = `📖 读书中${reading.book ? `《${reading.book.title}》` : ''}`;
      const timeEl = document.getElementById('pomodoro-time');
      if (timeEl) timeEl.textContent = readingRemain;
      renderTarget();
      renderStats();
      updateButtons();
    }
    return;
  }
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
  renderTarget();
  renderStats();
  updateButtons();
}

function setRingProgress(progress: number): void {
  const C = 2 * Math.PI * 52;
  const circle = document.getElementById('pomodoro-ring-progress') as SVGElement | null;
  if (!circle) return;
  circle.setAttribute('stroke-dasharray', String(C));
  circle.setAttribute('stroke-dashoffset', String(C * (1 - progress)));
}

/** 目标区渲染（render 内部抽取，读书中分支复用） */
function renderTarget(): void {
  const targetEl = document.getElementById('pomodoro-target');
  if (!targetEl) return;
  const labelEl = document.getElementById('pomodoro-target-label');
  const clearEl = document.getElementById('pomodoro-target-clear');
  if (labelEl && clearEl) {
    if (state.target) {
      labelEl.textContent = `🎯 ${state.target.label}`;
      clearEl.style.display = '';
      targetEl.classList.remove('pomodoro-target-empty');
      targetEl.classList.remove('pomodoro-target-hidden'); // 选中后始终显示
    } else {
      labelEl.textContent = '🎯 选择目标';
      clearEl.style.display = 'none';
      targetEl.classList.add('pomodoro-target-empty');
      // hidden 由 hover 管理（mouseenter/mouseleave 切换），render 不干预
    }
  }
}

/** 按钮态渲染（render 内部抽取，读书中分支复用） */
function updateButtons(): void {
  const startBtn = document.getElementById('pomodoro-btn-start') as HTMLButtonElement | null;
  if (!startBtn) return;
  const running = state.endTime !== null;
  // 读书中主番茄钟挂起：开始/重置/跳过均禁用（读书会话独立计时）
  const suspended = reading.active;
  startBtn.textContent = running ? '暂停' : state.paused ? '继续' : '开始';
  const locked = options().forceFocus && state.phase === 'focus' && (running || state.paused);
  startBtn.disabled = locked || suspended;
  const resetBtn = document.getElementById('pomodoro-btn-reset') as HTMLButtonElement | null;
  const skipBtn = document.getElementById('pomodoro-btn-skip') as HTMLButtonElement | null;
  if (resetBtn) resetBtn.disabled = locked || suspended;
  if (skipBtn) skipBtn.disabled = locked || suspended;
}

/** 状态变更统一入口：transition → 落盘（完成事件）→ 通知/声音 → tick 生命周期 → 渲染 */
function applyAction(action: PomodoroAction): void {
  const r = transition(state, action, Date.now(), durations(), options());
  state = r.state;
  if (r.event.type === 'started') notifyPhaseStarted(r.event.phase);
  if (r.event.type === 'phase-completed') {
    if (r.event.historyEntry) history = history.concat(r.event.historyEntry);
    // 仅自然完成（tick 驱动）通知+响；skip（手动）静默
    if (action === 'tick') notifyPhaseComplete(r.event);
  }
  // 暂停生效（含手动；forceFocus 下 transition 返回 none 不触发）才通知+响
  if (action === 'pause' && state.paused) notifyPaused();
  if (r.event.type !== 'none') void save();
  ensureTick();
  render();
}

function onTick(): void {
  applyAction('tick');
  checkReadingNow(); // 读书联动：同视图换书兜底轮询（复用 tick，不新增独立定时器）
}

/** tick 生命周期：主计时或读书会话进行中才轮询；两者都停即停（节省资源） */
function ensureTick(): void {
  const needsTick = state.endTime !== null || reading.active;
  if (needsTick && timerId === null) {
    timerId = window.setInterval(onTick, 1000);
  } else if (!needsTick && timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

async function save(): Promise<void> {
  if (dataManager) await dataManager.save({ version: 1, state, history, reading });
}

/** 首次打开：load + 主倒计时超时恢复（静默）+ 读书会话装载 */
async function initData(): Promise<void> {
  const data = await dataManager!.load();
  const r = recover(data.state, data.history, Date.now(), durations(), options());
  state = r.state;
  history = r.history;
  reading = data.reading ? data.reading : { active: false, book: null, elapsedMs: 0, startedAt: null, prevState: null };
  if (r.events.length > 0) await dataManager!.save({ version: 1, state, history, reading });
  loaded = true;
}

/** ⚙️ 番茄钟设置弹窗（ADR-0009：11 项，复用 core/settings-modal） */
function openPomodoroSettings(): void {
  openSettingsModal({
    title: '番茄钟设置',
    build: (el) => {
      const s = getSettings();
      const isCustom = () => s.pomodoroPreset === CUSTOM_PRESET_ID;
      let workRow: Setting | null = null;
      let shortRow: Setting | null = null;
      let longRow: Setting | null = null;
      const refreshCustom = () => {
        const show = isCustom();
        if (workRow) workRow.settingEl.toggleClass('bz-setting-hidden', !show);
        if (shortRow) shortRow.settingEl.toggleClass('bz-setting-hidden', !show);
        if (longRow) longRow.settingEl.toggleClass('bz-setting-hidden', !show);
      };
      new Setting(el)
        .setName('预设方案')
        .setDesc('工作时间 / 短休息 / 长休息 时长组合')
        .addDropdown((dd) => {
          for (const [id, p] of Object.entries(PRESETS)) {
            dd.addOption(id, `${p.label}（${p.workMin}/${p.shortBreakMin}/${p.longBreakMin}）`);
          }
          dd.addOption(CUSTOM_PRESET_ID, '自定义');
          dd.setValue(s.pomodoroPreset || 'classic');
          dd.onChange(async (v) => {
            s.pomodoroPreset = v;
            refreshCustom(); // 立即反馈（先于落盘）
            await saveSettings();
            render();
          });
        });
      const numSetting = (name: string, desc: string, get: () => string, set: (v: string) => void): Setting =>
        new Setting(el)
          .setName(name)
          .setDesc(desc)
          .addText((text) =>
            text
              .setValue(get())
              .onChange(async (v) => {
                set(v);
                await saveSettings();
                render();
              })
          );
      workRow = numSetting('工作时长（分钟）', '自定义方案的工作阶段时长', () => s.pomodoroWorkMin ?? '25', (v) => (s.pomodoroWorkMin = v));
      shortRow = numSetting('短休息时长（分钟）', '自定义方案的短休息时长', () => s.pomodoroShortBreakMin ?? '5', (v) => (s.pomodoroShortBreakMin = v));
      longRow = numSetting('长休息时长（分钟）', '自定义方案的长休息时长', () => s.pomodoroLongBreakMin ?? '15', (v) => (s.pomodoroLongBreakMin = v));
      new Setting(el)
        .setName('长休息间隔')
        .setDesc('几个专注后进入长休息（默认 4）')
        .addText((text) =>
          text
            .setValue(s.pomodoroLongBreakInterval ?? '4')
            .onChange(async (v) => {
              s.pomodoroLongBreakInterval = v;
              await saveSettings();
              render();
            })
        );
      const toggleSetting = (name: string, desc: string, get: () => boolean, set: (v: boolean) => void): Setting =>
        new Setting(el)
          .setName(name)
          .setDesc(desc)
          .addToggle((toggle) =>
            toggle
              .setValue(get())
              .onChange(async (v) => {
                set(v);
                await saveSettings();
                render();
              })
          );
      toggleSetting('强制专注模式', '专注阶段无法暂停/跳过/重置', () => !!s.pomodoroForceFocus, (v) => (s.pomodoroForceFocus = v));
      toggleSetting('自动循环', '阶段结束后自动开始下一阶段', () => !!s.pomodoroAutoCycle, (v) => (s.pomodoroAutoCycle = v));
      toggleSetting('自动跳过休息', '专注结束后立即开始下一专注（连续工作）', () => !!s.pomodoroAutoSkipBreak, (v) => (s.pomodoroAutoSkipBreak = v));
      toggleSetting('声音提醒', '阶段完成时的提示音', () => s.pomodoroSound !== false, (v) => (s.pomodoroSound = v));
      new Setting(el)
        .setName('音量')
        .setDesc('提示音大小（默认最大）')
        .addSlider((sl) => {
          sl.setLimits(0, 100, 5)
            .setValue(s.pomodoroVolume ?? 100)
            .setDynamicTooltip();
          sl.onChange(async (v) => {
            s.pomodoroVolume = v;
            await saveSettings();
          });
        })
        .addButton((b) =>
          b.setButtonText('试听').onClick(() => {
            playSound('focus-start', s.pomodoroVolume ?? 100);
          })
        );
      new Setting(el)
        .setName('打开时恢复方式')
        .setDesc('Obsidian 启动时若正在倒计时：后台继续（状态栏可见）或自动弹窗提醒')
        .addDropdown((dd) => {
          dd.addOption('background', '后台继续');
          dd.addOption('popup', '自动弹窗');
          dd.setValue(s.pomodoroRestoreMode || 'background');
          dd.onChange(async (v) => {
            s.pomodoroRestoreMode = v;
            await saveSettings();
          });
        });
      toggleSetting('读书自动番茄钟', '打开 epub 书阅读时自动开始独立读书计时（主番茄钟挂起），关闭书结算并恢复主番茄钟（默认开）', () => s.pomodoroEpubAuto !== false, (v) => (s.pomodoroEpubAuto = v));
      new Setting(el)
        .setName('读书启动形态')
        .setDesc('打开 epub 书自动开始读书专注时的展示方式')
        .addDropdown((dd) => {
          dd.addOption('background', '后台静默（仅状态栏）');
          dd.addOption('popup', '自动弹窗');
          dd.setValue(s.pomodoroEpubMode || 'background');
          dd.onChange(async (v) => {
            s.pomodoroEpubMode = v;
            await saveSettings();
          });
        });
      refreshCustom();
    },
  });
}

function bindEvents(): void {
  const startBtn = document.getElementById('pomodoro-btn-start')!;
  startBtn.addEventListener('click', () => applyAction(state.paused ? 'resume' : state.endTime !== null ? 'pause' : 'start'));
  document.getElementById('pomodoro-btn-reset')!.addEventListener('click', resetPomodoro);
  document.getElementById('pomodoro-btn-skip')!.addEventListener('click', () => applyAction('skip'));
  const settingsBtn = document.getElementById('pomodoro-btn-settings')!;
  // 设置入口：默认隐藏，hover 面板才显示（幽灵图标）
  settingsBtn.classList.add('pomodoro-settings-hidden');
  setIcon(settingsBtn, 'gear'); // Obsidian 原生 lucide 图标（与状态栏/命令一致）
  settingsBtn.addEventListener('click', openPomodoroSettings);
  const popup = document.getElementById('pomodoro-popup')!;
  const targetEl = document.getElementById('pomodoro-target')!;
  // 幽灵入口：默认隐藏，hover 面板才显示（设置按钮 + 未选中的目标区）
  popup.addEventListener('mouseenter', () => {
    settingsBtn.classList.remove('pomodoro-settings-hidden');
    if (!state.target) targetEl.classList.remove('pomodoro-target-hidden');
  });
  popup.addEventListener('mouseleave', () => {
    settingsBtn.classList.add('pomodoro-settings-hidden');
    if (!state.target) targetEl.classList.add('pomodoro-target-hidden');
  });
  // 目标区：点击换目标，✕ 清除
  document.getElementById('pomodoro-target')!.addEventListener('click', openTargetPicker);
  document.getElementById('pomodoro-target-clear')!.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTarget();
  });
}

function buildDOM(): void {
  const mask = document.createElement('div');
  mask.id = 'pomodoro-mask';
  // 域主弹窗层级（password 先例 9998）：低于域设置弹窗 10030 与 Obsidian 设置页，⚙️ 弹窗可正常覆盖
  mask.style.zIndex = '9998';
  mask.innerHTML = `
    <div id="pomodoro-popup">
      <button id="pomodoro-btn-settings" class="pomodoro-btn" title="设置"></button>
      <div id="pomodoro-target" class="pomodoro-target pomodoro-target-empty pomodoro-target-hidden" title="选择专注目标">
        <span id="pomodoro-target-label"></span>
        <span id="pomodoro-target-clear" class="pomodoro-target-clear">✕</span>
      </div>
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
      <div class="pomodoro-stats">
        <div id="pomodoro-today"></div>
        <div id="pomodoro-book" class="pomodoro-book"></div>
        <div id="pomodoro-week" class="pomodoro-week"></div>
      </div>
    </div>`;
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
}

/** 打开弹窗（幂等：已存在则仅确保显示；未加载先 load+recover） */
export async function openPomodoro(app: App): Promise<void> {
  appRef = app;
  bindPomodoroState(() => state); // 读书联动状态快照（epub-link 决策用）
  bindReadingSession(() => isReadingActive(reading)); // 读书会话进行中（决策用）
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!maskEl) {
    if (!loaded) await initData();
    buildDOM();
    ensureTick(); // 恢复/首次打开时若在倒计时，启动轮询继续走（修复：恢复后不 tick 的 bug）
  }
}

// ===== 独立读书计时动作（ticket 56，epub-link 经函数体内 import 调用）=====

/** 退出读书会话：等价 closeReadingSession（任何已保存会话由关书逻辑结算恢复） */
export function exitReadingMode(): void {
  closeReadingSession();
}

/**
 * 开始读书会话（打开书，Q9 idle 直连 / Q17 确认后）：快照并挂起主番茄钟，
 * 另起独立读书计时（endTime 基准累计，后台节流/重启不漏时）。主番茄钟暂停在冻结剩余。
 */
export function startReadingFocus(book: ReadingBook): void {
  const now = Date.now();
  // 主番茄钟挂起：冻结剩余（endTime → remaining/paused），快照完整原状（含 endTime 供恢复）
  const frozenRemaining = state.endTime !== null ? Math.max(0, Math.ceil((state.endTime - now) / 1000)) : state.remaining;
  const snapshot = state;
  state = { ...state, endTime: null, paused: true, remaining: frozenRemaining };
  reading = newReadingSession(snapshot, book, now);
  notice(`读书计时开始：${book.title}`, 'success');
  void save();
  ensureTick();
  render();
}

/** 换书直接切（Q6）：结算当前书累计（>0 入读书历史），另起新书独立计时；主番茄钟保持挂起 */
export function switchReadingFocus(book: ReadingBook): void {
  if (!reading.active) {
    startReadingFocus(book);
    return;
  }
  const now = Date.now();
  const oldBook = reading.book;
  const { session, settledMs } = switchReadingSessionPure(reading, book, now);
  if (settledMs > 0 && oldBook) settleReadingHistory(oldBook, settledMs, now);
  reading = session;
  void save();
  ensureTick();
  render();
}

/** 结算读书历史（按结束时刻入账 target.type=book 条目，单独计入读书番茄数） */
function settleReadingHistory(book: ReadingBook | null, ms: number, ts: number): void {
  if (!book || ms <= 0) return;
  const sec = Math.round(ms / 1000);
  history = history.concat({ ts, duration: sec, target: { type: 'book', path: book.path, label: book.title } });
}

/** 关闭书：结算读书累计 → 单独入账读书历史 → 恢复挂起的主番茄钟快照（Q21） */
export function closeReadingSession(): void {
  if (!reading.active) return;
  const now = Date.now();
  const oldBook = reading.book;
  const { session, settledMs, prevState } = endReadingSessionPure(reading, now);
  settleReadingHistory(oldBook, settledMs, now);
  reading = session;
  if (prevState) state = prevState; // 恢复进入读书前的主番茄钟状态（原 endTime → 原样继续）
  notice(
    settledMs > 0 ? `读书结束：${fmt(Math.floor(settledMs / 1000))}，主番茄钟已恢复` : '读书结束，主番茄钟已恢复',
    'success'
  );
  void save();
  ensureTick();
  render();
}

// ===== 读书确认弹窗（ticket 54，Q5/Q10）：休息中跳过 / 他处专注中进入 =====

let readingConfirmMask: HTMLElement | null = null;
let readingConfirmPopupEl: HTMLElement | null = null;
let readingConfirmEsc: { unregister: () => void } | null = null;

function closeReadingConfirm(): void {
  if (readingConfirmMask) {
    readingConfirmMask.remove();
    readingConfirmMask = null;
  }
  if (readingConfirmPopupEl) {
    readingConfirmPopupEl.remove();
    readingConfirmPopupEl = null;
  }
  if (readingConfirmEsc) {
    readingConfirmEsc.unregister();
    readingConfirmEsc = null;
  }
}

/** 读书确认弹窗：是 → 立即开始读书专注（Q17 按读书预设重启当前段）；否/ESC/遮罩 → 保持原样（Q12） */
export function showReadingConfirm(d: { book: ReadingBook; mode: 'skip-break' | 'enter' }): void {
  if (readingConfirmMask) return; // 已显示（快速换书/重复触发）
  const { mask, popup } = createOverlay({
    maskId: 'pomodoro-reading-confirm-mask',
    popupId: 'pomodoro-reading-confirm',
    zIndex: 10005, // 与目标选择器同级（settings-modal 注释区间 10001-10005）
    onMaskClick: closeReadingConfirm,
  });
  const isBreak = d.mode === 'skip-break';
  const bookName = escapeHtml(d.book.title);
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--background-modifier-border);font-size:15px;font-weight:600;">
      <span>📖 读书专注</span>
      <button id="pomodoro-reading-confirm-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);padding:0 4px;">✕</button>
    </div>
    <div style="padding:18px 16px;font-size:14px;line-height:1.6;color:var(--text-normal);max-width:280px;">
      ${isBreak ? `跳过休息，开始读书专注《${bookName}》？` : `检测到阅读《${bookName}》，进入读书专注？`}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 14px;">
      <button id="pomodoro-reading-confirm-no" class="pomodoro-btn">否</button>
      <button id="pomodoro-reading-confirm-yes" class="pomodoro-btn pomodoro-btn-primary">是，开始读书</button>
    </div>`;
  popup.querySelector('#pomodoro-reading-confirm-close')!.addEventListener('click', closeReadingConfirm);
  popup.querySelector('#pomodoro-reading-confirm-no')!.addEventListener('click', closeReadingConfirm);
  popup.querySelector('#pomodoro-reading-confirm-yes')!.addEventListener('click', () => {
    closeReadingConfirm();
    startReadingFocus(d.book); // Q17：确认后快照挂起主番茄钟、开始独立读书计时
  });
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';
  readingConfirmMask = mask;
  readingConfirmPopupEl = popup;
  readingConfirmEsc = escManager.register('pomodoro-reading-confirm', {
    isVisible: () => readingConfirmMask !== null,
    close: closeReadingConfirm,
  });
}

/** 插件启动恢复（main.ts onLayoutReady 调用）：load+recover+落盘；正在倒计时 → 后台 tick 继续 + 弹恢复通知；popup 模式自动弹窗 */
export async function ensurePomodoro(app: App): Promise<void> {
  appRef = app;
  bindPomodoroState(() => state); // 读书联动状态快照（epub-link 决策用）
  bindReadingSession(() => isReadingActive(reading)); // 读书会话进行中（决策用）
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!loaded) {
    await initData();
    // 重启时若读书会话仍未结算（书开着）→ 恢复独立计时继续累计（endTime 基准，后台不漏时）；
    // 书已关时由 epub-link 启动检测（checkReadingNow）触发关书结算 + 主番茄钟恢复。
    if (reading.active) {
      ensureTick();
      render();
      const s = tryGetSettings();
      if (s.pomodoroRestoreMode === 'popup') void openPomodoro(app);
      return;
    }
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

// ===== 专注目标（任务关联，第一期）：目标区 + 三来源选择器 =====

function setTarget(t: FocusTarget): void {
  state = { ...state, target: t };
  void save();
  render();
  closeTargetPicker();
}

function clearTarget(): void {
  state = { ...state, target: null };
  void save();
  render();
}

/** 重置：当前阶段回满时长并停止 + 同置清空当前关联目标（reset 按钮，ticket 56） */
function resetPomodoro(): void {
  const hadTarget = state.target !== null;
  applyAction('reset');
  if (hadTarget && state.target !== null) {
    state = { ...state, target: null };
    void save();
    render();
  }
}

function closeTargetPicker(): void {
  if (pickerMask) {
    pickerMask.remove();
    pickerMask = null;
  }
  // mask 与 popup 是 body 下兄弟元素（createOverlay），必须同时移除——否则 popup 残留盖屏拦截点击
  if (pickerPopupEl) {
    pickerPopupEl.remove();
    pickerPopupEl = null;
  }
  if (pickerEsc) {
    pickerEsc.unregister();
    pickerEsc = null;
  }
}

function openTargetPicker(): void {
  if (pickerMask || !appRef) return;
  const { mask, popup } = createOverlay({
    maskId: 'pomodoro-target-picker-mask',
    popupId: 'pomodoro-target-picker',
    zIndex: 10005, // 面板内弹窗层级（settings-modal 注释区间 10001-10005），高于主弹窗 9998、低于设置弹窗 10030
    onMaskClick: closeTargetPicker,
  });
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--background-modifier-border);font-size:15px;font-weight:600;">
      <span>选择专注目标</span>
      <button id="pomodoro-target-picker-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);padding:0 4px;">✕</button>
    </div>
    <div class="pomodoro-target-tabs">
      <button class="pomodoro-target-tab" data-tab="memo">📝 备忘录</button>
      <button class="pomodoro-target-tab" data-tab="note">📄 当前笔记</button>
    </div>
    <div id="pomodoro-target-list" style="padding:8px 12px;max-height:50vh;overflow-y:auto;"></div>`;
  popup.querySelectorAll('.pomodoro-target-tab').forEach((b) => {
    b.addEventListener('click', () => switchTab((b as HTMLElement).dataset.tab || 'memo'));
  });
  popup.querySelector('#pomodoro-target-picker-close')!.addEventListener('click', closeTargetPicker);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';
  pickerMask = mask;
  pickerPopupEl = popup;
  pickerEsc = escManager.register('pomodoro-target-picker', {
    isVisible: () => pickerMask !== null,
    close: closeTargetPicker,
  });
  switchTab('memo');
}

function switchTab(tab: string): void {
  document.querySelectorAll('.pomodoro-target-tab').forEach((b) => {
    b.classList.toggle('pomodoro-target-tab-active', (b as HTMLElement).dataset.tab === tab);
  });
  const list = document.getElementById('pomodoro-target-list');
  if (!list) return;
  list.innerHTML = '';
  if (tab === 'memo') void renderMemoTab(list);
  else renderNoteTab(list);
}

async function renderMemoTab(list: HTMLElement): Promise<void> {
  try {
    const items = (await jsonStore(getMemoFilePath()).read()) as any[];
    // 竞态守卫：等待期间用户切换了 tab 或关闭了选择器 → 放弃渲染
    if (!list.isConnected || document.querySelector('.pomodoro-target-tab-active')?.getAttribute('data-tab') !== 'memo') return;
    const open = items.filter((i) => i && typeof i === 'object' && !i.completed);
    if (open.length === 0) {
      list.textContent = '没有未完成的备忘录';
      return;
    }
    for (const it of open) {
      const row = document.createElement('div');
      row.className = 'pomodoro-target-item';
      row.textContent = `${it.title}${it.scene ? `（${it.scene}）` : ''}`;
      row.addEventListener('click', () => setTarget({ type: 'memo', id: it.id, label: it.title }));
      list.appendChild(row);
    }
  } catch (e) {
    list.textContent = '备忘录读取失败';
  }
}

function renderNoteTab(list: HTMLElement): void {
  const f = appRef?.workspace?.getActiveFile?.();
  if (!f) {
    list.textContent = '未打开任何笔记';
    return;
  }
  list.innerHTML = `<div class="pomodoro-target-note">
    <span id="pomodoro-target-note-name">📄 ${f.basename}</span>
    <button id="pomodoro-target-note-use">使用此笔记</button>
  </div>`;
  document.getElementById('pomodoro-target-note-use')!.addEventListener('click', () =>
    setTarget({ type: 'note', path: f.path, label: f.basename })
  );
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
  closeTargetPicker();
  closeReadingConfirm();
  closePomodoro();
  state = createInitialState();
  history = [];
  reading = { active: false, book: null, elapsedMs: 0, startedAt: null, prevState: null };
  lastStatsKey = '';
  dataManager = null;
  appRef = null;
  loaded = false;
}
