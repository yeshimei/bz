# 全域隐形 bug 审查报告（bug 线，2026-09-11）

- 口径：六个只读审查代理并行扫全部功能域（排除 smartcat/secondbrain/knowledge），基准 AGENTS.md 铁律 + docs/prototype-first.md + CONTEXT.md；只报功能性 + UI 交互 bug，纯风格/体验线/旧报告已修复项不报。
- 范围：19 个域约 7.6 万行（core/main/recap/checkup/diary/encrypt/password-vault/memo/clipbook/auto-summary/attach/pomodoro/favorites/review/cinema/reading-report/bookshelf/settings-panel/home/belongings）。
- 门禁佐证：审查期间主仓 `tsc --noEmit` 0 错误、全量 vitest 通过——即下列问题全部是现有测试未覆盖的暗角。
- 严重级：P0 丢数据或数据损坏 / P1 功能错误 / P2 明显硬伤 / P3 小瑕疵。标【待验证】的共 17 条，修复前须先验证证实。
- 汇总：**102 条 = P0×2 + P1×6 + P2×22 + P3×72**。checkup 是唯一零 bug 域。

---

## 一、共享基座（core + main.ts + settings.ts）— 16 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| C1 | `src/core/ai.ts:384-436` | P2【待验证】 | 流式 AI 请求无超时：远端建连后不回包则 Promise 永不 settle，任务转圈到重启。修法：AbortController+超时（对齐 ai-models.ts / smartcat 60s 先例）。验证：本地起 accept 后不响应的 TCP 服务指向 custom provider。 |
| C2 | `src/core/ai.ts:305-371` | P3【潜伏】 | `getAIProvider('openai')` 字符串 override 的解析结果写入全局 `_aiProviderCache`，后续无参调用命中被污染缓存（当前调用方恰未触发）。修法：override 分支不写缓存或缓存键带 override。 |
| C3 | `src/core/obsidian-adapter.ts:26-29` | P3【待验证】 | 名为 `xxx.md` 的**文件夹**经 `path.endsWith('.md')` 兜底被当 md 文件派发 `vault:md-*` 语义事件（review/cinema/bookshelf/smartcat 消费）。修法：兜底排除 TFolder。 |
| C4 | `src/core/obsidian-adapter.ts:50` | P3 | md↔非md 改名用新路径判定直接 return，事件整条丢弃——引用同步/复习标记从此失联。修法：新旧任一为 .md 即派发，或补 deleted+created。 |
| C5 | `src/core/ui/select.ts:167-171`、`src/core/ui/popover.ts:34-36` | P3 | 私挂 document 级 ESC 监听，违反 esc-manager 立约（esc-manager.ts:30）；面板开着下拉时按 ESC 整面板直关。修法：走 escManager.register 或组件根 keydown（uiSuggest 是正确样板）。 |
| C6 | `src/core/item-actions.ts:200-208,147-161` | P3 | 长按后 400ms 静置窗口吞掉任意 click（含真实点击）：移动端长按弹抽屉后点下一张卡第一次无反应。修法：吞 click 校验落点/目标。 |
| C7 | `src/core/crypto.ts:31,81` | P3 | encrypt 路径每条新 salt 必 cache miss，派生密钥缓存只进不出（明文主密码长期驻留）。修法：encrypt 不缓存或 LRU。 |
| C8 | `src/core/z-order.ts:13-25` | P3 | `alwaysOnTop` Set 无反注册，离场元素永久滞留（小橘每次重挂载泄一棵 DOM 子树）。修法：补 unregister + sync 清理 `!isConnected`。 |
| C9 | `src/core/ui/lightbox.ts:113-119` | P3 | 导出的 `closeLightbox()` 不注销 esc 层（仅靠下次 open 间接清）。修法：escHandle 提模块级，close 一并 unregister。 |
| C10 | `src/core/settings-schema.ts:733-739` | P3 | list 行移除按钮 onChange 抛错后 UI 不回滚不提示（unhandled rejection）。修法：try/catch + notifySaveError + renderItems。 |
| C11 | `src/core/settings-model-picker.ts:95-97` | P3 | onPick 抛错时模型选择器卡死不关且重复报错。修法：`.finally(close)`。 |
| C12 | `src/core/ui/choice.ts:47-50,93-97` | P3【潜伏】 | float 形态 window resize 监听依赖调用方 detach（当前无域调用 uiChoice）。修法：对齐 uiSelect 或 ResizeObserver。 |
| C13 | `src/main.ts:222-236`（同型 `:317-323`） | P2【待验证】 | onLayoutReady 回调不随插件卸载摘除：启动窗口期内禁用插件，布局就绪后备忘录自动弹出/剪藏摘要/复习监听/小橘全部幽灵初始化且无卸载路径。修法：`_unloaded` 旗标短路或 registerEvent 持 ref。 |
| C14 | `src/main.ts:292-303` | P3 | onunload 硬删 `__shared_confirm_mask__` 不走 settle，在途确认框的 Promise 永久悬挂，后续操作静默终止。修法：卸载前取消结算。 |
| C15 | `src/main.ts:308-312` | P3【待验证】 | saveSettings 无串行化，连拨开关并发 saveData（历史上有 data.json 并发写损坏先例）。修法：promise 链串行。 |
| C16 | `src/settings.ts:439-446` | P3 | 键名迁移只改内存不调度落盘，旧键长期残留、每次启动重复迁移（功能无损）。修法：迁移发生时调度 saveSettings。 |

