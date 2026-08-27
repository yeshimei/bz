# News Watcher

抓取新闻源文章并去重入库 `news.json`（五段结构）的守护进程，供 Obsidian 阅读使用。

## Language

**抓取轮次 (fetch round)**:
一次定时执行的抓取动作（启动时立即执行一次，之后每 30 分钟一次）。
_Avoid_: 定时任务, 轮询

**抓取窗口 (fetch window)**:
每次抓取轮次覆盖的时间范围 — 滚动最近 24 小时（北京时间）。
_Avoid_: 今日, 当天

**数据源 (source)**:
一个独立的内容提供方（果壳科学人 / 知乎日报 / B站 UP 主），每个轮次按 `sources` 开关并行抓取。
_Avoid_: 频道, API

**数据源开关 (source switch)**:
news.json `sources` 段的布尔开关（zhihu/guokr/bilibili），决定本轮次抓哪些源；插件侧写。
_Avoid_: 源开关（非 canonical）

**UP 主名单 (UP list)**:
news.json `bilibiliUps` 段的 uid 数组，决定 B 站源抓取哪些 UP 主的视频投稿；插件侧写。
_Avoid_: UP 主列表（非 canonical）

**UP 主资料 (UP info)**:
news.json `bilibiliUpInfo` 段的 uid → `{name?, avatar?}` 映射（ticket 126）——B 站抓到条目时由本进程回填（取首个条目的 `module_author` name/face，头像统一转 https），插件侧只读展示；缺资料时显示回退 uid。
_Avoid_: UP 主信息（非 canonical）

**每 UP 最近 N 条 (latest N per UP)**:
news.json `bilibiliMaxItems` 段（ticket 127，默认 10，夹取 1..50）——B 站源不走 24 小时窗口，按最近优先收满 N 条未抓过的动态即停（长期未更新的 UP 也能抓到最新动态）；插件「数据源」组设置。
_Avoid_: 抓取条数（非 canonical）

**B 站 Cookie (bilibili cookie)**:
news.json `bilibiliCookie` 段（ticket 127，可选字符串）——API 返回 412（风控）时优先使用；用户经插件「UP 主名单管理」弹窗配置（浏览器 F12 复制 buvid3/SESSDATA）；未配置回退自动引导（GET 主页收集 buvid3）。明文本地存储，随 vault 同步。
_Avoid_: cookie 配置（非 canonical）

**六段结构 (six-segment structure)**:
news.json 的对象形态 `{ articles, stats, bilibiliUps, bilibiliUpInfo, bilibiliMaxItems, bilibiliCookie, sources }`（v1.1.0 四段 + ticket 126 `bilibiliUpInfo` + ticket 127 两段）；旧纯数组读取时自动包裹迁移。
_Avoid_: 对象结构（非 canonical）

**新闻条目 (news article)**:
`news.json` 中的一条记录，含平台、标题、URL、作者、发布时间、正文。
_Avoid_: 消息, 帖子

**B 站条目 (Bilibili article)**:
B 站源的新闻条目 — platform='B站'、title=视频标题、url=`https://www.bilibili.com/video/<bvid>`、body=简介+封面+播放链接；仅来自 `DYNAMIC_TYPE_AV`（视频投稿）。

**去重 (dedup)**:
入库前按 URL 和标题过滤已存在的条目，保证同一文章只入库一次。
_Avoid_: 过滤, 查重

**未读 (unread)**:
消费方（Obsidian 侧）标记 `read: false` 的条目；本进程只负责抓取，不维护该状态。

## Rules

- **滚动 24 小时窗口仅用于果壳/知乎**，不是自然日 — 深夜发布的文章不丢；B 站源不走窗口（ticket 127：每 UP 最近 N 条，默认 `bilibiliMaxItems`=10）。
- **一个轮次抓取窗口内的全部文章**，不限制数量；B 站按最近优先收满 N 条即停。
- **批内和库内都要去重**：API 可能返回重复数据，库内按 URL + 标题双去重。
- **源级容错**：单个源失败不影响其他源，下个轮次自然重试，无重试状态机。
- **多段整读写**：写回只动本进程负责的 articles 段 + 合并本轮 `bilibiliUpInfo`（保留 stats/bilibiliUps/bilibiliMaxItems/bilibiliCookie/sources——插件侧维护段）。
- **B 站 Cookie 优先级**：配置的 `bilibiliCookie` 优先；未配置再 GET 主页自动引导（buvid3，规避 412）；都失败则跳过本轮并提示到插件「UP 主名单管理」配置。
