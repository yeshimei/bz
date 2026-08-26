# bili-downloader 视频缓存 + 文献笔记快速流程

- **范围**：`tools/bili-downloader`（npm 包 `@jwbz/bili-downloader`）——与 bz 插件保持 ADR-0011 独立化边界，新增**单向只读**耦合：AI 配置直读 bz data.json。
- **状态**：五轮 grilling 共识（Q1–Q25，2026-08-25）已达成；**实现已完成并发布**（1.2.0 基础版；1.2.1 快捷命令+时间显示修复；1.2.2 一键全流水；1.2.3 转文字逐段化 + 下载后空段落 + 笔记视频块布局 + 末尾把手跟随）。本 spec 是唯一事实源——后续改动先改 spec 再改码。
- **术语**：`tools/bili-downloader/CONTEXT.md` 新增 快速流程/文献笔记/文献盒/视频缓存 词条；bz 侧 `CONTEXT.md` 四处词条已同步。

---

## 1. 需求（用户原话）

1. b站下载，在转文字后面添加一个快速流程「生成文献笔记」：走流程 剪切，压缩，转文字，AI 生成标题、标签、简介与正文润色；笔记放 `E:\Obsidian\叫我包仔\文献盒`（设置中可配置）；标题、标签、一句话简介作文档属性（frontmatter），正文 = 润色后正文 + `![[视频双链]]`。
2. 下载的视频缓存在本地，保留 7 天（设置中可配置）；下载相同视频优先从缓存获取。
3. AI 的配置直接读 bz 的数据文件；bili-dl 的 rc 配置**不改动、不删减**。

## 2. 现状事实（已调查，`tools/bili-downloader/`）

| 项 | 事实 | 证据 |
|---|---|---|
| 转写文本 | 仅内存 `T.transcript` + 剪贴板，不落盘 | server.js:357、public/app.js:544-549 |
| rc 配置 | `~/.bilibili-dl.json` 六键：outputDir/vaultPath/ffmpegPath/ffprobePath/pythonPath/whisperModel；Cookie/历史独立文件 | config.js:13-25 |
| 依赖 | package.json 零 dependencies；网络出口仅 B站 API https.get 与 CDN 下载 | core.js:25,:168 |
| AI 史实 | ADR-0011 独立化时砍掉「AI 润色/总结（依赖 bz createAI）」与「替换为双链」按钮 | docs/adr/0011:15 |
| wikilink | `makeWiki`：outputDir 解析后在 vaultPath 之内时产出 `![[vault相对路径/文件]]`，否则退化绝对路径 | server.js:75-85 |
| 交付命名 | `标题_BV[_P#][_clip_起-止][_crf#].mp4` / `_merge_N段`；`uniquePath` 重名加序号 | core.js:127-133,:462-470 |
| 历史 | 每交付物一条 {time,title,bv,quality,file,wiki}，上限 50 FIFO | config.js:48-53 |
| 任务模型 | 单任务 `T.phase: idle|parsing|downloading|trimming|compressing|transcribing|ready|done`；中间产物 TMP_DIR=mkdtemp(`os.tmpdir()/bili-dl-`)，退出/取消即删 | server.js:20-31,:198 |
| 测试 | node:test（core.test.js 纯函数 + 条件 ffmpeg 集成、server.test.js 真实 HTTP+SSE） | package.json:18 |

## 3. 决策记录（Q1–Q25，全按用户拍板）

### Round 1（Q1–Q9）