已核验无问题（摘要）：esc-manager 栈序/destroy、domain-bus 快照扇出与异常隔离、notice 去重合并与驱逐配额、storage 同路径 FIFO+损坏留档+copy-then-rebuild、flow-dialog 顶替结算、path-picker 竞态防护、settings-schema 防抖/脏旗标、ai-models 超时与人话文案、crypto 分块 Base64、dom/utils longPress/swallowNextClick/转义、core/ui 全部工厂（uiSuggest 的 ESC 为正确样板）、动态 z 契约；main.ts 命令注册对称性与 unload 全量接线。

## 二、日记家族（diary + recap + checkup）— 16 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| D1 | `src/diary/store.ts:74-76` + `:124-135` | **P0** | `syncDateFromDisk` 读失败返回 `{entries:[], exists:true}`，`withDateFile` 只看 length 忽略 exists：删除路径在空数组上跑完 → `vault.delete` 删掉整天文件；写路径 → 只有新条目的内容覆盖当天全部日记。UI 还报「未定位到条目，没有删除」。修法：读失败抛错中止队列任务（与守卫拒写同待遇）。 |
| D2 | `src/diary/data.ts:109-142` × `store.ts:63,120` | P1 | 嵌套日记目录「递归读、平面写」：子目录日期文件上墙后右键动作全报「未定位」；顶层同名时按 time+lineNumber 命中顶层条目——**删 A 文件的条目实际删到 B 文件**。修法：WallEntry 存完整路径定位，或读侧只收顶层对齐写侧。 |
| D3 | `src/diary/ui/repair-modal.ts:35-46` | P1 | 「检测日记解析」只扫顶层：子目录日记被守卫拒写后跑检测显示「全部正常」，该日期永久写不进。修法：collectDiaryFiles 改递归枚举。 |
| D4 | `src/encrypt/data.ts:1278-1360`（mergeDiaryBlock）、`src/diary/ui/repair-modal.ts:274-296`（runFix） | P2【待验证·窗口小】 | 解密还原与修复写盘绕过 diary 写层串行队列：与写层「旧快照全量重写」交错时还原块被抹掉且清单已删——条目盘上与保险箱同时消失。修法：读写包进 `enqueueFileTask(同路径)`。 |
| D5 | `src/diary/ui.ts:1860-1888` + `store.ts:257-275` | P2 | 加密「先入库后摘除」：摘除撞守卫/行号失配只弹「加密失败」不回滚——密文已入库原文未删，解锁后同条出现两次且重试越积越多。修法：先摘除后 lockNote，或失败回滚 removeNote。 |
| D6 | `src/diary/config.ts:32-37` | P2 | 影视/书库目录只在启动时快照：改 `cinemaFolderPath`/`bookshelfFolderPath` 后日记本仍读旧目录直到重启（与 config 注释「实时读」不符）。修法：改 getter 实时 resolve，或影院/书架 onChange 补调 applyDirectories。 |
| D7 | `src/diary/ui/dialogs.ts:296-299,385-422` | P2 | 写日记「保存」无防连点：大文件写盘慢时双击 → 同刻两条重复空条目，同刻唯一兜底定位失效。修法：进行中标志/按钮 disabled。 |
| D8 | `src/recap/summarize.ts:83-89` × `parser.ts:85` | P3 | AI 忽略提示词输出不带时间的 `# 标题` 行（前有空行）→ 当天尾部条目消失且此后一切写入被守卫锁死、一键修复修不了。修法：消毒把行首任意 `#{1,6}\s` 转全角。 |
| D9 | `src/diary/encrypt.ts:102,84` | P3 | noteId 取 `notes[length-1]` 耦合追加末尾实现；加密时固化当时日记目录，改目录后解密还原进旧目录。修法：lockNote 返回 id；还原目录按当前设置重算。 |
| D10 | `src/diary/ui.ts:1898` × `encrypt.ts:182-191` | P3 | 标签配置变更后解密：newTags 为空时还原块仍带 🔐——条目永久隐藏且无 noteId 可再解。修法：空时兜底 `['日记']`。 |
| D11 | `src/diary/parser.ts:117` × `ui/entry-actions.ts:17-39` | P3 | 标签配置外 emoji（如 🐲）被重生成映射值替换后，跳转锚点/双链与文件实际标题不符，能开文件定位不到标题。修法：保留原始标题 emoji 供锚点。 |
| D12 | `src/diary/parser.ts:162-184` | P3 | 影视条目无「海报」字段拼出 `![[undefined]]` 幽灵媒体格（统计多计、灯箱黑屏步进）。修法：空值跳过拼接。 |
| D13 | `src/diary/ui.ts:1762-1779` | P3 | 灯箱加密媒体异步回填只查 isConnected 不查当前项：快速连按图文错位。修法：回填比对捕获时的 index。 |
| D14 | `src/diary/thumb-cache.ts` | P3 | 章节栏 IndexedDB 小图只增不清（删改媒体后永久残留）。修法：按当日 key 集合惰性清扫。 |
| D15 | `src/diary/index.ts:30-36,51-55` | P3 | unloadDiary 不摘标签选择器/写日记弹窗两个 body 级 mask（不可见不可点，纯残留）。修法：按 id remove。 |
| R1 | `src/recap/aggregate.ts:299` vs `diary/ui.ts:464` | P3 | 加密条目过滤口径不一致（正文 🔐 vs 标签「加密」）：标题带 🔐 正文无的条目被回顾计数却在墙上隐藏，摘要对不上。修法：对齐墙口径。 |

