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

## review（复习）2026-09-19 深审

> 明细：`.scratch/review-deep/review-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；新发现合计 66 条（P0×0 + P1×0 + P2×9 + P3×57）+ [UX-Suggestion]×12 + 测试缺口 3。门禁基线：tsc 0 错；tests/review 30 文件 394 例全绿。去重后：**修复项 P2×6 + P3×34**（分 5 批）；**UI/交互类 14 项分流 `review-deep-ui-pending.md` 待拍板**（2026-09-19 用户新规：UI 改动只汇总，全域完成后统一决策）；技术债 5 项登记随触碰收。旧账复核：G1-G5、autumn-batch-bugs 1-8、autumn-batch-ux ①-④ 共 17 条全部已修在位（多方向交叉确认）；未修仅 ux#31 卡片摘要预览（建议类，转待拍板重呈）。

### P2（6 项）
- **A1 批量出题「清空先行、失败不回滚」** `app.ts:300-323`×`:288-297` — 开始本轮（做题开）先把本轮全部逾期笔记存量题整键清空落盘再发起 AI，AI 失败（未配置/断网/全败）即旧题不可逆丢失（含「答错的题留在题库」积累池）；与做题练习「有题跳过」语义相反。修：清空移入生成成功分支，mutateQuiz 按篇合并覆盖；随修 T2 回归（AI 全败 → 盘上存量键原值未动）。
- **F1 FSRS 难度维度失真** `fsrs.ts:40-47,54,35-37`×`fit.ts:112-114` — nextDiff clamp [0,1] 与 nextStab `(11−D)` 的 [1,10] 假定失配：进入 FSRS 后首轮评级 difficulty 一律钳成 1，难度对间隔的调节作用压缩殆尽；easy 方向与标准相反（评「简单」难度上升，与「困难」同向）。修：D 值域统一（[1,10] 语义：clamp [1,10] + easy 负增量）+ fit 回放链/W_BOUNDS/`fsrs.test.ts:29-36` 锚定同步。
- **F2 reviewLoop 无防重入** `app.ts:508-643`×`:592-596` — 连点通知「继续本轮」/复习中重开命令 → 双 interval 并行翻篇，断点/通知单槽互覆、同篇重复打开。修：入口守卫（有活动循环先 stop 或拒绝+notice「本轮复习已在进行」），resumeRound 同守卫。
- **U1 放弃确认框键盘穿透** `sprint.ts:219-259`×`quiz-core/session.ts:283-309`×`core/flow-dialog.ts:206-208` — 确认框在途：Enter 被 handleKey preventDefault（确认框不关）且路由进题面（多选直接交卷/翻题/结算）；数字键 1-4/A-D 直接作答；quiz-core 焦点离按钮后同病。修：会话 confirming 旗标（flow-dialog 打开置位/结算复位）+ handleKey 首行拦截 + 补 BUTTON target 排除（对齐 session 惯例）。
- **U2 冲刺 loading 态双 runNext 竞态** `sprint.ts:264-320` — 取题中点「跳过此篇」→ 旧篇 fetch 返回后 `finished` 不拦，旧题面顶掉新篇/结算屏，进度与评级计数串篇。修：会话级 runSeq 发号守卫（await 返回 seq 不符即弃）；或 loading 态禁跳。
- **U3/A3 插件禁用清场缺口** `index.ts:233-262`×`stats-ui.ts:22-25,276-278`×`ui.ts:353-380`×`app.ts:32-52` — 禁用不关统计/历史/难度弹窗（遮罩挡死全屏，closeStatsModal 全仓无卸载调用）、文件树染色与徽标不回退、`_notifiedOverdue` 残留致同会话重启用后存量逾期不再提醒。修：unloadReview 补 closeStatsModal（连带 timeline）+ `.difficulty-dialog` 移除 + 染色回退 + 会话态复位；随修 T1 回归钉死。

### P3 修复 34 项（按批摘要）
- **数据/算法**：F3 R 阈值 desc 披露「仅用于提前判定，不改变排期」（真阈值排期待拍板）；F4 冲刺结果卡短间隔恒「1 天后」→ 复用 render dueLabelOf 天/时分口径；F6 quiz-core ensureQuiz initialized 不复位 → resetQuiz 导出+unloadReview 调用；F7 loadItems 非法 nextReviewDate 容错（回退 reviewStart+warn）；F8 markReview TOCTOU（门禁检查移入队列 fn）；F9 vault modify 全量读盘（复用轮询快照/单条读）；F12 单篇范围 TFolder 漏网（校验 extension==='md'）；A13/E4 数据层 bulk（addItems/removeItems 一趟 RMW，watch 两处改调；quiz 批量生成改一次 mutateQuiz 合并写；排除名单 onChange 一次 saveSettings）；A2 `!quiz.ai` 降级护栏失效（判据换 getAIProvider 试准，恢复四处降级分支）；A5 死代码簇（quizUpdate→updateQuiz→loadActiveItems 整链 + getAllQuestions/getUncompletedQuestions/REVIEW_DATA_PATH/lastDm/dueItems + loadHeatmap/loadPreview，测试随删）。
- **app/编排**：E3 前半 评级链路读盘合并（onPassed 透传 fresh、markReview+updateItem 合并 RMW；applyReviewStyles 已支持可选 items）；A11 双 dm 实例（index 建好后注入 reviewApp + data.ts:64 注释如实）；U8 监听目录新笔记加入后面板不刷新（onVaultCreate 补 refresh）；F10 onVaultCreate addItem 抛错静默（catch 分型：查重静默/写盘 notifySaveError）；F11 onVaultRename 目标被占静默（notice 提示手动处理）；C10 删除确认首名带 .md（stripMdExt）；C-UX2 「是否同步移除复习记录」确认后无撤销 → 挂 notifyUndo（确认保留，两可决策）。
- **弹窗/会话**：U4/A4/E7 难度弹窗迁 openFlowDialog（ESC/遮罩/焦点/外点/companion/ESC 关错层全收口 + 1-4 快捷键对齐做题拍板范式 + U10 onSelect try/catch→notifySaveError）；E1/C1/A12 「移出复习计划」两处免确认直达 notifyUndo（效率整改 5 既定口径对齐）+ 命令路径 catch（与抽屉同口径）；E5 做题练习切题量档位免全表重建/免重读题库 + 焦点还原 + probeBankCount 按 scope 缓存；E6 队列刷新滚位/焦点记忆（refreshPanel 前后记录还原）；U建5 答对删题失败恢复后 .correct 高亮残留（恢复回调清高亮）；U9 reviewLoop 进度通知句柄验活（对齐 _overdueNotice 先例）；C9 错误提示五处 → notifyActionError 单源（顺带 onRetry）。
- **单源/形制**：A7 currentR 同式五处 + LADDER_MAX 字面量两处 → fsrs.currentR 单源（批内收 queue/stats，app/render/stats-ui 三处主线程收口）；A6/C5 RATING_NAMES「轻松/简单」漂移 → sprint/render 删本地改 import stats（统一「简单」）；A9 dateKey 第 6 份 → localDayKey 下沉 core/ui/str.ts + stats 转发（其余域私货逐批收编）；C3 stripTitleMarks 下沉 str.ts（render 切换主线程）；C4/A8 render 本地 ESC_MAP/esc/icon → str 单源（导出已存在）；C8 review.json 路径双单源 → manager 改 import data；C7 ESC 层 id 统一 bz-review-* + session 层 handle 存储显式注销（U5 层累积一并）；C13 统计弹窗「对齐影视」五处注释如实化 + secHTML title esc；C14 settings-schema 三处行型（出题数量 text→number+min、缩放行 min/max 声明式删 onChange 复刻、外观占位组 desc 补「预留」）；C15 构造期 z 发号冗余/静态档位三处删（仅 show 路径 topifyZ）；C11 CONTEXT.md 四词条按现状改写 +「随机抽查」零实现词条删除；U7 死样式/死分支三处（退役 chip 规则、无 DOM .meta、不可达结果卡+「打开原文」失实按钮）；U11 做题练习 note 空路径 meta 文案补「先选择一篇笔记再看题量」；U12/A14 缩放行超界回 1 → 声明式 min/max（T3 回归）。
- **core**：U6 ADR-0122 滚动条通杀清单漏配 → components.css 补 `#review-stats-popup`/`#review-history-popup`/`#quiz-popup` 三壳。

### UI/交互分流（14 项 → review-deep-ui-pending.md，本轮不修）
F3 真阈值排期、F建1 sprintStarting 防拆、F建2/E3 后半轮询事件化、U建1/C6 quiz 题面 emoji→lucide、U建2 冲刺头行副标题、U建3 不可达卡 tabindex、U建4 时间线排名键盘、E建1 评级条键盘化、E建2 冲刺中断续跑、E6 后半大列表惰性渲染、C13 视觉重刷对齐 cinema、C-UX1 命令名括号形态、C-UX3 空列提示形制、ux#31 卡片摘要预览（旧账重呈）。

### 技术债登记（随触碰收，无需拍板）
A10 applyReviewStyles 105 行 UI 职责搬离 app.ts；A15 styles 无前缀族渐进收编（.spinner→.bz-q-spinner 本轮收，DOM 侧主线程）；A16 双做题引擎并存（issue 362 拍板背景，长期收敛 sprint 一份）；C16 徽标 cssText 静态七项迁 .review-stage-badge（跨 app/styles 两文件）；E4 后半 答对删题会话期内存记账批量删除（单次 RMW 容忍）。

