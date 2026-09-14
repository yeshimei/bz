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

## 门禁

- worktree：`pnpm test` 全绿（除 `preview-freshness` 6 例——worktree CRLF 检出导致的既有环境现象，
  HEAD 基线即 5 例，产物按 ADR-0133 结论在主仓库重出）；`tsc --noEmit` 0 错。
- 原型 CDP 自检：knowledge 16/16（含新增短链 3 条）。
- 主仓库：产物重出后 `preview-freshness` 全绿 + 全量测试 + 构建部署。
