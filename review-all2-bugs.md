# 全域第二轮 bug 复核报告（bug 线，2026-09-15）

- 口径：六个只读审查代理分 6 组扫全部功能域（排除 smartcat/secondbrain/knowledge），基准 AGENTS.md 铁律 + docs 四本手册 + CONTEXT.md。
- 性质：**增量复核轮**——首轮（review-all-bugs.md 09-11，102 条）+ cinema/clipbook 补审（09-13）已分 7 批修复闭环；本轮复核修复闭环质量 + 扫首轮遗漏 + 扫 09-11 以来新增改动。
- 严重级：P0 丢数据或数据损坏 / P1 功能错误 / P2 明显硬伤 / P3 小瑕疵。标【待验证】的修复前须先验证证实。
- 门禁佐证：审查期间主仓 `tsc --noEmit` 0 错误（全量 vitest 另行核对）。
- 汇总：**进行中**（6 组）

---

## 一、共享基座（core + main.ts + settings.ts）— 7 条（P1×1 + P3×6）

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| N1 | `src/core/esc-manager.ts:41-43,60-65` × `src/main.ts:322` | **P1** | escManager 是模块级单例，`destroy()`（onunload 调用）摘掉 document keydown 后**无重挂入口**；Obsidian 禁用插件不重新求值模块——同一会话「禁用 bz 再启用」后所有 esc 层照常注册但无人监听：域面板/设置弹窗/路径选择器/确认框/灯箱/右键菜单的 **ESC 全部永久失效**直到重启，层数组持续累积。修法：destroy 改软关（`disabled` 旗标 + onKeydown 首行判旗直返），新增 `arm()` 供 onload 调用；或 destroy 只清 layers 不摘 document 监听。 |
| N2 | `src/main.ts:305-379`（对照 lightbox/settings-modal/path-picker/settings-model-picker） | P3 | C14 只收口了 flow-dialog：onunload 不调 `closeSettingsModal()` / `closeModelPicker()` / `closePathPicker()` / `closeLightbox()`（均已导出、幂等）——禁用时若浮层开着，遮罩残留且灯箱把 `body.style.overflow='hidden'` 滚动锁留在 body。修法：onunload 补调四个 close。 |
| N3 | `src/core/ai.ts:688-697` | P3【待验证】 | `prompt()` 流式已推部分 onDelta 后失败，catch 里非流式兜底整发——兜底增量**从头重放**给同一 onDelta：聊天气泡显示「半截流 + 重发全文」拼接重复（final 覆盖自愈，期间可见错乱，双倍计费）。修法：兜底重发前给 `options.onRetry` 重置信号，或兜底通道不回调 onDelta。验证：本地起推 2-3 段 SSE 后断连的 mock 指向 custom provider 开第二大脑对话。 |
| N4 | `src/core/settings-main-schema.ts:158-182` | P3 | 「上下文窗口」「最大输出 token」两个 number 行未声明 min 钳制（其他 number 行均有 `min:1`）：输入 -5 照常落盘，`max_tokens:-5` 发给服务商 → API 400，全部 AI 功能报错且难懂。修法：两行补 `min:0`（'0' 语义为清除覆盖，口径自洽）。 |
| N5 | `src/core/settings-schema.ts:594-601,612-618,626-637,643-659,413,574-575` | P3 | 除 list 行（C10 已修）外全部行型持久化「先翻 UI 再写盘且无 catch」：toggle/select/slider/choiceCards 的 `await acc.persist()` 在 onChange 回调里被丢弃，text 类 `void acc.persist()`——落盘失败时控件显示新值但 data.json 没存上，无提示。修法：persist 包 try/catch + notifySaveError（与 C10 同口径）。 |
| N6 | `src/core/settings-schema.ts:572-588` × `src/core/path-picker.ts:243-253` | P3 | path 行 onChange 包装器两侧均无 try/catch：域行回调同步抛错 → unhandled rejection，chips 停留旧值无提示。修法：apply 内 try/catch + notifySaveError + renderAll 回滚。 |
| N7 | `src/core/ui/lightbox.ts:37` | P3【潜伏】 | 媒体类型兜底 `opts.src.endsWith('.mp4')`：`getResourcePath` 带查询串判不上 → video/audio 被 `<img>` 渲染。当前无域消费 core openLightbox（diary 自实现灯箱），属组件库潜伏缺陷。修法：剥 query 再判后缀或文档强制传 type。 |

