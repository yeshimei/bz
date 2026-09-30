# 脸谱（people）域审查报告 — bug 线

- 范围：`src/people/` 全域（~16.9k 行）
- 基准：AGENTS.md 铁律 + CONTEXT.md + docs/ui-*-manual 手册 + core 层约定
- 日期：2026-09-29　方式：3 个只读子代理分组扫描
- 旧报告：无（首次全量）

## 分组

- A 数据与保库：data / datasource / safe-store / sync / parse / types / migrate / incremental / export / media / heavy-gate / settings / index（~3.8k 行）
- B 渲染与样式：ui.ts / render.ts / styles.css（~8.2k 行）
- C 录音线与任务：jobs / recording / digest / prep / describe / insights / stats（~5.0k 行）

## A 数据与保库

### 发现

- **P1** `src/people/migrate.ts:51-60`（配合 `:203-213` 清理段）— readLegacyJson 把「读失败/解析失败」吞成 null，与「文件不存在」不可区分，随后该文件会在校验通过后被**删除**
  - 影响：preview.json 被云盘/杀软短暂锁住（EBUSY）或读写出错时，`contacts` 记为空 → 聊天仓不迁；talkers 仍可由 people.json/jobs 提供 → 校验（只校验已迁 talker）通过 → `adapter.remove` 把**未迁移的旧明文删除**，聊天记录永久丢失。违反本文件自述的「宁留明文不冒丢数据险」。
  - 修法：readLegacyJson 区分三态——不存在（null）/ 存在但读失败（哨兵值，如 `READ_FAILED`）。迁移入口遇到任一「存在但读失败」立即中止（keptBack 填全部三件并返回/抛错），绝不进入第 4 步清理。

- **P2** `src/people/safe-store.ts:344-345`（订阅在 `:142-145`）— 普通写路径（`updateNotePayload`）不设 `suppressClear`，每次写都同步广播 `encrypt:changed`（encrypt/data.ts:1724）把自己的明文缓存**全清**
  - 影响：492 修复（commit edbf200f）只盖了 `!existing` 与 `avatarChanged` 两个分支；改名/随手记/档案/任务 checkpoint（JobStore.write 经 `safe.write`）等所有常规写都会把**全部联系人**的记录缓存与 `avatarUrls` 清光——issue 483 的全库热读每次写后被打破（导入后重渲染必出冷读骨架）、墙像全部重新解密（多联系人时明显卡顿），并重新引入 492 同类的「其他联系人旧引用 vs 新解密对象」脱钩隐患。
  - 修法：`writeSerial` 普通路径同样用 `this.suppressClear++ / finally --` 包住 `updateNotePayload` 调用（与另两分支同口径；它也是自写广播）；或订阅回调按 `evt.noteId` 只作废对应 talker。

- **P2** `src/people/safe-store.ts:375-381` — `removeContact` 不入 per-talker 串行链（链只在 `write()` `:284-288` 排队），与在途写竞态可把已删联系人**以空骨架复活**
  - 影响：删除/合并时若该 talker 的写已排队未执行（如引擎批次 checkpoint `jobs.ts:1341`、prep 并仓 `:1187`），时序为：removeContact 删清单条目 → 队列里的写出队 → `noteOf` 为 null → 走 `!existing` 分支新建骨架记录并落盘——人复活成「空仓无卡」的壳（`gone(job)` 检查在写之后，来不及拦）；`mergeInto` 的 fromId 同理可复活成重复空人。
  - 修法：removeContact 改为经同一链排队（`prev.catch(...).then(实际删除)` 后 `this.chains.set(talker, run)`），使「删」与「写」严格串行；删后再出队的写会因 `noteOf` 为 null 走重建，但此时删除语义已由链序保证在其后无 pending 写。

- **P2** `src/people/migrate.ts:193-194` — 头像校验与「头像读不动不阻断迁移」自相矛盾：旧头像文件缺失/读不动 → 永远 verifyFail
  - 影响：`readAvatarInput`（`:86-117`）设计为读不到返回 null、记录不带头像「不阻断迁移」；但校验用 `Boolean(contacts[talker]?.avatar)`（旧**元数据**有路径）要求 `attachmentCount>0`——头像源文件已被清掉的用户，每次打开面板 verify 必败 → 旧明文三件（含明文联系人名单，正是 ADR-0194 要消除的隐私面）**永不清理且无任何提示**（`migrated===0` 时 ui 不弹通知）。
  - 修法：迁移循环里记录 `resolveLegacyAvatar` 的实际结果（Map<talker, boolean>），校验只对「真读到了头像字节」的 talker 要求 `attachmentCount>0`；`expectedAvatar = 有路径 && 读文件成功`。

- **P2** `src/people/safe-store.ts:329-343` — 头像重建 `removeNote` → `lockNoteFresh` 非原子：两句之间崩溃/失败 = 整条联系人记录丢失
  - 影响：`removeNote` 自带提交点（saveManifest）；此后 `lockNoteFresh` 若抛错（盘满、加密异常、此窗口内上锁触发 requireUnlocked），记录已从清单删除且新记录未落——该联系人全部数据（人物卡+聊天仓+任务）消失，缓存里还是改后对象，下次读 `noteOf` 为 null 返回 null，人从墙上蒸发。窗口含整条记录的重加密耗时（聊天仓可达 MB 级），非微秒级。
  - 修法：重建前先留回滚料——序列化旧记录体（mutate 前的 JSON）+ `decryptAttachmentOriginal` 旧头像字节；`lockNoteFresh` 失败时用旧载荷+旧头像回锁同路径兜底，失败再上抛。至少要把 `lockNoteFresh` 失败从「静默丢人」变成可恢复路径。

