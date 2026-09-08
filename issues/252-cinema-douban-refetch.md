# 252：影院豆瓣盲区补全（打开触碰协议）

日期：2026-09-09 ｜ 分支：feat/cinema-douban-refetch-252 ｜ worktree：cinema-douban-refetch-252

## 背景

用户需求「每次打开影院界面，自动把没获取到豆瓣信息的重新跑」。拷问后定形（ADR-0111）：痛点实为外部守护进程的扫描盲区——只认缺海报，17 条「有海报、缺豆瓣链接」的笔记（限流打断的残缺数据）永不重试。

## 决策（ADR-0111）

- 口径：待补 = 缺豆瓣链接；海报是抓取模式开关（有海报→只补信息，缺海报→完整抓取）。
- 触发：打开影院面板触碰笔记——对「有海报 ∧ 缺豆瓣链接 ∧ 豆瓣检查 ≠ 今日」写 `豆瓣检查: YYYY-MM-DD`，经 chokidar 通道入队；同日一次；完全静默。
- 工具：扫描口径扩为「缺海报或缺豆瓣链接」；`fetchPosterForNote` 加补全分支（有海报跳过下载/字段/embed，仍搜索+详情补字段）。
- 插件不碰豆瓣网络（ADR-0006/0007 维持）；不新增命令，触发挂打开面板。

## 改动

**工具 `tools/obsidian-douban-poster`（独立发版部署）**
- `watcher.js`：`collectMissingPosterNotes` 扫描口径扩为缺海报或缺豆瓣链接（更名 `collectIncompleteNotes`，`watcher.test.js` 同步）。
- `pipeline.js`：`fetchPosterForNote` 补全分支——`hasPoster && !hasDoubanInfo` 时跳过海报下载、海报字段写入与 `insertPosterEmbed`，仅搜索 + `fetchSubjectInfo` 补豆瓣字段。
- 版本 bump → `npm publish` → 全局 `install -g` → `pm2 restart`（部署时确认守护在跑：自启 bat 曾指向已删路径）。

**插件 `src/cinema`**
- `data.ts`：解析 `豆瓣检查` → `CinemaItem.doubanCheck: string | null`。
- 触碰扫描（`index.ts` 内或独立 `douban-sweep.ts`）：`openCinema` → `rebuildItems` 后，对 `poster ∧ !doubanUrl ∧ doubanCheck !== 今日` 的条目经 `app.fileManager.processFrontMatter` 写 `豆瓣检查: 今日`；静默无通知。
- 契约零改动：命令/设置键/smartcat 事件不动；数据零迁移（新字段增量出现）。

**测试**
- `data.test.ts`：`豆瓣检查` 解析。
- 触碰扫描用例：当日不重触 / 缺海报不碰 / 已有链接不碰 / 跨天再触 / 写入后 frontmatter 正确。
- `index.test.ts`（UI 层）：打开面板触发触碰断言；`smoke.test.ts` 同步。

## 验收

- 打开影院面板 → 17 条盲区笔记 frontmatter 出现当日 `豆瓣检查` → `pm2 logs` 见入队 → 数分钟内豆瓣字段写回、面板经既有自动刷新链更新。
- 同日再开不触碰；跨天失败条目再触；补齐成功的笔记不再触碰。
- 全程无新海报文件、无重复 embed。
- 门禁全绿：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证（工具侧 node --test 全绿）。

## 审查修复批（2026-09-09，合并后两轴 review 全部发现闭环）

- **口径单源封口**：工具 `hasDoubanInfo` 从「非空」收紧为合法 http(s) 链接校验（与插件 `doubanUrl` 正则同口径）；连带修复 `readFrontmatter` 不剥包裹引号的读写往返缺陷（否则协议校验对工具自写历史链接永久失配 → 无限重抓）。ADR-0111 决策 1 已补记。
- **pipeline 补全分支可测化**：`fetchPosterForNote` 增依赖注入参数（仅测试用），新增 `test/pipeline.test.js` 5 用例（齐全跳过/补全不下载不换 embed/脏值自愈/完整抓取/搜索无结果）——验收第 3 条自此有自动化佐证。
- **todayStr 复用**：改 `localNow().slice(0, 10)`（core/ui/str），删自写补零拼装。
- **smoke.test.ts 销项**：契约零改动（无新命令/设置/域结构），smoke 无可同步项，豁免；触碰链路由 `index.test.ts` 打开面板断言覆盖（`openCinema` + `openCinemaAnalysis` 两条入口均有用例）。
- **票面补记**：`openCinemaAnalysis` 面板未开分支同样挂触碰（审查认定的合理延伸，本段补录）。
