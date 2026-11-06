# ADR-0286：Obsidian 原生日记（整篇无分段时间头）的读降级、时间兜底与写拒绝

- 状态：已采纳（2026-11-06）
- 涉及域：diary（主）/ core（diary-format）
- 关联：ADR-0284（双格式）/ ADR-0130 / ADR-0131 / ADR-0157（补记：ctime 清零）/ ADR-0245（回收站）

## 背景

用户整个日记目录是 Obsidian 原生日记：一天一个 `YYYY-MM-DD.md`，**一篇纯正文**，没有
`# emoji HH:mm` 分段时间头（那是 bz 自己「一天多篇」时的写法）。

ADR-0284 定的 day 格式解析器只认头行，于是这类文件 `blocks = []`、`unparsed = N`：

- 读：册子里**一条都不显示**（`data.ts::diarySlots` 拿不到候补），文件在 bz 里等于不存在；
- 转：`convert.ts` 判 `unparsed > 0` **整份跳过**，一篇都转不了。

用户要求（2026-11-06）：

1. 打开日记本就能看见这些原生日记，不用先转换；
2. 转换必须由用户主动触发，转之前要弹窗说明「这些没有时间的会怎么处理」；
3. 整篇无头行的文件归到「日记」分类。

## 决策

### 1. 读路径降级：`parseDayFileForRead`（`src/diary/legacy.ts`）

在严格解析 `parseLegacyDayFile` 之上包一层；**严格解析本身不改**（写层继续用它）。

降级判据（三条全满足才降）：

| 判据 | 理由 |
|---|---|
| 一个 `HEADING_RE` 都没有 | 有头行（哪怕时间越界）说明用户想分段，写坏了就该进跳过报告让人修，不能把坏头行当正文吞掉 |
| 没有 bz 条目属性（`parseDiaryEntryFile().meta` 为空） | 带 `date` 属性却用日期命名的，是被改名的分片文件；降级会把 frontmatter 摊到墙上 |
| 整篇有正文（非全空白） | 全空白仍是空文件，不合成空条目 |

合成块：`time = diaryFallbackTime(ctime, date)`、`tags = ['日记']`、`body = 全文 trim`、
`line/endLine` = 首个/最后一个非空行（`jumpToDiaryEntry` 靠它定位），并置 `whole = true`。

读点接线：`data.ts::diarySlots` / `readDiarySlot`、`store.ts::listDateEntryRefs` /
`listEntryRefsForFile`、`store.ts::listDateEntries`（经 `withLegacyFile(..., { readOnly: true })`）。

### 2. 时间兜底：`diaryFallbackTime(ctimeMs, date)`

- **用 ctime，不用 mtime**：日记当天写下、之后常被反复编辑，mtime 会漂到深夜。
- **必须校验日期**：`ctime` 落在文件名那一天 → 取 `HH:mm`；否则 `00:00`。
  跨盘拷入 / 同步拉下来的 ctime 是拷贝时间，无条件采用会让整库时间集体漂移——
  这正是 ADR-0157 补记把 ctime 推导从日记侧清掉的原因。
- **与 ADR-0157 补记不冲突**：那条退役的是「无条件把 ctime 当时分」的口径（影视/信/书），
  这里是「带日期校验、只服务文件名即日期的 day 文件」的兜底，两条边界互不覆盖。

### 3. 写路径拒绝：`refuseHeadlessDay`

整篇无头行的文件**可以读、可以跳转，但 bz 不改它**：

- `addLegacyEntry`（追加当天日记）
- `readLegacyCtxInQueue`（写场景的守卫读，覆盖改标签 / 删块）

命中即 `warnUnparsed` 一句人话（「bz 不会改写它，要在这里写先把日记格式切成一篇一个文件」）
并抛 `UnparsedLineError`。

理由：追加一个 `# 📖 HH:mm` 块会把纯正文变成「游离正文 + 头行块」，属于**静默改写用户的原生文件**——
全项目最忌讳的一类副作用。要改就一键转换，之后是 bz 的地盘。

### 4. 转换：整篇一条 + 单独记账

`convertLegacyToEntries` 改用 `parseDayFileForRead`，于是无头行文件从「整份跳过」变成
「转成一条」；同时记进 `ConvertReport.inferred`（`path` + 用了哪个时分）。

设置页（`settings-format.ts`）：

- 点「一篇一个文件」确认前先扫一遍（`countNativeDayFiles`，`cachedRead`），
  有则在同一张确认框里加一句：「其中 N 篇是 Obsidian 原生日记……时间按文件创建时间补；
  文件创建时间不在这天的，记 00:00」。**不叠第二层弹窗**。
- 转换完的通知追加「其中 N 篇按文件创建时间补了时分」。

## 后果

- 原生日记开箱可见，且**读完不动原文**；不会因为「打开看了一眼」就产生任何写盘。
- 时间不精确的地方是**显式的**：要么来自文件名 + ctime 校验，要么是 `00:00`，不会编造。
- 转换不可逆的一点：转成条目后再转回 day（`convertEntriesToLegacy`）会写 `# emoji HH:mm` 头行，
  原文件不再是无头行形态。这是格式迁移的固有结果，不是缺陷。
- 已知未做：整篇无头行文件**不能**在 bz 里编辑（跳转回 Obsidian 原生编辑器改可以）。
  若将来要做，需要一套「写回时保持无头行」的序列化分支，不在本次范围。