- **P3** `src/people/safe-store.ts:306`（配合 `:344-348`）— mutate 先就地改缓存对象、后落盘，落盘失败不逐出缓存 → 「界面已保存、盘上没存」
  - 影响：`updateNotePayload`/`lockNoteFresh` 抛错（磁盘错误、条目被并发删等，非上锁——上锁事件会清缓存自愈）时，缓存里留着改后数据，后续 `read` 全部命中脏缓存；用户看到改名/画像已生效，上锁或重启后悄悄回退。
  - 修法：持久化段包 try/catch，失败时 `this.cache.delete(talker)`（必要时连同 avatarUrls）再 rethrow，逼下次读现解盘上真数据。

- **P3** `src/people/safe-store.ts:211-217`（消费在 `:234-244` readAll）— 单条坏记录（解密失败/JSON 损坏）使 `readAll` 整体抛错，UI 兜底成**空表** → 一人坏、全墙空
  - 影响：`normalizeRecord` 自称「坏数据不炸面板」，但解密失败/解析失败在其之前就 throw；ui.ts `records()` 的 catch 落 `recordCache = new Map()` 且缓存 → 面板渲染成空墙并持续到关面板，用户观感等同「数据全丢」。
  - 修法：`readAll` 对单 talker 的 read 失败改为跳过（或放入结果旁的 failed 列表回调），不让单点炸全量；UI 侧至少提示「N 条记录损坏」而非空墙。

- **P3** `src/people/sync.ts:157-159`（export.ts:37 同用）— `quotePathArg` 仅 win32 加引号，POSIX 下含空格的数据根/联系人名被 shell 拆散
  - 影响：`shell:true` 下 macOS/Linux 的 `--data-root "/Users/x/My Backup/..."` 或 `--contact "张 三"`（目录名可含空格）会拆成多个参数，同步/按需导出直接打错对象；注释只写了「非 Windows 原样」属有意为之但口径错误。
  - 修法：非 win32 用单引号包裹并转义内嵌单引号（`'` → `'\''`），与 win32 双引号口径对齐。

- **P3** `src/people/datasource.ts:188-196`（配合 `:584-588` mergeStore）— 无 sid 消息的替代键 = `ct|msg` 哈希，同秒同文本的重复消息共用一键被 upsert 折叠成一条
  - 影响：同秒内发出两条完全相同的文本/表情（连发、粘贴重复）且源数据缺 sid 时，仓内只留 1 条，计数与素材少 1。跨导入折叠本是 upsert 幂等的正确行为，仅同批内重复受影响，量级极小；且键内掺序号会破坏增量导入的键稳定性（副作用更大），故仅记瑕疵。
  - 修法：优先在 prep 工具侧把 sid 列为必填（契约收口）；插件侧如要修，可在 `normalizeChatJson` 内对同键条目按批内序号派生子键，并保证全量导入（485 export 均为全量 chat.json）幂等——增量区间导入需同时按 ts 区间重算子键。

### 待验证

- chat.json 若出现**字符串型** `type`（如 `"1"`），`normalizeChatJson` 的 `switch (raw.type)`（datasource.ts:440）全落 default → 派生 text 全空串，时间线静默清零（原始字段仍入仓）。预处理线契约写数字，静态无法证实是否存在字符串变体。复现：手工把某联系人 chat.json 的 type 改成 `"1"`，导入后看该人时间线是否为空、消息条数是否只剩 text 空条目。
- 「头像重建窗口丢记录」（P2 第 5 条）的实际触发面需故障注入证实：在 `removeNote` 与 `lockNoteFresh` 之间注入进程退出/盘满/上锁，确认该联系人是否从清单消失且无法自愈。

### 已核验无问题

