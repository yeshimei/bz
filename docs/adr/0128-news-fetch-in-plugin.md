# 0128 — 聚合讯抓取迁入插件内（news-watcher 守护退役）

## Context

聚合讯数据源 `CONFIG/STORAGE/news.json` 自 ADR-0008 起由独立 npm 包 `@jwbz/obsidian-news`（PM2 守护进程）抓取：果壳科学人 API + 知乎日报 API + B站 UP 动态 API + RSS 订阅（ADR-0121），每 30 分钟一轮、24h 窗口、URL+标题双去重。该方案桌面时效最优，但移动端完全没有抓取能力（手机无 Node/PM2），且依赖用户机器单独安装配置 npm 包。

2026-09 实测（模拟 Obsidian `requestUrl` 通道：纯 HTTPS GET + 浏览器 UA）：知乎 latest/detail API、果壳 science_api、B站动态 API（带 news.json 已配置 cookie）、RSS feed 四源全部可抓——均不依赖 Node 专属 API。`requestUrl` 桌面/移动端一致可用且无 CORS 限制。

grill-with-docs 三轮拍板（2026-09-13）：

- PM2 守护**废弃**，插件全责抓取（写入方唯一化，消灭双写竞争）
- 触发时机：插件启动（onload）或打开剪藏本时后台抓一轮，间隔不少于 30 分钟；间隔档位 30 分钟 / 1 小时 / 2 小时 / 6 小时（select 档位，默认 30 分钟）
- 手动命令 `bz-clipbook-fetch-now` 忽略间隔立即抓（兼测试与移动端调试）
- 通知静默，仅失败时通知（B站 cookie 失效/风控须明确报）
- 知乎/果壳逐篇正文抓取照搬（入库即全文，离线可读；移动端后台串行请求不阻塞 UI）
- PM2 退役程度：只停进程，npm 包与 `tools/news-watcher/` 源码保留不删（回滚成本最低）

## 决策

- **抓取核心移植**：`tools/news-watcher/watcher.js` 的抓取逻辑移植为 `src/clipbook/news-fetcher.ts`（纯逻辑 + 依赖注入）：
  - HTTP 通道 = 注入的 `httpGet(url, headers) => Promise<string | null>`，生产环境由 `requestUrl` 适配（15s 超时、非 2xx 抛错吞为 null，对齐 safeFetch 语义）；测试注入 fake。
  - 四源抓取、24h 窗口、URL+标题双去重、B站「每 UP 最近 N 条」窗口收集与裁剪（含风控 rejected 标记不裁）、RSS 每 feed 30 条窗口裁剪、feed 标题回填逻辑逐条照搬。
  - 依赖替换：`rss-parser` → 轻量 XML item 解析（正则 + CDATA，`content:encoded`/`description` 兜底）；`turndown`（RSS 正文）→ 复用 watcher 自带的正则版 `htmlToMarkdown`（格式细节差异有意接受）；Node `fs` 读写 → 复用插件 `readNewsData`/`writeNewsDataMerged`（串行队列 + 段级合并）。
- **news.json 新增段 `lastFetchAt`**（epoch ms 数字，插件写守护退役后插件唯一写）：自动触发按「now − lastFetchAt ≥ 间隔」判定，替代守护的定时轮询；`writeNewsDataMerged` 段清单与 `parseNewsFileContent` 同步扩展（容错解析，缺失 → 0）。避免用 articles 最新 fetchedAt 判定——零新增轮会反复触发。**全源失败轮不推进该锚点**（review 修订）：失败后下次打开即重试，不等满档位；手动抓取同样落锚点（共用一轮执行路径）。
- **窗口裁剪落盘（review 修订）**：B站/RSS 裁剪必须走 `removeArticleKeys` 显式删除——`writeNewsDataMerged` 是磁盘∪声明并集，只换 articles 段会让被裁条目从磁盘复活；口径 = 磁盘有而本轮终集没有的 url 一律声明删除。
- **间隔设置**：`fetchIntervalMin` 段（news.json，跨设备随库同步，与 sources/bilibiliMaxItems 同范式），合法值 30/60/120/360，其余回退 30。设置入口 = 剪藏本设置「数据源」组 select 行（「抓取间隔」30 分钟/1 小时/2 小时/6 小时）。
- **触发链**：`maybeFetchNews()`（读 lastFetchAt 判间隔 → 不够则静默返回）挂三处：main.ts onload（onLayoutReady 后延迟触发，不阻塞启动）、`openClipbook` 入口、命令 `bz-clipbook-fetch-now`（跳过间隔判定）。抓取期互斥锁防重入（对齐 watcher `running` 标记）；抓取完成后刷新未读流。
- **B站 cookie**：优先用 news.json `bilibiliCookie`（用户已配置登录 cookie）；无 cookie 时 requestUrl 引导（GET 主页收 Set-Cookie，尽力而为）；风控 rejected 时通知「B站接口被风控拦截，请更新剪藏本设置中的 B站 Cookie」（通知正文无 emoji）。
- **设置组文案更新**：「尚未启用新闻数据源」安装引导分支退役——news.json 缺失即视为未抓取过，插件直接建库抓取；组内保留四源状态并新增「立即抓取」按钮行。
- **文档**：ADR-0008 标注方向部分废弃（抓取回迁插件，包保留）；CONTEXT.md「数据源守护」词条改写。

## Consequences

- 移动端首次具备抓取能力；全平台行为一致，news.json 写入方唯一（段级合并写保留但不再有守护竞争）。
- 桌面端失去 Obsidian 关闭期间的定时抓取，时效取决于打开 Obsidian 的频率（有意接受，用户拍板）。
- RSS 正文转 markdown 口径从 turndown 换为正则 htmlToMarkdown，存量格式细节可能有差异（有意接受）。
- `@jwbz/obsidian-news` 停止演进（进程停、包留存），如需回滚可 `obsidian-news start` 重新拉起。
- 逐篇正文抓取在移动端弱网下单轮可能较慢（串行 15~30 请求），后台执行不阻塞 UI；失败源静默跳过、有失败即通知。
- review 修复批（2026-09-13）：裁剪删除意图（P1）、lastFetchAt 全失败不推进、B站通知收窄、档位表单源化（FETCH_INTERVAL_STEPS 单源 news-data）、DataSourceState 双字段收拢（旧 string lastFetchAt 退役）、手动反馈文案「已抓取」。
