# 每日简报（B 站 UP 视频 字幕/转写 → AI 要点）

背景：剪藏本需要一个「每日简报」源——盯住指定的 B 站 UP 主，每天把其新投稿变成要点列表供快速扫读。首个对象为**黑鸦Heya**（mid `3706929260006322`，5.2 万粉，AI 日报类短视频，实测时长 28 秒 – 2 分 53 秒，一天多条）。

需求评估期实测（2026-09-10）：
- **该 UP 抽样 6 条视频的 B 站字幕接口全部为空**（`x/player/v2` → `subtitle.subtitles` 为 `[]`）→「有字幕取字幕」对其不成立，内容获取必须落到「音频 → 转写」；
- **官方「AI 视频总结」接口未登录返回 `-101`**（`x/web-interface/view/conclusion/get` 需 wbi 签名 + 登录态），覆盖面不稳定，不作为主链路；
- `tools/bili-downloader/` 已具备 wbi 签名、playurl 多 CDN 下载、ffmpeg 抽音频与 faster-whisper 转写（本机 Python312 已装 faster-whisper 1.2.1，`~/.bilibili-dl.json` 的 pythonPath 已指向它），并已有「CLI 出转录稿 → 插件生成内容」的成型协议（ADR-0011 去 AI 化 / ticket 147 文献盒先例）；
- 既有 `归档/BILIBILI AI 视频总结/` 的 47 篇外部工具产物，其 frontmatter（category/title/desc/summary/url/bvid/cid/mid/pic/pubdate/duration/up_name/up_face）与分段时间轴格式**不作为本功能的产出格式**（用户选定「要点列表」且「不产 .md」）。

## 拍板要点

1. **能力落在 bili-downloader，不落 news-watcher**。bili-dl 新增 brief 模式（吃 UP mid → 拉空间投稿列表 → 逐条「字幕优先、无字幕下载音频转写」），沿用 `[bz-step]`/`[bz-p]`/`[bz-info]`/`[bz-result]` 行协议。**news-watcher 只当调度器**：在现有 30 分钟抓取轮里把「每日简报名单」UP 一并抓（同一份动态请求，条目**不入 articles**），发现新 bvid 就 spawn bili-dl。**AI 与落盘归插件**，守住 ADR-0011「工具不调 AI」与文献盒的既有分工。
2. **字幕优先，无字幕转写**。字幕链路为将来别的 UP 留余量；对黑鸦Heya 实际走转写分支。
3. **数据进 news.json，新增两段**：`briefUps`（每日简报名单，uid 数组，插件侧写，与 `bilibiliUps` 并列）与 `briefs`（简报条目，一条视频一条记录）。**转写稿不进 news.json，只放要点**。
4. **不产 vault 笔记**：每日简报的自动产出不写 .md（区别于既有 `归档/BILIBILI AI 视频总结/`），纯数据文件驱动 UI。
5. **剪藏本新增 rail 源「每日简报」**，与 news 流**分开成目**；目录内**按天分节**（日期分节头 + 当日条数），条目**参与现有状态机**（unread 蓝 / reading 琥珀 / read 空心 / saved 绿）。
6. **阅读区形态**：要点分节（小节 + bullets）+ 顶部「打开原视频」与视频元信息（时长/发布时间）+ **可展开的完整转录稿**（自 bili-dl 缓存读）。
7. **要点形态 = 按视频分节、每节一组要点**（明确不要分段时间轴，区别于既有 47 篇结构）。
8. **范围与去重**：首次启用回溯最近 10 条（对齐 `bilibiliMaxItems` 口径），此后只跑新 bvid；已总结过的永久不重跑；**每日简报名单与普通 B 站源互斥**（同一视频不在两处重复出现）。
9. **转写底稿走 bili-dl 现有缓存**（`cacheDir` + `cacheRetentionDays`，默认 7 天）自然过期，不在 vault 建隐藏目录。
10. **首轮批量分轮消化**：单轮 spawn 上限 3 条，避免长时间占住抓取轮。守护 30 分钟一轮，首次回溯 10 条约 1.5 小时补齐。
11. **失败可见**：风控（-352/412）、转写失败、模型加载失败在「每日简报」源里留一条**可见错误条目**（含原因与重跑入口），不静默吞。
12. **通用化**：数据与代码不写死 mid；UI 复用「UP 主名单管理」弹窗，加「每日简报」子列表 + 逐条开关。
13. **保留口径**：**沿用现有保留策略**（未读永不清理；已读/已保存骨架超 `newsRetentionUnsavedDays` 默认 30 天删除），与 articles 段同口径，复用同一套清理与渲染代码。
14. **保存动作保留**：简报条目仍可「保存到剪藏本」，但**写进专属目录**（默认 `归档/每日简报/`，新增一个目录设置项），不与 `归档/网页剪藏/` 混。

