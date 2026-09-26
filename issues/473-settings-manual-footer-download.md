# Ticket 473（已完成）：使用手册入口搬侧栏 footer + 下载/打开链路重做（报错修复）

- 状态：已完成（2026-09-26 用户报障 → 当日修复；同日二次拍板打开方式）
- 域：core（manual 单源）+ settings-panel（footer 入口 + 手册弹窗）
- 来源：用户报障——「点击设置页面的使用手册，报错 Uncaught (in promise) Error: Failed to open: 系统找不到指定的文件。 (0x2)」；随后拍板三件事：「使用手册放到更新日志上面」「下载时按钮图标转圈 loading（不弹窗、不要进度条）」「失败通知显示原因，完成自动打开」。
- 二次拍板（2026-09-26）：打开方式改为 **Obsidian 内独立弹窗内嵌渲染**（iframe srcdoc 直灌），不留「浏览器打开」次按钮；系统打开链路（shell.openPath / openExternalUrl file:///）随之退役。
- 关联：`src/core/manual.ts`（单源重做）、`src/core/utils.ts`（openExternalUrl 兜底链）、`src/settings-panel/ui.ts`、`src/settings-panel/layouts/jingwei/render.ts`

## 根因（两层）

1. **打开方式错**：`openManual` 把本地文件当 URL 走 `openExternalUrl`（file:///）→ Obsidian `app.openUrl` 在 Windows 打不开时返回 **rejected Promise**，而原实现只 try/catch 同步抛错，异步 rejection 无人接 → `Uncaught (in promise)`，用户看到 0x2 却没有任何 toast。
2. **打开前不验文件**：`openManual` 不复查 `hasManual`，路径/文件状态异常时盲开。

## 修复与改造（二次拍板后的最终形态）

- `core/manual.ts`：
  - 打开链路收敛为 `ensureManualReady`：本地没有 → 双远端下载 → 读出 HTML 文本交弹窗层；`readManual`（未下载/读失败 → null；空串/读异常视同未下载自愈重下）。
  - 系统打开链路（electronShell/openPath/file:/// 拼接，含 POSIX 四斜杠修复）整体退役。
- `core/utils.ts` `openExternalUrl`：`openUrl` 与 `shell.openExternal` 的**异步 rejection** 同口径落下一级兜底（window.open → 人话 error notice），不再 Uncaught——通用健壮性修复，随 memo/favorites/knowledge 等全域调用方保留受益。
- `settings-panel/manual-viewer.ts`（新）：手册弹窗——iframe **srcdoc** 内嵌渲染（327KB 单文件自包含，不走 file://，无系统开程序与路径转义坑链）；与 changelog 弹窗同范式（hide 型常驻层 + topifyZ + escManager + trapPanelFocus + .bz-sp-skin 同皮）；无「浏览器打开」钮（用户拍板）；关闭即清 srcdoc 释放内存；unloadManualViewer 随 unloadSettingsPanel 收口。
- `settings-panel`：入口自通用域撤出（`settings-main-schema.ts` 删「使用手册」组），搬至侧栏 footer **更新日志上方**（`data-sp-manual`，同 `bz-sp-foot-chg` 皮）。`runManualOpen`：下载期按钮加 `.is-loading` + 图标 setIcon 换 `loader` 转圈（CSS `bz-sp-spin`）+ `pointer-events: none` 防重入；完成/失败 finally 复原 `book-open`；就绪即弹窗内嵌打开（无 toast）；失败 notice 透出 `downloadManual` 的人话原因（远端 URL + 失败明细节）。
- 顺手修（门禁堵路）：`src/people/ui.ts` `renderBody` await 后补 overlay/store 复查守卫——后经并行会话 issue 467 重构覆盖，master 侧已有含保险库上锁判定的同位守卫，合并取 master 版。
- 承上会话遗留落盘：`tests/sp-contract-lock.test.ts` 的 cinema 8→7 / encrypt 5→4 基准（schema 已在 HEAD 改、基准悬在工作区未提交）；全量原型产物重出（HEAD 上 freshness 即红）。

## 测试

- `tests/manual.test.ts`（数据层 + 链路）：下载写入/备远端接管/失败透原因；readManual 两态；ensureManualReady 下载后读/不重复下载/空串自愈/读异常自愈/失败抛人话；manualVaultPath 跟随 configDir；openExternalUrl 异步 rejection 落兜底/全链失败 notice/缺 openUrl 同步兜底。
- `tests/settings-panel/manual.test.ts`（UI 层）：footer 入口在更新日志上方、不入导航契约类；点击下载 → is-loading → 写入 → 弹窗 srcdoc 直灌 → 复原（含「不留浏览器打开」断言）；已下载直接打开 + 防重入；失败 notice + 不弹窗；弹窗 ESC 关闭清 srcdoc + 重开换内容；遮罩点击关/本体点击不关；unloadManualViewer 幂等。
- 基准跟随：`settings-panel.test.ts`（通用域组数 3→2、分组图标去 book-open）、`core/settings-schema.test.ts`（主设置页 8 组→7 组）。
- 门禁：vitest 全量绿（520 文件）、`tsc --noEmit` 干净、freshness 30/30。
