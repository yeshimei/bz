# ADR-0029：smartcat 聚合讯观察（逐篇三态 + 阅读时长 + 保存联动 auto-summary）

Status: accepted（2026-08-23，ticket 076，用户多轮拍板定稿）

## Context

聚合讯观察原先只有两句粗略观察：「你浏览了今天的资讯（N 条）」（domain:news 计数 extract，news-stats.json modify 才触发，无法区分逐篇动作与时长）与「你剪藏了：…」（clipping 事件观察，与 saveToClip 产出的剪藏混在同一路径）。用户拍板改为**逐篇三态**：阅读 / 跳过 / 保存，带标题、平台、阅读时长；保存观察联动 auto-summary（等 AI 摘要/标签写回剪藏 frontmatter 后产出完整观察）；剪藏事件观察整体停用。

## Options

- A（采纳）逐篇三态方法监听 + 保存联动补全（方案 a 定稿）：news 域 reader 动作（下一篇/保存）经 `notifyNewsRead`/`notifyNewsSaved` 直接入链；保存瞬间产「立即降级」形态（观察文本表「保存（立即降级）」行），同时登记待补全表（内存，不落盘）；auto-summary 写回剪藏 frontmatter 的 modify 命中 → 追加完整形态（含摘要/标签）；2 分钟降级定时器兜底。
- B（方案 a 字面版）保存瞬间不产观察、只登记，补全或降级二选一产一条：保存的记忆延迟 2 分钟或依赖 auto-summary 事件，且与观察文本表「保存（立即降级）」行冲突——未采纳。
- C 事件快照 diff（仿影视 ADR-0026 思路）：news-stats.json modify → diff 计数。粒度停留在计数，无法表达逐篇动作/时长/平台——被三态取代。

## Decisions

- **逐篇三态方法监听**：`render` 渲染当前文章时记录 `openedAt`；`markAsRead`（saveToClip/skipArticle 共用）算停留时长 → 三态判定：保存优先（不看时长）；跳过且时长 ≥2 分钟升「阅读」、<2 分钟为「跳过」；时长取整分钟（`Math.round`，≥1）。
- 观察文本（用户拍板，`news-source.ts` 纯函数）：`你阅读了《<标题>》（<平台>·读了 N 分钟）` / `你跳过了《<标题>》（<平台>）` / `你保存了《<标题>》（<平台>·读了 N 分钟）` / 补全形态 `你保存了《<标题>》（<平台>·读了 N 分钟）：<摘要> #<标签>…`（摘要/标签缺省省略对应段）。
- **保存联动（方案 a 定稿）**：`notifyNewsSaved(evt, 剪藏路径)` 登记待补全表（`剪藏路径 → {标题, 平台, 时长分, 定时器}`，内存态）并启动 2 分钟定时器；`onVaultActivity` 对 `classifyPath==='clipping'` **短路**（剪藏事件观察停用，不再产「你剪藏了」），唯一例外：命中登记的该剪藏 modify → 读 frontmatter summary/tags → 补全完整保存观察 → 移除登记（clearTimeout）；定时器兜底：登记后 2 分钟未等到 → 读剪藏 frontmatter（错过 modify 事件兜底）后产出保存观察并移除登记。
- **防重复**：补全/降级产出与近 20 条同文案（保存瞬间 notifyNewsRead 已产的立即形态）→ 跳过，防止一次保存双条重复记录。
- **domain:news 计数观察移除**：`DOMAIN_FILES.news` 删除（「你浏览了今天的资讯」不再产）。
- 守卫：`notifyNewsRead`/`notifyNewsSaved` 在 smartcat 未初始化或 `data.config.noteSource` 关闭时静默（与 movie 一致）。
- 平台值取自文章 `platform` 字段原样（果壳科学人/知乎日报/知乎热榜…）；标题一律文章原标题，auto-summary 不重写。

## Consequences

- 观察粒度从「按天计数」细化为「逐篇三态 + 时长」，保存观察最终携带 AI 摘要/标签（记忆流更丰富、可检索性更好）。
- smartcat 与 news 域产生新依赖边：`src/news/reader.ts → src/smartcat`（notifyNewsRead/notifyNewsSaved）。方向单向（smartcat 不 import news UI / news 数据），符合 ADR-0002。
- 行为变更：剪藏事件观察停用、domain:news 计数观察移除——旧记忆不迁移（兼容冻结：旧数据直接可读）。
- 数据零改动：news.json / news-stats.json（时长观察携带不落盘）、smartcat.json（待补全表内存态）、剪藏 frontmatter（auto-summary 产物原样）。
- 已知边界：auto-summary 缺 title 时会重命名剪藏文件（改路径），登记键为原保存路径——若 modify 事件携带新路径，补全可能落空，由 2 分钟降级兜底（方案 a 固有降级链）。