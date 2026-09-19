# review-deep-bugs — 逐域深审（bug 线：功能正确性 / UI 交互缺陷 / 架构规范）

> 2026-09-18 起，逐域串行：每域 5 个方向并行深查（功能正确性、UI 交互、交互效率、一致性范式、架构测试），bug 类发现落本报告，体验类落 `review-deep-ux.md`。
> 严重级：P0 丢数据 / P1 功能错 / P2 硬伤 / P3 瑕疵。
> 排除域：smartcat / secondbrain / knowledge(literature)；recap 已退役只标注。

## core（共享层）2026-09-18 深审

> 明细：`.scratch/review-deep/core-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；旧账 C1–C16+N3 复核全部在位，N1/N2/N4/N5/N6/N7 未修并入本轮。旧 P3「N7 lightbox 查询串」「N2 onunload 四浮层」一并修。

### P1（旧账在线）
- **N1** `core/esc-manager.ts:60-64`×`main.ts:350` — destroy() 硬摘 document keydown 无重挂入口；同会话禁用→启用插件后全站 ESC 永久失效、layers 累积。修：软关（disabled 旗标）+ `arm()` 供 onload 调用。

### P2（新发现 + 复核升级）
- **新-1** `core/settings-schema.ts:469`×`settings-modal.ts:119-126` — 设置弹窗文本行 800ms 防抖窗口内 ESC/程序化关闭，聚焦元素随 DOM 移除不派发 blur，最后一次编辑静默不落盘。连带 `:446-458` changeCb 无 try/catch。修：关闭前对 popup 内 activeElement 调 `.blur()`；changeCb 包 try/catch。
- **R1（C5 回潮）** `core/ui/select.ts:172-174` — uiSelect 下开着下拉、焦点在 el 上按 ESC：el 级 close 后事件继续冒泡，escManager 关掉宿主面板（memo/gameshelf 可复现）。修：Escape 分支 `stopPropagation()`（对齐 uiSuggest）+ el 级派发回归用例。
- **R2** `core/ui/setlist.ts:54`×`ui/components.css:703-711` — 移除钮只挂 `bz-touch-target--xl` 修饰类缺基类，`::after` 热区死类，实际 20×20px 违反 44px 硬规则（同款死类扩散 diary/encrypt 模板）。修：② 修饰类自带热区（一处全站复活）+ ui-kit-manual 补记。
- **一致#1** `cinema/ui.ts:509`×`cinema/shared.ts:302` — 影院删除确认是全域唯一自绘确认框（无回车确认/焦点管理/aria/ADR-0125 中性主钮）。修：openConfirm 迁 openFlowDialog，删 confirmModalHtml。
- **架#1** `prototypes/{secondbrain,clipbook,diary}/fake/fake-obsidian.ts` — MarkdownRenderer 假层仍是覆盖语义，违反 ADR-0122「一律追加」，issue 275 型双份缺陷评审壳测不出。修：三处 fake 改追加 + ADR 注释 + 重出原型产物。

### P3（bug 类）
- **新-2** `core/utils.ts:168-181` fetchPageTitle 无超时，远端挂起 Promise 永不 settle。修：改走 `httpGetText` 单源（8s）。
- **N4 残留** `settings-main-schema.ts:170-190` 「最大输出 token」无 min，负数 truthy 直通服务商 400。修：补 `min:0`。
- **N5** `settings-schema.ts:415/577/601/618/635/653` 各行型 persist 裸奔无 catch，落盘失败 UI 显新值盘上没有且无提示。修：try/catch + notifySaveError（与 C10 同口径）。
- **N6** `settings-schema.ts:574-589`×`path-picker.ts:243-253` path 行 onChange/apply 无 try/catch，域回调抛错即 unhandled rejection。修：两侧 catch + notifySaveError + 回滚。
- **R3**【潜伏】`ui/field.ts:20-45` uiField 是 label，包裹含 button 控件时点字段名误选首项。修：control 为按钮族时改 div 版式 + 手册标注。
- **R4** `ui/components.css:294` `.bz-field` 缺 position:relative，与手册 popover 锚定指引矛盾（4 个域各自补丁）。修：基类补 relative。
- **R5** `ui/components.css:603`×`select.ts`/`popover.ts` 弹窗壳 overflow 剪裁下拉浮层且菜单无翻转。修：下方空间不足时向上翻。
- **R6** `notice.ts:434-445` 通知 action 按钮（撤销）键盘不可达。修：tabIndex + Enter/Space。
- **R7** `path-picker.ts:452-477,537-540` 列表行键盘不可达、关闭不还原焦点。修：行 tabindex/键盘 + 焦点还原。
- **R9** `settings-schema.ts:446-459` number 钳制后「显示值≠落盘值」、非法输入静默。修：钳制值回写输入框 + 非法值行内报错。
- **R10**【潜伏】`ui/resize.ts:177-181`、`splitter.ts:146-148` document 监听无离场自愈。修：`!isConnected` 自摘（C12 同款）。
- **R11** `ui/stat.ts:35` 可点统计卡键盘不可达。修：role=button + tabindex + 键盘。
- **R12**【待验证→证实】`dom.ts:77-87` swallowNextClick 窗口外松手后误吞键盘激活 click。修：clientX/Y===0 放行；先代码走查证实。
- **架#2** `scripts/build-css.mjs:39-40` SOURCES diary 样式登记两次，产物 952KB 里 1734 行翻倍（b1876e7b 引入）。修：删重复行，主仓重出 styles.css。
- **架#3** `core/file-sync.ts:152-159` rename 范围外判定在去抖外逐事件全量读盘，批量改名成读风暴。修：判定挪进去抖批次或窗口内缓存。
- **架#7** `crypto.ts:79-86`×`ai.ts:655-667` 分块 Base64 双实现。修：toBase64 导出收编 + 往返断言。
- **架#8** `tests/core/{path-classify,domain-bus,obsidian-adapter}.test.ts` 纯数据层测试缺 node pragma。修：首行补 `// @vitest-environment node`。
- **N7**【潜伏】`ui/lightbox.ts:60` 媒体后缀判定不剥 query，带查询串视频被当 img。修：剥 query 再判。
- **N2** `main.ts` onunload 不关 settings-modal/model-picker/path-picker/lightbox 四浮层。修：补四行幂等调用。