- **命令注册与 ID**：仅 `bz-people-open` / `bz-people-import`（main.ts:133-134 COMMANDS 表，ADR-0004 裸注册），三段式合规；域内无 addCommand。
- **通知文案**：域内（sync.ts emitNotice 及 ui 各处）正文无 emoji，类型 info/success/warning/error/delete 均在 `core/notice.ts` ICONS 表内，无新造语义。
- **依赖方向（ADR-0002）**：范围内文件 import 全部合规——safe-store 取 encrypt 实例走函数级动态 import（`:410`），heavy-gate 零依赖，跨模块 PersonJob/StoreContact 均为 type-only。
- **样式铁律**：范围内文件无 DOM/样式操作，无运行时 `<style>` 注入、无内联视觉样式、无 scrollbar 自造。
- **heavy-gate**：acquire/release 同身份配对、重入计数（depth 归零才空闲）、抢占回调 try/catch 隔离、订阅返回退订函数，`waitHeavyGate` 的 keepWaiting 先于获取判定；jobs/prep/recording 三处持有释放路径配对完整。
- **sync/export 状态机**：运行中重复 startSync 幂等忽略；终态分流 stopped 优先、`[bz-result]` 为权威、字段缺失回落实时累计；ENOENT/EACCES/ModuleNotFoundError 分类与安装指引齐全；无定时器泄漏。
- **parse.ts**：RFC4180 状态机（引号/转义/CRLF/BOM）、talker 分桶与回落、三来源形态归一、时间戳秒/毫秒/字符串归一均正确。
- **media.ts**：媒体标签解析、时长/情感拆分、录音「N分NN秒」双向换算正确。
- **incremental.ts**：整份指纹 skip 判定、同秒容差、older 补录不静默丢、`mergeWithOld` 六类素材去重与 kind 回填、`revisedFrom` 留档条件、编年史失败不阻断双卷，均正确。
- **datasource.ts 主体**：449 语义分流、群聊前缀、图片最近邻 ±12h 与一张描述只配一条的防串、录音轮次断段规则（与 `recordingTurnSegments` 判据逐字一致）、`applyVoiceToMsgs` 的 wav 双键 + 文件名量化 sid 兜底（issue 515）、录音并仓同前缀清旧重灌的幂等，均正确。
- **写读对称**：聊天仓全部变更点都在变更后重算 `store.stats` 并刷 `updatedAt`，无漂移点。
- **migrate 幂等与收敛**：幂等键 `safe.has(talker)`、逐人写自带提交点、半途崩溃重跑跳过已迁、清理前逐件确认存在、单件删除失败如实计入 keptBack，均符合文件头自述（除上列两处）。
- **JobStore 对账写**：队列内有的写 job 段、记录有而队列无的摘除、未变零重写、未解锁抛错由 persist 告警不阻断，逻辑自洽。

## B 渲染与样式

### 发现

- **P1** `src/people/ui.ts:460-501`（对照 `src/people/render.ts:2314-2319`）— 「找一找」输入框没有任何 `input`/`change` 接线，打字永远不过滤
  - 影响：占位符承诺「输一个字就能把人捞出来」，但 `findQuery` 只在点标签签/清空时更新（ui.ts:1808-1810）；输入内容不触发任何重画，且期间任意重画（引擎快照翻转等）会把输入框按旧 `findQuery` 重建成空——打字白打。搜索功能对键盘输入完全失效。
  - 修法：`buildPanelShell` 里补 `overlay.addEventListener('input', …)`，target 命中 `[data-people-find]` 时 `findQuery = (target as HTMLInputElement).value` 后 `void renderAlbum().then(focusFind)`（可加 ~150ms debounce，与 clear/tag 同路）。

- **P1** `src/people/ui.ts:1950-1955` — 录音候选下拉 `<select>` 只挂 click 委托且无条件整页重画，主平台上下拉点开即被重建打断
  - 影响：`data-people-supp-rec-cand` 是 `<select>`（render.ts:2071-2082），处理在 click 委托里。Chromium（Obsidian = Electron）中点开下拉的那次 click 会带**旧值**命中分支 → `void renderAlbum()` 重建 DOM → 刚弹出的原生下拉随节点替换被关掉；而真正选完触发的 `change` 无人接（overlay change 监听 ui.ts:460-483 只认 HTMLInputElement 且无此钩子，`harvestRecQueueInputs` 也只收 `rec-ts` 输入）。候选选择既打不开也不落模，起点只能手填。
  - 修法：删 click 分支，把该 select 挪进 overlay 的 `change` 监听（新增 `data-people-supp-rec-cand` 分支），change 里只更新 `it.startMs` 并原位刷新，不整页重画。

- **P1** `src/people/ui.ts:1950-1953`（配合 `src/people/ui.ts:2254-2262`）— 「移出队列」先 splice 后重画，harvest 索引错位，其后所有录音的起点被前一条的值覆盖
  - 影响：队列行用数组下标当标识（`data-people-supp-rec-ts="i"`）。recDrop 先 `suppRecQueue.splice(i,1)` 再 `renderAlbum()`，而 renderAlbum 开头的 `harvestRecQueueInputs()` 拿**旧 DOM 的下标**写**新数组**：删第 k 条后，旧第 k+1..n 条的 `startMs` 被旧第 k..n-1 条的值逐位覆盖。例：A(3/1)、B(3/2)、C(3/3) 删 B → C 的起点静默变成 3/2。用户不细看就「落盘并导入」，错误起点写进 meta 并在并仓时错排整条转写绝对时间。
  - 修法：recDrop 分支在 splice **之前**先 `harvestRecQueueInputs()`；根治是给 `SuppRecQueueItem` 发稳定 id、DOM 钩子用 id 不用下标（图片队列 `img-drop`/`img-peer` 可一并加固）。

