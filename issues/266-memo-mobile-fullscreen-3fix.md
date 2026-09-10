# 266 备忘录移动端真全屏三处 UI 缺陷（无关闭按钮 / 无新建入口 / 键盘遮挡输入框）

状态：已完成
类型：fix（移动端 UI / 样式）
涉及域：memo（移动端头行 + 面板几何）、core（新增移动端视口高度变量资源）

## 现象（用户报告，2026-09-10）

用户在移动端（Obsidian 手机端）打开备忘录面板，真全屏态下提三条问题：

1. **没有关闭按钮**：面板铺满视口，点遮罩关闭失效（遮罩被面板完全盖住），
   而头行右上角看不到 ✕ —— 实际上**无任何可见关闭入口**。
2. **没有「添加备忘的弹窗按钮」**：移动端新建备忘录只剩底部录入条
   （一句一行输入），没有打开完整新建表单弹窗的入口。
3. **输入框不跟随软键盘**：底部录入条（`.bz-memo-composer`）被软键盘盖住，
   打字时看不见输入内容。

用户明确要求：**三条都只改 UI，不动功能逻辑**。

## 根因

### A. 关闭按钮被整组隐藏

头行 markup（`src/memo/render.ts` 的 `panelShellHtml()`）其实**一直有**关闭按钮
`<button class="bz-icon-btn" data-memo-head-close>`，行为接线
（`src/memo/ui.ts` 的 `data-memo-head-close` → `closeMemoPanel()`）也**一直就位**。
问题是它被两层规则叠加藏掉：

1. **皮肤层（主因）**：`src/memo/styles.css` 的
   `.bz-memo-skin-paper .bz-panel-head-btns { display: none }`（:349，editorial 同构 :459）——
   按原型设计「无此二钮」，**把整个头行钮组**（设置 + 关闭）藏掉。
   备忘录**默认皮肤就是 `paper`**（`src/settings.ts:488` `memoSkin: 'paper'`），
   故这不是「某个皮肤的特例」，而是开箱即中的默认路径。
2. **移动端无恢复规则**：`@media (max-width: 768px)` 块内没有任何 `display: flex`
   把钮组放回来。

附带断链：移动端真全屏下 `e.target === overlay` 的点遮罩关闭不可能触发
（面板 `100vw × 100vh` 把遮罩完全盖住），ESC 在手机上也没有物理键，
所以钮组藏掉后**没有任何可用的关闭入口**。

> 附注：核心层 `src/core/styles.css` 有一条 ADR-0019 第 4 条
> `button.bz-icon-btn--close, button.bz-win-close, … { display: none !important }`
>（「非真全屏一律隐藏关闭按钮」，原设计靠已退役的 `.bz-win-mfs` 后代选择器显示）。
> 本域关闭钮用 `data-memo-head-close` 钩子 + 独立类，**不在该四类名单内**，
> 故不受其约束 —— 排查时曾被列为嫌疑，实测**不是**生效原因。

### B. 新建入口被移动端整行隐藏

新建按钮 `data-memo-newbtn`（「新建备忘录」主按钮，打开 `openEditor(null)` 完整表单弹窗）
位于 `.bz-main-head` 内。`src/memo/styles.css` 的移动端块有：

```css
.bz-memo-main .bz-main-head { display: none; }
```

注释写明「移动端新建走底部录入条」——但底部录入条只支持「一句话快速添加」，
不是用户要的「添加备忘的弹窗」。

### C. `100vh` 不随软键盘收缩，且父层居中放大了它

`100vh` 等于**布局视口高度**（含被键盘占据的区域），软键盘弹出时它不收缩 →
面板底板留在屏幕底部（键盘之下）→ `flex-shrink: 0` 的底部录入条跟着被顶到键盘底下。

项目此前**没有任何 core 级视口/键盘适配层**：全仓 `dvh` / `svh` / `lvh` 零命中，
`--bz-vh` 零命中，`visualViewport` 仅 `src/smartcat/interaction.ts` 用于小橘气泡
拖拽定位（与面板高度无关）。

