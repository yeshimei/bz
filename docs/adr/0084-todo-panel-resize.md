# ADR-0084：待办面板拖动缩放 + 窗口尺寸记忆（共享缩放工厂）

- 状态：已采纳
- 日期：2026-09-03
- 关联：ADR-0002（依赖方向）、ADR-0019（移动端默认全屏——移动端窗口形态先例）、ADR-0080（设置面板域）、铁律 6（UI 分层：设计手册 → 样式库 → 组件库 → 域）
- 票：`issues/182-todo-panel-resize.md`

## 背景

桌面版待办主窗口（`.bz-todo-panel`，flex 居中于遮罩内）固定 720×580，无窗口缩放能力。用户要「拖动边缘放大缩小、限制最大/最小尺寸、尺寸被记住」。仓库现状：

- 唯一缩放实现是 **secondbrain 域内私有** `makeResizable`（`src/secondbrain/ui-tools.ts:91`）：8 向、内联 cssText 手柄、读写 left/top/width/height——**依赖 fixed/absolute 定位**（float-window.ts:125、reference-panel.ts:309 均如此用）；todo 面板是 flex 居中，不可复用。
- **窗口尺寸记忆全仓无先例**：无任何持久化窗口宽/高键（settings 平铺；唯一窗口形态键 = 移动端全屏布尔，ADR-0019）。
- 组件库（`src/core/ui/`）无 resize 能力、无 *-resize 光标、无拖拽类；`--bz-state-dragged` 是拖拽透明度 token。
- 铁律 6 + ui-kit-manual §7 新增流程：带功能/句柄的新能力 → **扩组件库单文件工厂 + index.ts 转发 + 回写手册 + tests/core/ui.test.ts 增补**。

## 决策

### 1. 交互（用户拍板）：仅右下角 + 右边 + 底边；固定居中双向缩放；零视觉提示

- 可拖热区 = 右缘（ew-resize）+ 底缘（ns-resize）+ 右下角（nwse-resize），各 8px。不做左上/上缘/左缘/四角。
- **不引入位置拖动/位置记忆**：面板保持 flex 居中。因 flex 居中容器内 width/height 变化**双向对称扩缩**，拖右缘/底缘即可实现「宽高双向变化」且面板不跳、不越出可视区——故单边热区 + 居中 = 完整的双向缩放语义，无需 8 向手柄。
- **零常驻视觉提示**：不设手柄 DOM/不新增 CSS 类/不加右下角三角。可拖表面 hover 时内联 `cursor: *-resize` 提示（功能性几何内联，属 ui-kit-manual「功能性几何内联」例外，样式库零新增）。
- 最小 720×520；最大 = `min(视口 92%, 1280×880)`——拖动钳制逐帧取 `min(硬上限, 视口*0.92)`，任何屏幕不越遮罩、大屏不拉无边。

### 2. 实现落点：扩组件库 `src/core/ui/resize.ts`（uiResizable）

独立工厂函数（对齐 ui-kit-manual §4 工厂风格，返回 `{ detach }`），不做类/状态：

```
uiResizable(el, { minW, minH, maxW, maxH, onChange })
```

- 由工厂在目标元素**内**挂一个透明覆盖层（absolute inset-0）做**几何命中检测**：指针落在右缘/底缘/右下角 8px 区 → 该层换对应 resize 光标；按下进入拖拽态，按 `dir` 钳制计算宽高写回 `el.style.width/height`；`onChange(w,h)` 每帧回调（域层持久化用）。detach 时移除覆盖层与全局 mousemove/mouseup 监听。
- 零 CSS 类、零 token 新增；在目标元素**内**挂层（不依赖宿主定位上下文，todo 面板 `position` 未设也成立——覆盖层 absolute 相对面板，面板需成为定位上下文：接入时加 `position: relative` 或用面板现成的 static + 层 inset-0 相对最近定位祖先会错——**故接入侧需给面板 `position: relative`**，或工厂要求 el 自身定位。待接入时以最小侵入定：优先面板 style.position = 'relative'）。
- 组件库单测：`tests/core/ui.test.ts` 增补——构造大小元素、模拟 mousemove 命中右缘/底缘/角 → 光标正确；模拟 mousedown + 拖拽 → 宽高钳制到 min/max（含视口 92% 上限缩合）、onChange 回调收到正确值；detach 后不再响应。

### 3. 尺寸记忆：settings 顶层键（todoPanelWidth / todoPanelHeight）

- **全仓首个窗口尺寸持久化键**，写 settings（BzSettings 平铺 + DEFAULT_SETTINGS 补 `todoPanelWidth/Height`，默认 720/580）。
- todo 打开时 `settings.todoPanelWidth ?? 720` / `?? 580` 起步；uiResizable onChange → `saveSettings()`（节流或松耦合：写内存 settings + save，靠既有通道）。
- 不开设置面板开关（记忆自动生效，属面板行为非用户显式设置项）；移动端 `<768px` 真全屏形态不受影响（尺寸记忆仅桌面；移动端 CSS 覆盖 width/height）。
- 未来 13 个主窗口域要「记忆尺寸/可缩放」时：复用 `uiResizable` + 各自 settings 键（本 ADR 为模板）。

## Options Considered

- **域内私有实现（仿 secondbrain）**：改动面最小，但违背铁律 6「带功能新能力扩组件库」+ 跨域一致性偏好（记忆：统一 core 基座）——否决（用户拍板共享工厂）。
- **全 8 向 + 手柄 DOM + 三角提示**：Q1/Q2 拍板否决——范围收敛到常用扩缩方向 + 零视觉。
- **自由缩放 + 位置拖动 + 位置记忆**：Q5 拍板否决——完整桌面窗口语义超出本次目标；flex 居中天然处理越屏/对称。
- **尺寸记忆存 localStorage / 文件**：否决——全仓设置收敛 settings 键先例（ADR-0019/0080 方向），data.json 兜底健全。

## 后续

- 待办合并后，若用户对「新待办全屏 + 弹出小窗」等其它 13 主窗域要求缩放/记忆，复用 uiResizable + 同名键模式。
- 旧体系 src/core/styles.css 冻结不动；本功能全走新体系（todo 面板已消费新体系 token）。