- **P1** `src/people/ui.ts:1598-1615`、`347-368`、`573`、`1756` — 画谱确认页开着时点面板外遮罩（或右下「找一找/数据源」小签）换页，`genConfirmOpen`/`pendingGenAnswer` 永不结清，本会话画脸谱从此恒被取消
  - 影响：`askGenerationConfirm` 置 `genConfirmOpen=true` 并挂起 `pendingGenAnswer`。正常出口只有页上两钮与 ESC（closeDialog→answerGenConfirm）；但 ① `e.target === overlay` 的遮罩点击直走 `closePeoplePanel()`，第 573 行直接 `dialog = null` 不结清；② `openDialog()`（ui.ts:347）被小签换页时直接覆盖 `dialog`。两条路之后 `genConfirmOpen` 永远为 true → `askGenerationConfirm` 恒返回 `'cancel'`，之后每次「画脸谱」都静默「已取消，本次不生成」，且挂起的 Promise 与 `pendingGenInfo` 泄漏到会话结束。
  - 修法：`closePeoplePanel()` 与 `openDialog()` 开头加 `if (genConfirmOpen) answerGenConfirm('cancel');`（先结清再动 `dialog`）。

- **P2** `src/people/ui.ts:594-611` — 未解锁时 `bz-people-import`（openDataSource）只开面板、数据源页静默不出现
  - 影响：`openDataSource` 在 `openPeoplePanel()`（内部走解锁门禁，异步）后立刻 `void openDsIfIdle()`；`openDsIfIdle` 里 `ensureJobsBoot` 因 `!safe.unlocked` 提前返回，随后 `if (!overlay) return`（面板还在等用户输密码）直接放弃——解锁完成后面板摊开，但数据源页不会来，也无任何提示，命令意图落空。已解锁时靠微任务顺序碰巧可用。
  - 修法：把「开数据源」意图传进门禁完成之后：如 `openPeoplePanel(openAfter?: 'ds')` 在门禁通过、`buildPanelShell` 后调 `openDsIfIdle()`，或 `openDataSource` 改为 `await` 门禁（复用 `peopleUnlockGate`）成功后再 `openDsIfIdle()`。

- **P2** `src/people/render.ts:663`（对照 `src/people/styles.css:507-508`、`1556-1557`）— 印章状态类名与 CSS 脱节：渲染输出 `halted/queued/drawn/legacy`，CSS 只写了 `hold/wait`
  - 影响：`bz-people-seal-${seal.state}` 实际会产生 `-halted`/`-queued`/`-drawn`/`-legacy`，而样式表里只有 `.bz-people-seal-hold`/`-wait`（暗色 1556-1557 同）。结果是「歇（暂停/中断）/停（失败）/等（排队）」全部渲染成与 running 同款的实心朱红印，issue 451 四态印的「虚边、褪色」语义完全不上屏，册子上分不清「画着」和「断了」。
  - 修法：单源对齐一处即可——推荐 CSS 侧补 `.bz-people-seal-halted`、`.bz-people-seal-queued`（沿用现 hold/wait 的值），暗色两条同步改名；或 render 改回输出 hold/wait。

- **P2** `src/people/ui.ts:2973-3026` — 「AI 补充」等待期间换人，结果填进**另一位**的编辑表单
  - 影响：`aiFillProfile` 起跑时捕获人物，但 AI 调用返回后直接 `overlay.querySelector('[data-people-prof-field=…]')` 往当前表单里灌。窗口是整次 AI 调用（秒级到十秒级）：期间关掉档案页再打开另一位并进编辑态，A 的推断结果会填进 B 的空白字段，用户不知情点「保存档案」就把错档案写进 B。
  - 修法：起跑时存 `const talker = detailId`，`await` 返回后首行校验 `if (detailId !== talker || !overlay) return;`。

- **P2** `src/people/styles.css:860-862`、`706-707`、`838-839`、`1109-1110` — 暗色主题四处断档：白底组件未补 `.theme-dark` 覆盖，亮字落在白底上不可读
  - 影响：暗色下 `--ink-strong` 是 #e8e2d2，而下列底色仍是亮色写死：① `.bz-people-ds-row`（#fffefb）——数据源名单整列「名字」不可读（域内 1573 行那组已给 find-row/act/quote-card 等补了，唯独漏 ds-row）；② `.bz-people-fact`（#fffdf8）——详情页一眼账数值不可读；③ `.bz-people-note-row`（#fbf3df，1595/1612 只补了分隔线）——随手记正文不可读；④ 窄容器 sticky 页眉 `.bz-people-page-head { background:#f7f2e6 }`（1109，@container 内）——暗色+窄屏页眉标题不可读（折签 `.bz-people-ftabs` 在 1578 有暗色实底，唯独页眉漏了）。
  - 修法：按 1573 行组的既有模式给四处补 `.theme-dark` 覆盖（底色改 `var(--card)`/`#35312a` 系；页眉底改与 `.theme-dark .bz-people-pagebody .bz-people-ftabs` 同款 `#2f2b24`）。

- **P3** `src/people/render.ts:2239` — 「找一找」结果的「左/右」用全局下标奇偶判定，偶数摊（第 2、4…页）全报错边
  - 影响：`half: at % PER_SPREAD === 0 ? '左' : '右'` 里 `at` 是全册序号；左右应按**页序号**奇偶（`Math.floor(at / AL_PER_PAGE) % PER_SPREAD`）。第 2 页（at=6..11）全被标成「左」，实为右页；偶数页全错，指路信息失真（点击跳转本身是对的）。
  - 修法：`const pi = Math.floor(at / AL_PER_PAGE); half: pi % PER_SPREAD === 0 ? '左' : '右'`。

