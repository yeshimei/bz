# 567 · 首页每次重开卡一小会儿：活动河会话缓存 + 启动预热

- 状态：已交付（2026-11-15，worktree `bz-wt-homecache`，分支 `feat/home-reopen-cache`）
- 提出：2026-11-15 用户反馈「首页内容每次打开都会卡顿一小会儿，如何优化？」

## 根因

issue 290 已经把首页 DOM 做成「关闭只隐藏、重开复用秒显」，但 `ui.showOverlay()` 每次仍无条件
`refreshRiverAndRender()`：

1. `river.collectRiver()` 每轮做 7 天回顾（`recap/aggregate.ts` 每次 2 次 `getMarkdownFiles()` +
   日记正文 `vault.read`）、12 个域时间线采集（`cachedRead`）、11 个计数（又多次全库遍历），
   合计约 **20 轮全库遍历 + 十余个 JSON 读**；home 域当时**零数据缓存**。
2. 数据回来后 `renderAll()` 把 week / entries / flow / next / tiles 五区全量 `innerHTML` 重建，
   `mountIcons` ×5、17 行逐个重挂菜单、读 `clientWidth`/`scrollTop` 触发强制同步布局，
   再 `motionRendered` 重放约 20 个错峰动画。

于是观感是「先看到旧内容 → 卡一小会儿 → 整屏跳一下」，且随库增大线性恶化。另有 `core/home-return.ts`
留下的实测结论：150ms 延迟就会被肉眼读成「卡一下」。

## 修法（第一档：只消重算与重排，不动动效与视觉）

| 位置 | 改了什么 |
|---|---|
| `src/home/river-cache.ts`（新） | 会话级缓存：按 app 键控、在途 promise 去重、失败不缓存、刷新恒回源；失效 = 域动作事件 + `vault:md-*` 五通道 + 跨天 + 5 分钟兜底 + 首页设置快照 + 显式 `invalidateRiverCache()`；`prewarmRiver()` 首屏空闲预热，只填数据不建 DOM |
| `src/home/ui.ts` | 刷新改吃缓存；命中时（同一份 `RiverData` 引用、相位/顺序未变）跳过五区重建与编排；`afterPaint()` 让出首帧；动作落地 / 重试走 `force` 恒回源；`__BZ_DEV__` 下加 `collect` / `cache-hit 跳过重建` / `renderAll` 三处耗时探针 |
| `src/home/index.ts` | 导出 `prewarmHome()`；`unloadHome()` 复位缓存与域事件订阅 |
| `src/main.ts` | `onLayoutReady` 空闲段接上 `prewarmHome(app, () => this.unloaded)` |
| 测试 | 新增 `river-cache.test.ts`（12 例）/ `reopen-cache.test.ts`（4 例）；同步调整 5 条既有回归 |

## 三个必须守住的旧口径

1. `readHomeSettings()` 是「每次开面板现读、刻意不缓存」（`ui-river.test.ts:258`）。
   缓存命中会跳过重排，故把首页设置快照纳入缓存键——设置一改就回源重建。
2. `review-fix-panel-b.test.ts` 锁「重开必须发起第二轮采集」、`ui-river.test.ts:347` 锁
   「重开必须重建出新节点」。两条没有删：改为显式模拟数据变更（域事件 / 强制回源）后断同样的事，
   另加一条「无变更时不重采、不重建」的新断言。
3. 点前缀数据目录收不到 `vault modify`（ADR-0289），所以失效不只靠订阅，另有 5 分钟兜底；
   采集途中被置脏的那一轮结果不写缓存。

## 验收

- `tsc --noEmit` 干净；`test-domain home` 19 文件 / 178 例；`test-affected --since HEAD~1`
  695 文件 / 10295 例全绿。
- 真机 A/B 手段：开发构建（`BZ_VAULT_DIR` 非空）下 DevTools 控制台看 `[home:perf]` 三行；
  首次打开应有 `collect` + `renderAll`，数据未变时重开只见 `collect` + `cache-hit 跳过重建`，
  且不再有整屏跳变。
- 本轮**未做**：合并全库扫描（7 天回顾共用一份 `mdFiles`）、渲染层 diff / 容器级委托、
  可视区懒加载。等 A/B 数字再定（见 PROGRESS 的后续项）。
