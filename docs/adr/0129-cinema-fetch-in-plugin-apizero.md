# 0129 — 影院豆瓣抓取迁入插件（字段走 ApiZero，海报走豆瓣）

## Context

影院海报/豆瓣信息抓取经 ADR-0006（外部化）→ ADR-0113（守护退役、插件 spawn 系统 Node CLI 直调）→ issue 256 修订（spawn 三连败：Node 探测/runAsNode fuse/路径契约）。spawn 边界的固有痛点持续存在：桌面依赖全局 npm 包 + 系统 Node，移动端彻底禁用。

2026-09-13 对替代源做了全网实测（同 ADR-0128 的 requestUrl 等价通道）：

- **ApiZero**（apizero.cn 聚合平台「豆瓣电影信息」接口）：HTTP 200 可用，`GET v1.apizero.cn/api/douban-movie?id=<豆瓣ID或URL>`，Bearer key 鉴权；返回 评分/导演/主演/类型/制片地区/片长/集数/is_tv/年份/热门短评；**无搜索、无海报 URL、无简介**；免费 key 1000 次/日 QPS 3（用户已提供 key 并实测验证，含错误态 404/code 5020）。
- **豆瓣各端点**：搜索页（含海报缩略 URL）与海报图 CDN 实测畅通且与详情页是不同风控面；详情页 HTML 本机当时被风控拦（生产工具同样拿不到）——反爬间歇性，任何自建直连方案都躲不开。
- AniList/TVmaze 通但中文数据弱；Bangumi/TMDB/Wikidata 本网络不可达；iTunes Search API 已失效。

用户拍板（2026-09-13）：**迁移入插件；海报走豆瓣（搜索页提 URL + CDN 下载），字段走 ApiZero 首选；设置页提供 key 设置项；只接 ApiZero（AniList 动画回退另立项）；调用策略 = 详情首选 ApiZero（豆瓣只出搜索 + 海报 + 演职员兜底）。**

## 决策

- **抓取核心移植**：`tools/obsidian-douban-poster/douban-client.js` 移植为 `src/cinema/douban-fetcher.ts`（依赖注入 `httpGet` / `downloadBinary`，生产 = requestUrl 适配，15s 单请求超时）。照搬：`parseSearchResults`（搜索页正则）、`extractSid`、`upgradePosterUrl`（s_ratio→l_ratio 高清）、`parseCelebrities`（rexxar 演职员）。**豆瓣详情页 HTML 不再抓取**（`parseSubjectMeta` 不移植——字段已由 ApiZero 承接）。
- **字段链**（写 frontmatter，已有值不覆盖、缺失才填——防重抓覆盖手工修正）：
  - 首选 ApiZero：豆瓣评分(score)/导演(director)/主演(actor)/类型(genre)/制片国家/地区(area)/片长(duration)；集数与 is_tv 不写 frontmatter（现状无对应字段消费）。
  - 兜底 rexxar（`m.douban.com/rexxar/api/v2/{tv,movie}/<sid>/celebrities`，tv 优先 404 判电影）：ApiZero 未配置或缺导演/主演时调用，另提供**编剧**(writers)——ApiZero 无此字段。
  - **契约收缩**：语言/又名/IMDb/简介/上映日期(具体日期) 五字段不再抓取（ApiZero 无、详情页退役；风控下现状本就常年空）。存量字段不清理、不覆盖。
  - 未配置 ApiZero key：字段走 rexxar 兜底（导演/主演/编剧可拿，评分拿不到），设置组提示填 key。
