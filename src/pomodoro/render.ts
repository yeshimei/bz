/**
 * 番茄钟渲染纯层（ADR-0104 markup 单源）：弹窗结构 + 面板主题清单。
 *
 * 与插件侧 ui.ts、评审壳（prototypes/pomodoro/skins.html 经 prototype-render.js）共用同一份：
 *   - `panelShellHtml()` / `popupShellHtml()` = 弹窗骨架（含控件 id，行为接线仍在 ui.ts）；
 *   - `POMODORO_SKIN_THEMES` = 面板主题清单（设置面板「外观 → 面板主题」选项、皮肤类名、
 *     skins.html 的皮肤列表三处同表）；色值本身在 styles.css 的 :root 变量表（见文件内注释）。
 * 纯度（tests/core/render-purity 守卫）：禁 obsidian/moment/core 服务，本文件零依赖。
 */

/** 面板主题（皮肤）取值——与 CSS 的 `pomodoro-skin-<value>` 一一对应，改名须留兼容 */
export type PomodoroSkinTheme =
  | 'tomato'
  | 'ink'
  | 'grid'
  | 'moss'
  | 'mist'
  | 'sand'
  | 'citrus'
  | 'sakura'
  | 'latte'
  | 'night';

/**
 * 面板主题清单（**皮肤单源**）：设置面板选项、弹窗皮肤类、评审壳皮肤页三处同表。
 * 顺序 = 默认项（番茄）在前；value 改动牵动 CSS 类名与旧设置值。
 * 色值不在这里：亮/暗两套配色见 styles.css 的 `:root` 变量表（`--pz-<id>-*`），
 * 设置面板预览卡（src/settings-panel/styles.css）引用同一批变量——避免「两处手抄色值」。
 */
export const POMODORO_SKIN_THEMES: ReadonlyArray<{ value: PomodoroSkinTheme; label: string }> = [
  { value: 'tomato', label: '番茄' },
  { value: 'ink', label: '墨白' },
  { value: 'grid', label: '方格纸' },
  { value: 'moss', label: '苔原' },
  { value: 'mist', label: '海雾' },
  { value: 'sand', label: '暖沙' },
  { value: 'citrus', label: '蜜柑' },
  { value: 'sakura', label: '樱粉' },
  { value: 'latte', label: '咖啡' },
  { value: 'night', label: '夜航' },
];

/** 默认皮肤（与 src/settings.ts 的 pomodoroSkinTheme 默认值一致） */
export const DEFAULT_POMODORO_SKIN_THEME: PomodoroSkinTheme = 'tomato';

/** 任意设置值 → 合法主题（未知/空值回落默认） */
export function normalizeSkinTheme(v: unknown): PomodoroSkinTheme {
  const cur = String(v ?? '');
  return POMODORO_SKIN_THEMES.some((t) => t.value === cur) ? (cur as PomodoroSkinTheme) : DEFAULT_POMODORO_SKIN_THEME;
}

/** 主题 → 皮肤类名（挂在 #pomodoro-popup 上） */
export function skinClassOf(v: unknown): string {
  return `pomodoro-skin-${normalizeSkinTheme(v)}`;
}

/**
 * 弹窗骨架（#pomodoro-popup 内部；控件 id 由 ui.ts 接线）
 * ——环形进度 / 循环圆点 / 阶段 / 任务 / 时间 / 三按钮 / 今日统计 + 近 7 天柱。
 */
export function panelShellHtml(): string {
  return `
      <svg id="pomodoro-ring-svg" viewBox="0 0 120 120">
        <circle class="pomodoro-ring-track" cx="60" cy="60" r="52"></circle>
        <circle id="pomodoro-ring-progress" class="pomodoro-ring-progress" cx="60" cy="60" r="52"></circle>
      </svg>
      <div id="pomodoro-cycle" class="pomodoro-cycle"></div>
      <div id="pomodoro-phase"></div>
      <div id="pomodoro-task" class="pomodoro-task"></div>
      <div id="pomodoro-time"></div>
      <div class="pomodoro-controls">
        <button id="pomodoro-btn-start" class="pomodoro-btn pomodoro-btn-primary bz-touch-target--sm">开始</button>
        <button id="pomodoro-btn-reset" class="pomodoro-btn bz-touch-target--sm">重置</button>
        <button id="pomodoro-btn-skip" class="pomodoro-btn bz-touch-target--sm">跳过</button>
      </div>
      <div class="pomodoro-stats">
        <div id="pomodoro-today"></div>
        <div id="pomodoro-week" class="pomodoro-week"></div>
      </div>`;
}

/** 弹窗根（tabindex 承载 Space 焦点）+ 骨架（评审壳皮肤页用，与插件同 markup） */
export function popupShellHtml(): string {
  return `<div id="pomodoro-popup" tabindex="-1">${panelShellHtml()}</div>`;
}
