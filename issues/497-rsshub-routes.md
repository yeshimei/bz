# 497 · RSSHub 路由型源收录（源库 via 通道，ADR-0209）

状态：进行中（2026-09-27 立项）
前置：issue 495（RSS 源库黄页模型，`via` 字段预留）

## 背景与调研结论（2026-09-27 实测）

- 数据源：RSSHub-Docs 仓库 `src/public/routes.json`（约 8.5MB，随主仓每日重建，机器可读）——
  2020 命名空间 / 3862 路由，每条带命名空间中文名、heat 热度、example（参数填好的示例路径）、
  官方 categories、features 标记（requireConfig / requirePuppeteer / antiCrawler）。
- 候选池：带 example 且「三免」（免配置/免无头浏览器/免反爬标记）共 **3304 条**，
  其中仅 1 条 example 仍含 `:参数` 占位（剔除口径：example 不得含 `:` 开头段）。
- 公共实例实测：官方 rsshub.app 国内直连超时；rssforever 国内可达且功能正常
  （GitHub 路由 200 出 feed），但微博/B站/知乎/抖音/小红书等国内平台路由全部 503
  （上游反爬封公共实例出口 IP）；各实例路由覆盖不一致。
- 结论：路由可用性 = 实例 × 上游 × 路由 三维变量 → **出版期测活对路由型源无意义**
  （时效极短 + 实例是用户可配项 + 公共实例限流），以 features 筛选代替；
  实例地址必须做成可配置键。

## 拍板（2026-09-27，用户三问）

1. **收录规模：三免全收 3304 条**（不精选，源库做全）。
2. **默认实例：`https://rsshub.rssforever.com`**（实测国内可达；设置键可随时改自建）。
3. **订阅口径：订阅=拷贝当时 URL**——订阅那一刻按当时实例拼完整地址存 rssFeeds，
   改实例不影响已订阅（要换删了重订）；黄页纯度不变，news-fetcher 零改动。

## 二轮拍板（2026-09-27 同日，全参数化）

复核发现初版把「带参数路由 + example 已填」的 2647 条按示例地址直订是**产品语义缺陷**
（example 是文档作者的演示值——「UP 主动态」订到的是某个陌生 UP 主的投稿）。用户拍板
**方案 A 全参数化**：3305 条全收（无参数 1110 直订 + 带参数 2195 走表单），带参数条目
一律走参数表单填自己的参数（params 说明 / viaExample 预填 / desc 提示三件套），不再直订示例。
数据结构：`via` 升级为完整路由模板（routes.json 的键才是完整路由，`path` 字段省略 ns 前缀——
拿它拼 url 曾实测去重 1052，教训留痕）；新增 `viaExample`/`params`/`desc` 表单素材与
路由级 heat 排序；添加框识别 `/` 开头路由路径。详见 ADR-0209 修订节。

## 设计

- **url/via 双字段**：路由条目 `url` 出版期用默认实例拼成完整合法地址（校验器与
  「已订阅匹配」零改动），`via` 存路由路径（如 `/bilibili/platform/-1`）作订阅时
  按当前实例重拼的素材。校验加 via 形状门（以 `/` 开头、无空白）。
- **分类**：固定大类扩 3 类（新闻资讯/校园学术/财经，总 15）；RSSHub 官方 25 分类
  直映射（不走关键词映射），other → 综合。timqian 既有归类不变。
- **实例键**：news.json 新段 `rsshubInstance`（与 rssFeeds 同文件同绑定机制），
  容错解析（非法回退默认），设置组 text 行维护。
- **UI**：源库路由条目加「RSSHub」徽标；搜索纳入 via 命中；订阅动作走重拼。
- **快照蒸馏**：routes.json 8.5MB 蒸馏后入库（全量 ns/routes 只留必要字段，
  约 1MB），筛选放 lib.mjs 纯函数（口径可迭代）。

## 交付物

- `scripts/rss-catalog/`：UPSTREAMS 双上游、parseRssHubRoutes、官方分类映射、
  fetch-upstream 双格式、build 双源合并（测活只测非 via 条目）
- `src/core/rss-catalog.ts`：RSS_HUB_DEFAULT_INSTANCE / joinRssHubUrl /
  resolveCatalogFeedUrl / via 校验 / 搜索纳 via
- `src/clipbook/`：news-data 新段 + 设置组实例行 + 源库徽标与订阅重拼
- 产物重出：`pnpm rss-upstream → rss-catalog → manifest`
- 测试：lib / core / clipbook 三层扩展 + smoke 同步

## 门禁留痕

2026-09-27 合并部署（a981b37f merge；构建产物随 34300a30 上线）：

- tsc --noEmit 绿；worktree 全量 549 文件 8193+ 用例全绿（两轮）；主仓合并后全量
  552 文件 550 绿 + 2 条存量并发抖动（people/generate-ui、pomodoro 392Hz，隔离单跑全过，
  495 时同款留痕）
- 子代理评审：P0 无；P1×2（表单关闭后异步续体守卫、buildRouteUrl 占位残留守卫）+
  P2×6 全处置（预填盲区一条为「不猜」设计行为记录不修）
- 出版实测：路由 3305 = 无参数 1110（直订）+ 带参数 2195（表单）；params 键与模板
  参数完全对应 96.8%，缺/多键为上游文档噪声、UI 按模板渲染已兜底
- 产物 downloads/rss-catalog.json 4454 条 / 2MB；manifest 5 docs 同步；changelog
  v1.25.0 块收录三条 497 条目（issue 尾注按生成口径剥除）
