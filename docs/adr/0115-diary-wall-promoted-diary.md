# ADR-0115：日记本正名——回忆墙升格为日记本（旧 diary 编辑域退役）

日期：2026-09-09 ｜ 状态：采纳（issue 256）

## 背景

旧 `src/diary` 域（媒体流式编辑面板 + 写链路，18 文件约 5600 行）在 AGENTS.md 冻结多年「只保写安全，不投资」。ADR-0081 建立回忆墙（`src/diary-wall`）作为日记数据的媒体优先只读视图，其 v2 自包含改造（parser/config/types 零 `../diary` 依赖）就是为「日后删除日记本域」铺路；`diary-wall/config.ts` 头注释已言明此事。两域并存导致：home 双磁贴、CONTEXT.md 词条 Avoid 互斥、目录键两份真理（`movieDirectory` 与 `cinemaFolderPath` 互不联动）。正名方案（diary-wall→日记本）此前暂缓，今日用户拍板执行，经 grill 两轮六问定形。

## 决策

1. **旧域退役，回忆墙升格正名**：删除 `src/diary`；`src/diary-wall` 改名 `src/diary`，成为「日记本」。命令接手旧域空出的 `bz-diary-open`「日记本」（icon `notebook-pen`，用户旧快捷键/ribbon 无缝延续）；`bz-diary-write`「写日记」保留；`bz-diary-wall-open` 退役。CSS 前缀 `bz-diary-wall-*`→`bz-diary-*`；设置键 `diaryWallSkin`→`diarySkin`、`diaryWallSkinTheme`→`diarySkinTheme`（占位键，值零迁移）。
2. **写链路迁入，编辑面板退役**：写日记命令 + 弹窗（openAddDialog 及其滚轮时间选择器、标签选择器）+ store 写层（`# emoji序列 HH:mm` 条目全量重写、同路径串行队列、未解析行拒写守卫）+ 修复引擎与修复弹窗 + 加密编排（原 `diary/encrypt.ts`，复用 encrypt 域 SafeManager）全数迁入新域；旧面板的条目列表/编辑/筛选/标签栏 UI 随域退役，条目级修改直接改 md。recap 的 AI 摘要写回走数据层 addEntry/deleteEntry，不受影响。`bz-diary-write` 进 main.ts COMMANDS 表直挂（回调自确保数据加载），旧域「启动即 init」链路退役。
3. **墙既有交互原样保留**：改标签/加密/删除/双击跳原文（openLinkText 原生锚点，不依赖旧面板）/抽屉/右键菜单全部随迁移保留；唯一退役动作 = 右键「在日记本中查看」（`showDiaryPanel+applyFilter` 旧面板直达，宿主已亡）。
4. **设置按消费面收编**：迁入 `diaryDirectory`（日记目录）、`letterDirectory`（信目录）、`useFileDateTime`（写弹窗时间口径）；退役 `movieDirectory`/`showTagCount`/`diaryBatchSize`/`diaryTagShowEmoji`/`diaryContentRenderMode`/`diaryTagSortMode`/`diaryDefaultDateFilter`/`diaryDefaultSelectedTag`/`diaryJumpToEditAfterSave` 与旧皮肤键，设置页不留死键。外观组沿用 issue 246 范式（`diarySkin` 布局行「媒体墙」+ `diarySkinTheme` 主题行「画廊白」layoutKey 联动）；维护组保留「日记解析检测」按钮（修复弹窗入口落设置页）。**目录唯一真理跨域化**（用户拍板「影视部分走影院的」）：影视目录读影院域 `cinemaFolderPath`，书库目录读书架墙域 `resolveFolderPath()`；`settings.ts`「互不联动」注释与 `cinema/settings.ts:40`「日记本设置的影视目录仅用于归类」desc 同步翻转。recap/home/smartcat 对目录常量与 parser 的引用改指新域。
5. **单源原型化一批到位**：按 bookshelf 范式补齐 `render.ts`（markup 单源）+ `fake-sim.ts` + `fake/fake-obsidian.ts`（getResourcePath/TFile/metadataCache 假层，favorites/home 先例）+ `prototype.html` 双 iframe 评审壳 + `prototype-view.html` + `prototype-data.js`（真实 vault 快照，抓取脚本先例 fetch-home-data.js——媒体墙必须真实媒体才有评审意义）+ `prototype-icons.js` + `PROTOTYPE.md`；登记 `build-preview.mjs` PREVIEW_DOMAINS/BEHAVIOR_DOMAINS（域 id `diary`）与 preview-live META；render-purity 守卫覆盖；selftest 必含 CSS 生效断言（view 页 CSS 路径 404 前科）。
6. **外围归一**：home 双磁贴（diary+wall）并一（日记本，notebook-pen，`bz-diary-open`），建议文案「回忆墙」改词；settings-panel 域条目 id `diary-wall`→`diary`、名「日记本」，徽标计数动态自适配，行为包重出；`core/domain-icons` 删 `diary-wall` 键；smoke.test 命令全集更新；tests/diary（写/守卫/parser/store/修复/加密用例迁移适配，面板列表 UI 用例退役）与 tests/diary-wall 并归 `tests/diary`。

## 取舍

- **编辑面板退役 vs 并入**：用户拍板「回忆墙就是日记本」，不养第二视图；代价是条目级列表编辑/筛选 UI 消失，但墙的右键/抽屉已覆盖改标签/加密/删除，跳原文覆盖到达，写链路完整保留——功能面净损失趋零，心智面从两域归一。
- **全改名 vs 只改门面**：彻底正名一步到位，`bz-diary-open/bz-diary-write` 两个对外 ID 跨域无缝；代价是目录/CSS/键名大范围替换，与单源化（本就要全量翻 ui.ts/styles.css）合并成一遍，边际成本低。
- **跨域目录键 vs 独立键**：影视/书库各消灭一份真理；代价是 diary→cinema/bookshelf 的函数级读取（依赖方向符合 ADR-0002 core←域 规则，函数级不违约束），checkup 读 `resolveWeaveDataPath` 已有先例。

## 关联

ADR-0081（回忆墙建立与自包含，本决策的铺路石）/ ADR-0017（加密复用 SafeManager，编排迁入新域）/ ADR-0054（未解析行修复边界，引擎随迁）/ ADR-0106（行为单源范式）/ ADR-0087（影院域 cinemaFolderPath）｜ issue 256 ｜ CONTEXT.md「日记本」词条重写（旧 Avoid「日记本」翻转）
