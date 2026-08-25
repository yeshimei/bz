# 01 — 视频缓存 + 文献笔记快速流程（grilling Q1–Q25 收口）

**1.2.1 修订（2026-08-25）**：Q24 追加修订——「生成文献笔记」改为底部常驻**快捷命令**，点击后后续步骤自动执行（未交付自动先交付，已交付跳过；前置仅已下载+已转文字）；并修复 `fmtPrec` 秒位溢出显示 bug（`pad(ss%60)`）。更新已同步 spec.md / 工具 CONTEXT.md / 本 issue。

**What to build:** `tools/bili-downloader` 新增两项能力：① 下载原件 7 天本地缓存（键=BV+cid+清晰度，命中跳过下载+合并，启动清扫过期，rc 新键 `cacheDir`/`cacheRetentionDays`，默认 `%TEMP%/bili-dl-cache`、7 天）；② 「生成文献笔记」快速流程（「完成」交付后触发：AI 直读 `<vaultPath>/.obsidian/plugins/bz/data.json` 生成 title/tags/summary + 按段落分块轻润色拼接，落 `<vaultPath>/文献盒/<标题>.md`——rc 新键 `literatureFolder` 默认 `文献盒`；frontmatter 四键 title/tags/summary/source；正文=润色全文+交付文件 embed 连排；成功 toast + obsidian:// 跳转、历史交付条目追加可选 `note` 字段；失败即中止可重试）。rc 既有六键零改动；bz data.json 只读；零 npm 依赖保持（原生 https，每次 AI 调用 180s 超时）。

**Blocked by:** 无 — 可立即开始（bz 插件侧零改动，纯工具侧）

**Status:** done（1.2.0，`npm test` 60 全绿，2026-08-25）

- [x] F1 视频缓存：`cacheDir`/`cacheRetentionDays` rc 键 + 启动清扫 + 命中/未命中回写 + toast「缓存命中」；缓存独立于 TMP_DIR
- [x] F2 AI 直读：bz data.json 解析（aiProvider + 对应 key）+ provider→baseUrl/model 映射副本 + 180s 超时 + 缺 key 报错（无 quickadd 回退）
- [x] F3 生成流程：元数据 JSON 调用 + 分块润色拼接 + 任一步失败中止可重试、零半成品
- [x] F4 落盘：文件名清洗/截断 50/重名加序号永不覆盖 + frontmatter 四键 + 正文 embed 连排（分开 N 行/合并 1 行）+ obsidian:// 跳转
- [x] F5 历史：交付条目追加可选 `note` 字段（最新一条，旧数据零迁移）
- [x] F6 设置 UI：网页 ⚙️ 新增三字段（cacheDir / cacheRetentionDays / literatureFolder），既有六字段原样
- [x] 测试：node:test 新增（缓存键/命中/过期、data.json 解析、文件名/frontmatter/embed、历史 note、超时中止不落盘），`npm test` 60 全绿
- [x] 文档：[x] ADR-0049、[x] `tools/bili-downloader/CONTEXT.md` 四词条+规则、[x] bz `CONTEXT.md` 四词条、[x] `spec.md`（本票唯一事实源）