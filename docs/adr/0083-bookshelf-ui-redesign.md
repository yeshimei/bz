# ADR-0083：收藏本 / 归物本 UI 重设计落码（P1 标签工作台 + P6 状态边栏×时间轴）

- 状态：已采纳
- 日期：2026-09-03
- 关联：ADR-0002（依赖方向）、ADR-0003（懒加载）、ADR-0004（命令裸注册）、ADR-0009（统一存储路径）、ADR-0019（移动端默认全屏）、ADR-0064（声明式设置页）、ADR-0067（弹窗动态发号）、ADR-0074（收藏归档冷存）、ADR-0080（设置面板域）、ADR-0081（新域自包含先例）
- 原型：`.zcode/ui-prototypes/`（不入 git）——收藏本 P1「标签工作台」、归物本 P6「状态边栏×时间轴」（均已在浏览器走查拍板并做成完整交互版，各有 19/28 项无头冒烟通过）
- 票：`issues/179-bookshelf-redesign.md`

## 背景

收藏本（favorites）/归物本（belongings）两域为**旧脚本移植 UI**：收藏本 458 行样式 + 1573 行 ui.ts（五钮头行 + 标签胶囊栏 + 分页卡片 + 自绘弹窗），归物本 1260 行 ui.ts + **全内联样式 + 硬编码 hex 渐变 + 零 styles.css**（12 行纯注释），两域均未消费新组件库体系（铁律 6：设计手册 → 样式库 → 组件库 → 域）。

用户经三本（收藏/剪藏/归物）UI 原型评审拍板两套新形态：收藏本 P1「标签工作台」、归物本 P6「状态边栏×时间轴」，并明确「在 bz 中实现，写好之后旧域可能被删」（与回忆墙 ADR-0081 同款：新形态一比一落码，旧形态可弃）。

## 决策

### 1. 就地重写（非新目录）

不新建域名/目录，直接重写 `src/favorites/` 与 `src/belongings/` 的 UI 层（ui.ts + styles.css + index/app 门面适配）。理由：

- 命令 id（`bz-favorites-open/add`、`bz-belongings-open/add`）、设置键（`favoritesSortKey`/`favoritesMobileDefaultFullscreen`/`belongingsDataFolder`/`belongingsMobileDefaultFullscreen`/`storagePath`）、smartcat 事件契约（`favorites`/`belongings` 通道四载荷）、settings-panel schemaLoader 行全部**零改动沿用**——改名会波及 main.ts 命令表 / 设置面板 / smartcat / 测试 / 文档一大片既有契约；
- 数据文件 `favorites.json`（条目数组）/`belongings.json`（对象库）**零迁移**，数据层（types/data/config/ai/file-sync/default-categories.gen）与 file-sync 后台不动；
- 「旧域删除」语义由本次重写自然达成（旧 UI 代码直接删除，无并存期）。

### 2. 收藏本 P1「标签工作台」

- **桌面 720×560 常驻弹窗**：整宽头行仅「收藏本」标题（**去右上 ✏️/🔍/🔀/⚙️/❌ 五钮**——设置收敛 Obsidian 设置面板，ADR-0080）；左栏 168px 标签列表（全部 🗂 + 9 类固定标签 emoji + 计数，选中=品牌实底 `bz-fav-nav-active`）；右内容区 = 主头行（当前标签 / N 条收藏 / 主按钮「添加收藏」）→ 工具栏（常驻搜索框 + 排序循环钮 ⇅）→ 单列卡片流。
- **卡片**：描边圆角卡；置顶 = 左侧 3px 品牌橙竖条（inset shadow，去 📌 文字，hover 标题变品牌橙）；简介 2 行截断；meta = 标签徽章（品牌浅底）+ 关联笔记徽章 + 时间；右侧余额读数（大模型条目，档位色 ok/warn/err 映射 token success/warning/danger）。
- **移动 ≤768 真全屏**：头行右上图标组 ＋添加 → ⇅排序 → 🔍搜索 → ✕关闭；标签横滑 chips；搜索默认隐藏点 🔍 展开（`.bz-fav-mobsearch-show`）；**无悬浮 FAB**（添加已收头行右上）。
- **交互**：桌面**点卡片行 = 操作浮层**（core openItemMenu，锚定卡片右缘；右键同浮层）；移动点行 = 底部详情抽屉（openItemSheet）。动作序契约不变：打开(有 url) → 置顶/取消置顶(keepOpen) → 跳转笔记 → 刷新余额(keepOpen) → 编辑(keepOpen) → 归档(确认) → 删除(danger+确认+撤销 toast)。归档冷存不可见（ADR-0074 语义保留）。
- **表单**：添加/编辑（标题/链接/简介/标签多选胶囊/置顶钮/关联笔记），选「大模型」展开 LLM 配置区（API Keys + 余额 URL + hint）；AI 整理按钮保留（真实 GitHub API 仓库信息 + 提示词整理 + 标签兜底 + 不覆盖手写 + 逐字校验文案）；脏表单拦截（confirmDiscard）；保存后立即查余额（有 keys+URL 时）。
- **排序**：`favoritesSortKey` 设置读写（created/title 循环），置顶恒前；分页 50/页机制移除（数据量小，一次渲染）。