### 修复批分工（5 worktree，文件互不重叠）
- **A 算法数据层** `bz-fix-review-algo`（fsrs/fit/data/queue/stats + core/ui/str.ts + core/utils.ts）：F1、F7、A13 bulk API、A2（data 侧无）、A5 stats 死代码、A7 建 currentR+queue/stats 改调、A9 dateKey 下沉、C3 下沉、A11 注释、F6 侧无。回归：fsrs D 域锚定翻转、fit、data 容错/bulk、dateKey、死代码删。
- **B app 编排出题链** `bz-fix-review-orch`（app.ts、review/index.ts、watch.ts、quiz-panel-data.ts）：F2、F5、A1、A2、F8、F9、E3 前半、A3 会话态+unloadReview 收口+T1、A5 dueItems、A11 注入、A12、E1/C1 命令侧、F10/F11、U8、C10、C-UX2、F12、C9(index)。回归：T2 丢题、防重入、TOCTOU、unload 清理。
- **C 弹窗浮层与做题练习** `bz-fix-review-dialog`（ui.ts、quiz-core/{index,manager,session}、quiz-panel.ts）：U4/A4/E7 难度弹窗迁移、E1/C1 抽屉侧、E6 滚位焦点、E5、U1 session 侧、U建5、U5/C7、C8、C9(session)、A5 quiz-core 死链、F6 resetQuiz 导出、C15(ui/quiz-panel)。回归：难度弹窗、滚位/焦点、档位、session 穿透。
- **D 冲刺会话与渲染层** `bz-fix-review-sprint`（sprint.ts、render.ts）：U1 sprint 侧、U2、F4、A6、C9(sprint)、C7(sprint id)、U7 死分支、U11、C4/A8 render 改 str。回归：穿透/竞态（ui 批建议款）、结果卡时分。
- **E 统计设置样式与文档** `bz-fix-review-panel`（stats-ui.ts、settings-schema.ts、styles.css、core/ui/components.css、CONTEXT.md）：U6、C13、C14 三处、U12/A14+T3、F3 desc、A5 lastDm、C15(stats-ui)、C7(stats-ui id)、U7 死样式、A15 .spinner、C11 词条。回归：滚动条契约、schema 行为。

### 主线程收口清单（合并后）
① F6：unloadReview 补 `resetQuiz()` 调用（批 C 建导出）；② A7：app.ts:158-163 / render.ts:75-80 / stats-ui.ts:321-328 三处切 fsrs.currentR（批 A 建单源）；③ C3：render.ts:550 切 str.stripTitleMarks；④ A15：.spinner 使用处 DOM 类名随 .bz-q-spinner（grep 定位）；⑤ E 批「现状钉死」开关翻转；⑥ 跨批守卫计数/mock 适配；⑦ 各批边界漏项。

### review 修复闭环（2026-09-19）
五批分支 `bz-fix-review-{algo,orch,dialog,sprint,panel}` 串行并入（合并序 A→E，零冲突）。**主线程收口九项**：①F6 unloadReview 接 `resetQuiz()`（批 C 建导出）；②A7 app.currentR/render.currentRPct/stats-ui curR 三处切 `fsrs.currentR`（批 A 建单源，queue/stats 批内已切）；③C3 render《》正则切 `str.stripTitleMarks`；④A15 render `.spinner`→`.bz-q-spinner`（DOM 侧随批 E 样式改名）；⑤watch 批量收编/移除接 `addItems/removeItems` 单趟 RMW；⑥难度弹窗死导出 `difficultyDialogHtml` + styles 自绘族两段删除（批 C 已迁 flow-dialog choice，旧 `.difficulty-dialog` 清场语句同步改 `cancelActiveFlowDialog()`）；⑦T1 卸载清场断言适配 flow-dialog 形态（`__shared_confirm_popup__`）；⑧settings-copy-lint 白名单冗余条目删；⑨（无 E 批开关——本轮无独立测试批）。**门禁**：tsc 0 错；全量 395 文件 6124 例全绿（起点 366 文件 5780；memo 回滚后基线再起步）；`pnpm run build` 部署（707769a0）。**批边界残款（登记不修）**：批 B——runSprintSession 内部 `!quiz?.ai` 为纵深防御维持、F8 仅门禁内移+透传（完整 RMW 合并需 scheduleNext 入队，风险大）；批 E 报备——settings-panel 渲染器 number 行不回写输入框（R9 缝，记 settings-panel 域轮）；批 C——难度弹窗 1-4 快捷键已挂 flow-dialog action 契约。**FSRS F1 选型**：下界取 `min(D,1)` 软钳（纯 clamp [1,10] 会打红既有 app.test 锚定；D≥1 严格 [1,10]、存量 D<1 直通，语义更守恒）。

## encrypt（保险库）2026-09-19 深审

