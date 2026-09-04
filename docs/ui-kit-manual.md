# bz 样式库 & 组件库手册（AI 落地用）

> **本手册服务于"实现层"**：告诉 AI 怎么用样式库的类/token 搭 HTML 原型、怎么用组件库工厂写 bz 域真实 UI。
> 分层：**设计手册（docs/ui-design-manual.md）→ 样式库 → 组件库 → 域**。
> - 视觉取值（颜色/圆角/阴影/动效/间距语义）以**设计手册**为准，本手册不重复定义。
> - 本手册只讲：样式库在哪些文件、有哪些类/token；组件库有哪些工厂、怎么调；域怎么引用。
> - 新增组件/样式的流程见文末「新增流程」。

---

## 1. 分层依赖（铁律 6）

```
docs/ui-design-manual.md   ← 设计原则/取值权威（先读它）
        ↓
样式库 src/core/ui/*.css    ← tokens.css + components.css（消费设计手册取值）
        ↓
组件库 src/core/ui/*.ts     ← 工厂，只挂样式库类，不写视觉值
        ↓
各域 src/<域>/ui.ts         ← 只 import 组件库工厂；域 styles.css 只做域内特有布局
```

**单向约束**：
- 样式库类名/token 是**唯一视觉接口**；组件库/域不出现裸色值/魔数（例外：功能性几何内联）。
- 域发现需要新视觉 → **先扩样式库**（加共享类），或 **扩组件库**（加工厂）；禁止域内另起按钮/chip/输入基线。
- 仅当既有组件/样式确实无法表达时才新增，并回写本手册 §4/§5。

---

## 2. 文件地图

| 层 | 文件 | 内容 |
|---|---|---|
| 样式库 | `src/core/ui/tokens.css` | 全部 `--bz-*` token：结构层 `:root` + 色彩层 `body.theme-dark/light` |
| 样式库 | `src/core/ui/components.css` | 组件类样式：`.bz-btn/.bz-icon-btn/.bz-chip/.bz-input/.bz-field/.bz-empty/.bz-segmented/.bz-choice/.bz-sw/.bz-select/.bz-badge/.bz-lightbox` 等 |
| 组件库 | `src/core/ui/index.ts` | 转发桶（唯一 import 入口） |
| 组件库 | `src/core/ui/{types,icon,icons,button,chip,field,empty,segmented,choice,switch,select,search,mainhead,rail,mobstrip,stat,progress,popover,slider,lightbox,modal,resize}.ts` | 每组件一文件工厂 |
| 构建 | `scripts/build-css.mjs` | SOURCES 聚合：normalize → core/styles.css → **ui/tokens.css → ui/components.css** → 各域 styles.css |

> 注意：`src/core/styles.css` 是**旧体系**（用 Obsidian 变量，被 20 存量域依赖，冻结不改）；`src/core/ui/` 是**新体系**（自绘 token，新 UI 用）。同名类冲突处理见 §6。

---

## 3. 样式库速查（HTML 原型直接用这些类）

### 3.1 Token（写 CSS 时只许用这些）
- **结构**：`--bz-space-xs/sm/md/lg/xl/2xl`、`--bz-radius-xs/sm/md/lg/full`、`--bz-font-caption/meta/label/body/emphasis/title/display`、`--bz-weight-*`、`--bz-leading-*`、`--bz-control-h(-sm/md/lg)`、`--bz-icon-btn-w/h/lg`、`--bz-head-h(-lg)`、`--bz-shadow-sm/md/lg`、`--bz-dur-fast/base/slow`、`--bz-ease-*`、`--bz-star`、`--bz-scrim`、`--bz-on-overlay`
- **色彩（随明暗）**：`--bz-surface-0..4`、`--bz-surface-hover/active`、`--bz-overlay`、`--bz-text-1/2/3/invert`、`--bz-brand(-hover/-soft)/--bz-on-brand`、`--bz-success/warning/danger/info/--bz-on-danger`、`--bz-border(-strong/-hover)`、`--bz-track/thumb`、`--bz-code-bg`、`--bz-mark-bg`

