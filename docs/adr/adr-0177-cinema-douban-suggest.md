# ADR-0177：影院豆瓣检索弃搜索页改 subject_suggest（JSON 补全接口）

- 日期：2026-09-23
- 状态：已采纳（修订 ADR-0129 的字段链第 1 步）
- 相关：issue 395（表单解析）/ 303（抓取队列）；前置 ADR-0129

## 背景

2026-09 用户影院「解析」频繁遇「豆瓣搜索被风控，稍后再试」。排查结论：

- 提示与 ApiZero 无关——ApiZero 失败静默降级 rexxar 兜底，不产生任何用户提示；
  `v1.apizero.cn/api/douban-movie` 实测正常（code=0、字段结构未变），apizero 家也没有
  按片名搜索的接口（marketplace 全量翻过，只有「豆瓣电影信息」一个豆瓣接口，参数收
  ID/URL）——**sid 必须先由豆瓣侧给出**。
- 真正的瓶颈是字段链第 1 步 `www.douban.com/search?cat=1002&q=<名>`（搜索页 HTML）：
  - 实测响应慢（约 9s，单次），逼近 15s 单条超时；网络稍慢即超时；
  - 超时 / 非 2xx / 响应体形态不符在 `searchLooksBlocked` 里一律归 blocked——超时被
    误报成「风控」（C6 只把网络异常 throw 摘出去了，null 未拆）；
  - 整页 27KB HTML + 正则解析 `class="result"` 块，豆瓣改版即断。

## 决策

### 1. 第 1 步检索改 `movie.douban.com/j/subject_suggest?q=<名>`

豆瓣搜索框补全接口，实测 200、响应 <2KB JSON 数组，单条目自带：

- `id`（即 sid）
- `title`（规范名）
- `img`（海报 URL，s_ratio_poster，照走 `upgradePosterUrl` 高清写盘）
- `url` / `type`

一次请求覆盖原搜索页的全部产出（sid + 规范名 + 海报 URL），HTML 与正则解析退役。

### 2. 解析与风控判定（`parseSuggestResults` / `suggestLooksBlocked`）

- 解析：只留 `type === 'movie' | 'tv'`（suggest 混书籍/音乐条目，原搜索 `cat=1002`
  的等价过滤）；`detailUrl` 由 `id` 规范化构造 `https://movie.douban.com/subject/<id>/`，
  不直接用 `url` 字段（带 `?suggest=` 脏参数）；缺 id 的条目跳过。
- 风控判定换形态检测：响应 null（非 2xx/超时）或 `JSON.parse` 失败（风控 HTML 拦截页）
  → blocked；空数组是正常空态 → notfound（不再靠「没有找到」文案探测）。

### 3. 不变的部分

- reason 三态（blocked / notfound / network）与 C6 口径（throw → network）不变，
  表单「解析」与抓取队列共用 `queryDoubanByName` 单源不裂；
- 「豆瓣链接」字段写规范化 subject 链接（与 ApiZero `douban_url` 同形，无脏参数）；
- rexxar 演职员兜底、ApiZero 字段链、海报下载写盘、缺失才填（C8/C9）全不动；
- 设置项「豆瓣 Cookie」继续注入 suggest 请求头；UI「豆瓣搜索」外跳按钮
  （`shared.ts::doubanSearchUrl`）是用户手点外跳，与抓取链路无关，保留。

### 4. 原型 fake 层与测试同步（铁律 6）

`fake-obsidian.ts` 的搜索页 HTML 罐头改 suggest JSON 罐头（`cannedSuggestJson`），
网关拦截 `subject_suggest`；fetcher 测试夹具换 SUGGEST_JSON，补 book 过滤 / 脏参
规范化 / 非 JSON → blocked / `[]` → notfound 用例。

## 后果

- **风控面骤减**：请求从 27KB 搜索页 HTML 变 <2KB 补全 JSON；suggest 是搜索框补全
  通道，风控阈值远宽于搜索页；超时误报「风控」的概率随响应体积大幅下降。
- **语义更准**：「没有找到」（空数组）与「被风控」（非 JSON/null）结构性区分，
  不再依赖空态文案探测。
- **改版韧性**：JSON 契约（id/title/img/type）比 HTML DOM 结构稳定。
- **已知代价**：suggest 偶发返回的关联度与搜索页首条略有差异（补全排序 vs 搜索排序），
  取首条口径不变；剧集/电影混排时以 suggest 排序为准。

## 被否决的方案

- **① rexxar 移动搜索接口**（`m.douban.com/rexxar/api/v2/search`）：实测可用，但响应
  是 smart_box/subjects.items 多层嵌套、还夹营销位，解析远不如一层 suggest 数组干净。
- **② 保留搜索页只放宽超时 / 拆超时文案**：治标——体积大、易风控、正则脆的根因都在；
  留下的风控面一样大。
- **③ 表单让用户粘贴豆瓣链接绕过检索**：交互倒退，且抓取队列场景没有人工输入。
- **④ 换其他聚合 API 承担按名搜索**：翻遍 apizero marketplace 无豆瓣搜索类接口；
  引入第二个聚合源徒增凭据与风控面。