> 明细：`.scratch/review-deep/encrypt-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；新发现合计 58 条（P1×5 + P2×16 + P3×37）+ [UX-Suggestion]×7 + 测试缺口 6。门禁基线：tsc 0 错；tests/encrypt 12 文件 208 例全绿。去重后 **修复项 P1×2 + P2×12 + P3×22**（分四批）；UI/交互类 8 项分流 `review-deep-ui-pending.md`；姊妹域（password-vault）6 条记 pv 域轮；技术债 4 项登记。旧账复核：review-fix-lock E 系 12 条全部已修在位；review-all2 **N9/N10/N11 未修确认本轮收口**、N12 维持登记；ux#8/9/10/11 维持未采纳（转入待拍板历史搁置）。

### P1（2 项，均多方向交叉确认）
- **移动端 @media 全套样式被误删（issue 346 回归）** `styles.css:334-335`（func/ui/eff/cons 四方向同报，git 实锤 `bbf5bcf9` +4/−154）——ADR-0155 清退 `.bz-pwv-*` 时把整段 `@media (max-width:768px)` 连带删除（bz-vault-desk 隐藏/mob 显示/mbar/msearch/mseg/mbody/mobpage 全套），≤768px 移动壳恒隐、桌面三栏硬塞手机、移动 DOM 每轮白建。修：从 `bbf5bcf9^` 取回该段剔除 pwv 残留后恢复 + 构建产物冒烟断言防再删。
- **加密日记资产「半退役」三方矛盾** `ui.ts:571-573,601-604,641-643,1659-1661`（cons P1）——ADR-0158 明文拍板「两资产（笔记+日记）」、CONTEXT 词条同口径，但 `b86a20c4`（无人值守自主拍板）撤了 nav/seg 日记入口且 setAsset 把 diary 兜底成 note：diary 整面 UI 不可达死面、存量老加密日记「只能经保险库面板救回」的路径消失。**拍板：恢复 diary 资产入口**（对齐 ADR-0158 权威拍板，nav/seg 补 k-diary 项 + 删两处兜底，样式与死代码本就在，恢复即活；b86a20c4 属无人值守越权且晚于其两日的 ADR-0158 未追认）。

### P2（12 项）
- **manifestSaveFailed「重试即收敛」承诺不可达** `data.ts:1257-1268,1343-1352`（func 新-3 = arch 新-1）——还原收尾先删镜像后存清单，落盘失败后重试在阶段一即判冲突永久卡死，文案误导。修：调序 saveManifest 先于 deleteNoteMirrors（孤儿密文体检可清，自洽）+ 文案修正 + T1 重试收敛回归（现有用例标题称幂等实无断言）。
- **restoreDiaryEntry 未入 opQueue（E13 漏网）** `data.ts:1308-1353`（arch 新-2）——秒级解密窗口内并发 removeNote 按 idx splice 可删错条目密文。修：包 enqueueOp + T2 竞态探针。
- **decodeURIComponent 未捕获 URIError** `ui.ts:150,218,330`（func 新-1 P1）——附件名含孤立 `%` 时「加密当前笔记」整链静默失败（unhandled rejection 零反馈）。修：safeDecode 三处 + lockCurrentNote 兜底 catch + notifyActionError。
- **面板「还原回日记」不复算当前日记目录** `ui.ts:1893-1928 × data.ts:1308`（func 新-4）——改过日记目录后还原条目 merge 进旧目录「凭空消失」。修：realign 语义下沉 SafeManager.restoreDiaryEntry（basename → 当前日记目录），与 diary 域 D9 同规则。
- **附件读取无体积守卫** `ui.ts:2352-2383`（func 新-5 = arch 附带）——数百 MB 视频全量进内存移动端 OOM。修：64MB 拦截对齐 diary 侧现成口径（超限跳过并通知，全部超限整笔拒绝）。
- **上锁不关预览浮层/弹窗游离空闲计时（N9 同根）** `ui.ts:736-748,1699-1717,680-683`（ui 新-2）——上锁后预览明文残留屏上；弹窗内操作不重置 15 分钟计时到点照锁；lockNow/hide 不收场弹窗。修：hide/lockNow 收场 closePreview()+closeAllDialogs() + bump 改 document 捕获。
- **卸载清不到现役锁屏（closeAllDialogs 选择器已无产出者）** `ui.ts:1627-1629`（ui 新-3 = arch 新-3）——禁用插件时解锁屏/销毁确认残留且仍可真实解锁。修：补 `.bz-lockscreen--mask` 清扫 + T5。
- **移动端概览交互全哑** `ui.ts:1739-1745`（ui 新-4）——hero/统计卡/流水/体检卡零绑定（P1 恢复后立即暴露）。修：bindOverviewArea 抽公共供桌面/移动共用。
- **列表滚位归零** `ui.ts:1481-1503`（eff 新-2）——选中/搜索/删除后跳顶，违会话滚位范式。修：重建前后记录还原 scrollTop。
- **搜索 ESC 直关面板（安全模式附带误上锁）** `ui.ts:690-706`（eff 新-3）——无 ESC 清词无 ✕。修：有词清词 stopPropagation、无词放行，列表头补 ✕（范式对齐；壳收编 uiSearch 待拍板）。
- **statusbarHtml 双份逐字实现** `ui.ts:88-91 × index.ts:42-45`（cons 新-3 = arch 新-7）——修：vault-assets-view 单源导出两侧消费。
- **同域销毁防护双档** `ui.ts:1832-1890 vs 1943-1961`（cons 新-4）——笔记销毁重输主密码、日记销毁仅普通确认。修：confirmDestroyDiary 升级对齐笔记侧（verifyPassword 复用）。

### P3（22 项，摘要）
- **数据层**：selfHeal 不入 opQueue 且先广播后自愈（func 新-6 = arch 新-4，enqueueOp 包裹）；resolveHealth 缺 `.safe.enc` 排除（arch 新-5，isOrphanEncName 单源 + 负向用例）；updateNotePayload 冗余整库重写（arch 新-6，contentRef 未变跳过 saveManifest 改显式广播带 noteId，顺带缓解 N12）；SafeManager.lock 幂等短路（func 新-7，安全模式 4 轮广播收敛）。
- **UI 会话**：概览先 slice 后排序（func 新-2）；hero 计数口径 + 日记流水死端点击（func 新-8/ui 新-5，随 diary 恢复拍板一并：hero=笔记+日记，流水点击落对应资产）；N10 外部上锁空态+明文缓存驻留+hero 硬编码（订阅 unlock-changed 清缓存/锁屏接管/动态化——安全敏感）；N11 解锁屏单例守卫；解锁 busy 防重（ui 新-6）；预览 null 静默空白（ui 新-7）；体检重入守卫（eff 新-7）；体检锁定态误报全绿（func 建-1，锁定态禁扫+如实提示）；密码错误双通知 encrypt 侧（eff 新-8，pv 侧记 pv 域轮）；captureLockStats 挪消费点 + pwDataManager.load 一次化（eff 新-4 + arch 新-9 最小改）；打开路径重绘 2-3 次收敛（eff 新-5）。
- **渲染/收尾**：死代码批（focusUnlockInput、DEFAULT_PW_CHARSET 再导出、LOCK_KIND_META 降常量、restoreLastAsset 注释）；死样式整批（ui 新-8 表 + cons 新-10，含非法 `-var()`；`.k-diary` 族随入口恢复转活保留）；空态走 emptyHtmlStr（cons 新-12）；错误文案四处 notifyActionError（cons 新-5）；时间格式统一 zh-CN hour12:false（cons 新-13 encrypt 侧）；还原按钮内联样式改 .bbtn.indigo（cons 新-16）；index.ts 旗标后置 + void 链 catch（arch 新-10）；renderWithTimeout Component unload（arch 新-11）；CONTEXT.md 保险库词条四处按现状改写（cons 新-14，含 bz-encrypt-lock 语义错位备注）；home 副题「密码·加密笔记·日记」→「加密笔记·加密日记」（cons 新-15，随 diary 拍板一行）。

### 姊妹域记名（password-vault 域轮处理，本轮不动 pv 文件）
安全模式判定双口径对齐（cons 新-6）、首设流程统一 core 三态（cons 新-7）、openExternal 私有副本收编（cons 新-8）、共用口径漂移清单（cons 新-9：防抖收编/toast 语义/解锁文案/「保险箱」旧称/载荷失败文案）、N18① 冗余 lock、密码错误双通知 pv 侧、安全模式 desc 文案对齐。

### UI/交互分流（8 项 → review-deep-ui-pending.md，本轮不修）
列表多选批量、设置入口可发现性、软删除撤销对齐（拍板项）、搜索壳收编 uiSearch（行为已随批修）、图标机制统一 iconSpan/mountIcons、pv 首设流程统一、工作台键盘可达性体系（↑↓/Enter roving tabindex，全站范式未定）、旧建议 ux#8/9/10/11 重呈。

### 技术债登记（随触碰收）
明文缓存复用（预览/复制/还原重复解密——PBKDF2 LRU 已兜大头，跨批协调成本高）；N12 广播时序（arch 新-6 已缓解）；共享锁统计契约下沉 core（最小改已做，接口化待 core 线）；cons 新-13 pv desc 对齐（记 pv 域轮）。

### 修复批分工（4 worktree，文件互不重叠）
- **A 数据层** `bz-fix-encrypt-data`（data.ts + data/d2 测试）：P2×2（manifestSaveFailed 调序+T1、restoreDiaryEntry enqueueOp+T2）+ P3×4（selfHeal、resolveHealth+T4、updateNotePayload 广播、lock 短路）+ func 新-4 data 侧下沉。
- **B ui 会话安全区** `bz-fix-encrypt-dialog`（ui.ts 弹窗/锁屏/预览/加密链/体检/收场行区 + enh-ui/ui-cov 测试）：P2×4（decodeURI、上锁收场+N9、锁屏清扫+T5、销毁防护对齐）+ P3×8（N10/N11、busy、预览 null、体检重入、体检锁定态、密码通知单条、统计快照挪点、死代码三处、错误文案四处）。
- **C ui 渲染导航区** `bz-fix-encrypt-view`（ui.ts 渲染/列表/概览/移动/setAsset/openManager 行区 + vault-assets-view.ts + index.ts + ui.test）：P1×1（diary 入口恢复）+ P2×3（概览绑定、滚位、搜索 ESC/✕）+ P3×6（slice 排序、hero 口径、流水落点、statusbar 单源、空态单源、index 旗标、时间格式、Component unload、打开重绘收敛）。
- **D 样式与文档** `bz-fix-encrypt-style`（styles.css + CONTEXT.md + src/home/shared.ts + 冒烟测试）：P1×1（@media 恢复+断言）+ 死样式批 + .bbtn.indigo + CONTEXT 词条 + home 副题。

### 主线程收口清单（合并后）
① `.k-diary` 族生死核对（批 C 恢复入口后批 D 须保留该族，合并序 C→D）；② statusbarHtml 三方接线核对；③ 跨批测试适配；④ preview 产物 rebuild 仪式；⑤ 各批边界漏项。

### encrypt 修复闭环（2026-09-20）
四批分支 `bz-fix-encrypt-{data,dialog,view,style}` 串行并入（合并序 A→B→C→D，C 在 ui.ts import 块一处冲突主线程取并集）。**主线程收口**：①D9 回归修复——批 A 目录重算读 settings 与 diary 域 applyDirectories 快照不同源（diary 测试 applyDirectories 不写 settings），改「调用方注入真源」：`restoreDiaryEntry` 加 diaryDir 参数，diary/encrypt.ts 直传 `DIARY_DIRECTORY`、encrypt 面板动态 import（函数级环延迟解析合规），settings 读取降兜底；②`vault-assets-view` 还原按钮内联 style → `.bbtn.indigo`（批 D 类已备）；③closeAllDialogs 收场补 `cancelActiveFlowDialog()`（批 B 残款：flow-dialog 确认框不随上锁收场）；④搜索 ✕ 内联样式收编 `.bz-search-clear` 域类；⑤**既存构建雷**：secondbrain fake 层缺 `TFile` 导出（聚合链 bookshelf/data.ts 需要），diary 源变更触发重出即崩——补 TFile 桩类；⑥`.k-diary.on` 样式核对健在（批 C 残款担忧不成立）。**门禁**：tsc 0 错；全量 404 文件 6232 例全绿（smartcat 1 例并行负载 flaky 复跑绿）；`pnpm run build` 部署（70b861ce）。**批边界残款（登记）**：confirmRestoreDiary 确认框仍展示加密时旧目录 path（展示语义小尾巴）；destroy-confirm ESC 同名层并发顶替（沿袭现状）；pv 解锁屏被本域清扫的 await 悬挂——pv-func 方向证据链排除成立性，encrypt 侧 activeUnlock cancel 链已兜底。**姊妹域记名（pv 域轮输入，多数已被 pv 审查证实并展开）**：见 pv 节。

## password-vault（密码本）2026-09-20 深审

> 明细：`.scratch/review-deep/pv-{func,ui,efficiency,consistency,arch}.md`。5 方向并行审查；新发现合计 48 条（P1×3 + P2×8 + P3×37）+ [UX-Suggestion]×10 + 测试缺口 7。门禁基线：tsc 0 错；tests/password-vault 6 文件 53 例全绿（锁屏聚焦用例 flaky 记新-15）。去重后 **修复项 P1×3 + P2×8 + P3×20**（分三批）；UI/增强 9 项分流 `review-deep-ui-pending.md`；**encrypt 轮姊妹域记名 7 条验证：成立 5（安全模式双口径/openExternal/口径漂移/密码错误双通知/desc 不一且带「pv 关不掉安全模式」升级点）、消解 2（N18① 冗余 lock 被 SafeManager 幂等短路消解；「closeAllDialogs 误清扫 pv 锁屏致悬挂」证据链排除——pv 面板锁屏是 inline 非 body>mask 且 lockSafe 首行短路）**。旧账复核：review-fix-lock E 系全部在位；review-all2 N13-N18 七条未修确认（N14/N16 并入本轮 P1/P2 修法，N15 对齐 encrypt T11，N18① 消解关账）；N12 维持登记。

### P1（3 项）
- **密码行样式缺失（弹窗撑坏）** `render.ts:102` × `styles.css:1531-1539`（ui 新-1）——`.mini`/pwdrow 无 dialog 上下文规则，eye 内嵌 SVG 按 300×150 默认渲染，添加/编辑弹窗双端必现横向溢出。修：补 pwdrow flex + dialog .mini 规则（对齐 acctcard :517 规格）+ 测试断言。
- **外部上锁后空锁屏卡死（N16 升级）** `ui.ts:1078-1089,378-383`（ui 新-2 = func 新-1A = arch 新-1）——解锁态开面板锁屏从未初始化，别域上锁后只 toggle open 类：纯背景空白层无输入框不可解锁。修：`onSharedLockChanged(false)` 补 `showLock()`（幂等重入，连带修 N16 残留文案）+ 回归断言锁屏内容节点（E2 旧用例只断 `.open` 数量在盲区）。
- **kw 残留渲染链断裂（unhandled rejection）** `ui.ts:405-409,628-631 × data.ts:299-301`（func 新-1B）——searchKw 跨 hide/show 存活，未解锁时 renderAll 调 search 抛「未解锁」中断渲染链，showLock 被跳过且重开复现。修：渲染入口未解锁守卫 + onSharedLockChanged(false)/hide 清 searchKw + loadAndRender try/finally 保 showLock 必达。

### P2（8 项）
- **安全模式全链三分叉** `ui.ts:1047-1051 × settings.ts:33`（cons 新-1 = func ① = N18②）——hide 单读构造期快照且只认新键：存量旧键 encryptSecurityMode 用户 pv 永不自动上锁；pv 设置关安全模式不同步旧键（encrypt 侧 OR 读下关不掉）。修：hide 实时 OR 双键读 + settings binding 双键同步双写（逐字对齐 encrypt/ui.ts:463-468）+ desc 统一。
- **「锁定保险库」清不到 pv 实例明文**（func 新-2 P2 数据安全）——快速取密后整表明文驻留 pwData，encrypt lockNow 只清自己实例。修：PasswordVaultDataManager 构造订阅 unlock-changed(false) 自清 pwData/loadCache（destroy 退订），UI 层订阅回归纯重绘，index.ts:84 显式 lock 可删。
- **快速取密 Enter 默认「生成新」** `quick-pick.ts:168`（eff P2）——搜索命中后 Enter 应复制命中项而非生成（误生成风险+多一步）。修：默认动作改复制命中 + 测试。
- **FAB 弹窗焦点落隐藏桌面实例** `ui.ts:950-952`（ui 新-3）——querySelector 恒取 desk 实例，移动端软键盘不弹；openPlatformEdit 全平台无聚焦。修：按可见实例 focus + 平台编辑补聚焦。
- **hide/上锁不清 shownIds、show 不收移动详情页（N14 升级）** `ui.ts:1036-1052`（ui 新-4）——重锁再解锁明文直出、旧明文 DOM 复现。修：hide 首行收页 + lock 路径清 shownIds。
- **renderAll 每次写盘 lock-stats.json** `ui.ts:371,1128`（ui 新-5 = func 新-6 = eff）——encrypt T12 整改未同步。修：对齐——摘 renderAll、挪 hide/onSharedLockChanged(false) 消费点。
- **上锁路径不收场弹窗**（cons P2，对齐 encrypt N9 修法）——pv hide/lock 收场补弹窗清理（明文浮层残留）。
- **15 分钟 idle 自动上锁 pv 缺席**（cons P2）——对齐 encrypt 补齐。

### P3（20 项，按批摘要）
- **数据/取密**：quick-pick 活动行 LIMIT（func 新-3）；search 空词返回 slice（func 新-5，防渲染层 sort 改写 pwData 持久化）；保存/首设防重入（func 新-4）；encrypt:changed 协议常量字面量双源（arch，抽共享常量）；index.ts 旗标先置+void 无 catch（arch）；data.test.ts 整文件重复删（arch，data-manager.test 严格超集）；快速取密陈旧快照（arch，登记低频）。
- **锁屏/会话**：密码错误单通知+冷却倒计时+错误清除条件反转（ui 新-7 = N15）；N13 eye 三件套复位；showLock 卸载竞态 TypeError（arch）；死代码/失实注释清仓（arch）；锁屏聚焦 flaky 修（ui 新-15）；**encrypt 侧 closeAllDialogs 按 kind 过滤**（ui 新-8：快速取密的 body 解锁屏被保险库面板 hide/lockNow 误收场——encrypt/ui.ts 一处，pv 轮顺修）。
- **渲染/列表**：N17 mobSegHtml data-id escAttr；双实例搜索状态回写（ui 新-6，联动防抖收编 core debounce）；外部变更回调刷新移动详情页（ui 新-9）；删最后账号清 selPlatform（ui 新-10）；fav 空态文案（ui 新-11）；口径漂移清单（toast 档/「密码本已解锁」解锁文案/「保险箱」→「密码本」/手拼 notice→notifyActionError/防抖收编）；pv 自称「保险库」修正（踩自家 _Avoid_）；DEFAULT_CHARSET 三份收敛；删除动作挂 notifyUndo（确认框保留——cons 判定可撤销面对齐效率整改 5 的完整形态待拍板，先补撤销链纯增益）；favicon 失败负缓存（ui 新-14，core/dom.ts 补 tombstone）；移动热区 40-44px（ui 新-12）；bindFormSubmit Enter 提交（ui 新-13）。

### UI/增强分流（9 项 → review-deep-ui-pending.md）
快速取密生成即丢弃不落库（func 建1）、空字段复制报成功（func 建3）、选择器键盘断路/role（ui S1）、移动收藏视图入口（ui S2）、移动链接纯文本（ui S3）、生成覆盖无确认（ui S4）、批量导入导出（ux#12 维持重呈）、首设流程统一 core 三态（cons，随 E6 重呈）、删除免确认完整形态（cons UX 拍板项）。

### 修复批分工（3 worktree，文件互不重叠）
- **A 数据取密协议** `bz-fix-pv-data`（data.ts/index.ts/quick-pick.ts + 测试）：func 新-2/3/5、eff P2 Enter 落点、N18①、arch 常量/旗标/data.test 重复。
- **B ui 会话锁屏** `bz-fix-pv-lock`（ui.ts 会话区 + settings.ts + encrypt/ui.ts 仅 closeAllDialogs 一处 + 测试）：P1×2、安全模式三分叉、上锁收场、idle 补齐、shownIds/mobpage、密码通知/倒计时、N13、防重入、写盘摘除、showLock 竞态、flaky、encrypt kind 过滤。
- **C ui 渲染列表弹窗样式** `bz-fix-pv-view`（ui.ts 渲染区/render.ts/styles.css/core-dom 负缓存 + 测试）：P1 密码行样式、P2 焦点、P3 渲染族全项 + 口径漂移 + 热区 + bindFormSubmit。

### 主线程收口清单（合并后）
① 批 B 动 encrypt/ui.ts 与 encrypt 侧测试适配核对；② pv 与 encrypt 双域测试互证（共锁事件链）；③ preview rebuild 仪式；④ 跨批 mock/计数适配；⑤ 各批边界漏项。

---

---

## cinema（影院）域 · 审查完成（5/5 方向到账，三修复批已定稿）

> 明细：`.scratch/review-deep/cinema-{func,ui,efficiency,consistency,arch}.md`。五方向新发现合计（去重前）：func P2×1+P3×7；ui P1×1+P2×1+P3×4+建议2；eff P2×5+P3×2+建议3；cons P2×4+P3×8+建议3+附带功能 P2×1；arch P2×1+P3×7+测试缺口7。跨方向去重：ui.ts:142 模板（func=ui=arch）、焦点（ui=eff）、openDouban（func=ui=cons）、ESC 清词（eff=cons，并入 ✕）、mob 回显（eff=cons）、热区（ui=cons）、ovl 层泄漏（func=arch，arch 补 closeOverlay 结算面）、非法字符（func=ui=arch）、改名半失败（func=arch）、季行叠字（ui=arch shared.ts:242）。旧账复核五方向一致：C1-C10（C1 撤回）/G6-G9/跟进 B/C/一致#1#2 全在位；AI#17 未修随手收；144 拍板账（notifyUndo/脏表单）与 ADR-0125 基座迁移不另立。门禁基线：tsc 0 错；tests/cinema 183 例全绿。**修复分三批**：A 写路径与 ui 行为 `bz-fix-cinema-write` / B 视图层与样式 `bz-fix-cinema-view` / C 队列基建与文档 `bz-fix-cinema-infra`（分工见批次段）。

### 方向 5（架构/测试）补充条目

- **P3 closeOverlay 不结算 ovl escManager 注册** `ui.ts:791-800` × `:238-239`（arch 新-2，并入上方 ovl id 项）——带弹窗关主面板（遮罩/✕/toggle）滞留 layer 闭包持脱树 DOM，seq 递增 id 令同 id 自清永不命中、无上限累积。修：ovl 改固定 id 交同 id 清扫 + closeOverlay 遍历活跃句柄统一 close（双保险）。
- **P3 豆瓣队列 enqueue 不清 cancelled 残留** `douban-queue.ts:121-131/:142/:195`（arch 新-5）——删过未入队影片留 cancelled 标记，同名重建后首次真失败被静默吞（G8 语义只该豁免「在抓被删」那一次）。修：enqueueDoubanFetch 首行 `cancelled.delete(key)` + 缺口 T3 用例。
- **P3 movie 通道名违总线契约** `ui.ts:93,95,446,486,490,537` × `recommend.ts:197` × `smartcat/index.ts:1337`（arch 新-6）——core/domain-bus.ts:5 立约 `<域名>:<事件>`，7 个发射点用退役域名 `movie`。改名要动 smartcat 消费端（排除域），取最小动作：emit 点 + 契约注释登记「movie=历史契约名，属 cinema 域，勿擅改」。
- **P3 死代码/悬空引用** `douban-fetcher.ts:17-19`（BILIBILI_NONE 占位常量删）、`ui.ts:7`/`styles.css:21`/`prototypes/cinema/PROTOTYPE.md:40`（CINEMA_STYLES 清单不存在，措辞改指 cinemaStyle 设置键单源）、`ui.ts:18`（unregisterPanelEsc 死 import，随 unload 注销一并消化）（arch 新-7）。
- **P3 注释失真两处** `constants.ts:4`（STATUS 枚举注释误写评分编码 -1/0/>0，两套语义错位，照注释写消费代码必错）、`settings.ts:3`（指向已不存在的 index.ts readDefaultView，实名 applyDefaultView）（arch 新-8）。
- **测试缺口收编**：T2【高·结构性】`tests/mock-vault.ts:249` parseFrontmatter 无报错 fail-open——「值后裸行」「值含 `: `」真机 js-yaml 整体失效而 mock 照收，FM 破坏类缺陷（C3/C4/模板新-1 同族）在测试环境不可见；修 fail-closed（裸行/值内 `: ` 返回 null）+ 全量 tests/cinema 回归防存量 fixture 误伤。T5【低】data.test.ts `@vitest-environment node` 挪首行。T6【低】unloadCinema 三态断言用例。T1/T3/T4 随各自修复项落地。

### 修复批分工（3 worktree，文件簇互斥）

- **A 写路径与 ui 行为** `bz-fix-cinema-write`（ui.ts 全域 + recommend.ts + tests/mock-vault.ts + tests/cinema/ui.test.ts 与新写路径测试文件）：P2 模板 YAML（processFrontMatter 通道/formatYamlValue 单源导出 + mock T2 fail-closed + 往返回归）、P2 影评静默清空、P2 review 事件补发、P2 桌面空态焦点、P2 ESC 二段清词 keydown（✕ markup 归 B，共用 data-cinema-clear 出口）、P2 滚位存/恢复；P3 非法字符、日期引号（含 recommend.ts:188）、openExternalUrl、ovl 固定 id+closeOverlay 结算、改名 prev 补 file、海报白名单、bindFormSubmit Enter、renderAll 惰性构建、AI#17 围栏+用例、recommend.ts:195 引号、ui.ts:7 CINEMA_STYLES 措辞、ui.ts:18 死 import、mock T2、pragma T5。
- **B 视图层与样式** `bz-fix-cinema-view`（layouts/midnight/render.ts + shared.ts + styles.css + analysis.ts + ui.ts 仅委托层 keydown 一处（键盘可达 Enter/Space 分支，ui.ts:636-721 区）+ 新建 tests/cinema/view-fix.test.ts，不碰 ui.test.ts）：P2 移动端零空态、P2 mob 搜索回显、P2 搜索 ✕ 钮 markup（两端，复用 data-cinema-clear）、P2 卡片键盘可达（tabindex/role/aria + 委托分支）；P3 节奏统计 status 守卫、季行单位、热区（bz-touch-target 类 + pointer:coarse ::after）、占位文案统一、内联样式收编。
- **C 队列基建与文档** `bz-fix-cinema-infra`（douban-queue.ts + douban-fetcher.ts + constants.ts + index.ts + settings.ts + core/domain-bus.ts 契约注释 + tests/cinema/{douban-queue,index}.test.ts）：P3 enqueue 清 cancelled+T3、微单源三处（extractMovieName 单源/stripMdExt import/字符集常量）、BILIBILI_NONE 删、注释失真两处、unloadCinema 补 unregisterPanelEsc('bz-cinema')（ui.ts:18 死 import 归 A）、movie 通道契约登记、unload 三态断言 T6。
- **主线程收口**：CONTEXT.md 影院词条同步（random-pick 补、M.aiTitle 死句删、review 事件按 A 落地结果改口径、「已放映」风味词注一句）；跨批 ui.ts/render.ts 冲突消解；全量门禁。

### 修复与闭环记录（2026-09-20 ✅）

三批分支 `bz-fix-cinema-{write,view,infra}` 合并序 C→B→A（批 A 最重后合，git 3-way 零冲突）。**主线程收口五笔**：①constants 非法字符双套归一——批 A 私有 `ILLEGAL_NAME_RE` 与批 C 导出同名合并后 TS2395，删私有副本改 `hasIllegalNameChar` 复用批 C 单源；②CONTEXT.md 影院词条收口（random-pick 补 / M.aiTitle 死句改口径 / 「已放映」风味词注）；③批 B 登记 ui.test:810 头行钮序断言补触控类；④**旧守卫翻转两例**（review-fix-b「跳过项守护」+ walkthrough-fix-c「C-8」：walkthrough 轮「风格化域不挂共享触控类」豁免与本轮批 B 收编冲突——§8.2 40px 硬下限对风格化域同约束、热区外扩不可见不涉视觉自治，断言翻转并注记，如用户异议可回退）；⑤行为包重出。**门禁**：tsc 0；tests/cinema 222 例绿；全量 6310 例（守卫翻转后全绿）；`pnpm run build` 部署 **a6ba3e6c**；三 worktree+分支清理。**残款登记**：analysis 片龄/年代桶无已看守卫（「想看片的片龄」或有意设计，斟酌项）；两处批外内联样式（analysis 想看 tag-cloud margin-top / render 空库引导 font-size，随下次 markup 触碰）；pomodoro ui.test 全量并发偶发超时（fake timers 时间敏感，单跑绿，非功能）。

> 明细：`.scratch/review-deep/cinema-{func,ui,efficiency,consistency}.md`（arch 待落）。方向 1：P2×1 + P3×7；方向 2：P1×1 + P2×1 + P3×4 + [UX-Suggestion]×2；方向 3：P2×5 + P3×2 + [UX-Suggestion]×3；方向 4：P2×4 + P3×8（含 [UX-Suggestion]×3）+ 附带功能线 P2×1。跨方向去重：ui.ts:142 模板（func=ui）、焦点（ui=eff）、openDouban（func=ui=cons 记名升格）、ESC 清词（eff=cons，cons 并入 ✕ 钮定稿范式）、mob 搜索回显（eff=cons）、热区（ui=cons）。旧账复核四方向一致：已修/闭环确认在位（C1 撤回属实、C2-C10、G6-G9、跟进 B/C、一致#1/#2）；未修 1 条（AI#17，P3，随手收）；144 拍板待做账（删除可撤销 notifyUndo/脏表单拦截）与 ADR-0125 基座迁移在案不另立。门禁基线：tsc 0 错；tests/cinema 11 文件 183 例全绿。

### 已去重条目（func × ui 合并，暂记 P2×2 + P3×9；批次划分待 5 方向齐后定稿）

- **P2 建档模板影评裸插值破 frontmatter** `ui.ts:142`（func 新-1 = ui 新-1，ui 记 P1）——「添加已看 + 多行影评」裸值直插破 YAML：重开面板影片消失、`parseMovieFile` 返 null、豆瓣 sweep 永不覆盖（自愈链断）；含 ` #` 影评下次 processFrontMatter 读回尾部静默丢。对照：douban-fetcher `formatYamlValue`（C3 修复）只覆盖了抓取链，create 路径漏网。修：formatYamlValue 导出复用（推荐）或 create 改走 processFrontMatter 同通道 + 多行/含 `: ` 影评 round-trip 回归。
- **P2 桌面搜索空态整刷丢焦点** `ui.ts:612` × `layouts/midnight/render.ts:173`（ui 新-2）——搜索落空态触发 renderAll 重建含搜索框本体的 `.j-view`，焦点落 body，跨过空态后继续输入全部无效。修（二选一）：A. 空态也只换 `.d-scroll` 局部；B. renderAll 快照 activeElement 回焦 + 光标尾插（照抄 mob 样板 ui.ts:597-598）。
- **P3 添加/加想看无文件名非法字符校验** `ui.ts:435-443` + `recommend.ts:176-192`（func 新-2 = ui 新-5）——《Face/Off》《What If...?》类真实片名 vault.create 必抛 OS 异常，通用「保存失败」提示难懂；saveEdit 有 ILLEGAL_NAME_RE 两条路径不对称。修：校验提共享函数，统一 saveEdit 同款人话提示。
- **P3 建档日期裸写 → Moment → 英文星期显示** `ui.ts:142` + `recommend.ts:188`（func 新-3）——未引号日期被 metadataCache 解析成 Moment，详情/季明细 `slice(0,10)` 显示「Sat Sep 19」；一次编辑即自愈故长期未察觉。修：两处模板日期值加引号。
- **P3 openDouban 裸 window.open 不走单源** `ui.ts:66-73`（func 新-4 = ui 新-3）——失败静默「点了没反应」；切 core `openExternalUrl`（app 在链上可得）。
- **P3 ovl 弹窗 ESC 层唯一 id 绕过同 id 清扫** `ui.ts:229-242`（func 新-5）——unload/非常规关闭路径层泄漏不可 GC，ESC 每次遍历全部陈旧层。修：id 改固定 `'bz-cinema-ovl'` 交 esc-manager 同 id 清扫（域内弹窗不同时叠开，安全）。
- **P3 改名「rename 成功 + 写属性失败」半失败不一致** `ui.ts:147-153` × `ui.ts:466,496`（func 新-6）——saveEdit prev 快照七字段不含 file：面板回滚旧名、盘上已改名、item.file 指新路径。修：快照补 file / 失败回滚 rename / 先写属性后 rename（三选一）。
- **P3 节奏类统计把想看建档日期当观影日期** `analysis.ts:65-73,178,268-284`（func 新-7）——月均/周末/月度/年度/星期桶被想看条目抬高（评分类有 rating>0 守卫、节奏类漏了同款）；备选「想看不写观影日期」动字段语义属拍板项，默认走 status 守卫。
- **P3 季行单位叠字** `shared.ts:242`（ui 新-7）——字段口径自带单位（「2季」）模板再拼「集」→「2季 集」；季行直接展示原文或按 `/季$/` 条件拼。同字段 analysis.ts:148-152 按「N 季」消费的口径矛盾一并核对。
- **P3 海报扩展名白名单漏 avif/bmp/svg** `ui.ts:51`（func 新-8）——手填此类海报永远首字占位。修：白名单补齐或改 TFile 命中即给 URL 交 onerror 兜底。
- **P3 AI#17（旧账）parseRecommendJson 围栏放宽** `recommend.ts:154`——只认 ` ```json `，裸围栏/` ```JSON `/噪声落「返回格式无法解析」；放宽 `/```[a-zA-Z]*\s*([\s\S]*?)```/` 与 knowledge/note-gen 对齐（note-gen 已有容错 parseAiJson 可对照）。

