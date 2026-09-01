# Ticket 176 — 回忆墙（diary-wall）第三批交互细节修复（11 项）

> 状态：✅ 已完成并部署（2026-09-02）
> 提交：bf989b2（11 项功能）+ 39e7f2e（审查修复：加密动作分流/渲染守卫/滚动高亮）+ 构建产物提交
> 审查：子代理 diff 审查发现 2 P1 + 5 P2，P1/P2-1/P2-3 已修，其余 P2 记录待后续迭代

> 备忘：用户对回忆墙的 11 项修复诉求（2026-09-02），涉及媒体块 emoji、正文渲染、瀑布流、章节跳转、筛选、标签样式、日期选择器、右键菜单、灯箱、加密解锁。

## 背景

回忆墙（src/diary-wall/）为日记本（diary 域）的只读派生视图（ADR-0081），媒体/章节/灯箱/抽屉已实现。本批修复 11 个交互细节问题，多为用户真实使用中暴露的样式与行为缺陷。

## 问题清单与方案

### 1. 去掉视频上面的 emoji
- 现状：视频媒体块的渐变占位 `.bz-diary-wall-ph` 显示 🎬 等 emoji（KIND_ICON 角标），视频本体未加载时 emoji 大字居中，视觉突兀。
- 方案：视频占位改纯渐变（去 emoji 文字），保留渐变背景与 ▶ 播放角标；`KIND_ICON` 仍用于灯箱错误提示等。
- 文件：`src/diary-wall/ui.ts`（mediaEl 视频分支不写 ph.textContent）、`src/diary-wall/styles.css`（.ph 视频场景）。

### 2. 图片右上角的 emoji
- 现状：图片块右上角 `.bz-diary-wall-att` 显示 🖼 角标（原型照搬），与类型 chip 的 emoji 语义重复，视觉噪音。
- 方案：去掉图片右上角 🖼 角标（用户诉求「图片右上角的 emoji」去掉）；描述信息由 hover 浮现的 `.bz-diary-wall-cap`（emoji+时间+文件名）承载。
- 文件：`src/diary-wall/ui.ts`（mediaEl 图片分支不创建 .att）、`src/diary-wall/styles.css`（.bz-diary-wall-att 规则删除）。

### 3. 正文 markdown 渲染（使用 obsidian 内部渲染方案）
- 现状：正文已用 `MarkdownRenderer.render`（动态 import obsidian）渲染，container 渲染前先 textContent 兜底防注入，渲染后校验 isConnected 丢弃过期结果。
- 方案：保留现有实现（已满足「obsidian 内部渲染」）；补渲染失败/挂起兜底（Promise.race 超时，防 Obsidian 渲染挂起导致卡片空白，参照 encrypt/ui.ts b0831de 修复）。并发渲染竞态保留 isConnected 保护。
- 文件：`src/diary-wall/ui.ts`（renderText 加超时竞态）。

### 4. 瀑布流
- 现状：`.bz-diary-wall-masonry` 用 CSS Grid `repeat(6,1fr)` + 每项 `span 2`，行高由本行最高项决定，同排不等高项产生大空隙（非真正瀑布流）。
- 方案：改用 CSS columns 列式填充（`column-count:3; column-gap:10px`，移动端 2 列；子项 `break-inside:avoid`），与原型 v5 `.masonry{column-count:3}` 一致。条目顺序变为列内竖向排布（原型即此布局，真实瀑布流语义）。
  - 稀疏铺满（sparse-1/2）语义调整：columns 下用「条目宽度占满/半宽」表达（`column-span` 在部分浏览器支持有限，改用媒体查询或固定比例类）。简化：稀疏 1 条时文字条全宽（`column-span:all` 兼容性差则回退为单列容器），媒体块不放大保持单列宽。
  - 桌面 6 列 grid 网格在列式下废弃，清理对应规则。
- 文件：`src/diary-wall/styles.css`（masonry 规则重写）。

