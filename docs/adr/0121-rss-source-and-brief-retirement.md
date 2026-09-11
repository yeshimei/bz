# 聚合讯 RSS 订阅源 + 每日简报退役

日期：2026-09-11 ｜ 取代：ADR-0119（每日简报整条退役）｜ 关联：ADR-0060（news 数据结构）、ADR-0082（clipbook 融合/双写者契约）

背景：剪藏本需要一个「每日资讯」的文章型来源，候选为橘鸦AI早报（`https://daily.juya.uk/rss.xml`，RSS 2.0，每日一期，全文在 `content:encoded`）。评估期用户拍板：**「下载视频转成每日资讯」这条路是错误的**——ADR-0119 的每日简报链路（UP主视频 → bili-dl 下载/转写 → AI 要点）方向性废弃；文章型订阅源（RSS）是每日摘要的正确形态。

## 拍板要点

1. **抓取归守护，不归插件**。RSS 与知乎/果壳/B站同管线：30 分钟抓取轮、URL+标题双去重、段级写合并全复用；插件保持「只读 news.json + 写状态段」的 ADR-0082 姿态，不承担任何资讯抓取。代价是需发新版 `@jwbz/obsidian-news` 并全局更新守护。
2. **守护端引库打破零依赖**：`rss-parser`（feed 解析，含 `content:encoded` 自定义字段）+ `turndown`（HTML→markdown）。仅 news-watcher 生效；bili-downloader 零依赖姿态不变。
3. **源模型 = 可管理列表 + 总开关**：news.json 新增 `rssFeeds` 段（`{url, title}[]`，title 取 feed 自带标题，守护/试拉回填）与 `sources.rss` 布尔开关（与 zhihu/guokr/bilibili 并列，默认开）。`rssFeeds` 插件写、守护只读（沿 `briefUps` 先例的段级合并）；守护端只在开关开启时拉列表内源。
4. **条目形态 = 一天一条全文**：整期 `content:encoded` 经 turndown 转 markdown 入 body（原文外链保留），标题「YYYY-MM-DD · feed名」；`platform` = feed 自带标题——rail 站点行动态聚合、typeLabel、保存剪藏 site 字段同源自动适配，无需逐处硬编码。每源窗口保留最近 30 条（沿 B站每 UP 窗口裁剪口径），去重沿用 URL+标题双口径与 `articleKeyOf`。
5. **管理弹窗与 up主管理分开**：数据源组新增「RSS 订阅」toggle 与「RSS 订阅 · 管理」按钮；弹窗复用 up主管理的自建 overlay 范式（独立 mask/popup 层级、ESC、遮罩点关）而非 `openSettingsModal`（其单例 toggle 会顶掉底层设置弹窗）。添加源时插件用 requestUrl **试拉校验并预取 feed 名**（守护 30 分钟才拉一轮，坏 URL 当场拦截）；知乎/果壳开关原地不动。
6. **每日简报整条退役**：插件侧（rail 入口/brief.ts/阅读与保存分流/设置简报组/`dailyBriefDir`/简报保留清理/样式/测试）与守护侧（`dispatchBrief`/cli brief 子命令）全删；**bili-downloader 的 `--brief` 模式代码保留**（知识盒 `--batch` 共享其缓存与转写机制，不发包、留死代码）。news.json 契约收缩：`briefUps`/`briefs` 两段移除（八段 = articles/stats/bilibiliUps/bilibiliUpInfo/bilibiliMaxItems/bilibiliCookie/sources/rssFeeds），checks-drift 同步；vault 残留数据由会话手动清理，**代码零兼容迁移**。
7. **文章源/视频源两分**（术语拍板）：聚合讯来源分两类——文章源（知乎日报、果壳科学人、RSS 订阅，条目即可读文章）与视频源（B站 UP 投稿，保存分流文献盒）；「RSS 订阅 · 管理」与「UP 主名单 · 管理」两弹窗各管一类。

## Considered Options

- **插件端抓取 RSS**（requestUrl + DOMParser）：插件首次承担资讯抓取，时机/移动端/双写合并全新设计；守护端管线现成——否
- **先插件端后迁守护**：两套抓取逻辑写两遍——否
- **单一固定源**（sources.rss 开关 + URL 硬编码）：弹窗无物可管，加源要改代码——否，建 `rssFeeds` 列表
- **「文章源总管理」弹窗**（收编知乎/果壳）：改动面大、搬动现有开关，无对应收益——否，RSS 专属弹窗
- **一天一条仅摘要**（description）：阅读需跳浏览器，体验差——否
- **拆条入库**（每小节新闻独立条目）：依赖解析 AI 生成的 HTML 结构，结构漂移即碎——否
- **守护端零依赖手写 HTML→md**：容错差、维护重；用户拍板引库——否
- **platform 统一标「RSS」/用域名**：多源不可分、展示生硬——否，用 feed 自带标题
- **列表内逐源开关、不设总开关**：与现有三源模式不对称，守护判断特殊化——否
- **每日简报仅摘插件侧、守护/下载器保留**：无人调度的死链路；用户拍板下载器 `--brief` 因共享代码一并保留、守护侧必删——折中执行

## Consequences

- news.json 段契约：`briefUps`/`briefs` 退役，`rssFeeds` 加入；八段守卫入 checks-drift。ADR-0119 的段权属扩张条款随之失效，`rssFeeds` 沿「插件写、守护只读」同款权属。
- `@jwbz/obsidian-news` 需发新版并全局更新 + pm2 重启；旧守护对新段静默忽略（写回自然丢弃 `rssFeeds` 之外的残留无害段），弹窗内置守护版本提示。
- watcher 首次引入 npm 运行时依赖（rss-parser/turndown），发包体积与供应链面变大；turndown 对该 feed 的分类小节/引用块/外链结构转换质量需在测试中固化样本。
- 知识盒不受影响：bili-downloader `--batch`/转写/缓存机制原样，仅 `--brief` 成为无调用方代码（已知死代码，留待未来清理）。
- 「归档/每日简报/」存量 vault 笔记为用户数据，不动；review-all-bugs 中 6 条简报审查项（F1/F2/F4/F6/F7/F8）随功能删除自动消解。
- 实现与验收细节见 `issues/273-rss-source-and-brief-retirement.md`。