### 方向 3（效率）补充条目

- **P2 搜索 ESC 直接关面板，二段清词语义缺失** `ui.ts:804-806` × `layouts/midnight/render.ts:149/:54`（eff 新-1 = cons 新-4）——clipbook「ESC 清词 + ✕」定稿范式（clipbook/ui.ts:349-357 + 效率#12 尾部 ✕；encrypt ui.ts:740-741 注释明言对齐）未跟：搜索框有词按 ESC 应清词不冒泡、再按才关面板，现状一键关面板且防抖窗口未落词被 `closeOverlay` 一并丢弃；框尾无 ✕，清词只能全选删。修：`j-q`/`j-mq` 挂 keydown（有词 → 与 `data-cinema-clear` ui.ts:651-656 同出口清词 + stopImmediatePropagation，无词放行）+ 框尾 ✕（有词才显示）desk/mob 两端同做。
- **P2 移动端重开面板隐形筛选** `ui.ts:791-800` × `index.ts:19-25` × `midnight/render.ts:54`（eff 新-2）——searchKeyword 跨会话残留生效，但 mob 壳无 value 回显（desk :149 有）：网格被旧词过滤而搜索框空白。修：mob 壳回显 `value`（对齐 desk，最小改；closeOverlay 清词属行为语义改动不做）。
- **P2 滚位零记忆 + 队列双刷放大** `ui.ts:778-789` → `midnight/render.ts:173/:189`（eff 新-3）——renderAll 整写 innerHTML 销毁滚位，标记/保存/筛选/队列完成（douban-queue.ts:231-240 立即+1.5s 双刷）全部跳顶。修：renderAll 渲染前存 `.d-scroll`/`.m-scroll` scrollTop 渲染后恢复（clipbook 效率#17 已上线样板 clipbook/ui.ts:89,1250-1271）；批内可选最小加做：队列完成刷新走 `refreshDeskList` 局部通道。
- **P2 卡片键盘不可达** `shared.ts:163-172` × `ui.ts:636-721`（eff 新-5）——`.pcard` 裸 div 无 tabindex/role，全域零键盘监听，纯键盘用户搜得到片打不开片。修：卡片 tabindex=0 + role=button + aria-label + 委托层 keydown 分支（Enter/Space 开详情，对齐 review 域不可达卡整改范式）。
- **P3 表单 Enter 不保存** `ui.ts:391-430`（eff 新-6 修半）——core `bindFormSubmit`（core/ui/modal.ts:27-45，textarea 天然豁免）在位未用；接上即可。autofocus 半边归拍板 C2。
- **P3 renderAll 恒算 AI 页 + 分析页 19 板块** `ui.ts:565-586`（eff 新-7）——列表页每次点筛/搜索防抖拍/队列双刷都在重算两份永不显示的大字符串（buildTasteProfile 全库加权 + analysis 19 板块拼装）。修：midnightInput 按 `M.view` 惰性构建（list 页跳过），几行收掉。
- **P3 搜索占位文案与实际字段不符** `midnight/render.ts:149/:54` × `data.ts:158-168`（eff 新-10 = cons 新-12 部分合并）——主演/导演可搜但两端占位都没提全且两端互斥。修：两端统一「搜索片名、类型、导演、主演、影评…」（省略号统一 `…`）。

