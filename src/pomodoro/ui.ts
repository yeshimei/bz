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
import { getBookItems } from '../library/items';
import { PomodoroDataManager } from './data';
import { playSound } from './sound';
import type { SoundKind } from './sound';
import { syncPomodoroStatusBar } from './statusbar';
import { todayCount, last7Days, bookMinutesToday } from './stats';
import { PRESETS, CUSTOM_PRESET_ID } from './config';
import type { PomodoroState, HistoryEntry, Durations, PomodoroOptions, Phase, PomodoroAction, PomodoroEvent, FocusTarget } from './state';
import { transition, recover, createInitialState, DEFAULT_DURATIONS, phaseDurationSec } from './state';

let dataManager: PomodoroDataManager | null = null;
let state: PomodoroState = createInitialState();
let history: HistoryEntry[] = [];
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

function phaseText(phase: Phase, count: number, d: Durations): string {
  if (phase === 'focus') return `专注 ${count + 1}/${d.longBreakInterval}`;
  if (phase === 'short-break') return '短休息';
  if (phase === 'long-break') return '长休息';
  return '🍅 番茄钟';
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
    playSound(kind);
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

/** 历史统计区：今日计数 + 近 7 天柱条（ticket 30）；同日同计数跳过重建（防 tick 每秒 DOM churn） */
let lastStatsKey = '';
function renderStats(): void {
  const now = Date.now();
  const todayEl = document.getElementById('pomodoro-today');
  if (todayEl) todayEl.textContent = `今日 ${todayCount(history, now)} 个 🍅`;
  const bookEl = document.getElementById('pomodoro-book');
  if (bookEl) {
    const m = bookMinutesToday(history, now);
    bookEl.textContent = m > 0 ? `📚 读书 ${m} 分钟` : '';
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
  // 目标区：未选 → 灰字「选择目标」+ ✕ 隐藏；已选 → 目标名 + ✕
  const targetEl = document.getElementById('pomodoro-target');
  if (targetEl) {
    const labelEl = document.getElementById('pomodoro-target-label');
    const clearEl = document.getElementById('pomodoro-target-clear');
    if (labelEl && clearEl) {
      if (state.target) {
        labelEl.textContent = `🎯 ${state.target.label}`;
        clearEl.style.display = '';
        targetEl.classList.remove('pomodoro-target-empty');
      } else {
        labelEl.textContent = '🎯 选择目标';
        clearEl.style.display = 'none';
        targetEl.classList.add('pomodoro-target-empty');
      }
    }
  }
  renderStats();
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
    #pomodoro-mask { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); }
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
    #pomodoro-btn-settings { position: absolute; top: 16px; right: 16px; padding: 6px; background: none; border-radius: 8px; color: var(--text-muted); transition: opacity 0.2s; }
    #pomodoro-btn-settings:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
    #pomodoro-btn-settings.pomodoro-settings-hidden { opacity: 0; pointer-events: none; }
    .pomodoro-target { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--background-modifier-border); border-radius: 12px; font-size: 13px; cursor: pointer; }
    .pomodoro-target:hover { border-color: var(--interactive-accent); }
    .pomodoro-target-empty { color: var(--text-faint); }
    .pomodoro-target-clear { color: var(--text-muted); padding: 0 2px; }
    .pomodoro-target-clear:hover { color: var(--text-error); }
    .pomodoro-target-tabs { display: flex; gap: 4px; padding: 8px 12px 0; }
    .pomodoro-target-tab { padding: 4px 10px; border-radius: 8px; background: none; color: var(--text-muted); cursor: pointer; font-size: 13px; }
    .pomodoro-target-tab-active { background: var(--background-modifier-hover); color: var(--text-normal); }
    .pomodoro-target-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .pomodoro-target-item:hover { background: var(--background-modifier-hover); }
    .pomodoro-book { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .pomodoro-target-note { padding: 10px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
    .pomodoro-target-note button { padding: 4px 12px; border-radius: 8px; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer; font-size: 13px; }
    .pomodoro-stats { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--background-modifier-border); }
    #pomodoro-today { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
    .pomodoro-week { display: flex; gap: 6px; justify-content: center; align-items: flex-end; }
    .pomodoro-stat-day { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .pomodoro-stat-col { display: flex; align-items: flex-end; height: 40px; }
    .pomodoro-stat-bar { width: 10px; border-radius: 3px 3px 0 0; background: var(--interactive-accent); min-height: 2px; }
    .pomodoro-stat-label { font-size: 9px; color: var(--text-faint); }
  `;
  document.head.appendChild(style);
}

/** ⚙️ 番茄钟设置弹窗（ADR-0009：9 项，复用 core/settings-modal） */
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
      refreshCustom();
    },
  });
}

function bindEvents(): void {
  const startBtn = document.getElementById('pomodoro-btn-start')!;
  startBtn.addEventListener('click', () => applyAction(state.paused ? 'resume' : state.endTime !== null ? 'pause' : 'start'));
  document.getElementById('pomodoro-btn-reset')!.addEventListener('click', () => applyAction('reset'));
  document.getElementById('pomodoro-btn-skip')!.addEventListener('click', () => applyAction('skip'));
  const settingsBtn = document.getElementById('pomodoro-btn-settings')!;
  // 设置入口：默认隐藏，hover 面板才显示（幽灵图标）
  settingsBtn.classList.add('pomodoro-settings-hidden');
  setIcon(settingsBtn, 'gear'); // Obsidian 原生 lucide 图标（与状态栏/命令一致）
  settingsBtn.addEventListener('click', openPomodoroSettings);
  const popup = document.getElementById('pomodoro-popup')!;
  popup.addEventListener('mouseenter', () => settingsBtn.classList.remove('pomodoro-settings-hidden'));
  popup.addEventListener('mouseleave', () => settingsBtn.classList.add('pomodoro-settings-hidden'));
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
      <div id="pomodoro-target" class="pomodoro-target pomodoro-target-empty" title="选择专注目标">
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
  injectStyles();
  bindEvents();
  render();
}

/** 打开弹窗（幂等：已存在则仅确保显示；未加载先 load+recover） */
export async function openPomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!maskEl) {
    if (!loaded) await initData();
    buildDOM();
    ensureTick(); // 恢复/首次打开时若在倒计时，启动轮询继续走（修复：恢复后不 tick 的 bug）
  }
}

/** 插件启动恢复（main.ts onLayoutReady 调用）：load+recover+落盘；正在倒计时 → 后台 tick 继续 + 弹恢复通知；popup 模式自动弹窗 */
export async function ensurePomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!loaded) {
    await initData();
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
      <button class="pomodoro-target-tab" data-tab="book">📚 书库</button>
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
  else if (tab === 'note') renderNoteTab(list);
  else renderBookTab(list);
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

function renderBookTab(list: HTMLElement): void {
  try {
    const books = getBookItems(appRef);
    if (books.length === 0) {
      list.textContent = '书库为空';
      return;
    }
    for (const b of books) {
      const row = document.createElement('div');
      row.className = 'pomodoro-target-item';
      row.textContent = `📚 ${b.title}`;
      row.addEventListener('click', () => setTarget({ type: 'book', path: b.file.path, label: b.title }));
      list.appendChild(row);
    }
  } catch (e) {
    list.textContent = '书库读取失败';
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
  closeTargetPicker();
  closePomodoro();
  const style = document.querySelector('style[data-pomodoro-styles]');
  if (style) style.remove();
  state = createInitialState();
  history = [];
  lastStatsKey = '';
  dataManager = null;
  appRef = null;
  loaded = false;
}
