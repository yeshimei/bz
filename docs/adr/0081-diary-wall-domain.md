# ADR-0081：回忆墙独立域（diary-wall，日记本数据的媒体优先只读视图）

- 状态：已采纳
- 日期：2026-09-02
- 关联：ADR-0002（依赖方向）、ADR-0003（懒加载）、ADR-0004（命令裸注册）、ADR-0019（移动端默认全屏）、ADR-0064（声明式设置页）、ADR-0078（保险库域原型一比一）、ADR-0080（设置面板域）
- 原型：`.scratch/` 回忆墙 v5（章节固定 + 滚动高亮 + 媒体瀑布流）

## 背景

日记本域（diary）UI 处于**兼容性冻结**（铁律 1：文案/CSS/DOM 契约/数据格式一律不改），且其交互形态以文字条目流为主。用户想要一种全新的「回忆墙」媒体优先形态：

- **真实媒体瀑布流**：日记正文里的 `![[图片/视频/音频]]` 内链以真实 `img/video/audio` 渲染（vault 资源路径可播放），而非占位符或文字；
- **固定章节栏**：左栏月份章节 + 滚动自动高亮当前章节、点击平滑定位；
- **只读视图**：不改写任何日记数据，纯消费 `我的/日记/*.md`。

约束：不修改 `src/diary/` 既有代码（兼容性冻结）；不新建一套日记数据格式。

## 决策

### 1. 新独立域 `src/diary-wall/`（回忆墙）

- **数据**：只读复用 diary 解析链——`src/diary/parser.ts`（parseFile）读 `我的/日记/*.md`，目录常量 `DIARY_DIRECTORY`（`src/diary/config.ts`）同源；不写任何文件，不触发 diary store 的写入路径。
- **媒体**：正文 `![[...]]` 内链按扩展名判类（img/video/audio），媒体 URL 一律经 `app.vault.getResourcePath`（原型硬编码 file:// 在 vault 内不可播放，必须走 Obsidian 资源路径才能被媒体标签加载）；解析失败安全降级为空。
- **UI**：原型 v5 一比一（固定章节栏 + 滚动高亮 + masonry 瀑布 + 灯箱 + 底部抽屉），类名 `bz-diary-wall-*` 隔离，不触碰 diary 域既有 `diary-*`/`#diary-*` DOM 契约；顶部品牌文案「日记本」与范围计数，按钮秩序：功能 → ⚙️ → ✕（`bz-win-head`/`bz-win-close` 统一视觉）。
- **性能**：域级懒加载（ADR-0003）+ 媒体视口懒加载（IntersectionObserver，进视口才挂 src、离开视口暂停视频）+ `content-visibility:auto`；滚动高亮 rAF 节流。
- **命令**：`bz-diary-wall-open`（名称「回忆墙」，icon `images`）main.ts COMMANDS 裸注册（ADR-0004），onunload 调 `unloadDiaryWall`。
- **入口**：`src/diary-wall/index.ts` 导出 `ensureDiaryWall(app)`（幂等懒加载）、`openDiaryWall(app)`（ensure 后调 controller.show()）、`unloadDiaryWall()`（清理）。

### 2. 设置：移动端默认全屏

- `src/settings.ts` 新增 `diaryWallMobileDefaultFullscreen`（默认 **true**——回忆墙为媒体优先瀑布流，移动端本来就是真全屏设计，ADR-0019 同款键）；
- 打开路径 `applyMobileWindowFullscreen`（`src/core/mobile.ts`）；
- ⚙️ 域设置弹窗挂「移动端默认全屏」行，仅 `isMobileEnv()` 显示；schema 放 `src/diary-wall/settings.ts` 导出 `diaryWallSettingsSchema()`（用 `mobileFullscreenGroup` 预设，ADR-0064 声明式）。

### 3. 未接线项（后续独立票）

- 写日记（✏️）、搜索（🔍）、底部抽屉动作（打开/复制双链/复制正文/改标签/加密/删除）在 UI 层为占位提示，生产接线走 diary 既有 `openAddDialog` / bz 统一抽屉，不在本 ADR 范围。

## Options

- **O1 直接改造旧 diary 域**——❌ 兼容性冻结（铁律 1：文案/CSS/DOM/数据格式不改），且日记流形态与媒体瀑布流是两种交互范式，混改风险高、回归面大。
- **O2 新 UI 挂旧域（diary 内新增回忆墙视图）**——❌ 与 diary 面板共享状态/esc/DOM 命名空间，耦合深；冻结约束下任何共享改动都受限。
- **O3 独立数据快照（回忆墙自己维护媒体索引 json）**——❌ 数据分叉、与日记实际内容漂移，违背「旧数据直接可读、零迁移」原则；纯派生视图无需独立存储。
- **O4 媒体用 file:// 直连**——❌ vault 内资源必须经 getResourcePath（Obsidian 资源协议），file:// 在移动端/远程 vault 不可用（原型实测不可播放）。