### 方向 4（一致性）补充条目

- **P2 编辑改状态致影评静默清空** `ui.ts:422-423` × `:157-158`（cons 附带功能线）——编辑「已看」影片改回「在看/想看」保存：表单只对「已看」收集影评（强置 `review=''`），persistItem 随即 `delete fm['影评']`，用户影评静默丢失且通知「已保存」。修：非「已看」态保留原影评不写空（推荐）+ 回归。
- **P2 移动端列表视图零空态** `midnight/render.ts:186-190` × `:170-172`（cons 新-2）——空库/筛选无命中 = 整片空白，desk 的 emptyPageHtml（无匹配+清空筛选/空库+添加引导）mob 分支没有，搜索词错只能逐字删。修：`renderMidnightMob` list 分支补 `cards.length ? grid : emptyPageHtml(viewFiltered(v))`（`data-cinema-clear` 委托全端已生效，零行为层改动）。
- **P2 movie 域事件 `review` 类零发射** `ui.ts:462-500` × `smartcat/movie-source.ts:13-18,52-59` × `CONTEXT.md:102`（cons 新-3）——契约/文案层（movieReviewText 写改删三态）/CONTEXT 词条三方俱在，唯 saveEdit 漏发 emitter，`movieReviewText` 成死代码。修：saveEdit 落盘成功后按 prev.review 快照补发 `{ kind:'review', fromReview, toReview }`（3 行 + 回归）。
- **P3 触控热区** `styles.css:122/:126/:130`（ui 新-4 = cons 新-5）——移动头行四钮 30×30 低于设计手册 §8.2 绝对下限 40px，全域零 `pointer:coarse` 扩热区（stylized 域唯一）。修：头行四钮挂 `bz-touch-target` 修饰类（memo/render.ts:127 先例）+ `.chip` 等照 diary/styles.css:1310 先例补 `@media (pointer:coarse)` `::after` 外扩（视觉零改动）；chips 横条紧凑行按 components.css §8.2 口径不适用外扩的不动。
- **P3 CONTEXT.md 影院词条三处脱节** `CONTEXT.md:102`（cons 新-7）——缺 `bz-cinema-random-pick` 命令、`M.aiTitle` 已死句、review 事件不实。修：随 review 事件拍板结果同步（主线程文档收口）。
- **P3 域内微单源三处**（cons 新-8）——《》提取双实现（data.ts:16 × douban-fetcher extractMovieName:45-49，data.ts 改用域内单源）、stripMdExt 内联（fetcher:46 改 import core/ui/str:74）、非法字符集双份（ui.ts:129 × fetcher:349，常量落 constants.ts）。
- **P3 静态内联视觉样式收编** `shared.ts:152/:209/:219/:250` × `analysis.ts:259-297`（cons 新-9，ADR-0020）——静态视觉值平移 styles.css 建类（值零改动不破探索稿 1:1）；动态行为性样式豁免不动。
- **P3 unloadCinema 不注销面板 ESC 层** `index.ts:154-169`（cons 新-10）——bookshelf B1/gameshelf/home 均卸载注销，本域漏。修：补 `unregisterPanelEsc('bz-cinema')` 一行对齐。
- **P3 文案口径收尾**（cons 新-12 除占位符外）——「已加入想看：X」（recommend.ts:195）补「」与全域引号形制对齐；「已看/已放映」同页双称保留午夜场风味词、CONTEXT 词条注一句口径（不改用户可见文案）。

