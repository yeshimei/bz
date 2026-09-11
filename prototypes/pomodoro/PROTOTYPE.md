# 番茄钟 · 原型预览（真行为单源）

2026-09-11 接入预览管线（范式随 memo，issue 245/ADR-0106）。

| 项 | 值 |
|---|---|
| 入口 | 根 `index.html` 导航卡（热重载服务 `node scripts/preview-live.mjs`，默认 5177） |
| 行为产物 | `node scripts/build-preview.mjs pomodoro` → `prototype-behavior.js`（挂 `window.BZW_pomodoro`） |
| 入口源 | `prototypes/pomodoro/fake-sim.ts`（alias obsidian → `fake/fake-obsidian.ts`） |
| 自检 | `prototype.html?selftest=1` |

- **行为单源**：真 `src/pomodoro/ui.ts` 依赖链原样跑——中央单例弹窗、真状态机（`state.ts::transition/recover`）、
  1s tick、jsonFileStore 落盘、提示音（Web Audio，浏览器原生可用）。
  设置入口在设置面板（pomodoroSettingsSchema 被 settings-panel 消费；⚙ 弹窗已移除，2026-09-11 拍板）；
  面板皮肤谱系验收页 = [skins.html](skins.html)（引 prototype-render.js 真 markup）。
- **种子口径**（`fake-sim.ts`，自检断言依赖，改种子先改壳断言）：
  state = **暂停中的专注**（remaining 15:00、任务「周报」、cycleFocusCount 2）→ 开始钮=「继续」单条；
  history = 今日 2 轮 + 昨日 1 轮；跨天自动重灌（今日统计以「今天」为锚，同 home 壳语义）。
- **相位单源互证**：自检同时断言 `phaseNow()`（真 `menuPhase`）与按钮文案——
  paused=「继续」/ idle=「开始」，即 core/pomodoro-phase 单源在 pomodoro 侧的可见面
  （home 侧的「继续专注/开始专注」菜单文案由 home 壳钉）。
- 状态栏（`statusbar.ts`）由插件 main.ts 挂载，评审壳不挂；核心评审面在弹窗本体。
- 已知边界：设置改动仅存内存（`setSettingsSaver` no-op），重置演示数据后回落缺省值。