| # | 决策 |
|---|---|
| Q1 | 缓存只存「下载原件」；剪辑/压缩件仍走临时目录即时生成 |
| Q2 | 缓存键 = BV + 分P(cid) + 清晰度，三者全同才命中 |
| Q3 | 缓存目录 rc 新键 `cacheDir`（默认 `%TEMP%/bili-dl-cache`）；服务启动时清扫过期 |
| Q4 | 「视频双链」= 嵌入交付的视频文件（非缓存路径、非 URL） |
| Q5 | 视频仍走既有「完成→交付」；快速流程只在交付后追加 AI + 写笔记 |
| Q6 | AI 配置走 bz（用户追加：路径全简化→后经 Q12/Q15 修正为 rc 不删减） |
| Q7 | 正文轻度润色：口语→书面、去口水词/重复，保原顺序原内容 |
| Q8 | 文件名=AI标题（清洗非法字符+截断 50 字+重名加序号）；frontmatter 四键 title/tags/summary/source |
| Q9 | 失败即中止报错可重试，不产生半成品笔记；成功后 toast + obsidian:// 跳转 |

### Round 2（Q10–Q14）

| # | 决策 |
|---|---|
| Q10 | 配置注入机制：待定（后被 Q18 否决，改直读） |
| Q11 | 独立启动降级：待定（后被 Q18 取消——直读后全功能可用） |
| Q12 | rc 瘦身删键：**被用户否决（不删减）** |
| Q13 | 文献盒路径：定为 rc 新键 `literatureFolder`（默认 `文献盒`） |
| Q14 | AI 三元组注入：**被用户否决（改直读）**；工具侧 AI 调用显式超时 180s/次 |

### Round 3（Q15–Q18，方向修正）

| # | 决策 |
|---|---|
| Q15 | 配置文件冻结：rc 六键原样保留；bz data.json 只读、不加新键（两者都冻结） |
| Q16 | 文献盒路径 = rc 新增键 `literatureFolder`（默认 `文献盒`），网页设置加输入框 |
| Q17 | 缓存保留天数 = rc 新增键 `cacheRetentionDays`（默认 7），网页设置可配 |
| Q18 | AI 直读：工具按 rc `vaultPath` 读 `.obsidian/plugins/bz/data.json`（aiProvider + 对应 apiKey），自持 provider→baseUrl/model 映射副本；无 quickadd 回退；缺 key 报错；独立启动全功能可用 |

### Round 4（Q19–Q23）

| # | 决策 |
|---|---|
| Q19 | 命中流程：解析照跑 → 命中跳过下载+合并 → 缓存原件复制入 TMP_DIR 充当下载原件；未命中下载后回写缓存 |
| Q20 | 分开交付多文件：笔记正文末尾**全嵌**（N 个交付文件连排 N 行 embed） |
| Q21 | **不加** B站底标签，纯 AI 生成标签 |
| Q22 | 超长转录：按段落分块多次调用、逐块轻润色拼接，正文全量保真 |
| Q23 | 生成成功**写历史**：给本次交付条目追加可选 `note` 字段（最新一条），零迁移；`标题.md` 重名加序号永不覆盖 |

### Round 5（Q24–Q25）

| # | 决策 |
|---|---|
| Q24 | 「生成文献笔记」按钮在「完成」交付后启用；未交付先点 toast 提示「请先点完成」🔁 **2026-08-25 两次追加修订**：**1.2.1** 改为底部常驻快捷命令（未交付自动先交付、已交付跳过）；**1.2.2** 再扩为**一键全流水**——点击自动执行 剪切/压缩 → 转文字 → 交付 → AI → 写笔记；前置仅为「已下载」（按钮下载后即点亮），转文字并入链条自动补跑 |
| Q25 | 历史形态 = 交付条目追加可选 `note` 字段；不另增历史条目 |

## 4. 域模型（对齐 CONTEXT.md）

- **视频缓存 (Video Cache)**：下载原件的跨任务持久缓存；键 = {BV, cid, 清晰度}；超期清理；剪辑/压缩件不进缓存。
- **快速流程 (Quick Flow)**：一键全流水快捷命令——点击后自动执行 剪切/压缩（随交付）→ 转文字（未转录自动补跑）→ 交付 → AI 生成元数据 + 轻润色正文 → 落文献笔记；已交付/已转录则跳过对应步骤。
- **文献笔记 (Literature Note)**：frontmatter 四键 + 润色正文 + 交付文件 embed；存于文献盒。
- **文献盒 (Literature Box)**：vault 内目录，默认 vault 根下「文献盒」，rc `literatureFolder` 可配。
- **历史条目 (History Entry)**：交付台账条目；可选新增 `note` 字段记录文献笔记路径（交付记录的扩展，非独立条目）。

