# review-deep-ux — 逐域深审（体验线：交互效率 / 信息呈现 / 一致性范式）

> 2026-09-18 起，逐域串行：每域 5 个方向并行深查，体验类发现落本报告（每条带动机+方案+成本），bug 类落 `review-deep-bugs.md`。
> 星级：★★★ 强烈建议 / ★★ 值得做 / ★ 锦上添花。成本：S 小改 / M 域内一批 / L 跨域或数据结构。

## core（共享层）2026-09-18 深审 · 体验线

> 明细：`.scratch/review-deep/core-{efficiency,consistency}.md`。效率 15 条 + 一致性 16 条；与 review-ux-suggestions.md 39 条及 144 已拍板项去重后执行。

### ★★★（本轮必修）
- **效率#1 = R8 = 一致#15**（三方独立确认）`core/flow-dialog.ts:95-96,185-187` — danger 确认框打开即聚焦删除钮，回车直通不可逆删除（ADR-0125 只降了视觉没降焦点）。修：dangerPrimary 时 focusId 让给取消动作，回归 sweep-core-fixes C14 组。成本 S。

### ★★（本轮做）
- **效率#2 = R13** `ui/modal.ts:24-79` — uiModal 无焦点管理（打开不聚焦/关闭不还原），各域各写 setTimeout focus。修：内置打开聚焦 + 关闭还原 + `autofocus:false` 逃生口。S。
- **效率#3** `ui/modal.ts` — 表单回车提交无共享基元，memo/favorites 主表单纯鼠标流程。修：core 新增 `bindFormSubmit`（Ctrl+Enter 恒提交、单行 input Enter 提交、textarea 不拦），两主力表单接入。S/M。
- **效率#4** `flow-dialog.ts:97-99` — message 不支持换行，diary 多行确认文案挤成一行。修：escapeHtml 后 `\n`→`<br>`。S。
- **效率#7** `notice.ts:541` — 常驻错误帧点本体即关：选字复制/点歪即失。修：persistent 帧点本体不关 + 右上 ✕ 钮。S。
- **效率#10** `path-picker.ts:396-419` — 选不到还不存在的目录，配置链路断第一步。修：底部「新建文件夹」（vault.createFolder + 刷新勾选）。S。
- **一致#2** `cinema/ui.ts:244` — panelToast 域内第二通知通道绕开 notice 单源，通知偏好对影院失效（pwv 已收编出先例）。修：改调 notice()，删 .cn-toast 样式段。S。
- **一致#4** 相对时间五套口径互异（同 3 小时：收藏本「3 小时前」/备忘录「3小时前」/密码本「今天」）。修：core/ui/str.ts 落零依赖 relTime（favorites 蓝本：带空格、7 天封顶回落 M-D——拍板记录），utils.formatRelativeTime/favorites/password-vault 转发；smartcat（排除域）与 review（未来向豁免）标注后续。M。
- **一致#16** `favorites/shared.ts:167-169` — 空态一行灰字，唯一未接 uiEmpty 单源的域。修：emptyHtmlStr + 添加动作。S。

### ★（打包做，S 级收编）
- 效率#5：core 写明「接 notifyUndo 的删除不再二次确认」口径（notice.ts 注释 + 手册）。
- 效率#6：`trapFocus(container)` 工具，三壳+lightbox 接入（与 #2 一并）。
- 效率#8：notifyActionError 加 `onRetry` 可选重试按钮（auto-summary 已示范、被迫绕 API）。
- 效率#9：NoticeHandle.setAction() + dedupe 合并路径返回真句柄（belongings 被迫唯一化绕行）。
- 效率#11：路径选择器 Enter 选首匹配 + 单选双击直选。
- 效率#12：uiSuggest 无高亮项时放行 Enter 不吞（表单回车提交的前置）。
- 效率#13：uiLockScreen 内置回车提交，删 encrypt×2/pwv×1 域内重复接线。
- 效率#15：uiPopover「输入锚定 keyboard」手册超前于代码——拍板：手册 §4 该段标注「规划中」（避免文档承诺漂移）。
- 一致#3：notifySaveError 全集补遗 10 处手写绕行收敛（favorites:816 一域两制/belongings:1045/diary dialogs:459/pomodoro:528/settings-panel:60/bookshelf:438/home:105/clipbook:106,138；knowledge 排除域跳过）。
- 一致#5：formatFileSize 改通行口径「x.x KB」，encrypt 两处收编（secondbrain 排除域标注）。
- 一致#6：文本符号 ✕/＋ 换 uiIcon('x')——本轮修 review/render.ts:460、settings-panel/renderer.ts:236、path-picker.ts:188 三处；knowledge 5 处（排除域）标注后续。
- 一致#8：localNow 单源收编 memo 3 处（knowledge 排除域跳过）。
- 一致#9：确定钮动词拍板「编辑=保存、新建=添加」，favorites 标签/条目两处 + belongings 收敛（favorites:926 已对）。
- 一致#10：password-vault:582,847 英文引号换「」。
- 一致#11：diary 删除通知带条目标识（entry-actions.ts:91）。
- 一致#12：review 监听文件夹名单收编 uiSetlist（render.ts:459-461）。
- 一致#13：home/styles.css 删 3 行冗余滚动条声明（单源通杀已覆盖）。