## Consequences

- 正面：回忆墙纯增量，不动 `src/diary/` 任何文件、不破坏 diary 数据/DOM 契约；复用既有 parser 与目录配置，数据永远与日记本一致（只读派生）；懒加载 + 视口懒加载保证打开/滚动性能。
- 反面：新域样式（`bz-diary-wall-*`）需随原型逐项维护；媒体解析依赖 `getResourcePath`，异常/沙盒环境降级为占位（不阻塞面板）。
- 兼容：命令 id/设置键/类名全部新增，无既有契约冲突；旧 data.json 缺 `diaryWallMobileDefaultFullscreen` 由 DEFAULT_SETTINGS 兜底。

## 术语

- **回忆墙 (Diary Wall)**：日记本数据的媒体优先只读视图（新域 diary-wall），命令 `bz-diary-wall-open`；与「日记本」面板并存，数据同源（`我的/日记/*.md`）、互不改写。

---

## v2 修订（2026-09-02）：自包含 + 四域聚合 + 完整交互

用户后续拍板三项重大变更，追加记录如下：

### 决策 1：自包含（为删除日记本域铺路）

- **背景**：用户明确「把需要的代码从日记本域中重新一遍，日后会删除日记本域」。diary 域被 smartcat（小橘）/影视/设置面板多处依赖，本次只做回忆墙自包含，删除 diary 留后续单独票。
- **做法**：`src/diary/parser.ts`（parseFile/parseMovieFile/parseLetterFile）、`config.ts`（标签表 + 目录常量 + emoji 映射）、`types.ts`（DiaryEntry）**复制**进 `src/diary-wall/`，data.ts 的 import 全部改为 `./parser`/`./config`/`./types`，**零 `../diary` 依赖**（测试含 grep 断言）。App 一律参数注入（不再 import ../diary/app）。
- **保留依赖**：写日记/日期选择器/跳转/改标签/加密等**动作**仍调 diary 域既有函数（`openAddDialog`/`showDatePicker`/`jumpToEntry`/`showTagPicker`/`encryptEntry`），标注 TODO（自包含）——删除 diary 域时改为回忆墙自己的实现。

### 决策 2：四域聚合（日记 + 影视 + 信 + 书）

- `loadWallEntries(app)` 聚合四类：日记（`我的/日记/*.md`）、影视（`我的/影视/*.md`，parseMovieFile）、信（`我的/信/*.md`，parseLetterFile）、书（`书库/*.md`，**新增 parseBookFile**：completionDate 优先→readingDate，content=`**《title》**`+bookReview+`![[cover]]`）。
- 统一转 `WallEntry`（新增 `kind: 'diary'|'movie'|'letter'|'book'`），按 date 降序、time 降序混排成媒体优先全域时间线。
- 影视/信/书 filename = 完整 vault 路径（跳转直接开文件）；日记 filename = dateStr（跳转 `我的/日记/${date}.md`）。书条目跳转在 UI 层直接 openLinkText。

### 决策 3：完整交互 + Markdown 渲染

- 标题「日记本」点击 → diary `showDatePicker`（日期筛选）；主标签带二级标签时显示子标签行（`getSubTagsOfPrimary`）；头部搜索框（正文/标签/时间/日期过滤）；写日记接 `openAddDialog`；按钮序：编辑 → 搜索 → 关闭（**移除设置按钮**）。
- 条目交互：**单击** → 底部抽屉（打开/复制双链/复制正文/改标签/加密/删除，接 diary 既有动作）；**双击** → 跳转原文（diary `jumpToEntry`，书直接打开）；**桌面右键** → 自绘跟手上下文菜单（同动作集）。
- **Markdown 渲染**：正文用 `MarkdownRenderer.render`（text 为去媒体嵌入后的 markdown 原文，`stripMediaLinks` 只删 `![[媒体]]`，保留加粗/链接/列表等语法），非纯文本。
- **稀疏铺满**：瀑布从 CSS columns 改 **Grid 6 列**，当天 1 条 → 文字条跨整行（媒体块不放大居中）、2 条 → 各占半行、≥3 → 三列流式。
- **正文不显示双链**：媒体嵌入 `![[...]]` 从卡片正文移除（text 字段），媒体以独立块呈现。
- 标签 chips 字号 12px → 11px（更紧凑）。
