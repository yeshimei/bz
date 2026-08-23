# bz 进度（上下文压缩恢复点）

- **ticket 70 样式按域拆分（铁律 9 修订，用户指令「铁律9 改成css按域拆分」；git worktree worktree/rule9-css-split 开发）**：① **源文件布局**——视觉样式源按域拆分：`src/<域>/styles.css` ×14（diary/launcher/memo/news/clipping/password/favorites/review/quiz/pomodoro/library/attach/encrypt/movie）+ `src/core/styles.css`（共享：设置页分页、主窗口头部行统一规范、core 层 notice/settings-modal/confirm/dom、移动端主窗口默认全屏、统一右键菜单/长按抽屉）；原 2979 行单文件 styles.css 的 22 个分节逐字切块搬运（无损校验：按原序重组 byte-identical；去注释规则行排序 2664=2664）。② **构建聚合**——新 `scripts/build-css.mjs`：SOURCES 清单顺序聚合生成根 `styles.css`（产物勿手改）+ 同步插件目录；esbuild.config.mjs 接线（build 一次聚合 / dev 经 fs.watch(src/**) 监听 src/**/*.css 自动重新聚合）。③ **顺序安全审计**——跨节选择器全量比对：仅 win-head/core/移动端全屏的 `!important` 支配对与互不冲突复合选择器（.active/.overdue/.bz-item-sheet-head 均无裸规则重复；slideUp 五处定义同义），拼接顺序=原文档顺序（共享节前置），级联行为不变。④ 文档同步：AGENTS.md 铁律 9 重写 + 架构行 + 主窗口样式规范引用、CONTEXT.md 新术语「样式按域拆分」+ Rules + 密码本词条去「含样式注入」、spec.md 构建/样式/CSS 规模三处、encrypt-suite spec 铁律 9 行、ADR-0020、issue 70。测试无样式表断言无需改动。

- **影视卡片双击打开 + 备忘录抽屉小字去 .md（用户决策，2026-08-22；git worktree worktree/diary-gestures 开发，未提交）**：① **影视双击回加**——ticket 69 手势收敛移除影视双击后按用户要求回加：整卡双击（300ms 内两次单击）走 openMovieNote（openLinkText+关主面板），与抽屉/右键「打开」同路径；单击无操作防误触（沿用剪藏回退双击先例）；长按抽屉/右键菜单不变。src/movie/ui.ts renderAll 挂 click 计时（仿日记正文双击），ui.ts:43 旧「双击已移除」注释同步改；spec 影视 US 27 补记。tests/movie/ui.test.ts +2（双击 openLinkText+关面板 / 间隔超 300ms 不触发后仍可双击）。② **备忘录抽屉「跳转关联笔记」小字去 .md**（notePath basename 剥 .md 后缀，src/memo/ui.ts sub 正则；tests/memo/ui.test.ts:416 断言同步）。**全量测试绿、tsc 0 后由用户决定合并/提交/构建**。

- **ticket 69 剪藏本接入统一抽屉（grilling 定稿，issue 69；git worktree bz-feature/feature-new 开发，完成合并回 master）**：手势模型重构为五域首例「单击直开」。① **双击整卡打开文章**（用户试用后回退单击直开——单击无操作、防误触；jumpToArticle 语义不变：openLinkText+关主面板；反链📌 stopPropagation 不受影响，触屏长按合成 click 由组件文档捕获层吞掉不误触）。② **统一抽屉**：桌面右键弹跟手菜单、移动端长按弹底部抽屉（合并时继承 master 全局右键方案 fbf7830，早期 desktopActions 补丁作废删除未入 master）；动作=打开/复制双链（`[[完整路径|标题]]`）/复制原文链接（小字=域名）/删除（danger+既有「确认删除」弹窗复用，非 keepOpen → 先关抽屉再弹确认）。③ **抽屉头部两行精简**（用户拍板）：标题 + 简介（摘要最多两行省略号截断，CSS `.bz-item-sheet-head .article-entry-summary` 承载），meta 行不在头部。④ 移除旧手写 addLongPress/LONG_PRESS_DURATION/双击监听；卡片禁选字（`.article-entry-card` user-select:none，styles.css 收敛）。⑤ 文档同步：spec.md 剪藏本 US 18/24、CONTEXT.md 剪藏本词条改写 + **新增共享术语「条目抽屉 (Item Sheet)」**（桌面=右键菜单、移动=长按抽屉；剪藏特例=唯一单击直开域）、AGENTS.md 域清单行、issue 69、PROGRESS.md 本条。**测试**：clipping view.test 9→13（长按日期/新版双击/右键/抽屉等用例——双击打开且单击无操作、桌面右键菜单（defaultPrevented+四动作+双击仍开）、移动端抽屉全流程（头部两行+动作顺序+删除确认）、复制双链写剪贴板+通知、复制原文链接（sub=域名+写剪贴板）、反链直点（stopPropagation 不触发整卡打开且抽屉无反链动作））；core/item-actions 采用 master 右键版（原 desktopActions 两用例删除）。**全量测试 + tsc 0 错误后单提交合并 master，构建部署核对（styles.css SHA256 一致）**。

- **ticket 68 后续 4（用户反馈：小窗口关闭按钮全取消，已提交）**：所有**二级小弹窗**的 ✕/❌ 关闭按钮取消，统一靠**点遮罩/ESC** 关闭（主窗口 ❌ 规则延续：非真全屏隐藏、真全屏显示）。改动：6 处小弹窗关闭钮挂 `.bz-win-close`（复用全局隐藏规则）——library 筛选 ✕、library 批注编辑 ✕、library 读书笔记 ❌、movie 筛选 ✕、movie AI 推荐 ✕、encrypt 预览 ✕；**3 处补点遮罩关闭**（此前只有 ESC/按钮）——movie AI 推荐（overlay click）、encrypt 预览（createOverlay 传 onMaskClick）、news 覆盖确认（ov.onclick=取消）；library 读书笔记外层 showBookNotes/showEpubBookNotes 已有 overlay click，无需补。侦察确认全库无「仅按钮可关」的弹窗。launcher 编辑模式 RENAME ✕ 属入口页体系未动。ADR-0019 修订第 5 条。

- **ticket 68 后续 3（用户反馈，已提交；后续 3b 修订）**：① ⚙️ 设置按钮置于 ❌ 关闭**正前**（favorites 🔍↔⚙️ 换序、encrypt 🧹↔⚙️ 换序、clipping 📰 前移，其余窗口已合规）；② 关闭按钮整体**再小 2px**（22×26/14px → 20×24/12px，新类 `.bz-win-close` 挂到全部自定义关闭钮：diary/movie/clipping/review/阅读报告/影视分析/归物本，createIconBtn 系用 `--close`、memo 用 `.todo-btn-close`、news 用 `.news-close-btn`）；③ **非真全屏一律隐藏关闭按钮（全平台，含桌面端）**——用户反馈「桌面端也不显示」：卡片态/桌面靠点遮罩+ESC 关闭、真全屏（`.bz-win-mfs`）靠 ❌；规则改全局 `display:none` + `.bz-win-mfs` 后代 `display:flex`，元素选择器提特异性（`button.bz-win-close` 等）。**部署事故记录**：此前两轮部署（a9778e8/048c58e）产物被并行会话构建覆盖回旧版（styles.css 缺 `bz-win-head`/`bz-win-close`），用户侧「没生效」根因即此——本轮构建后已做字节级核对（Source 与插件目录 styles.css hash 一致）。

- **ticket 68 后续 2（用户反馈：头部行全页面一致，已提交）**：主窗口头部行统一规范——① **头行** `padding:16px 24px 10px`（上/左右/下；头部↔底部列表间距统一 10px）+ 两端对齐 + 间距 8（统一类 `.bz-win-head` 加到缺钩子的 7 窗头部：password/review/belongings/clipping/movie 主/影视分析/阅读报告；diary/memo/favorites/library/encrypt 用既有类并入组）；② **头行按钮**统一 22×26/14px、透明、无阴影无边框、圆角 4、text-muted、hover `background-secondary`（!important 压制各窗内联/JS hover 与主题 button 默认样式；news 浮动按钮 32×32 圆→同规格、关闭右 10/设置右 40；番茄钟 ⚙️ 同规格；movie 分析 0.55rem/15px margin 独家规格废止；belongings 无 hover 补上）；③ 清理冗余：diary ≤768 头排规则删除（统一规格替代）、favorites 旧 `#fav-popup .fav-header .bz-icon-btn` 规则并入。ADR-0019 修订节追加第 3 条。

- **ticket 68 后续（用户反馈，已提交）**：① 全屏顶距统一——所有主窗口真全屏时顶部避让统一为 `max(34px, env(safe-area-inset-top))`（首子避让为全窗口统一机制）：日记 ≤768 头排 `!important` padding 规则改 `:not(.bz-win-mfs)` 让位（原来是 16px 压过通用 34px）、news 自垫 58px 对齐 34px（首子为绝对定位关闭钮故自垫）、影视分析基样式残留 `padding-top:34px` 清除（原会 34+34=68px 双重垫顶）。② 主窗口头部按钮统一去阴影去边框（用户拍板）：`.bz-icon-btn` 升 `!important` + 11 组头部容器/按钮选择器 `box-shadow:none!important; border:none!important`，压制主题 `button:not(.clickable-icon)`（收藏本 fav-header 先例推广到全部主窗口）。ADR-0019 补修订节。

- **ticket 68 移动端主窗口默认全屏（grilling 定稿 + 逐域实施，ADR-0019）**：13 个有主窗口的域各加「移动端默认全屏」开关——键 `<域前缀>MobileDefaultFullscreen`（13 个，落 data.json），**仅移动端（Platform.isMobile）显示与生效**，桌面端不显示不生效（Q4-A）。语义：≤768px **开=真全屏**（统一类 `.bz-win-mfs`：100vw×100vh、去圆角、头部安全区避让 `max(34px,env(safe-area-inset-top))`、news 自垫 58px 例外）/ **关=常规卡**（各域基样式居中卡；library --full/--full-lg ≤768 收窄 95%，余域 90% 桌面卡）；**废止原 480/640/768 乱断点**（8 处 JS 内联强制全屏 + 5 处 CSS 强制/半强制规则全部解除）。只决定每次打开**初始形态**、无窗口内手动切换按钮（Q4-A）；多窗口域（影视主面板+影视分析、书库主面板+读书笔记）一并对控制，筛选/批注等小弹窗不纳入；**做题家、入口页明确排除**（用户拍板）。默认值=行为保持：**默认开 11**（日记/归物本/剪藏本/聚合讯/密码本/收藏本/书库/阅读报告/影视/复习/保险箱——原移动端即全屏）、**默认关 2**（备忘录/番茄钟——原居中卡）；旧 data.json 由 DEFAULT_SETTINGS 兜底，老用户零感知。实现：settings.ts +13 键与默认值；新 `src/core/mobile.ts`（isMobileEnv/applyMobileWindowFullscreen）；styles.css 文件尾统一两态块 + news-settings-btn 样式（仅移动端显示）；13 域打开路径挂类（password/favorites/review/belongings/encrypt/movie/analysis/reading-report 删除 JS 强制全屏块；diary/clipping/news/library 删除 CSS 强制规则）+ 各域 ⚙️ 设置行（仅移动端，`if (isMobileEnv())` 挂行；**聚合讯/阅读报告补建 ⚙️ 入口**；归物本/收藏本空弹窗变 1 项）。**保险箱更名**（原「加密保险箱」→「保险箱」）：仅用户可见文案与文档（命令显示名/窗口标题/⚙️/解锁文案/注释/CONTEXT/AGENTS/spec），命令 id 与存储不动、历史 ADR 0015-0018 标题保留（存档文档）。ADR-0019、CONTEXT 术语「移动端默认全屏」、AGENTS 域清单补保险箱行、issue 68、spec 设置项总表跨域条目。测试：新 tests/core/mobile.test.ts（helper 5 用例含默认值映射）+ memo×4/review×2/library×3/news×1 域级用例（挂类/仅移动端设置行）；**1052/1052 全绿（+15）、tsc 0**。**并行说明**：encrypt 预览提速/派生密钥缓存（471c0e1）为并行代理产物，先于本 ticket 提交，本 ticket 未动其代码。

- **ticket 64 书库代码质量（用户要求审查后四批全做，ticket 61 遗留的域层样式收敛落地）**：① **样式收敛（ticket 60 收尾）**——ui.ts 80 处 `style.cssText` + 9 内联 `style=` 全部移入 styles.css 新 `bz-lib-*` 类族（遮罩分层 1000/1100/1200/1300 也进 CSS）；三状态徽章色板 + theme-dark 覆写纯 CSS（`.bz-lib-badge--未读/在读/已读`），**删 items.ts getStatusColors**（测试 2 用例同步删）；移动端适配改 CSS `@media (max-width:768px)`，JS 删 3 处 `window.innerWidth<=768` 判断；保留功能性内联（显隐/滚动/按层级动态字号边距），`#__book_library__` id 不变（铁律 3）。② **删死代码**——libraryModal 死变量、ui.ts `getSubfolder` 导入再转发（无引用）、`BookSettings.notePath`/`showCategory` + settings `libraryNotePath`/`showCategory`（⚙️ 弹窗删「读书笔记路径」；data.json 残留字段读取忽略）、epub-notes `void bookId`（findWeaveBookWithMutation 改 `Object.values` 不再返回 bookId，`as any[]` 标注规避 typeof 窄化）、sortItemList readingProgress `===null` 恒假分支（字段恒 number）、items formatFileSize 薄壳（ui 直引 core）（937→935 测试）。③ **重复逻辑合并**——4 处长按定时器手写 → core `longPress`；openEditCommentModal/openEpubEditCommentModal → 合并 `openNoteEditModal(title/quote/initial/onSave:Promise<boolean>)`；showBookNotes/showEpubBookNotes 外壳 → `createBookNotesModal(title, onClose)`（**顺带修正 EPUB ✕/ESC 原本会关不掉 md 弹窗的问题**）；renderBookCard 无封面分支合并。④ **bug 修复**——纯 EPUB 书库（无 markdown 书目）不再被空态提前 return 吞掉（先建面板、EPUB 合并后再判空提示+移除）；showEpubBookNotes 复用已取到的 book，避免二次整读 weave-data.json（loadEpubBookNotes 加可选 book 参，向后兼容）。测试同步：items 删 getStatusColors describe、排序改纯数值、ui 空库断言改异步等 EPUB 合并、定位器改 `.bz-lib-quote` 类。**验证**：935/935 全绿、tsc 0 错误、构建直出 vault（styles.css 已复制）；未动 notes.ts 与读取报告共用的 readWeaveDataAggregates/loadEpubBookItems。

- **ticket 63 移除读书番茄钟 + 专注目标选择（用户决策：无用且复杂）**：删 `src/pomodoro/epub-link.ts`（180 行）与 `reading.ts`（217 行）整文件及 `tests/pomodoro/epub-link.test.ts`/`reading.test.ts`；ui.ts 从 1022 行瘦身至 ~560 行（删读书分支/确认弹窗/目标区/选择器/重置清目标/读书统计行）；state.ts 删 FocusTarget/PomodoroState.target/HistoryEntry.target；data.ts 删 reading 字段与 target 归一（history 显式重建剥离 target 残留）；stats.ts 删 readingSecondsToday 与完整番茄口径（恢复纯计数）；statusbar 删读书态；config 删「阅读沉浸」预设（11 预设）；settings 删 pomodoroEpubAuto/pomodoroEpubMode（12 项）；main/index 删 epub-link 接线与导出；styles.css 删 .pomodoro-target*/.pomodoro-book 样式。**保留 ticket 62 通用改进**：后台自动暂停（visibilitychange/autoPauseMain）、不补算（recover 回空闲）、暂停落盘。**旧数据兼容（铁律 1）**：pomodoro.json 残留 reading/target 字段读取忽略不迁移。测试 996→912 全绿（删读书/目标 84 用例）；tsc 0 错误；构建直出 vault。spec（US 11-16 删、设置项 14→12 项）、CONTEXT（删读书番茄钟/独立读书会话/完整番茄/关书恢复/读书时长 5 术语）、issue 63 已同步。

- **ticket 62 番茄钟四 bug 修复 + 统计口径（用户反馈，grilling 12 问定稿）**：① **后台自动暂停**——`visibilitychange` hidden（最小化/遮挡/休眠）时主番茄钟 + 读书会话同时冻结（新开关 `pomodoroAutoPauseOnHide` 默认开），visible 且原本运行中自动恢复；blur 不触发（锁屏/全屏切走缝隙接受，已知限制）；手动暂停永不被自动覆盖（`autoPauseMain/autoPauseReading` 标记区分冻结来源）。② **换书**——`decideReadingAction` 换书判断改用**会话当前书**（`bindReadingSession` 改传 `ReadingBook|null`，加 `currentBook` 参数），prev 连续性丢失（切走/启动初态）也不漏判；设置弹窗关「读书自动番茄钟」**立即结算退出**读书会话（onAfter 回调）。③ **不补算**——`recover` 删除逐段补算改为**超时即回空闲**（剩余作废、不记历史、清 target）；`reading` 会话新增可选字段 `lastActiveAt`（关闭前实读结算基准，save 时刷新，旧数据无 → 放弃结算），`recoverReadingSession` 按 lastActiveAt 结算后结束会话；initData 残留会话统一结算落盘（`readingWasActive` 也触发 save）；启动残留 + 开关关 → 兜底结算。④ **统计口径**——`todayCount`/`last7Days` 的 book 条目仅 `duration ≥ 45min`（`PRESETS.reading.workMin*60`）计番茄个数，中途结算部分条目只进 `readingSecondsToday` 时长。**附带修复**：手动暂停不落盘缺陷（`applyAction` pause 补 save）。settings.ts +1 字段（14 项）；spec US 7/12/15/16/18 + 设置项总表同步；CONTEXT 术语 +3（后台自动暂停/不补算/完整番茄）+ 修订 3；issue 62。测试 +14（state recover 6 重写追加、reading lastActiveAt 5、stats 完整番茄 2、ui 后台暂停 3、settings 计数 13→14、epub-link 换书/重启 2 重写）：994→996 全绿（982 并入后实际 996/996，tsc 0 错误）；构建直出 vault。



- **ticket 56 番茄钟读书计时重构（用户需求，多轮定稿）**：① **重置清目标**——pomodoro ui `resetPomodoro` 重置满时长同时清空关联目标。② **独立读书番茄钟**（最终形态）——打开 epub 书快照并**挂起主番茄钟**，另起独立分段番茄钟，**自动选「阅读沉浸」预设（45/10/20）**：专注 45min 走满记一个读书番茄（target.type=book，duration=2700）→ 读书短休 10min → 每 4 个专注读书长休 20min → 回专注（书开机自走节律）；endTime 基准后台/重启不漏时。新模块 `src/pomodoro/reading.ts`（纯函数，复用 state.ts transition/recover 以读书时长注入）；`pomodoro.json.reading` 可选 `{active, book, state, prevState}`。③ **关书恢复**——`closeReadingSession` 结算当前段**按实读时长**入读书历史（读书休息段不计）→ 恢复 `reading.prevState` 主番茄钟快照（原 endTime 继续、时间不流逝）；换书直接切（旧书实读入账）。④ **读书统计改时长**——`bookCountToday`（个数）→ `readingSecondsToday`（今日 target.type=book 实读秒数求和），界面「📚 读书 X 个 🍅」→「📚 读书 X 小时 Y 分」；状态栏读书中「📖[专注] mm:ss」。**语义**：读书不再替换主番茄钟状态机、主预设始终为用户所选；`decideReadingAction` 加 readingActive 参数，主时钟 idle/暂停/未运行 → start、运行中专注 → confirm(enter)、休息 → confirm(skip-break)。**兼容**：reading 字段可选、旧数据无 → 空会话、非活动/非法 phase 归一为空。tsc 0 新增；测试 965→982 全绿（reading.test 12、stats/ui/statusbar/epub-link/data 适配）；构建直出 vault；无新命令 id。spec/CONTEXT 已同步。
① 移动端样式——右上角按钮去 box-shadow（`#fav-popup .fav-header .bz-icon-btn { box-shadow:none !important }`，主题 `button:not(.clickable-icon)` 特异性压制兜底；header 加 `fav-header` 类）、列表平铺去水平滚动条（容器补 `overflow-x: hidden`——`overflow-y:auto` 时横向溢出会连带计算为可滚动）+ 卡片下边框去除（移动端改 `border: none !important`）、标题栏移动端去下边框。② **AI 推荐 GitHub 增强**——`fetchGitHubInfo` 改真实 GitHub API（requestUrl 取 `https://api.github.com/repos/{owner}/{repo}`，原稿为纯 AI 生成，现取真实仓库名/简介，API 失败降级仓库名+空简介，非 GitHub 地址抛错）；`_handleAIRecommend` 检测 GitHub 链接：标题空则仓库名预填、提示词附仓库简介并要求翻译成中文（20-50 字）、GitHub 标签强制选中（AI 漏选/未返回时兜底，`let recommendedTags` 归一）；AI 失败时简介降级填仓库简介原文；「⏳ AI 整理中」按钮态提前到 GitHub 拉取前。③ **新增分类「DeepSeek Harness 🐋」**（CONFIG.DEFAULT_TAGS 追加第 9 项，标签栏/类型按钮/AI 提示词标签清单自动生效，旧数据不受影响）。④ **GitHub 简介忠实翻译修复**（用户反馈：短标语简介被 AI 扩写成泛泛介绍；GitHub 分支提示词改为「忠实翻译成中文，不扩写/不总结/不凑字数，已中文原样保留」——原「20-50 字」约束是扩写诱因；api.github.com 实测正常返回原文）。⑤ **GitHub 拉取加固 + 失败可见**（用户二次反馈怀疑简介是 AI 编的）：fetchGitHubInfo 返回加 `fetched` 标志（8s 超时 + 重试 1 次 + 非 2xx 判失败）；成功弹 info「已获取 GitHub 仓库信息」、失败弹 warning「GitHub 仓库简介获取失败，简介留空不编造」；**提示词在无简介/获取失败时强制「简介返回空字符串，严禁编造」**（此前失败静默降级 + AI 凭仓库名/记忆生成是「自己写的」根因）。spec 已同步（收藏本要点 + AI 提示词结构 GitHub 分支）。测试 +5（ai.test 3→5 改写真实 API mock、ui.test +3：仓库名预填+翻译+GitHub 选中 / API 失败降级+标签兜底 / AI 失败简介原文），收藏本 38→43 全绿。

- **ticket 61 代码体检（用户要求全面体检后逐项落地）**：① P0 清理——删 core/ai.ts 两处「AI 请求结果」调试 console.log、favorites/app.ts「📌 收藏管理器已初始化」残留日志。② **tsc 25 预存错误清零**（src/flash/vector-store.ts:83 ArrayBuffer 断言 + 测试 24 处：Element→HTMLElement、setSettingsProvider 补 as any、MockVault.file 返回 any、MovieM.entries 断言）——`npx tsc --noEmit` 从此 0 错误可作门禁。③ **core 层样式收敛（ticket 60 延伸）**——notice.ts NOTICE_CSS 262 行、settings-modal SETTINGS_MODAL_CSS 14 行移入 styles.css，confirm.ts 全内联改 `#__shared_confirm_*` id 选择器（popup 新增 id `__shared_confirm_popup__`，mask/按钮 id 不变），dom.ts createOverlay/createIconBtn/createSiteIcon 视觉改类名（bz-overlay-mask/bz-overlay-popup/bz-icon-btn/bz-icon-btn--close/bz-site-icon，hover 移 CSS :hover），settings-modal 头部/内容/空态类名化（bz-settings-*）；删除废弃导出 injectStyles（无调用方 + 测试同步删，1200→1199 测试）；测试视觉断言改类名断言（notice「不再注入 style」/dom「bz-icon-btn 类」）。④ **工具函数收敛**——escapeHtml 统一到 core（补 `"`/`'` 转义，删本地副本）；新增 core pad2 替换 9 文件 13 处 `padStart(2,'0')`（belongings/report/stats/movie×2/diary×2/pomodoro×3）。⑤ **P3 大函数拆分（9 个，行为不变）**——favorites _renderCard 338→3 函数、movie openAddModal 262→createTagGroup/createStatusGroup/createFieldRow/createTextareaRow、movie openFilterModal→renderFilterSettings、memo createAddDialog 304→AddDialogCtx/_buildSceneButtons/_handleAddSave、movie analysis buildAnalysisData 215→5 纯函数、library renderLibraryList→renderBookCard + showBookNotes→renderBookNoteNode/renderHighlightBlock、password createCard→attachLongPress、quiz renderModal→_buildOptionButtons/cleanOptionText、review createMainUI→_bindHeaderEvents/_buildSettingsItems。⑥ flash 4 未接线文件（float-window/reference-panel/chat-panel/mobile-panel）头部加 ⚠️ WIP 标注（ticket 18 未接线，index.ts 仍占位）。**遗留**：域层内联样式仍多（reading-report 234/movie 76/library 63/belongings 60 处 cssText），属 ticket 60 式整域工程，待后续 ticket。

# bz 进度（上下文压缩恢复点）



- **影视设置扩展（用户决策，第 9 轮）**：设置弹窗 2→6 项 + 2 分组（默认视图/显示）。新增：movieDefaultSort（默认排序 6 档 date-desc/date-asc/rating-desc/rating-asc/name-asc/name-desc）、movieDefaultTypeFilter（默认类型筛选，dropdown 全部+ALL_TAGS 13 类型）、movieDefaultStatusFilter（默认状态筛选 全部/想看/在看/已看）、movieRatingDisplay（已看卡片评分 stars 星星串 / number ⭐数字，ui.ts 卡片渲染读 tryGetSettings）。`applyDefaultView`（src/movie/index.ts 导出）在 ensureMovie 应用，非法排序忽略回退 date-desc（ensureMovie 幂等 → 重启生效）。spec 设置项总表影视行已同步（6 项）。测试 +4（ensureMovie 默认视图生效/缺省回退、设置弹窗 9 setting-item 断言、评分 number 渲染）。802→806。**注意**：movie 设置弹窗 describe 测试需 setSettingsProvider 注入（getSettings 会抛错）；bash heredoc 传 python 时 `\n` 转义会丢，字符串拼接用 join('\n') 或 write 工具。

- **日记本设置扩展（用户决策，第 9 轮）**：设置弹窗 6→12 项 + 2 分组（显示/默认视图）。新增：diaryTagShowEmoji（标签按钮 emoji 开关，筛选栏 createTag + 写日记弹窗标签选择器双生效）、diaryContentRenderMode（卡片内容 markdown/plain，createEntryCard + 退出编辑还原双处）、diaryTagSortMode（标签排序 fixed/count，rebuildTags 按 getTagCountForPrimary 降序，同级按名称）、diaryDefaultDateFilter（打开面板默认日期筛选 all/this-month，init 应用 currentDateFilter=今天年月）、diaryDefaultSelectedTag（默认选中主标签，init 应用 selectedTags，dropdown 选项=全部+全部主标签）、diaryJumpToEditAfterSave（保存后立即进入编辑，saveNewEntry 开关）。settings.ts +6 字段；ui-settings.ts 扩展 6 getter（getTagShowEmojiSetting/getContentRenderModeSetting/getTagSortModeSetting/getDefaultDateFilterSetting/getDefaultSelectedTagSetting/getJumpToEditAfterSaveSetting，applyUiSettings 同步扩展）。spec 设置项总表已同步（备忘录 13 项/日记本 12 项）。测试 +5（coverage-extra2 保存开关/emoji/按数量排序反例 收藏2>日记1、coverage-extra plain 渲染、panel init 默认视图真实应用——删 DOM 强制重 init）。797→802。**注意**：日记本默认视图（日期/标签）重启生效（init 幂等，面板已存在不重应用）；不恢复项遵循 spec 228 行先例（标签配置/默认标签/长按启用开关已确认删除）。

- **备忘录设置扩展（用户决策，第 9 轮）**：设置弹窗 13 项分组（提醒/剪贴板/显示/新建/场景列表）：恢复场景列表（逗号分隔文本，空→内置 6 场景）、平台映射（每行 域名=平台名，空→内置 7 项）；新增开关 打开笔记自动提醒（openNoteReminder）、剪贴板监听（clipboardMonitor）、到期通知（memoDueNotify 轮询 Notice，同条目同状态仅提醒一次，notifiedDue Set）、到期检查间隔（memoDueCheckInterval，最小 10s）、默认排序方式（memoSortMode：priority/due/created）、默认显示归档（memoShowArchivedByDefault）、新条目默认优先级（memoDefaultPriority）、完成后自动归档（memoAutoArchive，关=完成条目保留主列表划线+勾选态排最后）、新条目默认场景（memoDefaultScene，空=第一个）、到期时间格式（memoDueFormat：relative/absolute，due.ts formatDueText 加 mode 参数）。**删除 AI 推荐场景功能**（✨ AI 推荐按钮 + handleAIRecommend + App.ai 全部移除）。**启动弹窗文案润色**：名称「启动时自动弹出」、描述「启动时若存在未完成的重要或到期备忘录，自动弹出面板提醒」。开关反注册语义：设置关闭时 init 会反注册已注册监听（App 单例幂等 + 测试隔离）。场景/平台映射变更即时生效（reloadScenes 重建 DataManager + 添加弹窗）。测试：memo 域 +14（data 解析 2、app 开关/到期轮询 6、renderer 排序/归档/格式 5、ui 设置弹窗 4）；mock Setting 补 setHeading/addTextArea。783→797。

- **命令统一命名（第 9 轮，用户决策）**：命令 id 全部改为 `bz-<域>-<动作>` 三段式（域全英文/缩写、无 manager/master 冗余、动作统一 open/add/generate/start），中文名与入口页磁贴 label 一致（如 主页=bz-home、剪藏本=bz-clipping-open、闪念=bz-flash-open、写日记=bz-diary-write、日记本=bz-diary-open）；**全部命令注册带 icon**（lucide，与 launcher.json 磁贴图标一致）。**删除两命令**：`bz-notification-demo`（src/core/notice-demo.ts 整文件删，通知系统本体 notice.ts 保留）和 `bz-diary-create-quote`（写摘抄，src/diary/ui/quote.ts 仅剩 registerOpenDialogCommand=bz-diary-write）。**同步面**：launcher.json 41 处 commandId 已改（用户数据）；源码 executeCommandById 3 处（clipping/library/review）；手势绑定改 bz-home；smoke.test.ts 命令清单 34+1；diary 三测试文件删写摘抄用例 5 个（788→783）。**注意**：id 是外部裸调用约定（主页.js/热键绑定/launcher.json），改名后旧热键失效需重绑。spec.md「命令 id 全清单」已同步为第 9 轮。

- **flash vector-store 既有失败测试已删除**（用户决策）：增量刷新「文件删除清理条目」用例断言 `meta.notes` 清空但源码不清理（ticket 18 暂缓域的真实缺陷），长期挂红。删除后全量 775/775 零失败。缺陷本身仍存在（闪念实现时需修：refresh 应清理已删除文件的向量条目）。

- **ticket 25 通知系统（ADR-0010，grilling 会话 + 样式演示敲定；2026-08-09 修订）**：自绘 toast `src/core/notice.ts` 替代原生 Notice。**修订后**：类型显式指定 `notice(msg, type?, duration?)`（`classifyNoticeType` 已删，消息文本禁 emoji）；类型图标 emoji（info ℹ️/success ✅/warning ⚠️/error ❌/progress 转圈）；位置分端——桌面右上角右滑入（slide-right），移动端（max-width 768px）顶部居中下落入（drop）；dedupeKey 存活期单框合并（同键存活原地更新消息/可切类型/重置计时，已消失 30s 内不新弹防刷屏）；`duration <= 0` = 常驻。堆叠上限 5、点击关闭、错误 5s/其余 3s；动态 setMessage/setProgress（100 变绿、-1 跑马灯）/setType（progress→完成自动接管计时）/title+action；reduced-motion 降级。**连续任务单框约定**：review 复习循环（`_reviewNotice` 句柄 + review-loop 键）、review/quiz 批量出题（progress→success/warning）、auto-summary（auto-summary 键）、movie 海报——统一常驻单框动态替换。**测试**：`getNoticeMessages`/`hasNotice`/`clearNotices` 进 mock-obsidian-entry；`__resetNoticeForTests`（清 live/recent，resetObsidianMocks 内调用防 dedupe 窗口跨测试残留）。演示命令 `bz-notification-demo` 已随第 9 轮命令清理删除（13 场景自查入口移除，样式自查改手动触发 notice()）。注意：**edit 工具整批原子性**——一处 oldText 不匹配整批拒绝；脚本改文件时 CRLF 行尾会使 `$` 锚定失效，且 options 分支易丢闭合 `)`，改完必跑 tsc+vitest 校验。tsc 预存 9 文件错误清单（vector-store/extra 测试）仍未清零。

- **ticket 24 设置归属模型（ADR-0009，grilling 会话敲定）**：设置两分——Obsidian 设置页单页化（无 tab，只含 🤖 AI：服务商/两 key + 📂 数据存储路径：共享 storagePath）；10 域面板右上角 ⚙️ 域设置弹窗（备忘录 autoPopupOnStart｜日记本 6 项｜归物本/收藏本空弹窗｜剪藏本仅 3 项（剪藏目录/每批加载/自动摘要开关）｜密码本 3 项｜书库 7 项｜影视 2 项+海报提示｜复习计划 2+做题家 5 项｜闪念 17 项全量）。**筛选/排序统一 🔀**（影视「筛选与排序」、书库「视图与筛选」、归物本排序原 ⚙️ 均改 🔀）。**共享数据路径**：新字段 `storagePath`（默认 CONFIG/STORAGE）收敛旧 7 个 JSON 路径字段（todoFilePath/belongingsDataFolder/pwStoragePath/favoritesStoragePath/reviewStoragePath/META_PATH/VEC_PATH），旧字段仅兼容保留；迁移：首次加载旧字段全同 → seed，参差 → 默认 + Notice 列出被忽略路径（`migrateStoragePath`，用 loadData 原始对象判定，勿用 DEFAULT_SETTINGS 合并后对象——storagePath 恒 truthy 会跳过迁移）。读取点统一 storagePath 优先旧字段兜底（bz/belongings/password/favorites/review/quiz/ai-agent/flash-config 7 处）。AI Agent 4 项设置不暴露 UI（字段保留，运行时读旧值/默认兜底）。入口页不新增设置（编辑模式控件已按平台读写 launcher.json）。新工具 `src/core/settings-modal.ts`（通用设置弹窗：标题/build 回调/空态/✕/遮罩/Esc/幂等替换）+ `setSettingsSaver`/`saveSettings` 保存通道（main.ts 注入）。影视/书库本地筛选弹窗函数改名 openFilterModal/closeFilterModal（避开 core 同名）。测试：settings-tab.test.ts 重写（单页+迁移 9 测试）；新 tests/settings-modal.test.ts（机制+备忘录交互+归物本/收藏本空弹窗 9 测试）；movie/library/review/clipping/password/diary 各补 ⚙️ 弹窗测试。术语入 CONTEXT.md（全局设置页/域设置弹窗/共享数据路径/筛选弹窗）。

- **ticket 23 增量 2（用户 8 问）**：① **双平台独立配置**——launcher.json 升 v2 `{version, desktop:{tiles}, mobile:{tiles}}`，v1 旧格式自动归入 desktop；平台判定 `window.Capacitor`（项目惯例 IS_MOBILE）。② **隐藏文字 + emoji 图标**——磁贴 `hideText` 字段（改名弹窗内开关）；图标选择器支持 emoji/任意字符（lucide 清单外走文本渲染，`LUCIDE_ICONS.includes` 判定）。③ **去标题栏**——toolbar 整体移除，常态零按钮（遮罩点击/ESC 关闭）。④ **编辑模式空白格「＋」**——长按空白区域（含空态）进编辑模式，空白单元格渲染 + 占位（含末尾追加行，全满可继续添加），点击弹命令选择器；「完成」按钮改悬浮右上角（编辑模式唯一显式出口）。⑤ 遮罩关闭补测试。⑥ 完成按钮语义=退出编辑模式。⑦ 网格间距 12→8（拖拽步长同步）。⑧ **手势触发**——`src/launcher/gestures.ts` 双击/连续三击/双指下滑（触屏双触点同向位移 + 滚轮 300px 累积兜底），绑定命令 id；三击配置时双击延迟判定（TAP_WINDOW 内无第三击才触发）；设置页入口页 tab 三组下拉（off + 5 常用命令），`syncGestures` 幂等重注册（设置变更/onload），onunload 清理。60 测试（数据 23 + UI 27 + 手势 10）。

- **ticket 23 命令入口页（Launcher）**（issue 23，grilling 会话 10 问封板）：`bz-launcher-open` 裸注册；全局唯一单例弹窗（自建 DOM + escManager，z-index 10100）；网格列数设置项 `launcherColumns`（默认 6，设置页新 tab「入口页」）；磁贴档位 {1×1,1×2,2×1,2×2}；长按 0.5s 进编辑模式（iOS 式：拖主体移动/右下角手柄调档位/左上角×删除/顶部+添加/✓完成）；添加走自建命令选择器（listCommands 全命令模糊搜）→ 1×1 落末尾空位；点击磁贴先关入口页再 executeCommandById；幽灵磁贴（命令失效灰色保留可删，复活自动恢复）；磁贴自定义 lucide 图标（内置 ~140 图标清单 + 选择器，优先于命令自带 icon）；推挤碰撞（pushMove 纯函数：目标被占 → 行优先顺移，行扩展兜底永不失败）；数据 `CONFIG/STORAGE/launcher.json`（{version, tiles:[{id,commandId,x,y,w,h,icon?}]}，normalizeData 容错）。术语已入 CONTEXT.md（入口页/磁贴/档位/编辑模式/推挤/幽灵磁贴）。36 测试（数据层 19 + UI 17）；smoke 命令 30→31；设置页 tab 12→13。**ADR 评估：全部决策为既有模式/用户偏好，不写 ADR。**

- **ticket 22 自动摘要：create/open 双触发 + 逐字段补全 + 通知**（issue 22，用户问答确认）：`ensureAutoSummary` 注册 `vault.on('create')` + `workspace.on('file-open')`（watchDir 前缀边界一致；1500ms 延迟窗口 pending Set 去重；open 传 null 跳过；unload 双向 offref）。`processFile` 缺什么补什么（title/summary/tags，空串/空数组视为缺失；字段齐全跳过不 notify）；**缺 title → AI 标题重命名笔记文件**（非法字符清理/截断 80/防重名 (1)(2)，rename 失败回退仅写 frontmatter）；author 不再生成。`aiProcess(ai, bodyText, missing)` 提示词 JSON 模板按缺失字段裁剪（规则文案逐字保留，不含 author）。通知两条：调用 AI 前 `正在为《xx》生成摘要…`(3s，xx 用已有 title 或文件名) + 成功后 `notice(msg, 8000)` 格式《title》+空行+summary+空行+#tags。MockVault 补 rename。34 测试。spec.md 需求 30-34/事件监听/事件清单表/frontmatter/提示词结构/事件触发缝已同步。

- **ticket 21 海报抓取方案反转（ADR-0007）**：抓取逻辑移出插件——`src/movie/poster.ts` 与 `tests/movie/poster.test.ts` 删除，设置项 `doubanPosterEnabled` 删除，影视设置 tab 改为纯文字指引（安装 npm 包 + `douban-poster start` PM2 守护）。脚本侧 2.1.0：`watcher.js`（扫描缺海报笔记 + birthtime 倒序 + 串行队列 15s 间隔 + 10s 事件防抖），cli.js watch 改监听 add/change → 扫描；工具 README 恢复 PM2 说明。28 个 node 测试。

**⚠️ 发布事故（见 incidents/2026-08-08-npm-publish-without-verification.md）**：2.1.0 未运行验证即发布（cli.js 缺 switch 行语法损坏）→ 2.1.1 又漏 files 白名单（缺 watcher.js）→ 2.1.2 修复。教训：发版前必须 `npm test`（已加 node --check 门禁）+ `node cli.js` 冒烟 + `npm pack --dry-run` 核对清单 + 发布后全局安装实测。
## 最近一次架构深化（未提交，待 commit）

- **番茄钟（ticket 26-32，grilling 会话 3 轮 20 问封板 + to-spec/to-tickets 拆 6 垂直切片一次实施）**：新域 `src/pomodoro/` 7 文件——state（transition/recover 纯函数状态机）、data（pomodoro.json v1）、ui（中央单例弹窗：环形进度 SVG/开始暂停重置跳过/今日计数+近 7 天柱条/⚙️）、sound（Web Audio 低音 3 响/高音 2 响）、statusbar（🍅 mm:ss 空闲灰态/点击开弹窗）、stats（聚合纯函数）、config（11 预设+自定义）。命令 `bz-pomodoro-open`「番茄钟」（icon timer，共 35 命令）；设置 +9 项（预设 12 档/自定义时长动态显隐/N/四开关，默认值包 Q16）；**提醒：手动禁用 obsidian-statusbar-pomo（替代关系，不写禁用逻辑）**。ADR-0012（原脚本代码丢失，按手册重建）。83 测试（pomodoro 域 7 文件），全量 889 全绿，tsc 零新增。原 spec Out of Scope 已同步（番茄钟移出）。
- **ticket 21 海报抓取**：`src/movie/poster.ts` 新建影视笔记自动调全局 npm 包 `@jwbz/obsidian-douban-poster`（ADR-0006）。桌面端 `vault.on('create')` → 延迟 3s → 串行队列 spawn `node cli.js fetch`；结果解析 stdout（[完成]/[跳过]/[失败]）；60s 超时 kill；`npm root -g` 探测安装状态（未装 → 设置开关禁用 + 安装指引）；移动端不注册监听 + 设置项置灰「仅桌面端可用」；设置 `doubanPosterEnabled`（默认关）。**mock-vault offref 已实现真实移除语义**（on 返回 {event, cb}）。21 测试。
  - **追加修复（用户反馈）**：① spawn 改传磁盘绝对路径（`vault.adapter.getFullPath`）——脚本 fetch 对相对路径 `path.join(movieFolder, input)` 重复拼接导致「笔记不存在」；② 新增 `workspace file-open` 维度：打开影视笔记且 frontmatter 无「海报」→ 触发抓取；create/open 双触发经 60s 冷却（`FETCH_COOLDOWN`）去重。28 测试（+7）。
- **复习⇄做题家联动契约化**：`src/quiz/ui.ts` 新增 `startReviewSession`/`endReviewSession` + 导出 `QuizReviewResults`；`src/review/app.ts` 的 quizReviewLoop 不再直写 quizUI 私有状态（_reviewMode/currentQuestions/onComplete 等），只调契约方法。新增契约测试（tests/quiz/ui.test.ts「复习联动契约」）；review 测试 mock 按契约实现。术语「做题会话 (Quiz Session)」已入 CONTEXT.md。
- **AI Agent 路径去硬编码**：`src/ai-agent/index.ts` 删 `MEMO_PATH`/`FAVORITES_PATH` 常量，改为 `getMemoPath()`（todoFilePath 目录 + memo.json，与 bz DataManager 同源）/`getFavoritesPath()`（favoritesStoragePath，默认 CONFIG/STORAGE/favorites.json）。新增「设置路径生效」测试。
- **侦察发现（文档过时）**：AGENTS.md 称闪念约 2311 行——实际 `src/flash/index.ts` 仅 24 行占位骨架（ticket 18 未实现）；文档已修正。

## 已完成（git 已提交）

| ticket | 域 | 说明 |
|---|---|---|
| 01 | 骨架 | esbuild→bz、manifest、设置页全量、25 命令裸注册、ribbon、懒加载 |
| 02 | core | Q3 21 工具移植：`src/core/`（utils/dom/json-store/changelog/ai/app/esc-manager/confirm/settings-provider） |
| 03 | AI/changelog | AIService+createAI（deepseek/opencode-go、override、noCors、fallback）；CHANGELOGS 8 identifier |
| 04/05 | 备忘录 | `src/bz/`（types/due/data/ui/app/index），37 测试 |
| 06 | 归物本 | `src/belongings/`（default-categories.gen.ts 1226 条已落盘），18 测试 |
| 07 | 密码本 | `src/password/`（crypto/data/ui/index），22 测试 |
| 19 | AIAgent | `src/ai-agent/`（sync/dialog/index），16 测试 |

## 待完成（按序）

1. **08/09 剪藏本+聚合讯**：worker 已交付**完整代码**（9 个文件全文）在
   `E:\Obsidian\1\.pi-subagents\artifacts\7fbec595-deb3-46b9-9714-0f21db4bf584_worker_2_output.md`
   → 落盘 `src/clipping/view.ts`+`index.ts`、`src/news/reader.ts`+`index.ts`、`styles/clipping.css`、`styles/news.css`、`tests/clipping/parse.test.ts`、`tests/clipping/view.test.ts`、`tests/news/reader.test.ts` → tsc + vitest → commit。
   注意：worker 代码中 `getVault()` 辅助需在 setup 内补 `_vault = vault`；main.ts 无需改动（导出名一致）。
2. **10 自动摘要 + 11 收藏本**：蓝图在 `..._worker_3_output.md`（自动摘要 parser/processor 结构、收藏本 DataManager/BalanceService（findNumberInObject/5 分钟缓存）/UIManager DOM id/AI 整理/余额状态机）。
3. **12 书库 + 13 阅读报告**：蓝图在 `..._worker_4_output.md`（getBookItems/parseBookNotes/updateComment/deleteHighlight 用 window.confirm、报告 80+ 生成函数公式：热力图色板/香农多样性/基尼平衡/思考比/趋势方向等，重复函数只保留最终版）。
4. **14 影视 + 15 影视分析**：蓝图在 `..._worker_5_output.md`（TYPE_GROUPS/ALL_TAGS/TYPE_COLORS 常量、排序三键、无限滚动、AI 推荐链路、initQ3 海报整理；分析 48 字段聚合、7 图表组件、ratingBucketOf 6 档、21 section；**movie 域必须导出 getMovieFolderPath() 供 analysis 用**；主演计数源码 bug 取单次）。
5. **16 复习 + 17 做题**：蓝图在 `..._worker_6_output.md`（FSRS 幂律：w=[0.4,0.6,2.4,5.8,4.93,0.94,0.86,0.01,1.49,0.14,1.26,0.07,0.35,2.06,0.57,0.09,0.05,0.33,2.15] d=0.9；R(1,1)=0.5104；阶梯 10 级；review.json 兼容；`window.__quiz`→src/quiz 单例；做题家 quiz.json 结构/3 难度提示词；**「全完成替换」实际是 removeQuestion 机制**）。
6. **18 闪念**：蓝图在 `..._worker_7_output.md`（七模块；两处停用词表 35 字/44 字分别保留；meta.json v7 + vectors.vec 布局 dim(LE uint32)+float32；Ollama 三端点；降级链；17 设置；IS_MOBILE）。源码 2311 行最大域。
7. **20 e2e 验收**：15 域对照原宏、数据零迁移、27 命令、降级链、回退验证。

## 关键约定（勿破坏）

- 命令已在 main.ts 注册（25 个，id 无前缀），域内**不重复 addCommand**；导出名与占位 index.ts 一致
- 域设置经 `getSettings()`（src/core/settings-provider.ts）；AI 经 `createAI()`；app 经 `getApp()`
- 样式写 `styles/<domain>.css`（最终收敛进根 styles.css），域内仍可 injectStyles（data-xxx-styles 幂等）
- 测试：vitest+jsdom，`tests/mock-obsidian-entry.ts`（Notice/requestUrl/moment/Plugin/Setting mock）+ `tests/mock-vault.ts`（MockVault 有 getFiles/createFolder/create/modify/read/getAbstractFileByPath）；`setApp`+`setSettingsProvider` 注入
- 长异步（PBKDF2/crypto）测试用真实 setTimeout 等待；fake timers 下用 advanceTimersByTimeAsync
- 提交信息格式：`bz: ticket NN <域> 完成——<要点>，N 测试`

## 环境注意

- 子代理写操作被环境全局拦截（权限门）——**只能主会话写盘**；worker 蓝图/代码在 `.pi-subagents/artifacts/*.md`
- 编辑器注意：src/bz/ui.ts 等大文件 anchor 易 stale，改动用 python 脚本或 replace_text

---

## 2025-08-07 收尾（ticket 20）

**状态：14/20 域完成（闪念按用户指示暂缓，已 stash）**

- ✅ ticket 13 阅读报告 `b0686c9`：stats.ts/report.ts/index.ts + 34 测试（香农多样性/基尼/热力图/21 section）
- ✅ ticket 14/15 影视+分析 `74e5626`：src/movie/ 7 文件 + src/movie-analysis/ 3 文件 + 58 测试（排序三键/无限滚动/Q3 海报/AI 推荐/48 字段/6 档评分桶）
- ✅ ticket 16/17 复习+做题 `ae5964c`：FSRS 19 权重/R(1,1)=0.5104/阶梯 10 级/难度弹窗 + QuizManager/三难度生成器 + 40 测试
- ⏸️ ticket 18 闪念：15 文件 + 2 测试已写（vector-store 二进制格式已修好）→ **git stash flash-wip-ticket18**（用户指示暂缓；恢复：`git stash pop`）
- ✅ ticket 20 收尾：README 重写、构建产物输出 vault 插件目录（main.js 774KB/manifest/styles.css）、全量 **478 测试 / 46 文件** 通过、tsc 零错误

**全量命令 25 个**（spec 27 = 25 + 闪念 2，闪念命令占位 Notice 保留在 main.ts 注册表）

**关键实现备注**：
- MockVault 增强：YAML `- item` 列表解析、file parent/extension 通用 basename、workspace.on/getActiveFile、正则放宽 `
---\s*(?:
|$)`（无尾随换行兼容）
- quiz generator：extractJSON 只截对象（源码语义，数组形态 → 报「AI 未返回有效题目数组」）
- review：阶梯分支 again 不可达 fsrs（源码语义）；nextDiff clamp [0,1]（again→1）
- flash（stash 内）：MobileBuffer 固定用于 .vec 写入（避免 Node Buffer 池偏移）；meta.json v7 chunks 只存 {text}
- 停用词表实际长度 29/40（蓝图标注 35/44 有误，以源码字符串为准）

---

## 2026-01-17 主页改造 + 全量改名（ticket 21）

**状态：30 命令全绿（474 测试）**

- ✅ 主页.js 改造：`CONFIG/SCRIPTS/DataView/主页.js`（vault）——点击动作 QuickAdd → bz 命令；卡片无动作；移除 QuickAdd 降级链（QuickAdd 已删除）；统计/HTML 输出逐字保留；movie preset（__homeFilmStatus）保留；dataview-force-refresh-views 保留（dataview 仍渲染）
- ✅ 全量改名 memo → bz（用户决策 Q8C/Q12A/Q13A）：插件目录 `memo-suite` → `bz`（manifest id=bz，esbuild 路径已改）；**全部命令 id 统一 `bz-` 前缀**（30 个）；`src/memo/` → `src/bz/`、`tests/memo/` → `tests/bz/`；`MemoSettings→BzSettings`、`ensureMemo→ensureBz`、`unloadMemo→unloadBz`、`openMemoPanel→openBzPanel`、`setMemoSettingsProvider→setBzSettingsProvider`、`MemoSuitePlugin→BzPlugin`、`MemoSuiteSettingTab→BzSettingTab`、changelog identifier 'memo'→'bz'、CSS 类 `memo-suite-*`→`bz-*`
- ✅ 新增命令 `bz-belongings-open-panel`（归物本面板，主页归物点击需要；openBelongings 函数早已实现，只差注册）
- ✅ 保留不变：`CONFIG/STORAGE/memo.json` 数据路径、DOM id（#todo-popup 等）、中文名（备忘录/归物本等）、changelog localStorage 键（仅 identifier 变 bz）
- ✅ ADR-0004 修订（裸 id → bz- 前缀）、AGENTS.md 铁律 2 更新、CONTEXT.md 术语更新、spec.md 命令清单（30 个）
- ⚠️ 部署注意：Obsidian 视为新插件——**热键全丢需重绑**；需禁用旧插件 `memo-suite`、启用 `bz`；旧目录 `.obsidian/plugins/memo-suite/` 待用户确认后手动删
- ⚠️ 保留：`.scratch/memo-suite-plugin/` 目录名与 `issues/*.md` 历史内容（工作区历史档案，未改名）

---

## 2026-08-07 设置项补全（用户决策）

**状态：483 测试全绿（44 文件），tsc 零错误，构建已产出**

- ✅ **新增 5 项设置**（BzSettings + 设置页 + 域内消费 + 测试）：
  - 影视 `moviePageSize`（默认 '20'）：`ensureMovie` 读设置替换硬编码 50（movie/index.ts / state.ts 默认值同步 20）；**海报整理 enableQ3/posterFolder 不提供**（确认无残留代码，仅 frontmatter 海报字段读取展示；main.ts 注释已更新）
  - 日记本 `diaryBatchSize`（默认 '20'）：`applyDirectories` 读设置（diary/config.ts BATCH_SIZE）
  - 剪藏本 `articleBatchSize`（默认 '20'）：`applyArticleSettings` 读设置（clipping/view.ts BATCH_SIZE）
  - 做题家 `quizStoragePath` + 复习计划 `reviewStoragePath`（默认 'CONFIG/STORAGE'）：新增 `getQuizFilePath()`/`getReviewDataPath()`/`getReviewFilePath()` getter（tryGetSettings 安全读取，未注入回退默认路径 → 旧测试不破）；常量 QUIZ_FILE_PATH/REVIEW_FILE_PATH/REVIEW_DATA_PATH 保留为默认值导出
- ✅ **删除日记本默认标签功能**：`getDefaultTagSetting` 移除（ui-settings.ts/panel.ts 导出）；写日记弹窗打开**不预选任何标签**（dialogs.ts 删「默认选中日记」+ defaultTag 回退两处逻辑）；保存仍要求至少选一个类型（校验保留）；长按手势固定启用（getEnableLongPressSetting 保留，不暴露选项）
- ✅ 测试：+7 新测试（clipping 每批 5 条、diary BATCH_SIZE 设置/回退、movie pageSize 设置/回退、quiz/review 路径 getter×3）；改造 3 个旧测试（弹窗默认不预选、保存先手动选日记、getDefaultTagSetting 断言→getEnableLongPressSetting）
- ✅ spec.md「设置页」小节记录决策；构建产物 main.js 907KB 已直出 vault
- ⚠️ 未做（用户未要求）：applyTagsConfig（primaryTagsConfig 解析）仍无调用点；备忘录场景列表/平台映射、归物本自定义分类、剪藏本长按时长仍固定默认

---

## 2026-08-07 设置页重组 + 主页影视过滤修复 + AI Agent 选项（第二批用户决策）

**状态：488 测试全绿（44 文件），并行连续 3 次全绿，tsc 零错误，构建已产出**

- ✅ **设置页重组**（14 tab → 12 tab）：
  - 备忘录：移除「显示文件名」设置项（固定 true，字段保留，bz/app.ts 行为不变）
  - 做题家 tab 删除 → 4 项选项（允许多选题/每笔记题目数量/打乱顺序/题目难度）并入复习计划 tab，**「做题决定难度」开启时才动态显示**（仿 AI tab 的 bz-setting-hidden 模式，helper 改返回 Setting）
  - quizStoragePath 删除 → `getQuizFilePath()` 与 review 共用 `reviewStoragePath`
  - 自动摘要 tab 删除 → 启用开关并入剪藏本 tab；`WATCH_DIR` 改为读 `articleDirectory`（路径与剪藏目录一致）
  - AI Agent tab 新增 3 项：监听文件夹（aiAgentWatchedFolders 逗号分隔，默认 卡片盒,归档/网页剪藏，动态读取）、AI 剪藏匹配开关（enableAIClipMatch，关闭后仅 URL 精确匹配归档）、AI 匹配模型（aiAgentModel，core/ai json() 硬编码模型 → 改 ai.prompt 显式传参）
- ✅ **主页影视过滤 bug 修复**：主页.js（dataviewjs）写 `window.__homeFilmStatus` 遗留全局，插件读模块状态 M.homeFilmStatus（无写入方）→ 永远显示全部。`createOverlay` 现在消费 `window.__homeFilmStatus` 并清除（兼容遗留通道，读完即清防残留）
- ✅ **测试健壮性**（预存在脆弱性，stash 验证与本次改动无关）：password/ui.test.ts 7 处 150ms 固定等待 → 轮询 waitFor（3s 超时）；smoke「域命令回调」超时 5s→15s
- ✅ 新增测试 5 个：ai-agent（enableAIClipMatch=false 不发 AI 请求 / aiAgentWatchedFolders 范围外不监听）、auto-summary（articleDirectory 跟随设置）、movie（window.__homeFilmStatus 在看/想看过滤 + 清除 + 默认全部）
- ⚠️ 注意：`window.__homeFilmStatus` 是唯一新增的遗留全局读取点（AGENTS.md 铁律 6 的例外，主页.js 无法 import 插件模块）

---

## 2026-08-1x 备忘录多行输入完成（ticket 49，grilling 会话）

**状态：1052 测试全绿（79 文件），tsc 错误数 25 与基线持平（无新增）**

- ✅ **ticket 49 内容多行输入**（用户报告 + grilling 封板 4 问）：`#add-todo-content` 由 `<input type="text">` 改 `<textarea rows="1">`——Enter 换行 = textarea 默认行为零代码；保存仍走「保存」按钮（不加快捷键）；**auto-grow**（`autoGrowContent`：高度 = clamp(scrollHeight, 一行 37px, 8 行 184px)，超出 overflow-y:auto；input 事件 + 弹窗打开/编辑回填 + 场景切换清空三处触发）；样式沿用现有 inline 并显式背景/边框与主题 input 一致（resize:none / line-height:1.5 / font-family:inherit）。面板 `createCard` 纯文本分支 `white-space: pre-wrap`（cssText 统一处，linkedNote/url 链接分支不受影响）。数据格式零改动（title 原样存含 \n，粘贴产生的历史多行数据直接受益）；剪藏 placeholder 兜底与 extractUrlAndDisplay 不动（多行下裸 URL 正则 \S+ 不跨行，已验证安全）。测试 +5（textarea 元素/Enter 不触发保存/多行保存 title 含 \n/auto-grow 三态/编辑回填多行），renderer 纯文本分支补 pre-wrap 断言；旧断言 3 处 HTMLInputElement → HTMLTextAreaElement。1047→1052
- ✅ 提交：本 ticket 单次提交（见 git log）

## 2026-08-1x 番茄钟读书自动关联 spec 落盘（ticket 51，grilling 会话）

**状态：spec ready-for-agent，待实现**

- ✅ **grilling 封板（17 问）**：打开 epub 书（fork-weave-epub-reader 视图 `weave-epub-reader-standalone`，形状探测只读 view.filePath/bookTitle，不注册阅读器 API）→ 番茄钟自动进入读书专注：idle 直接开始（免确认，形态按设置：后台静默默认/自动弹窗）；休息中/他处专注中 → 确认弹窗（是=立即按读书预设开始，否=保持原样本次不再提示）；读书中换书直接切；关书自动暂停（豁免 forceFocus）；重开同一本书重新开始新专注；选否后关闭再打开/换书重新询问；Obsidian 启动时书已打开视为打开事件；同视图换书靠 tick 轮询比对 filePath 兜底
- ✅ **读书预设**：「阅读沉浸 45/10/20」第 12 项；读书模式自动切换（durations() override 不落盘），退出恢复读书前所选（含自定义）；确认后立即重启当前段
- ✅ **统计改数量**：`📚 读书 X 个 🍅`（bookCountToday 今日完成数），删 bookMinutesToday 分钟聚合，pomodoro.json 零改动（Q3 撤销分钟统计）
- ✅ **删书库 tab**：目标选择器只留备忘录/当前笔记；book target 仅自动关联产生
- ✅ **设置 +2**：pomodoroEpubAuto（默认 true）+ pomodoroEpubMode（默认 background）
- ✅ 术语入 CONTEXT.md：读书专注/读书模式/读书预设/读书番茄数
- ✅ spec 落盘：`.scratch/memo-suite-plugin/issues/51-pomodoro-epub-reading.md`（Status: ready-for-agent）
- ⏳ 待实现：epub-link.ts（决策纯函数 + 检测接线 + 确认弹窗 + 轮询兜底）+ ui.ts（forcePause/设置两项/统计行/tab 删）/ stats.ts（bookCountToday）/ config.ts（预设）/ settings.ts（两字段）/ main.ts（懒加载注册）+ 测试（决策表驱动 + UI 交互 + 检测接线 mock）

## 2026-08-1x 番茄钟读书自动关联实现完成（ticket 51-55）

**状态：全量 1209 测试通过；tsc 25 与基线持平**

- ✅ **ticket 52 读书预设 + 统计 + 删书库 tab**：PRESETS 第 12 档「阅读沉浸 45/10/20」；stats `bookCountToday` 取代 `bookMinutesToday`，弹窗统计行「📚 读书 X 个 🍅」；目标选择器删 📚 书库 tab（book target 仅自动关联产生）；设置字段 pomodoroEpubAuto/pomodoroEpubMode 落盘；测试同步（119→122）
- ✅ **ticket 53 读书联动核心**：`epub-link.ts`（getEpubBook 视图形状探测 reader viewType/filePath/bookTitle + decideReadingAction 决策纯函数 + active-leaf-change 监听 + tick 轮询兜底同视图换书 + 启动检测 1.5s 延迟）；ui `startReadingFocus/switchReadingFocus/pauseReadingFocus/exitReadingMode`（forcePause 豁免 forceFocus，状态机不动）；读书模式 durations() override（45/10/20，N 全局），退出恢复读书前预设；总开关关不注册（ADR-0003）；main 懒加载注册 + unload 清理；决策关键修复：prev=null∧book=null 不重复暂停（手动继续的专注不被 tick 误伤）、暂停后重开书=新专注（Q2）区分于手动暂停（尊重）；测试 +30
- ✅ **ticket 54 确认弹窗 + 启动形态**：休息中（skip-break）/他处专注中（enter）→ 自绘确认弹窗（zIndex 10005，esc/遮罩/否=保持原样，是=立即按读书预设开始 Q17）；选否记忆靠 prev 更新天然成立（同书不重复触发，关书重开/换书重新询问）；启动形态 popup 自动弹主弹窗；⚙️ 弹窗「读书启动形态」下拉；测试 +7
- ✅ **ticket 55 装配收尾**：spec.md 番茄钟 US 12-16 + 设置表 13 项同步；本 PROGRESS 条目；构建直出 vault
- ⚠️ 待办：手动冒烟（真实 Obsidian 打开 epub 验证）

## 2026-08-1x 通知类型系统扩展 + 全库去 emoji（用户决策）

**状态：全量 1212 测试全绿（88 文件，历史最好）；tsc 25 与基线持平**

- ✅ **通知类型扩展**：NoticeType 从 4 种 → 11 种（info/success/warning/error + pause ⏸️/accept ✨/delete 🗑️/confirm ✓/restore ↩️/skip 🚫/archive 📁），各带颜色 class（success 补绿色）；notice.ts 头部注释写入「新增通知类型规范」：新语义先查 ICONS 表，确无匹配再新增（ICONS + 颜色 + 时长），不得把 emoji 写进正文
- ✅ **全库去 emoji**：50 处单行 + 5 处手工（pomodoro 三元/暂停、memo 动态前缀）共 55 处通知调用去 emoji 前缀 + 显式传类型；脚本两处 bug 修复（FE0F 变化选择符拆分、astral 字符缺 u flag 产生 U+FFFD、模板字符串降级 16 处修复——均验证零残留）
- ✅ **测试同步**：27 处断言去 emoji；CONTEXT.md 通知/文案规范更新（正文不带 emoji、类型图标即前缀、z-index 修正 100000）

## 2026-08-1x 附件搬移新域完成（ticket 65）

**状态：全量 960 测试通过（75 文件），tsc 通过；含新域 attach 23 个测试**

- ✅ **ticket 65 附件搬移**：新域 attach，命令 `bz-attach-move`（中文名「移动附件」，icon folder-down）——解析当前笔记引用的 vault 内非 .md 文件（wikilink 嵌入 + md 链接）→ 自绘文件夹选择弹窗（记忆上次 `attachLastFolder`，运行时字段不暴露设置页）→ `app.fileManager.renameFile` 移动（自动更新内部链接）；仅目标文件夹存在同名才改名（`原名 (N).ext`）；不删空目录、无预览确认直接执行 + 结果 toast（移动/改名/失败数）
- ✅ **链接更新（v2 修正，用户实测 v1 卡顿）**：改用 Obsidian 内建 `app.fileManager.renameFile` 移动并自动更新全库内部链接（ADR-0014），删除 v1 自研全库改写引擎（buildLinkFromRef/planRewritePairs/applyReplacements）——v1 全量读取解析所有 md + 逐个 modify 大库卡顿；自研解析仅保留收集与去重命名（parseLinkRefs/resolveTarget/collectResources/planMoves）；无 fileManager 的异常环境回退 vault.rename 并 warning「链接未自动更新」
- ✅ **主页磁贴播种**：main.onload `ensureAttachSeed` 幂等，desktop+mobile 各 `placeAtEnd` 末尾追加 1×1，写 launcher.json（失败静默）；smoke 登记 `bz-attach-move`
- ✅ **文档/规范**：spec.md 命令 id 全清单 + 决策条目；CONTEXT.md 新增「附件/附件搬移/链接改写」术语；ADR-0014（改用 fileManager.renameFile，弃用 v1 自研改写）；测试 data 15 + ui 8



## 2026-08-23 小橘数据面板完成（ticket 071）

**状态：全量 1349 测试通过（97 文件），tsc 通过；含新面板 14 个测试**

- ✅ **ticket 071 smartcat 数据面板**：新命令 `bz-smartcat-dashboard`（中文名「小橘数据面板」，icon activity）——只读可视化 smartcat.json 全量状态，四页签（总览/情绪/人格/记忆）：当前心情 5 档英雄区 + PAD 三轴、情绪趋势/波动度（VAD+EMA 复用 cognitive）+ 分布 + 演变时间线、OCEAN 出生种子 + 30 特质九群组 + 关系张量（信任/依恋/情绪基调）+ 成长轨迹、记忆流统计 + 作息分布 24h 直方图 + 来源分布 + 最近记忆列表；🔄 刷新现读现渲染
- ✅ **实现要点**：`src/smartcat/dashboard.ts`（纯函数层可测 + createOverlay/.bz-win-head/escManager 主窗口规范）；数据经 loadSmartCatData 现读，与常驻猫实例解耦（smartcatEnabled=false 也可看）；面板只读不写盘（铁律 1）；mood.ts 抽纯函数 `moodLevelFromPad`（computeMoodLevel 委托，行为不变）
- ✅ **主窗口规范三件事**：settings.ts 新键 `smartcatDashboardMobileDefaultFullscreen`（默认 false=常规卡）；打开路径 applyMobileWindowFullscreen；小橘设置弹窗挂「移动端默认全屏（数据面板）」行（仅移动端显示）
- ✅ **清理接线**：unloadSmartCat 调 closeSmartcatDashboard()（DOM + ESC 句柄）；smoke 命令清单 +1（38 命令）