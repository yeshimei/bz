# ADR-0298 · 书库只由 bz Reader 供书，并按真实格式标识书目

日期：2026-11-12 · 状态：已采纳 · 关联：ADR-0283（EPUB 条目数据源收敛到 bz 阅读）、ADR-0099（分类 subjects 通道）、ADR-0104（渲染纯层单源）

## 背景

书库自 ADR-0283 起，EPUB 条目读 `bz-reader.json`，但**墙上是两套书并存**：`书库/` 目录里带 `book` 标签的 md 书 + bz 阅读的 EPUB。同时 bz Reader 这几版已经从「只能读 EPUB」长成支持 epub / txt / mobi / azw3 / fb2 / cbz / pdf 七种格式的阅读器。

两个问题：

1. **同一本书两处维护**。用户既要按老口径往 `书库/` 放书笔记、写 frontmatter，又要在 bz Reader 里导入同一批文件，书目、进度、划线各记一份，两边的数字迟早对不上；分类、时长这类字段更是要手填一遍。
2. **格式被写死成 EPUB**。借书卡副标题恒写 `· EPUB`、条目字段叫 `isEpub`、墙属性叫 `data-bs-epub`——PDF 进来一律显示成 EPUB（2026-11-12 用户报：「它会把 PDF 识别成 epub，好像只会识别 epub」）。真值其实一直在数据里：bz Reader 的每条书目记录都有 `fileRef.format`（其 `data/schema.ts` 的 `BookFormat`）。

## 决策

1. **墙上只放 bz Reader 供的书**。`rebuildItems` 只并入阅读器聚合，md 书不再上墙；设置页「目录 → 书库文件夹」整组退役（键留在 data.json，不读不写不删）。md 解析函数（`resolveFolderPath` / `scanMarkdownBooks` / `parseBookFile`）保留：阅读报告之外，日记「读毕书目」等跨域仍读存量 md 书，零迁移。
2. **阅读报告与墙同源**。只统计 bz Reader 里的书，不再把 md 书与 EPUB 合并——报告与墙必须同一份分母，否则「墙上 12 本、报告算 47 本」。
3. **0 本时给引导页，并解释旧书去哪了**。未装 / 半装 → 卡片 + 内置安装按钮（走 `core/reader-install` 的 GitHub 主源 / 码云备源，不引导去商店）；已装 0 本 → 打开书架导入。本机还有按老口径收录的 md 书时，**必须**多一句「这版起不再上墙，用 bz Reader 导入同一批文件后会自动回到这里」——不加这句，老用户看到 0 册只会以为书单丢了。
4. **格式以 `fileRef.format` 为准**，缺该字段的老数据回落到文件后缀，两者都没有才按 `epub` 兜底（历史上唯一在册的格式）。字段随之正名：`isEpub` → `fromReader`（语义是「来自阅读器」），新增 `bookFormat`（小写键，展示层查 `BOOK_FORMAT_LABEL`）。`data-bs-epub` → `data-bs-reader`（读侧 `dataset.bsReader`，动效与点击派发都要同步，2026-11-12 发版时漏了这一处，靠 ui 测试抓回）。
5. **打开方式不分格式**：只要是阅读器供的书，一律走 `obsidian://bz-reader?book=` 深链——阅读器没注册这些扩展名，`openLinkText` 打不开。
6. **引导页视觉跟着皮肤走**。色阶由「墨色混纸色」派生（`color-mix` + `--bsw-ink` / `--bsw-paper`），不写死深褐：深色皮肤的纸是黑的，写死就糊成一片。

## 代价与边界

- 只有 md 书的老用户，这一版书库会空。缓解是第 3 条的说明文案，不做自动迁移（md 笔记与书文件不是同一件东西，猜着合并会把书目搞脏）。
- `书库/` 目录仍被日记、报告以外的旧链路读着，**不能删**；`bookshelfFolderPath` 键也不能跟着清，删了会连带影响回落链。
- 格式只做展示，不参与任何分支判断：能不能打开、怎么排版都由 bz Reader 决定，bz 不复制一份判断逻辑。