### 3. 归物本 P6「状态边栏 × 时间轴」

- **桌面 820×600 弹窗**：整宽头行仅「归物本」标题（去 ✏️/🔀/⚙️/❌——设置收敛设置面板）；左栏 168px 状态列表（全部 + 使用中/闲置/已转卖/已丢弃，lucide 图标 + 语义 tint 点 + 计数，选中品牌实底）；右内容 = 主头行（购入时间轴 / N 件 · 总投入 ￥M / 主按钮「记一笔」）→ 工具栏（搜索 + 年份下拉）→ **统计三卡**（总资产强调卡 + 日均成本 + 在册件数；非环形、无括号副标）→ **时间轴**（年节 → 月节点 → 物件行；年节折叠 chevron；转卖/丢弃行弱化）。
- **物件行**：分类 emoji 图块（数据本体保留）→ 名称 + sub（状态徽章 svg+文字 + 分类名 · 购买日期）→ 已用天数徽章 → 价格区（价格 + 副行：使用/闲置=「日均 ￥x.x/天」、转卖/丢弃=「陪伴 N 天」）。
- **移动**：真全屏 + 头行右上 ＋记一笔 → 🔍搜索 → ✕ + 状态横滑 chips + 统计两列 + 点行底部抽屉。
- **交互**：桌面点行/右键 = 操作浮层、移动 = 抽屉；动作序 = 状态流转×3（keepOpen，当前状态不显示，写盘 + 域事件）→ 编辑(keepOpen) → 删除(danger + flow-dialog 确认)。
- **表单**：记一笔/编辑（名称/分类搜索选择下拉/价格/日期/状态平铺胶囊/描述），校验逐字沿用旧域（请输入物品名称/请输入有效的价格/请选择购买日期/请选择或输入分类）。
- **自动刷新/主题**：打开期间 `vault.on('modify', belongings.json)` 自动重载（自写短路防双渲）；body 主题类变化（MutationObserver，仅 theme-dark/light）重渲染。均沿用旧域语义。
- **数据零迁移口径**：真实 belongings.json 8 字段**无售价/转卖日期字段**，故原型「转卖填回本价 + 回本/净支出显示」**不落码**（转卖 = 直接状态流转）；总资产 = 在用+闲置原价、日均 = 总原价/累计持有天数（统一到今天，复用 `data.calculateDaysUsed` 单一口径）。留待未来加字段再做售价语义。

### 4. 样式与组件库分层（铁律 6）

两域新 styles.css 全部消费 `src/core/ui/` tokens/components（`.bz-*` 类与 `--bz-*` token）：按钮/图标钮/输入/徽章/平铺单选/空态/弹窗骨架/字段布局走组件库；域内只保留独有布局（面板骨架、左栏、卡片、时间轴、统计条、表单 LLM 区、移动横滑条）。图标全 lucide（`setIcon`/`uiIcon` + `data-lucide` 占位批量挂载）；标签/分类 emoji 属数据展示保留。

## Options Considered

- **新建独立新域（如 favorites2）**：命令/设置/smartcat/面板全要复制改名，遗留旧域删除票——否决（契约面大，就地重写等价且更省）。
- **先建新域并存、旧域后续删（movie→cinema 模式）**：cinema 是因为影视数据是 md 笔记需双写并存才值得；收藏/归物是单 json 文件，双 UI 并存要双写同一文件，风险大——否决。

## 后续

- 剪藏本（clipping）原型评审暂停中（设置 schema 不同），后续单独票续做（`issues/` 待建）。