### 3.2 组件类（HTML 直接写）
| 组件 | 类 | 修饰 | 说明 |
|---|---|---|---|
| 按钮 | `.bz-btn` | `--primary/--danger/--danger-ghost/--ghost/--hover-accent`；`--sm/--md/--lg/--icon` | 32px 高、圆角 sm；`--md` 30px 中档（主头行主钮/排序钮）；hover 自动；`--danger-ghost` 描边 danger（常态透底描边、hover 转实底），`--hover-accent` 悬停才显品牌软底+品牌描边 |
| 按钮行 | `.bz-btn-row` | `--center/--grow` | 弹窗底部右对齐 |
| 图标按钮 | `.bz-icon-btn` | `--on/--lg/--xs/--close/--accent/--boxed/--active`；`[data-danger]` | 22×26 桌面头行档；`--accent` 品牌色图标钮（卡内行动钮），`--boxed`=浮于面板底上带描边变体，`--active`=品牌实底开关激活态（与 `--boxed` 同钮叠加时激活底胜出） |
| Chip | `.bz-chip` | `--on/--sel/--locked/--tint/--hover-accent/--lg`；内含 `.bz-chip-cnt`/`.bz-chip-x` | 筛选/标签胶囊；`--tint` 数据语义色徽标（域内联 `--bz-chip-tint`/`--bz-chip-tint-fg` 注入底/前景色）；`--hover-accent` 悬停才显品牌软底+品牌描边（可点 chip 的 hover 提示）；`--lg` 36px 触控档 |
| 徽标 | `.bz-badge` | `--accent/--success/--danger/--warning/--neutral/--brand` | 纯展示小胶囊；`--brand` 实底品牌档（未读气泡等强提示） |
| 输入框 | `.bz-input` | `--error`；`.bz-input-wrap` 前缀图标 | 32px 高 |
| 字段行 | `.bz-field` | 内 `.bz-field-label/-desc/-error` | label+控件+说明 |
| 空态 | `.bz-empty` | 内 `.bz-empty-ic/-title/-desc` + `.bz-btn-row` | CTA 放按钮行 |
| 分段 | `.bz-segmented` | 内 `.bz-segmented-btn.is-on` | 单选多段（等宽条） |
| 平铺单选组 | `.bz-choice` | 内 `.bz-choice-btn.is-on`（可选 `.bz-choice-dot` 色点） | 表单替代下拉的胶囊选项组，可换行；选项多/文案长/需色点时用 |
| 开关 | `.bz-sw` | `.on`（role=switch，键盘 Space/Enter） | 40×22 滑块，开 = 品牌实底 |
| 下拉 | `.bz-select` | `.open`；内 `.bz-select-val`/`.bz-select-car`；弹层 `.bz-select-menu` 内 `.bz-select-item.is-on` + `.bz-select-item-ck` | 单行单选下拉；菜单随最长选项加宽不截断；短选项组优先 `.bz-choice` 平铺 |
| 灯箱 | `.bz-lightbox` | 内 `.bz-lightbox-head/media/foot/-close` | 全屏看图/视频 |
| 弹窗 | `.bz-overlay-mask` / `.bz-overlay-popup` | 内 `.bz-dialog-head/-title/-body`；底 `.bz-btn-row` | 居中模态（遮罩点关） |
| 滑条 | `.bz-range` | `--lg` | 自绘轨道+滑块；抗 Obsidian 默认 range 外观重置 |
| 加载 | `.bz-spinner` | `--sm/--lg` | 占位加载态 |
| 面板壳 | `.bz-panel-overlay` / `.bz-panel-frame` | — | 全屏遮罩+居中主面板骨架（flex 居中，z 经 topifyZ 动态分配）；**新域主面板一律此壳 + `.bz-panel-head` 头行** |
| 窗口头行 | `.bz-panel-head` | `--tall`；内 `.bz-panel-brand/-title`/`.bz-panel-head-pipe/-sub/-sp/-btns` | 影院式整宽头行 44px（`--tall` 50px）；品牌块 24px 圆角小方块可选 |
| 主头行 | `.bz-main-head` | 内 `.bz-main-title/-count/-spacer` | 内容区主头行：标题 16px + 计数 + 主按钮（30px 中档） |
| 工具行 | `.bz-toolrow` | — | 主头行下搜索/排序次级行 |
| 搜索框 | `.bz-search` | 内 `.bz-kbd` 快捷键帽 | 前缀搜索图标 + `.bz-input`（左留 30px） |
| 状态侧栏 | `.bz-rail` | `--wide`；行 `.bz-rail-item.on/.has-sub/.sub-open`；槽 `.bz-rail-ic(--accent)/-badge/-dot/-name/-count(--pill)/-unread/-caret/-sub.open/-label/-scroll/-foot`；色注入 `--bz-rail-tint` | 左栏分组导航超集（图标/底座/字母徽标/色点四选一前缀 + 计数/未读 + 二级子列表 + 底部固定区） |
| 移动横滑条 | `.bz-mobstrip` | 内 `.bz-mobstrip-chip.is-on`/`.bz-mobstrip-dot` | ≤768px 替代 rail 的横滑胶囊条（桌面 display:none） |
| 统计卡 | `.bz-stat` | `--main/--ok/--warn/--danger/--text/--click`；网格 `.bz-stat-grid(--2/--4)`；趋势 `.bz-stat-trend--up/--down` | 数字+标签统计卡；`--main` 品牌主卡，`--click` 可点筛选 |
| 候选浮层 | `.bz-popover` | 内 `.bz-popover-item.is-on`/`.bz-popover-empty` | input 锚定的候选列表（绝对定位挂 position:relative 容器，交互同 .bz-select-menu） |
| 进度条 | `.bz-progress` | `--thin/--ok/--warn/--danger/--lg` | track + i 填充基元；`--thin` 3px 媒体封面档（绝对定位由调用方给） |
| 提示条 | `.bz-alert` | `--success/--warning/--danger`；内 `.bz-alert-title/-x` | 信息/成功/警告/危险提示 |
| 菜单 | `.bz-menu` | 内 `.bz-menu-item[data-danger]`/`.bz-menu-sep`；配 `.bz-kbd` | 下拉/右键菜单浮层 |
| 键帽 | `.bz-kbd` | — | 快捷键帽（.bz-search 内自动右侧定位） |
| 骨架屏 | `.bz-skeleton` | `--circle/--title` | 微光扫过占位 |
| 标签页 | `.bz-tabs` | 内 `.bz-tab.is-on` | 下划线式页签 |
| 底部抽屉 | `.bz-sheet` | 内 `.bz-sheet-grip/-head/-title/-sub` | 移动端底部抽屉壳（配遮罩，含安全区垫底） |
| 标签输入 | `.bz-taginput` | 内 `.bz-taginput-field` | 胶囊 chips + 输入（focus 品牌描边） |
| 星级 | `.bz-rating` | `--sm/--readonly` | 星轨（--bz-star） |
| 环形进度 | `.bz-ring` | `--ok/--warn/--danger`；内 `.bz-ring-track/-fill/-label` | SVG 环形进度 |
| 描述列表 | `.bz-desc-list` | dl/dt/dd | 详情弹窗键值对 |
| 分隔线 | `.bz-divider` | `--line` | 文案居中线 / 纯线 |
| 复选/单选 | `.bz-checkbox` / `.bz-radio` | 原生 input 自绘 | 品牌选中态 |
| 数字步进 | `.bz-input-number` | 内 `.bz-input-number-btn/-val` | −/值/+ 步进 |
| 状态 | `.bz-status` | `--brand/--info/--success/--warning/--danger` | 圆点 + 文本状态 |
| 面包屑 | `.bz-crumbs` | 内 `.bz-crumb(--current)`/`.bz-crumb-sep` | 层级路径 |
| 步骤条 | `.bz-steps` | 内 `.bz-step(--on/--done)`/`.bz-step-num/-label/-line(--done)` | 流程步骤 |
| 数据表 | `.bz-table` | th/td | 轻量数据表 |
| 卡片 | `.bz-card` | 内 `.bz-card-header/-title/-sub/-body/-footer` | 通用内容卡 |
| 列表 | `.bz-list` | 内 `.bz-list-item/-main/-title/-desc/-extra` | 通用列表行 |
| 媒体块 | `.bz-media` | `--4-3/--square`；内 `.bz-media-badge/-dur/-play` | 比例容器+角标/时长/播放钮 |
| 头像 | `.bz-avatar` | `--sm/--lg/--square` | 32px 圆头像/字徽 |
| 悬浮按钮 | `.bz-fab` | — | 48px 品牌圆钮 |
| 工具提示 | `[data-tip]` | 纯 CSS hover | data-tip 属性即气泡 |
| 多选下拉 | `.bz-multiselect` | 内 `.bz-multiselect-opt.is-on`/`.bz-ck` | 复选下拉 |
| 月份选择 | `.bz-monthpicker` | 内 `.bz-mp-year/-grid/-month.is-on/-month-cnt` | 年 + 12 月网格 |
| 密码强度 | `.bz-strength` | `--1..--4`；内 `.bz-strength-bar/-seg/-meta/-score` | 四段强度条 |
| 分页 | `.bz-pagination` | 内 `.bz-page-btn.is-on[disabled]`/`.bz-page-gap` | 页码条 |
| 折叠面板 | `.bz-collapse` | `.open`；内 `.bz-collapse-head/-caret/-body` | 手风琴（相邻间距内置） |
| 时间线 | `.bz-timeline` | 内 `.bz-timeline-item.is-on/-date/-title/-desc` | 竖向时间轴 |
| 二次确认 | `.bz-popconfirm` | 内 `.bz-popconfirm-btns` | 轻量确认浮层 |
| 引文/高亮/行内码 | `.bz-quote` / `.bz-mark` / `.bz-code` | — | 品牌左线引文 / 高亮 / 行内代码 |
| 消息卡 | `.bz-msg` | `--success/--warning/--danger` | toast 通知卡（左色条） |
| 移动全屏顶距 | `.bz-panel-mtop` | — | 挂**全屏面板根节点**：≤768px 顶部留 44px（max 安全区）避让 Obsidian 移动端头，并归零首子元素顶距（core `.bz-win-mfs` 34px 垫顶与域内头行 safe-area 垫顶由它统一接管，接入域**勿再**在头行写避让，防双份顶距）；非恒全屏面板（如番茄钟）随 mfs 开关 `classList.toggle` 同挂摘 |
| 触控热区 | `.bz-touch-target` | `--sm/--lg/--xl`；内联 `--bz-touch-outset` 覆写 | 仅触屏（pointer:coarse）生效：`::after` 外扩命中区至 ≥44px、视觉不变；档位按元素原尺寸——默认 -6px（32px 档钮）、`--sm` -4px（36/40px 档）、`--lg` -8px（26/28px 档）、`--xl` -12px（20/22px 档）；热区外扩会盖住相邻元素命中，行距紧凑的列表行**勿用**（改 padding 抬档，先例 attach 清单行） |