### UI/体验分流（6 项 → review-deep-ui-pending.md：C1 集合外 tag 表达 / C2 名称框自动聚焦 / C3 季圆点热区 / C4 失败通知 setAction 重试钮 / C5 菜单补「标记想看」回退 / C6 分析页 19 板块图标语义化——均为新交互供给或含设计选择，等总拍板）

### 已核验无问题摘要（func+ui）
面板生命周期/手势浮层单源/渲染竞态/数据-UI 对账/styles（滚动条零自造、--bz-vvh 守卫）/设置接线/main.ts 四命令三段式——逐面确认无新洞（详见 cinema-ui.md §三、cinema-func.md §三）。

---

## belongings（归物本）域 · 审查入账中（方向 1 功能 + 方向 2 UI 已到账；方向 3 效率审查中，4/5 待派）

> 明细：`.scratch/review-deep/belongings-{func,ui}.md`（eff 落地中）。方向 1：P3×8 + [UX-Suggestion]×2（数据安全面经往轮修复已扎实，新发现全是罕见路径静默失败与口径分叉）；方向 2：P2×5 + P3×4 + [UX-Suggestion]×2 + 测试缺口 6。跨方向去重：closePanel 收口（func P3-1 = ui P2-1 同根并入 P2）。旧账复核：H8-H20 全部在位（panel-fix.test 回归在册）、autumn 体验账 4 条中 3 已修；未修 2 条（autumn UX② 当月列空档 → 本轮修；随机 id 后缀理论可空串 → 风险趋零登记不修）；消解悬案 1 条（删除双保险口径，见拍板清单 B7）。门禁基线：tsc 0 错；tests/belongings 9 文件 185 例全绿。

### 已去重修复项（暂 P2×4 + P3×11；批次待 5 方向齐后定稿）

