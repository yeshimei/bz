# issue 273：聚合讯 RSS 订阅源 + 每日简报退役

日期：2026-09-11 ｜ 用户拍板（grill-with-docs 三轮）：RSS 走守护端抓取、可管理源列表、专属弹窗与 up主管理分开、一天一条全文；每日简报「下载视频转成每日资讯」这条路方向错误，整条退役 ｜ 关联：ADR-0121（取代 ADR-0119）、issue 263

## §1 RSS 订阅源（新增）

- **抓取归属 = 守护进程**（tools/news-watcher，@jwbz/obsidian-news 发新版）：30 分钟抓取轮内按 `sources.rss` 开关拉 `rssFeeds` 列表；插件只读 news.json，不承担资讯抓取。
- **依赖拍板 = 引库**：rss-parser（feed 解析）+ turndown（HTML→markdown），打破 watcher 零依赖姿态；bili-downloader 零依赖不变。
- **数据模型**：news.json 新增 `rssFeeds` 段（`{url, title}[]`，title 取 feed 自带标题）+ `sources.rss` 总开关（与 zhihu/guokr/bilibili 并列，默认开）；`rssFeeds` 插件写、守护只读（沿 `briefUps` 先例的段级合并写回）。
- **条目形态 = 一天一条全文**：整期 `content:encoded` 经 turndown 转 markdown 入 body，标题「YYYY-MM-DD · feed名」（feed 原标题为纯日期）；`platform` = feed 自带标题（rail 站点行/typeLabel/保存剪藏 site 同源）；外链保留；每源窗口最近 30 条；去重沿用 URL+标题双口径。
- **设置 UI**：数据源组新增「RSS 订阅」toggle + 「RSS 订阅 · 管理」按钮；管理弹窗复用 up主管理自建 overlay 范式（独立 mask/popup、ESC、遮罩点关），与 up主管理分开：粘贴 URL → 添加前 requestUrl 试拉校验并预取 feed 名 → 源列表（名称/URL/移除）+ 守护版本提示 info。
- **预置源**：橘鸦AI早报 `https://daily.juya.uk/rss.xml`（每日一期，AI 生成的 AI 领域早报）。

## §2 每日简报退役（ADR-0119 → 被 ADR-0121 取代）

- **插件侧全删**：`brief.ts`、rail「每日简报」入口与按天分节、阅读面/保存/已读 brief 分流、`ClipOrigin`/`RailKind`/`SrcFilter` 摘 `'brief'`、`M.briefs`、`briefKeyOf`、简报保留清理、up主管理弹窗「每日简报」组、`dailyBriefDir` 设置键、`.bz-clip-brief-*` 样式、简报相关测试（brief.test.ts / brief-ui.test.ts 整删）。
- **守护侧摘调度**：`dispatchBrief` 段、readNewsData 的 briefs/briefUps 解析、cli `brief` 子命令、brief-dispatch.test.js。
- **下载器保留**：bili-downloader `--brief` 模式代码保留（知识盒 `--batch` 主链路共享缓存/转写机制；不发包、留死代码，用户拍板）。
- **数据零兼容**：`rssFeeds`/七段→八段契约同步 checks-drift；vault news.json 残留 `briefs`/`briefUps` 由会话在部署后手动清理（新守护写回亦会自然丢弃），代码不做任何迁移；「归档/每日简报/」下已保存的 vault 笔记不动。
- **文档**：ADR-0119 标记被取代；CONTEXT.md 删「每日简报/每日简报名单/简报条目」三词条、修「转录稿/数据源开关/数据源守护/剪藏本」词条、新增「RSS 订阅源/文章源·视频源」词条。

## 改动清单