**图标**：一律 lucide 图标名（工厂经 `setIcon` 渲染 Obsidian 原生 SVG）。颜色默认继承 `currentColor`（在按钮里自动变 on-brand 白），需要独立语义色给图标元素加 `.bz-ic--brand/success/warning/danger/info/star/muted/on-brand`，尺寸 `.bz-ic--xs/sm/md/lg/xl`。**禁止 emoji 当图标、禁止文本符号当图标**。

### 3.3 最小可用片段
```html
<!-- 弹窗底部按钮行 -->
<div class="bz-btn-row">
  <button class="bz-btn">取消</button>
  <button class="bz-btn bz-btn--primary"><i data-lucide="check" class="bz-ic"></i>保存</button>
</div>

<!-- 筛选 chips -->
<button class="bz-chip bz-chip--on">日记<span class="bz-chip-cnt">12</span></button>
<button class="bz-chip bz-chip--locked">加密</button>

<!-- 空态 -->
<div class="bz-empty">
  <i data-lucide="inbox" class="bz-empty-ic"></i>
  <div class="bz-empty-title">还没有日记</div>
  <div class="bz-empty-desc">写几句，回忆会自己长出来</div>
  <div class="bz-btn-row bz-btn-row--center"><button class="bz-btn bz-btn--primary">写第一篇</button></div>
</div>
```