### 测试缺口（本轮补）
- 架#4 lock-screen 专测（结构槽位/firstSetup 三态/setBusy/setSec/inline/close）；架#5 viewport 专测（bind 幂等/unbind 清理/MIN_VVH/无 visualViewport 兜底）；架#6 settings-common 行为测试（numStrBinding/makeReloadWarnOnce/SYNC_WATCHED_FOLDERS 冻结）。

### 拍板记录（无人值守）
- N7/R3/R10/R12 潜伏类：证实即修（R12 走查+校验 clientX/Y===0 修法，回归以代码走查记录）。
- 拍板类一律选低风险侧执行，理由记 ux 报告。

### core 修复闭环（2026-09-19）

五批修复代理（E 架构生命周期 / C 确认框 / D 一致性 / A 设置系统 / B 组件交互）全部合并，主构建已部署。门禁演进：基线 366 文件 / 5780 例 → 终态 **372 文件 / 5884 例全绿**（tsc 0 错），新增回归测试约 104 例。全部 P1/P2 修复，P3 除「记录不修」外全修。要点：
- 旧 P1 N1（禁用再启用全站 ESC 失效）终获修复：esc-manager 软关 + arm。
- 代理修正拍板一处：ICONS `archive` 类型有 favorites 消费方，保留（原拍板删 4 个 → 实删 3 个）。
- 一致#12 review 名单收编 uiSetlist 因 render 纯层白名单降级为仅换图标（源码注释留痕）。
- 流程沉淀：worktree 重出的原型产物因 LF/CRLF 行尾指纹假红，**每批合并后主仓重跑 `node scripts/build-preview.mjs`** 已成固定动作。
- 遗漏转案：效率#3「bindFormSubmit 表单回车提交基元」未入五批清单，转 diary 域修复批一并落（core/ui/modal.ts 加基元 + diary 弹窗先接入）。

## diary（日记本）2026-09-19 深审

