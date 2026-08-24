/**
 * 番茄钟弹窗 UI（ticket 28-31）：中央单例弹窗 + 1s tick 驱动 + 状态栏同步 + 完成通知 + ⚙️ 设置弹窗。
 * 关闭弹窗计时后台继续（tick 常驻，状态栏持续刷新，重开从内存状态渲染）；
 * 阶段自然完成（tick 驱动）→ toast + 提示音 + 落盘；skip 静默；打开时超时恢复（initData 路径不通知）。
 * 设置：预设/自定义时长/N/开关均读 BzSettings（tryGetSettings 缺省回退）。
 * ticket 63：移除读书番茄钟与专注目标选择（用户决策），保留后台自动暂停/不补算（ticket 62）。
 */
import { Setting } from 'obsidian';
import type { App } from 'obsidian';
import { setIcon } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { notice } from '../core/notice';
import { openSettingsModal, createSettingsGroup, refreshSettingsGroupCounts } from '../core/settings-modal';
import { PomodoroDataManager } from './data';
import { playSound } from './sound';
import type { SoundKind } from './sound';
import { syncPomodoroStatusBar } from './statusbar';
import { todayCount, last7Days } from './stats';
import { PRESETS, CUSTOM_PRESET_ID } from './config';
import type { PomodoroState, HistoryEntry, Durations, PomodoroOptions, Phase, PomodoroAction, PomodoroEvent } from './state';
import { transition, recover, createInitialState, phaseDurationSec } from './state';
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