---

## 4. 组件库速查（bz 域 TS 里 import）

统一入口：`import { … } from 'core/ui'`（或相对 `../../core/ui`）。

| 工厂 | 签名要点 | 返回 |
|---|---|---|
| `uiBtn` | `{label?, icon?, tone?, size?, title?, disabled?, className?, onClick?}` | `HTMLButtonElement` |
| `uiIconBtn` | `{icon, title?, on?, lg?, xs?, close?, danger?, onClick?}` | `HTMLButtonElement` |
| `uiBtnRow` | `(buttons: HTMLElement[], {center?, grow?}?)` | `HTMLDivElement` |
| `uiDialogActions` | `{okText, okTone?, cancelText?, onOk, onCancel?}` | `{row, cancelBtn, okBtn}` |
| `uiChip` | `{label, icon?, count?, selected?, removable?, locked?, onClick?, onRemove?}` | `HTMLButtonElement` |
| `uiInput` | `{type?, placeholder?, value?, error?, disabled?, onInput?}` | `HTMLInputElement` |
| `uiRange` | `{min?, max?, step?, value?, disabled?, className?, onInput?, onChange?}` | `HTMLInputElement` |
| `uiField` | `{label?, desc?, error?, control}` | `HTMLLabelElement` |
| `uiEmpty` | `{icon?, title, desc?, actions?}` | `HTMLDivElement` |
| `uiSegmented` | `<T>({options, value, onChange})` | `{el, setValue}` |
| `uiChoice` | `<T>({options:{value,label,dot?}[], value, onChange, className?})` | `{el, setValue}` |
| `uiSwitch` | `{checked?, onChange?}` | `{el, setChecked}` |
| `uiSelect` | `<T>({options, value, placeholder?, className?, onOpenChange?, onChange})` | `{el, setValue}` |
| `uiIconSpan` | `(name, extraClass?)` — 同 uiIcon 语义别名 | `HTMLSpanElement` |
| `mountIcons` | `(root)` — 扫描 root 内 `[data-lucide]` 占位逐个 setIcon（class 保留），手写 HTML 模板用 | `void` |
| `uiSearch` | `{placeholder?, value?, onInput?}` | `{el, input, setValue}` |
| `uiMainHead` | `{title, count?, action?: {label, icon?, onClick?}}` | `{el, setTitle, setCount}` |
| `uiRail` | `{groups: [{label?, items}], activeId, onSelect?, foot?}` — RailItem=`{id, name, icon?, boxedIcon?, badge?: {t, label, tint?}, dot?, count?, pill?, unread?, children?}` | `{el, setActive}` |
| `uiMobStrip` | `{items: [{id, label, dot?}], value, onChange?}` | `{el, setValue}` |
| `uiStat` | `{label, num, icon?, hint?, tone?: 'main'\|'ok'\|'warn'\|'danger'\|'text', click?, onClick?}` | `HTMLDivElement` |
| `uiProgress` | `{value?, tone?: 'ok'\|'warn'\|'danger', thin?}` — value 0-100 钳制 | `{el, setValue}` |
| `uiPopover` | `{anchor, options: [{id, label, icon?}], value?, emptyText?, onPick?}` — anchor 须在 position:relative 容器内，浮层挂其父元素 | `{open, close, setValue, setOptions}` |
| `uiIcon` | `(name, extraClass?)` | `HTMLElement` |
| `uiResizable` | `(el, {edge?, minW?, minH?, maxW?, maxH?, onChange?, persist?: {load?, save?}})` | `{detach}` |
| `openLightbox` | `{src, type?, title?, caption?}` | `{close}`；`closeLightbox()` |

