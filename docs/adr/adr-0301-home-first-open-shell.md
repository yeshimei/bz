# ADR-0301 · 首页首开拆「渲染阶段」：同步铺纯算壳，慢数据局部补画

日期：2026-11-15 · 状态：已采纳 · 关联：ADR-0300（活动河会话缓存）、ADR-0170（日记墙预热）、
ADR-0104（markup 单源）、ADR-0003（懒加载不建 DOM）、issue 290（DOM 常驻秒显）、issue 567、issue 568

## 背景

ADR-0300 用会话缓存治好了「重开」，但「首次启动第一次打开」仍要等一整轮 `collectRiver()`
（约 20 轮全库遍历）才见得到左右两栏：首开时缓存是空的，预热的 `requestIdleCallback` 最坏
8 秒后才起跑，起跑后跑的也是同一轮全量采集。用户 2026-11-15 带图反馈，并给出明确形态：
**左右两栏秒开，中间时间线后台慢慢抓，抓到了再显示**。

可选路线有两条：把 `collectRiver` 拆成快段（counts / diary / focusing）与慢段（recap / timeline），
或只拆渲染阶段、让首屏先用一份「不含采集结果」的壳把结构画出来。

## 决策

1. **首屏壳是纯函数、零 IO**：`src/home/river-shell.ts` 的 `makeRiverShell(now)` 只按本地日历日
   算 7 天窗口与周历，配 `EMPTY_COUNTS` / `EMPTY_SUMMARY` / 空事件，带 `pending: true`。
   不读 vault、不读设置、不建 DOM、不写盘；`createOverlay()` 的**同步段**就能铺出来。
2. **壳不得显示假结论**：`riverCountText()` 见 `pending` 返回 `null`，入口行 / 瓦片 / 菜单盒头
   回落域副题；预告列走新增的 `loadingNextHtml()`（标题 + 骨架线），不走 `buildPreviews` 的空数据
   分支——后者会写出「剪藏库已清空」这种还没采到就已经下结论的文案。
3. **壳不进 `H.river`**：`state.ts` 另开 `riverShell` / `shellOrderJson`，`river` 仍只认真数据。
   这样 arch A3 的存活守卫、H12 失败态、`loadRiverCached` 的引用判据全部不用改语义。
4. **阶段标记显式化**：`refreshRiverAndRender()` 用 `fromShell` 区分「壳 → 真数据」与
   「真数据 → 真数据」；`unchanged` 加 `!fromShell`，避免壳阶段被误判成缓存命中，
   也避免新对象一到就触发 `renderAll()` 整屏重建五区。
5. **慢数据只补该补的**：新增 `renderSlowData()`，只重写 `[data-home-flow]`；周历 / 入口 / 瓦片
   就地切 class 与文本，节点原地复用 ⇒ 不闪、不重挂菜单、不丢焦点与滚位、不重放编排。
   异步 `loadHomeOrder()` 若给出与壳不同的顺序，这一轮退回 `renderAll()` 整屏重排。
6. **异常路径与既有语义不动**：采集失败仍走 H12 的「失败 + 重试」空态；壳期周历可以点选查看日
   （只记 `H.riverView`，不重写 flow），慢数据到位按该日补画并同步 `--sel` / `aria-pressed`。
7. **预热仍跑全量采集，只提前触发**：`requestIdleCallback` 兜底 `8000ms → 1200ms`。首开不等预热，
   在途去重会把已经开跑的那一轮直接借给首开用；没起跑就由首开自己发起。

## 否决 / 暂缓

- **否决「拆 `collectRiver` 快慢段」**：快段仍需一次 `getMarkdownFiles()` + 11 个计数（其中数个
  要遍历全库），而纯算壳连这趟都省了；拆完还要让慢段复用快段对象才不重复采集，等于给
  `collectRiver` 加注入参数，并与三处 `vi.mock('../../src/home/river')` 的只导出 `collectRiver`
  相冲突。收益只是「首屏数字早几百毫秒」，与用户「左右先出结构」的诉求不等价。
- **否决「缓存阶段化 / 快段也缓存」**：壳是一次性的首屏表现，不是数据；缓存里只放
  `collectRiver` 的真结果，ADR-0300 的键控 / TTL / 失效面一字不改。
- **否决「慢数据到位整屏重建」**：会闪、会重放约 20 个错峰动画、会丢焦点与滚位，正是
  ADR-0300 想消掉的东西。
- **暂缓**：ADR-0300 列的四项（共用 `mdFiles`、渲染层 diff / 容器级委托、时间线懒加载、
  计数事件增量维护）仍不动，等真机 A/B 数字再定。

## 代价

- 首屏壳那几百毫秒内，入口行显示域副题而非实时计数；右键菜单盒头也按副题预构建，
  下次整屏刷新才换成真计数（为保节点复用，不重挂 `attachItemActions`）。
- `motionRendered(overlay, false)` 的 `cancelPending()` 会收掉首壳编排里尚未播完的错峰计时器；
  内容零影响，动效可能少演几行。
- 壳阶段周历可点选，但中间列仍显示「正在汇入…」直到慢数据到位，不会先给一个假空态。
- 预热提前到 1.2 秒空闲兜底，启动后 1～2 秒会占用一轮全库 IO；这是把首开要花的那一次提前，
  不是新增总量（在途去重保证只跑一趟）。

## 验收

`tests/home/first-open-shell.test.ts` 4 例先红后绿；`reopen-cache.test.ts` / `ui-river.test.ts`
里「结构在场 = 数据已到」的等待条件按新语义改为等真数据；home 域 170 例、
`test-affected --since master` 696 文件 / 10299 例、`tsc --noEmit` 全绿。