已核验无问题（摘要）：C1-C16 修复逐条复核闭环（ai 超时 armIdle 分段重置/TimeoutError 与 AbortError 区分、obsidian-adapter C3/C4、select/popover ESC、item-actions 吞 click 校验落点、crypto LRU、z-order 反注册+sync 兜底、flow-dialog 顶替结算、path-picker 竞态、settings-schema 防抖/脏旗标、main.ts 卸载全量接线、saveQueue 不断链、C16 迁移即落盘）；**新增 zhipu-plan（智谱 Plan）注册表行字段齐备**无漏网分支；图像输入（issue 311）MIME 白名单/32MiB/分块 Base64 正确；notice 去重合并/常驻帧配额、dom/utils 长按/剪贴板/拒绝采样、core/ui 全组件、storage 损坏留档三路+copy-then-rebuild、diary-format 序列化往返、list-patch 键控 diff 逐分支核验无问题。settings.ts 残留「移动端默认全屏」孤儿注释属文档过期不计条。

---

## 三、锁家族（encrypt + password-vault + memo）— 11 条（P2×1 + P3×10）

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| N8 | `src/memo/ui.ts:749-767`（jumpToNote） | **P2** | `void leaf.openFile(file)` 未 await 紧接同步读 `leaf.view?.editor`——此刻 view 还是旧视图：旧视图恰为 md 编辑器时 setCursor/scrollIntoView 打在**上一篇笔记**上，两种情况目标行定位都从不生效。修法：await openFile 后再取 editor（必要时挂 active-leaf-change/rAF 兜底）。 |
| N9 | `src/encrypt/ui.ts:634-637,1787,1868,2167,692-705,1992-2013` | P3 | 安全模式域弹窗游离在空闲上锁之外：15 分钟空闲计时（bump）只挂 `this.popup`，而密码条目/平台编辑/销毁确认弹窗全挂 document.body——弹窗里持续操作不重置计时，到点照常上锁且 lockNow/hide 不关弹窗：点「保存」报「未解锁」草稿卡死。修法：bump 改挂 document 捕获阶段；lockNow/hide 收场调 `closeAllDialogs()`。 |
| N10 | `src/encrypt/ui.ts:2016-2028` × `:698,701,1994,1997` | P3 | 共锁感知不对称（E2 只修了 pv 方向）：外部（日记域/pv）上锁后本域只 renderAll——manifest 已清空，面板以空清单重绘成误导空态；且 `pwDataManager.lock()`、`_diaryPlain`、`lastHealth` 只有自身 lockNow 路径才清，外部上锁后明文缓存残留内存。修法：订阅 `encrypt:unlock-changed`，false → 清缓存 + 锁屏接管或收面板；`vault-assets-view.ts:69` hero「保险库已解锁」改按 `dataManager.unlocked` 动态出。 |
| N11 | `src/encrypt/ui.ts:1059-1184` | P3 | `showPasswordDialog` 无单例守卫：状态栏快速双触发连开两层解锁屏，解锁一次另一层悬着要求再输。修法：模块级句柄判存活直接复用/返回同一 Promise。 |
| N12 | `src/encrypt/data.ts:444` × `:1071-1079` | P3【待验证】 | `saveManifest` 的 `encrypt:changed` 广播在 S2 清单落盘后、S3 `promoteStaged` 镜像搬入前：首建密码本那一笔广播到达时镜像未就位，外部消费者 decrypt 读 null 静默吞、无补偿事件。当前唯一外部消费者视图已是死代码（现实影响≈0），属同步协议时序隐患。修法：S3/S4 完成后补发 changed，或 load 读 null 不置缓存安排重试。 |
| N13 | `src/password-vault/ui.ts:932-961` | P3 | eye 切明文后**弹窗重开不复位**：再开任意弹窗密码框仍 `type="text"`（encrypt 侧同弹窗有复位，两侧不对称）——自动生成密码以明文示人。修法：openEntryDialog 补 type/icon/title 复位。 |
| N14 | `src/password-vault/ui.ts:1089-1097` | P3 | 安全模式上锁不清 `shownIds`（也无 encrypt 侧 15s 自动回遮）：点过眼睛的条目重锁再解锁**直接明文呈现**。修法：hide/lock 时 `shownIds={}`；考虑引入同款自动回遮消两域口径差。 |
| N15 | `src/password-vault/ui.ts:1369-1376` | P3 | 密码错误时「密码错误，请重试」与「N 秒后可再次尝试」连发后者覆盖前者，且随后清空输入使两条自动清除守卫都不成立——锁屏上只留一句无来由的「1 秒后可再次尝试」。修法：合并为一条「密码错误，N 秒后可重试」。 |
| N16 | `src/password-vault/ui.ts:1123-1134` × `:1188-1218` | P3 | E2 外部上锁路径只 renderAll 不重跑 `showLock()`：锁屏文案/输入框停留上一次状态——典型：锁屏标题仍写「设置主密码」但库其实已建好，旧输入残留。修法：onSharedLockChanged(false) 分支 renderAll 后补 `void this.showLock()`。 |
| N17 | `src/password-vault/render.ts:302` | P3 | `data-id="${d.id}"` 未转义——同文件其余字段全 esc，唯独清单 JSON 里可手工构造的 id 裸进属性位。修法：`escAttr(d.id)`。 |
| N18 | `src/password-vault/index.ts:63-69` + `ui.ts:1093` | P3 | ① `lockPasswordVault` 在 `lockSafe` 已锁后仍再 `dataManager.lock()`，一次上锁 2-3 次冗余广播；② 安全模式判定单读 config 启动快照，encrypt 侧是「config ∨ 设置实时值」双口径——同开关两面板行为不一致。修法：① ok=false 跳过；② 对齐 OR 双读。 |