**约定**：
- 工厂名带 `ui` 前缀，避免与旧 `createIconBtn`（dom.ts，文本式）冲突；旧工厂新 UI 不要用。
- 文案一律 `textContent` 传入（防注入），图标名传 lucide 名由工厂生成 `<i data-lucide>`。
- 回调风格：按钮 `onClick`、输入 `onInput`、分段 `onChange`、chip `onRemove`（内部已 stopPropagation）。

**窗口缩放（uiResizable，ADR-0084）**：给桌面主面板加「右缘/底缘/右下角」拖动缩放——`el` 无需定位上下文（命中/光标挂自身，不注入覆盖层），改宽高内联。宿主若是 flex 居中（`.bz-*-overlay` center），宽高变化即双向对称扩缩不越视口。钳制下限 `minW×minH`、上限逐帧取 `min(maxW×maxH, 视口92%)`；`onChange(w,h)` 供调方持久化尺寸。零视觉提示（纯 hover 光标）；仅 mouse 事件，移动端勿挂。尺寸记忆：可传 `persist: { load?, save? }`（ADR-0094）——挂载时 `load()` 有值即恢复（钳到与拖拽同口径），`onChange` 防抖 300ms 调 `save()`，detach 时未落尾值立即补存；不传则行为不变（键由调用域自定义，先例 `todoPanelWidth/Height`）。