已核验无问题（摘要）：守卫与队列本体互斥无 TOCTOU、修复引擎口径逐分支一致、ui.ts 事件委托/esc/监听成对清理、render.ts 单源契约完好、mediaSrc 降级、recap 写回「先插后删」安全、checkup 全域零 bug（只读纪律与队列修复均正确；仅 checks-consistency.ts:90 注释计数口径小出入，不计条）。

## 三、锁家族 + 备忘录（encrypt + password-vault + memo）— 23 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| E1 | `src/password-vault/ui.ts:905-937` | **P0** | askConfirm 每次调用给「确定」叠加监听器且无防重复绑定守卫：第一次取消删除 A，第二次确认删 B——**执行的是第一次的动作，删掉的是 A**（删整个平台同型）；若第一次已确认过则第二次静默无效。桌面 100% 复现。修法：绑定移到 bindDialogs 一次，onYes 存实例字段每次覆写。 |
| E2 | `src/password-vault/ui.ts:194-199,1005-1012` | P1 | 共锁不感知：别域上锁（保险库「立即上锁」/安全模式/日记域）后密码本面板明文照常可看可复制；此时收藏/删除静默无效（save 抛「未解锁」无 catch）。本域未订阅 `encrypt:unlock-changed`（diary 有订阅）。修法：订阅事件 → dataManager.lock() + renderAll 锁屏接管。 |
| E3 | `src/encrypt/ui.ts:1444-1455` | P2 | 异步解密完成后把旧日记详情盖进当前视图：点开日记马上切「密码」资产，约半秒后详情区被日记卡覆盖（导航高亮还在密码）。修法：then 回调补验当前资产/代次。 |
| E4 | `src/encrypt/data.ts:325-340` | P2 | 首设主密码写盘失败后 catch 只回内存态，不发 onUnlockChange(false)/域事件：状态栏与日记域卡在「已解锁」。修法：catch 补发双通道解锁态。 |
| E5 | `src/password-vault/render.ts:112` | P2 | 新增/编辑密码弹窗输入框无 `type="password"` 默认明文（encrypt 侧同弹窗是掩码）。修法：补 type+eye 切换。 |
| E6 | `src/password-vault/ui.ts:555-557,663-717` | P2 | 移动端详情页点眼睛/收藏无任何可见反应（renderAll 不重绘已打开的 mob.pageBody，页内容重建时才读 shownIds）。修法：eye/fav 分支按 mobPagePlatform 重建页内容。 |
| E7 | `src/memo/reminder.ts:81-93` + `index.ts:42-46` + `ui.ts:1479-1485` | P1 | 提醒 file-open 监听器永远卸载不掉：unloadMemo 先 uiUnload（置空 M.appRef）再 remindersUnload，offref 可选链短路永不执行——禁用插件后打开带提醒笔记仍自动弹面板并写 memo.json；再启用监听器叠加翻倍。修法：app/EventRef 存本模块变量，或调换卸载顺序。 |
| E8 | `src/memo/ui.ts:283-303,478-503` | P2 | 搜索词跨面板开合残留：输入框是空的，列表仍被旧关键词过滤（或空态「没有匹配」）——看起来「少了东西」。openForNote 的 notePath 残留同理。修法：openMemoPanel 重置 M.search。 |
| E9 | `src/encrypt/ui.ts:2292-2302` | P3 | Markdown 渲染 3s 超时走纯文本兜底后，迟到的 render promise 仍向同容器追加——正文叠双份。修法：超时摘容器/换容器。 |
| E10 | `src/encrypt/ui.ts:2622-2644` | P3 | cleanup 不重置 `EncryptAppController.instance`（password-vault 有）：同会话禁用再启用插件，旧 config 复活设置不生效。修法：cleanup 末尾置 null。 |
| E11 | `src/encrypt/ui.ts:688-693,626-638,1888-1891` | P3 | 安全模式一次上锁弹两条重复通知（lockNow 与 hide 各 notice 一次）。修法：通知收敛一处。 |
| E12 | `src/encrypt/data.ts:303` | P3 | 清单密文解出 JSON `null` 时对 null 赋值抛 TypeError 被 catch 当「密码错误」：输对密码也进不了重设流程。修法：`!parsed` 走 corrupt 分支。 |
| E13 | `src/encrypt/data.ts:921-927,1429-1457` | P3【待验证】 | removeNote/updateNotePayload/resolveHealth 不进 opQueue，与 lockNote 并发时内存清单快照互踩（后落盘旧快照抹掉并发新增）。修法：一并走 enqueueOp。 |
| E14 | `src/encrypt/ui.ts:2585-2606` | P3【待验证】 | 加密当前笔记：读正文到删原文之间用户继续编辑，增量只存在于被删原文（密文是旧内容）。修法：S5 删前重读比对，不一致保留并提示。 |
| E15 | `src/password-vault/ui.ts:1005-1012` | P3 | 安全模式「已自动上锁」toast 挂在被隐藏面板内部永远看不见。修法：改走全局 notice。 |
| E16 | `src/password-vault/ui.ts:560-570,766-797` | P3 | fav/删除等写操作失败无任何提示（裸 await 成 unhandled rejection）。修法：对齐 encrypt failToast+回滚重绘。 |
| E17 | `src/password-vault/render.ts:81-84` | P3 | 平台头像首字符未 esc（其他处都转义了）。修法：`esc(ch)`。 |
| E18 | `src/password-vault/ui.ts:1103-1110` | P3 | 首设主密码最短 4 位 vs encrypt 侧非空即可——同一把锁两套规则。修法：统一校验。 |
| E19 | `src/memo/ui.ts:910-955` | P3 | composer 双击双提交：清输入在 await 之后，窗口期第二次提交读到相同文本——重复条目。修法：先同步清空/禁用或 busy 标志。 |
| E20 | `src/memo/ui.ts:948-953` | P3 | composer 保存失败仍清空输入框，草稿丢失（移动端路径是「成功才清」）。修法：清空移入成功分支。 |
| E21 | `src/memo/file-sync.ts:28-39` | P3 | rename 同步按「标题===旧文件名」盲改：内容恰好同名的无关条目标题被悄悄改掉。修法：仅 notePath/linkedNote 命中才联动。 |
| E22 | `src/memo/file-sync.ts:88-90,169` | P3 | 同步监听只覆盖两个目录，notePath 可指向任意笔记：范围外笔记 rename/delete 引用不同步（「关联笔记不存在」）；移出到范围外的 rename 同样丢。修法：按 memo.json 实际被引用路径放行。 |
| E23 | `src/memo/data.ts:88-103` | P3 | memo.json 合法 JSON 但非数组时 loadItems 抛 TypeError 被吞——面板静默空白无报错。修法：Array.isArray 校验走损坏留档重建。 |