- **P3** `src/people/ui.ts:2458-2465` — `pullPhoto` 的 240ms 定时器在面板关闭后仍落地，重开面板直落详情页
  - 影响：点照片到翻详情之间有 240ms 延时；期间 ESC/遮罩关面板（`closePeoplePanel` 已把 `pulled/detailId` 清掉），回调随后无条件 `pulled = id; detailId = id; …` 写回模块态并调一次空转 `renderAlbum`。下次打开面板时 `albumBody` 按 `pulled` 直接翻开那位陌生人的详情页，而不是封面墙。
  - 修法：定时器回调首行加 `if (!overlay) return;`。

- **P3** `src/people/ui.ts:2843-2855`、`3179-3203` — 异步回包无归属校验，快速换人后旧数据短暂顶替新视图
  - 影响：`refreshStatsKinds` 与 `refreshSuppStoreInfo` 都是「先清后读、回包写模块态再重画」，但回包不校验 `detailId`/`suppOwnerId` 是否仍是发起时那位。A 的读包慢于 B 的（解密耗时不定）时，统计页形态计数、补充素材页的图片网格/计数会先显示 A 的数据，等 B 的包到了才自愈。
  - 修法：发起时记录 `talker`，回包处 `if (detailId !== talker) return;`（supp 侧对 `suppOwnerId` 同理）再赋值重画。

- **P3** `src/people/render.ts:1644` + `src/people/styles.css:892-893`；`src/people/render.ts:2356` + `src/people/styles.css:251-252` — `.bz-people-ds-pickfresh`、`.bz-people-banner-x` 单类被宿主 reset 剥色
  - 影响：`src/core/reset.css:14-18` 的 `button:not(.clickable-icon)`（(0,1,1)）unset 裸按钮 color/background-color/box-shadow，压过单类 (0,1,0)——真机上「勾有更新的」丢朱红强调色、横幅的 × 丢灰阶弱化。域内其余按钮均已双类提权，这两枚漏网。
  - 修法：照域内先例双写类名（`.bz-people-ds-pickfresh.bz-people-ds-pickfresh { … }`、`.bz-people-banner-x.bz-people-banner-x { … }`）。

### 待验证

- 窄容器（面板 <560px）且有任务时，左下进度便签横贯下沿（styles.css:1096 `width: calc(100% - 20px)`，槽位 z 38）与右下「找一找/数据源」小签（z 25，styles.css:201）、各册页页脚按钮几何重叠，便签 `pointer-events:auto` 可能截走点击。复现：缩窄窗口至容器断点 → 起一个画谱任务（或录音转写）→ 点右下小签与数据源页脚。
- 发现第 2 条（select 时序）在非 Chromium 内核下表现不同——Obsidian 本体均为 Electron，仅影响壳内核对。

### 已核验无问题

- ESC 分层：esc-manager 栈序正确；gen 页 ESC 走 `closeDialog`→`answerGenConfirm('cancel')` 正确结清；`registerPanelEsc`/`unregisterPanelEsc` 随面板对称。
- 渲染竞态主防：`renderAlbum` 每处 `await` 后都有 `!overlay || !peopleSafe?.unlocked` 双检；冷读 `records()` 有 `recordsInflight` 去重、上锁失效语义正确。
- 订阅/定时器生命周期：`recPollTimer`、`syncTickTimer`、wheel/resize/unlock/sync 订阅随 `closePeoplePanel` 全退；`flipSheet`/`runFly`/tear 挂 body 的临时件均有 setTimeout 自清，无泄漏。
- 头像性能：`avatarMap` 每次重画全量调用，但 `avatarDataUrl` 有缓存，不会反复解密。
- 铁律扫描：域内无 scrollbar 自造；无运行时 `<style>` 注入（innerHTML 仅用于翻页纸/飞行照片的自产片段）；通知无 emoji；动态几何走内联 style 属数据驱动。
- 事件委托选择器与 render DOM 抽查：jobs 四动作钩子、supp 全套钩子、ds 行勾选、fold/mon/more/pocket/seal 均能命中实际结构；`mountIcons` 占位在按钮内部。
- 数据写入防重与清理：`targetsInFlight`+`jobsPersisted` 防重复落盘；`suppImportImages` 按 `img:` 键查重；`suppDeleteRecording` 六处清理含上锁拦截；导入后 `recordCache = null` 兜底重读（492 实案已修）。
- `harvestRecQueueInputs` 对「重画吃掉未提交起点」的主防护本身有效（缺陷仅在 recDrop 的调用顺序）；图片队列 ts 靠 change 即时落模，splice 场景无此问题。
- 翻页与手势：`turnTo` 在详情/弹窗态被钉住；`bindWheelTurn` 让位可滚块的原生滚动；翻页定位公式在找一找跳转、导入回册两处均正确。

## C 录音线与任务

### 发现