> 明细：`.scratch/review-deep/diary-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；新发现 P2×4 + P3×36 + 体验/一致性 24 条；旧账 review-all2 D' 系 9 条全部在线未修，并入本轮。

### P2
- **N1（func）** `diary/ui/dialogs.ts:133,160-197` — 改标签「保存」整链无兜底 catch：写盘失败/保险箱中途上锁（`getDiaryEntryPlain` 是 throw 非返回 null）→ unhandled rejection 静默假成功，弹窗假关用户零感知。修：整链 try/catch + error 通知；加密分支保存前 `isUnlocked()` 短路；`relockWallMedia` 补 `hideTagPicker()` 收 body 级选择器。
- **D-UI1（ui）** `diary/ui.ts:2102`×`core/item-actions.ts:452`×`styles.css:860` — 抽屉头缩略图开灯箱被抽屉整体遮挡（灯箱 z 90 是面板内静态层，抽屉 body 级动态号）→ 点击无反应、ESC 空按。修：mkSheetHead 缩略点击先 `closeSheet()` 再 openLightbox。
- **D-UI2（ui，旧 D1' 转正 + 144 补遗）** `diary/ui/dialogs.ts:262,86`×`ui.ts:2177`×`index.ts:44` — 写日记弹窗/标签选择器无 ESC 层（bz-diary-write 直开时 ESC 完全无效）、hide() 不摘两 body 级 mask 成孤儿、遮罩点击直接 display:none 静默丢已选输入、连「取消」钮都没有。修：escManager 注册两层 + 有输入走 confirmDiscard + hide() 兜底摘 mask + 补取消钮。
- **A1（arch）** `diary/parser.ts:55-60,90,175,234` — 影视/信/书条目时分仍取 ctime（ADR-0157 宣称该口径已清零，表述失真）；信件 frontmatter `date` 的 HH:mm 半段解析后被丢弃。修：信件用 frontmatter 时间段；影视/书短期回落固定 00:00 或对端域补结构化时间；ADR-0157 补记豁免。

### P3（bug 类，摘要）
- **func N2** recap/aggregate.ts:306 加密过滤口径与墙二次漂移（正文 🔐 vs encrypted 标志）——recap 侧删 `isEncryptedEntry`。
- **func N3** store.ts:265 重复标签集误判「无变化」静默不写盘——改有序集合逐位比或 parse 去重。
- **func N4** store.ts:267 改标签重写 frontmatter 静默丢弃契约外用户自加键 + name-mismatch 文件被单方面归一——逐键保留未知键，mismatch 拒写引导体检。
- **func N5** ui.ts:2325 墙只听 modify 不听 create——外部新建/移入条目文件不上墙；补挂 create 订阅。
- **func N6【待验证→证实】** config.ts:43 目录设置尾斜杠致监听前缀恒不命中——applyDirectories trim 尾斜杠（与 data.ts 同口径）。
- **func N7【存量】** encrypt.ts:129 legacy 日期路径加密日记不上墙——补 diaryDateFromLegacyPath 兜底（与 mergeDiaryBlock 同套）。
- **func N8** dialogs.ts:358,428 光标停子目录条目写日记默认取其日期但落顶层目录——openAddDialog 透传目录。
- **func N9** encrypt.ts:56 加密含数百 MB 视频无体积守卫 OOM 风险——单附件超 64MB 跳过并通知。
- **func N10** ui.ts:1740 抽屉入口进灯箱不存 `_lbSeqMain` 连看序列退化单条——对齐时光条口径。
- **func N11** datetime-picker.ts:684 syncDateTime 死代码——删。
- **ui D-UI3** ui.ts:211 搜索防抖尾触「复活」清空后 250ms 关键词回魂——收起/ESC 分支补 `_searchDebounced.cancel()`。
- **ui D-UI4** ui.ts:405 灯箱触屏滑动切图误吞视频进度条手势——touchstart 过滤 video/audio/button。
- **ui D-UI5** dialogs.ts:385 openAddDialog 聚焦 display:none 的 hidden input，意图从未生效——改聚焦可交互元素。
- **ui D-UI6** ui.ts:522,635,1068×render.ts:77-79 热区 --xl 复活后紧凑行命中区重叠 16px 误触——头行钮去 --xl（自身已 42×46 达标），chips 改 padding 抬档。
- **ui D-UI7** styles.css:1113 移动实例 100vh 架空 core `--bz-vvh`——改 `var(--bz-vvh, 100vh)`。
- **ui D-UI8** repair-modal.ts:76 点条目打开文件后全屏弹窗不关——openAtTop 成功后 close()。
- **ui D-UI9** styles.css:1488 日期筛选弹窗移动端关闭钮 32×36 低于 40px 下限——抬档或挂热区类。
- **ui D-UI10** datetime-picker.ts:86,636 滚轮列键盘不可达、手输入口靠 dblclick——displayArea tabindex + 键盘开关滚轮。
- **ui D-UI11** dialogs.ts:40-48 标签名/emoji 走 innerHTML，配置含 HTML 片段时注入——textContent + createElement 拼装。
- **ui D-UI12** dialogs.ts:394 保存进行中静默吞连点无反馈——saveBtn disabled + 「保存中…」。
- **arch A2** ui.ts:1934,1987 墙菜单加密/解密不发域事件（五通道半边空洞）——成功分支补发 `diary:entry-deleted`/`diary:entry-decrypted`。
- **arch A3** entry-actions.ts:88 注释声称 store 发 file-vacated 通道，事实已退役——改注释。
- **arch A4** ui.ts:1191,977,1896×entry-actions.ts:29 v2「日期.md」路径拼装兜底死码——删四处，异常条目显式报「找不到原文」。
- **arch A7** prototypes/diary/fake offref 清空全部监听而非摘单个 ref（ADR-0122 假层语义缺陷）——按 ref 过滤移除。

### 旧账在线（review-all2 D' 系，全部并入本轮修复）
- **D2'（P2）** datetime-picker.ts:138 「先 set 后钳制」死代码，1月31日点2月→3月3日漂移——set 前记录原 day，set 后 `date(Math.min(origDay, daysInMonth()))`。
- **D5'** data.ts:194,218 批量读无单文件容错，任一文件抛错整墙空——per-file try/catch 跳坏文件。
- **D6'** ui.ts:1828 灯箱回填无会话代次，重开后旧慢解密 promise 穿透——generation 计数。
- **D7'** ui.ts:654 灯箱开着 `_lbSeq` 重建步进落错——lbVisible 暂缓重建或步进前重新定位。
- **D8'** ui.ts:2032 抽屉被 core 关闭后 sheetEntry 不复位，ESC 空按一次——esc 分流探测 `.bz-item-sheet` 不在则清 sheetEntry。
- **D9'** ui.ts:2165 面板关闭期间上锁，重开 lockedVisible 不重置——show 按 isUnlocked() 重置。
- **D10'** repair-modal.ts:52,198 体检扫描无 catch 进度条永停——外层 catch 回可重试态。
- **D14'** encrypt.ts:27-50 unlockedListeners 等死代码无调用方——删。

### 拍板记录（无人值守）
- N7/N9 存量加密兼容：按「补兜底 + 加守卫」低风险侧修。
- 效率#11 双击跳原文：保留手势，报告记录可发现性问题，不砍。
- A6 内联样式债（144 通病 5）、A8 写放大：登记为技术债，本轮不做（弹窗族壳收编时随壳消化 dialogs/datetime-picker 部分）。
- AGENTS.md「diary 写日记命令域内注册」表述漂移：随批修正。

### 登记不修（登记性技术债，本轮不做）
- **A6** 写链路弹窗族内联样式 + 非 `bz-` 前缀类名（arch A6/一致#2/#6，144 通病 5 余量）：渐进收编——新改动零新增内联样式，存量随「弹窗族壳收编」批搬 styles.css 并前缀化，不单独立项。→ 本轮 A 批已随壳收编消化 dialogs/datetime-picker 大头。
- **A8** 写事件全库重读四目录 + 全量重渲染（arch A8）：400ms 防抖、视口懒加载、issue 217 F3 单端渲染等缓解充分，当前库量无感，待真实卡顿再立项增量路径。
- **效率#5** 连续记录多条要反复走命令（efficiency #5）：issue 379「保存即开笔记」是单条主流程拍板正解，「再写一条」连录增益存疑，保持单一心智不加深链路。
- **效率#7** 移动端无月份导航（efficiency #7）：成本 M 且需先拍板移动端导航形态（常驻胶囊 vs 步进钮），待移动端体验专项一并做。

### diary 修复闭环（2026-09-19）
五批分支 `bz-fix-diary-{doc,data,picker,dialogs,wall}` 串行并入（合并序 E→B→D→A→C），产物冲突按主仓 `node scripts/build-preview.mjs` 仪式重出解决；styles.css 一处真实冲突（A 壳收编删手绘样式 × B 新增快捷 chip/keyboard-up 规则）手工合并——保留 B 规则、keyboard-up 因 uiModal flex 居中改 `translateY(-20vh)` 等效档、删 A 已退役的死 id 焦点规则与手绘壳样式。**主线程收口**（提交 b603cbb7）：①ui.ts `hide()` 补 `hideAddDialog()`/`hideTagPicker()` 兜底 + `relockWallMedia()` 补 `hideTagPicker()`（func N1 配套，dialogs.ts 新增 `hideAddDialog` 导出）；②E 批契约测试 `EMIT_*` 开关翻 true（C 批 A2 已补发两通道事件），flow-dialog mock 自动确认适配效率#12 确认弹窗；③ui.test.ts/wall-fix-c.test.ts dialogs mock 补 `hideAddDialog`/`hideTagPicker` 导出；④dialogs-fix-a D-UI5 焦点断言适配 B 批 D-UI10（displayArea tabindex=0 成首焦点）。**门禁**：tsc 0 错误；全量 380 文件 5991 例全绿（基线 5780）；`pnpm run build` 部署（4771ed08）。

---

## memo（备忘录）2026-09-19 深审

> ⚠️ **2026-09-19 回滚失效**：用户当日 revert `a0de3395` 将备忘录域整体强制回滚至 f6a0bc90 基准（周期/月历/子任务引入之前），本节全部闭环修复随滚不在当前代码。memo 已列入队尾重新深审；本节仅存方法与结论线索，重审须按回滚后代码逐条重新取证。回滚后基线：tsc 零错、tests/memo+checkup 202 例全绿。

> 明细：`.scratch/review-deep/memo-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；去重后 P1×1 + P2×13 + P3×22 + 测试缺口 9；旧账 N8（jumpToNote）三方向复核确认仍未修，并入本轮。门禁基线：tests/memo 15 文件 229 例全绿。

