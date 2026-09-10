# 263 — 每日简报（B 站 UP 视频 字幕/转写 → AI 要点）

- status: spec（需求已拍板，未实现）
- type: §1 feature（新源 + 新数据段 + bili-dl 新能力）
- 分支: 待定（实现时 `daily-brief-263`，worktree 从最新 master 分叉）
- 依据: ADR-0119；ADR-0008（守护）/0060（news.json 段）/0082（剪藏本段契约）/0011（bili-dl 去 AI）；ticket 147（文献盒「CLI 出转录稿 → 插件产笔记」先例）

## 背景

剪藏本需要一个「每日简报」源：盯住指定 B 站 UP 的新投稿，把视频内容变成要点列表供扫读。首个对象 **黑鸦Heya**（mid `3706929260006322`，AI 日报类短视频，28 秒 – 2 分 53 秒，一天多条）。

评估期实测结论（2026-09-10）：
- 该 UP 抽样 6 条视频 `x/player/v2` 字幕**全为空** → 主链路是音频转写，字幕链路为将来别的 UP 留余量。
- 官方 `x/web-interface/view/conclusion/get` 未登录 `-101`，不作为主链路。
- `tools/bili-downloader/` 已具备 wbi 签名 + playurl 多 CDN + ffmpeg + faster-whisper（Python312 已装 1.2.1，`~/.bilibili-dl.json` 已指向）。
- 守护 B 站源当前被风控拦住（`-352/412`），**实际抓不到任何动态**；`~/.bilibili-cookies.json` 存有可用登录 Cookie（含 SESSDATA / buvid3 / DedeUserID，2026-08-09 保存），但 news.json 的 `bilibiliCookie` 段是空的 —— 需接通。

## §0 前置修复（不修则全链路不通）

1. **接通 Cookie**：把 `~/.bilibili-cookies.json` 的 Cookie 写入 news.json `bilibiliCookie` 段（或在守护里增加读取该 rc 文件的能力）。当前 B 站源每轮都在风控失败。
2. **关闭 PM2 watch**：`news-watcher` 现为 `watch & reload: ✔`，插件每次构建都会重启它（实测 restarts 4508）。brief 转写是长任务，会被打断。改为 `pm2 stop` + `--no-watch`/`pm2 delete` 后重建。

## §1 bili-downloader 新能力

### 1.1 UP 投稿列表抓取（新增）

- 新增 `x/space/wbi/arc/search`（wbi 签名 + Cookie）拉指定 mid 的投稿列表 → 返回 `{bvid, title, pubdate, duration, cid?, pic, desc}`。
- Cookie 复用 `~/.bilibili-cookies.json`（`loadCookie` 已有）。
- 与现有 `x/polymer/web-dynamic/v1/feed/space`（动态流）取舍：投稿列表接口直接给 bvid/pubdate/cid，**少一次 pagelist 请求**，且不受「动态只保留有限条」影响。

### 1.2 字幕优先链路（新增，当前工具只有转写）

- 取 `cid`（投稿列表没给就用 `x/player/pagelist`）→ `x/player/v2?bvid&cid` → `data.subtitle.subtitles[]`。
- 命中则取 `subtitle_url`（**必须补 `https:` 前缀**，接口返回 `//` 开头）→ 拉 JSON → `body[].content` 拼接为全文（可保留 `from` 秒用于将来对轴）。
- 无字幕 → 走现有转写链路（`playurl` → ffmpeg 抽音频 → `PY_TRANSCRIBE`）。

### 1.3 brief 模式（新增 CLI 分支）

- 形态：`bili-dl --brief '<base64 JSON>'`（沿用 ticket 147 的 `b64:` 传输约定，防 shell 对引号/空格）或专用参数；JSON = `{mid, items:[{bvid,title}], options:{...}}`。
- 复用现有行协议：`[bz-step]`（解析中/字幕中/转写中）、`[bz-p] {"phase":...,"pct":...}`、`[bz-info] {...}`、`[bz-result] {"ok":[{bvid,source:'subtitle'|'transcript',transcriptPath}],"fail":[{bvid,reason}]}`。
- **单次 spawn 上限 3 条**（分轮消化，见 ADR-0119 §10）。
- 转录稿写入现有缓存目录（`cacheDir` / `cacheRetentionDays`），路径随 `[bz-result]` 交回插件。

## §2 news.json 数据段

### 2.1 新增两段

```jsonc
{
  "briefUps": ["3706929260006322"],   // 每日简报名单（插件侧写，守护只读）
  "briefs": [                          // 简报条目（插件侧写）
    {
      "bvid": "BV1rHYx6fEzy",
      "title": "走向灭亡！Anthropic 员工警告…",
      "url": "https://www.bilibili.com/video/BV1rHYx6fEzy",
      "upMid": "3706929260006322",
      "upName": "黑鸦Heya",
      "duration": 173,
      "pubdate": 1789000000,
      "fetchedAt": 1789010000,
      "body": "## 小节标题\n- 要点…\n- 要点…\n",   // AI 要点（markdown，按小节分组）
      "src": "transcript",               // transcript | subtitle
      "state": "unread",                 // unread | read | saved
      "read": false,
      "error": null                      // 失败时 = "转写失败：…"（错误条目）
    }
  ]
}
```

