# bz UI 设计手册（AI 统一全域 UI 用）

> 本手册是 bz（包仔）插件**全域 UI（桌面端 + 移动端）**的唯一视觉约定来源，供 AI 在新增、修改、审查任何 UI 时取值与自检。
> 生效范围：`src/*/ui.ts`、`src/*/styles.css`、`src/core/*`，以及任何生成 DOM 的代码。
> 与 `AGENTS.md` 铁律 8（样式收敛）同级：**视觉决策先查本手册，手册未定义的场景才允许新定，并回写手册。**

---

## 1. 设计方向（先读这一节）

一句话：**好看、高级、简约。**

拆开说：

- **好看** —— 视觉上让人舒服、耐看，不土、不脏、不刺眼。
- **高级** —— 克制、有留白、有秩序、材质细腻；宁少勿多。
- **简约** —— 界面只表达必要信息，去掉装饰、边框、色块、阴影的堆砌；一个屏幕只有一个视觉焦点。

**三原则背后的权威依据**（每个 AI 动手前都应内化这三条，它们来自主流设计系统，经久不衰）：

| 原则 | 出处 | 内容 | 落到我们 UI 的做法 |
|---|---|---|---|
| **清晰 Clarity** | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) | 文字在任何尺寸都可读、图标精准、装饰适度 | 字号阶梯（§3）必须遵守；图标只留必要的；装饰能删就删 |
| **遵从 Deference** | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) | "UI helps users understand and interact with the content, but never competes with it."（UI 帮助用户理解内容，但**从不与内容竞争**） | 我们的数据（日记/备忘/书）才是主角；边框、阴影、配色是配角 |
| **深度 Depth** | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) | 层级用空间关系表达，视觉层级有深有浅 | 弹窗/菜单/抽屉用阴影表达 z 轴层级（§5.2），但只分三档 |

