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