- **文档**：`docs/adr/0121-rss-source-and-brief-retirement.md`（新增）、`CONTEXT.md`（删三词条/修四词条/新增「RSS 订阅源」「文章源 / 视频源」）、`.scratch/memo-suite-plugin/spec.md`（gitignore 本地）。
- **插件删除**：`src/clipbook/brief.ts` 整文件；`store.ts` 简报区段（briefTimeTs/briefDayKey/clipBrief/queryBriefs/groupBriefsByDay/writeBriefState/deleteBrief/writeBriefPatch）；`render.ts` 简报四函数 + ICO.brief + SrcSelJson 'brief'；`ui.ts` rail 入口/列表分支/阅读辅助/保存分流/打开即已读分支/dailyBriefDir 行；`constants.ts` briefKeyOf；`state.ts` M.briefs；`loader.ts` 简报保留清理；`news-data.ts` briefs/briefUps 段与 normalizeBrief/parseBriefs/applyBriefRetention/removeBriefKeys；`news-source-settings.ts` briefUps 操作；`settings.ts` dailyBriefDir；`save.ts` dailyBriefDirOf；`styles.css` 简报样式块；`checks-drift.ts` news.json 契约收缩为八段（+rssFeeds）。
- **插件新增**：`news-data.ts` RssFeed 类型 + parseRssFeeds/extractFeedTitleFromXml/normalizeRssFeedUrl + sources.rss 默认开；`news-source-settings.ts` addRssFeed/removeRssFeed/rssFeeds 状态；`news-sources-group.ts` 「RSS 订阅」toggle + 「RSS 订阅源 · 管理」按钮 + `rssManagerSettingsSchema`/`openRssManagerModal`（自建 overlay，requestUrl 试拉校验预取名，守护版本提示 info）。
- **守护**：`watcher.js` 摘 dispatchBrief 区段/readNewsData 简报段/cli brief 子命令；新增 RSS_PARSER/RSS_TURNDOWN、buildRssArticle/capRssWindow/fetchRss、checkAndFetch RSS 并轨（去重/窗口裁剪/title 回填）；`package.json` 1.3.0 + rss-parser/turndown 依赖；README v1.3.0 说明。
- **原型**：fake-sim.ts 种子 v3（摘简报、sources+rss、预置橘鸦源）；prototype-data.js 摘 briefs/briefUps；prototype.html 摘简报 rail 自检；prototype-render.js/prototype-behavior.js（clipbook/diary/memo/settings-panel）重出。
- **测试**：删 brief.test.ts/brief-ui.test.ts/brief-dispatch.test.js；新增 `tests/clipbook/rss.test.ts`（数据层 6 例）、`tests/clipbook/rss-ui.test.ts`（UI 层 5 例）、`tools/news-watcher/test/rss.test.js`（守护 6 例）；news-sources-settings/checkup/copy-lint 断言同步。

## 验收

- [x] RSS：粘贴 URL 添加即试拉校验并预取名；守护轮询后文章入库、rail 站点行出现 feed 名（入口待部署后真机验证）
- [x] 每日简报：rail 入口/设置弹窗简报组/AI 补跑全消失；tsc 零残留引用
- [x] 契约：checks-drift news.json 八段 = articles/stats/bilibiliUps/bilibiliUpInfo/bilibiliMaxItems/bilibiliCookie/sources/rssFeeds
- [x] 门禁：pnpm test 4196 用例全绿 + tsc --noEmit 0 错 + 自审 + diff 审查（含 merge master 同步 diary 批次，零冲突）；主仓库构建部署见交付
- [x] 运维：@jwbz/obsidian-news@1.3.1 已发版 + 全局更新 + pm2 restart；vault news.json 八段达成（实际无简报残留段可清，已预置橘鸦源并真机入库 10 期）

## §3 审查批（同日，code-review 两轴 + 正文渲染转向）

两轴审查（Standards/Spec 并行子代理）结论：Standards 零硬违规 + 5 条 judgement call；Spec 6 条。处置：

- **试拉校验加固**：新增 `looksLikeFeedXml`（须带 `<rss>/<feed>/<RDF>` 结构标记），普通 HTML 网页当场拦截；补 HTML 拦截测试用例。
- **capRssWindow 口径修正**：改「该平台**库内全部条目**合并按 date 降序保最新 30 条」——原实现以本轮 feed 窗口为阈值，feed 只吐 N 条时稳态保留 N 而非 30；补补位/裁剪测试。
- **死分支内联**（addRssFeedUrl）+ **fetchRss 失真注释更正**；弹窗壳 40 行同构保留不动（可选重构，不欠账）。
- **正文渲染转向 Obsidian 内置 MarkdownRenderer**（用户拍板）：阅读面/移动详情改为「render.ts 出占位容器 + ui.ts 异步水合 + 纯文本兜底 + 竞态守卫」（diary/knowledge/encrypt 三域同范式）；自制段落化管线退役（md.ts toParagraphs/图片 token 拆分、render.ts paragraphsHtml/inlineHtml、ClipParagraph 类型、clipLoadingHtml），md.ts 只留 stripClipChrome；壳 fake-obsidian 的 MarkdownRenderer 桩补纯文本近似实现。全保真 markdown（表格/代码块/嵌套列表），不再维护自制子集解析器。
- **预置源措辞对齐**：CONTEXT 词条改「首个源为橘鸦AI早报（部署时写入订阅列表，非代码内置默认）」。
- **守护 1.3.1 回填**：writeNewsData 剥离 `missing` 读兜底标记（合并后自修，spec 外合理偏差）。
