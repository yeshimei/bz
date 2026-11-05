# ADR-0284：日记双存储格式（一篇一文件 / 一天一文件）与平级「分类」

- 状态：已采纳（2026-11）
- 涉及域：diary（主）/ core（daily-notes、path-classify、folder-setup）/ recap / home / encrypt / smartcat
- 关联：ADR-0130 / ADR-0131 / ADR-0017 / ADR-0245 / ADR-0274

## 背景

ADR-0130 把日记从「一天一文件多条目」迁到「一篇一文件」（`YYMMDDHHmm.md` + frontmatter）。
用户随后要求：

1. 日记本**也支持旧格式** `2026-03-14.md`（Obsidian 日记原生文件名），并提供两种格式互转；
2. 设置页「存储」提供两种存法让用户选，从一种切到另一种时弹窗确认「只切换 / 切换并转换」；
3. 「日记类型」改成**全部平级**的分类（不要二级标签），名称统一叫「分类」；
4. 默认只留极少数示例，旧版写死在代码里的 28 类要从默认值里拿出去；
5. 设置页隐藏「信件文件夹」；
6. 日记目录留空时跟随 Obsidian 日记本目录。

## 决策

1. **双格式并存**
   - `settings.diaryEntryFormat: 'entry' | 'day'`，缺省 `'entry'`（不破坏既有库）。
   - `entry`：一篇一个文件，原 ADR-0130/0131 契约不变。
   - `day`：`YYYY-MM-DD.md`，一条日记 = 文件里的一个 `# emoji序列 HH:mm` 块；写日记追加块，
     改分类只换块头，删除只摘块（文件空了才整文件进回收站）。
   - 读路径两种**同时认**（`diary/data.ts` + `diary/legacy.ts`）：旧文件按块拆候补，
     同一天同刻靠块头行号区分；墙、复盘、首页时间线、路径分类都吃两种格式。
2. **互转 `src/diary/convert.ts`**
   - 旧→新：逐日期文件拆块写条目文件；有游离正文/坏时间头行的文件整份跳过（绝不静默丢行）。
   - 新→旧：同一天的条目按时间合并；目标已存在则整日跳过（不硬合并）。
   - 成功的原文件进 Obsidian 回收站（ADR-0245），失败回滚本次目标写入；幂等可重跑。
   - 转换是用户显式触发的批量迁移，直接文件 IO 列入 D3 白名单；日常写仍走 `enqueueFileTask`。
3. **分类全部平级**
   - `settings.diaryTypes`（JSON，`DiaryTypeConfig[] = { tag, emoji }`），无 `subTags`。
   - 默认只有 3 个示例：日记 📖、随笔 ✍️、生活 🏠。
   - 旧版 28 类（含原「旅游」的四川/大理、「收藏」的 13 个子标签）在**老库升级时一次性迁移**：
     `migrateDiaryTypes` 只在 data.json 带日记键时写入，且已拍平；新装用户只看到 3 个示例。
   - `parseDiaryTypes` 兼容旧层级 JSON：子标签自动拍平成独立分类。
   - 层级辅助 `isSubTag` / `getParentPrimaryTag` / `getSubTagsOfPrimary` 保留导出但恒否/恒空。
4. **设置页**
   - 「存储」组 = custom 行（格式卡 + 切换确认 + 转换进度）；
   - 「分类」组 = custom 行（清单式：拖柄/emoji/名字/用量/上移下移/删除/添加），
     操作图标一律 lucide，分类图标仍是 emoji；
   - 「目录」组只留日记文件夹（信件行隐藏，`letterDirectory` 键与 `applyDirectories` 双键不变）。
   - 日记目录留空 → `core/daily-notes` 读 `internalPlugins.daily-notes.instance.options.folder`；
     bz 与 Obsidian 都没设才走「未配置」引导（`folderState` 认 `obsidian` 来源）。
5. **加密还原随格式**
   `diary/encrypt.ts` 在 day 格式下把还原块序列化成旧格式（emoji 头），
   `encrypt/data.ts` 的 merge 落到当天日期文件；entry 格式维持原 v2 标签名块。

## 后果