## 5. 功能规格

### F1 视频缓存

- 缓存目录：rc `cacheDir`（可选），缺省 `%TEMP%/bili-dl-cache`；服务启动时清扫超 `cacheRetentionDays`（默认 7）天的条目。
- 命中判定：解析完成后以 {bv, cid(分P), 清晰度} 组键查缓存；三者全同命中。
- 命中流程：跳过下载+合并，缓存原件复制进 TMP_DIR 充当「下载原件」（后续剪辑/压缩/转文字不变）；页面 toast「缓存命中」。
- 未命中流程：照常下载+合并；下载原件回写缓存（复制）。
- 生命周期：缓存独立于 TMP_DIR——任务中止/窗口退出不清缓存；只在启动清扫删过期。

### F2 AI 配置直读

- 生成笔记时读取 `<vaultPath>/.obsidian/plugins/bz/data.json`：`aiProvider` + 对应 apiKey（`opencodeGoApiKey` / `deepseekApiKey`）。
- provider 映射（与 bz `src/core/ai.ts` 同套，工具侧复制一份）：opencode-go → baseUrl `https://opencode.ai/zen/go/v1` + 模型 `deepseek-v4-flash`；deepseek → 官方端点 + 模型（实现时与 bz 侧同步核对）。
- 读取失败/字段缺失 → 报错「AI 密钥缺失：请先在 bz（备忘录）插件的设置中填写」，中止本次生成；不复制 bz 的 quickadd 回退。
- 调用走 node 原生 https（零依赖保持）；每次调用显式超时 180s。

### F3 文献笔记生成

