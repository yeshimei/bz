# issue 182：待办桌面面板拖动缩放 + 尺寸记忆

- 状态：完成态见 commit（开发中）
- 关联：ADR-0084（窗口尺寸记忆 + 共享缩放工厂）、铁律 6（UI 分层）、ADR-0002（依赖方向）

## 目标

桌面版待办主窗口（`.bz-todo-panel`）支持**拖动边缘放大/缩小窗口**：限制最大与最小尺寸，**尺寸被记住**（下次打开沿用）。

## 决策（用户逐项拍板）

| # | 决策点 | 拍板 |
|---|---|---|
| Q1 | 哪些位置可拖 | **仅右下角 + 右边 + 底边**（非全八向） |
| Q5 | 缩放锚点/是否拖移 | **固定居中 + 双向缩放**（不引入位置拖动；flex 居中天然对称扩缩，右/底单边拖即可双向变宽高，无跳变） |
| Q2 | 视觉提示 | **零提示，纯 hover resize 光标**（样式库零新增视觉值） |
| Q3 | 最小尺寸 | **720 × 520**（宽不窄于默认 720，高下限保头行+工具栏+列表首卡） |
| Q4 | 最大尺寸 | **min(视口 92%, 1280 × 880)**（视口约束不越屏 + 硬上限防大屏拉无边） |
| Q6 | 架构落点 | **共享 core/ui 组件库新工厂** `uiResizable`（铁律 6：带功能新能力扩组件库 + 回写手册 + 测试）；非 secondbrain 域内 fixed 定位私有实现（todo 面板 flex 居中不可复用） |
| — | 尺寸记忆 | 持久化到 **settings 顶层键** `todoPanelWidth` / `todoPanelHeight`（全仓首个窗口尺寸记忆键；跟随既有 `todoMobileDefaultFullscreen` 先例放设置） |

## 实现要点

- `src/core/ui/resize.ts`：`uiResizable`（独立函数，非类）——几何命中检测右缘/底缘/右下角热区（8px），hover 变 `ew/ns/nwse` 光标，拖拽钳制 `[minW×minH, maxW×maxH]`（max 逐帧 `min(硬上限, 视口 92%)`），写内联 width/height，`onChange(w,h)` 回调；返回 `detach`。
- 不新增 CSS 类（零视觉提示——纯光标走内联，属「功能性几何内联」例外）；组件库文件单测覆盖。
- todo 接入：`openTodoPanel` 内建 `uiResizable` 回调写 `settings.todoPanelWidth/Height`；打开时用记忆值起尺寸；`closeTodoPanel` detach；ESC/重开沿用记忆。
- 回写 `docs/ui-kit-manual.md` §4/§5 与 `docs/ui-design-manual.md`；门禁全绿后合并 + 主仓构建部署。

## 不做的（明确否决）

- 不做位置拖动/位置记忆（Q5 否决）；不做四角四边八向（Q1 否决）；不做常驻三角/热区视觉（Q2 否决）；不改旧体系 `src/core/styles.css`（冻结）；不做设置面板开关项（尺寸记忆自动生效）。
