# ADR-0120 移动端真全屏面板高度随软键盘收缩（--bz-vvh 变量资源）

- 状态：已接受（2026-09-10）
- 关联：issue 266、ADR-0019（移动端真全屏环境类 `.bz-win-mfs`，已退役）、
  ADR-0002（依赖方向）、ADR-0084（面板尺寸记忆）、ticket 265（同类移动端定位修复）

## 背景

Obsidian 手机端软键盘弹出时，`100vh` **不收缩** —— 它等于布局视口高度（含键盘区）。
移动端真全屏面板用 `height: 100vh` 定高，于是面板底板留在键盘下方，
`flex-shrink: 0` 钉底的输入区（备忘录录入条等）被键盘盖住，用户打字时看不见输入内容。

项目此前没有任何 core 级视口适配：`dvh` / `svh` / `lvh` / `--bz-vh` 全仓零命中；
唯一的 `visualViewport` 消费者是 `src/smartcat/interaction.ts`，服务的是小橘气泡
拖拽定位（把猫抬到键盘上方），与面板高度无关。

三个必须一并考虑的事实：

1. **聚合顺序**：`scripts/build-css.mjs` 把各域 `styles.css` 线性拼接为根 `styles.css`，
   SOURCES 顺序是 `core → 各域`。同特异性下**后写赢**，故核心层同特异性规则会被域内
   `height: 100vh` 覆盖（除非提权）。
2. **父层是居中容器**：面板的父层 `.bz-panel-overlay`（components.css）是
   `position: fixed; inset: 0; align-items: center`。遮罩自身不随键盘收缩
   （fixed 锚定布局视口）。**只缩短子面板高度而不改对齐，面板会上下对称内缩，
   底边 =(100vh + 可视高)/2 仍在键盘之下——等于白修。**
3. **`.bz-panel-mtop` 不等于「100vh 定高的面板根」**：该类的字面语义只是「移动端
   顶部避让档」，除 13 个真全屏面板根外，还有两处例外：
   - `knowledge` 的 `.bz-kb-window.bz-panel-mtop` 是
     `top: 0; bottom: env(safe-area-inset-bottom); height: auto` 的**锚定式**全屏；
   - `clipbook` 的 `.bz-clip-mob-detail.bz-panel-mtop` 是父级 `inset: 0` 的**嵌套层**。

## 决策

**核心层只提供变量资源 `--bz-vvh`，不直接改任何面板的高度；面板几何由各域自己消费。**

1. **新增 `src/core/viewport.ts`**：监听 `visualViewport` 的 `resize` **和** `scroll`
   （iOS 键盘弹出只发 scroll 不发 resize），外加 window `resize` / `orientationchange`
   兜底；把 `visualViewport.height`（回退 `innerHeight`）写进
   `document.documentElement` 的 `--bz-vvh`（px，含下限夹取，异常帧忽略）。
   全站只挂一个 document 级监听（非面板级，面板开关不重复注册）；幂等 + `onunload` 解绑。

2. **核心层只给基线**（`components.css` 的 `.bz-panel-mtop` 段后）：
   `@media (max-width: 768px) { :root { --bz-vvh: 100vh } }` +
   `@supports (height: 100dvh) { :root { --bz-vvh: 100dvh } }`。
   - 现代内核：JS 未注入前先用 `dvh`（动态视口，本身随键盘收缩）；
   - 老内核：退回 `100vh`，与改造前完全一致，**零劣化**；
   - `--bz-vvh` 始终有值，避免 `var()` 因回退值不被支持而「invalid at computed-value
     time」→ 整条声明失效落到 `auto`（**不是**落回域内 `100vh`）的陷阱。

3. **域内一行消费**（范例已在 `src/memo/styles.css` 落地）：
   ```css
   @media (max-width: 768px) {
     .bz-memo-panel {
       height: var(--bz-vvh, 100vh); max-height: var(--bz-vvh, 100vh);
       align-self: flex-start;   /* 必须：破父层 align-items: center */
     }
   }
   ```
   `align-self: flex-start` 是**本 ADR 的关键一半**，它把面板改为顶部对齐，
   面板底边才等于可视视口底 = 键盘上沿。漏掉它则高度改对了也不生效。

4. **不做全域 `!important` 强改**（曾评估并否决）：`.bz-panel-mtop` 不能作为
   「需要固定高度」的判据（见背景 3 的两处例外），强行提权会打断 knowledge 的
   锚定式全屏、并让 clipbook 的 `inset: 0` 嵌套层溢出。同时它违反 ADR-0002 的
   分层精神：**面板几何属于域，核心层只应提供共享资源与语义契约。**

5. **不与小橘的 `visualViewport` 实施合并**：`src/smartcat/interaction.ts` 那套
   用 UA 判定 + 服务气泡拖拽定位，是行为单源的一部分。强行合并会同时动到
   「面板高度」与「气泡位置」两个诉求，扩大回归面。两处独立监听，
   `visualViewport` 的事件开销可忽略。

## 后果

**正面**
- 备忘录真全屏面板高度随键盘实时收缩，钉底录入条自动上浮（既有 flex 布局直接生效，
  无需给输入条加 `position: fixed`）；
- 老内核自动降级到原行为，无回归风险；
- 核心层不引入 `!important`，不动任何现有面板几何 → 其余 12 域**零影响**；
- `--bz-vvh` 是公开资源，其余域各改一行即可接入，无需再碰核心层。

**负面 / 代价**
- **其余 12 个真全屏域仍未修**（diary / clipbook / home / favorites / belongings /
  bookshelf / encrypt / review / recap / settings-panel / knowledge / pomodoro）。
  它们各自的钉底输入区（若有）同样会被键盘遮住。这是**有意为之的范围收敛**：
  issue 266 由用户限定在备忘录面板，逐域接入需要各自目测验收（父层对齐方式、
  是否锚定式、是否嵌套层各不相同），不宜一次性铺开。
  接入清单与模板见「后续」。
- 多了一处 core 级 `document` 监听（`window`/`visualViewport` 各两个事件）。

## 后续（可选，按域推进）

对每个「移动端真全屏 + 钉底输入区」的域，按同一模板改一行并目测：

1. 在域 `styles.css` 的 `@media (max-width: 768px)` 内给面板根加
   `height: var(--bz-vvh, 100vh); max-height: var(--bz-vvh, 100vh);`；
2. 若面板根由 `.bz-panel-overlay`（flex 居中）承载，**同时**加 `align-self: flex-start;`；
3. 若域面板是锚定式（`top/bottom` + `height: auto`）或父级 `inset: 0` 的嵌套层，
   不适用本模板 —— 需单独设计（例：把 `bottom` 从
   `env(safe-area-inset-bottom)` 换成可视视口底）。

## 备选方案（未采纳）

| 方案 | 未采纳原因 |
|---|---|
| core 覆写 `.bz-panel-mtop { height: var(--bz-vvh) !important }` 一处生效全域 | 打坏 knowledge 锚定式全屏与 clipbook 嵌套层；核心层越权管域几何（违反 ADR-0002 分层） |
| 逐域把 `100vh` 改成 `dvh` | 旧内核不支持时无兜底；JS 精修（`visualViewport`）也用不上 |
| JS 逐个面板设 inline `height` | 面板生命周期各域不一，接线散落多域；inline 又会被后续 `!important` 抢权 |
| 给每个输入条加 `position: fixed` + 抬升 | 治标：面板本身仍被键盘盖住，只是输入条浮起来；且多处输入条各写一套 |
| 改 `build-css.mjs` 把 core 移到末尾 | 全域级联行为翻转，回归面不可控 |