### P1
- **脏表单拦截（consistency#1，issues/144 通病 3 挂账）** `memo/ui.ts:1725` — 编辑器是全域字段最多表单（内容/清单草稿/场景/优先级/截止/重复/定位/剪藏三件），ESC/遮罩一键全丢无确认；favorites/belongings 均已接 requestClose+confirmDiscard。修：对齐 belongings 形制——全字段快照 + requestClose 脏检测 + confirmDiscard(skinClass())。

### P2
- **M1（func）** `ui.ts:1636-1643` — 编辑保存把 monthly/yearly 的 anchorDay 静默剥掉，「每月 31 号」编辑一次退化为「每月 28 号」，击穿月末钳制不漂移语义。修：days 的 recurTouched 门控扩成「未触碰保留原 recur（含 anchorDay）」。
- **读链健壮化（func M2/M7 + arch A9 + 效率#14）** `data.ts:232-239,145-164`×`ui.ts:540-549,156-159,1904-1919`×`reminder.ts:69-82` — loadItems 对数组内 null 元素裸崩 TypeError + normalizeItem 零字段容忍（title 为 null 时整列表渲染中断）；loadData/refresh/ensureMemo/addMemo/reminder 全部 void 无 catch——读盘失败=面板永久空白无提示 unhandled rejection。修：元素级守卫剔除坏数据 + 字段 String 兜底 + 读链 try/catch → notifySaveError（带重试）+ 面板错误态。
- **编辑器防重入（func M3 = ui M2-1 = 效率#4）** `ui.ts:1621-1723` — 保存 await 窗口期双击双插同文条目（composer 有 composerBusy，编辑器漏配）。修：busy 旗标/disabled + finally 复位，与 bindFormSubmit 合并做（回车/按钮同一 doSave 入口）。
- **M4（func）** `ui.ts:1019-1032` — 清单取消勾选自动恢复漏周期撤链守卫（restoreItem 已修的 hasPendingNextItem 同型），链上已有下期再完成即重复生成；且不发 restored 事件口径不对称。修：复用 hasPendingNextItem + chained 时 recur:null + 补发 restored。
- **bindFormSubmit 消费（ui M3-11 = 效率#1 = consistency#3 = arch A4）** `ui.ts:1725,1778-1781,1862-1865` — 编辑弹窗无键盘提交（Ctrl+Enter 没绑、单行 input Enter 空转）；添加/重命名场景两弹窗反而手写 Enter/Escape 冗余通道（绕过 escManager 与未来 requestClose）。修：三弹窗统一 bindFormSubmit(popup, doSave)，删手写 keydown。
- **M5 + M2-2（func/ui）** `ui.ts:516-519` — composer Enter 无 isComposing 守卫（移动端 IME 确认候选即误落盘）；且移动端 Enter 直落盘绕开 issue 268「移动=开创建弹窗」拍板（软键盘回车跳过场景/截止补全）。修：`isMobileEnv() ? submitComposer() : addFromComposer()` + isComposing/229 守卫。
- **M2-3（ui）** `ui.ts:1038,1164` — postponeItem/postponeSub 用 `new Date('YYYY-MM-DD HH:mm')`，iOS WebKit 返回 Invalid Date → due 落 `'NaN-NaN-NaN HH:mm'` 脏数据。修：改 moment 单源算术。
- **M2-4（ui）** `ui.ts:595-602,657-669,795,860` — renderAll 全量 innerHTML 重建无滚位保存，勾选/延后/搜索防抖后列表跳顶、移动场景条弹回起点（diary 同型问题按 P1 先例已修）。修：重建前存 scrollTop/scrollLeft 按 id 恢复。
- **M2-5 + M3-1（ui）** `styles.css:64-72`×`render.ts:288-290` — 移动触控硬规则缺口：视图切换钮 30×30、月历翻页钮 22×26 原样暴露（<40px 下限）；次级缺口聚合（排序下拉/composer 添加钮/折叠条/更早 N 条/回到今天/位置标签）。修：挂 touch-target 修饰或移动段 padding 抬档。
- **A1（arch）** `core/ui/modal.ts`×`ui.ts:1725,1759,1838`×`main.ts:341-425` — uiModal 无实例登记表，禁用插件时打开中的弹窗永留 body（死 UI + ESC 软关后只能重载）。修（core 根治）：modal 增存活登记 + closeAllModals()，main onunload N2 清单补调用，全域受益。
- **N8/A2（旧账三方向复核）** `ui.ts:924-942` — jumpToNote `void openFile` 后同步取 editor，setCursor 打在旧视图（定位从不生效）。修：await 后取 editor（active-leaf-change/rAF 兜底）。
- **A3/M6（arch/func）** `reminder.ts:39-48` — openForNote 面板已开分支不重置 activeScene，用户停在其他场景时提醒定位被过滤挡掉（冷开路径恒「全部」口径不对称）。修：补 `activeScene='全部'` + nav 重渲。
- **删除口径（consistency#2）** `ui.ts:1095-1127` — 可撤销删除仍「flow-dialog 确认 + notifyUndo」双保险，违 2026-09-19 效率整改 5 定稿（接 notifyUndo 免确认）。拍板：memo 本轮落地（对齐 core 定稿口径），favorites/belongings 同款滞后记录在案、待各自域轮跟进；场景删除保留确认（批量迁移近不可逆）。
- **CONTEXT 词条脱节（consistency#4）** `CONTEXT.md:409,42` — ADR-0095「二级弹窗不跟随」与 issue 291 皮肤通道实现矛盾；备忘录词条缺 bz-memo-note-binding 命令与 added/edited/deleted 三事件。修：词条更新。