/** 阶段自然完成（tick 驱动）→ toast（完成语义）+ 新阶段开始提示声；skip 无 historyEntry 不通知 */
function notifyPhaseComplete(e: Extract<PomodoroEvent, { type: 'phase-completed' }>): void {
  const d = durations();
  if (e.completedPhase === 'focus') {
    const rest = e.nextPhase === 'long-break' ? `长休息 ${d.longBreakMin} 分钟` : `休息 ${d.shortBreakMin} 分钟`;
    notice(`专注完成：${rest}`, 'success');
  } else {
    notice('休息结束：开始专注', 'success');
  }
  // 声音 = 新阶段开始提示（听声即知状态，无需打开弹窗）
  playPhaseSound(e.nextPhase);
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
  renderStats();
  updateButtons();
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
  const r = transition(state, action, Date.now(), durations(), options());
  state = r.state;
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
  // 手动暂停不带来源标记，重启后 locked 判定维持锁定）
  if (r.event.type !== 'none' || (action === 'pause' && state.paused)) void save();
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

/** 窗口恢复 visible：仅自动恢复由本机制冻结的会话 */
function resumeOnVisible(): void {
  const now = Date.now();
  if (autoPauseMain && state.paused) {
    state = unfreezeRunning(state, now);
    autoPauseMain = false;
  }
  if (!autoPauseMain) {
    void save();
    render();
  }
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
  if (dataManager) await dataManager.save({ version: 1, state, history });
}

/** 首次打开：load + 主倒计时超时恢复（静默；ticket 62 不补算——超时即回空闲） */
async function initData(): Promise<void> {
  const data = await dataManager!.load();
  const r = recover(data.state, data.history, Date.now(), durations(), options());
  state = r.state;
  history = r.history;
  // 主番茄钟超时回空闲（endTime 从有到无）→ 落盘
  const mainChanged = data.state.endTime !== null && r.state.endTime === null;
  if (mainChanged) await dataManager!.save({ version: 1, state, history });
  loaded = true;
}

/** ⚙️ 番茄钟设置弹窗（ADR-0009，复用 core/settings-modal；分组卡片重设计 + ticket 100 文案规范） */
function openPomodoroSettings(): void {
  openSettingsModal({
    title: '番茄钟设置',
    maxWidth: 560,
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
      // ===== 时间方案组 =====
      const timerGroup = createSettingsGroup(el, { icon: 'timer', name: '时间方案' });
      new Setting(timerGroup)
        .setName('预设方案')
        .setDesc('选择现成的工作与休息时长组合')
        .addDropdown((dd) => {
          for (const [id, p] of Object.entries(PRESETS)) {
            dd.addOption(id, `${p.label}（${p.workMin}/${p.shortBreakMin}/${p.longBreakMin}）`);
          }
          dd.addOption(CUSTOM_PRESET_ID, '自定义');
          dd.setValue(s.pomodoroPreset || 'classic');
          dd.onChange(async (v) => {
            s.pomodoroPreset = v;
            refreshCustom(); // 立即反馈（先于落盘）
            refreshSettingsGroupCounts(el); // 徽标随自定义行显隐刷新
            await saveSettings();
            render();
          });
        });
      const numSetting = (parent: HTMLElement, name: string, desc: string, get: () => string, set: (v: string) => void): Setting =>
        new Setting(parent)
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
      workRow = numSetting(timerGroup, '工作时长', '自定义方案的工作阶段分钟数', () => s.pomodoroWorkMin ?? '25', (v) => (s.pomodoroWorkMin = v));
      shortRow = numSetting(timerGroup, '短休息时长', '自定义方案的短休息分钟数', () => s.pomodoroShortBreakMin ?? '5', (v) => (s.pomodoroShortBreakMin = v));
      longRow = numSetting(timerGroup, '长休息时长', '自定义方案的长休息分钟数', () => s.pomodoroLongBreakMin ?? '15', (v) => (s.pomodoroLongBreakMin = v));
      new Setting(timerGroup)
        .setName('长休息间隔')
        .setDesc('每隔几个专注进入一次长休息')
        .addText((text) =>
          text
            .setValue(s.pomodoroLongBreakInterval ?? '4')
            .onChange(async (v) => {
              s.pomodoroLongBreakInterval = v;
              await saveSettings();
              render();
            })
        );
      // ===== 行为组 =====
      const behaviorGroup = createSettingsGroup(el, { icon: 'sliders-horizontal', name: '行为' });
      const toggleSetting = (name: string, desc: string, get: () => boolean, set: (v: boolean) => void): Setting =>
        new Setting(behaviorGroup)
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
      toggleSetting('强制专注模式', '专注进行中无法暂停跳过或重置', () => !!s.pomodoroForceFocus, (v) => (s.pomodoroForceFocus = v));
      toggleSetting('自动循环', '阶段结束后自动开始下一阶段', () => !!s.pomodoroAutoCycle, (v) => (s.pomodoroAutoCycle = v));
      toggleSetting('自动跳过休息', '专注结束后直接进入下一个专注', () => !!s.pomodoroAutoSkipBreak, (v) => (s.pomodoroAutoSkipBreak = v));
      toggleSetting('声音提醒', '阶段切换时播放提示音', () => s.pomodoroSound !== false, (v) => (s.pomodoroSound = v));
      toggleSetting('后台自动暂停', '窗口隐藏时暂停，恢复可见后自动继续', () => s.pomodoroAutoPauseOnHide !== false, (v) => (s.pomodoroAutoPauseOnHide = v));
      new Setting(behaviorGroup)
        .setName('提示音音量')
        .setDesc('提示音大小，默认最大')
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
      new Setting(behaviorGroup)
        .setName('打开时恢复方式')
        .setDesc('启动时正在倒计时，选择弹窗提醒或后台继续')
        .addDropdown((dd) => {
          dd.addOption('background', '后台继续');
          dd.addOption('popup', '自动弹窗');
          dd.setValue(s.pomodoroRestoreMode || 'background');
          dd.onChange(async (v) => {
            s.pomodoroRestoreMode = v;
            await saveSettings();
          });
        });
      // ===== 移动端组（仅移动端显示） =====
      if (isMobileEnv()) {
        const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
        new Setting(mobileGroup)
          .setName('移动端默认全屏')
          .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
          .addToggle((toggle) =>
            toggle.setValue(!!s.pomodoroMobileDefaultFullscreen).onChange(async (v) => { s.pomodoroMobileDefaultFullscreen = v; await saveSettings(); })
          );
      }
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
  // 幽灵设置按钮：默认隐藏，hover 面板才显示
  popup.addEventListener('mouseenter', () => {
    settingsBtn.classList.remove('pomodoro-settings-hidden');
  });
  popup.addEventListener('mouseleave', () => {
    settingsBtn.classList.add('pomodoro-settings-hidden');
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

/** 打开弹窗（幂等：已存在则仅确保显示；未加载先 load+recover）。
 *  初始化窗口内并发调用复用同一 in-flight Promise，杜绝双遮罩（P2）。 */
let openInflight: Promise<void> | null = null;
export async function openPomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  if (!maskEl) {
    openInflight ??= (async () => {
      if (!loaded) await initData();
      buildDOM();
      ensureTick(); // 恢复/首次打开时若在倒计时，启动轮询继续走（修复：恢复后不 tick 的 bug）
    })();
    try {
      await openInflight;
    } finally {
      openInflight = null;
    }
  }
  // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
  applyMobileWindowFullscreen(
    maskEl && (maskEl.querySelector('#pomodoro-popup') as HTMLElement),
    tryGetSettings().pomodoroMobileDefaultFullscreen === true
  );
}

/** 插件启动恢复（main.ts onLayoutReady 调用）：load+recover+落盘；正在倒计时 → 后台 tick 继续 + 弹恢复通知；popup 模式自动弹窗 */
export async function ensurePomodoro(app: App): Promise<void> {
  appRef = app;
  if (!dataManager) dataManager = new PomodoroDataManager(app);
  registerVisibilityListener(); // ticket 62：后台自动暂停（幂等）
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
  unregisterVisibilityListener(); // ticket 62
  autoPauseMain = false;
  openInflight = null; // 丢弃未完成的初始化（下次 openPomodoro 重新走 init）
  closePomodoro();
  state = createInitialState();
  history = [];
  lastStatsKey = '';
  dataManager = null;
  appRef = null;
  loaded = false;
}