- 入口：底部快捷命令「📄 生成文献笔记」（转文字旁），恒可见；`S.dur > 0`（已下载）才可点（前端 `updateGenNote`）。点击后前端链条：**①** 未转录 → 自动调 `POST /api/transcribe`（带 segments；按段落逐段转录，SSE 进度流式进文本区）并写入 `S.transcript`；**②** 未交付 → 调 `POST /api/done`（复用交付参数 segments/mode/crf，内部完成剪切/压缩/交付，trim-progress SSE 推进度）→ `showDelivered`；本任务已交付（`S.delivered`）则跳过①②直走 ③；**③** 调 `POST /api/note`。`/api/note` 服务端仍要求 `T.phase === done` + 转录存在（前置防线不变，链条保证先满足）。
- **1.2.3 修订——转文字跟随剪辑语义**：`/api/transcribe` 带 segments 时**逐段转录**（每段 prepare 后分别跑 faster-whisper，存 `T.segmentTranscripts{segId:text}`，`T.transcript`=各段拼接）；不传或整片单段 → 转录当前预览原件。下载后**段落为空**（不再自动生成整片段落，手动圈选「+ 添加段落」）；空段落 = 整片交付/转录。
- **1.2.3 修订——笔记视频块布局（用户拍板）**：分开交付多段 = 每文件「视频链接、对应转文字」依次排 N 块；合并交付 = 单块「视频链接、整段转文字」；正文（润色全文）在其前。
- **1.2.4 修订（2026-08-25，未发布·本地验证期）**：快捷命令改**严格顺序五步**——①应用剪辑（逐段 `/api/trim`）→②应用压缩（选档逐段 `/api/compress`）→③转文字→④AI 润色（**新端点 `/api/note-prepare`**：元数据+分块润色存 `T.polishedNote`）→⑤生成笔记（`/api/done` 交付 + `/api/note` 写笔记复用润色结果，AI 只跑一次）；各步串行 await 绝不并行，`#flow-status` 显式展示步骤；**转录单进程单次模型加载多文件转**（PY_TRANSCRIBE 多文件 + `\x1e/\x1f` 单元分隔 + `parseTranscriptUnits` 归位，修多段「一直转录中无效果」）；修草稿态滑块被 `syncFromActive` 重置导致的把手不跟随/回零；压缩完成清「100% 编码中」残影。
- **1.2.5 修订（2026-08-25，未发布·本地验证期）**：修两处 `gen-note` 链条 bug——① `/api/trim` 与 `/api/compress` 调用漏传 `'POST'`（body 对象被当 method 参数，报 `'[object Object]' is not a valid HTTP method`，链条第一步即失败）；② **段落语义统一（用户拍板）**：三入口（转文字 **/ 完成 / 生成文献笔记）共用前端 `resolveSegments()`——若**已有段落**按段落走（不区分是否拖拽）；若**无段落但拖拽了把手**（draft 非整片）则自动把草稿范围添加为段落再走；若**既无段落也未拖拽**（整视频、未圈选）则生成文献笔记**跳过 ①剪切/②压缩**、③转文字走整片、再 ④⑤（已完成交付则仅 ④⑤）。
- **1.2.6 修订（2026-08-25，未发布·本地验证期）**：**转录死锁根因修复**——faster-whisper 在本机 `transcribe(..., vad_filter=True)`（Silero VAD）会**永久挂起**（实测模型 2.1s 加载后 60s+ 零输出），表现为「一直转录/无字」；改为 `vad_filter=False` 后 3s 音频 3.6s 完成、逐文件 `\x1e/\x1f` 归位正常。定位方式：ffmpeg 生成 3s 测试音频 → node 子进程观测 python stdout/stderr（未在 harness 内 import faster_whisper）。**教训：凡转录卡死先做「小音频 + 子进程观测」冒烟，勿反复让用户整片重试。**
- **1.2.7 修订（2026-08-25，未发布·本地验证期，grilling 二轮 Q1–Q5 拍板）**：
  - **繁→简（Q1）**：不做本地转换库；AI 润色提示词强制**输出简体中文**兜底（繁体转写一并转简）。
  - **润色稿回填**：`/api/note-prepare` 返回润色全文，前端把「转文字」文本框原文**替换为润色稿**（`S.transcript` 同步）。
  - **笔记结构（Q2）**：去掉独立「原文」段与块内转录文字——改为逐段「**该段润色正文 + 该段视频双链**」依次排布；合并/单段 = 一组。润色改**按段落分别进行**（段内超长仍切块），`T.polishedNote` 扩为 `{meta, bodies:[{segId,text}], whole}`。
  - **元数据规则（Q3=B）**：标题/tags 规则对齐 bz 自动摘要（标题 15-30 字完整陈述句或疑问句，禁冒号/破折号/句中句号问号；tags 3-6 个每个 ≤5 字，涵盖主题领域/关键概念/应用场景）；**简介维持一句话 ≤60 字**。
  - **frontmatter 七键（Q4）**：`title/tags/summary/url/date/author/videoTitle`——`source` 改名 `url` = `https://www.bilibili.com/video/<BV>`（分P 追加 `?p=N`）；`date`=生成时刻本地时间 `"YYYY-MM-DD HH:mm:ss"`；`author`=UP主（解析 uploader）；`videoTitle`=视频原标题。
  - **AI 润色进度（Q5=B）**：服务端逐块广播 `note-progress` SSE，前端 flow-status 实时显示「生成标题/标签/简介…」「AI 润色（第 x/y 块）…」。
  - **双重压缩 bug 修复**：交付端 doDone 不再看缓存标记重复编码——prepared 条目 `mode==='reencode'` 时跳过再次压缩（分开/合并两分支）。
  - **杂项**：按钮「✂ 应用裁切」→「✂ 裁切」；右下角「转文字」按钮移除（转文字只属快捷命令流程）；笔记生成成功后自动 `obsidian://` 打开（浏览器首次弹外部协议确认属正常）。
  - **审查修复（同日二轮）**：① **转录签名** `transcriptSig`/`flowSig`（段落 id+起止 0.1s 粒度，整片=`full`）双侧校验——签名不符自动重转，杜绝「整片稿被分段复用 → 笔记丢正文」「换视频残留旧稿报请先转文字」「改段落时间不重转」三类隐形 bug；下载成功/resetUI 清客户端转录与签名。② prepare 成功后服务端 `T.transcript` 同步为润色全文（交付剪贴板不再夹带繁体原文）。回归测试：`POST /api/transcribe` 签名早退/重转用例（66 tests 全绿）。