- **海报链**：搜索页 `posterUrl` → `upgradePosterUrl` → `downloadBinary`（requestUrl arrayBuffer）→ `vault.adapter.writeBinary('CONFIG/MOVIE POSTER/<安全名>_<时间戳>.<ext>')` → frontmatter 海报 + 正文 `![[…]]` embed（`insertPosterEmbed` 移植，`vault.process` 原子改写）。海报目录沿用 CLI 默认常量。
- **搜索与风控**：搜索页照搬（`www.douban.com/search?cat=1002&q=`）；**风控页检测**——响应 <2000B 或无搜索结果结构 → 判风控，该条失败；失败聚合通知文案含「豆瓣风控」提示。豆瓣 Cookie（设置项，可选）注入搜索/rexxar 请求头（来源从 `~/.douban-cookies.txt` 收编为插件设置，随库同步移动端）。
- **队列改造**（`douban-queue.ts`）：执行器从 spawn 换为插件内 `fetchNote`（注入点保留），队列/loading/15s 间隔/失败聚合/会话去重/会话首轮补抓/删除取消（G8）全保留；**完成信号 = fetchNote 返回值**（进程边界消失，退出事件丢失问题不存在了——字段落盘轮询兜底退役）；单条 3 分钟硬超时保留（Promise.race）；**移动端队列启用**（requestUrl + writeBinary 全平台可用，不再禁用）；CLI/node 探测、absPath、waitForExit、activeKill 全部删除。
- **设置**（影院设置组新增「数据抓取」组）：ApiZero Key（text，默认空）、豆瓣 Cookie（text，默认空，可选）。key 存 data.json（随库同步），**不进仓库**；部署时由会话直接写入 vault data.json。
- **spawn 链退役**：插件不再 spawn；全局包 `@jwbz/obsidian-douban-poster` 与 `tools/obsidian-douban-poster/` 留存（手动 CLI 仍可用，对齐 ADR-0128 news 先例）；ADR-0113 标注执行层被本决策取代。

## 修订（2026-09-13，ApiZero 字段扩展）

- 用户发现 ApiZero 返回 16 字段未被吃满，拍板三扩：**上映日期←year**（仅年份，缺失才填，与存量 YYYY-MM-DD 混排有意接受）、**季集←episodes**（仅 `is_tv=true` 剧集且缺失才填——季集是观影报告统计源字段，此前 487/677 条缺失）、**热门短评←short_comment**（新增 frontmatter 字段，缺失才填）。语言/又名/IMDb/简介四字段维持退役不变。历史存量不回改，全库回填由会话一次性执行。

### 修订更正（2026-09-13，抓取写回链路审查 C1/C9）

- 三扩中「**季集←episodes**」一项**作废**：ApiZero 的 `episodes` 语义为**总集数**而非季数（官方接口描述「集数（剧集）」、本决策 Context 调研记录「返回…集数…」、豆瓣公开 API 语义三路一致），而消费端 analysis.ts「追剧深度」按季数解析（`季集` 首个数字 = 季数），写入 24 会被展示为「24 季」。`ApizeroInfo.episodes` 字段类型保留（注释标明总集数，勿作季集写入），frontmatter 不写季集。
- 「上映日期←year」「热门短评←short_comment」两项扩展保留。
- 同批审查 C9 拍板：豆瓣评分/导演/主演/类型/制片国家/地区/片长六字段一律改「**缺失才填**」（与 C8 同机制：缺失判断在写回时基于 fresh 内容复核），已有值不再覆盖。

## Consequences

- 移动端影院抓取首次可用（新片即抓，不再等 PC 补抓）。
- 消灭 spawn 整类缺陷（Node 探测/runAsNode fuse/绝对路径契约/进程退出信号丢失/3 分钟杀进程）与「未装全局包」前置条件。
- 字段契约收缩五项（语言/又名/IMDb/简介/上映日期），存量笔记字段保留；如需这些字段未来可评估 ApiZero 是否上新子接口或另立源。
- ApiZero 成为字段链单点依赖（第三方平台，99.9% SLA 自报）：key 失效/额度耗尽 → 自动落 rexxar 兜底，评分缺失可感知（失败聚合通知不弹——字段部分缺失不算失败，海报+豆瓣链接齐即完成）。
- 豆瓣搜索页仍是全链入口单点：被风控时本轮全失败（可感知文案），会话首轮自动重试的既有自愈节奏不变。
- 六字段与扩展字段一律缺失才填（审查 C9）：防重抓覆盖用户手工修正；代价是豆瓣评分等已有值的更新需手工修改、或删掉该字段后重抓。