已核验无问题（摘要）：E1-E23+D4 修复逐条复读未引入新缺陷（E5 markup 默认掩码、E14 删前重读 stale 保留、E13 opQueue 串行无死锁、E9 renderWithTimeout 孤儿化、E2 lastUnlockSeen 防死循环）；`.safe.enc` 三段原子写 + 三崩溃点恢复；mapLimit 失败收尾与 stagedRefs 配套；memo.json 全 CRUD 与 file-sync 同走 enqueueFileTask 串行无竞态；E19-E22、rename 去抖三处短路、uiChoice 契约、锁屏 esc 层序逐项核验。备注：E6 同型移动页问题在 encrypt 侧 vault-pw-view 属不可达死代码不计条。

---

## 二、日记家族（diary + recap + checkup）— 14 条（P2×4 + P3×10）

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| D1' | `src/diary/ui/dialogs.ts:318-379,199-249` × `ui.ts:2083-2104` | **P2** | 写日记弹窗与标签选择器都未注册 ESC 层（diary esc 层 close 只认识日期弹窗→抽屉→灯箱→hide）：面板开着按 ESC 整本关掉、两 mask 成孤儿浮层；经 `bz-diary-write` 直开弹窗时 ESC 完全无效。修法：两弹窗各自 escManager.register；hide() 兜底隐藏两 mask。 |
| D2' | `src/diary/ui/datetime-picker.ts:139-157` | **P2** | 滚轮点「月/年」先 `field.set`（moment 月份溢出语义：1月31日点2月→3月3日；闰2/29点非闰年→3月1日），随后钳制读到已溢出 day 恒不触发（死代码）——月末/闰日选日期漂移到下月，日记写错日期。修法：set 前记录原 day，set 后 `date(Math.min(origDay, daysInMonth()))` 再 regenerate。 |
| D3' | `src/recap/ui.ts:248-254,307` | **P2** | `rowHtml` 用 innerHTML 拼接 `item.text` 未转义——书名/片名/备忘录标题/番茄任务名用户可控，含 `<img onerror=...>` 即注入面板 DOM（与已修 belongings H8 同类 XSS 面）。修法：item.text 经 `core/ui/str` esc() 再拼。 |
| D4' | `src/checkup/checks-drift.ts:33` | **P2** | `SEGMENT_FIELDS['home.json']` 还是 v1 段 `['version','pinned']`，home/order.ts 实际写 v3 `{version,desk,mob,hiddenDesk,hiddenMob}`——每次体检 home.json **必然**报约定外段+缺段，恒假阳性，训练用户忽视黄条。修法：约定段更新为 v3 键集。 |
| D5' | `src/diary/data.ts:194-229,236-249` | P3 | 批量读取 `Promise.all(vault.read)` 无单文件容错：任一文件读失败→整墙（日记+影视+信+书）显示空。修法：per-file try/catch 跳过坏文件（与 store.listDateEntries 同口径）。 |
| D6' | `src/diary/ui.ts:1782-1800` | P3 | D13 修复留跨会话残口：关灯箱后立刻重开、新落点下标恰相同时，旧慢解密 promise 两项检查全过，把旧媒体写进新灯箱。修法：灯箱维护会话代次 generation，闭包捕获比对。 |
| D7' | `src/diary/ui.ts:630-637` | P3 | 灯箱开着期间后台 modify 防抖触发 renderWall 整表重建 `_lbSeq`（F2 只保了 lbMedia）：`_lbIdx` 不变但序列已换，←/→ 步进落错媒体。修法：灯箱可见时暂缓 `_lbSeq` 重建，或步进前按当前 entry 重新定位（与 D6' 可合并代次方案一次修）。 |
| D8' | `src/diary/ui.ts:1986-2000,2092-2095` | P3 | 移动长按抽屉被 core 层路径关闭时 diary 的 `sheetEntry` 不复位：下一次 ESC 被消费一次空操作，需按两次 ESC。修法：core openItemSheet 增加 onClose 回调，或 closeSheet 前探测 core 浮层是否已关。 |
| D9' | `src/diary/ui.ts:2119-2141,2200-2213` | P3 | 面板关闭期间保险箱被上锁：订阅已摘、事件丢失，重开面板 `lockedVisible` 仍 true——「加密」chip 显示已解锁态与真实锁态不符。修法：show()/loadAndRender 时按 `isUnlocked()` 重置。 |
| D10' | `src/diary/ui/repair-modal.ts:198-212,60-73` | P3 | startScan/runScan 无 try/catch：任一文件读抛错→unhandled rejection，进度条永远停在「正在体检…」。修法：外层 catch 提示人话错误回到可重试态。 |
| D11' | `src/recap/aggregate.ts:189-209` | P3 | 注释承诺同一本书只计一次，实现只对 summary.books 去重、items 仍每源行推一条——同 title 两源或同日读完+进度时时间轴出两条。修法：seen 命中且非 finished 跳过。 |
| D12' | `src/recap/aggregate.ts:301-309` | P3【待验证】 | 回顾按**题目（文件名）日期**圈定条目，墙按 **frontmatter date 优先**——name-mismatch 文件墙上属今天、回顾里不算。修法：改用 `e.date === dateStr`（循环里已 parseEntryFile）。 |
| D13' | `src/recap/aggregate.ts:110-114` | P3【待验证】 | `todayRange` end 用 `start+86400000`：DST 时区换日漂移一小时（国内无 DST 不触发）。修法：end 用本地「明日 0 点」。 |
| D14' | `src/diary/encrypt.ts:26-50` | P3 | `unlockedListeners/lockSafe` 等全仓无调用方；`lockSafe` 注释与事实不符（实际归位靠 encrypt:unlock-changed 订阅）。修法：删死代码或修正注释。 |

