/**
 * 番茄钟行为单源 · sim 启动入口（2026-09-11 接入预览管线，范式随 memo/settings-panel）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（core/storage 的 jsonFileStore 真实现跑在 fake vault 上——
 *     读改写/写队列全真，只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：pomodoro.json（state = **暂停中的专注** remaining 15 分钟、任务「周报」，
 *     与 home 壳同口径）——首页入口菜单的番茄钟项是**相位敏感的单个动作**
 *     （见 src/home/shared.pomodoroMenuAction），暂停相位 → 只出「继续专注」一条；
 *     暂停态不触发恢复通知/tick（recover 只在 endTime 到点时才动，见 pomodoro/state.ts），
 *     演示壳因此能稳定看到 paused / idle 两种文案例。种子按「今天」锚定 history 时刻，
 *     跨天自动重灌（今日统计口径以「今天」为锚，旧种子会整体失真——同 home 壳语义）。
 *   - 设置注入：setSettingsProvider 注入演示路径；番茄钟各设置键缺省回落
 *     tryGetSettings 默认值（经典 25/5/15、N=4、声音开）——不另行铺默认值。
 *   - 状态栏：插件侧由 main.ts addStatusBarItem 挂载，评审壳不挂（弹窗本体已覆盖全部评审面）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_pomodoro，iframe 壳只调 boot + openPanel + 自检钩子。
 * 插件的 ui.ts / state.ts / data.ts / stats.ts / sound.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import {
  openPomodoro,
  closePomodoro,
  ensurePomodoro,
  menuPhase,
} from '../../src/pomodoro/ui';

/** 种子版本（种子形状变化时 +1，触发重灌） */
const SEED_REV = 1;
const SEED_MARK = 'bz-sim:__pomodoro_seed';
const KEY_PREFIX = 'bz-sim:';

/* ---------- 相对日期工具（今日统计以「今天」为锚） ---------- */

/** n 天前/后的本地毫秒（n 为负 = 未来）；hm = 'HH:mm' */
function at(n: number, hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** 番茄种子：state = 暂停中的专注（remaining 15 分钟）+ 今日 2 轮 / 昨日 1 轮 history。
 *  字段与 pomodoro.json 真实形状同构（见 src/pomodoro/data.ts）。 */
function seedPomodoro(): string {
  return JSON.stringify(
    {
      version: 1,
      state: { phase: 'focus', endTime: null, remaining: 900, paused: true, cycleFocusCount: 2, task: '周报' },
      history: [
        { task: '周报', duration: 1500, ts: at(0, '09:00') },
        { task: '读书笔记', duration: 1500, ts: at(0, '14:27') },
        { task: '周报', duration: 1500, ts: at(1, '14:27') },
      ],
    },
    null,
    2
  );
}

const POMODORO_KEY = KEY_PREFIX + 'CONFIG/STORAGE/pomodoro.json';

function wipeSimKeys(): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) doomed.push(k);
  }
  for (const k of doomed) localStorage.removeItem(k);
}

/**
 * 种子灌库（幂等；跨天/版本变化自动重灌）：
 * history 的 ts 以「今天」为锚——过了当天「今日 2 轮」的统计就失真，
 * 与 memo「编辑可持久」刻意不同：这里演示数据新鲜度优先。
 */
function seedDatabase(): void {
  const today = new Date().toDateString();
  let fresh = false;
  try {
    const mark = JSON.parse(localStorage.getItem(SEED_MARK) || 'null') as { rev?: number; seededOn?: string } | null;
    fresh = !!mark && mark.rev === SEED_REV && mark.seededOn === today;
  } catch {
    fresh = false;
  }
  if (!fresh) {
    wipeSimKeys();
    localStorage.setItem(POMODORO_KEY, encodeSeedFile(seedPomodoro()));
    localStorage.setItem(SEED_MARK, JSON.stringify({ rev: SEED_REV, seededOn: today }));
  }
}

/** 默认设置（settings-provider 真实现注入；storagePath 与插件默认同形，番茄键走缺省回落） */
function injectRuntime(app: FakeApp): void {
  setSettingsProvider(
    () =>
      ({
        storagePath: 'CONFIG/STORAGE',
      }) as never
  );
  setSettingsSaver(async () => {
    /* 壳内设置不落盘：可变 provider 即存储（改预设/时长只影响本轮评审会话） */
  });
  setApp(app as never);
}

let appRef: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootPomodoroSim(): void {
  const g = window as unknown as { __bzPomodoroSimBooted?: boolean };
  if (g.__bzPomodoroSimBooted) return;
  g.__bzPomodoroSimBooted = true;
  seedDatabase();
  appRef = new FakeApp();
  injectRuntime(appRef);
}

/** 打开番茄钟弹窗（真 openPomodoro：load + recover + 建遮罩 + tick 生命周期） */
export function openPanel(): void {
  bootPomodoroSim();
  void openPomodoro(appRef as never);
}

export { closePomodoro as closePanel };

/** 确保已加载（真 ensurePomodoro：load+recover，不建 DOM）——自检先于开面板读相位用 */
export async function ensureLoaded(): Promise<void> {
  bootPomodoroSim();
  await ensurePomodoro(appRef as never);
}

/**
 * 当前界面相位（真 menuPhase：idle|focusing|paused|break）——
 * 自检用它对 DOM 按钮文案做**双源互证**（相位单源自 2026-09-11 晚起含
 * core/pomodoro-phase.isFocusingPhase，pomodoro 与 home 两侧同推导）。
 */
export function phaseNow(): string {
  return menuPhase();
}

/** 重置演示数据（壳重置按钮用）：清 fake vault 全部键，由调用方 reload 重灌 */
export function resetSim(): void {
  wipeSimKeys();
  localStorage.removeItem(SEED_MARK);
}