**额外的一环**：面板的父层 `.bz-panel-overlay`（components.css）是
`position: fixed; inset: 0; align-items: center`，遮罩自身不随键盘收缩（fixed 锚定
布局视口）。所以只缩短子面板高度**不够** —— 面板会在 100vh 的遮罩里上下居中内缩，
底边 =(100vh + 可视高)/2，仍在键盘之下。必须同时把面板改为**顶部对齐**。

## 修复

### 1) 头行补独立类 + 移动端专属新建钮（`src/memo/render.ts`）

- 关闭钮加 `bz-memo-head-close` 独立类（不吃核心层那四类历史类名的隐藏规则）；
- 头行钮组内**新增**一枚移动端专属新建钮 `.bz-memo-head-new`，
  **复用同一个 `data-memo-newbtn` 钩子** → 直接命中 `ui.ts` 既有的事件委托
  （`openEditor(null)`），**零新增行为代码**（`ui.ts` 未改一行）；
- 桌面隐藏该钮（桌面仍走 `.bz-main-head` 里那枚「新建备忘录」大按钮），
  用 `@media (min-width: 769px) { .bz-memo-head-new { display: none } }`
  与全局移动档 `max-width: 768px` **互补**——不用「裸规则 + 移动端再覆盖」，
  免掉依赖「后写者赢」的顺序陷阱（项目内 `clipbook` / `review` 已有同款先例）。

### 2) 移动端收口段（`src/memo/styles.css` 文件末尾，`@media (max-width: 768px)`）

只做两件事：

- 头行钮组 `display: flex` 放回（等特异性 + **后置**覆盖皮肤段的 `display: none`。
  皮肤段在本文件 :349/:459，收口段在文件最后一节，同特异性后写赢，
  故**无需改聚合顺序**）；
- 关闭 / 新建钮抬到 32px 可视档（`--bz-icon-btn-lg`），命中区由 markup 上的
  `.bz-touch-target` 在 `pointer:coarse` 下外扩到 44px（32 + 6×2，设计手册 §8.2）——
  与归物本移动端关闭钮同款（`src/belongings/layouts/poster/render.ts:36`
  的 `.bz-icon-btn--lg .bz-touch-target`）；只改几何，配色/悬停/对齐沿用核心层
  `.bz-icon-btn`，与同行「设置」钮口径一致。

### 3) 面板几何：高度挂可视视口 + 顶部对齐（`src/memo/styles.css` 移动端块）

```css
@media (max-width: 768px) {
  .bz-memo-panel {
    height: var(--bz-vvh, 100vh); max-height: var(--bz-vvh, 100vh);
    align-self: flex-start;   /* 必须：破父层 align-items: center */
  }
}
```

### 4) core 只提供变量资源（`src/core/viewport.ts` + `src/core/ui/components.css`）

- 新增 `src/core/viewport.ts`：监听 `visualViewport` 的 `resize` / `scroll`
  （iOS 键盘弹出只发 scroll 不发 resize）+ window `resize` / `orientationchange`
  兜底，把 `visualViewport.height` 写进 `--bz-vvh`（px）；幂等挂载，`onunload` 解绑。
- `src/main.ts`：`onload` 调 `bindMobileViewport()`，`onunload` 调
  `unbindMobileViewport()`。
- `components.css` 在 `.bz-panel-mtop` 段后补基线：≤768px 时
  `:root { --bz-vvh: 100vh }`，`@supports (height: 100dvh)` 升级为 `100dvh`。
- **核心层不改任何面板高度** —— 详见 ADR-0120 的决策 4：`.bz-panel-mtop` 不能作为
  「需要固定高度」的判据（`knowledge` 的 `.bz-kb-window.bz-panel-mtop` 是
  `top/bottom` 锚定 + `height: auto`；`clipbook` 的 `.bz-clip-mob-detail.bz-panel-mtop`
  是父级 `inset: 0` 的嵌套层），强行 `!important` 会打断这两处。

## 为什么高度不放在 core 一处覆盖全域（曾设计后否决）