### P3（bug/体验，摘要）
- func M8 编辑删正文链接后 url 永久保留（加「清除链接」出口）；M9 月历桌面「还有 N 条」chip 无响应（不落回格子分支）；M10 勾选 300ms 防抖窗内关面板完成意图丢失（拍板：维持反悔语义+注释言明）；M11 删除 idx=-1 仍发 deleted+undo 陈旧快照复活；M12 场景重命名两段写非原子（失败分支反向补偿）。
- ui M3-2 月历 chip halo inset -12px 跨格重叠误选邻格；M3-3 抽屉头「位置」标签死可点样式；M3-4 移动端编辑弹窗强制聚焦绕过 core 软键盘口径；M3-5 添加场景 void saveSettings 无 catch（并入 consistency#13 设置写盘兜底）；M3-6 子任务删行焦点落空+Enter 不加行；M3-7 头行设置钮三端死 UI（删 markup+委托）；M3-8 死选择器三条（pos-hint .bz-ic / bz-skinprev-default×2）；M3-10 卡片/勾选圈/折叠条键盘不可达（tabindex+Enter/Space 范式）。
- arch A5 composer 恒 minor 绕过 memoDefaultPriority 设置（拍板：composer 也读设置，对齐设置文案「新建备忘录时默认选中」承诺）；A6 getCourseNotes 前缀匹配无 `/` 边界误命中相邻目录；A9 已并入读链健壮化。
- consistency#5 单源微收口（isTodayStr→localDayKey、5 处 padStart→pad2）；#6+#11 月历空态/日面板壳接 render.ts 纯层与 emptyHtmlStr；#9 场景 hint「与备忘录共用」过期文案；#10 placeholder 魔法串状态位（常量化+dataset 哨兵）；#12 composer 成功通知无条目标识；#13 设置写盘 void 无兜底（commitScenarios/doSave 补 catch，低价值静默写包 saveSettingsQuiet）。
- 效率#2 打开面板零聚焦（桌面 composer.focus，notePath 分支聚焦搜索框）；#3 截止快捷档 chip（今天/明天）；#5 搜索框 ESC 清词不关面板；#6 搜索 ✕ 一键清除+空态「清除搜索」钮；#7 命中高亮（title 段 mark）；#8 搜索域补 checklist/url；#9 防抖增量显隐（轻版）；#10 桌面双击卡体直开编辑器；#11 已完成区「清理更早」批量出口（deleteCompletedBefore + 批量 notifyUndo）。