已核验无问题（摘要）：`.safe.enc` 三段原子写与三崩溃点恢复、提交式加密 S1-S5 自愈不变量、restore 两阶段回滚、mergeDiaryBlock 同分钟逐行比对、密码错误冷却、mapLimit 归位、双面板经域事件互相同步、锁屏首设/损坏重设机制同源；memo 队列串行与自写短路、删除撤销原索引插回、场景批量迁移、rename 链去抖保序。

## 四、剪藏流家族（clipbook + auto-summary + attach + pomodoro + favorites）— 15 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| F1 | `src/clipbook/loader.ts:63-87` × `news-data.ts:243-297` | P1 | 保留策略清理永不生效：loader 剔除的超期条目不在声明列表也不在 removeKeys，合并写按磁盘并集复活——news.json 只增不减、`retentionChanged` 恒真反复空写（briefs 同病）。修法：被清理 key 收集进 removeArticleKeys/removeBriefKeys。 |
| F2 | `src/clipbook/ui.ts:838-843` × `flow.ts:180-191` | P2 | 每日简报的「删除」是假动作：拿 articles 段的 key 去 briefs 段条目上找永远找不到，确认框+「已删除」toast+撤销钮全套走完，条目纹丝不动。修法：origin==='brief' 分流到 deleteBrief/writeBriefState。 |
| F3 | `src/clipbook/ui.ts:1069-1075` × `flow.ts:79-96` | P2 | 对已读条目再点「标记为已读」重复计统计+重复发 news:read（smartcat 三跳重复喂）；对「已收」条目点已读把 `state:'saved'` 覆盖成 `'skipped'`——剪藏笔记日后删除时该条从已收掉进已读，统计虚增。修法：doMarkRead 加 `st!=='unread'` 守卫；markHandledAndBump 对 read===true 跳过计数。 |
| F4 | `src/clipbook/ui.ts:683-711` | P2 | 简报/剪藏本源下搜索：目录高亮与 M.cur 悄悄切到第一条命中但右栏仍显示旧文章——高亮 A 读 B，j/k 从幻觉位置步进。修法：重选 M.cur 后补 renderReader，或对齐 news 分支不重选。 |
| F5 | `src/clipbook/flow.ts:79-96` | P3 | markHandledAndBump 未命中条目（守护刚清掉）也加统计——统计虚胖。修法：仿 flowUndoHandled 加 touched 标志。 |
| F6 | `src/clipbook/news-data.ts:67-93` | P3 | normalizeBrief 白名单是简报段「字段绞肉机」：插件任何一次整段回写都把守护进程的非白名单字段永久剥掉（issue 263 transcriptPath 事故同类结构风险）；subtitleRejected 被 String() 强转。修法：非白名单透传。 |
| F7 | `src/clipbook/ui.ts:907-922` | P3【待验证】 | 移动端「重新抓取本期」：fs 取不到→缓存空串→走 deleteBrief 分支删条目并提示「已排入下一轮」（碰巧收敛但用户若只想重跑 AI 则条目被删）。修法：移动端禁用就地重跑或明示需桌面。 |
| F8 | `src/clipbook/news-data.ts:244-245` | P3【待验证】 | news.json 损坏时合并写以空库为基底落盘——「不清盘保原文件」恢复现场被销毁（deleteBrief 路径可把 articles 写空）。修法：res.ok===false 直接 return 不落盘。 |
| F9 | `src/auto-summary/processor.ts:186-193` | P3 | 失败通知的「重试」绕过队列去重：双击并发跑两次 AI、双倍花费。修法：改走 regenerateSummary 复用去重。 |
| F10 | `src/attach/data.ts:25,49-71` | P3 | `[图](path "标题")` 带标题与 `[图](<path with spaces>)` 尖括号两种 md 链接形态收集不到附件（清单偏小）。修法：剥尾标题、支持尖括号形态。 |
| F11 | `src/pomodoro/ui.ts:310-332` × `state.ts:195-202` | P2 | 「重置/停止专注」从不落盘（reset 恒返回 none 事件不触发 save）：重启后旧计时原地复活并弹「番茄钟继续」。修法：reset 分支补 save。 |
| F12 | `src/pomodoro/ui.ts:42,347-389` | P3【待验证】 | autoPauseMain 冻结标记可经其它解冻路径残留，之后手动暂停会被 resumeOnVisible 静默续跑（触发面窄）。修法：paused 被清除即清标记。 |
| F13 | `src/pomodoro/data.ts` + `ui.ts:315` | P3 | 历史无限增长：history 永不裁剪，pomodoro.json 线性膨胀（统计只用近 7 天）。修法：按保留窗裁剪。 |
| F14 | `src/favorites/ui.ts:434-443` | P3【待验证】 | 移动端「打开」两层兜底都落空时无任何提示（无 electron 也无 require）。修法：补 window.open + 全失败 notice。 |
| F15 | `src/favorites/ui.ts:501-560` | P3 | 表单无单例守卫可叠加多层，ESC 一次只关一层，遮罩层叠。修法：openForm 先移除已存在表单。 |

