# ADR-0034：smartcat 书库观察——weave-data.json 数据文件监听

Status: accepted（2026-08-25，ticket 081，用户拍板「只有 epub」）

## Context

书库（library）行为面特殊：bz 书库 UI（`src/library/`）是**纯只读展示**（无 modify/create/delete），阅读行为全部发生在外部插件 **weave-epub-reader**——进度/会话/划线/想法由它写 `weave-data.json`（默认 `CONFIG/STORAGE/weave-data.json`，路径从 Weave 插件 settings.dataPath 解析，缺省 CONFIG/STORAGE——ADR-0013）。既有 md 事件通道（`classifyPath('书库/…') → 'reading'` → 从书库 md 提取划线/想法/书评）与 epub 数据文件并存时会造成**双记录**：手写书评/划线全文产一条、weave-data 保存又产一条。且 weave-data.json 不在 `DOMAIN_FILES`，阅读进度/读完/划线计数完全无观察。

用户拍板：**只认 epub 数据文件**（weave-data 驱动），书库 md 通道整体短路。

## Options

- A（采纳）**数据文件监听（盲通道 diff）**：weave-data.json 加入 `DOMAIN_FILES`（`file: 'CONFIG/STORAGE/weave-data.json'`），`libraryWeaveExtract` 纯函数按书 diff 产观察（首次快照由 snapshotDomains 记账不产出）；`onVaultActivity` 对 `kind === 'reading'` 短路（对齐 movie/clipping 先例）。零 UI 改动、零数据格式改动，观察完全由外部插件落盘驱动。
- B 方法监听（仿 movie/memo ADR-0027/0028）：weave-epub-reader 是外部插件，bz 无法在其 UI 挂确认回调（无入口、跨插件耦合）——不可行。
- C md 事件通道保留、只给 weave 加计数：双记录无法避免（同一本书读书笔记保存与阅读数据保存都可能触发）——被 A 取代。

## Decisions

- **通道**：`DOMAIN_FILES.library = { file: 'CONFIG/STORAGE/weave-data.json', extract: libraryWeaveExtract }`；`src/smartcat/library-source.ts` 导出纯函数 `libraryWeaveExtract(raw, prev): string | null | string[]`——**extract 返回类型升级为 `string | string[] | null`**（数组 = 单次保存多条观察，逐条入流；其余域仍返回 string/null 兼容）。
- **观察事件**（一次 weave-data 保存可含多个变化，各产一条，按书迭代；单本书顺序：开始读 → 读完了 → 划重点 → 想法 → 时长）：
  - 开始读：某书首次 `reading.position.percent > 0` → `你开始读《标题》`（进度百分比本身不观察，避免高频）；
  - 读完了：`reading.stats.completedTime` 首次出现 → `你读完了《标题》`；
  - 划重点：`notes.highlights.length` 较上次增加 n → `你在《标题》划了条重点`（n=1）/ `你在《标题》划了 n 条重点`（n>1）；
  - 写想法：`notes.excerpts.length` 增加 n → `你在《标题》写了条想法` / `你在《标题》写了 n 条想法`；
  - 阅读时长：`reading.sessions` 较上次新增（weave 只记 ≥5 分钟 session）→ 新增各条 `durationSeconds` 求和 → `你读了《标题》约 N 分钟`（N=总和/60 向上取整，最小 1 防 0）。
- **prev 记账**：按 bookId 存 `lib:<id>:started/done/hl/ex/sess`（started/done 为 0/1，hl/ex/sess 为计数）；标题取 `meta.title`，**无标题的书跳过**（不产不断言）。
- **首次快照**：snapshotDomains 调用 extract 但丢弃返回值 → started/done/hl/ex/sess 自然落 prev，后续保存才 diff（与既有各域语义一致，无需特判）。
- **md 通道短路**：`onVaultActivity` 在 clipping/movie 同区加 `if (kind === 'reading') return;`——书库 md（手写书评/划线全文）不再产观察；`context-source.ts` 的 reading 分支**保留不删**（代码留存，短路在最前，不再被触发）。
- **兼容冻结**：不改 weave-data.json（外部插件格式）、不改书库 md 结构、不改 `src/library/*`、不改 context-source；只动 smartcat 侧（library-source/domain-source/index 接线）。

## Consequences

- 观察粒度：从「书库 md 修改时产划线全文」细化为「开始读/读完/划重点计数/写想法计数/阅读时长」五类独立事件，可检索性更好；划线/想法只计数不携带全文（避免记忆流膨胀，全文仍可查书库 UI）。
- smartcat 与外部插件建立只读依赖：weave-epub-reader 的落盘格式是观察数据源；格式变更需重新适配（已知边界已按实测样例 + `src/library/items.ts` 既有解析链实现）。
- 行为变更：书库 md 修改不再产观察（手写书评不再被记忆）——旧记忆不迁移（兼容冻结）。
- 数据零改动：weave-data.json、书库 md、smartcat.json 均原样；prev 仅内存态（`domainPrev`，随 unload 清理）。
- 数据文件监听先例：本票是 DOMAIN_FILES 中第一个「外部插件写库」的盲通道 diff（原各域均为 bz 自身写 CONFIG/STORAGE JSON）——后续外部数据源接入可复用该模式。