CSS 聚合产物是**线性级联**（`scripts/build-css.mjs` 的 SOURCES：`core → 各域`），
域样式恒在 core 之后，同特异性后写赢 —— 所以 core 想一处生效**只能靠 `!important`**。
但 `.bz-panel-mtop` 的字面语义只是「移动端顶部避让档」，并不是「100vh 定高的面板根」，
上面那两处例外会被固定高度打坏。**面板几何属于域**（ADR-0002 分层精神），
核心层只提供共享资源与语义契约。

因此本次范围收敛为：**核心层给 `--bz-vvh` 资源，备忘录域消费它**。
其余 12 个真全屏域各改一行即可接入（模板与注意事项见 ADR-0120「后续」），
但需逐域目测验收（父层对齐方式 / 是否锚定式 / 是否嵌套层各不相同），故不在本票铺开。

## 取值链与「不劣化」保证

`var(--bz-vvh, 100vh)`：

1. JS 已注入 → 精确 px（`visualViewport.height`，可精修到键盘动画中间态）；
2. JS 未注入、现代内核 → `:root` 基线的 `100dvh`（动态视口，本身随键盘收缩）；
3. 老内核 → `:root` 基线的 `100vh`，与改造前**逐像素一致**。

> 基线之所以写成 `:root` 变量而不是把 `dvh` 放进回退位
> （`var(--bz-vvh, 100dvh)`），是为了避开「invalid at computed-value time」陷阱：
> 若回退值 `100dvh` 不被支持且 `--bz-vvh` 又未定义，整条声明失效会落到 `auto`
> （**不是**落回域内 `height: 100vh`）。`:root` 基线保证变量恒有值。

## 未误伤的边界

本次核心层未改任何面板几何，故 **12 个其余真全屏域与全部非全屏浮窗
（小橘 `#chat-panel` 60vh、第二大脑 `.bz-sb-float*`、密码本底部 sheet 等）零影响**。
`knowledge` / `clipbook` 的锚定式与嵌套层面板亦原样不动，并有守卫断言锁死
（见下 C 组「核心层不得用 `!important` 强改 `.bz-panel-mtop` 高度」）。

## 守卫（防回归）

新增 `tests/memo/mobile-ui-3fix.test.ts`（12 用例，样式源 / markup 源 / 接线源
静态断言，与 ticket 265 的 `tests/core/settings-model-picker-ui.test.ts` 同款手法）：

- **A**：markup 保留 `data-memo-head-close` + `bz-memo-head-close`，且**不得**回退成
  `.bz-icon-btn--close`（会被核心层无条件隐藏）；行为接线仍在；移动端块把头行钮组
  `display: flex` 放回；关闭/新建钮抬到 32px 可视档 + markup 挂 `.bz-touch-target`
  （命中区 44px）。
- **B**：头行新建钮存在且**共用** `data-memo-newbtn`（`ui.ts` 中该钩子只出现 1 次
  → 证明未新增接线）；桌面隐藏走 `min-width: 769px` 互补媒体查询（不赖顺序）。
- **C**：`src/core/viewport.ts` 导出三函数 + 消费 `visualViewport` + `--bz-vvh`；
  `main.ts` 成对 bind/unbind；core 基线为 `:root{--bz-vvh:100vh}` + `@supports` 的
  `100dvh` 升级；**核心层不得出现 `.bz-panel-mtop { height: var(--bz-vvh…` 并锁死
  knowledge 的 `height: auto` 锚定式**；备忘录面板移动端同时具备
  `var(--bz-vvh)` 与 `align-self: flex-start`；桌面尺寸（720px）未被改动，
  且 `--bz-vvh` 不出现在 ≤768px 块之外。

## 验收

- 移动端真全屏头行可见 ✕ 与 ＋，✕ 点击即关（与桌面同款「点遮罩/ESC」并存）；
- ＋ 点击打开完整「新建备忘录」表单弹窗（与桌面 `.bz-main-head` 大按钮同一路径）；
- 点底部录入条唤出软键盘时，面板随可视视口收缩并顶部对齐，录入条浮在键盘上方、始终可见；
- 桌面端（>768px）外观与行为零变化；
- `vitest run`（255 文件 / 4116 用例全通过）+ `tsc --noEmit` 全绿。