### 5. 章节点击 12 月转跳，但再点击前面的月份不转跳
- 现状：`scrollToMonth` 用 `head.offsetTop - 6` 定位。offsetTop 相对最近 `position:relative` 祖先；`content-visibility:auto`（.bz-diary-wall-item）会让屏外条目跳过渲染，其 offsetTop 为未渲染占位值；更关键：`.bz-diary-wall-wall` 的 offsetTop 恒为 0（容器自身滚动），day-head offsetTop 相对 wall 正确。但**重复点击同月份/不同月份时**：首次点击后滚动位置变化，目标 head 的 offsetTop 相对 wall 不变（正确）——真正问题是 jsdom/真实环境里 `wall.scrollTo` 是异步平滑滚动，且若两个月份 head 有相同的 offsetTop（同月多 day-head 或月份数据在同一位置）会定位错误。稳妥修复：计算目标 head 相对 wall 顶部的累计偏移（`head.offsetTop - wall.offsetTop` 或 `getBoundingClientRect` 差值），并用 `scrollIntoView`/`scrollTo({top})`。
  - 根因排查：`scrollToMonth` 里 `head.offsetTop` 在 head 前面存在 `content-visibility:auto` 的条目容器时（head 是 wall 直接子元素，其 offsetTop 相对 wall——但 wall 有 `position:relative`，offsetTop 正确）。真正问题在**月份数据里 12 月在上（倒序），点击 12 月正常；点击前面月份（如 6 月）时 head 存在但被 sparse/grid 布局的 offsetTop 计算偏差**。修复为统一 `getBoundingClientRect` 差值定位（wall 内绝对位置），并加 month 空判断。
- 文件：`src/diary-wall/ui.ts`（scrollToMonth 用 rect 差值）。

### 6. 电影只获取有影评的，书也只获取有书评的
- 现状：`parseMovieFile` 已有 `if (!review || review.trim() === '') return null`；`parseBookFile` 无书评过滤（无 bookReview 也返回，content 只有标题）。
- 方案：`parseBookFile` 增加书评过滤——`bookReview` 缺失或空白返回 null 跳过（与影视同语义）。数据层测试已有「无影评返回 null」用例；补「无书评返回 null」用例。
- 文件：`src/diary-wall/parser.ts`、`tests/diary-wall/data.test.ts`。

### 7. 顶部的标签，去掉 box-shadow 添加背景色，点击会高亮（参考日记本，一比一复刻）
- 现状：`.bz-diary-wall-chip` 背景 `--dw-surface`、选中 `--dw-accent` 高亮——但**根因**：`src/core/reset.css` 全局按钮重置 `[class*="bz-"] button { background:none; border:none; box-shadow:none; font-size:13px }`（特异性 (0,1,1)）压过回忆墙 `.bz-diary-wall-chip`（(0,1,0)）——实际渲染背景透明/无高亮/字号 13px，且选中态 `.bz-diary-wall-chip--on` 的背景 accent 同样被 reset 压制 → 点击无高亮。日记本（diary 域）标签按钮用内联 `style.cssText='background:var(--background-secondary)...'`（内联特异最高）所以正常。
- 方案（铁律 9 域样式原则）：回忆墙 styles.css 提升 chip/subchip/datefilter 等按钮规则特异性至 (0,2,0)+（`.bz-diary-wall .bz-diary-wall-chip`），显式声明 `background: var(--dw-surface)`、选中 `--dw-accent` + 白色文字、`font-size:11px`、`box-shadow:none`。同时把 reset.css 的全局按钮规则从「无差别清背景」改为「只做基线，域样式用更高特异性显式覆盖」——**不动 reset.css**（影响所有域），在回忆墙域内用 `[class*="bz-"]` 前缀 + 复合选择器补足特异性。
- 文件：`src/diary-wall/styles.css`（chip/subchip/datefilter 按钮选择器加 `.bz-diary-wall` 前缀提升特异性，显式 background/font-size/box-shadow）。

