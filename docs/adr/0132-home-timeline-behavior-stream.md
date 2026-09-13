# 0132 — 首页时间线改吃小橘行为流（推翻 issue 288 的「吃不到」前提）

## Context

首页时间线数据源是 `collectRecap` 文件统计聚合（recap）：影院痕迹用「观影日期=今天→已看（ts=mtime）/ 无观影日期且 ctime=今天→加入片单」的推导口径。2026-09-13 会话批量回填影院笔记 frontmatter（441+ 文件）期间，用户在时间线看到「创建几十条电影」的误报——文件推导口径对外部工具改动天然脆弱（ctime/mtime 在同步、迁移、批量编辑下都不可信）。排查同时确认：行为流（smartcat-behavior.json）对此完全免疫（只由插件内动作埋点写入），本次批量改写在其数据里零残留。

历史上时间线从未接过行为流（git 全历史无引用）；issue 288（2026-09-11）删「已跳过」开关的拍板理由正是「数据源在 smartcat 行为流、首页时间线吃不到」。

用户拍板（2026-09-13）：**时间线数据源整体替换为小橘行为流**；行为流没覆盖的动作（读书进度、日记连击等）宁缺勿假、不做 recap 混合；「已跳过」借机回归为内容过滤第四项（默认关）。

## 决策

- **时间线痕迹源替换**：`collectRiver` 的时间线 items 不再用 recap items，改为读取 `CONFIG/STORAGE/smartcat-behavior.json`（只读契约：探测存在再读，缺失/损坏回落空）+ 纯函数映射 `src/home/behavior-timeline.ts`（`readBehaviorItems` → `behaviorToDays`）。7 天窗口、按本地日分桶的既有结构不变。
- **source → 首页域 id 归一**：`RiverEvent.domain` 存**首页域 id**（行为流 source 经 `behaviorSourceDomain` 映射）——渲染徽标（图标/色/名）与彩点 `hasEvent` 都按首页域 id 取值，直接用 source 会出现「movie 无图标、空名徽标」。表：movie→cinema、news→clipping、knowledge/literature/bili-downloader→knowledge（后两者是知识盒旧域名存量来源，语义同 smartcat/dashboard 的来源标签表）、favorites/review/diary/pomodoro/belongings/library→同名（library→bookshelf）；未收录来源原样透传（渲染回落显示源名）。
- **无名条目**：`review:started` 事件不带 name（coverage-source 只发 `{review, started}`）→ 在无名守卫之前单独成条（「开始复习」）；其余动作无名即剔除（避免出现「已跳过『』」这类空壳文案）。
- **动作映射表**（11 源实测盘点后，宁缺勿假）：
  - movie：want→「《X》加入片单」（状态推进）；watching→「开始看《X》」（状态推进）；watched→「标记《X》已看」（产出）；rated→「评价《X》 ★N」（点评 ✦，N 取 metadata.rating）；deleted→不进时间线
  - news：saved→「收藏文章『X』」（产出）；skipped→「已跳过『X』」（**已跳过类**，111 条量级大故默认关）
  - memo：added→「新增备忘录『X』」（状态推进，保留前缀以维持 memoCreated 派生）；completed→「完成『X』」（产出）；edited/deleted/priority/restored→不进
  - knowledge/literature：term-generated→「生成术语『X』」（产出）；converted→「转化『X』」（产出）
  - favorites：added→「收藏站点『X』」（产出）；archived/unarchived/deleted→不进
  - bili-downloader：added→「添加下载『X』」（状态推进）；converted→「下载完成『X』」（产出）
  - review：started→「开始复习」（产出）
  - diary（只有 deleted）/flash/chat：无有效动作，不进时间线（日记连击计数维持 recap 口径不受影响）
- **内容过滤组扩第四项**：TimelineFilter + `skipped`（TIMELINE_KIND_LABEL「已跳过」），设置键 `homeTimelineSkipped`（默认 false，维持现显示量；设置行题名「跳过痕迹」——题名 4-8 字规范，组内与「产出动作/状态推进」同构）；过滤从 timelineKind(text) 前缀判类改为**事件直带 kind**（行为流映射时定死；`eventKind` 保留旧形态回落，`eventVisible` 是过滤判据单源，采集层与渲染层共用）。produce/progress/notes 三项过滤语义不变；「点评 ✦」类现含行为流的星级评价（movie:rated），设置行描述同步覆盖。
- **recap 保留的职责**：入口计数（cinemaWant/cinemaWatching 等）、周历 hit、日记连击、今日摘要 summary 照旧由 collectRecap 提供——只换痕迹流，不动计数面。
- **recap 影院 ctime 推导分支的定位**：时间线不再消费后，该分支只剩 recap 自身的今日摘要（movies 计数）在用；外部改动误报的风险面收敛到摘要计数（影响小），不再单独处理。

## Consequences

- 时间线对外部文件改动（批量编辑/同步/迁移）免疫——本次事故整类根除。
- 行为流滚动窗口（30 天/1000 条）成为时间线的自然边界：超窗动作自然消失，与「最近 N 天」语义吻合。
- 读书「读到 N%」、日记「新增 N 条」、番茄钟「专注 N 分钟」从时间线消失（行为流无对应埋点）——宁缺勿假拍板接受；将来要恢复须先在各域埋点。
- issue 288 的「已跳过吃不到」前提被推翻并回写：第四类恢复，默认关。
- 行为流 description 与 metadata.name 双取名称（metadata 缺失时从 description 剥 `src:type ` 前缀）；两者都空且不在无名白名单（review:started）的动作直接剔除。
- reviewer 注记：本条与日记条目文件格式的 ADR 撞过号（并行会话同占 304/0130）——按「先占号者保留」原则，本条重编号为 issue 305 / ADR-0132。
