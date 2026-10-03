# 工具坞 · UI 原型基准（PROTOTYPE.md）

> 通用规则见 `docs/prototype-first.md`；本文件只写工具坞（dock）域的落地形态。

## 基准文件（共用 CSS，单源）

- **`prototype.html`** — 工具坞 UI 的评审壳（两个真行为 iframe：桌面 1280×900 / 移动 412×915）。
- **`prototype-view.html`** — iframe 视图页：只加载 CSS + 行为包 + `bootDockSim(); openDockPanel();`。
- **`prototype-behavior.js`** — 构建产物（`node scripts/build-preview.mjs dock`），入口 `fake-sim.ts`，
  alias `obsidian → fake/fake-obsidian.ts`。**它把插件同款的 `ui.ts / data.ts / runner.ts /
  schema.ts / schedule.ts / registry.ts` 依赖链整套打进浏览器**——所以壳里跑的是真行为，不是另写一套。
- **`prototype-icons.js`** — 图标兑现表（手写 JS 对象，改 `ui.ts` 加图标就要补表；改完先
  `node --check prototype-icons.js`）。
- **`src/dock/styles.css`** — 唯一样式源（`bz-dock-*` 前缀），壳 `<link>` 直连，改样式刷新即见。

⚠️ 本域**没有** `src/dock/render.ts`（markup 全在 `ui.ts` 内拼），所以只登记在 `build-preview.mjs`
的 `BEHAVIOR_DOMAINS`、**不进** `PREVIEW_DOMAINS`。

## 壳里演了什么、没演什么

| | 壳里 | 插件里 |
|---|---|---|
| vault 文件系统 | `FakeVault`（localStorage 后端，`core/storage` 真实现跑在上面） | 真实 vault |
| 运行记录 `runs/<id>.json` | **种子里预置** + 假子进程跑完追加 | 工具自己写 |
| 清单缓存 `manifests/<id>.json` | 种子预置（`local-report` 故意不给） | bz 经 `--manifest` 拉取后写 |
| 子进程 | 假 `child_process`（四行协议吐流 + 自己落账） | 真 `cp.spawn` |
| 系统选择器 | 假 `@electron/remote` dialog + `setSystemFolderPicker` | 真系统对话框 |
| 图标 | `prototype-icons.js` 内联 SVG | `setIcon` + lucide |
| 主题 | 壳按钮切 `body.theme-dark` | 跟随 Obsidian |

**钉住的不变量**：假子进程跑完是**由它自己**往 `runs/<id>.json` 追加记录的——bz 全程没写过这份文件。
这正是本域的核心约束（spec D9：三份文件、三个互斥写者），壳把这条不变量演出来，防止将来「顺手补一刀」。

## 铁流程

1. 改 `src/dock/*.ts` 或 `styles.css` → `node scripts/preview-live.mjs 5177` →
   开 `http://localhost:5177/prototypes/dock/prototype.html`（热更新，SSE 自动 reload）；
2. 桌面 / 移动各过一遍，亮暗各一遍；
3. `node scripts/build-preview.mjs dock` 重出行为包 —— **改了 `src/core/**`（本域的包内联了
   `core/`）或 `src/settings.ts` 时，`gameshelf / home / memo / review / settings-panel` 的包也会
   随之过期**（它们同样内联 `core/`），守卫 `tests/preview-freshness.test.ts` 会红，照它给的命令重出。

## 域内注意事项（踩过的坑）

- **`Buffer` polyfill**：`core/external-tool.ts` 的行缓冲按字节切分，用到 Node 的 `Buffer`。
  浏览器没有，`fake-sim.ts` 里装了一个最小实现（只兑现 `from/concat/length/indexOf/subarray/toString`）。
  刻意**不继承** `Uint8Array`——静态 `from` 的签名与 `Uint8ArrayConstructor.from` 不兼容（TS2417）。
- **假进程 kill 必须补 `close`**：`core/external-tool` 只在 `close` 事件上终结。不补的话
  「停止」会让运行永远停在 running（真机上被 kill 的进程是会 `close` 的）。
- **壳内自检按 `window.DOCK_SEED` 现算期望值**（`fake-sim.ts` 外露种子事实），别在壳里硬编码
  一份会漂的数字——尤其「待关注」的档位数是日期相关的，只能与 DOM 里的 `.is-due` 互校。
- **两分区是 UI 概念，不是模型概念**：`trigger` 一个字段区分（spec D2）。所以筛「自动化」后
  `.bz-dock-sec` 只剩一个——这不是 bug。
