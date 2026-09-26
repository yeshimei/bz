# Ticket 473（已完成）：使用手册入口搬侧栏 footer + 下载/打开链路重做（报错修复）

- 状态：已完成（2026-09-26 用户报障 → 当日修复）
- 域：core（manual 单源）+ settings-panel（footer 入口）
- 来源：用户报障——「点击设置页面的使用手册，报错 Uncaught (in promise) Error: Failed to open: 系统找不到指定的文件。 (0x2)」；随后拍板三件事：「使用手册放到更新日志上面」「下载时按钮图标转圈 loading（不弹窗、不要进度条）」「失败通知显示原因，完成自动打开」
- 关联：`src/core/manual.ts`（单源重做）、`src/core/utils.ts`（openExternalUrl 兜底链）、`src/settings-panel/ui.ts`、`src/settings-panel/layouts/jingwei/render.ts`

## 根因（两层）

1. **打开方式错**：`openManual` 把本地文件当 URL 走 `openExternalUrl`（file:///）→ Obsidian `app.openUrl` 在 Windows 打不开时返回 **rejected Promise**，而原实现只 try/catch 同步抛错，异步 rejection 无人接 → `Uncaught (in promise)`，用户看到 0x2 却没有任何 toast。
2. **打开前不验文件**：`openManual` 不复查 `hasManual`，路径/文件状态异常时盲开。

## 修复与改造

- `core/manual.ts`：
  - `openManual` 改 async：先 `hasManual` 实查 → 桌面首选 **electron `shell.openPath`**（专开本地文件，失败返回原因串 → error notice 出人话）→ 无 electron 才落 `openExternalUrl` 的 file:/// 兜底（顺带修 POSIX 绝对路径直拼 `file:////` 四斜杠）。
  - 新增 `ensureManualOpen`（footer 一键口径）：无手册先下载再打开，已下载直接打开。
- `core/utils.ts` `openExternalUrl`：`openUrl` 与 `shell.openExternal` 的**异步 rejection** 同口径落下一级兜底（window.open → 人话 error notice），不再 Uncaught。
- `settings-panel`：入口自通用域撤出（`settings-main-schema.ts` 删「使用手册」组），搬至侧栏 footer **更新日志上方**（`data-sp-manual`，同 `bz-sp-foot-chg` 皮）。`runManualOpen`：下载期按钮加 `.is-loading` + 图标 setIcon 换 `loader` 转圈（CSS `bz-sp-spin`）+ `pointer-events: none` 防重入；完成/失败 finally 复原 `book-open`；成功 notice「手册已打开」；下载失败 notice 透出 `downloadManual` 的人话原因（远端 URL + 失败明细节）。
- 顺手修（门禁堵路）：`src/people/ui.ts` `renderBody` `await wallPeople()` 后补 `overlay/store` 复查守卫——生成途中关面板的 late 回调触碰已拆 DOM（HEAD 既有 unhandled rejection，worktree 环境下稳定复现，与本次改动无因果，stash 实验证实）。
- 承上会话遗留落盘：`tests/sp-contract-lock.test.ts` 的 cinema 8→7 / encrypt 5→4 基准（schema 已在 HEAD 改、基准悬在工作区未提交）；全量原型产物重出（HEAD 上 freshness 即红）。

## 测试

- `tests/manual.test.ts`（新，数据层 + 打开链路）：下载写入/备远端接管/失败透原因；openManual 未下载引导、openPath 成功、openPath 报原因/抛异常、无 electron 走 openUrl；ensureManualOpen 不重复下载；openExternalUrl 异步 rejection 落兜底/全链失败 notice/缺 openUrl 同步兜底。
- `tests/settings-panel/manual.test.ts`（新，UI 层）：footer 入口在更新日志上方、不入导航契约类；点击下载 → is-loading → 写入 → openPath → 复原 + notice；已下载直接打开 + 防重入；失败 notice 出原因 + 复原。
- 基准跟随：`settings-panel.test.ts`（通用域组数 3→2、分组图标去 book-open）、`core/settings-schema.test.ts`（主设置页 8 组→7 组）。
- 门禁：vitest 7776/7776 全绿（518 文件）、`tsc --noEmit` 干净、freshness 30/30。