- 步骤（AI 部分，note-prepare 内）：① 元数据调用（`response_format: json_object`）→ {title, tags[], summary}；② 正文润色——转录按段落切块（块大小控 token 预算），逐块轻润色、按序拼接；任一步失败即中止、可重试，不落半成品。
- 成功：写笔记（F4）→ toast → `obsidian://open?vault=<vaultPath 末段>&file=<文献盒相对路径>` 跳转（URL 编码）。

### F4 笔记落盘

- 路径：`<vaultPath>/<literatureFolder>/<文件名>.md`；文件名 = AI title：清洗 Windows 非法字符、空白折叠、截断 50 字；重名 `uniquePath` 风格 `标题_2.md` 递增，**永不覆盖**。
- frontmatter（YAML 引号风格，对齐 auto-summary/news）：
  ```yaml
  ---
  title: "..."
  tags:
    - "..."
  summary: "..."
  source: "BV… 或原链接"
  ---
  ```
- 正文（1.2.3）：润色拼接全文 + 空行 + **视频块**（复用 `makeWiki` 的 vault 相对路径逻辑）——分开交付每交付文件一块 `![[文件]]\n\n该段转录` 依次排；合并交付/整片单块 `![[文件]]\n\n整段转录`。

### F5 历史

- 生成成功后，给本任务本次交付的历史条目追加 `note: <文献笔记 vault 相对路径>`（可选字段，旧历史零迁移）；重复生成为新文件名则更新为最新一条。

### F6 设置（网页 ⚙️ 弹层）

- 既有六字段原样保留；新增三字段：`cacheDir`（可选）、`cacheRetentionDays`（默认 7）、`literatureFolder`（默认 `文献盒`）。

## 6. 验收清单（node:test 新增）

- [x] 缓存：键构造 / 命中 / 未命中回写 / 过期判定（core 纯函数）；命中流程复制行为、toast 文案（server 层）
- [x] AI 配置：bz data.json 解析（provider + key）、缺 key 报错文案、provider 映射正确
- [x] 笔记生成：元数据 JSON 解析容错、分块顺序拼接、文件名清洗/截断/去重、frontmatter 生成、embed 行列表（分开 N 行/合并 1 行）、obsidian:// URL 编码
- [x] 失败路径：AI 超时/报错 → 中止、无半成品文件落盘、可重试（未交付/未转文字前置报错用例覆盖）
- [x] 历史：`note` 字段追加与更新、旧条目无字段兼容
- [x] 全量门禁：`npm test` 60 全绿（真实 ffmpeg 集成段条件跳过不变）

---

## 7. 不做的事（明确排除）

- 不改 bz 插件源码/数据文件；不加 bz 侧新设置键；不复制 bz 的 quickadd 回退。
- 不删 rc 既有键；不自动清理已交付文件。
- 文献笔记不进下载历史作为独立条目（只挂在交付条目 note 字段）。
- 不自动下载/解析（快捷命令从已下载的视频开始；解析/下载仍为按钮手动触发，缓存命中可加速重复视频）。