### 2.2 解析与合并

- `src/clipbook/news-data.ts`：`NewsData` 加 `briefUps: string[]`、`briefs: any[]`；`parseNewsFileContent` 容错解析（非数组 → 空）；`emptyData()` 补默认值。
- **段级合并写回**：插件写 `briefs`/`briefUps` 时必须重读磁盘、只替换这两段（沿用 `writeNewsData` 的合并写回先例），守护写 `articles` 时保留这两段。
- `tools/news-watcher/watcher.js` 的 `readNewsData`/`writeNewsData` 同步保留两段（否则下一轮抓取会抹掉）。

## §3 数据源守护（调度器）

- `watcher.js` 抓取轮里：`briefUps` 名单 UP 与 `bilibiliUps` **各自独立抓**（互斥名单，同一 UP 不重复）→ 拿到的动态/投稿列表**不入 articles**，只用于比对 `briefs` 里已有的 bvid。
- 有新 bvid → `spawn` bili-dl brief 模式，取前 3 条；其余下轮继续。
- 已总结过的 bvid **永久不重跑**（比对 `briefs[].bvid`）。
- 首次启用回溯最近 10 条（对齐 `bilibiliMaxItems` 口径）。

## §4 插件侧

### 4.1 AI 总结

- 触发：守护 spawn 完成后落「待出稿」标记（或插件装载时扫描 `briefs` 中 `body` 为空且无 `error` 的条目）→ 插件读转录稿 → `createAI()`（沿用插件已配 provider）→ 产**要点列表 markdown（按小节分组）** → 写回 `briefs[].body` → 清标记。
- Prompt 要点：输入 = 视频标题 + 简介 + 转写全文；输出 = `## 小节标题` + `- 要点`；**不要时间轴**；语言跟随视频；控制在若干小节内。
- 转录稿在缓存保留期内可展开；过期后阅读区隐藏该区。

### 4.2 剪藏本 UI

- **左栏新增 rail 源「每日简报」**（与 news 流分开成目；条目 = `briefs` 段）。
- 目录内**按天分节**：日期分节头（`YYYY-MM-DD` + 当日条数）+ 当日条目倒序。
- 条目**参与现有状态机**（unread 蓝 / reading 琥珀 / read 空心 / saved 绿），沿用 `clipbook.json` 侧写与域事件。
- 右栏阅读区：要点分节 + 顶部「打开原视频」与视频元信息（时长 / 发布时间）+ 可展开转录稿。
- **错误条目**：`error` 非空时可见列出（标题 + 原因 + 重跑入口）。
- **保存到剪藏本**：保留，但写**专属目录**（新设置项，默认 `归档/每日简报/`）。
- 移动端：随 ADR-0107 目录化口径（章 = 源）。

### 4.3 保留策略

- `briefs` 沿用 articles 段同口径：未读永不清理；已读/已保存骨架超 `newsRetentionUnsavedDays`（默认 30）天删除；起算 = `fetchedAt`。

### 4.4 设置

- 复用「UP 主名单管理」弹窗，新增「每日简报」子列表 + 逐条开关（写 `briefUps`）。
- 新增设置项：简报保存目录（默认 `归档/每日简报/`）。

## §5 验收

- 场景 A：名单为空 → 「每日简报」源空态（不报错）。
- 场景 B：名单有 UP 且无新视频 → 源内容不变，无多余 spawn。
- 场景 C：有新视频且**有字幕** → 条目 `src: 'subtitle'`，正文要点非空。
- 场景 D：有新视频且**无字幕** → 走转写，`src: 'transcript'`，阅读区可展开转录稿。
- 场景 E：风控拦截 → 留一条错误条目，含原因与重跑入口。
- 场景 F：首次回溯 10 条 → 分轮消化（每轮 ≤3 条），全部补齐后不再重跑。
- 场景 G：同一视频不在普通 B 站源出现（互斥生效）。
- 场景 H：插件写 `briefs` 后守护下一轮抓取不抹掉该段。
- 门禁：`pnpm test` + `pnpm exec tsc --noEmit` + 数据层测试（`news-data` 解析/合并 + brief 去重）+ UI 层测试 + smoke.test.ts。

## 待定项（实现时确认）

- rail 源「每日简报」在左栏的**排序位置**（现暂列于「剪藏本聚合」之后）。
- 简报条目是否纳入 smartcat 行为流（打开/保存是否产观察）。
- 是否需要在「每日简报」源提供「手动重跑单条 / 整批」的命令（现仅右键/长按动作入口）。