### 登记不修（登记性技术债/待拍板）
- **A7** UI 层猴子补丁 MemoData.write 置 syncing 旗标（层向倒挂）：无当下缺陷且 E 系测试在守，重构下沉 data 层推迟。
- **效率#13** 移动滑动手势（左滑删/右滑延后）：需真机手感验证与长按/滚动互斥拍板，无人值守不做。
- **皮肤档位豁免成文（consistency#15 + M3-9）**：皮肤段 font-weight:900 等「违规」实为 ADR-0095 豁免关系未在手册层成文——修法走文档（ui-design-manual 补豁免注记），不改样式值。

### 修复批分工（5 worktree）
A 弹窗族（编辑器/场景弹窗区 1380-1900 + core/ui/modal.ts + main.ts）：P1 脏拦截、M1、防重入、bindFormSubmit、M8、M12、M3-4、M3-6、效率#3、hint、placeholder、A1 登记表。B 数据/提醒/读链（data/reminder/state + ui 读 catch 三处）：读链健壮化、A3、A6、注释漂移、openExternal 收口。C 渲染/检索/列表（ui.ts 渲染区+render.ts+styles.css）：滚位、热区、月历族、搜索族、双击、键盘可达、空态单源、stripMdExt 下沉。D 条目动作/composer（ui.ts 920-1300 动作函数）：N8、M4、M5/M2-2、M2-3、删除口径、idx=-1、completeTimers 注释、composer 优先级/通知。E 测试/文档（tests + CONTEXT + 手册 + AGENTS 面）：测试缺口与词条修正，零 src 行为改动。

### memo 修复闭环（2026-09-19）
五批分支 `bz-fix-memo-{doc,data,render,actions,dialogs}` 串行并入（合并序 E→B→C→D→A）。跨批冲突四处均主线程解决：core/utils.ts 与 memo/ui.ts import 块双追加（取并集）；skin-dark 皮肤守卫计数 B(3)×D(免确认) 合并语义=2（删除场景+批量清理）；C 的 padStart 守卫终态归零（D 已收尾）。**主线程收口**（提交随部署）：①E 批四个契约开关翻 true（OPEN_FOR_NOTE_RESETS_SCENE/COMPOSER_READS_DEFAULT_PRIORITY/AWAIT_OPEN_FILE/READ_FAILURE_ERROR_STATE，对应 B/D 批行为已合并）；②一致#13 残款——添加场景 doSave/commitScenarios 补 `.catch(notifySaveError)`（批 B 边界外、批 A 未覆盖）；③C 批 pad2 守卫断言改合并终态。代理修正拍板两处：B 批实测「降序插回」会错位，改升序并钉死用例；B 批指认 literature 域实际目录名为 knowledge（openExternal 三域替换为 memo/favorites/knowledge）。**门禁**：tsc 0 错误；全量 390 文件 6097 例全绿（diary 闭环基线 5991）；`pnpm run build` 部署。

---

## clipbook（剪藏本）2026-09-19 深审

> 明细：`.scratch/review-deep/clipbook-{func,ui,efficiency,consistency,arch}.md`。去重后 P1×3 + P2×9 + P3×20 + 测试缺口 9。**旧账大面积在案**：review-all2 CB1-CB12 全部未修（本轮一次清）+ AS1(P2)/AS2/AS3 属 auto-summary 域（已记该域轮待办）。门禁基线：tests/clipbook 32 文件 324 例绿。

