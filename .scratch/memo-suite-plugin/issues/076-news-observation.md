# 076 — smartcat 聚合讯观察（逐篇三态 + 阅读时长 + 保存联动 auto-summary）

Status: done（2026-08-23，用户多轮拍板定稿；实现完成：逐篇三态方法监听 + 保存联动 auto-summary 方案 a + 剪藏观察停用）

## 需求 → 观察流程（用户拍板）

聚合讯观察从「按天计数（你浏览了今天的资讯 N 条）」改为**逐篇三态**：阅读 / 跳过 / 保存，带阅读时长、平台、标题。保存观察联动 auto-summary（等 AI 标题/摘要/标签生成后产出完整观察）；剪藏事件观察整体停用。

### 判定规则

- 打开文章记录 `openedAt`；点「下一篇」/「保存」时算停留时长 `duration`。
- **保存优先**：点「保存」→ 永远走「保存」（无论时长是否 ≥2 分钟）。
- 点「下一篇」：`duration ≥ 2 分钟` = **阅读**；`< 2 分钟` = **跳过**。
- 时长取整分钟（`Math.round(duration/60)`，≥1 分钟显示 N 分钟；跳过态不显示时长）。

### 观察文本

| 状态 | 观察文本 |
|---|---|
| 阅读 | `你阅读了《<标题>》（<平台>·读了 N 分钟）` |
| 跳过 | `你跳过了《<标题>》（<平台>）` |
| 保存（立即降级） | `你保存了《<标题>》（<平台>·读了 N 分钟）` |
| 保存（auto-summary 补全） | `你保存了《<标题>》（<平台>·读了 N 分钟）：<AI 摘要> #<标签>…` |

### 保存联动 auto-summary（方案 a，用户确认）

1. news 保存瞬间：`notifyNewsRead` 产「立即降级」形态 + smartcat 登记 `{剪藏路径, 标题, 平台, 时长分}` 进**待补全表**（内存）。
2. auto-summary 异步生成 title/summary/tags 写回剪藏 frontmatter → smartcat 订阅剪藏 modify：命中待补全登记 → 读 frontmatter summary/tags → 产出完整保存观察 → 移除登记。
3. **降级**：登记后 2 分钟未等到（AI 失败/超时）→ 产出无摘要的保存观察并移除登记（定时器）。
- 标题一律用文章原标题（news 文章都有 title，auto-summary 不会重写）。
- 不进 auto-summary 内部方法（不侵入），只订阅其写回结果。

### 剪藏观察整体停用（用户拍板）

- `onVaultActivity` 对 `classifyPath==='clipping'` **短路**（不再产「你剪藏了：AI 摘要」）；唯一例外：命中待补全登记的该剪藏 modify → 只做补全产出。
- `domain-source.ts` 的 **news extract 移除**（「你浏览了今天的资讯（N 条）」不再产，被逐篇三态取代）。

## 接线

- `src/news/reader.ts`：`markAsRead`/`saveToClip` 处（方法监听，挂 UI 动作）：记 `openedAt`（render 打开文章时）、算 duration → `notifyNewsRead({title, platform, state: 'read'|'skipped'|'saved', durationMin})`；保存时（saveToClip 成功路径）另 `notifyNewsSaved(evt, 剪藏路径)` 登记待补全（路径 = `${CLIP_DIR}/${cleanTitle}.md`，与写入一致）。
- `src/smartcat/news-source.ts`（新，movie-source 同款）：文案纯函数 `buildNewsReadText(state, title, platform, durationMin)` + `buildNewsSavedFullText(title, platform, durationMin, summary, tags)`；`NewsReadEvent`。
- `src/smartcat/index.ts`：`notifyNewsRead(evt)`（对齐 notifyMovieAction，source `news`）+ 保存待补全登记表（Map 剪藏路径 → 登记）+ 剪藏 modify 补全（onVaultActivity clipping 短路分支）+ 2 分钟降级定时器 + unload 清理；补全/降级与近 20 条同文案防重。
- 平台值：文章 `platform` 字段原样（果壳科学人/知乎日报/知乎热榜…）。

## 测试

- `tests/smartcat/news-source.test.ts`：buildNewsReadText 三态（阅读带分钟/跳过无时长/保存）+ buildNewsSavedFullText（摘要+标签拼接/缺省省略）。
- `tests/smartcat/news-action.test.ts`（集成，仿 movie-action.test.ts）：notifyNewsRead → stream 尾部断言（含 source 'news'）；notifyNewsSaved 登记 → 模拟剪藏 modify（frontmatter 带 summary/tags）→ 产出完整保存观察且登记移除（再触发不再产）；降级（注入短间隔替代 2 分钟假 timer，规避 memorySystem 反射调度 setInterval 与 fake timers 相互作用）→ 产出无摘要观察；noteSource 关静默。
- `src/news/reader.ts` 挂点不破坏既有 news 测试；全量 npm test + tsc --noEmit。

## 文档

- `docs/adr/0029-smartcat-news-observation.md`（Context/Options/Consequences：逐篇三态 + 时长 + 保存联动 auto-summary + 剪藏观察停用）。
- spec.md 聚合讯 US 29（本决策）；CONTEXT.md 记忆流词条补聚合讯观察；PROGRESS.md 追加条目。

## 兼容

- news.json / news-stats.json **零改动**（时长不落盘，观察携带）；smartcat.json 零改动（待补全表为内存态）；剪藏 frontmatter 仍是 auto-summary 的产物（原样）。
- 行为变更记录：剪藏事件观察停用、domain:news 计数观察移除——旧记忆不迁移（兼容冻结）。