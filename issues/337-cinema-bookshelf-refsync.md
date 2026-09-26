# 337 · 影院×书架同步包：海报 rename 联动 / 抓取队列守卫 / 封面归属调查

- 状态：实现中（2026-09-16，用户对 issue 335 审计报告拍板「全部修复」；本工作树 = 审计#10/#11/#12 + coverPath 调查）
- 关联：issue 336（knowledge md-deleted 消费者——影院笔记删除后的知识卡 source 摘除由其统一承接，本域**不重复处理**）

## 改动设计

### 1. 影院笔记 frontmatter `海报` 纯路径 rename 联动（审计#11）
- `海报` 是纯路径非双链，Obsidian 改名不联动。新增 `vault:md-renamed` 消费
  （影院 index.ts 已有 md-deleted 消费先例 :59）：oldPath 命中任一影院笔记 `海报`
  值 → 行级/`processFrontMatter` 改写为新路径，防抖合并。

### 2. 豆瓣抓取队列存在性守卫（审计#12）
- douban-queue 内存态键=file.path：写回 frontmatter 前校验文件存在，
  已被删（含插件外删除）→ 静默出队，不再写失败。

### 3. 书目 `coverPath` 归属调查（审计#26）
- 查明 `coverPath` 由谁写入（weave 插件元数据还是书 md frontmatter）：
  - 若书 md frontmatter → 同 1 加 rename 联动（bookshelf）。
  - 若 weave 自有数据 → bz 不改他域数据，在「无封面/按标题回退」降级已覆盖的前提下
    记录结论即可（issue 内写明证据 file:line）。

## 测试

- 海报 rename 联动（renamed 事件 → frontmatter 更新；不命中不动）。
- 抓取队列：文件存在写回成功 / 文件缺失静默出队。
- 门禁：`pnpm exec tsc --noEmit` + vitest（preview-freshness 为并行会话既有红，排除；
  其余不得有新增失败）。严禁在 worktree 内 build。

## 不做

- 影视笔记删除的知识卡摘除（issue 336 统一承接，避免跨工作树重复实现）。
- diary/secondbrain/checkup（issue 339）。

## 调查结论（审计#26 · coverPath 归属）

**结论：EPUB `coverPath` 是 Weave 自有数据（非书 md frontmatter、非 bz 写入）→ 不加 rename 联动，仅记录。**

证据：

1. **读取点**：`src/bookshelf/data.ts:161-172` `resolveEpubCoverPath(app, meta)` 的 `coverPath` 读自参数 `meta`——即 weave-data.json 聚合的 `meta` 字段（`buildEpubItem` :191-223 消费 `aggregate?.meta`；聚合来自 `readWeaveAggregates` :241-255 读 `<weaveDataPath>/weave-data.json`，weave 插件 id `weave-epub-reader` 见 :15）。**数据文件是外部插件 Weave 的自有存储，不是书 md frontmatter。**
2. **来源口径**：`docs/adr/0013-library-epub-entries.md` 决策 1/2——「EPUB 数据从 Weave 阅读数据文件（weave-data.json）直读……bz 零推导直接消费」「title/author/**cover ← Weave**（cover 用封面输出目录文件或数据文件中的封面路径）」。
3. **md 书 `cover` 键**（`src/bookshelf/data.ts:76-79`，读书 md frontmatter）：bz 全库**无写入点**——精确搜写入形态（`fm.cover =` / `['cover'] =` / YAML `cover:` 输出）零命中；仅有读取（bookshelf/data.ts:76、diary/parser.ts:228）与体检（checkup/checks-orphans.ts:72-77 检封面文件存在性，建议文案即「请补回文件或清空笔记的 cover 字段」）。写入方在库外（Weave 导入流程/用户手工），非 bz。
4. **断链降级已有**（rename 后路径失效的场景）：EPUB 侧 `coverPath` 校验 `isVaultImageFile` 失败 → 按标题回退 `CONFIG/BOOK/EPUB COVER/<title>.<ext>`（data.ts:163-171）→ 全无返回 null；UI 侧 `coverUrl`（ui.ts:37-39）取不到文件返回 null → 无封面占位（shared.ts:100 `bz-bs-d-cover-ph`）；checkup 另有孤儿封面体检项（checks-orphans.ts:72-77）。

依 issue 拍板分支「是 weave 的 → bz 不改他域数据，记录结论即可」，bookshelf 侧零代码改动。

## 实现记录（2026-09-16）

- 海报 rename 联动：`src/cinema/data.ts` 新增 `findPosterRenameTargets`（metadataCache 扫影院目录 海报==oldPath，不依赖面板状态）；`src/cinema/index.ts` 新增 `registerPosterRenameSync`（`vault:md-renamed` 消费，300ms 防抖合并、保序回放防 A→B→C 连改名丢中间态，`processFrontMatter` 回调内复核只动 `海报` 键，无命中零写盘；unloadCinema 清理队列/定时器/注册位）。
- 抓取队列守卫：`src/cinema/douban-queue.ts` pump 写回前校验 `getAbstractFileByPath` 存在，缺失 → console.info + 清会话去重标记（对齐 G8/C10 同名重建可重抓）+ 静默出队，不记失败不发通知。
- bookshelf：零改动（见上调查结论）。
- 测试：`tests/cinema/poster-rename.test.ts`（命中改写且不动其余键 / 不命中零写盘 / 防抖合并保序）、`tests/cinema/douban-queue.test.ts` 增补（目标笔记缺失 → 静默出队零通知 + attempted 清除可重入队）。