### P1
- **覆盖确认自绘壳（144 拍板迁移未落地；func 新-3 + ui C-UI8 + 一致#1 + 效率#1 合并）** `save.ts:186-220` — 全仓最后一个手绘确认框（内联样式三违规 + esc id 'clipbook-confirm' 缺 bz- 前缀 + 无 aria/焦点圈闭 + accent 主钮违 §9）；且不披露损失面（auto-summary 摘要/标签与手工编辑被整文件回退）、缺「另存新篇」第三出口。修：迁 openFlowDialog（bz-clip-dialog-editorial 皮）三出口「覆盖更新(danger)/另存为新剪藏(·2 序号)/取消」+ 披露副文案。
- **删除双保险滞后（效率整改 5；一致#2 + 效率#10）** `ui.ts:1145-1211` — 两路删除已接 notifyUndo 仍走 openFlowDialog 确认，四域中唯一未跟。修：免确认直达撤销（memo 同款）。
- **CB1 面板/报告 z 序零发号（C-UI1 转正）** `ui.ts:116-129,252-259` × `report-ui.ts:110-113` — 全站唯一漏网域，同屏被已发号面板压底「命令像失灵」，报告隐形时 ESC 先关看不见的层。修：showPanel/openClipbookReport 显示路径补 topifyZ。

### P2
- **新-1（func）** `news-fetcher.ts:729` — B站风控通知指向已删除的 Cookie 设置入口（09-12 拍板移除），用户无自助出路。拍板：尊重移除拍板不恢复设置行，改文案如实（自动重试）；「UP 管理加 Cookie 行」登记待拍板。
- **新-2（func）** `anchor.ts:66-73` — 同词锚定第二个笔记时 indexOf 命中第一个别名双链内部产出 `[[A|[[B|词]]]]` 嵌套破链并物化进剪藏 md。修：searchFrom 游标或 `[[` 前缀回扫守卫。
- **CB2/A2 写链假成功（func/ui/一致/arch 四向合并）** `news-data.ts:245-250` × `ui.ts:1107-1162` — writeNewsData 静默吞错（news.json 全写链出口，磁盘异常标已读/设置/统计全假成功）；且 UI 消费端 doMarkRead/undoMarkRead/deleteNewsItem 无 catch 成 unhandled rejection 静默回弹。修：去吞透传 + UI 三动作 catch → notifySaveError。
- **CB4/A3 剪藏目录路径分叉** — clipDirOf（save.ts:31）独缺尾斜杠归一，读取副本 4→6 份三套写法；带尾斜杠设置下写盘/扫描/事件/同步/反查五面不一致。修：save.ts clipDirOf 升格单源（归一+缺省串一处）+ 五处改引 + clipFilePathOf 路径组装单源。
- **CB10/A1 卸载弹窗残留** — UP/RSS 管理 + 覆盖确认三组 body 浮层不在 main onunload 收口面（closeAllModals 只管 uiModal，clipbook 零 uiModal 消费）。修：core/dom createOverlay 增 liveOverlays 登记表 + closeAllOverlays（main 接线，全域受益）+ unloadClipbook 补收口。
- **批量已读无撤销兜底（一致#7）** `ui.ts:711-725` × `index.ts:48-73` × `flow.ts:300-314` — 整源/全库标读无反悔窗（单条反而有）；stats 子桶无守卫（CB3 同函数）。修：flowMarkAllRead 动作前快照返回 + notifyUndo 批量回退（升序插回，memo 范式）+ stats 补建桶守卫（CB3 一并）。
- **C-UI2/效率#18 移动触控热区** — 5 组可点目标 25-37px 低于 40px 下限（顶栏动作/折叠行/存为剪藏/读下一则/报告 seg）。修：移动段 padding 抬档。
- **C-UI3/一致#9 假可达键盘** — 「打开笔记」role=button tabindex=0 无 keydown（railFoot 同款修复漏网）；折叠行无 tabindex 无 keydown。修：readPane keydown 委托 + 折叠行 tabindex/keydown。
- **效率#2 剪藏目录静默丢弃** `scan.ts:53,96` — 不合 frontmatter 契约/子目录的剪藏凭空蒸发零诊断（外部剪藏扩展唯一入口）。修：scan 返回 rejected 计数 + rail 脚注/空态提示。
- **效率#16 错误态缺失** `ui.ts:138-148` — 装载失败/news.json 损坏 = toast + 假空态，无重试出口。修：error 标记 + 空态分流（uiEmpty 错误态 + 重试钮）。
- **效率#6 j/k 焦点断头** `ui.ts:325-328,836,1086` — 点目录后焦点不在右栏，核心阅读快捷键静默失效；CB5 修饰键劫持一并（Ctrl+K 被劫持成切篇）。修：selectArticle/showPanel 焦点接力 + 修饰键排除。
- **效率#14 移动搜索零防抖** `ui.ts:340-343` — 每击键直连整目录重渲+逐卡挂抽屉（桌面 180ms 防抖已在）。修：复用防抖语义。
- **CONTEXT 词条五处脱节（一致#17，文档）** `CONTEXT.md:47` — 「删 body」「reading 态」「守护进程主写」「已退役设置键」「rail 脚注入口名」全与实现反向。修：按实现改写。

