# 540 · 影院「添加影视」经名称索引选片时海报加载不出来

## 症状

在「添加影视」里输入片名，从**名称联想下拉**里选中候选（如「录像信」），点解析：

- 豆瓣字段全部正常（类型 / 导演 / 主演 / 地区 / 片长 / 评分 / 链接 / 热门短评）；
- 左侧海报位**永远是空骨架**，不淡入、不换图，也不出首字占位；
- 保存后卡片同样没海报（片单导入的条目亦同）。

手输片名（不点下拉）走按名检索时，海报正常——所以只有「下拉选中的那些片」坏。

## 根因（实测，非推测）

`pickedSid`（名称索引命中携带的 sid，issue 498 / ADR-0210）走 `queryDoubanBySid`，该路径
`posterUrl` **恒为空串**——ApiZero 的电影信息接口不返回海报：

```ts
// src/cinema/douban-fetcher.ts（修前）
posterUrl: '',   // ApiZero 无此字段
```

而 `ui.ts` 的预览海报腿是 `ensurePreviewPoster(q.data.posterUrl)`，见空 URL 直接 return：

```ts
const ensurePreviewPoster = async (url) => { if (!url || posterKicked) return; ... }
```

于是预览卡停在骨架；`fetchNoteDouban`（队列抓取）的 `if (!hasPoster && posterUrl)` 同样跳过下载，
**队列还会因「缺海报」反复把该条目重新入队**（同一恶性循环，注释里记过一次）。

复现证据（本机真实 vault）：

| 证据 | 值 |
|---|---|
| 名称索引命中 | `cinema-douban-index.json` → `["录像信","","8.2","电影","3022655"]` |
| 截图豆瓣链接 | `https://movie.douban.com/subject/3022655/`（同一条） |
| 海报目录 | `CONFIG/MOVIE POSTER/` 无任何 `录像信*`（852 张里没有它） |

## 修复

给 sid 直取补一条**按 sid 精确取图**的腿（不依赖名称匹配，比回流按名三路检索更准也更省）：

- 新增 `parseRexxarSubjectPic(json)`（纯函数）：`pic.large` → `pic.normal` → `cover_url`；
  404 体 / 非 JSON / 无 pic → 空串。
- 新增 `fetchSubjectPoster(sid, httpGet, cookie?)`：打 `m.douban.com/rexxar/api/v2/<movie|tv>/<sid>`，
  **movie 优先、tv 兜底**（实测 movie 接口对剧集 sid 也返回数据，tv 对电影 sid 返 404 体——
  与 `fetchCelebrities` 的 404 探测同款）；异常/空一律归空串，图缺就缺、不抬走解析。
- `queryDoubanBySid` 在字段之后串行补图（不并发：同域两次请求，避频控）。
- `upgradePosterUrl` 由 `s_ratio_poster → l` 扩为 `[sm]_ratio_poster → l`：rexxar 给的
  `pic.large` 是 `m_ratio_poster`，升 l 后与 suggest 路径**同一张图**（实测海贼王第一季
  l 规格 146074 B，与 vault 里已存的 l 图字节数一致）。

实测（2026-10-03，`3022655`）：`pic.large` = `m_ratio_poster/public/p2510495981.jpg`，
升 l 后下载 200 / 有效 JPEG；rexxar 接口**必须带 Referer**（无 Referer → 400 `invalid_request_1284`）。

## 验证

- `tests/cinema/douban-fetcher.test.ts`：`parseRexxarSubjectPic` 4 态、`fetchSubjectPoster`
  4 态（movie 命中即用 / tv 兜底 / 异常归空 / null 归空）、`upgradePosterUrl` 的 s/m 升 l 与
  「无该片段原样」、`queryDoubanBySid` 补图命中与非命中共 2 条。
- `tests/cinema/douban-queue-sid.test.ts`：生产通道（requestUrl 打桩）断言 sid 命中时
  `posterUrl` 非空且三路检索仍零调用。