- **P2 closePanel 收口不全（浮层悬空）** `ui.ts:399-419`（func P3-1 = ui P2-1）——表单（uiModal 壳挂 body）/移动抽屉/右键菜单开着时再触发 `bz-belongings-open`（toggle 直关面板）：面板关而浮层悬空，孤儿表单「保存」会写到已关面板会话外。修：closePanel 开头 `requestCloseBelForm()`（与 ESC 分支 :222-226 同语义）+ closeItemMenu + 收抽屉。
- **P2 详情弹窗编辑保存后不刷新** `ui.ts:983-1050`——保存成功详情仍显旧价格/旧状态（「保存没生效」视角）。修：保存后按当前详情 id 重建详情。+ 断言。
- **P2 移动端开表单 100ms 强制聚焦** `ui.ts:1052`——遗留 setTimeout 聚焦绕过 core uiModal 防软键盘口径，软键盘顶起遮状态格/保存钮。修：删遗留聚焦交 core 口径。
- **P2 裸 100vh 未接 --bz-vvh**（移动面板/报告页）——clipbook/memo/cinema 均已接，本域唯一异类，软键盘顶起遮底钮。修：接 `--bz-vvh` 同口径。
- **P3 openPanel loadDatabase reject 被 void 吞** `index.ts:15-17`——命令静默无反应；openForm/报告入口有 catch，三入口兜底不对称。修：补 catch 人话通知。
- **P3 删除确认框在途时命令关面板** `ui.ts:712`——确认后 `!M.db` 静默 no-op。修：no-op 前给提示（或拒绝在途关面板，取小改）。
- **P3 报告开着面板内保存触发重入** `report.ts:81-83`——ctxYear 每次清空，翻年上下文跳回最新年。修：重入保留 ctxYear。
- **P3 脏日期/无效 exit_date 口径分叉**——面板字符串前缀 vs 报告解析两套归一；`daysUsed`（回落今天）与 `exitTsOf`（不封口）天数语义不同。修：统一口径（实施时按报告细节定单源）。
- **P3 价格无上限校验** `ui.ts:959/1001/977`——`1e308` → Infinity → JSON 序列化 null → 读回 0。修：非有限值拦截 + 合理上限钳制。
- **P3 编辑清空分类被静默回填旧值** `ui.ts:961`——与新增 fail 提示不对称。修：清空走同新增校验口径。
- **P3 流转撤销不补发领域事件**——smartcat 行为流记「转卖」无撤销记录。修：撤销补发事件（favorites unarchive 补发先例）。
- **P3 搜索防抖「关后 180ms 内重开」竞态**——旧词灌新面板。修：closeOverlay 清 timer 或回调验面板存活。
- **P3 年份下拉 `data-v` 漏 esc**——域内唯一转义漏点。修：escAttr。
- **P3 触控热区不足**——报告头行三钮 + 移动端下拉触发器。修：`bz-touch-target` 修饰类。
- **P3 autumn UX②（旧账未修）当年日均走势当月列恒空档** `report-stats.ts:209-217`——9-12 月四列空档。修。

### UI/体验分流（7 项 → review-deep-ui-pending.md：B1 移动资产筛选不可达（拍板敏感）/ B2 聚焦无 ring / B3 图标无法清除 / B4 0 元 ¥0.0000 / B5 下拉键盘 ESC 粒度 / B6 AI 换图标不触发脏检测 / B7 删除口径全局定稿（全局项））

### 方向 3（效率）补充条目

- **P3 表单无 Enter/Ctrl+Enter 提交** `ui.ts:953`（eff E1）——core `bindFormSubmit` 在位未消费（diary 先例），8 字段填完必须摸鼠标。修：接 bindFormSubmit。**B7 消解**：E5 核实效率整改 5 拍板口径（core/notice.ts:137-139 在案）+ favorites 免确认直达先例——删除口径已定，belongings 属落地欠账归修复批，不再列待拍板。
- **P3 网格卡片键盘不可达** `layouts/poster/render.ts:152`（eff E2）——cellHtml 无 tabindex/role，Tab 序跳过内容区。修：clipbook C-UI5 先例平移（tabindex+role+aria+委托 Enter）。
- **P3 搜索 ESC 直落关面板 + 无 ✕** （eff E3）——clipbook 定稿范式未跟。修：二段清词 + 尾部 ✕（diary ui.ts:390-400 样板，含防抖 cancel）。
- **P3 年份筛选跨开合残留** `ui.ts:266-270/417-418`（eff E4）——closePanel 清 q 不清 year、openPanel 重置 status/sort 不重置 year，四态三回落一孤儿，重开列表隐性变少。修：year 纳入回落口径。
- **P3 删除仍「确认+撤销」双保险** （eff E5，效率整改 5 最后滞后域）——对齐免确认直达 notifyUndo（favorites 先例），顺带消解 func P3-3 确认在途死端。**确认框去除属拍板口径内的落地执行，随修复批做。**
- **P3 renderAll 口径卫生** （eff S2）——filtered×3 + 计数 filter×10+，单趟收口（非性能硬伤）。
- 滚位记忆核验无欠账（content 容器不重建，renderAll 天然保滚位）。[UX-Suggestion] S1（新增保存后新卡定位反馈）归拍板清单。

### 方向 4（一致性）补充条目（同根并入：ESC 清词✕→E3、bindFormSubmit→E1、year 残留→E4）

- **P3 KPI「回收」与统计层口径矛盾**（cons ⑤，本方向最优先）——KPI「回收」不筛状态 vs 统计层仅认已转卖：「转卖记售价→流转丢弃」可达路径上两处数字矛盾。修：口径统一（回收=已转卖）。+ 断言。
- **P3 加载失败通知收编 notifyActionError+onRetry**（cons ③，与 func P3-2 void 吞 reject 同链合并）——命令入口补 catch + 通知走 core 单源带重试出口（clipbook/pv/encrypt 先例）。
- **P3 todayStr 域内复写**（cons ④）——全库仅本域未收编 core `localDayKey`。修：切单源。
- **P3 状态串字面量散布 8+ 处**（cons ⑦）——违反域内「禁再手抄」自规。修：收口 STATUS_ORDER/constants 单源。
- **P3 日均格式化双写**（cons ⑧）——cellHtml 内联 vs report.trimNum，`<0.01` 特判行为不同。修：单源格式化；0 元显示形态归拍板 B4。
- **P3 表单成功保存绕开 closeBelForm 单一关闭路径**（cons ⑩）——belFormMask 残留（危害趋零）。修：收口单一关闭路径。
- **P3 搜索占位符未提可搜字段**（cons 低值观察）——实际匹配 name/category/description。修：顺手改「搜索名称 / 分类 / 备注…」。
- **P3 CONTEXT.md 词条脱节 + src 头注同病**（cons ⑨）——仍写已拍板去除的页脚/旧移动头部，issue 356 报告页与四设置键零提及，「归物本为空弹窗」表述过时。修：主线程文档收口随批同步。
- 滚动条/命令 ID/事件契约（emit 四 kinds 与 smartcat 逐字段对齐）/设置 schema 形制——核验全绿。

### 方向 5（架构/测试）补充条目（审查完成，5/5 到账）

- **P3 checkup SEGMENT_FIELDS 旧 5 键约定误报**（A1，跨域记 checkup 轮）——`checks-drift.ts:34` 仍按旧 5 键约定，而 `saveDatabase` 自 ADR-0102 起只落 3 键（categories/categoryIcons 内存派生）：活跃库每次数据体检恒报 info「缺少数据段」。零测试锁定。**归 checkup 域轮修**（该文件属 checkup，不跨批）。
- **P3 startAutoRefresh 的 modify 回调 loadDatabase 无兜底** `ui.ts:442-445`（A2，与 func P3-2/cons ③ 合并为「域内全部 loadDatabase 调用点兜底收口」）。
- **P3 表单模块态游离于复位清单**（A3）——`_belBaseline/_belFormTargetId/belFormMask` 等不在 `resetBelongingsState`/cleanup 复位清单，unload 靠 DOM 自愈兜底，对照 `unloadBelReport` 全清先例。修：纳入复位清单。
- **P3 selfWritePending 单布尔并发交叠失效**（A4）——P44「去双渲染」口径弱化（多余重渲、数据无损）。修：计数器/时间戳化（小改）。
- 注记五条随批顺带：ESC 层手写旗标收编 registerPanelEsc 样板（favorites 同款）、getDataFilePath 重复兜底表达式收敛、测试 setup 死键 `belongingsDataFolder`、d2 fixture 字段名漂移、表单双轨收口（=cons ⑩）。
- 架构主体验证全数过验：依赖方向（唯一他域 import=smartcat 纯函数单向，有先例）/纯层纯度机械守卫/原型样式单源/命令契约/数据写链测试锁定。

### 修复批定稿（2 worktree，ui.ts 按行区拆分）

- **A 数据口径与删除链** `bz-fix-bel-data`（data.ts + ui.ts 表单/写路径/删除链区 + tests）：P2 价格上限、脏日期口径统一、todayStr→localDayKey、STATUS_ORDER 收口、A4 selfWritePending、getDataFilePath 收敛、清空分类对称、流转撤销补事件、**E5 删除免确认直达 notifyUndo（效率整改5 落地，favorites 先例；确认框去除，顺带消解确认在途死端）**、全 loadDatabase 调用点兜底（func P3-2+cons ③+A2）。
- **B 视图交互与报告** `bz-fix-bel-view`（layouts/poster/render.ts + report.ts + ui.ts 面板/搜索/委托区 + styles.css + tests）：P2 closePanel 收口、详情保存后刷新、移动端强制聚焦摘除、--bz-vvh、E1 bindFormSubmit、E2 卡片键盘可达、E3 搜索 ESC 二段+✕、E4 year 回落、防抖重开竞态、data-v esc、报告热区、A3 模块态复位清单、KPI 回收口径、日均格式化单源（0 元形态随 B4 拍板）、autumn UX② 当月列、表单单一关闭路径、ESC 层收编样板、搜索占位符、renderAll 口径卫生。
- **主线程收口**：CONTEXT.md 词条（页脚/旧移动头部/issue 356 报告页/设置键/空弹窗表述）+ src 头注同步；checkup 轮记名（A1）。

---

## bookshelf（书库）域 · 审查入账中（方向 1 功能 + 2 UI + 3 效率 + 4 一致已到账；方向 5 架构审查中）