### 记录不修（低风险侧处理或后续）
- 一致#7：ICONS 表 4 个零消费类型（accept/confirm/skip/archive）删除；`q3-confirm` 旧名 DOM 契约冻结仅记录。
- 一致#14：uiMainHead/uiRail/uiMobStrip 工厂零消费——手册 §4 标注「推荐 render 纯层用共享类手写；工厂适用行为层动态构建」。
- 一致#15：favorites 空态视觉变动、效率#5 存量域删除确认收敛——按手顺渐进，不强改。

## diary（日记本）2026-09-19 深审 · 体验线

> 明细：`.scratch/review-deep/diary-{efficiency,consistency}.md`。效率 16 条（★★★×2）+ 一致性 8 条。

### ★★★（本轮必修）
- **效率#1** `dialogs.ts:283,220`×`config.ts:185` — 写日记必选标签却要在约 40 个平铺 chip（含「收藏」13 子标签混排）里人肉扫描，移动端保存钮要滚动才够到。修：标签过滤输入框 + 按使用频次前置（diary:entry-added 历史）+ 保存钮 sticky 底栏；写弹窗与改标签选择器一处数据源两处受益。M。
- **效率#6** `ui.ts:450-466,2417` — 墙的时间位置感缺失：日期筛选生效后头行只显示「N 条」、年月限定不可见、清除要三步、无「回到今天」，次日开墙像「今天的日记丢了」。修：range 文案带筛选年月 + 可点清除胶囊 + 头行「今天」钮。S。

### ★★（本轮做）
- **效率#2** core `bindFormSubmit` 基元（core/ui/modal.ts：Ctrl+Enter 恒提交、单行 input Enter 提交、textarea 不拦）+ diary 接入（`#add-diary-popup`→saveNewEntry、`#diary-tag-selector-popup`→保存回调；手输日期框 Enter 已被 commitManualEdit 消费注意冒泡次序）+ openAddDialog 聚焦 no-op 一并修。S。
- **效率#4** 补写昨晚路径显性化：日期行常驻「此刻 / 昨天」chip、双击手输改显性入口、直开时滚轮年份范围 1900 假值改 earliest-year 探测。S。
- **效率#8** 搜索每击键全墙 MarkdownRenderer 重渲「越搜越卡」——改增量显隐（widx 映射 toggle display），仅空结果/首渲走整墙重建。M。
- **效率#12** 「加密」动作零二次确认（CONTEXT 明文承诺二次确认，实现脱节；右键滑错一格条目当场消失）——ensureSafeUnlocked 后补 openFlowDialog；顺带更新 CONTEXT 词条。S。
- **效率#13** 开墙无加载态，大库首屏秒级空白像「日记全没了」——骨架占位 + 「正在翻日记…」。S 档。
- **效率#14** 读墙失败渲染「写下第一篇」空态，错误与真空不可辨——mkEmpty 分流错误态 + 重试按钮。S。
- **效率#15** 弹窗族触控目标 ~33px 低于 44px 硬规则（写日记第一下就点错标签）——挂 bz-touch-target--xl + ≤768px padding 抬档。S。
- **效率#16** 手输日期软键盘盖住下半弹窗——手输 focus 时 popup 加 `.keyboard-up` 上移档。S。
- **一致#2（部分：dialogs 两浮层）** 写日记/标签选择器手绘壳迁 uiModal——一波拿到 ESC 层、焦点管理、requestClose 脏拦截、token 对齐、bz- 前缀（core 滚动条特例枚举可摘）。M。
- **一致#4** 空态自绘 `.bz-diary-empty` 14 条样式双轨——接 uiEmpty 单源，删域内样式。S。