- **P2** `src/people/jobs.ts:1253`、`src/people/jobs.ts:1278` — 「补充素材·描述单段」的临时任务被两处裸 `persist()` 写进保库，违背自身「临时任务不落盘」的口径
  - 影响：`runDescribeOnly` 把临时 job 压入 `st.queue`（jobs.ts:1419），而 `runDescribeStage` 里确认门前后的两次 `await persist()`（1253、1278）直接整队列落盘——临时任务（fileLabel「补充素材」、status running、mode incremental、msgCount 0）会写进该联系人的保库记录 job 段，并持续整个描述运行期（分钟级）。jobs.ts:1424 注释明确声称「临时任务不落盘（中途崩溃不留假任务在保库）」，与实现矛盾。此间崩溃/强退 Obsidian，下次启动 `resumeJobs` 会把它标成 interrupted 出「继续生成」；而面板首开注入的两道确认门是自动放行（ui.ts:1315、1584-1585），用户点继续会**不经任何确认**地烧 AI 跑完整条画像链。
  - 修法：这两处落盘改走 `finish({ ... })`（finish 内已有「先把临时任务摘出队列 → persist → 塞回」的口径，jobs.ts:1427-1429），或给 `persist()` 加排除参数；不可直接调裸 `persist()`。

- **P2** `src/people/jobs.ts:1004-1006` — 等重进程闸被弃（`!got → break`）后无人再 kick，队列可停摆
  - 影响：任务在 `waitHeavyGate` 轮询等闸期间，若它被移出队列（两种现实触发：① 用户删掉这个「等待录音处理结束…」的任务，removeJob 不 kick；② 用户对同一人重新点生成且素材已变——`reusableJob` 判 false，startJobs 换了新 job 对象入队，旧对象出队），旧 runQueue 下一次 300ms 轮询 `keepWaiting` 返回 false → `if (!got) break;` 整个退出；此刻 `startJobs` 末尾的 `kick()`（jobs.ts:839）因 `runPromise` 尚未清空而是 no-op，队列里排在其后的 paused 任务**无人拾起**，引擎静默空闲，直到用户再点一次「继续生成」或解锁事件才恢复。
  - 修法：`if (!got) break;` 改为 `if (!got) { emit(); continue; }`——循环顶部的 `runnable()` / `describeOnlyBusy` / `find(paused)` 检查会自然处理暂停、上锁、空队列与「拾起替任任务」，语义只增不减。

- **P2** `src/people/jobs.ts:1090-1091` — `prepAllDone` 断点短路压过 pending 待办检查，暂停期新导入的语音永不转写
  - 影响：runPrepStage 的顺序是「pending 待办检查（1088-1089）→ `if (prep && prepAllDone(prep)) return 'skipped'`」。当任务 prep 已齐四段、暂停在描述确认/首批提取前（batchesDone=0），用户中途导入含新语音的聊天数据：续跑时指纹漂移走 refresh 豁免不判废，但 prep 因 donePhases 齐段被跳过——新语音 text 恒空，不进时间线、不进素材、不进统计，任务照常「成功」，静默缺料。同批新图片反而会被 describe 段重新读仓补上，两条媒体线行为不一致。
  - 修法：pending > 0 时不做 `prepAllDone` 短路；或 prepAllDone 且 pending > 0 时清 `donePhases` 重跑 prep（与 `retryPrepFailures` 同一口径）。

- **P3** `src/people/jobs.ts:507`、`src/people/jobs.ts:615`、`src/people/jobs.ts:1582` — AI 调用数估算少计「档案提炼」一次
  - 影响：切批文案 `共 N+3 次 AI 调用`、`estimatePortraitCallsOf`（确认门与总确认共用）都按 采集批+其人+相交+纪事 计；runJob 实际还有第 4 次画像调用 `buildProfileExtractPrompt`（jobs.ts:1744-1750，四类素材任一非空即跑，常态命中）。确认门给用户的「约 M 次调用」系统性少 1，属花钱知情项的口径偏差。
  - 修法：三处 +3 改 +4，或按「events/素材存在与否」条件计数与文案同源单源化。

- **P3** `src/people/jobs.ts:1535-1541`、`src/people/jobs.ts:1603` — refresh 重切批边界但保留旧 `results`/`batchesDone`，新旧批错位
  - 影响：本任务自身合并升级素材（refresh）时 `job.chunks = metas` 整体重切，但 `batchesDone`/`results` 原样保留，提取循环从新边界的第 batchesDone 批续跑——旧 results 对应旧边界，新布局头部的增量素材（如新转写语音落进前 N 批时段）不会被任何批提炼，重叠段又可能被重复烧钱。合并是并集故无数据损坏，纯覆盖缺口。
  - 修法：refresh 且 batchesDone > 0 时按首末日期对齐可复用批（from/to 仍匹配的旧批保留），否则置 `batchesDone = 0` 清 `results` 重跑；至少在注释里把该取舍写明。

- **P3** `src/people/jobs.ts:645-648`、`src/people/jobs.ts:992`、`src/people/jobs.ts:1014` — 手动暂停与上锁暂停共用一个 `pauseRequested`，解锁 kick 语义两处失真
  - 影响：① 用户手动暂停后遇一次上锁→解锁，`unlocked===true → kick()` 无条件续跑整个队列，覆盖用户暂停意图；② 空闲期上锁：pauseJobs 置位但无人消费，首次解锁的 kick 被 `runnable()` 拦下且 runQueue 尾部顺手清掉旗标，该次「解锁续跑」静默失效，须再触发一次。
  - 修法：区分暂停来源（如 `lockPaused` 布尔），解锁仅在 lockPaused 时 kick；kick 的 runQueue 起手不消费/不清 pauseRequested，交给批间检查点自然停止。