**来自 Refactoring UI 的行动级原则**（[refactoringui.com](https://refactoringui.com/)，开发者向 UI 设计圣经，全部可执行）：

1. **Use fewer borders** —— 少用边框。边框是用来区分两个元素的最后手段，用多了界面就「忙」；优先用间距、背景差、阴影替代（我们 §5.1 已执行）。
2. **Hierarchy is everything** —— 层级就是一切。不是所有元素都平等；一个界面只能有一个主角。
3. **De-emphasize to emphasize** —— 想强调什么，就把其他东西弱化。减法比加法更能突出重点。
4. **Start with too much white space** —— 从「过多的留白」开始，再往回收。留白过多比过少好修。
5. **Don't use grey text on colored backgrounds** —— 不要在彩色背景上用灰字（对比度杀手）。灰字只能用在正常背景上。
6. **Not every link needs a color** —— 不是每个链接都要上色。链接密度高时，靠位置/下划线表达，颜色留给真正重要的。
7. **Shadows convey elevation** —— 阴影表达的是「抬升高度」，不是装饰（对应我们 §5.2 的语义）。

落到每次改动，自问三句：

1. 这个元素**有没有必要存在**？（简约：能删就删）
2. 它的**信息层级**清楚吗？（高级：一个层级一个样式，不靠堆样式；想强调就弱化周围，而不是加强自己）
3. 换到**移动端**它还会不会难看？（统一：两端同一套规范）

---

## 2. 视觉基座：只用 Obsidian CSS 变量，禁止硬编码颜色

**全域 UI 一律从 Obsidian 的 CSS 变量取值，任何地方不写死色值/字号/间距常量。**

原因：插件跑在用户自己的 Obsidian 里，用户的主题（亮色/暗色/自定义）随时会变。写死颜色会立刻「穿帮」——亮色主题下黑字糊黑底、暗色主题下白字看不见，高级感全无。

**颜色克制的三个权威原则**（[Refactoring UI](https://refactoringui.com/) Working with Color 章节，直接适用）：

1. **Start with gray, add color sparingly** —— 先从灰阶开始设计，颜色是最后才加的。界面 90% 应该是中性色（我们已用 `--text-normal/muted/faint` + 背景变量做到）。
2. **Don't use pure black** —— 不要用纯黑（`#000`）配纯白（`#fff`）：纯黑衬纯白对比过强、刺眼。深色文字用带蓝/灰调的深色，浅色底用带灰的白（Obsidian 主题本身已修正，我们直接继承 `--text-normal` 等，**不要自己覆盖成纯黑**）。
3. **Not every element needs a color** —— 颜色只留给「状态」和「强调」。多一个颜色 = 多一份注意力竞争（对应我们 §6 状态色只表达状态）。

**必须用的变量（默认暗色系 Obsidian 的值，仅示意）**：

| 用途 | 变量 | 说明 |
|---|---|---|
| 弹窗/卡片背景 | `--background-primary` | 主背景，绝大多数弹窗用它 |
| 次级背景 | `--background-secondary` | 输入框、按钮、卡片内部区 |
| 悬浮/hover 背景 | `--background-modifier-hover` | hover 行、菜单项 |
| 选中态背景 | `--background-modifier-active-hover` | 当前选中项 |
| 弹窗遮罩 | `--background-modifier-cover` | 全局遮罩，比裸黑色更贴合主题 |
| 边框 | `--background-modifier-border` | 所有 1px 边框统一用它 |
| 主文字 | `--text-normal` | 正文、标题 |
| 次要文字 | `--text-muted` | 描述、meta、图标默认色 |
| 弱化文字 | `--text-faint` | 占位、空态、时间戳 |
| 错误文字 | `--text-error` | 危险操作、错误提示 |
| 强调色 | `--interactive-accent` | 主按钮、选中态、焦点环、进度条（跟随主题，别自己造色） |
| 强调色上的文字 | `--text-on-accent` | 强调色底上的文字（如主按钮文字） |
| 语义色 | `--color-green/red/orange/blue/cyan/purple` | 状态徽标（成功/失败/警告等），只用于**状态**，不用于装饰 |
| 圆角/间距 | `--radius-s/m/l` 等 | Obsidian 已定义，优先用，缺失才回退到本手册的固定值 |
| 字体 | `--font-*` | 文本、界面、等宽字体系列，不指定具体字体名 |

**禁止**：

- ❌ 写死十六进制/`rgba()` 的**颜色值**（阴影里的黑可以带透明度，见 §5）
- ❌ 写死**主题特有**的变量（`--text-accent-hover` 等）——先用 `grep` 确认变量在全仓已用过且是 Obsidian 官方变量，再采用
- ❌ 为了让某个主题下好看而给另一个主题留「彩蛋」的 hack（如 `@media` 检测主题）

**例外（允许写死）**：

- 纯功能性：`transparent`、`rgba(0,0,0,x)` 阴影（§5 允许值内）、`currentColor`
- 插件自带的小橘猫（smartcat）皮肤色——它属于产品本体（宠物形象），不跟随主题，已有皮肤机制，**新增皮肤**需按 smartcat 既有模式（`.skin-*`）实现，且不得影响其他 UI。

**语义 token 成对命名**（[shadcn/ui](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css) + [Material 3](https://github.com/material-components/material-web/blob/main/tokens/_md-sys-color.scss) 的「角色 + 前景/on」命名法）：新自绘组件需要自定义变量时，用 `--bz-<角色>` + `--bz-<角色>-foreground` 成对定义（如 `--bz-card` / `--bz-card-foreground`），**不散落裸色值**。Obsidian 主题已覆盖的角色（`--background-*`/`--text-*`/`--interactive-accent`）直接用主题变量，不重复造。

**Token 三层组织**（[GitHub Primer primitives](https://github.com/primer/primitives) 方法论）：自定义变量时显式分三层——
1. **base**：原始数值（4px 网格、基准 14px 字号、色相阶）——不直接进组件
2. **functional**：语义变量（`--bz-space-sm`、`--bz-color-border-muted`）——引用 base，组件层只允许用这一层
3. **component**：组件级（如 `--bz-btn-height`）

**禁止组件直接写原始像素**（如裸 `gap: 6px`、裸色值）——先查是否有语义变量，没有就在 functional 层定义。

---

## 3. 字体与层级（Typography）

- 用 Obsidian 字体变量：`--font-interface`、`--font-text`、`--font-monospace`；**不指定**具体字体名。
- 字号阶梯（**全域只用这几档**，`px` 与 `em` 均可，保持语义一致）：

| 档位 | 大小 | 用在哪 |
|---|---|---|
| `caption` | 11–12px | 徽标、时间戳、辅助小字 |
| `meta` | 12–13px | 描述、meta 行、次级按钮 |
| `body` | 14px | **默认**正文、输入、菜单项 |
| `emphasis` | 15–16px | 列表标题、弹窗标题 |
| `title` | 17–18px | 主窗口标题、对话框标题 |
| `display` | 20px+ | 大数字、主展示（如番茄钟倒计时） |

- 字重只用：`400`（默认）、`500`（强调按钮）、`600`（标题）、`700`（区块标题，如设置分组名）。**避免** `800/900` 粗黑。
- 行高：正文 `1.5`，紧凑信息 `1.4`，标题 `1.3` 以内。
- **单行控件行高 `1.25`**（[GitHub Primer tight](https://github.com/primer/primitives/blob/main/src/tokens/base/typography/typography.json5)）：按钮、输入框、菜单项、chip 等单行控件用 `line-height: 1.25`，避免按钮文字行高过大、控件偏高；多行正文才用 `1.5`。
- 层级三色原则：标题 `--text-normal`、正文 `--text-normal`、meta/描述 `--text-muted`、弱化 `--text-faint`。**不要**给标题加粗又加大又换色——一层级一个变化。
- **一层级只做一种变化**（[Refactoring UI: Balance weight and contrast](https://refactoringui.com/) + [Ant Design 对比](https://ant.design/docs/spec/contrast-cn)）：区分层级时「大 / 粗 / 色」**三选一**，不要叠用；弱化次要信息（`--text-muted/faint`）优先于强化主要信息。
- **对比要么强烈、要么不做**（[Ant Design 对比原则](https://ant.design/docs/spec/contrast-cn)）：`--text-normal` 与 `--text-faint` 必须拉开明显差距，不能「差一点点」——层级模糊比没有层级更糟。
- **不要在彩色背景上用灰字**（[Refactoring UI](https://refactoringui.com/)）：`--text-muted` 只用于正常背景（`--background-primary/secondary`）上，彩色/强调色底上只用 `--text-on-accent` 或主题定义好的组合。

---

## 4. 布局、间距与圆角

### 4.1 间距（Spacing）

- 基准间距 **4px**，只允许 4 的倍数：`4 / 8 / 12 / 16 / 20 / 24 / 32`。
- **双轨步进**（[Ant Design 8px 网格](https://ant.design/docs/spec/layout-cn) + [Refactoring UI spacing system](https://refactoringui.com/)）：**块级间距取 8 的倍数**（8/16/24/32，布局节奏），**行内微距取 4**（4/8/12，元素内聚）。两者兼容（4 的倍数包含 8），只是「大间距 8 步进、小间距 4 步进」更有韵律。
- 依据：[Material 3 官方 spacing tokens](https://pub.dev/documentation/material_design/latest/material_design/M3Spacings-class.html)（4dp 网格，s4–s128：4/8/12/16/20/24/28/32/36/40/48/56/64/72/80/96/128）。我们只取常用段 `4–32`，与大屏一致性更高；[GitHub Primer primitives](https://github.com/primer/primitives/blob/main/src/tokens/functional/spacing/space.json5) 官方语义档为 `2/4/8/12/16/24`（xxs/xs/sm/md/lg/xl），与我们 `4/8/12/16/24/32` 兼容（2px 仅作表单字段微分隔特例），无需改。
- 常用档位语义：**4**（图标与文字间、chip 内部）、**8**（列表行内、按钮图标距）、**12**（块与块、弹窗内分组）、**16**（弹窗内边距、移动端屏幕边缘）、**24**（确认框内边距）、**32**（大区块分隔）。
- 弹窗内边距：`16–24px`（`padding: 24px` 用于确认框；`16px 24px 10px` 用于头行）。
- 列表项间距：列表内 `8px`，卡片与卡片之间 `8–12px`。
- 组件间、块与块之间：`12–16px`。
- 内容与屏幕边缘（移动端）：`16px` 起步。
- **避免模糊间距**（[Refactoring UI](https://refactoringui.com/)）：两个元素距离要么明显同一组（8px 内），要么明显不同组（16px+），不要用 10/11/13 这种「说不清是一组还是两组」的间距。
- **新布局先宽松后收敛**（[Refactoring UI: Start with too much white space](https://refactoringui.com/)）：先给 24px 起步的留白，视觉 OK 再逐步收敛，不要一开始就挤。

### 4.2 圆角（Radius）

**全域圆角用「层级越大、越圆」的固定阶梯**，写死数值可以，但只许用这几档：

| 档位 | 值 | 用在哪 | M3 对应 |
|---|---|---|---|
| `r-xs` | 4px | 图标按钮、小控件、check 框 | [Extra Small](https://m3.material.io/styles/shape/corner-radius-scale) 4dp |
| `r-sm` | 6–8px | 按钮、菜单项、输入框、列表行 hover、行内 chip | Small 8dp |
| `r-md` | 10–12px | **弹窗/卡片/设置分组**默认 | Medium 12dp |
| `r-lg` | 14–16px | 移动端底部抽屉、大卡片 | Large 16dp |
| `r-full` | 999px / 50% | 胶囊 chip、标签、头像/圆点 | Full |

规则：

- 圆角档位与 [Material 3 corner radius scale](https://m3.material.io/styles/shape/corner-radius-scale) 对齐（4/8/12/16/28dp + full），28dp（Extra Large）我们不用——过度圆角与「高级」相悖，FAB 类超大圆角不适合 Obsidian 插件的信息密度。
- 弹窗一律 `12px`（`.bz-overlay-popup` 已统一）。
- 真全屏（`.bz-win-mfs`）圆角 `0`（已有规则）。
- **同一组件，桌面与移动端圆角一致**，不搞「桌面方、移动端圆」的割裂。
- 圆角大小与阴影大小联动（[Refactoring UI: 阴影与圆角成对](https://refactoringui.com/)）：阴影越大的容器，圆角应该越圆润（我们的三档阴影→圆角 8/10/12px 阶梯天然满足）。

### 4.3 结构

- 主窗口结构（AGENTS.md 已定）：头行 `.bz-win-head`（`padding: 16px 24px 10px`、按钮 22×26/14px、关闭按钮 20×24/12px、非真全屏隐藏关闭钮）——**照抄，不要另写差异**。
- 头行按钮秩序：功能 → ⚙️ → 关闭。
- 弹窗不放大头部的关闭按钮，靠遮罩 + ESC 关闭（已有全局约定）。
- 卡片内容布局优先用 `flex` 或 `grid`，不堆 `position: absolute`。

---

## 5. 边框与阴影（材质）

### 5.1 边框

- 默认**不用边框**表达分隔，优先用间距与背景差。
- **分隔优先级：间距 > 背景差 > 阴影 > 边框**（[Refactoring UI: Use fewer borders](https://refactoringui.com/) + [Ant Design shadow](https://ant.design/docs/spec/shadow-cn)）——边框是区分两个元素的**最后手段**，用多了界面就「忙」。
- 必须分隔时用 `1px solid var(--background-modifier-border)`。
- 分隔线（头行下、卡片间）：`border-bottom: 1px solid var(--background-modifier-border)`，`transparent` 分隔线用于等宽对齐。
- 边框宽度全域统一 `1px`（[shadcn/ui](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css) 同），**不出现 2px 结构性边框**。

### 5.2 阴影（Shadow）

**阴影表达的是「抬升高度」（elevation），不是装饰。** 过度阴影 = 廉价。只许用以下三档，且**颜色只能带透明度的黑**：

| 档位 | 值 | 用在哪 | 对应语义 |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px -2px rgba(0,0,0,0.16), 0 3px 6px 0 rgba(0,0,0,0.12)` | toast、右键菜单、普通卡片 | 抬升 1 级（悬浮于内容之上） |
| `shadow-md` | `0 3px 6px -4px rgba(0,0,0,0.12), 0 6px 16px 0 rgba(0,0,0,0.08), 0 9px 28px 8px rgba(0,0,0,0.05)` | 普通弹窗（`.bz-overlay-popup` 现状可逐步对齐） | 抬升 2-3 级（浮于全局） |
| `shadow-lg` | `0 6px 16px -8px rgba(0,0,0,0.08), 0 9px 28px 0 rgba(0,0,0,0.05), 0 12px 48px 16px rgba(0,0,0,0.03)` | 确认框、重点弹窗 | 抬升 4-5 级（最高优先级） |

**多层阴影写法**（[Ant Design shadow 规范](https://ant.design/docs/spec/shadow-cn)）：每档都是「近处硬影 + 远处软影」叠加，比单层大模糊更柔和、更高级——这是本手册从单层（`0 10px 40px` 式）升级为多层的关键改良。rgba 全部在「带透明度的黑」约束内。

依据：[Material 3 elevation levels](https://m3.material.io/styles/elevation/tokens) 定义 6 级（level 0–5，dp 值 0/1/3/6/8/12）。Web 实现（[material-web `_md-sys-elevation.scss`](https://github.com/material-components/material-web/blob/main/tokens/_md-sys-elevation.scss)）直接用 level 号而非 dp 值——我们同样的思路：**阴影只分档位，不写随机值**。

规则：

- **阴影档位语义化**：菜单/toast 是 level 1，普通弹窗 level 2-3，确认框 level 4-5。同档组件阴影必须一致。**新代码按本表多层写法，旧代码单层不追改**（兼容性冻结）。
- **方向**：常规向下；底部抽屉/工具栏用向上（`0 -6px 16px rgba(0,0,0,0.08)` 量级），侧栏用侧向——与光源方向一致（[Refactoring UI: Emulate a light source](https://refactoringui.com/)）。
- **永远不写** `0 0 0 3px` 式彩色外发光、内发光、立体浮雕、玻璃拟态（`backdrop-filter`）。
- **阴影是深度的补充而非主角**（[Material 3 tonal elevation](https://m3.material.io/styles/elevation/overview)）：M3 主张「层级优先用色调/表面色差表达，阴影只给需要更多聚焦的元素」。我们已有 `--background-secondary`/`--background-modifier-hover` 做色差，阴影三档足够，**不要叠更多阴影**。
- **暗色主题下不依赖阴影**（[shadcn/ui 暗色 token](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css)）：暗色底上阴影几乎不可见，层级靠背景差与边框表达。阴影照常写（亮色主题需要），但设计时不能假设暗色下阴影可见。
- **暗色层级表达（二选一，禁止黑阴影硬扛）**：
  1. **白字光晕**（[GitHub Primer 暗色 shadow 覆盖](https://github.com/primer/primitives/blob/main/src/tokens/functional/shadow/shadow.json5)）：暗色下阴影色改用白色 + 高透明度（如 `rgba(255,255,255,0.08~0.24)`），黑阴影变「光晕」——比黑阴影更贴合暗色背景。
  2. **表面色阶**（[Material 3 tonal surface](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md) 官方暗色色调值）：层级优先用**表面色差**表达，暗色下「层级越高越亮」，阴影只做 1dp 内的点缀。自绘分层容器可参照下表（neutral 色调值，0=黑 100=白；具体颜色以 Obsidian 主题变量为准，本表只定相对次序）：

     | 角色 | 暗色 tone | 说明 |
     |---|---|---|
     | 基准 surface | neutral6 | 最底层 |
     | container-lowest | neutral4 | 最暗（仅最高对比场景） |
     | container-low | neutral10 | 次级容器 |
     | container（默认） | neutral12 | 卡片/弹窗默认 |
     | container-high | neutral17 | 浮起层 |
     | container-highest | neutral22 | 最高层（菜单/浮层） |
     | on-surface | neutral90 | 暗色主文字用 high-tone |
  - 我们已有 `--background-secondary`/`--background-modifier-hover` 做色差，**新 UI 在暗色下默认走方案 2（表面色差）+ 极轻阴影**；亮色下照常走三档阴影。
- **毛玻璃明确不采用**（[Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials/) 推导）：网页拿不到原生 vibrancy；`backdrop-filter` 在 Obsidian 各种主题背景上对比度不可控、暗色插件窗口内会串色降可读性，违反「清晰」原则。层级一律用表面色差 + 阴影表达。
- hover 阴影只允许**轻微加深**，不放大、不位移太多。
- 弹窗阴影与既有 `.bz-overlay-popup` 对齐，新弹窗直接复用类，不另造。

---

## 6. 颜色语义与状态

### 6.1 状态色

| 状态 | 颜色 |
|---|---|
| 成功/完成/已启用 | `--color-green` |
| 失败/删除/危险 | `--text-error` / `--color-red` |
| 警告/进行中 | `--color-orange` |
| 信息/进行中(主色) | `--interactive-accent` |
| 暂停/中性 | `--text-muted` |
| 归档/恢复 | `--color-cyan` / `--color-blue` |

- 语义色**只表达状态**：徽标、进度、状态点、危险文字。不用作普通装饰色。
- **状态不只靠颜色**（[Refactoring UI: Don't rely on color alone](https://refactoringui.com/) + [WCAG 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)）：状态除颜色外必须附**文字或图标**佐证（我们徽标都有文案，天然满足；色点/色条必须配文字）。
- 状态色做底时：`background: <色> 带透明度`（如 `rgba(255,71,87,0.12)` 已有先例），文字用深色语义色；**禁止**大块不透明饱和色背景（刺眼、廉价）。
- 危险操作文字用 `--text-error`，整行/图标/小字同步（参考 `.bz-item-menu-item--danger` 模式）。

### 6.2 强调（Accent）

- 全域只有一个强调色来源：`--interactive-accent`。
- 主按钮：`background: var(--interactive-accent); color: var(--text-on-accent)`，hover 只调 `opacity: 0.88`（**不换色、不加深**，已有先例）。
- 选中态：背景 `--background-modifier-hover`（浅）或 `--interactive-accent`（强），文字 `--interactive-accent`，加 `font-weight: 600`。
- 焦点环：全域统一 `outline: 2px solid var(--interactive-accent); outline-offset: 2px`（core 已有 `:focus-visible` 伞规则，**新 UI 接入即可，别自造**）。

### 6.3 对比度（Contrast）

**「高级」不等于「看不清」。** 文字可读性是底线（[Apple HIG 清晰原则](https://developer.apple.com/design/human-interface-guidelines/) 的第一条）：

- 正文文字与其背景对比度 **≥ 4.5:1**（[WCAG AA](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)），大号文字（≥18pt 或 14pt 粗体）可放宽到 **3:1**。
- Obsidian 主题自身的 `--text-normal/muted/faint` 已满足对比度，**我们不需要自己算**——但有两类自己造的对比度问题要防：
  1. **彩色背景上的文字**：`--interactive-accent` 底上用 `--text-on-accent`（主题保证）；语义色底（`--color-*` 不透明底）上**禁止**放默认色文字——先验算或直接用主题定义好的组合。
  2. **状态色文字叠在状态色底上**：如绿色文字叠在绿色半透明底上（`--color-green` 字 + `rgba(green,0.12)` 底）对比不足——已有先例（memo 的 overdue chip），保持这种「半透明浅底 + 深色字」组合即可，**不要**同色字叠同色不透明底。
- 信息不只靠颜色传达（[WCAG 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)）：状态除了颜色还要有文字/图标/形状佐证（我们的 badge 都有文字，天然满足）。
- `--text-faint` 只用于**非关键信息**（时间戳、占位符、次要 meta），关键操作/错误信息不得用 faint。

### 6.4 交互态（State Layer）

交互反馈的透明度统一（[Material 3 State Layer](https://m3.material.io/styles/state/overview) 官方值）：

| 状态 | 透明度 | 说明 |
|---|---|---|
| hover | 8% | 悬浮态叠加，`background-color: color-mix(in srgb, currentColor 8%, transparent)` 或主题 hover 变量 |
| focus | 10% | 键盘聚焦叠加（与焦点环同时存在） |
| pressed | 10% | 按压态 |
| dragged | 16% | 拖拽/长按拖动态叠加 |
| 禁用-内容 | 38% | 禁用态文字/图标透明度 |
| 禁用-容器 | 12% | 禁用态容器背景透明度 |

- 我们大部分场景用主题变量（`--background-modifier-hover` 等）已满足 hover 语义；**新自绘交互层**（如自定义 ripple、拖拽反馈）按上表取值。
- **控件高度**（[Ant Design controlHeight](https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genControlHeight.ts)）：桌面紧凑 `32px`（按钮/输入框），触屏 `≥44px`（§8.2）。
- 焦点环 `2px`（core 已有 `outline: 2px`，[M3 官方 3dp](https://pub.dev/packages/material_design) 但 Obsidian 2px 更协调，保持现状）。

---

## 7. 动效（Motion）

- 时长：入场 `0.2–0.25s`，离场 `0.2s`，状态变化 `0.15s`。**全域不要超过 0.45s**。
- 缓动：默认 `ease-out`（入场）、`ease-in`（离场）；弹性/回弹只许用既有 `cubic-bezier(0.34, 1.56, 0.64, 1)`（toast bounce 同款），`cubic-bezier(0.32, 0.72, 0.24, 1)`（抽屉）也已有先例。
- 位移/缩放动画：`transform + opacity` 组合，**永不动画** `width/height/top/left`（性能差、抖动）。
- 入场动效：弹窗 `slideUp`（`translate(-50%, -40%) → (-50%, -50%)`，core 已有，复用）、菜单 `scale 0.96 + translateY 2px`、抽屉 `translateY(100%) → 0`。
- **`prefers-reduced-motion: reduce` 必须降级**（core 已有 toast 降级先例，新动效照做）：装饰动画归零，功能性动画（进度转圈）保留。
- 状态反馈要「即时」：hover 背景变化 `transition: background-color 0.15s ease`，不做花哨。
- **反馈时机规则**（[微信小程序设计指南](https://developers.weixin.qq.com/miniprogram/design/)）：
  - 错误提示**必须常驻或可关闭**，不得一闪而过（用户需要时间读错误原因）。
  - 成功提示可轻量 1.5s 自动消失（不打断流程）。
  - **一页最多一个加载动画**（弹窗内统一一个 spinner，不做多动画叠加）。

---

## 8. 桌面端与移动端（一稿两用）

### 8.1 断点

- **全域只用 `@media (max-width: 768px)` 一个断点**（已有规则，废止 480/640 乱断点）。
- 桌面：卡式弹窗、居中；右键菜单（跟手 `.bz-item-menu`）。
- 移动端：真全屏（`.bz-win-mfs`）、底部抽屉（长按 `.bz-item-sheet`）、安全区适配。

### 8.2 移动端硬规则

- 真全屏：`.bz-win-mfs` 全覆盖视口、圆角 0、去动画；首子元素避让顶部安全区 `padding-top: max(34px, env(safe-area-inset-top))`（core 已有）。
- 底部安全区：一切贴底元素 `padding-bottom: max(<间距>, env(safe-area-inset-bottom, 0px))`。
- 点按目标：**移动端可点元素目标 ≥44×44 CSS px**（[微信适老化指南](https://developers.weixin.qq.com/miniprogram/design/elderly.html) 44pt + [WCAG 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) AAA + [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) 44pt，多方共识），**绝对下限 ≥40px**。视觉尺寸不足时**用 `::after` 伪元素扩展热区**（[shadcn/ui `extend-touch-target`](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css)：`@media (pointer: coarse)` 下 `::after` 外扩 12px，视觉不变、热区变大——比撑 padding 更干净）：
  ```css
  @media (pointer: coarse) {
    .bz-touch-target { position: relative; }
    .bz-touch-target::after { content: ""; position: absolute; inset: -12px; }
  }
  ```
- 相邻可点元素间距 **≥8px**（[WCAG 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) 间距豁免 + 微信 2A 规则）——密集图标按钮行（如头行 22×26 图标钮）靠间距防误触。
- 正文内联链接豁免（不适用 44px）。
- 两行式设置行：`.bz-setting-split` 已有（名称/描述上、控件下）。
- 内容宽度：移动端弹窗 `width: calc(100vw - 32px)`（即两侧各 16px）。
- **不要在移动端隐藏功能**来「简化」——要两端一致，用布局适配而非删功能。

### 8.3 空态（Empty State）

空态是「高级感」最容易翻车的地方（[Refactoring UI: Don't overlook empty states](https://refactoringui.com/)）——空列表不是「什么都没有」，而是「第一次使用的引导」。20 个域都有空态：

- 空态必须有：**友好的一句话**（说明这里装什么）+ **一个动作**（去添加/去导入），不能只有一行灰字「暂无数据」。
- 视觉：图标（lucide，`--text-faint`）+ 标题（`--text-muted`，`body` 字号）+ 描述（`--text-faint`，`meta` 字号），居中排布，`padding: 40px` 上下。
- 禁止：把空态做成报错感（红字/感叹号）、或贴一张占位大图。
- 已有先例：`.bz-todo-empty`、`.bz-encrypt-empty`（`padding: 40px; text-align: center; color: var(--text-faint)`）——新空态照此风格。

---

## 9. 组件速查（写 UI 时先来这里认领）

> 已有组件一律复用，禁止新造风格重复轮子。标注「core 已有」的类直接抄结构 + 类名。

| 组件 | 类名/位置 | 要点 |
|---|---|---|
| 主窗口 | `.bz-win-head` + `.bz-win-close`（core） | 头行规范照抄，勿另写 |
| 通用遮罩/弹窗 | `.bz-overlay-mask` / `.bz-overlay-popup`（core） | 12px 圆角、shadow-md、80vh 限高 |
| 图标按钮 | `.bz-icon-btn`（core） | 22×26/14px、hover 背景、无边框 |
| 确认框 | `#__shared_confirm_*`（core/flow-dialog） | shadow-lg、24px 内边距、居中；**慎重决策场景按钮保持中性**（[Ant Design 对比原则](https://ant.design/docs/spec/contrast-cn)）——删除确认不默认高亮「删除」，确认/取消都是中性次级样式，危险文字才用 `--text-error` |
| 通知 toast | `.bz-notice*`（core） | 10px 圆角、shadow-sm、顶右/移动端顶中；错误常驻/可关，成功 1.5s |
| 右键菜单 | `.bz-item-menu`（core） | shadow-sm、8px 圆角、无底色项 |
| 底部抽屉 | `.bz-item-sheet*`（core） | 14px 顶圆角、shadow-lg、安全区、向上阴影 |
| 设置分组卡 | `.bz-settings-group*`（core） | 12px 圆角、secondary 底、12px 间距 |
| 路径选择器 | `.bz-path-picker*`（core） | 弹窗卡、8px 行、chips 胶囊 |
| 模型选择器 | `.bz-model-picker-*`（core） | 6px 行、当前值高亮 |
| 列表卡片 | `.bz-item-card`（core）+ 各域 | hover 仅背景变化；桌面右键、触屏长按 |
| 标签/胶囊 | `border-radius: 999px` + `--background-modifier-hover` 底 | 12px 字号，徽标 11px |
| 主按钮 | 各域 `.bz-*-btn--primary` | accent 底 + `--text-on-accent`，hover opacity 0.88 |
| 次级按钮 | 各域 `.bz-*-btn`（ghost/slim） | secondary 底 + 边框，12–13px |
| 搜索框 | `.bz-path-picker-search` 样式（core） | 8px 圆角、focus 变 accent 边框 |
| 空态 | `.bz-*-empty`（各域，参考 `.bz-todo-empty`） | 图标（faint）+ 说明（muted）+ 动作；`padding: 40px` 居中 |

**写新 UI 的固定路径**：查本表 → 没有 → 在 `src/core/styles.css` 加共享类（跨域通用）或在 `src/<域>/styles.css` 加域类（`bz-` 前缀）→ 类名 `bz-` 前缀 → 用本手册变量/圆角/阴影/动效 → 两端自检（§8）。

---

## 10. AI 自检清单（改动 UI 后逐条过）

- [ ] 没有写死颜色值？全部来自 §2 变量表
- [ ] 界面是「灰阶为主、颜色只表达状态/强调」？（Refactoring UI：start with gray）
- [ ] 没有纯黑配纯白、没有灰色文字压在彩色背景上
- [ ] 对比度：正文 ≥4.5:1；彩色底上没有放默认色文字；状态不只靠颜色表达
- [ ] 字号/字重/行高符合 §3 阶梯
- [ ] 间距是 4 的倍数且语义清晰（没有 10/11/13 这种模糊间距）；块级 8 步进、行内 4 步进
- [ ] 圆角是 §4.2 档位之一（4/6-8/10-12/14-16/999）
- [ ] 弹窗/卡片圆角 12px（或真全屏 0）
- [ ] 阴影是 §5.2 三档之一，且是透明黑；多层写法（硬影+软影）；阴影档位语义与组件匹配
- [ ] 没有彩色发光、玻璃拟态、立体浮雕
- [ ] 语义色只表达状态，且附文字/图标佐证（不只靠颜色）
- [ ] 主按钮 hover 只调 opacity；选中态规范用 accent
- [ ] 慎重决策场景（删除确认等）按钮保持中性，不默认高亮危险项
- [ ] 动效 ≤0.45s、transform+opacity、有 reduced-motion 降级；错误提示常驻、一页一加载动画
- [ ] 移动端 768 断点；真全屏/抽屉/安全区已适配；触控热区 ≥44px（下限 40px）、间距 ≥8px
- [ ] 复用了 §9 既有组件类，没有新造风格
- [ ] 焦点环走 core 伞规则，没自造
- [ ] 没有内联 `<style>` / 内联视觉样式（铁律 8）
- [ ] 这个元素真的有必要存在吗？（Refactoring UI：能删就删）

---

## 11. 参考来源（本手册依据的权威规范）

本手册的取值不是拍脑袋定的，依据如下（AI 写 UI 时若有疑问，回查这些来源；若权威规范更新，同步修订本手册）：

| 主题 | 来源 | 我们采纳了什么 |
|---|---|---|
| 设计原则 | [Apple HIG - Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) | 清晰/遵从/深度三原则 → §1 |
| 实战设计 | [Refactoring UI](https://refactoringui.com/) | 少边框、层级第一、弱化即强调、留白起步、灰阶起步、阴影表层级、状态不只靠颜色 → §1/2/3/4/5/6 |
| 间距 | [Material 3 Spacing tokens](https://pub.dev/documentation/material_design/latest/material_design/M3Spacings-class.html) | 4dp 网格、间距语义 → §4.1 |
| 间距（双轨） | [Ant Design Layout](https://ant.design/docs/spec/layout-cn) | 8px 网格、块级 8 步进/行内 4 步进 → §4.1 |
| 圆角 | [Material 3 Corner radius scale](https://m3.material.io/styles/shape/corner-radius-scale) | 4/8/12/16/28dp + full 档位 → §4.2 |
| 阴影/层级 | [Material 3 Elevation](https://m3.material.io/styles/elevation/overview)、[Elevation tokens](https://m3.material.io/styles/elevation/tokens) | level 0-5 分层、阴影表达抬升 → §5.2 |
| 阴影（多层） | [Ant Design Shadow](https://ant.design/docs/spec/shadow-cn) | 多层叠加写法（硬影+软影）→ §5.2 |
| 对比度 | [WCAG 1.4.3 Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)、[WCAG 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) | 正文 ≥4.5:1、状态不只靠颜色 → §6.3 |
| 触控目标 | [WCAG 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)、[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)、[微信适老化](https://developers.weixin.qq.com/miniprogram/design/elderly.html)、[Apple](https://developer.apple.com/design/human-interface-guidelines/) | ≥44px 目标/40px 下限、::after 扩热区、间距 ≥8px → §8.2 |
| 反馈时机 | [微信小程序设计指南](https://developers.weixin.qq.com/miniprogram/design/) | 错误常驻、成功 1.5s、一页一加载动画 → §7 |
| Token 体系 | [shadcn/ui globals.css](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css)、[GitHub Primer](https://primer.style/product/primitives/)、[Material token](https://github.com/material-components/material-web/blob/main/tokens/_md-sys-color.scss) | 成对语义命名、base/functional/component 三层、base-8 间距、暗色不依赖阴影 → §2/4.1/5.2 |
| 暗色阴影/表面 | [Primer shadow.json5](https://github.com/primer/primitives/blob/main/src/tokens/functional/shadow/shadow.json5)、[Material tonal surface](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md) | 暗色白字光晕或表面色阶、暗色层级越高越亮 → §5.2 |
| 交互态 | [Material 3 State Layer](https://m3.material.io/styles/state/overview)、[Ant controlHeight](https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genControlHeight.ts) | hover 8%/focus 10%、禁用 38%/12%、控件高 32/44px → §6.4 |
| 毛玻璃禁用 | [Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials/) | 网页无原生 vibrancy、backdrop-filter 不可控 → §5.2 |
| 空态 | [Refactoring UI](https://refactoringui.com/) | 空态要有引导与动作 → §8.3 |

---

## 12. 手册本身的维护规则

- **手册是「默认值」的权威**，但**已存在的样式以代码为准**（兼容性冻结：既有样式不动，新样式向手册靠拢）。
- 发现手册与代码冲突时：先 `grep` 确认既有现状 → 新代码以手册为准 → 把冲突点补进手册（本手册「现状」一栏跟着代码走）。
- 新增一种规范（新圆角档、新动效、新组件类）时：**先改手册，再写代码**（Spec 驱动）。
- 保持简短：能一句话说清的不写三段；能查代码的不写进手册。
- 调研支撑材料：`docs/ui-research-practical-guides.md`（网上权威规范调研的完整记录与来源：一~五章为实战派 Refactoring UI/shadcn/Ant/微信/无障碍，六章为权威设计系统 M3/Apple HIG/Primer/Ant 官方源码）——手册 §11 是它的浓缩，两者不同步时**以手册为准**，调研材料只作追溯用。
