# ADR-0178：影院检索改三路兜底链（suggest → rexxar search → 搜索页）

- 日期：2026-09-23
- 状态：已采纳（修订 ADR-0177 的单路 suggest 检索）
- 相关：issue 395（表单解析）/ 303（抓取队列）；前置 ADR-0129 / 0177

## 背景

ADR-0177 把检索从搜索页换成单路 subject_suggest 当天，用户解析《让子弹飞》报
「豆瓣没有找到这部影视」。实测复现并升级发现：

- suggest 存在**软拒绝形态：HTTP 200 + `[]`**——频控时不返回 403/418 而是空数组；
  实测连续请求后窗口以分钟计（90s 冷却后仍空，带 `bid` Cookie 无改善），此形态
  无法与「真没有这部片」区分，ADR-0177 的形态检测（合法 JSON 放行）对它无解，
  且会被误报成 notfound（比误报 blocked 更糟——用户以为豆瓣没收录）。
- rexxar 移动搜索（`m.douban.com/rexxar/api/v2/search`）与 suggest **频控池独立**：
  suggest 全空的同一时刻，rexxar search 依然命中《让子弹飞》（sid 3742360，
  `subjects.items[].target_type = movie`，uri 提 sid，cover_url 直出 large 规格）。

## 决策

### 1. 检索改三路兜底链（命中即用）

| 路 | 接口 | 形态 | 定位 |
|---|---|---|---|
| ① | `movie.douban.com/j/subject_suggest` | JSON 数组，id/title/img 直给 | 主路：最快、信息最全 |
| ② | `m.douban.com/rexxar/api/v2/search?q=&count=5` | `subjects.items[]`，uri 提 sid | 二路：与①频控池独立 |
| ③ | `www.douban.com/search?cat=1002&q=` | 搜索页 HTML（ADR-0177 退役的原解析复活） | 末路：最全但最重 |

三路均注入设置项豆瓣 Cookie；Referer 各随其域（movie.douban.com / m.douban.com / movie.douban.com）。

### 2. 链路口径

- 逐路尝试，命中即停（后路零请求）。
- 单路结果三态：hit / **empty（正常应答无结果——可能是软拒绝，交下一路）** /
  blocked（明确被拦：null / 非 JSON / 风控页）。
- 全部走完未命中：任一路 blocked → 整体 blocked（「稍后再试」语义）；
  全 empty → notfound（此时才真是「没有」）。
- 任一路网络异常上抛 → network（C6 不变）。
- 单次解析最多 3 个检索请求，无重试循环、无指数放大。

### 3. 解析细节

- 二路 `parseRexxarSearch`：`target_type` 只留 movie/tv（滤书籍与 smart_box 营销位）；
  sid 从 `uri`（`douban://douban.com/<movie|tv>/<sid>`）提取；`cover_url` 已是 large
  规格直用（`upgradePosterUrl` 对不含 `s_ratio_poster` 的 URL 原样返回，无害）。
- 三路 `parseSearchResults` / `searchPageLooksBlocked` 为 ADR-0129 原实现原样复活
  （`class="result"` 正则 + 尺寸/结构风控判定），测试夹具同步回归。

## 后果

- 「让子弹飞」类场景（①软拒绝）由②兜住；①②同时软拒绝的深频控由③兜住；
  三路频控池相互独立，同时失效需三域全拦，概率大幅低于单路。
- 误报语义修正：软拒绝不再被当成「豆瓣没有这部影视」（notfound 只在三路都
  正常应答且都空时才报）。
- 代价：深频控时单次解析最多 3 次串行请求（③搜索页 ~27KB）；仅发生在①②
  都空/被拦时，正常情况①一跳即中。

## 被否决的方案

- **① suggest 空数组直接判 blocked**：无法与真「没有」区分——豆瓣确有查无此片
  的正常场景，全判 blocked 会让错别字场景失去准确文案；且软拒绝窗口内重试也是空。
- **② 仅 suggest + 重试退避**：软拒绝窗口以分钟计，退避重试把失败延迟拉长且
  依旧失败；换频控池比原地重试有效得多。
- **③ 弃 suggest 全走 rexxar search**：rexxar 响应夹营销位、结构重（两层嵌套），
  且无理由放弃最快的①；rexxar 自身也可能有频控，单路化重蹈覆辙。
- **④ 引入第三方聚合搜索**：apizero 无豆瓣搜索类接口（ADR-0177 已查证），
  引新源徒增凭据与稳定性依赖。
