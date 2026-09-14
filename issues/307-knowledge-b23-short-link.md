# 307 — b23.tv 短链解析：落地页补全元信息 + 写回规范链接（ADR-0134）

**状态：进行中** · 域：knowledge（+ tools/bili-downloader 契约） · 发起：2026-09-14 用户手机端实测反馈

## 现象

手机端粘贴 B 站 App 分享出来的短链（`https://b23.tv/AtDgBVH`）点「解析」：
信息区只有标题，UP 主「（未取到）」、分P 退化成空数字框、清晰度只剩「最高」。

## 根因（实测确认）

1. 短链 URL 里没有 BV 字样 → `parseBvid` 为 null → 走「页面 `<title>` 清洗」兜底，`uploader`/`pages`/`duration`/`cid` 全缺。
   **与移动端无关**（桌面端同一链接表现一致），是 ADR-0133 明写的已知限制。
2. `requestUrl` 响应不暴露重定向目标（无 final URL 字段），但**落地页 HTML 里有 BV 号**：
   `<meta property="og:url" content="…/video/BV…/">`，且 `window.__INITIAL_STATE__`
   （桌面 `videoData` / 手机 `video.viewInfo`）的 title/owner/duration/pages 与 view API `data` 逐字段一致
   （多 P 视频三方比对通过）。
3. 同根因第二处伤：`normalizeSourceUrl` 对 b23.tv 短链只剥 query（有意保留形态），而下载器
   `extractBv` 只认 URL 里的 BV 号 → 短链任务进队列后下载阶段抛「无法从链接中识别 BV 号」。
   存量短链任务（已带标题）也不在 backfill 的筛选条件内，永不修复。

## 改动

- `src/knowledge/video-meta.ts`：
  - 新增 `parseBvidFromHtml`（og:url 优先 / state 的 `"bvid"` 字段兜底）、`extractInitialState`
    （平衡括号扫描取 `__INITIAL_STATE__` JSON）、`videoDataFromState`（桌面 `videoData` / 手机 `video.viewInfo`）、
    `metaFromVideoData`（**三处共用的字段净化单源**，与 view API 口径完全一致）。
  - `fetchFromPage`（一次页面请求，带桌面 UA + Referer）取代原 `fetchFromPageTitle`：
    bvid + meta（state 优先，退化 `<title>` 清洗）。
  - `fetchVideoMeta` 降级链：view API → 落地页 state → `<title>` → 失败态；短链（无 BV 字样）先抓落地页
    补出 bvid 再走 API。`VideoMeta` 新增 `bvid?` 回传。
  - `resolveVideo` 用 `meta.bvid || parseBvid(input)` 查档位（短链也能出实测档位）。
- `src/knowledge/source.ts`：新增 `canonicalVideoUrl(bvid)`（`normalizeSourceUrl` 语义不动）。
- `src/knowledge/ui.ts`：解析成功后**写回规范链接**；切 P 的档位查询用 `meta.bvid`；
  保存落库按 `meta.bvid` 兜底规范链接；backfill 筛选条件扩为「缺标题 **或** URL 无 BV」，
  `_persistResolved` 顺手补写 `url`（存量短链任务自愈）。
- 原型：`fake/fake-obsidian.ts` 加 b23 落地页罐头；`prototype.html` 自检加 3 条短链断言。
- 测试：`video-meta.test.ts` 15→24（短链/state 兜底/手机形态/坏 JSON/API 失败回退）；
  `ui.test.ts` 33→35（短链解析写回 + 切 P 查档 + 落库规范 URL；存量短链任务自愈）。

## 独立 review 结论与修复（2026-09-14）

- **P2（已修）bvid 提取无页面类型限定**：实测 `https://www.bilibili.com/list/ml…` 的 `og:url` 带
  `?bvid=` 查询串、正文另有推荐位 `"bvid"` —— 会把用户链接/存量任务 URL 静默改写成无关视频。
  修法：og:url 只认 **`/video/BV…` 路径段**；state 的 bvid 只从 `videoData` / `video.viewInfo` 取
  （全页 `"bvid"` 正则删除）；新增 `needsBvidRepair(url)`（B 站域且 URL 无 BV）作 backfill/落库判据，
  非 B 站任务不进队列、已成功任务不改 url。补「非视频 B 站页 → 只给标题、URL 不变」测试。
- **P3（已修/已收口）**：① 成功判据明确为「拿到 bvid 或 meta 有内容」（bvid-only meta 也算成功，
  页面完全认不出本视频才失败）——补 bvid-only 用例；② backfill 域/状态收口（见上）；③ `_switchAddPage`
  档位查询补 `addUrlSeq` 判据（切 P 后改输入的迟到档位不再渲染，测试已证明「去掉判据即红」）；
  ④ 补齐 state 边界用例（og:url 无 BV 但 state 有、手机页无 og:url、字符串含 `{}`/转义、marker 后无 `{`）
  与 `resolveVideo` 短链请求顺序断言；⑤ 写回规范链接的「在途响应不改写输入框」补测；
  ⑥ `meta.bvid` 兜底补隔离用例（把输入框换回短链形态再切 P）。
- P3-1（短链最坏 40s 超时）不改行为，已写进 ADR 后果段与函数注释（每级 10s 各自超时）。

## 门禁

- worktree：`pnpm test` 全绿（除 `preview-freshness` 6 例——worktree CRLF 检出导致的既有环境现象，
  HEAD 基线即 5 例，产物按 ADR-0133 结论在主仓库重出）；`tsc --noEmit` 0 错。
- 原型 CDP 自检：knowledge 16/16（含新增短链 3 条）。
- 主仓库：产物重出后 `preview-freshness` 全绿 + 全量测试 + 构建部署。
