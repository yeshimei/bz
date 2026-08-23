# ADR-0030：smartcat 日记观察（每条独立 10 分钟结算 + 首次有字才落 + 累计 >50 更新）

Status: accepted（2026-08-23，ticket 077，用户八轮拍板定稿）

## Context

日记观察原先走 `observationText` 快照 + vault 10 分钟去弹跳：路径级（整文件）去弹跳、整文件正文快照、自动保存连发靠同路径 10 分钟节流压制。粒度粗：同一文件里多条日记无法区分（写第二条会重置整文件的计时）、条目级删除无感知、正文截断 300 字。用户拍板改为**每条日记独立的 10 分钟结算机制**：创建/修改日记 md → 该条日记的 10 分钟计时重置；静置（停笔超 10 分钟）→ 结算产出观察。观察是**静态快照**，只有「新增」「新增更新」两种产出，**无覆盖、无引用、无动态读取**。

## Options

- A（采纳）**per-entry 独立 10 分钟计时表**：事件通道（vault create/modify/delete 监听 diary 目录，classifyPath==='diary'）→ diff 出变化的条目 → 重置该条独立计时；计时到期读文件结算。全量解析快照 diff 兼做条目级删除感知。
- B 整文件 10 分钟去弹跳增强（保留现状粒度）：无法区分条目级静置/删除，第二、三条日记共享一条计时——不满足用户「多条日记各自计时互不影响」。
- C 方法监听（仿 movie/memo/news）：diary 域 UI 回调直呼 notifyDiaryAction。日记存在多写入面（面板写日记/写摘抄/手改 md/同步导入/外部脚本），无法穷举 UI 挂点；事件通道是日记唯一可靠感知面（且日记正文即数据本体，无 JSON 双写问题）——未采纳。

## Decisions

- **事件驱动新链路**：`onVaultActivity` 对 `kind === 'diary'` 短路走新链路（替换原 observationText 分支）；**原日记 10 分钟去弹跳、信任成长 `developBasedOnInteraction`、`observationText` 不再执行**；PAD 正向轻推（红队 C 接线，diary→note_create）照旧保留（新链路自带 per-entry 计时，无需机械去簇防批量）；其它 kind 现状不动。
- **per-entry 计时表**（模块级 Map，内存态不落盘，smartcat.json 零改动）：key = `${filePath}\u0001${date}\u0001${time}`（date = 文件名日期，time = 标题行 HH:mm）；value = `{ timer, generated, baseline（上次生成正文基线）, baselineTags, accum（累计字数差）, lastGeneratedAt }`。该条任何修改（正文/分类变化，diff 出）→ 清旧定时器重装 10 分钟；静置到期（默认 10 分钟，测试可注入缩短）→ 读文件 → 解析 → 对该条结算。
- **结算判定纯函数**（`src/smartcat/diary-source.ts`）：首落（该条尚无观察）正文**有字（非空）**才生成；只有标题 → 不生成（记已见，防「标题即存」，补正文后走首落）。已有观察：累计字数 = 每次结算累加（当前正文长度 − 上次生成基线长度，中文按字符数）；`累计 >50` → 生成「更新」观察并重置基线/累计，`≤50` → 不生成（本次补写不进记忆，但计入累计，等下次结算）。
- **观察文本**（用户八轮拍板，措辞不得自改；正文全量不截断；分类多个「、」分隔）：
  - 首次：`你在 <YYYY-MM-DD HH:mm> 写了一篇日记（分类：<c1>、<c2>）：<正文>`
  - 更新：`你更新了日记（<YYYY-MM-DD HH:mm>）：<新正文>`（分类有变化也更新进括号：`你更新了日记（<date> <time>，分类：<c>）：<正文>`）
  - 删除：`你删除了 <YYYY-MM-DD HH:mm> 的日记`（原观察全部保留，删除观察只追加）
  - 文件级兜底（整文件删除且从未跟踪过条目，时间信息不可得）：`你删除了 <YYYY-MM-DD> 的日记`
- **emoji → 分类映射**：import `src/diary/config` 的 `emojiToTagMap`（单向域间 import，对齐 movie→smartcat 先例；diary/config 只依赖 diary/types，无环；若未来成环则内置映射表并注明来源）。分类语义对齐 diary/parser：标题行 emoji 序列逐个反查（主/二级都列），无命中回退「日记」。
- **重启基线**：ensure 时对日记目录**当日文件**建快照（有字条目记「已见」generated=true，不产出观察）——防重启后旧条目被当首次；无字（标题即存）待首落。基线先于监听挂载完成（竞态守卫）。
- **删除感知**：补挂 `vault.on('delete')`（diary 目录）→ 按跟踪快照逐条追加删除观察 + 清计时；从未跟踪过的文件 → 文件级单条兜底观察。**条目级删除（md 内块被删）**：每次 modify 全量解析快照 diff，发现「上次快照存在、现在消失」的条目 → 追加删除观察 + 清该条计时（最小可靠方案：条目按 (日期, 时间) key 唯一标识，比正文子串匹配稳健）。
- **观察写入 fire-and-forget**：结算/删除观察一律 `void memorySystem.addObservation(text, { source: 'diary' })`，不 await——`addObservation` 尾部 `appendVector`（探测 Ollama）在无向量环境可能不 resolve，若 await 会阻塞事件链并拖住结算状态提交（对齐 notifyMovieAction/notifyMemoAction/notifyNewsRead 既有 fire-and-forget 模式）。
- **兼容冻结**：`我的/日记/*.md`、smartcat.json 零改动（计时表/基线内存态）；`MemoryStreamEntry.source === 'diary'`；context-source 的 observationText diary 分支**保留不动**（既有 context-source 测试不破坏）；旧「你写了日记：…（关键词：…）」记忆不迁移。

## Consequences

- 观察粒度从整文件粗快照精确到**逐条**：写第二条另起 10 分钟互不影响；停笔 10 分钟才落（防打字刷屏）；补写 ≤50 字不入记忆但计入累计（阈值跨多次结算累计）；删除（文件/条目）可感知且原观察保留。
- smartcat ← diary（config）新增单向依赖边（`src/smartcat/diary-source.ts`、`index.ts` import `src/diary/config`），符合 ADR-0002。
- 行为变更：diary 不再走原 10 分钟去弹跳/信任成长/observationText；批量导入 diary 文件不再被机械去簇折叠（各条独立结算，各落一条观察）——per-entry 计时 + 重启基线是替代的批量防护。
- 已知边界/取舍（实现者在 ADR 说明）：
  1. 同文件同 HH:mm 重复标题 → entry key 冲突，后写覆盖（日记域自身也按 time 标识，极端场景低频）。
  2. 重启基线无法区分「旧条目是否已产出观察」，一律视为已见——防重启后旧条目刷首次优先于首次文案准确性。
  3. 文件级删除兜底观察缺 HH:mm（信息不可得时以日期替代；条目级路径恒带 HH:mm）。
  4. `addObservation` 尾部向量落盘在无 Ollama 环境不 resolve——观察已入流、状态已提交（fire-and-forget），无功能影响。