已核验无问题（摘要）：news.json 写全走队列+段级合并且守护并发追加不丢、flowSave 仅成功才标已读、撤销链快照恢复逐桶回退、favicon 回退链各环 catch、auto-summary 队列去重+写回前重读合并、attach 冲突递增与撤销逆序、pomodoro 状态机/冻结持久化/统计口径、favorites 表单脏检查/置顶回滚/ESC 栈。

## 五、书影阅家族（review + cinema + reading-report + bookshelf）— 12 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| G1 | `src/review/app.ts:176-187` × `queue.ts:75-82` | P1 | 「开始本轮」纳入的今日到期但时刻未到条目（提示「已提前纳入本轮」），评级被 markReview 时间门禁拒收：普通模式评级条点了没反应轮询卡死到中断；做题模式显示「通过·下次 1 天后」实际不写排期，且正确答案已从题库删除——下次开轮该篇还在。修法：门禁放行条件对齐 roundQueue（`!isEarlyDue && !isDueToday` 才拒）；onPassed 检测是否真正写盘。 |
| G2 | `src/review/sprint.ts:505-514` × `:216-253` | P2 | 冲刺键盘答题：焦点在选项上按 Enter，选项 activate 与 document handleKey 先后命中——答错反馈/解析/下一题全被跳过，最后一题直接结算。修法：handleKey 对 `.bz-sprint-opt` target 直接 return（quiz-core session.ts:283 已排除 BUTTON，此处漏）。 |
| G3 | `src/review/quiz-core/manager.ts:79-114` | P3【待验证】 | quiz.json 全部读写无锁（review.json 已收编队列，quiz 漏收）：AI 批量生成期间的长快照写回可覆盖并发删题（答对的题复活）。修法：RMW 包进 enqueueFileTask。 |
| G4 | `src/review/render.ts:106-114` vs `ui.ts:52` | P3 | 三区列排序用 DEFAULT_W 硬编码，展示 R 用拟合权重——R 值与顺序对不上。修法：sortColumn 透传 ctx.w。 |
| G5 | `src/review/quiz-core/generator.ts:115-126` | P3【待验证】 | 批量出题提示词键名示例（noteId1）与规则（真实路径）矛盾：AI 按示例返回则题库写垃圾键、真实路径无题、「已为 N 篇生成」假成功、垃圾键永久残留。修法：示例用真实路径占位+返回键归一。 |
| G6 | `src/cinema/index.ts:34-35` | P2 | 会话内改「影视文件夹」设置不生效：M.folderPath 仅首次初始化缓存，面板/新建仍走旧目录，而日记本（实时读）已是新目录——两域对不上直到重载。修法：每次打开刷新或直读 resolveCinemaFolderPath（bookshelf 同法）。 |
| G7 | `src/cinema/ui.ts:74-98` | P3 | 快速标记状态先改内存再落盘，失败不回滚（saveEdit 有回滚此处没有）——面板显示与磁盘相反。修法：记 prev 快照回滚。 |
| G8 | `src/cinema/ui.ts:399-415` × `douban-queue.ts:252-263` | P3 | 删除正在抓取的影片不动队列：十几秒后弹「以下影片获取失败：《已删的片》」且文案「重启后会自动重试」不实。修法：删除成功时 dequeueDoubanFetch(path)。 |
| G9 | `src/cinema/analysis.ts:297` | P3 | 想看清单读 `it.douban`（不存在，实为 doubanRating）——豆瓣评分永不显示。修法：改字段名。 |
| G10 | `src/reading-report/report.ts:495-519` × `index.ts:235-249` | P2 | 热力图按钮 disabled 按初始游标一次性渲染，navHeatmap 不更新：点一次 ‹ 后 › 永久失效回不去。修法：navHeatmap 末尾同步两按钮 disabled。 |
| G11 | `src/bookshelf/notes-ui.ts:189-217` | P3【待验证】 | EPUB 读书笔记弹窗无在途序号守卫（md 版有 bookNotesLoadSeq）：连开两本后对 A 残留块编辑，onChanged 重开 A 的弹窗盖在 B 上。修法：补 epubNotesLoadSeq。 |
| G12 | `src/bookshelf/notes.ts:198-211` | P3 | md 批注编辑：预检命中后 vault.process 重放未命中仍报「批注已更新」并关弹窗（并发改动高亮原文时编辑丢失假成功）。修法：重放 replaced 带出未命中走失败路径。 |