### 8. 日期选择器样式丢失，背景纯透明
- 现状：`.bz-diary-wall-datefilter-card` 背景 `--dw-bg`——但 reset.css 全局按钮重置（同上）把 `.bz-diary-wall-datefilter-year/month/reset/close` 的背景清成 none → 弹窗内按钮透明、卡片虽有背景但子元素（年份/月份/头部按钮）全透明，视觉「样式丢失」。另外 `.bz-diary-wall-datefilter` 挂 body（不在 `.bz-diary-wall` 根容器内），其内 button 仍命中 reset.css `[class*="bz-"] button`（类名含 bz-）→ 被清。
- 方案：同 #7，datefilter 全部按钮规则加 `.bz-diary-wall-datefilter` 前缀提升特异性 + 显式 background；`--dw-cover` 遮罩本身没问题。
- 文件：`src/diary-wall/styles.css`（datefilter 按钮规则前缀化）。

### 9. 桌面端鼠标放到正文、图片或视频上右键无法打开右键菜单
- 现状：`bindItem` 在 `.bz-diary-wall-item` 上监听 `contextmenu`（capture），但媒体块内 `img`/`video`/文字 `div` 的 contextmenu 冒泡到 item 应触发——**根因**：`.bz-diary-wall-media` 的 `wrap.addEventListener('click', …)` 只拦 click；`contextmenu` 冒泡链正常。真正问题在 Obsidian 全局 contextmenu 处理（workspace DOM 级）先于 item 的 capture 监听？item 监听用的是 `addEventListener(..., true)`（capture），应最先。实测根因待查——可能 `.bz-diary-wall-item` 的 `user-select:none` + `content-visibility:auto` 或媒体元素 `pointer-events` 导致 contextmenu 不派发。稳妥修复：在 mediaEl 的 wrap、文字条容器也挂 contextmenu（capture，stopPropagation 后 openContextMenu），并在 `img/video` 上挂 `draggable=false` + contextmenu 转发。
  - 另一嫌疑：`bindItem` 只在 `renderWall` 的 item 上绑；`mediaEl` 内部 `wrap` 是 item 子节点，contextmenu 冒泡到 item 的 capture listener——正常应触发。若 Obsidian 在 document 层 preventDefault + 不冒泡（某些版本），capture 在 item 上也收不到（事件在更外层被 stop）。防御：把 contextmenu 绑定挂到 `.bz-diary-wall-wall`（容器）委托，capture 阶段拦截，兼容所有子元素。
- 方案：`renderWall` 末尾在 `ui.wall` 上挂 contextmenu 委托（capture），`closest('.bz-diary-wall-item')` 找到条目后 openContextMenu；移除/保留 item 级监听均可（委托统一）。同时给媒体 `img/video` 加 `contextmenu` 冒泡保证。
- 文件：`src/diary-wall/ui.ts`。

### 10. 点击图片或视频放大后，图片或视频下面显示日记的文字，而不是路径
- 现状：灯箱 `.bz-diary-wall-lbsub` 显示 `src`（资源路径 `app://...`）。
- 方案：灯箱 caption 下方改显示条目正文（entry.content 去除媒体引用后的 text，纯文本截断 2-3 行）；lbCap 显示文件名/时间；lbsub 改为日记文字（或把文字并入 lbCap）。具体：`lbCap` = `${entry.date} ${entry.time} · ${entry.tags.join(' ')}`（或文件名），`lbSub` = entry.text（去掉 ![[...]] 后的 markdown 纯文本，不渲染、ellipsis 两行）。
- 文件：`src/diary-wall/ui.ts`（openLightbox 传 entry）、`src/diary-wall/styles.css`（lbsub 样式：非 mono、两行截断）。