- **P3** `src/people/jobs.ts:884` — `resumeJobs` 的注入判定漏了 `askDescribeConfirm`
  - 影响：条件链是 `askExtract || askPortrait || askDescribe || askPortraitConfirm ? ai : null`，比 startJobs（717-718）少 `askDescribeConfirm`。当前 UI 恒双门齐传故未触发；将来只注 describe 门时整包注入被丢弃，描述会被静默按跳过处理。
  - 修法：条件链补上 `ai.askDescribeConfirm`（最好抽一个共用的 hasInjection 判定）。

- **P3** `src/people/jobs.ts:1141-1156`、`src/people/jobs.ts:1164`、`src/people/jobs.ts:1121-1122` — prep 的 stopped/error 分支不清控制文件，且 resume 写在 spawn 之后
  - 影响：`clearPrepControl` 只在 'ok' 终态收尾；`result.stopped`/`outcome.stopped`/error 分支留下的 `stop`/`pause` 残指令靠下次起跑后的 `writePrepControl('resume')` 覆盖（与注释「**起跑前**写 resume」顺序相反）。已核实工具侧只在安全点 checkpoint 读 control（bz_prep.py:112-134，启动不预读），故常规路径窗口≈0；但若该次 resume 写失败（`writePrepControl` 返回 false 不上浮），新进程会在首个 checkpoint 读到陈旧 stop 干净退出 → 任务落 paused，用户重试无限循环且无任何错误浮出。
  - 修法：stopped/error 分支同样 `clearPrepControl(dataRoot)`；把 resume 写挪到 `startPrepSession` 之前；`writePrepControl('resume')` 失败时至少 console.warn 或在 message 交代。

- **P3** `src/people/jobs.ts:1105`、`src/people/jobs.ts:1109` — 旁路表快检分支无条件 `job.prep = newPrepProgress(totals)`，重置断点账本
  - 影响：暂停后续跑只要盘上有旁路表且覆盖不全，就整体覆盖 `job.prep`——donePhases 清空（进度显示归零、断点判定退化成全量重扫）、`failed` 归零（「重试失败项」按钮消失）。
  - 修法：已有 ledger 时只更新 counts 分母，不动 donePhases/failed。

- **P3** `src/people/recording.ts:364-377` — 零轮次录音（phase=done、turns=[]）被记为 `merged`，但并仓永不发生
  - 影响：`recordingItemState` 对 `done` 无条件返回 'merged'；而并仓判定 `recordingTurnsComplete` 要求 `turns.length > 0`（recording.ts:388-390）——纯噪声/无语音的录音处理完后行状态恒「已并仓」，实际仓里没有任何 `rec:` 消息，点并仓静默 no-op、无任何通知，用户无从分辨「并了空的」还是「丢了数据」。
  - 修法：`case 'done': return recordingTurnsComplete(sidecar) ? 'merged' : 'failed'`（或新增「无有效语音」态），并让并仓路径对零轮给出一条提示。

- **P3** `src/people/recording.ts:57`、`src/people/recording.ts:81-83` — 崩溃遗留的账本半截 `.tmp` 没有清扫入口
  - 影响：ADR-0219 起 tmp 名带 pid（`<stem>.turns.json.<pid>.<n>.tmp`），进程被杀/崩溃留下的 tmp 只有「删除该录音」时才被扫掉（ui.ts:3598-3600）；正常使用中永久滞留在 `recordings/`，仅靠派生物后缀过滤不显示，属无人认领的脏文件。
  - 修法：并仓成功或列目录时顺手按 `recordingTmpPrefix` 扫清同 stem 的陈旧 tmp（mtime 早于本次起跑才删，避免误删在写文件）。

### 待验证

- P2 第一条（describe-only 临时任务落盘）的崩溃残留需运行时证实。复现：进联系人详情 → 补充素材·图片页签 → 点「生成描述」（保证有未描述图片、描述需跑数分钟）→ 运行中强退 Obsidian → 重开脸谱面板，看该联系人进度块是否出现 fileLabel「补充素材」的 interrupted 假任务；再点「继续生成」确认两道门是否被 ui.ts:1584-1585 的自动放行吞掉。
- 估算少一次调用（P3 第一条）建议在真实账号上数一次 [AI] 调用流水确认档案提炼常态命中（素材四类全空的联系人不命中，此时 +3 反而是准的）。
- 其余竞态条目（队列停摆、prepAllDone 短路）逻辑上已由代码路径推实，未做运行时复现；如需实证可按各条「影响」里写的触发序列操作。

### 已核验无问题