### ★（打包做）
- 效率#5「再写一条」次级钮：登记不修（379 单发语义是拍板，保持单一心智）。
- 效率#7 移动端月份导航胶囊：M，登记待做（移动端回看上月靠无限下滑是真实痛点，下批机会）。
- 效率#9 搜索命中高亮：S/M，随 #8 顺带（先纯文本卡）。
- 效率#10 灯箱内「⋯」动作（打开原文）：S，本轮做。
- 效率#11 移动双击跳原文可发现性：保留手势记录在案。
- 一致#1 新建日记确定钮「保存」→「添加」（全域最后一处不符新口径）。S。
- 一致#3 datetime-picker 内联滚动条两行删（core 通杀已枚举）。S。
- 一致#5 esc 层 id 补 bz- 前缀（bz-diary / bz-diary-datetime）。S。
- 一致#6 datetime-picker 档位对齐（font-weight 900→700、--text-muted 当背景→hover 族、font-family 硬编码删、死选择器 #add-diary-content 清）——144 通病 5 执行时按此清单。S。
- 一致#7 微收口：localDayKey/pad2/placeholder「1 分钟前」三处一行改。S。
- 一致#8 + arch A9 AGENTS.md「diary 写日记命令域内注册」表述漂移修正。S。

### 记录不修（登记）
- A6 内联样式债（144 通病 5，~76 处）：分批搬 styles.css，本轮随壳收编消化弹窗族部分，余量登记。
- A8 写放大（写一篇重读四目录全量重渲）：增量路径数据面已就绪，待真实卡顿立项。
- 效率#7 移动端月份导航：下批机会。

---

## memo（备忘录）2026-09-19 深审 · 体验线

> 明细：`.scratch/review-deep/memo-efficiency.md`（★★×8 + ★×6，成本 S×12/M×2）+ `memo-consistency.md`（15 条）。唤起面四路齐备是全域少见好形态；缺口集中在弹窗键盘链路与检索退出语义。bug 线部分见 review-deep-bugs.md memo 节。

### ★★（本轮做）
- 效率#1/一致#3 编辑器弹窗键盘流断头：bindFormSubmit 未消费、场景弹窗手写 Enter/Escape 双轨——三弹窗统一基元（bug 线 P2）。
- 效率#12 移动端编辑弹窗不吃 --bz-vvh：软键盘盖住场景/截止/保存整段；域内经 skinClass 定向接管（`max-height: var(--bz-vvh)` + mask 顶对齐）。
- 效率#14/func M2 初始 loadData 零 catch：读盘失败=面板永久空白连空态都没有——错误态+重试（bug 线 P2 读链健壮化）。
- 效率#4 编辑器保存无防连点（bug 线 P2）。
- 效率#5 搜索框 ESC 误关整个面板：有词时清词不关，无词放行（diary「ESC 只清空」先例）。
- 效率#10 桌面卡体单击零反应、编辑藏右键二级：双击卡体直开编辑器。
- 效率#11 已完成区无批量出口：「清理更早」入口 + deleteCompletedBefore + 批量 notifyUndo（确认框保留：批量不可逐条反悔）。
- 一致#1 脏表单拦截（bug 线 P1，144 挂账清账）。

### ★（打包做，S 级）
- 效率#2 打开面板零聚焦（桌面 composer，notePath 分支聚焦搜索框）。
- 效率#3 截止快捷档 chip「今天 18:00 / 明天 09:00」（diary「此刻/昨天」同范式）。
- 效率#6 搜索 ✕ 一键清除 + 空态「清除搜索」钮兑现文案承诺。
- 效率#7 搜索命中 title 段 `<mark>` 高亮（先转义后替换防注入）。
- 效率#8 搜索域补 checklist 子任务与 url。
- 效率#9 搜索增量显隐轻版（数百条内无感，机制对冲）。
- 一致#5/#6/#9/#10/#11/#12 微收口族：localDayKey/pad2、月历空态接 emptyHtmlStr、月历壳收 render.ts、hint 过期文案、placeholder 常量化+dataset 哨兵、composer 通知带条目标识。

### 记录不修（登记/拍板）
- 效率#13 移动滑动手势：锦上添花且需真机拍板手势互斥，登记。
- 一致#13 设置写盘全域无 catch：memo 本轮补 commitScenarios/doSave 两处（写失败可见），「saveSettingsQuiet 低价值静默写」作为 core 级微基元待立项。
- 一致#14 openExternal 三域副本：本轮收 core/utils 单源（零行为差），favorites/literature 同步替换。
- 一致#15/M3-9 皮肤档位（font-weight:900 等）与手册位阶：走文档成文豁免（ui-design-manual 补记），不改样式值。
- 一致#2 删除双保险：memo 本轮对齐效率整改 5（免确认直达 notifyUndo），**favorites/belongings 同款滞后待各自域轮**——防域间不一致的跟进项，已记 bugs 账。

---

（下一域：clipbook）
