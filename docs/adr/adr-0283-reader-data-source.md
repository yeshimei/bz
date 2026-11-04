# ADR-0283：书库接入 bz 阅读数据源（bz-reader.json）

日期：2026-11-04 · 状态：已采纳

## 背景

bz 的书库（bookshelf 域）原先只有两类书目：书库目录下的 md 书笔记，与外部
Weave EPUB Reader 落盘的 `weave-data.json` 聚合（ADR-0013）。2026-11 新的独立
插件 **bz 阅读**（plugin id `bz-reader`，仓库 `D:\Obsidian\bz-reader`）上线，阅读数据
改由它自己落盘，书库看不到 bz 阅读里的书、进度与划线。

bz 阅读的存储约定（其 `src/core/plugin-path.ts` / `src/data/store.ts`，2026-11-04 定稿）：

- 业务数据：`<vault>/<dataDir>/bz-reader.json`（单 JSON，`books` 是**数组**）；
- `dataDir` 存在 `<configDir>/plugins/bz-reader/data.json` 的**顶层** `dataDir`
  （不是 `settings` 里），缺省 `bz-reader/storage`（2026-11-04 同日从旧默认「bz 阅读」
  改成库根容器 `bz-reader/storage`，其提交 68c8bdb「三个目录收进库根 bz-reader/」：
  `storage/` 业务数据、`books/` 导入的书、`notes/` 导出的书摘分开）；
- 封面 `<dataDir>/covers/<bookId>.<ext>`，`meta.coverPath` 已是 vault 相对路径；
- 蓝图字段契约见其 `src/data/schema.ts` 文件头（明确写了「bz 书库直接读」）。

**默认值改动只影响没写过 `dataDir` 的新用户**：老用户 data.json 里是显式的「bz 阅读」
（旧默认被持久化过），bz 阅读不会自动把数据迁到新默认，bz 侧也照旧读那份显式值——
`READER_DEFAULT_DATA_DIR` 只负责配置缺失/不可读时的兜底。

## 决策

1. **数据源与路径**：新增 `src/bookshelf/reader-source.ts`，经 `app.vault.adapter`
   直读插件配置取 `dataDir`，再读 `<dataDir>/bz-reader.json`。不读插件实例
   （`app.plugins.plugins['bz-reader']`）：插件被禁用时书库仍应显示书，且实例字段是
   内部实现。配置在 `.obsidian` 内、vault 文件树不可见，故必须走 adapter 直读。
2. **归一，不做第二套消费链**：读入后归一成 weave 聚合形状，上层
   （bookshelf / reading-report / home / recap）零改动只认一种。差异只收敛在
   `normalizeReaderAggregates`：
   - `books` 数组 → 聚合列表；`fileRef.vaultPath` → `file.vaultPath`；
   - `notes.highlights[].comment` → `commentText`、`createdAt` → `createdTime`
     （bz 读书笔记读 weave 口径字段）；
   - `stats.totalReadTime` 是**秒**（weave 是毫秒）→ ×1000；
   - `notes.excerpts` 是 highlights 的**全量镜像**（有无想法都写）→ 只保留
     `comment` 非空的条目，否则 bz 的 thinks（读 `excerpts.length`）会把划线数当想法数。
3. **合并去重**：`readEpubAggregates` 同时读两个源，同一 `vaultPath` 只留一条
   （否则书架出现两本同名书、两份进度）。取「最近活动」的一份
   （`lastReadTime` / `updatedAt` / `addedAt` 的最大值），并列时 bz 阅读优先
   （新通道，旧通道多半是迁移前残留）。来源记在 **WeakMap** 而非聚合对象上——
   weave 聚合会被整文件写回，多一个内部键就是把 `weave-data.json` 改花。
4. **跳转按来源分派**：weave 沿用 `path#weave-cfi=…` + `openLinkText`（Weave 注册了
   epub 处理器）；bz 阅读的书走 `obsidian://bz-reader?book=<id>&cfi=…&t=…&c=…`
   （与其 `data/deeplink.ts` 同格式）。bz 阅读**没有**注册 `.epub` 扩展名处理器，
   裸 `openLinkText` 会落到 Weave 或打不开，所以「继续读」（借书卡 `data-bs-d-continue`）
   与读书笔记双击跳原文都按源分派。
5. **写回按源分派**：编辑想法/删除划线先用与读取相同的规则定位源文件，再写对应
   文件与字段（weave：`commentText`；bz 阅读：`comment` + 同 id 的 excerpt 镜像）。
   写 bz-reader.json 时把 `book.updatedAt` 推进到当前时刻——bz 阅读的 `ReaderStore`
   写盘前按 `updatedAt` 合并外部修改，不推进会被它内存里的旧快照覆盖。
6. **自动刷新**：书库面板存续期间，`bz-reader.json` 的 vault create/modify/delete
   与 weave 走同一 300ms 防抖刷新通道。
7. **文档/文案**：体检「EPUB 文件不存在」按来源给不同的清理指引；设置页数据路径
   说明补 bz-reader.json，并标明其默认目录。

## 后果

- 只装 bz 阅读、没装 Weave 的库，书库墙、阅读报告、首页水位、年度回顾、体检孤儿项
  都能看到 bz 阅读的书与划线，无需再维护两套解析。
- 两个阅读器同时用过同一本 epub 时，只显示最近活动的那一份；另一份数据仍在盘上，
  不会被删除或改写（只读语义）。
- **边界（有意不做）**：
  - 小橘的「书库观察」（ADR-0034）仍只监听 `weave-data.json`——那是行为流的
    结构化 diff 源，接入 bz 阅读需要另建一份 diff 记账，超出本次范围；
  - 体检的 JSON 解析巡检清单（`checkup/files.ts` 的 `jsonScanTargets`）是同步签名，
    而 bz 阅读的数据目录要异步读插件配置才能确定，暂不加入（EPUB 路径缺失仍会报）；
  - bz 阅读导出的 Markdown（`tags: [书摘]`、`progress`/`exported` 键）不当作 bz 书库
    md 书——它是「某本书的划线笔记」，与书库 md 书的目录/tags 契约不同（ADR-0274 的
    目录闸门也不覆盖「书摘」目录）。
