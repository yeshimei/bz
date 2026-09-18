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

（下一域：memo，5 方向审查并行中）