### P3（bug/体验，摘要）
- func 新-4 cleanTitle Windows 尾点/保留名（清洗单源化）；新-5 undoTrashClip 目录缺失误归因同名；新-6/A8 死代码清扫（emptyData 旧形陷阱/writeNewsState/openClipbookReportCommand/dirOverride/M.overlay）；新-7/A6 window.open×2 → openExternalUrl 单源；新-8 resolveUidFromInput 裸 fetch → httpGetText；新-9/CB12 标读通知篇数竞态（flowMarkAllRead 返回 bumped）+ executeFetchRound 无 catch。
- ui C-UI4 无效 CSS 负 margin（-var 写法）；C-UI6 移动两处 100vh 未接 --bz-vvh；C-UI7 selectSource 移动搜索栏不复位；C-UI9/A7 registerAutoRefresh 四订阅不退订；C-UI10 已并入 CB2；C-UI11/效率#17 首开无装载骨架。
- 效率#3 通知零动作钮（保存成功「打开笔记」/抓取完成「去剪藏本」）；#5 UP 行未读归零即消失；#7 切回滚位重置（会话内 Map）；#8 同篇动作后正文闪空（轻版：同篇刷新不重建标题/摘要段）；#12 搜索✕+打开聚焦；#13 命中 mark 高亮；#15 搜索域补 body/url（news 面；clip 正文阈值搜索登记）；#20 报告 Top5 可点回看。
- 一致#11 danger 皮肤形制破缺+id 选择器迁复合选择器；#12 padStart×3→pad2；#15 错误通知人话化 notifyActionError×4；#16 报告字体栈 --clip-serif + 搜索栏 display 状态位哨兵；A9 夹取规则双写单源。
- CB11 载荷缺 path 放行全量重扫——补拦。
- **登记不修/待拍板**：效率#19 移动滑动手势（真机拍板，同 memo#13）；clip 面正文阈值搜索（分寸拍板）；「UP 管理加 Cookie 行」（功能面拍板）；覆盖时 summary/tags 字段级合并（语义拍板，本轮只做披露）；AS1/AS2/AS3（auto-summary 域，记该域轮）。
- **测试缺口 9 项**（arch T1-T9）：news 事件载荷钉死 / frontmatter 三面往返 / 卸载弹窗残留 / 死代码拍板回归 / 路径单源四面一致 / 退订闭环 / 外链降级 / 渲染兜底 / stats 守卫。

### 修复批分工（5 worktree）
A 保存链与卸载收口（save/image-save/news-sources-group/core-dom/main/index）：P1-1、CB4、CB10、CB11、P3-11、新-4、#3 保存通知、dirOverride 清扫。B 数据写链与抓取（news-data/flow/loader/write-queue/scan/news-fetcher/file-sync/anchor）：CB2、批量撤销、CB3/CB12、新-1、新-2、新-8、A9、#2 rejected、#3 抓取通知、#9 篇数竞态。C UI 核心动线（ui.ts 100-460+1050-1300 + constants/state）：P1-2、P1-3、P2-3 UI 半、#6/7/11/12/16/17、CB5-9、C-UI3/7、新-5、#15 人话、A8 死代码。D 列表检索移动报告（render/styles/report-ui/report-stats + ui.ts 600-1000+1300-2010）：C-UI2/4/5/6、#4/5/9/13/14域/15域/18/19登记/20、#8 闪空、#11/23/24/26。E 测试与 CONTEXT（tests + CONTEXT.md）：T1-T9 开关模式 + 词条五处。

### clipbook 修复闭环（2026-09-19）
五批分支 `bz-fix-clipbook-{doc,data,save,core,views}` 串行并入（合并序 E→B→A→C→D）。跨批冲突两处主线程解：index.ts import 块（B 的 flowUndoMarkAllRead × A 的 clipDir 并集）；render.ts 搜索壳行（C 的 ✕ 钮 × D 的 placeholder 文案并集）。**主线程收口**：①E 批六开关翻 true（OVERLAY_SWEEP/CLIPDIR_SINGLE_SOURCE/UNSUBSCRIBE_ON_UNLOAD/STATS_BUCKET_GUARD/DELETE_WITHOUT_CONFIRM/USES_OPEN_EXTERNAL_URL）；②漏项补修（各批边界都未认领）：window.open×2 → openExternalUrl（新-7/A6）、CB9 loader missing/corrupt 分支复位 M.stats、image-save pad2、write-queue 注释清死引用、resolveUidFromInputDetailed 调用侧分文案接线；③跨批测试适配三处：T5 findOverwriteConfirm 精确「覆盖」→含「覆盖」交集（A 主动作改「覆盖更新」）、T6 探针记账改活跃订阅表（A 退订真实生效，循环结束 delta=0）、T9 rawBefore 快照语义修正（C32：rawBefore=处理前快照）。**门禁**：tsc 0 错误；全量 403 文件 6207 例全绿（memo 闭环基线 6097）；`pnpm run build` 部署。批 A 连带：save↔image-save 环按 ADR-0002 改函数内动态 import；checkup/checks-orphans.ts:25 尚有一份本地 clipDirOf（checkup 域，记该域轮收编）。

---

（下一域：review，5 方向审查并行中）
