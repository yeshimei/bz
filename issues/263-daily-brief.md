# 263 — 每日简报（B 站 UP 视频 字幕/转写 → AI 要点）

- status: done（实现已交付并部署；待用户启用名单后跑端到端）
- type: §1 feature（新源 + 新数据段 + bili-dl 新能力）
- 分支: `daily-brief-263`（worktree 从 master 386884b4 分叉，已合并回 master 6741285b 并删除）
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

## 交付记录（2026-09-10，已合并 master 6741285b 并部署）

**实现摘要**（24 文件，+2358/−59）：

- **工具侧** `tools/bili-downloader/`：`getUpVideos`（`x/space/wbi/arc/search`，wbi 签名；`length` 是 `"MM:SS"` 字符串需转秒）、`getCid`（**`data` 是裸数组**，历史 `data.pages` 形态亦兼容）、`getSubtitle`（中文轨优先——B 站 `lan` 实际值是 `ai-zh` **不以 zh 开头**，先精确后含 zh）、`checkSubtitlePlausible`（时长越界/字速不可能两闸）、`runBrief`（ups 发现 + items 直传；单轮上限 3 条；单条失败不阻断；转录稿统一落缓存 `resume-brief-<bvid>.txt` 以便按 `cacheRetentionDays` 回收）。新增 `--brief` CLI 分支（b64 传输）。
- **守护** `tools/news-watcher/`：`resolveBiliDl`（env `BILI_DL_BIN` → 仓库内同级 cli.js → PATH）、`runBiliDlBrief`（spawn + 解析 `[bz-result]`，异常全收敛）、`dispatchBrief`（读名单/known → spawn → 条目登记进 `briefs`；**与文章入库解耦**——无新文章时同样跑）、`readNewsData` 保留两段、CLI 加 `brief` 子命令。
- **插件** `src/clipbook/`：`news-data` 两段 + `normalizeBrief`/`parseBriefs`/`applyBriefRetention` + `writeNewsDataMerged` 增 `briefs` 键并集与 `removeBriefKeys`；`store` 增 `clipBrief`/`queryBriefs`/`groupBriefsByDay`/`writeBriefState`/`writeBriefPatch`/`deleteBrief`；新 `brief.ts`（待出稿扫描 + 提示词 + `createAI()` + 失败留错误条目）；`render` 增日节头/按天目录/要点轻渲染/阅读面；`ui` 增 rail 源、列表与阅读分支、打开即已读与保存分流、装载后触发出稿；`save` 增目录覆盖；设置增 `dailyBriefDir` 与弹窗「每日简报」组。

**实现期发现（已回写 ADR-0119 修订节）**：

1. 「该 UP 无字幕」是评估缺陷——**未带 Cookie**。带 Cookie 抽样 12 条：可信字幕 3 / 内容错配 6 / 无字幕 3。故字幕必须过校验，转写是主力路径（9/12）。
2. 同一 `cid` 两次调用可能返回**不同**字幕（已实测两例）。校验规则因此不可省。
3. `x/player/pagelist` 的 `data` 是**裸数组**（非 `{pages:[]}`）。
4. 字幕轨 `lan` 值为 `ai-zh`，`/^zh/i` 匹配不到（曾因此误选英文轨，被单测抓出）。
5. 转录稿必须落**受保留期管理**的缓存目录（不能落系统临时目录，插件可能数小时后才读）。

**门禁**：`pnpm test` 254 文件 / 4098 例全绿；`tsc --noEmit` 无错；bili-dl `node --test` 68 例；news-watcher `node --test` 26 例；主仓库 `pnpm run build` 成功并部署（main.js 含新代码、styles.css 含新样式）。
**顺带修复**：过程中被项目两条铁律拦下并改正——① 设置文案 lint（描述不得含全角括号，8–32 字）；② 可读性 lint（禁用 9–10px 字号）。

**前置修复（已完成，环境侧）**：`~/.bilibili-cookies.json` 的登录 Cookie 已写入 vault 的 `news.json` `bilibiliCookie` 段（原文件已备份为 `news.json.bak-20260910-133731`）；PM2 `news-watcher` 已重建并**关闭 watch**（原 watch 使插件每次构建都重启守护，实测累计 4508 次；`pm2 save` 已固化）。重建后守护已能正常抓 B 站源。

## 待定项（实现时确认）

- rail 源「每日简报」在左栏的**排序位置**：现按「日常查阅入口」定位，紧随「全部未读」，其后才是站点行（可随时调整）。
- 简报条目是否纳入 smartcat 行为流（打开/保存是否产观察）——**本期未接**，剪藏本既有 news 事件通道不含简报。
- 简报源的「全部标为已读」批量动作**本期不做**（`flowMarkAllRead` 只认 `articles` 段，简报在 `briefs` 段；已在 `buildRailActions` 显式早返回，避免误批量 news 条目）。
- 是否给 whisper 转写加 `initial_prompt`（本机 faster-whisper 输出**繁体中文**，加「以下是普通话的句子。」可显著转为简体）——这是 bili-dl 的**共享行为**（文献盒同链路），改动会影响既有功能，故未擅自改。
- 「实时进度」：插件侧出稿为装载后一次性补跑，长批（首轮回溯 10 条）期间无逐条进度反馈。
