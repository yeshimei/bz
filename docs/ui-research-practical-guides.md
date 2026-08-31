# 实战派 UI 设计手册调研报告（Refactoring UI / shadcn / Ant Design / 微信 / 无障碍）

> 用途：为 `docs/ui-design-manual.md`（bz 包仔插件 UI 设计手册）改良提供可执行的规则来源。
> 每条规则给出【规则内容】+【来源】+【对 bz 插件 UI 是否适用及理由】。
> 调研日期：2026-02。所有抓取均为一手来源（官方站 / 官方仓库源文件 / W3C 规范页）；因部分站点为 JS 渲染无法直取正文，个别条目以官方仓库源码或同源规范页佐证。

---

## 一、Refactoring UI（refactoringui.com，Adam Wathan & Steve Schoger）

来源主站：[https://refactoringui.com/](https://refactoringui.com/)（首页含完整目录 + "Use fewer borders" 战术示例）

### 1.1 少用边框（Use fewer borders）
- 【规则内容】边框是区分元素的手段，但**用太多边框会让界面显得拥挤杂乱**。区分元素优先用：box shadow、背景色对比、或**增加元素间距**，而不是加边框。
- 【来源】https://refactoringui.com/（首页内嵌的免费战术示例，原文："Use fewer borders. …Instead, try adding a box shadow, using contrasting background colors, or simply adding more space between elements."）
- 【对 bz 适用】✅ 高度适用。bz 手册 §5.1 已写「默认不用边框表达分隔，优先用间距与背景差」——这条正是 Refactoring UI 的原话，可作为手册该条的引用背书。可执行化：分隔优先 `间距 > 背景差 > 阴影 > 边框`，边框只用于必须的结构分界（`1px solid var(--background-modifier-border)`）。

### 1.2 视觉层级：不是所有元素都平等（Hierarchy is Everything）
- 【规则内容】目录第 2 章「Hierarchy is Everything」核心条目：
  - **Not all elements are equal**（元素不都平等：通过字号/字重/颜色建立层级）
  - **Size isn't everything**（大小不是唯一手段：颜色/间距/字重也能分层）
  - **Don't use grey text on colored backgrounds**（不要在彩色背景上用灰字——对比度不足）
  - **De-emphasize to emphasize**（弱化来突出：突出 = 弱化其余，而非都做强）
  - **Labels are a last resort**（标签是最后手段：能用布局/语境表达就不加标签）
  - **Balance weight and contrast**（字重与对比要平衡：不要又加粗又放大又换色）
- 【来源】https://refactoringui.com/（首页完整目录第 2 章）
- 【对 bz 适用】✅ 高度适用。bz 手册 §3「层级三色原则」和「不要给标题加粗又加大又换色——一层级一个变化」正是 "Balance weight and contrast" + "De-emphasize to emphasize" 的中文转写。可执行化：一个层级只允许**一个维度**的变化（大 或 粗 或 色，三选一）；弱化次要信息优先于强化主要信息。

### 1.3 从灰色开始、颜色克制（Working with Color 章节）
- 【规则内容】第 5 章「Working with Color」目录条目：
  - **Ditch hex for HSL**（用 HSL 代替 hex，方便调明度/饱和度）
  - **You need more colors than you think**（颜色比你想象的多：单一主色不够，需色阶）
  - **Define your shades up front**（事先定义色阶/明度档位，不要临时取色）
  - **Don't let lightness kill your saturation**（提明度时别把饱和度也拉没——灰要带色相）
  - **Greys don't have to be grey**（灰不必是纯灰：带一点点色相的灰更高级）
  - **Accessible doesn't have to mean ugly**（无障碍不等于丑：对比度够也能好看）
  - **Don't rely on color alone**（不要只靠颜色传达信息——需辅以形状/文字/图标）
- 【来源】https://refactoringui.com/（首页完整目录第 5 章）
- 【对 bz 适用】✅ 高度适用，其中两条可直接落地：
  - "Define your shades up front" → bz 手册 §6 的状态色表就是「事先定义」的雏形，可补充「每种语义色固定一套明度档位（底/文字/图标）」。
  - "Don't rely on color alone" → bz 手册 §6 语义色「只表达状态」可加一条：**状态除颜色外必须附文字或图标**（如徽标文案、✓/! 图标），不能只靠色点区分。
  - "start with gray, add color sparingly" 是社区对本书配色哲学的浓缩（书内对应 "De-emphasize" + "Define your shades up front"）：bz 手册 §2 强制用 Obsidian 主题变量、禁止硬编码彩色，本质一致——**默认灰阶（`--text-normal/muted/faint` + 主题变量），彩色只留给状态与主按钮**。

### 1.4 布局与留白（Layout and Spacing 章节）
- 【规则内容】第 3 章目录条目：
  - **Start with too much white space**（先从「过多」的留白开始，再往回收）
  - **Establish a spacing and sizing system**（建立间距/尺寸系统——4/8/12 等固定阶梯）
  - **You don't have to fill the whole screen**（不必填满整个屏幕）
  - **Avoid ambiguous spacing**（避免含糊的间距：间距要有语义，组内小、组间大）
- 【来源】https://refactoringui.com/（首页完整目录第 3 章）
- 【对 bz 适用】✅ 高度适用。bz 手册 §4.1 已实现「间距系统」（4 的倍数阶梯），与 "Establish a spacing and sizing system" 一致；可补两条可执行规则：①新布局先给 24px 起步的宽松留白再收敛；②间距必须有语义（同组 8px、异组 16px、区块 24px，不出现「看起来一样近」的两组元素）。

### 1.5 字号阶梯（Designing Text 章节）
- 【规则内容】第 4 章目录条目：
  - **Establish a type scale**（建立字号阶梯，不要随意用任意字号）
  - **Keep your line length in check**（控制行长，约 45–75 字符）
  - **Line-height is proportional**（行高与字号成比例）
  - **Not every link needs a color**（不是每个链接都要上色：可用字重/下划线区分）
- 【来源】https://refactoringui.com/（首页完整目录第 4 章）
- 【对 bz 适用】✅ 高度适用。bz 手册 §3 已有完整字号阶梯（caption 11–12 / meta 12–13 / body 14 / emphasis 15–16 / title 17–18 / display 20+），与 "Establish a type scale" 完全对应，可直接引用为背书。可补：行高比例规则（正文 1.5、紧凑 1.4、标题 ≤1.3）已存在，无需改。

### 1.6 阴影创造深度（Creating Depth 章节）
- 【规则内容】第 6 章目录条目：
  - **Emulate a light source**（模拟固定光源方向——阴影方向一致）
  - **Use shadows to convey elevation**（用阴影表达层级高度，层级越高阴影越大越柔和）
  - **Shadows can have two parts**（阴影可有两层：近距离硬影 + 远距离软影）
- 【来源】https://refactoringui.com/（首页完整目录第 6 章）
- 【对 bz 适用】✅ 适用。bz 手册 §5.2 三档阴影（sm/md/lg）正是 "elevation" 的表达；「两层阴影」与 Ant Design 的「三层阴影」思路一致（见 §3.4），可为 bz 的 `shadow-md/lg` 提供「拆两层」的增强选项，但保持透明黑约束不变。

---

## 二、shadcn/ui（ui.shadcn.com/docs/theming）

来源：官方文档页 [https://ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming)（JS 渲染，正文以官方仓库源码佐证）+ 官方仓库 token 定义源文件 [apps/v4/app/globals.css](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css)

### 2.1 语义化 token 命名体系（CSS variables）
- 【规则内容】shadcn 用**语义化 CSS 变量**组织主题，命名模式为「角色 + 前景」：
  - 基础组：`--background` / `--foreground`（页面底 + 页面主文字）
  - 容器组：`--card` / `--card-foreground`、`--popover` / `--popover-foreground`
  - 强调组：`--primary` / `--primary-foreground`、`--secondary` / `--secondary-foreground`、`--accent` / `--accent-foreground`、`--destructive` / `--destructive-foreground`
  - 弱化组：`--muted` / `--muted-foreground`
  - 结构组：`--border`、`--input`、`--ring`（焦点环）
  - 扩展组：`--chart-1..5`（图表序列）、`--sidebar*`（侧栏）、`--surface`、`--code*`、`--selection`
  - 圆角：`--radius` 单一基准值，派生 `--radius-sm/md/lg/xl` 用 `calc(var(--radius) * 0.6/0.8/1/1.4…)`
- 【来源】https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css（`@theme inline` 块 + `:root`/`.dark` 块）
- 【对 bz 适用】✅ 高度适用（命名法可借鉴）。bz 手册 §2 已有 Obsidian 变量映射表，但可吸收 shadcn 的**「X / X-foreground」成对命名**思路：为 bz 新增自绘组件（如自绘 toast、确认框）时，统一用 `--bz-<角色>` + `--bz-<角色>-foreground` 的成对语义，而不是散落 `color`/`text-color`。`--radius` 单基准 + 派生档位的做法，与 bz 手册 §4.2 圆角阶梯（r-xs 4px / r-sm 6–8 / r-md 10–12 / r-lg 14–16 / r-full）等价——bz 已是「阶梯表」，可保持，不必引入 calc 派生。

### 2.2 圆角默认值（radius）
- 【规则内容】shadcn v4 当前默认 `--radius: 0.625rem`（= 10px，对应 `rounded-lg` 基准档）；派生：`--radius-sm = 0.375rem`(6px)、`--radius-md = 0.5rem`(8px)、`--radius-lg = 0.625rem`(10px)、`--radius-xl = 0.875rem`(14px)。（早期版本默认 `--radius: 0.5rem` = 8px，社区常引「0.5rem」即此。）
- 【来源】https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css（`:root { --radius: 0.625rem; … }`）
- 【对 bz 适用】✅ 参照价值。bz 手册圆角阶梯（弹窗 12px、按钮 6–8px、抽屉 14px）落在 shadcn 的 6–14px 区间内，方向一致；差异点是 bz 弹窗用 12px 而非 10px，这是 Obsidian 生态的既有风格（`.bz-overlay-popup` 已定），**不改**——但可作为手册注释：12px 属「略大于 shadcn 基准」的观感档，说明 bz 弹窗偏柔和。不需要跟随 shadcn 数值，仅验证当前取值合理。

### 2.3 边框与输入控件样式
- 【规则内容】shadcn 的 `--border` 与 `--input` 分离：border 用于组件结构边（默认 `oklch(0.922 0 0)` ≈ 浅灰），input 用于表单控件边（暗色主题下 input 更亮：`oklch(1 0 0 / 15%)` vs border `oklch(1 0 0 / 10%)`）；边框宽度统一 1px。焦点用 `--ring` + `outline`。
- 【来源】https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css（`:root`/`.dark` 块中 `--border` 与 `--input` 值对比）
- 【对 bz 适用】⚠️ 部分适用。bz 手册 §2 把「输入框边框」也归到 `--background-modifier-border`，Obsidian 主题本身没有 `--input` 分离变量；若要在输入框上做「更亮一点的边」，可参考 shadcn 思路在 `src/core/styles.css` 定义 `--bz-input-border: color-mix(in oklab, var(--background-modifier-border) 85%, var(--text-normal))` 之类的派生，但**需先确认 Obsidian 有 `color-mix` 兼容性**（Electron 现代版支持）。当前手册以 `--background-modifier-border` 统一即可，不强制拆。

### 2.4 阴影与暗色主题的「透明度黑」约束
- 【规则内容】shadcn 暗色主题的边框/输入框用「白色 + 低透明度」（`oklch(1 0 0 / 10%)`）而非纯黑透明——因为暗色底上黑阴影不可见，改用白色透明度来「提亮边界」。这与 bz 手册「阴影只能带透明度的黑」在**明暗主题下应区分**：暗色主题阴影几乎不可见，层级更多靠背景差与边框。
- 【来源】https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css（`.dark` 块 `--border: oklch(1 0 0 / 10%)`）
- 【对 bz 适用】✅ 适用，是一条**可执行的补充规则**：bz 手册 §5 目前只写「阴影颜色只能带透明度的黑」，可补一句——**暗色主题下阴影降级为背景差/边框表达层级**（阴影照常写，但设计时不依赖阴影在暗色下的可见性）。不引入白色阴影（保持 bz 的克制约束），只在手册里注明暗色下不依赖阴影。

### 2.5 触控目标扩展（coarse pointer）
- 【规则内容】shadcn v4 提供了 `.extend-touch-target` 工具类：`@media (pointer: coarse) { … after:absolute after:-inset-2 … }`——即在**粗指针（触屏）设备上给可点元素外扩 8px 热区**，用伪元素实现，不改视觉尺寸。
- 【来源】https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css（`.extend-touch-target` 工具类定义）
- 【对 bz 适用】✅ 高度适用且可执行。bz 手册 §8.2 已有「点按目标最小 40×40px，不足则 padding 撑大」，可补充 shadcn 的**伪元素外扩**技巧：视觉 22×26 的小图标按钮，在 `@media (pointer: coarse)` 下用 `::after` 扩出 8px 热区（`-inset-2`），既满足 40px 又不破坏视觉比例。这比「撑 padding」更干净，建议写进手册 §8.2 作为标准做法。

---

## 三、中文设计规范（Ant Design + 微信）

### 3.1 Ant Design 设计价值观（自然 / 确定性 / 意义感 / 生长性）
- 【规则内容】Ant Design 四大价值观：
  - **自然**：感知自然（约 80% 信息走视觉，布局/色彩/图标应顺应自然规律降低认知成本）；行为自然（场景化组织功能、主动服务）。
  - **确定性**：设计者确定（保持克制——「能做，但想清楚了不做」；面向对象抽象设计规律；模块化设计封装可复用组件）；用户确定（跨产品/终端一致的外观交互，提升易学性）。
  - **意义感**：结果的意义（明确目标、即时反馈）；过程的意义（挑战适中、如无必要勿增实体，让用户专注任务）。
  - **生长性**：价值连接（功能价值与用户需求的连接）；人机共生（系统与用户共同成长）。
- 【来源】https://ant.design/docs/spec/introduce-cn（官方中文规范，正文取自官方仓库 [docs/spec/values.zh-CN.md](https://github.com/ant-design/ant-design/blob/master/docs/spec/values.zh-CN.md)）
- 【对 bz 适用】✅ 价值观层面适用（指导性，非数值）。对 bz 最有用的一条是「**保持克制：能做，但想清楚了不做**」——与 bz 手册 §1「简约：能删就删」完全同构；「模块化设计」与 bz 手册 §9「已有组件一律复用，禁止新造风格重复轮子」同构。可作为手册 §1 设计方向的官方背书引用。其余（自然/生长性）偏理念，不产生可执行数值，不写入手册。

### 3.2 Ant Design 布局与间距（8px 网格、24 栅格、8 倍数模度）
- 【规则内容】布局五要素：
  - 统一画板：1440（中后台默认设计稿宽度）。
  - 网格单位：**基数为 8**（偶数思维，匹配主流显示设备）。
  - 栅格：**24 栅格体系**，Column 随宽度伸缩，Gutter 固定不变。
  - 常用模度：一组保持 **8 倍数**的间距数组（8/16/24/32/40…），用于 UI 布局空间决策，保证韵律感与一致性。
  - 适配：左右布局（侧栏固定、内容缩放）与上下布局（留白最小化后内容缩放）。
- 【来源】https://ant.design/docs/spec/layout-cn（官方中文规范，正文取自官方仓库 [docs/spec/layout.zh-CN.md](https://github.com/ant-design/ant-design/blob/master/docs/spec/layout.zh-CN.md)）
- 【对 bz 适用】✅ 高度适用，可执行：
  - **8 的倍数**与 bz 手册 §4.1 的「4 的倍数」兼容（4 的倍数包含 8 的倍数）。可补充：**块级间距优先取 8 的倍数**（8/16/24/32），行内微距用 4（4/8/12）——形成「大间距 8 步进、小间距 4 步进」的双轨，比单一 4 步进更有韵律。
  - 24 栅格对 bz 的弹窗/卡片内部布局可参考：卡片内两列内容按 24 栅格分配（如 16:8、12:12），避免手写百分比。
  - Gutter 固定、Column 伸缩的思路 → bz 移动端 `width: calc(100vw - 32px)` 已是「固定留白 + 内容伸缩」，同构，可作为背书。

### 3.3 Ant Design 对比原则（对比要强烈、弱化次要）
- 【规则内容】「对比是增加视觉效果最有效方法之一」；**「要实现有效的对比，对比就必须强烈，切不可畏畏缩缩」**；突出方式不局限于强化重点项，**也可以是弱化其他项**（De-emphasize）；需要用户慎重决策的场景系统保持中立（不诱导）；总分关系靠排版/字体/大小突出层次；状态关系靠颜色/辅助形状。
- 【来源】https://ant.design/docs/spec/contrast-cn（官方中文规范，正文取自官方仓库 [docs/spec/contrast.zh-CN.md](https://github.com/ant-design/ant-design/blob/master/docs/spec/contrast.zh-CN.md)）
- 【对 bz 适用】✅ 高度适用。可落地两条：①对比要么不做要么做足——bz 手册 §3 的「层级三色」要求 muted/faint 与 normal 拉开明显差距，不能「差一点点」；②**慎重决策场景主次按钮都要中性**——bz 的确认框（如删除确认）不应默认高亮「删除」，这与 bz 现有确认框「功能 → ⚙️ → 关闭」的克制秩序一致，可写进手册确认框规范。

### 3.4 Ant Design 阴影（三层阴影、精确 rgba 值）
- 【规则内容】Ant Design 阴影规范：
  - 高度四层：0 层（贴地，无阴影，如输入框）→ 1 层（悬浮/hover，如卡片 hover）→ 2 层（展开跟随，如下拉面板）→ 3 层（高层级，如对话框）。
  - **三层阴影叠加**表达（更柔和真实），每层 3 个 rgba 值。以 @shadow-1-down（1 层向下）为例：
    - `0px 1px 2px -2px rgba(0,0,0,0.16)` + `0px 3px 6px 0px rgba(0,0,0,0.12)` + `0px 5px 12px 4px rgba(0,0,0,0.09)`
  - 2 层：`0 3px 6px -4px rgba(0,0,0,0.12)` + `0 6px 16px 0 rgba(0,0,0,0.08)` + `0 9px 28px 8px rgba(0,0,0,0.05)`
  - 3 层：`0 6px 16px -8px rgba(0,0,0,0.08)` + `0 9px 28px 0 rgba(0,0,0,0.05)` + `0 12px 48px 16px rgba(0,0,0,0.03)`
  - 方向：向下（常规）、向上（底部导航/工具栏）、左/右（导航栏/抽屉）。
- 【来源】https://ant.design/docs/spec/shadow-cn（官方中文规范，正文取自官方仓库 [docs/spec/shadow.zh-CN.md](https://github.com/ant-design/ant-design/blob/master/docs/spec/shadow.zh-CN.md)）
- 【对 bz 适用】✅ 高度适用，这是最「可执行」的一条。bz 手册 §5.2 三档阴影（sm/md/lg）可升级为**两层阴影**写法（近距离硬影 + 远距离软影），rgba 值可直接采用 Ant 的数值（都在「带透明度的黑」约束内）：
  - `shadow-sm` → `0 1px 2px -2px rgba(0,0,0,0.16), 0 3px 6px 0 rgba(0,0,0,0.12)`（合并 Ant 1 层前两行）
  - `shadow-md` → 取 Ant 2 层（`0 3px 6px -4px …0.12, 0 6px 16px 0 …0.08, 0 9px 28px 8px …0.05`）
  - `shadow-lg` → 取 Ant 3 层（`0 6px 16px -8px …0.08, 0 9px 28px 0 …0.05, 0 12px 48px 16px …0.03`）
  - 与 bz 现值（`0 10px 40px rgba(0,0,0,0.2)` 等）相比，Ant 的**多层叠加更柔和、更高级**，且模糊半径更大、透明度更低——符合 bz「高级感」方向。建议手册 §5.2 改为多层写法（保留透明黑约束与三档语义）。
  - 方向规则可补：底部抽屉用「向上」阴影（如 `0 -6px 16px rgba(0,0,0,0.08)`），侧栏用侧向。

### 3.5 微信小程序设计指南（移动端原则 + 热区）
- 【规则内容】核心原则：
  - **重点突出**：每页明确一个重点，避免无关干扰元素。
  - **导航明确，来去自如**：次级页面左上角提供返回；页面内导航尽量简单；Tab 标签数量 2–5 个（建议 ≤4），一页最多一组 Tab 栏。
  - **反馈及时**：加载要有动画；**不在同一页同时用超过 1 个加载动画**；模态加载谨慎使用；轻量成功提示 1.5 秒自动消失（不打断流程），**错误提示不适用一闪而过的提示**。
  - **减少输入**：让用户做选择而不是键盘输入（搜索历史、选项控件）。
  - **避免误操作**：触屏点击热区应充分——「换算成物理尺寸后大致在 **7mm–9mm** 之间」。
  - **统一稳定**：不同页面用一致控件与交互。
  - 视觉规范：常用字号 **22/17/15/14/12(pt)**；设计稿基准宽度 **375px 与 390px**。
- 【来源】https://developers.weixin.qq.com/miniprogram/design/（微信官方小程序设计指南）
- 【对 bz 适用】✅ 高度适用（移动端）。可落地：
  - 「热区 7–9mm」与 bz 手册 §8.2「最小 40×40px」互相印证（40px 在主流手机上约 10.5mm，偏大，是安全值；7–9mm 是舒适下限）——手册可注明 40px ≥ 微信 7–9mm 建议，无需下调。
  - 「错误提示不用一闪而过 toast」→ bz 通知规范可加：错误必须常驻或可关闭，不能 1.5s 消失；成功可轻量 1.5s。
  - 「一页最多一个加载动画」→ bz 弹窗内加载状态统一一个 spinner，不做多动画叠加。
  - 「减少输入、做选择」→ bz 的路径选择器/模型选择器已是「选择而非输入」的实现，符合微信原则，可作背书。

### 3.6 微信小程序适老化设计指南（热区硬数值、对比度）
- 【规则内容】（比 3.5 更硬的可执行数值）：
  - **热区规则**：①交互元素周围加 **12pt 反馈热区**（图标、图标+文字链接、图片）；②图标与文字同指一个结果时用**完整连续热区**；③**≥44pt 且有清晰边界的元素不必再加热区**（如大按钮、大头像）；④交互元素在容器内时热区不超过容器；⑤元素间视觉距离至少 **2A**（A 为热区半径），拥挤时优先保证无边界元素的热区；⑥小尺寸元素热区可扩展出容器甚至覆盖其他元素，**保证最少 40×40pt 热区**。
  - **对比度**：「文本/文本图像呈现方式、图标等元素间的对比度至少为 **4.5:1**（字号大于 **18 dp/pt** 时文本及文本图像对比度至少为 **3:1**）」。
  - 适老化模式：字体/图形/按钮等比放大 1.4 倍，元素间距与导航栏固定尺寸。
- 【来源】https://developers.weixin.qq.com/miniprogram/design/elderly.html（微信官方适老化设计指南）
- 【对 bz 适用】✅ 高度适用，全是最可执行的硬数值：
  - **44pt 热区**（微信适老化 ≥44pt 免加热区）与 Apple HIG 44×44pt 一致（见 §4.3），是移动端点按目标的「推荐值」；bz 手册 §8.2 的「最小 40×40px」可升级为「**移动端可点元素目标 ≥44px，视觉不足 44px 时用 12px 扩展热区补齐**」——直接采用微信 12pt 扩展热区与 44pt 目标的组合。
  - 40×40pt 作为「小元素最后底线」与 bz 现有 40px 下限吻合，可保留为绝对下限。
  - 「元素间视觉距离至少 2A」→ 移动端可点元素之间最小间距 ≥8px（热区半径 4–6px 的 2 倍量级），可写进 §8.2 防误触。
  - 对比度 4.5:1/3:1 与 WCAG 完全一致（见 §4.1），微信官方背书，bz 手册 §6 状态色可用此校验。

### 3.7 微信 WeUI（补充参考）
- 【规则内容】WeUI 是微信官方 Web 控件库（sketch/psd 控件库 + weui.io 在线预览），控件已充分考虑移动端可用性，微信建议「使用或模仿标准控件尺寸进行设计」。
- 【来源】https://developers.weixin.qq.com/miniprogram/design/（文末资源下载区：WeUI sketch/psd 控件库，预览 https://weui.io）
- 【对 bz 适用】⚠️ 参考价值：bz 不依赖 WeUI 控件库，但其「标准控件统一尺寸」思路与 bz 手册 §9「组件速查表」一致——同一控件全局只有一个尺寸/样式，可作背书。

---

## 四、无障碍与细节

### 4.1 WCAG 1.4.3 对比度（4.5:1 / 3:1）
- 【规则内容】（WCAG 2.2 AA）：
  - **正文文本 ≥ 4.5:1**；**大文本（≥18pt 或 ≥14pt 粗体，约等于 24px / 18.5px）≥ 3:1**。
  - 对比度公式 `(L1+0.05)/(L2+0.05)`，按相对亮度计算，**不取整**（4.499 不通过）。
  - 例外：禁用态组件、纯装饰、Logo、非可见文本无要求。
  - 1.4.6 AAA 为 7:1（增强级）。
  - 「18pt 与 14pt 粗体」对 CJK 字体同样适用（"font size that would yield equivalent size for CJK"）。
- 【来源】https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html（W3C 官方 Understanding 文档）
- 【对 bz 适用】✅ 高度适用。bz 手册 §3 的 caption 档（11–12px）最容易翻车——**caption 字号既非大文本，必须 ≥4.5:1**，即徽标/时间戳不能用 `--text-faint` 之类极淡色；`--text-muted` 在多数主题下是否达标需校验。可执行化：手册补一条「**正文/小字 ≥4.5:1，标题（≥18px）≥3:1；弱化文字只用于非关键信息**」。由于 bz 用 Obsidian 主题变量，主题决定对比度，插件侧能做的是**不进一步淡化**（如不再给 `--text-faint` 叠 opacity）。

### 4.2 WCAG 2.2 触控目标尺寸（2.5.8 Target Size Minimum）
- 【规则内容】（WCAG 2.2 新增，AA）：
  - 指针输入的目标 **≥ 24×24 CSS px**，否则需满足「间距豁免」：以目标包围盒中心画 **24px 直径圆**，该圆不得与相邻目标或相邻小目标的圆相交。
  - 豁免：同页有等价达标控件、行内链接（受行高约束）、用户代理控件、必需呈现。
  - 官方举例：20×20px 目标 + 4px 间距 → 通过；20×20px 无间距 → 失败；两行 16px 高按钮仅 1px 间距 → 失败。
  - 2.5.5 Target Size (Enhanced) 更严格（AAA 级，44×44）。
- 【来源】https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html（W3C 官方 Understanding 文档）
- 【对 bz 适用】✅ 适用（作为底线）。WCAG 24px 是「可达性底线」，bz 手册 40px 已远超；但「间距豁免」的**圆不交叠**思想可落地为规则：**移动端相邻可点元素间距 ≥8px**（与微信 2A 规则量级一致），密集图标按钮行（如头行 22×26 图标钮）靠间距而非仅靠尺寸防误触。可写进手册 §8.2。

### 4.3 触控目标：Apple 44×44pt / Material 48×48dp / 微信 44px / NN/G 1cm
- 【规则内容】（多方共识，数值汇总）：
  - **Apple HIG**：交互元素建议最小触控目标 **44×44 pt**（"Target Size" 条目；该页面当前为 JS 渲染无法直抓正文，数值为业界与 Apple 文档的公认引用）。
  - **Material Design 3**：触控目标最小 **48×48 dp**，相邻目标间距至少 **8dp**（"Touch targets" 条目，同上为公认引用；官方 token 命名体系已从源码确认，见 §3 Material token）。
  - **微信**：热区物理尺寸 7–9mm；适老化指南明确 **44pt 目标、12pt 扩展热区、40×40pt 底线**（已直抓官方原文，见 §3.6）。
  - **NN/G（Nielsen Norman Group）**：基于 Parhi/Karlson/Bederson 研究，触控目标最小 **1cm×1cm（≈37.8px @96dpi）**；目标先够大、再间距够开；主要 CTA 与移动场景应更大（2cm 级）。
- 【来源】
  - Apple：https://developer.apple.com/design/human-interface-guidelines/target-size（页面 JS 渲染，正文未直取；44pt 为公认引用值）
  - Material：https://m3.material.io/foundations/interaction/touch-targets（同上）；token 体系源码 https://raw.githubusercontent.com/material-components/material-web/main/tokens/_md-sys-color.scss
  - 微信：https://developers.weixin.qq.com/miniprogram/design/elderly.html（直抓原文）
  - NN/G：https://www.nngroup.com/articles/touch-target-size/（直抓原文：1cm×1cm、fat-finger、间距）
- 【对 bz 适用】✅ 高度适用，形成 bz 的触控目标数值锚点：
  - **结论**：bz 移动端点按目标定为 **44px 推荐值 / 40px 绝对下限**（已有 40px 下限保留），视觉不足时用 **±12px 伪元素扩展热区**（shadcn 技巧 + 微信 12pt 规则），相邻可点元素间距 **≥8px**。这一套覆盖 Apple 44、Material 48（48 对弹窗密集场景过严，44 是 Web/插件场景的合理档）、微信 44、NN/G 1cm、WCAG 24 底线，全部满足。

### 4.4 Material Design token 命名（补充佐证 shadcn 的命名法）
- 【规则内容】Material Design 3 的 token 命名模式：`<角色>` + `<on-前缀>`（前景/上层），如 `primary` / `on-primary`、`surface` / `on-surface`、`surface-container`（分 low/lowest/high/highest 五档）、`outline` / `outline-variant`、`scrim`（遮罩）、`shadow`、`error` / `on-error`。与 shadcn 的 `X / X-foreground` 同一思想：**每个颜色角色都有配对的「其上内容色」**。
- 【来源】https://raw.githubusercontent.com/material-components/material-web/main/tokens/_md-sys-color.scss（官方 token 源码，`$supported-tokens` 列表完整列出）
- 【对 bz 适用】✅ 命名法借鉴。Material 的 `surface-container-low/low/high/highest`（表面分层）可对应 bz 的「主背景 / 次级背景 / hover 背景」分层；`scrim`（遮罩）对应 `--background-modifier-cover`。这些说明 bz 手册 §2 的变量映射表与主流 token 体系同构，方向正确，无需改动，仅作背书。

---

## 五、结论：可直接并入 bz UI 设计手册的规则清单（草案）

按「可执行、可翻译成数值」优先级排序：

| # | 规则（草案表述） | 来源 | 并入手册位置 |
|---|---|---|---|
| R1 | 分隔优先级：间距 > 背景差 > 阴影 > 边框；边框只用于必须的结构分界 | Refactoring UI 首页 / Ant shadow | §5.1 |
| R2 | 一个层级只做一种变化（大/粗/色三选一）；弱化次要优先于强化主要 | Refactoring UI 目录第 2 章 / Ant contrast | §3 |
| R3 | 对比要么强烈要么不做：正文/小字 ≥4.5:1，标题 ≥3:1；弱化文字不叠 opacity | WCAG 1.4.3 / 微信适老化 | §3、§6 |
| R4 | 移动端点按目标 ≥44px（推荐）/ ≥40px（下限）；视觉不足用 ::after 扩 ±12px 热区（pointer: coarse）；相邻可点元素间距 ≥8px | 微信适老化（44/12/40）/ shadcn extend-touch-target / WCAG 2.5.8 / NN/G / Apple 44 / Material 48 | §8.2 |
| R5 | 阴影改为两层/三层叠加写法（硬影+软影），rgba 取 Ant 官方值，保持透明黑约束；暗色主题不依赖阴影表达层级 | Ant shadow.zh-CN / shadcn globals.css | §5.2 |
| R6 | 块级间距 8 步进（8/16/24/32）、行内 4 步进（4/8/12）；间距有语义（同组小、异组大） | Ant layout.zh-CN / Refactoring UI 目录第 3 章 | §4.1 |
| R7 | 错误提示不用一闪而过 toast（须常驻或可关闭）；一页最多一个加载动画；成功可 1.5s 轻量消失 | 微信小程序设计指南 | 通知规范（CONTEXT.md） |
| R8 | 状态色不只靠颜色：必须附文字/图标（Don't rely on color alone） | Refactoring UI 目录第 5 章 | §6 |
| R9 | 慎重决策场景按钮保持中性，不默认高亮危险项 | Ant contrast.zh-CN | §9 确认框 |
| R10 | 语义 token 成对命名（`X` / `X-foreground`），新自绘组件遵守，不散落裸色值 | shadcn globals.css / Material token | §2 |

**注**：Apple 44pt 与 Material 48dp 的官方页面正文因 JS 渲染未能直抓，数值以「微信适老化官方原文（44pt/12pt/40pt）+ NN/G 研究（1cm）+ WCAG 24px + 业界公认引用」交叉锚定；shadcn theming 正文以官方仓库 `globals.css` 源码为准（与文档页同源）。如需更严格的 Apple/Material 一手引用，建议后续用浏览器抓取 https://developer.apple.com/design/human-interface-guidelines/target-size 与 https://m3.material.io/foundations/interaction/touch-targets 渲染后内容。

---

## 六、权威设计系统规范调研（Material 3 / Apple HIG / Primer / Ant Design）

> 调研目的：为 `docs/ui-design-manual.md` 提供可执行的一手设计规则（设计系统权威来源篇，补充上文「实战派」来源）。
> 数据来源说明：Material 3 官网与 Apple HIG 官网为 JS 渲染，正文无法直接抓取；故采用 **官方实现源码**（Google material-web / material-components-android、Primer primitives、Ant Design theme 源码仓库）作为一手数据，Apple 原则正文采用存档版 + 对官方原文的可靠复现交叉确认。每条结论附来源 URL。
> 抓取时间：2026-08（仓库默认分支 main/master）。

### 6.1 Google Material Design 3（M3）

#### 6.1.1 设计原则（adaptive / expressive 核心表述）
- 【规则内容】M3 的定位是"可适应的系统"（adaptable system of guidelines, components, and tools），强调**灵活性（Flexibility）与表达（Expression）**。Google Design 官方对 M3 阶段的定性（2021–2024）：**"Curiosity, Flexibility, and Expression"（好奇、灵活、表达）**，核心创意驱动是：Eclectic shapes（兼收并蓄的形状）、Bold colors（大胆的色彩）、Lively motion（生动的动效）、Variable type（可变字体）。原则落地：用 scale 突出关键操作与 hero 时刻；用空间节奏让密集布局透气；组件模块化以适应不同形态。
- 【来源 URL】https://m3.material.io/ （官网首屏自述 "adaptable system"）；https://design.google/library/material-design-eras （Google Design 官方文章，M3 章节）
- 【对 bz 适用】**部分适用（方向性）**。不需要整套 Expressive 实验特性，但"用 scale 强调主操作 + 留白节奏 + 圆角/色彩表达个性"可直接指导 bz 主窗口与弹窗视觉基调；"可变字体"在 Obsidian 内不现实，忽略。

#### 6.1.2 Spacing：4dp 基准网格
- 【规则内容】M3 间距建立在 **4dp 基准网格** 上，官方档位：**4/8/12/16/20/24/28/32/36/40/48/56/64/72/80/96/128**（dp）。一般布局用 **8dp 为常用档**（组内 4dp 微调，页面级 16/24dp+）。页面边距惯例：compact 16dp、其余 24dp。
- 【来源 URL】https://m3.material.io/styles/spacing/overview （JS 渲染；数值经 https://www.designsystems.one/design-systems/material-design 与 https://pub.dev/packages/material_design 的 M3Spacings（4dp 网格 s4–s128）交叉确认）；https://m3.material.io/foundations/layout/grids-spacing/overview
- 【对 bz 适用】**高度适用**。建议收敛到 `4/8/12/16/24/32` 常用档，CSS 变量按此定义 `--bz-space-*`（手册 §4.1 已采纳）。

#### 6.1.3 Elevation：层级与暗色表面色调
- 【规则内容】M3 elevation 共 **6 级（level 0–5）**，官方 Web token dp 值：**level0=0, level1=1, level2=3, level3=6, level4=8, level5=12**。M3 用 **surface tint（表面色调）** 表达抬升：把 **primary 色按 elevation 混合进表面色**；暗色 tint 为 **primary80**（亮色 primary40）。官方 Android 文档明确：**Surface + elevation overlay 已被「色调表面色（tonal surface colors）」取代**——亮/暗各用一组预设表面色阶，组件不再按高度叠灰。
- 【来源 URL】https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-elevation.scss （0/1/3/6/8/12）；https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-color.scss （surface-tint 映射）；https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md （elevation overlay → tonal surface 官方说明）
- 【对 bz 适用】**高度适用，暗色模式重要改良点**。暗色下抬升表面 = 提亮表面色 + 弱阴影（1dp 内）；亮色下用 0/1/3/6dp 四档；`level5=12dp` 只在最顶层（全屏遮罩上的 dialog）用（手册 §5.2 已采纳）。

#### 6.1.4 Typography：字号档位与字重
- 【规则内容】M3 官方类型阶梯（size/line-height，px；Web 默认 1rem=16px）：

  | 角色 | size | line-height | 字重 |
  |---|---|---|---|
  | display-large / medium / small | 57 / 45 / 36 | 64 / 52 / 44 | 400 |
  | headline-large / medium / small | 32 / 28 / 24 | 40 / 36 / 32 | 400 |
  | title-large / medium / small | 22 / 16 / 14 | 28 / 24 / 20 | 400 / 500 / 500 |
  | body-large / medium / small | 16 / 14 / 12 | 24 / 20 / 16 | 400 |
  | label-large / medium / small | 14 / 12 / 11 | 20 / 16 / 16 | 500（label-large prominent 700） |

  字重只有 400/500/700 三档进入角色（无 600）；label 档固定 medium(500)，强调态上探 bold(700)。
- 【来源 URL】https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss
- 【对 bz 适用】**高度适用**。中文工具型 UI 映射：窗口标题=title-large(22)、卡片标题=title-medium(16/500)、正文=body-medium(14)、次要=body-small(12)、按钮=label-large(14/500)、辅助标签=label-medium(12/500)。中文不必照搬 display 大档。

#### 6.1.5 暗色模式 surface 色阶
- 【规则内容】M3 官方暗色/亮色 surface 角色（neutral 色调值，0=黑 100=白）：

  | 角色 | 亮色 baseline | 暗色 baseline |
  |---|---|---|
  | surface（基准） | neutral98 | neutral6 |
  | surface-container-lowest | neutral100（白） | neutral4 |
  | surface-container-low | neutral96 | neutral10 |
  | surface-container | neutral94 | neutral12 |
  | surface-container-high | neutral92 | neutral17 |
  | surface-container-highest | neutral90 | neutral22 |
  | surface-dim | neutral87 | neutral6 |
  | surface-bright | neutral98 | neutral24 |
  | on-surface | neutral10 | neutral90 |
  | on-surface-variant | neutral-variant30 | neutral-variant80 |
  | outline | neutral-variant50 | neutral-variant60 |
  | outline-variant | neutral-variant80 | neutral-variant30 |
  | surface-tint | primary40 | primary80 |
  | scrim / shadow | neutral0 | neutral0 |

  暗色要点：**表面不是纯黑**，基准 surface=neutral6（约 #141218 一带）；层级越高（container 越靠上）**越亮**（6→10→12→17→22），与亮色（98→96→94→92→90 越靠上越暗）相反；暗色 on-surface 用 high-tone（90 档）文字。
- 【来源 URL】https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-color.scss ；https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md
- 【对 bz 适用】**高度适用，手册现有暗色规则的直接升级**。暗色下建议 5 级表面阶梯（lowest=#0d0e12 级、surface=#141218 级、container 递增），on-surface-variant 做次级文字、outline-variant 做分隔线（手册 §5.2 已补数值表）。

#### 6.1.6 其他可执行细节（M3）
- 【规则内容】交互状态层透明度：hover 8%、focus 10%、pressed 10%、**dragged 16%**；禁用态：内容 38%、容器 12%；触控：移动端最小 48dp、桌面最小 32dp；焦点环：官方 3dp 宽 3dp 偏移；动效：standard 300ms、emphasized 500ms、短距 150–200ms；z-index 语义阶梯（第三方契约包编码，供参考）：background 0 / content 1 / floating 10 / drawer 100 / modal 1000 / snackbar 2000 / tooltip 9999。
- 【来源 URL】https://pub.dev/packages/material_design （M3StateLayerOpacities、M3Opacities、M3FocusRing、M3Motion、M3ZIndexes）；https://m3.material.io/styles/state/overview
- 【对 bz 适用】**高度适用**。hover/focus 统一 8%/10%，禁用 38%/12%，桌面控件最小 32px，触屏 44px+（手册 §6.4 已采纳，dragged 16% 已补）。

### 6.2 Apple Human Interface Guidelines（HIG）

#### 6.2.1 三大设计原则（Clarity / Deference / Depth）
- 【规则内容】（官方原文的可靠复现，官方正文在 iOS 7 "Themes" 章节，后被并入 HIG 设计原则页）
  - **Clarity（清晰）**："Throughout the system, text is legible at every size, icons are precise and lucid, adornments are subtle and appropriate, and a sharpened focus on functionality motivates the design. Negative space, color, fonts, graphics, and interface elements subtly highlight important content and convey interactivity." —— 中文要点：文字任意字号可读；图标精确清晰；装饰克制；用留白/颜色/字体/图形突出重要内容并传达可交互性。
  - **Deference（遵从）**："The UI helps people understand and interact with the content, but never competes with it." —— 中文要点：UI 帮助用户理解与操作内容，但**绝不与内容竞争**（界面让位于内容）。
  - **Depth（深度）**："Visual layers and realistic motion impart vitality to the interface and aid navigation and comprehension. Immersive or translucent elements reveal more content…" —— 中文要点：视觉层次与真实感动效赋予界面生命力，辅助导航与理解；沉浸式/半透明元素可透出更多内容。
- 【来源 URL】https://developer.apple.com/design/human-interface-guidelines/design-principles/ （官方页，JS 渲染；正文经以下交叉确认）：https://web.archive.org/web/20201128103056/https://developer.apple.com/design/human-interface-guidelines/ios/overview/themes/ （官方存档）；https://www.evl.uic.edu/datsoupi/420_14/docs/MobileHIG.pdf （iOS 7 HIG 官方 PDF 镜像）；https://github.com/johnzfitch/human-interface-markdown （2014 iOS HIG markdown 复现）
- 【对 bz 适用】**高度适用（评审准则）**。Clarity：次级文字暗色下保持可读、图标不叠多余描边；Deference：头行"功能 → ⚙️ → 关闭"秩序正是"界面让位于任务"；Depth：用遮罩+层级表面而非花哨动效，动效统一 150–300ms（手册 §1 已采纳）。

#### 6.2.2 macOS 与 iOS 的窗口/间距差异
- 【规则内容】iOS：全屏沉浸、无独立窗口概念；间距 8pt 基准、边距 16pt；触控 ≥44pt。macOS：**有独立窗口**，支持缩放/多窗口；窗口最小宽度通常 ≥520pt；弹窗（panel/sheet）相对窗口居中且尺寸小；间距较紧凑（边距 20pt 级），控件高度 22–32pt（鼠标精度）。对网页插件：Obsidian 弹窗 ≈ macOS 面板（非全屏、居中、可 ESC），桌面更紧凑、移动端转全屏。
- 【来源 URL】https://developer.apple.com/design/human-interface-guidelines/windows/ ；https://developer.apple.com/design/human-interface-guidelines/alerts/ ；https://developer.apple.com/design/human-interface-guidelines/spacing/
- 【对 bz 适用】**高度适用**。bz「移动端默认全屏、桌面居中卡」与 HIG「iOS 全屏 / macOS 面板」差异一致；桌面弹窗宽度上限约 560–720px、移动端全屏避让安全区（手册 §8 已体现）。

#### 6.2.3 材质（Material）与毛玻璃（vibrancy）
- 【规则内容】HIG 材质体系（ultraThin/thin/regular/thick/ultraThick 玻璃 + vibrancy）是**系统级渲染能力**，依赖原生窗口服务（NSVisualEffectView / UIVisualEffectView）。网页 UI 无法获得原生 vibrancy；浏览器可近似的是 `backdrop-filter: blur() + saturate()`，但 Obsidian 主题多样，半透明毛玻璃在任意背景上对比度不可控。
- 【来源 URL】https://developer.apple.com/design/human-interface-guidelines/materials/ （官方页，JS 渲染）
- 【对 bz 适用】**不适用（明确不建议）**。bz 弹窗/头部**不要用毛玻璃**：原生 vibrancy 网页拿不到；`backdrop-filter` 在 Obsidian 主题上不可控、暗色窗口内串色降可读性（违反 Clarity）；性能与兼容性风险。层级改用表面色阶 + 1dp 阴影（手册 §5.2 已采纳）。

### 6.3 GitHub Primer（数据完整）

#### 6.3.1 Token 组织方式
- 【规则内容】Primer primitives 采用 **4 层结构 + W3C Design Tokens 格式**：`base/`（原始基础 token：颜色 0–13 阶、尺寸、字体、动效、z-index，不可直接进组件）；`functional/`（语义 token：`border.*`、`shadow.*`、`space.*`、`radius.*`、`breakpoints`，引用 base，组件层只允许用这层）；`component/`（组件级 token）；`fallback/`（兼容层）。每个 token 带 `$type`、`$description`、`$extensions`（Figma 集合、LLM 使用规则）。
- 【来源 URL】https://github.com/primer/primitives/tree/main/src/tokens ；https://primer.style/product/primitives/
- 【对 bz 适用】**高度适用（组织方法论）**。手册 §2 已采纳 base→functional→component 三层，禁止组件直写原始像素。

#### 6.3.2 Spacing scale（4px 基准）
- 【规则内容】Primer base size 全档（px）：**2/4/6/8/12/16/20/24/28/32/36/40/44/48/64/80/96/112/128**；functional 语义档：`space.xxs=2, xs=4, sm=8（默认）, md=12, lg=16, xl=24`。用法（官方 LLM 注解）：2px 表单字段分隔；4px 徽标/列表项；8px 默认组件间距；12px 容器内边距；16px 区块分隔；24px 页面级结构。
- 【来源 URL】https://github.com/primer/primitives/blob/main/src/tokens/base/size/size.json5 ；https://github.com/primer/primitives/blob/main/src/tokens/functional/spacing/space.json5 ；https://primer.style/product/primitives/size/
- 【对 bz 适用】**高度适用**。手册 §4.1 已采纳 `4/8/12/16/24` 五档（与 M3 收敛档一致）；Primer 官方链接已更新到 primitives 仓库。

#### 6.3.3 Radius / 边框
- 【规则内容】Radius 档位（px）：`small=3, medium=6（默认）, large=12, full=9999`；工具类 rounded-1/2/3 与 circle。用法：3px 只用于 <16px 高小元素；6px 默认（按钮/输入/卡片/容器）；12px 用于 dialog/modal；full 用于头像/胶囊。边框宽度：`thin=1px（默认）, thick=2px（焦点/强调，必须用于 focus ring）, thicker=4px（强强调，少用）`。阴影内嵌 trick：用 `inset 0 0 0 1px` 代替 border 避免布局位移。
- 【来源 URL】https://github.com/primer/primitives/blob/main/src/tokens/functional/size/radius.json5 ；https://github.com/primer/primitives/blob/main/src/tokens/functional/size/border.json5
- 【对 bz 适用】**高度适用**。与 M3 的 4/8/12/16 二选一，**不要混用两套**；手册 §4.2 已定 M3 系并明确弃 28dp。

#### 6.3.4 Shadow / elevation 档位
- 【规则内容】Primer functional shadow（px，亮色默认；暗色有独立覆盖）：
  - `shadow.inset`：0 1px 0（内嵌，alpha .04 黑）——凹陷控件/输入框。
  - `shadow.resting.xsmall`：0 1px 1px a.05（徽标/极浅抬升）。
  - `shadow.resting.small`：双层（0 1px 1px a.04 + 0 1px 2px a.03）（按钮/可点击元素）。
  - `shadow.resting.medium`：双层（0 1px 1px a.10 + 0 3px 6px a.12）（卡片/面板）。
  - `shadow.floating.small`：三层（0 0 0 1px a.25 + 0 6px 12px -3px a.04 + 0 6px 18px a.12）（下拉/浮层）。
  - `shadow.floating.medium`：四层（0 0 0 1px + 0 8px 16px -4px a.08 + 0 4px 32px -4px a.08 + 0 24px 48px -12px a.08）（popover/菜单）。
  - `shadow.floating.large`：0 0 0 1px a.0 + 0 40px 80px a.24（modal/dialog）。
  - `shadow.floating.xlarge`：0 0 0 1px + 0 56px 112px a.32（全屏遮罩/sheet）。
  - 暗色覆盖：阴影色改用 **white（neutral0 反白）** + 更高 alpha（inset a.24、small a.6、medium a.4/.8），暗色阴影变「光晕」。
- 【来源 URL】https://github.com/primer/primitives/blob/main/src/tokens/functional/shadow/shadow.json5
- 【对 bz 适用】**高度适用，暗色阴影做法是最有价值的规则之一**。暗色下若仍用黑阴影会"看不见层级"；采用 Primer 暗色规则（白字光晕）或 M3 tint 方案，二者选一（手册 §5.2 已采纳）。

#### 6.3.5 Typography / Color（概要）
- 【规则内容】字号：`xs=12, sm=14（默认正文）, md=16, lg=20, xl=32, 2xl=40`（px）；字重 `light=300, normal=400, medium=500, semibold=600`；行高 `tight=1.25（单行控件）, snug=1.375, normal=1.5（默认正文）, relaxed=1.625, loose=1.75`。颜色：每个色相（neutral/blue/green/yellow/orange/red/purple/pink/coral）各 0–9 档（亮色从浅到深），neutral 0–13 档；base 值以 HSL + hex 双编码（如 neutral-1 #F6F8FA、neutral-13 #1f2328、blue-5 #0969da、red-5 #cf222e）。
- 【来源 URL】https://github.com/primer/primitives/blob/main/src/tokens/base/typography/typography.json5 ；https://github.com/primer/primitives/blob/main/src/tokens/base/color/light/light.json5
- 【对 bz 适用】**高度适用**。正文默认 14px/1.5 与 Primer sm/normal 一致；"单行控件用 tight(1.25)"已写入手册 §3。

### 6.4 IBM Carbon（未完成抓取，仅结论）
- 【规则内容】Carbon 官方 spacing 页面与源码均未能抓取成功（carbondesignsystem.com 404/网络失败；GitHub carbon 仓库路径未探明即超时）。**Carbon 部分本次无一手数据，不写结论**，避免以二手转述冒充规范。
- 【来源 URL】—（无）
- 【对 bz 适用】—（待后续调研，或直接以 Primer + Ant 两组数据为准，二者已足够）

### 6.5 Ant Design（数据完整）

#### 6.5.1 设计 token 体系
- 【规则内容】Ant Design 5 token 分三层：**seed token（种子）→ map token（派生）→ alias token（别名）**，全部由 TS 源码计算生成，无硬编码。Seed 关键值：`fontSize=14, borderRadius=6, sizeUnit=4, sizeStep=4, controlHeight=32, lineWidth=1, motionUnit=0.1`。
- 【来源 URL】https://github.com/ant-design/ant-design/blob/master/components/theme/themes/seed.ts
- 【对 bz 适用】**高度适用（组织方式参考）**：种子值 + 派生函数比手写变量更可维护。

#### 6.5.2 尺寸/间距（4px 基准，与 M3 相同）
- 【规则内容】由 `sizeUnit=4 × sizeStep=4` 派生：`sizeXXS=4, sizeXS=8, sizeSM=12, size=16（基准）, sizeMD=20, sizeLG=24, sizeXL=32, sizeXXL=48`。
- 【来源 URL】https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genSizeMapToken.ts
- 【对 bz 适用】**高度适用**。与 M3 同为 4px 网格，佐证"4/8/12/16/20/24/32/48"是行业收敛值。

#### 6.5.3 圆角
- 【规则内容】`borderRadius=6`（基准）派生：`borderRadiusXS=2, borderRadiusSM=4, borderRadiusLG=8, borderRadiusOuter=4`。
- 【来源 URL】https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genRadius.ts
- 【对 bz 适用】**部分适用**。Ant 偏小圆角（2/4/6/8）适合企业表单；bz 若想要更柔和可采 M3（4/8/12/16）。二选一，别混用。

#### 6.5.4 字号阶梯（指数派生）
- 【规则内容】由 `fontSize=14` 经指数公式 `14×e^(i/5)` 取偶派生：`12/14/16/20/24/30/38/46/56/68`；行高 = (size+8)/size（14px→1.57、16px→1.5、20px→1.4）。标题映射：H5=16, H4=20, H3=24, H2=30, H1=38。
- 【来源 URL】https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genFontSizes.ts ；https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genFontMapToken.ts
- 【对 bz 适用】**高度适用**：中文正文 14px 是行业共识（Ant/Primer 一致），12/14/16/20/24 五档足够。

#### 6.5.5 控件高度 / 动效 / 阴影
- 【规则内容】控件高度：`controlHeight=32`（默认），SM=24（32×0.75）、XS=16、LG=40（32×1.25）。动效：`motionDurationFast=0.1s / Mid=0.2s / Slow=0.3s`；easing cubic-bezier（out: 0.215,0.61,0.355,1；inOut: 0.645,0.045,0.355,1）。阴影：`shadow1L~3L` 三层浮起 + 暗色反白变体（本次源码未抓到具体数值，以官方文档 https://ant.design/docs/spec/shadow 为准，形态与 Primer floating 类似）。
- 【来源 URL】https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genControlHeight.ts ；https://github.com/ant-design/ant-design/blob/master/components/theme/themes/shared/genCommonMapToken.ts
- 【对 bz 适用】**高度适用**：按钮/输入框 32px（桌面紧凑）/44px（触屏）；动效 0.1–0.3s 三档即可（手册 §6.4/§7 已采纳）。

### 6.6 权威设计系统结论清单（补充「五、结论」）

1. **间距**：全局 4px 网格，收敛档位 `4/8/12/16/24/32/48`；页面级分隔 16/24，卡片内边距 12/16。来源：M3 / Primer / Ant 三方一致。
2. **圆角**：二选一——Primer 系 `3/6/12/9999` 或 M3 系 `4/8/12/16/28/9999`；对话框用最大非 full 档，按钮用 6/8。勿混用。
3. **阴影/层级**：亮色 4 档（resting 2 档 + floating 2 档，具体值见 6.3.4）；**暗色必须改白字光晕阴影或改用表面色阶**（本报告最大新增点）。
4. **暗色表面色阶**：按 M3 引入 5 级表面阶梯（lowest 4 → surface 6 → low 10 → base 12 → high 17 → highest 22，neutral 色调），on-surface=90 档文字。来源：M3 官方 Color.md。
5. **字号阶梯**：基准 14px；`12/14/16/20/24` 五档；行高正文 1.5、单行控件 1.25；按钮/标签 14/500。来源：Primer + Ant + M3 三方。
6. **交互态**：hover 8%、focus 10%、pressed 10%、dragged 16%；禁用内容 38%、容器 12%；触控 ≥44px、桌面 ≥32px；焦点环 2–3px。来源：M3 / Primer / WCAG。
7. **动效**：150–300ms 三档（fast/mid/slow），easing 用 Ant 的 out/inOut cubic-bezier。来源：Ant / M3。
8. **毛玻璃**：明确不采用（网页无法获得原生 vibrancy，backdrop-filter 在 Obsidian 主题上不可控）。来源：Apple HIG materials 结论推导。
9. **Token 组织**：base（原始值）→ functional（语义 `--bz-*`）→ component 三层，禁止组件直写原始像素。来源：Primer。
10. **设计原则评审准则**：Clarity（任何字号可读、装饰克制）/ Deference（UI 让位于内容）/ Depth（层级 + 动效辅助导航，而非炫技）。来源：Apple HIG。

**覆盖缺口**：① 本报告确认"暗色阴影反白/表面色阶"（见 6.3.4/6.1.5）是手册此前没有的规则，已并入 §5.2；② "单行控件行高 1.25""禁用透明度 38%/12%""dragged 16%""焦点环 3dp"为手册此前未覆盖细节，已并入 §3/§5.2/§6.4；③ IBM Carbon 未取得一手数据，标注为缺口，建议后续用其 GitHub（carbon-design-system/carbon，`packages/layout`）补抓或直接放弃（Primer + Ant 已足够支撑结论）。