已核验无问题（摘要）：douban-queue 防重入/超时 kill/移动端静默禁用、面板生命周期与 ESC 层级、cinema 纯层转义；review.json 队列串行、reviewLoop 防重入、SprintSession 幂等、FSRS 阶梯语义；reading-report 分片渲染 isConnected 作废、除零守卫；bookshelf rebuildSeq、weave-data 队列与双重拦截、md 划线原子写。

## 六、面板/入口/归物（settings-panel + home + belongings）— 20 条

| # | 位置 | 级 | 问题与修法 |
|---|---|---|---|
| H1 | `src/settings-panel/renderer.ts:444-477,294-376` | P2 | 面板自绘渲染器不消费行级 `onCommit`（core 渲染器有 CommitWarn）：改「数据存储路径」「保险库根目录」等不弹「重载生效」警告；改备忘录「自定义场景列表」**完全不生效**且无提示（memoReloadScenes 是功能钩子）。修法：四分支比照 core 补 CommitWarn。 |
| H2 | `src/settings-panel/renderer.ts:261` | P2 | isChild「跟随父开关显隐」联动缺失：面板里关掉「生成压缩预览」后三个子设置项恒显示（⚙️ 原生页会隐藏）——同一数据两个入口行为不一致（全仓仅 encrypt 三行无自带 visibleWhen）。修法：面板补 visibleWhen 合成或三行显式补。 |
| H3 | `src/settings-panel/ui.ts:249-260` | P2 | 面板已打开时桌面端「在设置中编辑」深链失效：只改 activeDomainId 不重绘导航不 renderDomain。修法：桌面 deep 分支补重绘+renderDomain。 |
| H4 | `src/settings-panel/renderer.ts:385-417` | P3 | 从 A 下拉直接点开同组 B 下拉：A 的 closeMenu 冒泡末段还原组卡 overflow，把 B 刚设的 visible 抹掉——B 菜单被裁剪。修法：还原前查本组是否还有打开的菜单。 |
| H5 | `src/settings-panel/renderer.ts:283-291`（select/choiceCards 同型） | P3 | 先翻 UI 再写值：onChange 抛错后开关已显示新值但依赖行显隐/徽标不刷新且无提示。修法：try/catch+回滚或先写后翻。 |
| H6 | `src/settings-panel/renderer.ts:636-653` | P3 | refresh 循环中 visibleWhen 抛错中断整轮显隐/徽标/refreshKey（ui.ts:199 同函数有保护这里没有）。修法：同口径 try/catch。 |
| H7 | `src/settings-panel/dir-picker.ts:205-210` | P3 | 目录扫描失败无 .catch：选择器永远停在「正在读取目录…」。修法：catch 出失败态/重试。 |
| H8 | `src/settings-panel/ui.ts:529` | P3 | 移动端搜索空态把未转义 query 拼进 innerHTML（自注入 XSS 面）。修法：esc(query)。 |
| H9 | `src/settings-panel/ui.ts:371,450,280` | P3 | 徽标两处口径不一致（0 项域 `—` vs `·`）且 preload 只在首次 build 跑：会话内改设置后其他域徽标保持首开快照。修法：统一口径+open 时重跑。 |
| H10 | `src/settings-panel/renderer.ts:526-529` | P3【待验证·当前无实例】 | choiceCards 布局值与主题 options 全不匹配时主题行渲染成空白卡组（现网各域 layout 值均匹配不触发）。修法：空时回退全量 options。 |
| H11 | `src/home/shared.ts:428` | P2 | 今天已写日记时预告卡连击 `diaryStreak + 1` 恒多算 1（diaryStreak 已含今天；同文件未写分支与 buildNotes 口径正确）。修法：去掉 +1。 |
| H12 | `src/home/ui.ts:71-82,207-218` × `river.ts:185-229` | P3【待验证】 | collectRiver 聚合层异常被吞成 null：首页永久加载骨架无提示无重试（子采集各自容错，仅聚合层自身异常可致）。修法：null 出失败空态+重试。 |
| H13 | `src/home/entry-editor.ts:62` | P3 | 入口顺序落盘失败 `.catch(() => undefined)` 静默：用户以为排序已存，重开回弹。修法：失败 notice。 |
| H14 | `src/belongings/ui.ts:683-688` | P3 | 表单已开时对另一物品点「编辑」静默聚焦旧表单：B 的编辑窗没开，内容可能填进 A。修法：notice 或按目标重开。 |
| H15 | `src/belongings/ui.ts:524-541,620-631` | P3 | 撤销回调体内 loadDatabase/saveAndRender 无 catch：撤销写失败时界面无反馈，用户以为已撤销。修法：try/catch+notifySaveError。 |
| H16 | `src/belongings/ui.ts:816-823,851-853` | P3 | 出离日期允许早于购买日期（倒挂无校验）：统计不炸但「陪伴 — 天」、日均分母被压口径失真。修法：保存前校验倒挂 fail。 |
| H17 | `src/belongings/ui.ts:336-349,384-403` | P3 | closePanel 不断开主题 MutationObserver：面板关闭期间 body class 变动仍空转回调（有界泄漏）。修法：closePanel disconnect。 |
| H18 | `src/belongings/ui.ts:862-863` | P3 | 新物品 id=`'item_'+Date.now()`：同毫秒两条互相覆盖（手动难触发，批量导入暴露）。修法：拼随机后缀。 |
| H19 | `src/belongings/data.ts:39-49` | P3【待验证】 | items 为真值非对象（如字符串）时校验拦不住，Object.values 派生垃圾分类。修法：typeof/Array.isArray 校验重置。 |
| H20 | `src/belongings/ai.ts:66-70` | P3 | AI 归类「全有或全无」：分类合格但图标非法时整条弃用报「无法解析」。修法：保留分类、图标回退。 |

