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
- [ ] 运维：@jwbz/obsidian-news 发版 + 全局更新 + pm2 restart；vault news.json 手动清理两段（部署流程执行）
