# ADR-0082：剪藏本×聚合讯融合为 clipbook 域（桌面三栏 + 移动双屏）

- 状态：采纳
- 日期：2026-09-03
- 关联：issue 177；.zcode/ui-prototypes/clipping-prototypes/clipping-p3-siteboxes.html；ADR-0060/ADR-0063/ADR-0064/ADR-0068/ADR-0080/ADR-0081

## 背景

聚合讯（news）与剪藏本（clipping）语义上是同一条「读→存」链的两半，但落在两个弹窗、两套入口、两种数据模型：news 面板逐篇处理 news.json 条目（保存→写剪藏笔记）；clipping 面板纯扫剪藏目录 .md。用户拍板融合成单一「剪藏本」三栏工作台（原型 P3 可交互版），要求聚合讯未读自动进收件流、一键「保存到剪藏本」转正式剪藏、全程无窗口跳转。旧域保留并存、交付后可能删除。

## 决策

### 1. 命名

- 目录 `src/clipbook/`，类前缀 `.bz-clip-*`，文件 `clipbook.json`。
- 新命令 `bz-clipbook-open`「剪藏本」（icon scissors）替换旧 `bz-clipping-open`/`bz-news-open` 两命令（旧域 index 不再导出 open，避免重复挂 DOM；main.ts 不注册旧命令）。
- 中文显示名仍叫「剪藏本」（入口页磁贴命令名同步）。

### 2. 数据模型

news.json **不新增段**（外部守护进程写 articles/bilibiliUps/bilibiliUpInfo/bilibiliMaxItems/bilibiliCookie/sources，插件只写状态——双写者并发防护沿用整段读改写）。clipbook.json 为插件侧写：

```ts
interface ClipbookData {
  articleOverrides: Record<string, { reading?: boolean }>;  // 键 = url|title+date 稳定标识（news/data.ts articleKeyOf）
  savedArchive: Array<{ url: string; title: string; savedAt: string }>; // news.json 已删但目录仍留的已保存残留
  order: string[];  // 「全部未读」用户拖序（本票不做拖拽，段保留空）
}
```

阅读视图条目不落盘，由 `clipArticle(a, overrides, clipPaths)` 纯函数裁剪派生：id=稳定标识、st ∈ unread/reading/read/saved（saved = news 标记 saved 或侧写归档命中；url 命中剪藏目录 → 保底 saved——「保存过就是剪藏」语义）。**news 的 read=true 且 state=saved/skipped 骨架不出现在任何源收件流**（含已读源计数只计未处理）。

### 3. 状态与保存闭环（旧 news 行为保留，迁入 clipbook）

- reading/saved 落侧写 articleOverrides/archive；read 只落 news.json read=true+state 骨架 + stats（删 body，保留策略沿用）。
- 「保存到剪藏本」：写 `归档/网页剪藏/<cleanTitle>.md`（frontmatter url/author/site/summary/tags/date/created + dataviewjs 摘要块，迁自 news/reader.ts saveToClip），并发 `news:read/saved` 域事件（smartcat 行为流三跳依赖）+ 目录文件事件增量刷左栏剪藏计数。B站视频条目保存分流文献盒（ADR-0068）。
- news.json 状态写回走串行队列 + mergeWithDisk 双写者合并 + 迁移旧 news-stats.json（函数迁入/复用 news/data.ts）。
- 右栏阅读器沿用聚合讯逐篇正文（body 未删才可读；已删条目不进流），累计阅读时长统计（对齐 ticket 076 openedAt/accumMs 语义）由行为流事件承载。

### 4. UI（对齐拍板原型 + 组件库铁律 6）

- 新 UI 一律消费组件库（`core/ui` 工厂 + `--bz-*` token + `.bz-*` 类），域 styles.css 只写 .bz-clip-* 独有布局；主面板 = cinema 同款自绘 overlay + uiModal 系（**非**旧 createMaskAndPopup 内联 cssText）。不做新共享组件；右键菜单复用 core/item-actions（.bz-item-card 挂载）——菜单视觉跟随旧体系变量可接受。
- 桌面 1280×800 三栏：左 rail 236（源列表滚动 + 底部「阅读分析数据」→ 打开 bz-reading-report-open，无右上图标）；中 364（标题+两行摘要+状态点）；右阅读。剪藏条目右键 = 打开笔记/复制双链/复制原文链接/删除；news 条目右键 = 保存到剪藏本/移出/标记已读/在读/查看原文/删除。
- 移动端 375 双屏（isMobileEnv 分支同 settings-panel）：屏1 源胶囊横滑 + 列表；屏2 详情 + 头栏保存钮（保存↔移出切换，绿=已保存）。真全屏跟随移动端默认全屏键。
- 源列表 = 全部未读（news 未处理，unread 徽标）+ 三平台（知乎日报/果壳科学人/B站，仅未处理计数）+ B站按 UP 展开（upInfo 名字回填，avatar 渲染）+ 剪藏本（扫目录全部，read 骨架不进）。
- 阅读中「在读」状态点：news 条目行内色点琥珀 + 阅读时长行为流。

### 5. 设置（settings-panel 域清单 + 声明式 schema）

- `clipbookSettingsSchema()`：基础（剪藏目录 path 绑 articleDirectory / 批次 articleBatchSize）+ 数据源组（迁 news-sources-group 内容 + retention 行；news.json 缺失引导）+ 自动摘要组（原 clipping 智能组，改 autoSummaryEnabled 触发）+ 移动端组（clipbookMobileDefaultFullscreen）。
- settings.ts 加 `clipbookMobileDefaultFullscreen: true`（对齐 clipping 现有默认开）；articleDirectory/articleBatchSize/autoSummary* 键沿用。
- settings-panel DOMAINS：新增 clipbook 域；clipping 条目改接 clipbook（保留「剪藏本」名与 newspaper 图标）；news 条目删除（设置并入 clipbook）。auto-summary 保留独立。

### 6. 迁移与并存

- 新域复制（逐字移植 + 适配）：clipping view 的 parseArticleFile/卡片/站点徽标/反链/item-actions/删除确认/目录文件事件四通道；news 的 loadAll 保留清理/mergeWithDisk/saveToClip/UP 名单数据操作（source-settings）/行为流事件。
- **旧域 src/news、src/clipping 本票保留原样不动**（并存可回退；删除另开票）。news 的面板不再可达（无命令入口），其 data.ts 纯函数由新域 import 复用；clipping view 同理不再挂载，但 tests/ 旧测试保留仍绿。

### 7. 验证

pnpm test + tsc --noEmit 全绿 + 主仓 build 直出部署 + PROGRESS 条目；worktree 开发禁止 build。

## 备选

- 不融合、两域各加入口互跳 —— 违背「流程一致不割裂」诉求，否。
- 数据整体迁新文件弃 news.json —— 破坏外部守护进程写契约，否。
- 直接在旧域内三栏改造 —— 与 movie→cinema「新域重设计、旧域待删」先例一致地选新域，便于回退与测试隔离。
