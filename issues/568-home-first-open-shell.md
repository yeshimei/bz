# 568 · 首次启动第一次打开仍慢：首屏壳 + 时间线后台补画

- 状态：已交付（2026-11-15，worktree `.dsh-worktrees/home-fast-shell`，分支 `feat/home-fast-shell`）
- 提出：2026-11-15 用户带图反馈「还是加载很久，每次启动第一次打开，秒开左侧和右侧，中间的时间线后台慢慢抓，抓到了再显示」

## 根因

issue 567 的会话缓存只治「重开」，**首次启动第一次打开**仍是老路径：

1. `createOverlay()` 同步出的是空骨架——左右只有错落占位线，周历与预告为空，中间挂「正在汇入今天的痕迹…」；
2. 要等 `collectRiver()` 整轮（7 天 recap + 12 域时间线 + 11 个计数，约 20 轮全库遍历）回来，
   才由 `renderAll()` 一次性把五区换成真内容；
3. 启动预热 `requestIdleCallback(..., { timeout: 8000 })` 最坏 8 秒才起跑，启动后马上点开等于没预热，
   而预热跑的也是同一轮全量采集。

于是首开观感仍是「先空壳 → 卡一会儿 → 整屏跳一下」。用户要的是左右两栏立刻可见、中间允许慢慢抓。

## 修法（第二档：拆「渲染阶段」，不拆「采集」）

| 位置 | 改了什么 |
|---|---|
| `src/home/river-shell.ts`（新） | 纯函数 `makeRiverShell(now)`：零 IO 造 7 天日期窗口 + `EMPTY_COUNTS` + `pending: true`；不算计数、不读 vault / 设置、不建 DOM、不写盘 |
| `src/home/shared.ts` | `RiverData.pending?`；`riverCountText()` 在 pending 时返回 `null` → 入口行 / 瓦片回落域副题，不显示「0 条待办」这类假数 |
| `src/home/layouts/river/render.ts` | `loadingNextHtml()`：预告列标题 + 骨架线；不复用 `buildPreviews` 的空数据分支（那会编出「剪藏库已清空」这类还没采到就下结论的文案） |
| `src/home/state.ts` | 新增 `riverShell` / `shellOrderJson`；**`river` 仍只认真数据**，arch A3 存活守卫、H12 失败态、缓存引用判据全部保持原义 |
| `src/home/ui.ts` | `createOverlay()` 同步铺壳；`renderAll()` 增壳分支；新增 `renderSlowData()`；`refreshRiverAndRender()` 用 `fromShell` 阶段标记选「局部补画」还是「整屏重建」 |
| `src/home/river-cache.ts` | 预热空闲兜底 `8000ms → 1200ms`，让启动后马上首开时慢数据尽快到位 |

### 慢数据到位怎么补

`renderSlowData()` **只重写 `[data-home-flow]`**（时间线 + 图标 + 河面注入件），其余四区就地改：

- 周历格子只切 `--hit` / `--sel` / `aria-pressed` / `aria-label`，节点不换；
- 入口行与移动瓦片只改 `.bz-home-ect` 文本和 `.bz-home-dot` 类名，节点不换 → 右键菜单绑定、焦点、滚位全保留；
- 预告骨架换三张规则卡（点击走 overlay 委托，无独立绑定件要迁）；
- 最后 `motionRendered(overlay, false)` 静默重挂注入件，**不重放整屏编排**。

若异步 `loadHomeOrder()` 读出的顺序与壳渲染时不同，这一轮退回 `renderAll()` 整屏重排（罕见分支）。

### 为什么否决「快段 / 慢段拆采集」

勘察结论：`collectRiver` 确实可拆 `collectRiverFast`（1 次 `getMarkdownFiles()` + 11 counts + diary + focusing）
与慢段（7×recap + 12 域 timeline）。但首屏壳是**纯算零 IO**，连「便宜那趟」都不必跑：

- 拆采集会多一遍 counts 全库遍历（慢段要复用快段对象才不重复，得给 `collectRiver` 加注入参数）；
- 缓存要加阶段 / 版本标记，且三处 `vi.mock('../../src/home/river')` 只导出 `collectRiver`，连带改动面大；
- 收益只是「首屏数字早几百毫秒」，而用户明确允许左右先出结构、中间后台慢抓。

所以本轮只拆**渲染阶段**，采集仍是一趟 `collectRiver`，口径与 issue 567 完全一致。

## 三个守住 / 补上的旧口径

1. 缓存快路：`unchanged` 判加 `!fromShell`，壳阶段永不被当成「命中缓存」；真数据到位走局部补画，
   重开时引用相同 + 阶段已是 full → 照旧跳过一切。
2. 「默认打开日＝最后有动静」：`pickInitialView()` 可能把 `H.riverView` 定到昨天，
   `renderSlowData()` 同步切周历 `--sel` / `aria-pressed`，不再出现「时间线是昨天、周历还高亮今天」。
3. 壳阶段周历也能点选查看日（只记选中态、不重写 flow，避免把「正在汇入…」换成未经采集的假空态），
   慢数据到位按 `H.riverView` 补画那一天。

## 代价与暂缓

- 首屏壳那几百毫秒内打开右键菜单，盒头显示域副题而非实时计数（菜单绑定不重建以保节点复用），
  下次整屏刷新自然更新。
- 慢数据到位时 `motionRendered(overlay, false)` 的 `cancelPending()` 会收掉首壳编排中尚未播完的
  错峰计时器；内容零影响，只是动效可能少演几行。
- 采集失败沿用 H12 既有「失败 + 重试」态（异常路径零改动），不单独做「左右保留壳」。
- ADR-0300 列为暂缓的四项（7 天回顾共用 `mdFiles`、渲染层 diff / 容器级委托、时间线懒加载、
  计数事件增量维护）**本轮仍未做**，等真机 A/B 数字再定。

## 验收

- `tsc --noEmit` 干净；home 域 19 文件 / 170 例；`test-affected --since master` 696 文件 / 10299 例全绿；
  合并回主仓后 `--since HEAD~1` 同口径复跑全绿。
- 新增 `tests/home/first-open-shell.test.ts` 4 例（同步段五区在场 / 慢段只补中间且节点复用 /
  失败态不永挂加载 / 重开仍走缓存快路）；旧用例里「结构在场 = 数据已到」的等待条件改为等真数据。
- 真机看效果：开发构建部署后重启或重载插件，第一次点开首页应「左右与周历立刻出、中间正在汇入，
  稍后时间线自己补上且左右不闪」。