## Considered Options

- **全塞 news-watcher**（守护内直接转写 + 调 LLM）：违背 ADR-0011「工具去 AI」，且要在 CLI/rc 里再配一份 AI key——否
- **新建独立数据文件 `daily-brief.json`**（守护写 raw 段、插件写 brief 段，或转录稿走暂存队列）：用户拍板「放 news.json 中」——否
- **简报条目写进 articles 段**（与普通资讯同池）：破坏 ADR-0082「articles 段由守护写、插件只写 stats/read/state」契约，且会混入「全部未读」——否，改新增 `briefs` 段
- **复用 `归档/BILIBILI AI 视频总结/` 产 .md 并对齐其格式（含分段时间轴）**：用户明确「不进 obsidian 仓库、只存数据文件」且选定「要点列表」——否
- **按天聚合成一条「当日资讯」**：用户拍板「不聚合，每条视频一条记录」——否
- **官方「AI 视频总结」优先**（需配登录态 Cookie）：覆盖面不稳定，且用户已定「字幕 → 转写」链路——否（保留为将来可选降级分支）
- **转写塞进 news-watcher watch 主循环**：单轮被重活占住，且 PM2 watch 开着（插件每次构建都重启守护，实测已重启 4508 次）会打断长任务——否
- **新建独立工具 `tools/bili-brief`**：B 站签名 / Cookie / 动态抓取代码要再写一份或抽公共库——否，扩展 bili-dl
- **简报条目永久保留 / 另设保留期**：口径分裂，需另写清理逻辑——否，沿用现有保留策略

## Consequences

- **news.json 段契约扩张**：ADR-0082 的「articles 由守护写、插件只写 stats/read/state」扩为——`articles` 守护写；`briefUps`/`briefs` 插件写、守护只读（用于调度）；其余段权属不变。双写者仍需段级合并（`news-data.ts` 已有合并写回先例）。
- **bili-dl 首次实现「字幕优先」链路**（当前只有转写，无字幕解析）：需新增 `x/player/v2` 字幕拉取 + `subtitle_url` JSON 解析 + 多 P 遍历。
- **bili-dl 首次实现「UP 投稿列表」能力**：当前只吃 url/bvid，需新增空间投稿列表抓取（wbi 签名 + Cookie 复用 `~/.bilibili-cookies.json`）。
- **「可展开转录稿」受缓存保留期约束**（默认 7 天），过期后核原文能力消失；若要长期留存需后续在 `briefs` 条目加 `transcript` 字段——**本期不做**。
- **依赖前置修复**：守护当前 B 站源被风控拦住（`-352/412`，实际抓不到任何动态），而 `~/.bilibili-cookies.json` 存有可用登录 Cookie（含 SESSDATA）。需把它接到守护能读到的地方（写入 news.json `bilibiliCookie` 段，或让守护直接读该 rc 文件）。
- **PM2 watch 建议关闭**：现配置 `watch & reload: ✔` 导致插件每次构建都重启守护，会打断 brief 转写长任务。
- **新增设置项**：简报保存目录（默认 `归档/每日简报/`）。
- 实现与验收细节见 `issues/263-daily-brief.md`。
