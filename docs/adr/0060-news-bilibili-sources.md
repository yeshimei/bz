# 0060 聚合讯数据源扩展：B 站 UP 主聚合 + news.json 四段结构

用户直接拍板（2026-08-27，grill-with-docs 两轮盘问 + 两轮补问定案 Q1-Q18；本 ADR 即「兼容性冻结」的用户豁免记录）：聚合讯数据源从果壳+知乎扩展到 **B 站 UP 主视频投稿**，剪藏本设置面板新建「数据源」组，且 **news.json 从纯数组升级为四段对象结构**（`articles/stats/bilibiliUps/sources`），news-stats.json 并入 news.json。

## Context

- 既有面（ADR-0008）：抓取逻辑全部在外部守护进程 `@jwbz/obsidian-news`（tools/news-watcher/），bz 插件只读 `CONFIG/STORAGE/news.json` 渲染阅读流；rc 配置唯一键为 vaultPath。
- 冲突点：用户要聚合「我感兴趣的 B 站 UP 主」——名单维护在**插件设置页**（拍板），抓取仍在 watcher（ADR-0008 边界不动）。名单必须跨进程消费：插件写、watcher 读 → 名单只能落在 watcher 可读的文件（news.json 同库内）。
- 二次冲突：news.json 当前是纯数组（article 列表）；要承载 stats / UP 名单 / 源开关，必须升级为对象结构 → 触碰铁律 1「数据格式冻结」。

## Decision

### 1. news.json 四段结构（冻结豁免项）

```json
{
  "articles": [ /* 原纯数组内容，零键变更 */ ],
  "stats": { "totalRead": 0, "totalSaved": 0, "totalSkipped": 0, "byPlatform": {}, "byDate": {} },
  "bilibiliUps": [ "546195" ],
  "sources": { "zhihu": true, "guokr": true, "bilibili": true }
}
```

- **迁移只做读取侧自动包裹**：读到纯数组 → 裹成 `{ articles, stats: 默认, bilibiliUps: [], sources: 全开 }` 写回；news-stats.json 存在且 stats 段缺失 → 并入 stats 段，之后不再读写 news-stats.json（旧文件保留不动，防误删）。
- **article 条目键零变更**，仅新增可选 `state: 'saved'|'skipped'` 字段（保留策略档位依据；旧数据无字段 → 按 skipped 档，保守）。
- 双写者合并按四段整读写：读盘 → 改本域段 → 写回，保留非本域段（watcher 追加 articles 时不动 stats/bilibiliUps/sources；插件写 stats/名单时不动 articles）。

### 2. 剪藏本设置面板「数据源」组

- 检测信号：vault 内 `CONFIG/STORAGE/news.json` 存在（不跨进程探测，移动端可用）。
- 存在 → 设置项：三源独立开关（落 news.json.sources）、B 站 UP 名单（仅 uid，粘贴主页/视频链接自动解析添加、可删除）、保留天数两项、只读状态行。
- 缺失 → 引导块（obsidian-news 安装/启动说明 + 复制命令），设置项隐藏。

### 3. 保留策略（插件侧，打开阅读器时清理一次）

- 未读（read 非 true）永不处理；
- 已保存骨架（state='saved'）超 `newsRetentionSavedDays`（默认 3）天删除；
- 已跳过骨架（state='skipped' 或旧数据无 state）超 `newsRetentionSkippedDays`（默认 7）天删除；
- 起算 = `fetchedAt ?? date`；超龄直接删，不做降级保留标题。

### 4. B 站抓取（watcher 侧，ADR-0008 边界不动）

- Cookie 引导：每轮先 GET `https://www.bilibili.com/` 收集 Cookie（buvid3），规避未登录 API 风控（实测 412 → Cookie 引导后 200）；
- 动态接口：`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=<uid>&timezone_offset=-480`，未登录可读；
- 仅收 `DYNAMIC_TYPE_AV`（视频投稿），24h 滚动窗口（pub_ts 过滤 + has_more 翻页直到越过边界，Q5）；
- 条目映射：platform='B站'、title=archive.title、url=`https://www.bilibili.com/video/<bvid>`、author=module_author.name、date=pub_ts 格式化、body=简介（module_desc.desc 若有）+ 封面 `![](cover)` + 播放链接；
- watcher 读 news.json 的 sources/bilibiliUps 决定抓取集合；rc 仍只指定 vaultPath（用户拍板「news-watcher 只指定 obsidian 库的路径」）。

### 5. 自动摘要详设（智能组，开关打开后展开）

- 摘要长度档位（autoSummaryLength：simple/standard/detailed，默认 standard，映射 summary 字数要求与 max_tokens）；
- 标签生成开关与数量（autoSummaryTagsEnabled + autoSummaryTagCount，默认开 3-6 个）；
- 摘要时机（autoSummaryTiming：immediate 默认=create+file-open 双监听 / lazy=仅 file-open 打开时补全）；
- AI 配置仍走主设置页 core AI（ADR-0052 不重复）。

## Considered Options

- **名单放独立文件（bilibili-up.json）**：否决——用户「所有数据都放到这里面」拍板，四段合一降低双写者跨文件一致性问题。
- **名单放 data.json（插件配置）**：否决——watcher（外部进程）读不到插件私有配置路径，跨进程契约必须落在库内共享文件。
- **watcher 侧清理**：否决——保留策略设置项在插件侧（数据源组），插件侧清理闭环，不依赖 watcher 版本（Q11）。
- **24h 窗口 vs 每 UP 主最近 N 条**：用户拍板沿用 24h 滚动窗口（Q5）——与现有源窗口语义一致，深夜发布不丢；B 站动态翻页补充覆盖。
- **旧数据保留语义**：已读无 state → 按 skipped（7 天）档，取保守档避免误删已保存记录。

## Consequences

- news.json 数据格式变更（冻结豁免），旧纯数组自动迁移，已读标记/统计不破坏；
- watcher 需发新版支持四段读写 + B 站源 + sources 开关（发布门禁 checklist 照旧）；
- 剪藏本设置弹窗新增「数据源」组与自动摘要详设（分组卡片徽标计数自动回填）；
- 阅读流 platform-pill 显示「B站」+ site 图标映射 bilibili.com；
- CONTEXT.md 新增「数据源开关」「UP 主名单」「保留策略」「摘要时机」词条并同步「聚合讯/数据源守护」；
- 测试：news 迁移/保留策略/uid 解析纯函数、剪藏设置弹窗两条路径、watcher node --check + B 站映射纯函数。