已核验无问题（摘要）：域 loader 失败不拖垮整页、renderSeq 竞态令牌、徽标计数口径与 ⚙️ 一致、dir-picker settled 防重关；home 全部命令 id 无悬空、一域数据炸不拖垮首页、order v2→v3 继承、拖拽监听成对；belongings icon 迁移幂等、并发写队列、出离字段还原快照、ESC 层序、图标白名单校验；三域 markup 单源转义（唯一注入点 H8）。

---

## 修复优先级建议

1. **立即修**（丢数据/删错东西）：D1（读失败清空整天日记）、E1（确认框删错条目）——都是几行级守卫修复。
2. **紧随**（P1 六条）：D2/D3（日记子目录口径统一）、E2（密码本共锁订阅）、E7（memo 监听卸载）、F1（保留清理 removeKeys）、G1（复习评级门禁对齐）。
3. **P2 22 条**按域分批；标【待验证】的 17 条先验证证实再修。
4. P3 72 条按「静默吞错 / 内存只涨不减 / 边界容错 / 交互细节」主题打包批量处理。

---

## 修复批追记（2026-09-12 无人值守闭环，issue 289）

凌晨 2:00 定时任务触发「审查→修复→review→部署」无人值守闭环，本报告 102 条已全部处置完毕。

### 处置总账