> 明细：`.scratch/review-deep/bookshelf-{func,ui,efficiency,consistency}.md`。方向 1：P2×1+P3×5+建议1；方向 2：P1×1+P2×3+P3×4+建议3；方向 3：P1×1+P2×1+P3×4+建议3；方向 4：P1×1+P2×1+P3×5+建议5。跨方向去重：读书笔记孤岛（eff=ui F4=cons C2 → BS1 拍板）、continueReading 裸赋值（func F1=cons C1，升格 P1）、搜索 ESC 清词✕（eff=cons）、热区（ui F6=cons）、100vh（ui F3）。删除口径分歧裁决：划线删除维持确认框（func 判不可逆 + issue 223 只读化拍板在案；cons UX 判可逆属误读，异议登记不采）。旧账：G12 在位、G11 维持证伪、一致#3/issue 291 残款健在。门禁基线：tsc 0；tests/bookshelf 110 例全绿。

### 已入账条目（去重待 5 方向齐）

- **P1 读书笔记弹窗全域零入口** `bookshelf/reading-note*`（eff = ui F4 同根合并）——ADR-0096「功能零回退」拍板 vs issue 223 入口移除 vs CONTEXT.md:96/ADR-0091/ADR-0096/settings.ts:173 四处文档仍宣称可用：933 行活代码 + 36 用例悬空不可达。**修法含产品决策（恢复最小入口 or 清理代码+同步四处文档），归拍板清单 BS1。**
- **P1 continueReading/「继续在读」裸赋 M.view 绕过 showView** `index.ts:97` × `ui.ts:147-152`（func F1 = cons C1，升格 P1）——面板停在报告视图时触发：容器显隐不切换、报告内交互分支全失联、墙渲染进隐藏容器，**面板假死只能 ESC 逃生**；漏 `cancelReadingReport` 收口。修：改调 `showView(app,'shelf')` 一行 + 收口报告。+ 覆盖用例（含死锁场景，现零覆盖）。
- **P2 冷开报告视图「返回书库」永挂加载占位** `ui.ts:317-323 × :277`（ui F1，F2 同根）——冷开报告路径从未 renderAll，goto-shelf 也不补渲染；报告期间数据变化返回同样陈旧墙。修：冷开路径补渲染 + goto-shelf 补 renderAll。测试 :364 只断容器类切换的盲区一并补断言。
- **P2 移动端面板/借书卡裸 100vh**（ui F3）——接 core `--bz-vvh`（clipbook/diary/cinema 先例）。
- **P3 检索框无 ESC 清词/✕**（eff）——clipbook 效率#11/#12 + diary D-UI3 定稿范式缺口，框内 ESC 直关整面板。修：二段清词 + 尾 ✕（全库统一范式）。
- **P3 EPUB 编辑想法保存失败零反馈** `ui F5`——同文件删除路径有 notice，编辑漏。修：补失败通知。
- **P3 移动端排序钮 28px/书脊 22px 低于 §8.2 下限**（ui F6）——挂 `bz-touch-target` 修饰类（六域已消费，本域零消费）。
- **P3 借书卡缺「× 关闭」钮 + dialog 无 aria-label**（ui F8）——× 系 issue 223 拍板保留项，属拍板执行补齐。

### 方向 4（一致性）补充条目

- **P3 失败通知类型/文案三轨**（cons）——notes.ts info/error 混用。修：收编 `notifyActionError`+onRetry 单源（与 efficiency 线同项合并）。
- **P3 settings.ts 键注释三处陈旧**（cons）——悬空 MFS 注释/旧四档排序/十选一。修：随批纠偏。
- **P3 `updateComment` onDone 死参数且与 `deleteHighlight` 同名反义**（cons）。修：命名与签名理顺。
- **P3 分类色板与终稿 20 类脱节**（cons）。修：色板对齐。
- **P3 CONTEXT 词条 439「统一行操作已接书库」失真**（cons）——随 BS1 拍板结果一并主线程文档收口（词条 96/84/439 三处漂移）。
- **UX 登记**：报告视图重开保持与「书库」命令语义张力（cons）→ 拍板清单 BS 系；划线删除确认框维持（见头部裁决）。

### 方向 5（架构/测试）补充条目（审查完成，5/5 到账）

- **P3 data.ts 逆向依赖渲染纯层 + getDisplayItems 同名双形制 + shared.ts:31 注释失真**（A1 一体三面）——跨域 API 面被 ADR-0104 迁移副作用撑大。修：依赖方向理顺（渲染层回调注入/上移消费方，按现场最小改）+ 同名双形制收敛 + 注释纠偏。
- **P3 bookshelf⇄reading-report 双向回指**（A2，复核修正 func 线「不回指」失实）——ADR-0091 宿主关系（stats.ts:6/index.ts:15 回指 bookshelf/data）。修：主线程 ADR-0091 后果节补一句显式认可（文档动作，不改码）。
- **P3 weave-data.json 读侧损坏静默吞**（A3）——EPUB 区静默清空与「未用 Weave」不可区分、零告警（写侧零侵入是拍板契约，读侧缺最低可观测性）。修：损坏降级时一次性告警通知。+ 用例（中）。
- 测试缺口 6（中 2：md 写盘→modify→自动刷新链路集成覆盖、读侧损坏降级；低 4：issue 291 断言冗余/裸 sleep/死 provider 注入/pragma 首行卫生）。

### 修复批定稿（单批 + 主线程文档收口）

- **A 核心行为与数据** `bz-fix-bs-core`（index.ts + data.ts + shared.ts + ui.ts + styles.css + notes/epub-notes 通知链 + tests）：P1 continueReading showView+收口+用例、P2 冷开报告占位、P2 100vh、P3 批注引号反转义、weave create 监听、progress 钳制、分类计数口径、resize 监听、M.renderFn 删、bindFormSubmit、自动刷新滚位+重刷收口、回落口径单源、continueReading 假空态、EPUB 编辑失败通知、热区、借书卡×+aria、失败通知三轨→notifyActionError、settings 注释三处、updateComment 理顺、分类色板对齐、A1 逆向依赖理顺、A3 读侧损坏告警、ESC 清词✕、测试缺口中 2 项。
- **主线程收口**：CONTEXT 词条 96/84/439（读书笔记按 BS1 拍板结果、统一行操作失真句）+ ADR-0091 后果节认可句。
- **拍板清单**：BS1 读书笔记孤岛（eff/ui/cons 三向同根）；BS2 catFilter 语义不对称；BS3 报告视图重开保持语义张力。
- **P3 批注引号往返不反转义**（func）——批注 `"` 写入转义 `&quot;` 但读取展示不反转义，往返二次恶化。修：读侧反转义。
- **P3 weave-data.json 只挂 modify 不挂 create**（func）——Weave 首次落盘不刷新。修：补 create 监听。
- **P3 md progress 不钳负值**（func）。修：钳制。
- **P3 分类标签计数 vs 筛选口径分叉**（func）——「3 册」点开 5 本（计数排除未读、筛选含未读）。修：口径统一。
- **P3 卸载不摘 window resize 监听**（func = ui F7）。修：卸载走 closeOverlay。
- **P3 M.renderFn 死字段**（func，全域零消费方）。修：删除。
- **P3 编辑弹窗未接 bindFormSubmit**（eff）。
- **P3 自动刷新丢墙滚位 + renderAll 无谓重刷/装箱强制回流**（eff）。修：滚位保持 + 重刷收口。
- **P3 重开回落口径三层混用**（eff）。修：单源回落。
- **P3 continueReading 陈旧数据假空态**（eff）。修：数据新鲜度校验。
- **UX 分流**：func（catFilter 跨重开保留与 side/sort 复位语义不对称）+ eff×3（明细待报告到账后补录）→ 拍板清单 BS 系。

---

## gameshelf（游戏库）域 · 审查入账中（方向 1 功能已到账；方向 2/3/4 运行中，5 待槽位）

> 明细：`.scratch/review-deep/gameshelf-func.md`。方向 1：P1×1 + P2×2 + P3×11。旧账复核 6 条（window.open 记名本域收口、同步按钮引导态已缓解、关面板中止回填维持拍板、uiSelect ESC 已修等）。数据安全面核验健壮：对账 upsert 零覆盖主承诺、8 段成就行契约、截图同序同长、媒体键分工、三队列幂等熔断、Steam 解析三级兜底。门禁基线：tsc 0；tests/gameshelf 118 例全绿。

### 已入账条目（跨方向去重待 5 方向齐）

- **P1 自动同步链断点** `sync.ts:119` × `index.ts:30`（func F1）——`autoSyncOnOpen` fire-and-forget、await 落空：首开空库/新游戏入账后媒体本地化、中文名回填、商店/成就回填三队列全部不启动（命令与手动按钮路径正确，唯自动同步漏），「拉到的都存本地」承诺在首次接入主路径不兑现。修：返回 runSync promise（一行）。+ 回归。
- **P2 已下架手改被同步翻回（拍板项）** `reconcile`（func F2）——用户手改 `已下架: true` 被下次同步「Steam 在场即恢复在架」静默翻回。设计语义 vs 用户意图冲突，**归拍板清单 GS1**。
- **P2 window.open 旧账收口** `ui.ts:794`（func F3）——切 `openExternalUrl`（cinema 同族已清）。
- **P3 群（11 条，func）**：closePanel 关停三选二（posters 不随面板关停，与 backfill 关停理由矛盾）、unloadBackfill 置 running=false 可致双消费者、无中文名游戏每开面板重拉永不收敛、媒体下载无超时、尾斜杠配置零匹配、消歧文件名展示带尾巴等（修复批定稿时按报告展开）。

（方向 2 UI / 3 效率 / 4 一致运行中，5 架构待槽位——到账后去重定稿修复批次。）