已核验无问题（摘要）：D1/D2/D4/D5 修复本体正确（读失败抛 DiaryFileReadError 中止、全路径定位、队列键无碰撞、mergeDiaryBlock 队列互斥、加密回滚接线）；写路径全收口 enqueueFileTask 无新直写混用；diary-format 往返稳定；ui 生命周期成对清理；renderText 遵守追加语义契约；recap writeRecapEntry 先插后删安全、五源独立容错、R1 加密过滤与墙一致；checkup 只读纪律严格、fixFavorites/fixClipbook 队列内 undo 幂等、memoNormalize 双视角口径对齐、SEGMENT_FIELDS 其余五项键集一致。

---

## 四、剪藏收藏流（clipbook + auto-summary + attach + favorites）— 17 条（P2×3 + P3×14）

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| CB1 | `src/clipbook/ui.ts:243-251,109-122` | **P2** | 面板 overlay 从不 `topifyZ` 发号（全站唯一漏网域，ADR-0067）：与任何已发号面板同屏时整面板被压底，「开收藏本→开剪藏本」看似命令失灵。修法：showPanel 显示时 topifyZ；`ensureSelBar` 划选工具框注释声称 allocZ 实从未发号，宜一并补。 |
| CB2 | `src/clipbook/news-data.ts:246-250` | **P2** | writeNewsData try/catch 静默吞写失败（core modifyWithBackup 特意照抛被截断）：磁盘异常时标已读弹「已读+撤销」实际两笔都没写，重载回跳——C30 修了 clipbook.json 侧，news.json 侧同病灶未修。修法：去 catch 让队列错误透传，调用方按需 notice。 |
| CB3 | `src/clipbook/flow.ts:233-247,267-275` × `news-data.ts:198` | P3 | 批量已读/撤销路径 stats 子段无缺失守卫（bumpStats 有、这两处没有）：外部写入的部分 stats 对象透传后 `s.byPlatform[platform]` TypeError，`void markAllRead()` 不 catch 无任何反馈。修法：对齐 bumpStats 补建桶守卫。 |
| CB4 | `src/clipbook/save.ts:29-32` | P3 | 剪藏目录归一口径分裂：四处读点三个剥尾斜杠、clipDirOf 不剥——设置带尾斜杠时 filePath 变 `dir//title.md`，覆盖确认预查 miss 不弹确认、create 撞已存在报失败；smartcat 拿到 clipPath 与实际不一致。修法：对齐归一或四处收敛单源。 |
| CB5 | `src/clipbook/ui.ts:304-307` | P3 | j/k/←→ 步进不排除修饰键：阅读面聚焦时 Ctrl+K / Cmd+K 被劫持成条目切换。修法：首行 `if (e.ctrlKey||e.metaKey||e.altKey) return`。 |
| CB6 | `src/clipbook/ui.ts:888-893` | P3 | bindImgFallback 不处理「挂监听前已失败」的图（`complete && naturalWidth===0`）：水合窗口内已失败的缓存 404 图永不摘除。修法：绑定时对已失败图直接 remove。 |
| CB7 | `src/clipbook/ui.ts:172-181` | P3 | closePanel 不收划选工具框（selectionchange 收框路径有 `if(!M.open) return`）：划选后关面板，浮框残留到下一次任意 mousedown。修法：closePanel 补 `hideSelBar()`。 |
| CB8 | `src/clipbook/ui.ts:226-235` | P3 | unloadPanel 漏置空 mobTitleEl/mobSaveBtnEl（清理清单不对称，微小泄漏）。 |
| CB9 | `src/clipbook/loader.ts:40-55` | P3 | missing/corrupt 分支不复位 M.stats：损坏面板假空态下 rail 脚注「今日已读 N」显示旧值自相矛盾。修法：两分支补 stats 默认对象。 |
| CB10 | `src/main.ts:352` × `news-sources-group.ts:284-324,469-517` × `save.ts:135-168` | P3 | onunload 不收 clipbook 自有三个 body 级浮层（UP 主管理、RSS 管理、覆盖确认遮罩）：禁用时残留且 ESC 已死（N1 连带）。修法：unloadClipbook 补三处 remove。 |
| CB11 | `src/clipbook/index.ts:95-105` | P3 | `clipping:file-*` 载荷缺 path 时防误扫判据短路放行，异常事件触发无谓全量重扫。修法：`if (!path && !stalePath) return` 前置。 |
| CB12 | `src/clipbook/news-fetcher.ts:726-746` | P3 | executeFetchRound try/finally 无 catch：runNewsFetchRound 抛错成 unhandled rejection，手动抓取无任何反馈。修法：catch 内 notice + 返回 null。 |
| AS1 | `src/auto-summary/parser.ts:110-125` | **P2** | buildFrontmatter 不先转义反斜杠 + parseFrontmatter 不反转义（save.ts C27 已修同根因，此处漏改双向）：AI 摘要含双引号的剪藏在任一重建写回后 frontmatter 损坏，【待验证】可能被剪藏本列表静默剔除。修法：先 `\\\\` 再转义引号；unquote 补反转义。 |
| AS2 | `src/auto-summary/parser.ts:36` | P3 | frontmatter 正则要求闭合 `---` 后必有换行：无尾换行文件 fm:null，整份 frontmatter 被当正文送 AI 并复制进正文。修法：闭合侧改 `[ \t]*\r?\n?`。 |
| AS3 | `src/auto-summary/index.ts:174-185` | P3【潜伏】 | 重注册判据 `!registerTimer && !fileListenerRef` 在 timing='lazy' 时恒真（fileListenerRef 恒 null）：未来新增 ensure 入口即双监听泄漏。当前入口不可达。修法：判据改看 openListenerRef。 |
| AT1 | `src/attach/data.ts:163-181` | P3 | planMoves 冲突集只含文件不含文件夹：目标有同名文件夹时 renameFile 抛错计失败（有 warning 不丢数据）。修法：occupied 纳入文件夹路径。 |
| FV1 | `src/favorites/ui.ts:270-273` | P3 | unloadFavoritesUI 不关 `.bz-fav-form-mask`：表单开着禁用插件→全屏遮罩残留挡住整个 Obsidian。修法：unload 补 remove + `_baseline=null`。 |
| FV2 | `src/favorites/ui.ts:574-576` | P3 | F15 单例守卫绕过脏检查：已有表单有未保存修改时再触发入口，`closeForm(existing)` 直接关、无提示丢弃草稿。修法：改 `requestCloseForm` 或 dirty 时聚焦现有表单。 |
| FV3 | `src/favorites/ai.ts:77-85` | P3 | 超时胜出后 requestUrl 迟到 rejection 无空 catch（clipbook C23 同族漏网）：控制台噪音。修法：`req.catch(()=>{})`。 |
| FV4 | `src/favorites/prototype-render.js` | P3 | 陈旧孤本 250 行（C22 同族 favorites 版）：壳已不消费 BZR 渲染产物，内容停在退役前。修法：删除。 |

已核验无问题（摘要）：F1-F15、C1-C32 修复逐条在位未引入回归；clipbook 写链路全走 enqueueFileTask 串行；会话快照（ADR-0108）只存 id 现取最新态；`.bz-clip-read-scroll` 骨架常驻节点收框监听不被重建破坏；auto-summary 写回前重读合并、FIFO 泵收场对称；attach 三级解析与撤销逆序回滚正确；favorites CRUD 队列事务、表单脏检查基线口径、ESC 层次在位。

---

（待回填：五、书影阅；六、复习专注+面板）