### 11. 点击加密标签，弹出解锁面板，解锁后加载加密日记（参考日记本实现）
- 现状：回忆墙 `renderChips` 里「加密」chip 点击只置 `lockedVisible=true` + `selTag='加密'`，**不弹解锁**；加密条目数据（保险箱 diary-entry）从未加载进 `entries`（loadWallEntries 只读 md 文件）。
- 方案（对齐 diary/filter-shared.ts createTag 加密流程）：
  - 「加密」chip 锁定态点击 → `ensureSafeUnlocked()`（保险箱弹主密码面板，复用 encrypt 域）→ 成功后：① 加载加密日记（`loadEncryptedEntries` from '../diary/encrypt'，返回 DiaryEntry 带 encrypted/noteId）→ 转 WallEntry（toWallEntry kind='diary'）并入 entries；② `lockedVisible=true`、`selTag='加密'`；③ 渲染。
  - 上锁/关面板时清加密条目：订阅 `onUnlockChange`（diary/encrypt）或打开回忆墙时检查 `isUnlocked()`；回忆墙 hide() 时若保险箱被锁（lockSafe 在其他域触发）下次打开重新判定。简化：**每次 openManager 时若保险箱已解锁则并入加密条目**（幂等），chip 解锁路径同样并入；`filtered()` 对加密条目在未解锁/未选「加密」时隐藏。
  - `loadWallEntries` 保持只读 md；加密条目走独立合并函数（ui.ts 内 `loadEncryptedWallEntries` 动态 import diary/encrypt）。
  - 自包含约束：回忆墙「日后删除日记本域」——但当前日记加密唯一实现在 diary/encrypt.ts（依赖 diary config），按现有模式（jumpTo/editTags 已动态 import ../diary/*）动态 import 复用，标注 TODO(自包含)。
- 文件：`src/diary-wall/ui.ts`、`tests/diary-wall/ui.test.ts`。

## 涉及文件

- `src/diary-wall/ui.ts`（1/2/3/5/9/10/11 + 审查修复）
- `src/diary-wall/parser.ts`（6）
- `src/diary-wall/data.ts`（WallEntry 补 encrypted 字段）
- `src/diary-wall/styles.css`（1/2/4/7/8/10）
- `tests/diary-wall/ui.test.ts`、`tests/diary-wall/data.test.ts`（6/11 等）
- 根 `styles.css`：构建产物（勿手改）
- `main.js`：构建产物（勿手改）

## 审查修复记录（子代理审查）

- **P1-1 renderText 超时守卫**：超时回退后挂起的 MarkdownRenderer 渲染恢复会覆盖回退文本——dataset.renderFallback 标记 + render.then 二次清写守卫。
- **P1-2 加密条目动作分流**：加密条目「打开原文」不再跳不存在的 md → 打开保险箱面板；「删除」走 deleteEncryptedEntry 密文销毁（flow-dialog 确认）；「复制双链」改复制正文；菜单/抽屉显示「解密」而非「改标签/加密」。
- **P2-1 滚动高亮 rect 化**：与章节跳转同口径 getBoundingClientRect 差值（content-visibility 下 offsetTop 不可靠）。
- **P2-3 加密可见性用 encrypted 标志**：filtered()/chip 计数/右键/点击守卫用 `e.encrypted || tags.includes('加密')`（tags 由 emoji 反解可能不含「加密」）。
- 未修 P2（记录）：P2-2 委托 stopImmediatePropagation 吞子元素右键（当前无冲突，可接受）；P2-4 超时回退展示 md 原文（保卡片不空白优先）；P2-5 灯箱副行 3 行截断无展开（可后续加）；P2-6 稀疏态 column-span 兼容性（视觉细节）。

## 测试与门禁

- 新增/更新：ui.test.ts（去 emoji/去 att/右键委托/灯箱文字/加密解锁弹面板加载/章节跳转 rect 定位）、data.test.ts（书无书评跳过）。
- 全量 `pnpm test` + `pnpm exec tsc --noEmit` + 自审 + diff 审查 + `pnpm run build` 验证（vault 插件目录同步）。
- 人工验证点（用户侧）：视频块无 emoji；图片无右上角角标；正文 markdown 渲染；瀑布流列式无大空隙；章节点击各月都能跳；影视/书只显示有评的；标签背景色+点击高亮；日期选择器按钮有背景；正文/图片/视频右键出菜单；灯箱下显示文字；点加密 chip 弹解锁、解锁后加密日记出现。
