# ADR-0125：全域子弹窗统一（一套浮层壳 + 域皮贯通）

- 状态：已采纳（2026-09-12）
- 关联：issue 291、ADR-0095（皮肤 = 设置键 + 面板根作用域类）、ADR-0103（影院文档级锚类）、ADR-0064（流程框内核）、ADR-0122（渲染/滚动条单源范式）
- 涉及：`src/core/flow-dialog.ts`、`src/core/styles.css`、`src/core/ui/components.css`，以及 memo/bookshelf/favorites/belongings/secondbrain/knowledge/password-vault 等带皮肤的域

## 背景

用户提出：「备忘录的删除确认面板风格不统一，然后看一下全域的，不限于删除确认面板，**所有所属域的子弹窗面板都要风格统一化**」。

全域清点（21 域逐域实读源码）暴露三条并存的病根：

1. **弹窗壳两套**。`uiModal`（表单弹窗）走 `.bz-overlay-popup`：`--bz-surface-3` 底 + 1px `--bz-border` 描边 + `--bz-shadow-lg` 三层柔和阴影 + 12px 圆角 + 16px 内边距 + 82vh 限高。而 `openFlowDialog`（确认框）走 `#__shared_confirm_popup__`：`--background-primary`（Obsidian 主题变量，不走 bz token）+ **无描边** + 单层硬阴影 `0 20px 60px rgba(0,0,0,.3)` + 24px 内边距 + **不设限高**。两者在同一域里同屏出现时材质明显不同。
2. **皮肤通道只有一半域在用**。子弹窗挂 `document.body`（`uiModal`/`openFlowDialog`/`createOverlay` 都挂 body），脱离面板根 → 面板根上的皮肤类/作用域 token 一律够不着。已有的皮肤入口是 `uiModal.className` 与 `openFlowDialog.className`，但只有 memo/bookshelf 用了 `uiModal` 那侧、只有 clipbook 用了 `openFlowDialog` 那侧；**memo 的两个删除确认框漏传皮肤类**（编辑弹窗有皮、确认框没皮），favorites/belongings/bookshelf/secondbrain/knowledge/password-vault 的确认框同样全部裸奔。
3. **按钮语言两套**。确认框按钮用 Obsidian 的 `--background-secondary`/`--interactive-accent`，组件库按钮用 `--bz-surface-2`/`--bz-brand`；且确认框按钮 6px 圆角 / 8×24 padding，`.bz-btn` 32px 高 / 8px 圆角 —— 同一域里「表单弹窗的按钮」和「确认框的按钮」长得不一样。另外 `bz-flow-dialog-action`（单/三动作分支）**全仓零 CSS 规则**。

## 决策

1. **一套浮层壳**：浮层壳唯一源 = `.bz-overlay-popup`（`src/core/ui/components.css`）。`openFlowDialog` 的 popup 额外挂该类（**id `__shared_confirm_popup__` 与内部 `<h4>/<p>/.confirm-actions`/按钮 id 契约一字不动**），壳层（底色/描边/圆角/阴影/限高/滚动）声明从 `src/core/styles.css` 的 `#__shared_confirm_popup__` 段**撤出**，只留流程框版式。
2. **流程框版式独立成类**：`.bz-flow-dialog`（宽度 `min(400px, 100vw - 32px)`、内边距 `--bz-space-xl` 24px、居中纵排）+ 危险修饰 `.bz-flow-dialog--danger`。版式走**单类特异性**（0,1,0 级），域皮才压得住。
3. **域皮按同一把钥匙命中**：域皮肤类经 `openFlowDialog`/`uiModal` 的 `className` 传给浮层根后——
   - 皮肤若就近覆盖 `--bz-*` token，确认框的壳/文字/按钮**自动跟随**，域内零新增 CSS；
   - 皮肤若用私有 token（`--mask/--ink/--bel-*/--sb-*/--pwv-*`），域内写 `#__shared_confirm_popup__.bz-<域>-flow-dialog { … }` 把该域既有弹窗的材质映射过来（先例：clipbook 的 `#__shared_confirm_popup__.bz-clip-dialog-editorial`）。
   - 该 id 段刻意不声明壳层属性 —— 否则 id 特异性（1,0,0）会永久压死域皮的复合选择器（0,2,0），「同壳」就落不了地。
4. **慎重决策按钮改中性（对齐设计手册 §9/§10）**：主动作带 `danger` 的确认框，popup 挂 `bz-flow-dialog--danger`，主按钮降为中性次级底 + `--bz-danger` 文字，不再默认高亮「删除」。**标准双动作按钮不加任何类**（冻结契约与守护测试不变），修饰挂在 popup 上。
5. **按钮几何与组件库同源**：确认框按钮（含 `bz-flow-dialog-action` 分支）高度/圆角/字号/字重/padding 对齐 `.bz-btn`，颜色走 `--bz-*` token。
6. **`confirmDiscard` 增第三参 `className`**：草稿拦截框由域触发，也要随域皮（先例调用方：favorites / belongings）。
7. **基座皮肤通道口径**：`uiModal.className` 与 `openFlowDialog.className` 是**唯一**两个显式入口；`createOverlay` 签名不加参数（它返回 popup，调用方 `popup.classList.add(...)` 即可，先例 secondbrain `chat-panel.ts`）。

## 后果

- **可见变化**：全域所有确认框换材质（描边 + 三层柔和阴影 + 82vh 限高 + 滚动），按钮换几何与配色；**危险确认框的主按钮不再高亮**。这是本次统一的预期代价。
- 长消息确认框首次获得 `max-height: 82vh` + `overflow-y: auto`（原先可撑出视口）；滚动条由 ADR-0122 单源隐藏，域内不得自造。
- 域皮壳规则（如 `.bz-overlay-popup.bz-memo-skin-paper`）**自动覆盖确认框**，域内不需要为确认框重写底/边/角/影。
- **未覆盖（另批）**：域内**自绘 mask+popup**、不走三基座的子弹窗不在此列——diary（标签选择器/写日记/滚轮时间选择器，纯内联样式）、review（难度/统计/历史/答题四套自绘浮层）、encrypt（体检/密码条目/平台编辑，全局裸类）、attach（预览弹窗的 `bz-attach-preview-pop` 是空挂类）、cinema（自绘 `.cn-ovl` 确认框）。它们的统一属于**基座迁移**（重构 DOM 与测试）而非样式收敛，另立 issue 分批做；本轮只保证「凡走三基座的子弹窗一律同壳、凡带皮肤的域一律带皮」。
- 守护：`tests/core/flow-dialog.test.ts`（壳类 + danger 修饰 + className 通道）、`tests/core/flow-dialog-data.test.ts`（`dangerPrimary`）、`tests/memo/confirm-skin.test.ts`（域皮贯通端到端）、`tests/memo/skin-dark.test.ts`（样式源文本 + 漏传回归）、各域 skin 测试。
