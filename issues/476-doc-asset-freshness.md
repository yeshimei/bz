# 476 · 手册 / 更新日志加「新鲜度」核对（打开即本地秒开，后台核对远端）

- 状态：已完成（2026-09-26）
- 域：core（remote-asset / manual / changelog）+ settings-panel（ui 入口 + 两个弹窗层）+ tests
- 来源：用户报「推送了新的更新日志和使用手册，本地未自动更新」
- 关联：ADR-0200（本票决策）/ ADR-0198（手册·日志在线下载，本票在其上加一层新鲜度）/ issue 473 / 474（两个入口的现状）/ issue 475 + ADR-0199（皮肤包 sha256 清单，同源思路）

## 问题

issue 473/474 的入口口径是 `ensureAssetReady`：**本地没有才下载，有就直接用**。
文档资产是「跟版本走」的，但它在 GitHub 上可以**独立于插件版本**重新生成并 push
（`scripts/_gen-changelog.mjs` 重出、手册重出）；上线新版后，已装插件的本地缓存永不刷新。

实测（2026-09-26）：

| 文件 | 本地（插件目录 / 仓库 `manual/`，sha 一致） | 远端 master |
|---|---|---|
| `bz-manual.html` | 275139 B（`cadef4b1…`） | 327093 B（`479d7ab8…`） |
| `bz-changelog.html` | 74313 B（`4add54a9…`） | 72338 B（`61a2a7f6…`，含 `v1.24.0`） |

即：远端已经是新版，插件端仍拿旧版——**没有任何机制会去发现这件事**。

附带环境事实：`raw.githubusercontent` 国内直连超时（20s 起，`git ls-remote` 也不通），
双远端链路里主源基本用不上，实际由 jsDelivr 兜住。因此不能把「每次打开都先拉远端」
当作默认口径（会先吃一次主源超时）。

## 拍板（用户 2026-09-26 选）

**本地秒开 + 后台核对**：入口先用本地内容渲染（零等待），同时后台向远端核对一次；
内容真变了才覆盖落盘，且弹窗还开着就热替换成新内容。日常点开不受网络影响，
离线也不卡；推送新版后打开入口即可看到新版（弹窗闪一次刷新）。

否决的两条：

- 「每次打开都先拉远端」——离线要等网络失败（主源还得先超时），每次点开都吃流量。
- 「只加手动刷新入口」——用户要的是自动更新，不该多一个要记得按的钮。

## 改动

### 内核（`src/core/remote-asset.ts`）

- 新增 `refreshAsset(app, fileName, validate, label)`：拉远端 → 与本地比 `textSha256`
  （先 `normalizeEol`，Windows CRLF 不会被误判成新版）→ 不同才写盘并返回新文本；
  **同版 / 离线 / 双源都不可信 → 一律 null（静默）**。
- 与 `ensureAssetReady` 分工写进注释：那个管「有没有」，这个管「新不新」。

### 薄封装

- `core/manual.ts` 增 `refreshManual(app)`；`core/changelog.ts` 增 `refreshChangelog(app)`
  （校验口径沿用各自 `looksLikeManual` / `looksLikeChangelog`，防把 CDN 错误页写进本地）。

### 入口（`src/settings-panel/ui.ts`）

- `runManualOpen` / `runChangelogOpen`：`ensure*Ready` → 打开弹窗（本地内容）→
  `void this.refreshDocInBackground(refresh, swap)`（**不 await**，阅读不被网络拖住，
  按钮 loading 也只覆盖前台下载那一段）。
- 新增私有 `refreshDocInBackground(refresh, swap)`：拿到新文本才 `swap`，异常全吞
  （后台动作失败不是用户的操作失败，不出通知、不转圈）。
- 两个弹窗层各出一个状态查询：`isManualViewerOpen()` / `isChangelogOpen()`
  —— 只在弹窗**仍开着**时热替换；已关闭就只落盘（下次打开即新版，不把弹窗重新弹出来）。

## 测试

- `tests/manual.test.ts` +6：新版覆盖落盘、同版不写盘、CRLF/LF 不算新版、离线静默无通知、
  错误页不落盘、本地缺失时直接取远端。
- `tests/core/changelog.test.ts` +3：同上口径（含双源都不可信的静默）。
- `tests/settings-panel/manual.test.ts`、`changelog.test.ts`：原「已下载 → 不再发请求」
  用例改为「本地内容直接打开 + 后台核对一次」；新增三条——热替换（用挂起响应把
  「秒开」与「热替换」两个时点钉开）、关闭后只落盘不重开、离线静默。

## 非目标

- 不动双远端顺序（raw 主 → jsDelivr 备，ADR-0198 口径）；后台核对慢一点无所谓，
  它不与阅读抢时间。
- 不做节流（每次打开就核对一次）。真嫌费流量再加时间窗。
- 不动皮肤包口径（ADR-0199 走清单 sha256，本票与它无关）。
