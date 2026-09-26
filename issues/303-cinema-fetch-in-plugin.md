# issue-303：影院豆瓣抓取迁入插件——字段走 ApiZero，海报走豆瓣

- 分支：worktree/1 ｜ 日期：2026-09-13
- 来源：grill-with-docs 拍板（2026-09-13，用户实测选型 ApiZero 并提供 key）
- 关联：ADR-0129 / ADR-0113（执行层被取代）/ ADR-0128（移植范式先例）

## 背景

影院抓取现状 = 插件 spawn 系统 Node 跑全局 CLI（ADR-0113/256），spawn 边界缺陷持续、移动端禁用。实测 ApiZero 豆瓣电影信息接口可用（评分/导演/主演/类型/地区/片长，无搜索/海报/简介），豆瓣搜索页与海报 CDN 与详情页是不同风控面（搜索+CDN 畅通）。用户拍板：迁入插件，海报走豆瓣、字段首选 ApiZero、设置页提供 key、只接 ApiZero。

## 方案

1. **`src/cinema/douban-fetcher.ts`（新）**：
   - 依赖注入 `httpGet`（requestUrl 适配，15s 超时）与 `downloadBinary`（requestUrl arrayBuffer）。
   - 移植：`parseSearchResults`/`extractSid`/`upgradePosterUrl`/`parseCelebrities` 正则照搬；**不移植** `parseSubjectMeta`（详情页 HTML 退役）。
   - `fetchMovieInfo(name, opts)` 端到端：搜索豆瓣 → sid/posterUrl/doubanUrl → ApiZero 字段（`v1.apizero.cn/api/douban-movie?id=<sid>`，Bearer key）→ 缺导演/主演或需编剧时 rexxar 兜底 → 海报下载写盘 → frontmatter 写入（`vault.process` 移植 `updateFrontmatterFields`/`insertPosterEmbed` 口径）。
   - 风控页检测：搜索响应 <2000B 或无结果结构 → 判「豆瓣风控」。
2. **队列**（douban-queue.ts）：执行器 spawn → 插件内 fetchNote；删 CLI/node 探测/absPath/waitForExit/activeKill；完成信号 = 返回值（字段落盘轮询退役）；单条 3 分钟 Promise.race 超时；15s 间隔/loading/失败聚合/会话去重/首轮补抓/G8 取消保留；**移动端启用**。
3. **设置**（cinema settings 新「数据抓取」组）：ApiZero Key（text）、豆瓣 Cookie（text，可选）；注入 httpGet 头（豆瓣端点）与 ApiZero 鉴权。
4. **字段契约**：写 豆瓣评分/导演/编剧(rexxar)/主演/类型/制片国家/地区/片长/豆瓣链接；语言/又名/IMDb/简介/上映日期五字段退役不写（存量不动）。
5. **测试**：fetcher 纯函数（搜索解析/海报升级/风控判定/rexxar 解析/ApiZero 响应解析与错误态）、端到端 fake 注入（ApiZero 主链/rexxar 兜底/风控失败/海报写盘）、队列集成（执行器注入）、设置组行。
6. **部署后**：ApiZero key + 豆瓣 Cookie 写入 vault data.json（不进仓库）；PM2 无涉及；ADR-0113 标注。

## 验收

- 桌面+移动端：新建影片卡片 loading → 海报+字段到齐；失败才聚合通知（风控文案）。
- 未填 key：rexxar 兜底可出导演/主演/编剧，无评分；填 key：ApiZero 全字段。
- 存量笔记五退役字段不被清除。
