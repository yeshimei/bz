# issue-302：聚合讯抓取迁入插件内——启动/打开剪藏本触发，守护退役

- 分支：worktree/1 ｜ 日期：2026-09-13
- 来源：grill-with-docs 三轮拍板（2026-09-13）
- 关联：ADR-0128 / ADR-0008（部分废弃）/ ADR-0121（RSS 段契约沿用）

## 背景

news.json 此前由 PM2 守护（@jwbz/obsidian-news）抓取，移动端无抓取能力。实测四源均可经 requestUrl 通道抓取（知乎/果壳 API、B站动态带 cookie、RSS）。用户拍板：废弃 PM2，插件全责；启动插件或打开剪藏本时抓一次，间隔不少于 30 分钟且可设置；手动命令保留；静默通知；正文照搬全量抓。

## 方案

1. **`src/clipbook/news-fetcher.ts`（新）**：移植 watcher.js 抓取核心——
   - 依赖注入：`httpGet`（生产 = requestUrl 适配，15s 超时、非 2xx → null）、存储走 `readNewsData`/`writeNewsDataMerged`（串行队列）。
   - 四源：fetchZhihu（latest + 逐篇 detail）、fetchGuokr（science_api + 逐篇 INITIAL_STORE 正文）、fetchBilibili（cookie 引导 + 每 UP 最近 N 条窗口 + 裁剪 + 风控标记）、fetchRss（轻量 XML 解析，`content:encoded` → description 兜底，htmlToMarkdown 转 md，每 feed 30 条窗口裁剪 + 标题回填）。
   - 纯函数（buildRssArticle/buildBilibiliArticle/collectBilibiliBatch/pruneBilibiliWindow/capRssWindow/htmlToMarkdown/localDatetime 等）逐条照搬，node 环境可测。
   - 24h 窗口（知乎/果壳）、URL+标题双去重、fetchedAt 打标照搬。
2. **news.json 段扩展**：`lastFetchAt`（epoch ms）+ `fetchIntervalMin`（30/60/120/360，回退 30）；parseNewsFileContent / writeNewsDataMerged 段清单 / DataSourceState 同步。
3. **触发链**：`maybeFetchNews`（间隔判定 + running 互斥）挂 main.ts onload（onLayoutReady 后延迟）与 openClipbook；命令 `bz-clipbook-fetch-now` 跳间隔立即抓；完成刷新未读流。
4. **设置组**（news-sources-group.ts）：新增「抓取间隔」select 行；安装引导分支退役（news.json 缺失 → 正常行 +「立即抓取」按钮）。
5. **通知**：成功静默；B站风控/无 cookie、全源失败时 notice（正文无 emoji）。
6. **测试**：news-fetcher 数据层（四源纯函数 + 端到端 fake httpGet 入库）、触发间隔判定、设置组 UI 行、smoke 同步。
7. **部署后动作**：主仓 `pnpm run build`；停 PM2 `news-watcher` 进程（包留存）。

## 验收

- 移动端（Capacitor WebView 同源）打开剪藏本即可抓到四源新文章。
- 间隔档位生效：30 分钟内重复打开不重抓；手动命令无视间隔。
- news.json 各段（UP 资料/RSS 标题/sources/统计）写入不互覆。