| 域组 | 条目 | 结果 |
|---|---|---|
| 共享基座 C1-C16 | 16 | 全部已修（C1/C3/C13/C15 待验证均证实；C7 派生密钥改 LRU 有界缓存 128 条） |
| 日记家族 D1-D15、R1 | 15 | 全部已修（D1 P0 读失败中止队列；D2 P1 写层存完整路径定位、按路径分键） |
| 锁家族 E1-E23 + D4 | 24 | 全部已修（E1 P0 确认框删错条目；D4 两半队列闭环） |
| 剪藏流 F1-F15 | 15 | 已修 12；F2/F6/F7 已失效（每日简报已整体退役） |
| 书影阅 G1-G12 | 12 | 已修 11；G11 证伪（vitest 实证链路不可达，验证用例留作行为锚） |
| 面板/入口/归物 H1-H20 | 20 | 全部已修（H8 XSS 转义；H10/H12/H19 待验证均证实） |
| 跟进批（补扫新 bug + D4 diary 半边） | 5 | 全部已修（cinema AI 荐片重入 P2、随机抽一部 P3、home blur 泄漏 P3、touch-action 抢占 P3 证实后重写仲裁） |

合计：**处置 107 条 = 已修 103 + 已失效 3 + 证伪 1**；逐条明细见 `review-fix-{core,diary,lock,clip,media,panel,followup}.md`。

### review 与门禁

- 双只读审查代理过全量 diff（142 文件，src 71 个）+ 主线程自审：CSS 零改动、通知正文零 emoji、零新增命令 ID、各组未越授权域。
- 审查发现本批引入回归 1 项：F3 守卫误伤「已读未收 → 补收进剪藏本」升级路径（flow.ts read===true 无差别拦截）——已收编修复（守卫收窄 + 升级不重复计已读 + 2 例回归）。
- 门禁：tsc 0 错误；286 文件 4432 测试全绿（基线 4280 + 新增回归 152 例）。主仓库 build 部署完成。

### review P3 建议（不阻塞，随下批收编）

1. `src/recap/aggregate.ts:302` R1 过滤字面量『加密』改引 `ENCRYPT_TAG` 单源。
2. `src/diary/data.ts:246` 注释提及已退役常量，文档漂移。
3. `src/diary/ui/repair-modal.ts` runFix 队列内按实际替换行数计数（现按扫描数可能多报）。
4. `src/clipbook/loader.ts:64-73`【待确认】守护进程合并写窗口内重推同 URL 的误剔风险（毫秒级窗口，与既有 removeArticle 同风险类）。
5. `src/review/quiz-core/session.ts` 清理类 RMW 的 fn 可跟踪真删才写，免空写 quiz.json。
6. `src/belongings/ui.ts:899` 随机 id 后缀理论可空串，求稳 padEnd。

另：跟进批 E（入口编辑器触屏滚动仲裁重写）建议真机抽查拖拽手感（jsdom 无法覆盖浏览器手势裁决）。