---

## 5. 域接入规范

1. **新建域 UI**：HTML 结构用 §3 类，事件绑定后交给组件库工厂（能工厂就不手写）；手写 DOM 时也用样式库类。**新域主面板一律 `.bz-panel-overlay`/`.bz-panel-frame` 壳 + `.bz-panel-head` 头行**（§3.2，不再自绘面板骨架）。
2. **域独有布局**（主窗口骨架、瀑布流、特殊排版）写 `src/<域>/styles.css`——只做布局与域内结构，不复刻按钮/输入等基线；值从 token 取。
3. **移动端**：真全屏 `.bz-win-mfs` 环境类 + 触控尺寸（`--lg` 档图标钮 / 行高 ≥44px / 底部安全区 `env(safe-area-inset-bottom)`），对齐设计手册 §8。
4. **图标**：一律 lucide；禁止 emoji 图标、禁止文本符号（✕/★）当图标。
5. **窗口缩放/尺寸记忆**：桌面主面板要可拖动缩放 → 用 §4 `uiResizable`（不自造手柄/热区/8 向 fixed 逻辑）；尺寸持久化写本域 settings 键（`<域>PanelWidth/Height` 风格），打开时读回、`onChange` 写回；移动端不挂。

---

## 6. 新旧体系边界（重要）

- 旧体系 = `src/core/styles.css`（Obsidian 变量）+ 20 存量域 → **冻结不动**。
- 新体系 = `src/core/ui/`（自绘 `--bz-*`）→ 新 UI/新域用。
- **同名冲突**（如旧 `.bz-icon-btn` vs 新 `.bz-icon-btn`）：新体系构建在旧 core 之后（SOURCES 顺序），**新类定义会覆盖同名旧类**——因此收编旧域前，先确认旧域类名与新的不一致；冲突类逐步用新类替换旧用法后再删旧定义，不并存双写。
- 存量域**不强制迁移**；新代码一律走新体系。

---

## 7. 新增流程（域发现样式库/组件库不够用时）

1. **先查本手册 §3/§4 + 设计手册 §9**：确认没有可复用类/工厂。
2. 判断新形态是**样式**还是**带功能组件**：
   - 纯视觉（新状态/新尺寸/新组合）→ 扩 `src/core/ui/components.css`（共享类，`bz-` 前缀 + BEM 修饰），不扩在域内；
   - 带功能/事件/句柄 → 扩组件库：新建 `src/core/ui/<name>.ts`（单文件工厂，对齐现有风格），`index.ts` 加一行转发。
3. 新 token 先加 `tokens.css`（结构层 `:root` 或色彩层按明暗），组件样式只消费 token。
4. **回写**：本手册 §3/§4 补一行；若涉及设计取值（颜色/圆角新档）→ 同步设计手册。
5. 测试：工厂必有 `tests/core/ui.test.ts` 增补用例（jsdom 结构/类/事件断言）。
6. 走 worktree 提交（铁律 1），构建验证聚合产物。

---

## 8. HTML 原型（画廊）指南

设计/验证新组件时，先在 `.zcode/ui-prototypes/bz-ui-gallery/` 做 HTML 原型：
- 样式**只**用 tokens.css + components.css（与主仓同源，复制或引用均可），保证原型 = 实现观感；
- 交互演示放 `gallery-app.js`（原型专用，不进主仓）；
- 原型定稿 → 按 §7 流程落主仓 → 原型组件从画廊「组件库」页与样式库手册同步。
- 组件库页只收"带功能"组件，样式库页只收"纯视觉"规格；章节编号右侧悬浮导航跳转。
