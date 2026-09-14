# 0134 — b23.tv 短链解析：落地页 `og:url` / `__INITIAL_STATE__` 补全元信息并写回规范链接

## Context

ADR-0133 把视频录入改成「链接 + 解析按钮」后留下一条已知限制：**b23.tv 分享短链只拿得到标题**。
`requestUrl` 的响应不暴露重定向目标（无 final URL 字段），而短链 URL 里没有 BV 字样，`parseBvid`
为 null → 直接落到「页面 `<title>` 清洗」这一级，`uploader`/`pages`/`duration` 全缺、`cid` 无从而来
（档位查询也就无从发起）。2026-09-14 用户在手机端粘贴 App 分享出来的 `https://b23.tv/AtDgBVH` 复现：
信息区只有标题、UP 主「（未取到）」、分P 退化成空数字框、清晰度只剩「最高」。**这不是移动端限制**
（同一链接在桌面端表现一致），而是短链路径本身的空缺。

实测（本机直连，curl 跟随重定向后取体）：

- `https://b23.tv/AtDgBVH` → `302` 到 `www.bilibili.com/video/BV1twYY6dEwB/?…`（桌面 UA）
  / `m.bilibili.com/video/BV1twYY6dEwB?…`（移动 UA），两版落地页都带
  `<meta property="og:url" content="https://www.bilibili.com/video/BV1twYY6dEwB/">`，**bvid 就在落地页 HTML 里**。
- 落地页的 `window.__INITIAL_STATE__` 桌面版为 `videoData`、手机版为 `video.viewInfo`，**字段与
  `x/web-interface/view` 的 `data` 同名**（`title` / `owner.name` / `duration` / `cid` / `pages[{page,part,duration,cid}]`）。
  取多 P 视频（BV1yuY96rEL7，4 P）三方逐字段比对：API / 桌面页 state / 手机页 state 的
  title、owner、duration（1015 = 各 P 之和）、pages（part/cid/duration）**完全一致**。
- 桌面 UA 拿到的页面才是带 `__INITIAL_STATE__` 的 SSR 页（无 UA / 非常规 UA 可能回拦截页）；
  页面响应可能是 gzip（`requestUrl` 由 Electron/Capacitor 层解码，体层无需自理）。

同根因的第二处伤：`normalizeSourceUrl` 对 b23.tv 短链只剥 query、**保留短链形态**（当时无网络无法展开，
有意为之），而下载器 `tools/bili-downloader/extractBv` 只认 URL 里的 BV 号——短链任务进队列后会在
下载阶段直接抛「无法从链接中识别 BV 号」。已存量的短链任务（带标题的）也因 backfill 只筛「缺标题」而永不修复。

## 决策

- **短链走「落地页 → bvid → view API」**：`fetchVideoMeta` 在输入无 BV 字样但属 B 站域时，先抓一次落地页
  HTML，从 `og:url` 取 bvid（退 `__INITIAL_STATE__` 的 `"bvid"` 字段），再走既有 view API 拿规范元信息；
  API 不可用（风控/超时/异常）时**直接用落地页 state** 的 title/uploader/pages/duration，页面也无 state 时
  才退化到 `<title>` 清洗。降级链因此变为：view API → 落地页 state → 页面 `<title>` → 失败态。
- **页面请求带桌面 UA + Referer**（`apps/web-interface` 之外的唯一请求头改动）：只有桌面 UA 才稳定拿到
  带 state 的 SSR 页。API 请求头维持原样（实测裸请求即通，不引入新变量）。
- **`metaFromVideoData` 净化单源**：view API `data` / 桌面页 `videoData` / 手机页 `video.viewInfo`
  三处共用同一份字段净化（title/uploader/duration/pages 口径、`page` 缺省按序补、`duration` 回落总时长、
  无 `cid` 剔除），避免三份手写解析漂移。
- **`VideoMeta` 新增 `bvid?`**：抓到的 bvid 随 meta 回传——短链场景调用方（切 P 查档、写回规范链接）
  否则无从得知。调用方一律用 `meta.bvid || parseBvid(input)`。
- **短链成功解析后写回规范链接**（`canonicalVideoUrl`，source.ts）：弹窗输入框当场改写为
  `https://www.bilibili.com/video/BV…/`（用户看得见落地目标），保存落库同一形态兜底；**存量短链任务
  由打开面板的自动重抓顺手修复**——backfill 的筛选条件从「缺标题」扩为「缺标题 **或** URL 里没有 BV 号」，
  `_persistResolved` 在 meta 带 bvid 时补写 `url`（只补不覆盖其余字段，会话内不重复尝试）。
- **bvid 提取只认「本页视频」**（review 307 P2）：og:url 必须是 **`/video/BV…` 路径段**——列表/收藏夹页的
  `og:url` 形如 `/list/ml123?oid=…&bvid=BV…`（推荐位），命中它会把用户链接悄悄改写成无关视频；state 的 bvid
  只从**已解析出的视频数据体**（`videoData` / `video.viewInfo`）里取，不做全页 `"bvid"` 正则（正文里到处是别的
  视频）。非视频 B 站页（列表/收藏夹/番剧）因此回到「只给标题、不动 URL」的 ADR-0133 行为。
  同时新增 `needsBvidRepair(url)`（B 站域且 URL 无 BV）作为 backfill 与落库修补的判据——非 B 站链接（YouTube 等）
  不进重抓队列，已成功（`status === 'success'`）的任务只补信息、不改 url。
- **成功判据 = 拿到 bvid 或 meta 有内容**（只有 bvid 的 meta 也算成功，调用方据此写回规范链接）；
  页面完全没认出本视频（无 `/video/BV…` og:url、无视频 state、无标题）才算失败——失败态与既有口径一致。
- **不改 `normalizeSourceUrl` 对 b23.tv 的既有语义**（无网络时无法展开）：短链的展开是**联网解析成功后**的
  行为，净化层保持纯函数。

## Consequences

- 手机端（以及桌面端）粘贴 App 分享短链：标题 / UP 主 / 分 P / 时长 / 实测档位全部到位，一次页面请求
  即可拿到（API 可达时为两次）。
- 下载链路修复：短链任务落库即规范链接，`extractBv` 认得出；存量短链任务开面板自愈。
- 落地页 state 兜底让「API 被风控但页面可达」的环境（部分移动网络）不再只剩标题；代价是页面体
  （~60–160KB）比 API JSON 大，仅在短链或 API 失败时才抓。
- 抓取仍全程静默（零 toast），失败态与既有口径一致；联网范围仍限 B 站域。
- 依赖 B 站页面结构（`og:url` + `__INITIAL_STATE__` 字段名）。三者任一变化时降级到 `<title>`（回到
  ADR-0133 的限制态），不会比现状更差；实现把「三方同口径」写成测试罐头，结构变更会在测试里显形。
- 降级链最坏耗时上界 = 页面 10s + view API 10s + nav 10s + playurl 10s（每级各自超时，超时只放弃结果不中断
  请求）——短链比完整链接多一级页面抓取；手动解析期间「解析/保存」禁用，弱网观感是等待而非卡死（可接受，
  不引入请求中断能力）。
- 术语表：「录入元信息」补短链路径与写回规范链接；新增「短链解析」词条。