- 同一日记目录可同时存在两种格式（转换中途/手放），开册全序正确；只有**新写的**按当前设置。
- 「分类」取代「主标签/二级标签」：写日记弹窗按配置顺序平铺全部分类（「加密」不进新建弹窗）。
- 小橘记忆/观察仍只认条目文件（day 格式下不产记忆），属已知派生缺口，另票处理。
- 设置项数 6 → 7（sp-contract-lock 基准同步）；旧测试夹具改为显式注入 `LEGACY_DIARY_TYPES`。

## 补记（2026-11-05）：day 文件名跟随 Obsidian 日期格式、缺省改 day、目录跟随扩到全局设置

用户看设置页截图后提了三条：

1. 图一「日记文件夹」：默认跟随 Obsidian 日记里**新笔记的存放位置**，没有就留空；
2. 图二：存储卡片默认选中「一天一个文件」；
3. 图三：day 卡片的示例文件名，要按 Obsidian 日记的**日期格式**显示。

### 决策

1. **目录跟随补全**（`core/daily-notes.ts`）
   - 仍先读日记插件自己的 `options.folder`；
   - 它为空时再读 Obsidian 全局「新笔记的存放位置」（`vault.getConfig('newFileLocation')`）：
     选「指定文件夹」→ `newFileFolderPath`；根目录/当前文件夹 → 空串（库根）。
   - 两边都没有：设置面板里保持留空（不自动填值），域主界面走「未配置」引导；
     运行时 `DIARY_DIRECTORY` 仍保留 `我的/日记` 作内部兜底（写入口已被引导挡住，用户看不到）。
2. **缺省格式改 `day`**
   - `DEFAULT_SETTINGS.diaryEntryFormat = 'day'`，`applyDirectories` 只认显式 `'entry'`。
   - 老库迁移 `migrateDiaryEntryFormatDefault`：`data.json` 没有该键且有日记痕迹 → 补写 `'entry'`，
     保住「盘上全是 YYMMDDHHmm.md」的库；真新装不写，走新缺省。
3. **day 文件名按 Obsidian 日期格式**（`core/diary-format.ts`）
   - 生成：`diaryDayStamp(date, format)` / `diaryDayFilePath(dir, date)`，`format` 取
     `obsidianDailyNotesFormat()`（缺省 `YYYY-MM-DD`）。格式含 `/` 时落子目录（如 `2026/06/13.md`）。
   - 反解：`diaryDayDateFromPath(path, dir, formats)` 按**当前格式 + 内置四种**逐个
     `moment(stamp, format, true)` 严格解析并做往返校验（宽松写法 `2026-6-3` 不认）。
     内置四种 = Obsidian 下拉里的 `YYYY-MM-DD` / `YYYY.MM.DD` / `YYYY/MM/DD` / `YYYY/MM/YYYY-MM-DD`，
     保证换格式后旧文件仍读得出来。
   - 消费面全换：`diary/{store,data,convert,legacy,settings-format,settings-types,repair,encrypt}`、
     `encrypt/data`、`home/timeline-collect`、`recap/aggregate`、`core/path-classify`。
     `parseLegacyDayFile` 增加可选 `date` 参数（路径不再只靠 basename 判日期）。
   - 设置卡片与切换确认框的样例文件名都走同一个 `formatSample()`（`2026-06-13` 按当前格式格式化）。
4. **加密还原随当前目录 + 当前格式**：历史清单里的 day 路径用「路径自己的父目录」反解日期
   （`diaryDayDateFromOwnPath`），落点再按当前目录/格式重算。

### 代价与边界

- day 格式的「一天」现在可能是多级目录（`YYYY/MM/DD`）；`collectMdPaths`/`ensureFolderFor` 已递归/逐级建目录。
- 换 Obsidian 日期格式后，**旧格式文件仍按内置四种读**；不在四种里的自定义旧格式读不到（用户可在
  Obsidian 里改回或手动改名）——不做自动迁移，避免动用户的文件名。
- `YYYY/MM/YYYY-MM-DD` 这类格式的文件名跨目录，`parseLegacyDayFile` 必须由调用方传 `date`；
  只给 basename 的旧入口仍按 `YYYY-MM-DD` 兜底。