- **命令 ID**：main.ts 仅注册 `bz-people-open` / `bz-people-import`，三段式合规。
- **通知文案**：范围内七个文件无任何 `notice()` 调用，无 emoji 风险；唯一 `⚠` 符号在 digest.ts:346 的 LLM prompt 文本里，不属通知正文。
- **排队串行真串行**：引擎单 runQueue 循环逐任务、录音单 pump 循环逐条、heavy-gate 跨通道互斥；同身份可重入计数全路径配平；抢占 latch 以「`preemptHeavyStandby()` 返回 true」为条件，issue 516 记录的死锁修法在码内核实。
- **删任务与运行中任务的赛跑**：runJob 在批间、重试退避后、描述批间、每次落盘后均有 `gone(job)` 检查；removeJob 杀 prep 会话、触发 prepGate、置空 runningJob，被删任务不再落盘不再出 done。
- **账本韧性主路径**：resumeJobs 把遗留 running 标 interrupted 不自动续跑；上锁期不建引擎、JobStore 读写在上锁期返回空/抛错且 persist 只告警不丢内存队列；指纹漂移「烧过批 + 外部漂移 → DRIFT_ERROR」拦在 prep 之前，自身合并走 refresh 豁免。
- **描述段**：确认门一次（confirmed 记账，重试/续跑不重复弹）、跳过≠取消、批级断点以聊天仓 text 为权威、派生档读不动剔单条不废整批、空描述不进仓、门抛错按跳过绝不静默烧钱。
- **录音账本韧性**：sidecar 读缓存 stat 三重签名、`recordingTurnsComplete` 停在 transcribe 但成果齐的兜底并仓、协作停止 90s 兜底杀、控制文件按任务派生互不串台、起跑前清陈旧指令、终结后再清、handle.done 永不 reject。
- **重试与吞错**：采集批/描述批均有 2 次退避重试且退避中响应暂停与删除；AbortError 不重试；《纪事》/档案提炼失败不阻断主流程且 console.warn 留痕；portrait 两卷单次失败落 error 可从断点续跑。
- **去重与起点**：同名同内容跳过/不同内容 ` (2)` 后缀；巡检先按尺寸分桶才读盘哈希；起点 meta 一等数据不进 sidecar、候选以 mtime 为上界、改起点经并仓幂等通路重排 ts 并重写 turns.md。
- **段落化单源**：`segmentRecordingTurns` 与 `recordingTurnSegments` 判据逐字同构，key `rec:<file>:s<段序>` 写读对称；重并先清前缀再写、kindCounts 取净增量不翻倍。
- **文件句柄/定时器**：sidecar、meta、派生档全部 readFileSync 用完即弃；coop-stop 定时器在 done 后 clearTimeout；prepGate 的 pending promise 可正常回收。
- **纯函数层**：digest 切批确定性、evenlySample 首尾必保、computeStats/computeInsights 会话切分与时延封顶口径一致、mergeEvents 轻重回填与去重正确。

## 门禁佐证（主线程）

- `pnpm exec tsc --noEmit`：退出码 0，无错误。
- `pnpm test`：退出码 0，全量通过（2026-09-29，审查基线 commit df0499fa 之后的工作区）。

## 拍板与修复记录（实时追记）

### 2026-09-29 修复批（A/B/C 三组后台代理，串行合并）

- **A 数据与保库**（分支 fix/people-review-a，commit 56d98034）：修 8 条——P1 迁移读失败中止（readLegacyJson 三态哨兵）+ P2×4（suppressClear 普通路径、removeContact 入串行链、头像校验按实际读取、头像重建回滚兜底）+ P3×3（落盘失败逐缓存、readAll 单点跳过+failedCount 提示、quotePathArg POSIX 单引号）。域内 781 测试全绿。
- **B 渲染与样式**（分支 fix/people-review-b，commit e0c5907c）：修 13 条——P1×4（找一找 input 接线+防抖、录音候选 select 改 change 委托、移出队列先 harvest+按 path 身份寻址根治、genConfirm 两路结清）+ P2×4（未解锁 pendingDs 补开、印章 CSS 接 halted/queued、AI 补充归属校验、暗色四处补齐）+ P3×5（左右按页奇偶、pullPhoto 守卫、回包归属校验×2、双类提权×2、数据源空态文案+设置描述口径）。新增 tests/people/review-fixes-b.test.ts 17 例。
- **C 录音线与任务**（分支 fix/people-review-c，commit c9ac5ddd）：修 10 条——P2×3（describe-only 临时任务 persist 单点排除、等闸弃等改 continue 拾起、prepAllDone 仅语音欠账例外重跑）+ P3×7（估算 PORTRAIT_FIXED_CALLS=4 单源、lockPaused 分离+pauseRequested 粘滞、resumeJobs hasInjection 同源、prep 控制文件四分支清理+resume 前置、快检只刷分母、零轮次 done 映射 failed+人话文案、tmp 并仓时清扫）。选案偏离已记录（#3 收窄为仅 pending.voices、#9 选映射 failed 不加新态）。
- **合并**：三分支各自并 master 底后测试全绿，a→b→c 快进合回（518 校对开关零冲突）；主仓库全量门禁 tsc 0 错误、8615 测试全过；`pnpm run build` + `pnpm changelog` + `pnpm manifest` 产物重出并提交（300f6fa9）。
- **不修**：A 组 datasource 无 sid 折叠（产品线不动，报告留档）；B 组窄容器便签遮挡（待验证，缺运行环境）；C 组 refresh 重切批（转拍板 → 已拍板「对齐复用」，交 D 组落地）。
- **遗留待验证**：chat.json 字符串型 type（复现路径见 A 组待验证）；头像重建窗口故障注入（修复 5 已加回滚兜底，兜底路径待故障注入复验）。
- **体验增强**（D 组，拍板 9 项）另见 review-people-ux.md，代理进行中。
