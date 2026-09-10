# 262 — 日记本 UI 精修批：章节栏缩略图取帧根治 + 交互细节 + 视觉收口

- status: doing
- type: fix（取帧/缓存/粘顶 三处真 bug）+ polish（头行精简/高亮时机/弹窗重做）
- 分支: `diary-quick`（worktree `diary-quick`，从 master bdc635cd 分叉）
- 依据: 用户在使用原型（快速原型模式）时逐条反馈；无 ADR（可逆域内改动，三要件不满足，沿 issue 254 先例）

## 背景

日记本（ADR-0115）落域后进入快速原型评审，用户连续报出若干「看得见但说不清」的问题。
本票全部按「先实测定位、再改、改完回原型量」的方式收敛，共 9 项。

## §1 章节栏视频缩略图全黑（真 bug，根因实测）

**现象**：章节栏（`.bz-diary-rail`）月份胶片格里的视频格没有缩略图。

**实测**（CDP 探针读 canvas 像素，非目视）：43 个缩略格中 7 个视频格**全部拿到了 48×48 WebP**，
但解码后 `mean=[0,0,0]`、`range=0`——**纯黑**，且已被写进 IndexedDB 永久命中。

**根因**（变量隔离对照实验，同一条真实视频）：

| 取帧姿势 | 结果 |
|---|---|
| 游离元素 + `preload=metadata` + 等 `loadeddata`（旧实现） | ✕ 极差 0（全黑） |
| 挂进文档 + `metadata` + 等 `loadeddata` | ✕ 极差 0（全黑） |
| 游离元素 + `auto` + 等 `canplay` | ✓ 极差 653 |
| 挂进文档 + `auto` + seek 后等 `seeked` | ✓ 极差 644 |
| 挂进文档但 0 尺寸 + 等 `canplay` | ✓ 极差 653 |

→ 决定变量只有「等的哪个事件」：`loadeddata` 只保证帧数据到达（readyState=2），
帧尚未合成到可绘表面；与是否挂进文档、元素多小**无关**。

**修复**（`src/diary/thumb-cache.ts` 重写取帧管线）：
1. 事件 `loadeddata` → **`canplay`**；`preload` → `auto`。
2. **seekPlan 换落点重试**：先抢 ≤0.5s，仍空帧再试 25% / 50%（不少视频开场本身是黑场，实测 7 格里 1 格靠这步才出图）。
3. **空帧判据** `isFlatFrameData`（导出可单测）：**逐通道**极差 ≤12 判空帧 → 不写缓存、不换图。
   （反面教训：初版用 R+G+B 和值，被「等亮度和的色彩变化」掩盖会误杀真帧 → 改逐通道。）
4. **缓存换库** `bz-diary-thumbs` → `-v2` + 开库顺手 `deleteDatabase` 旧库（旧库全黑图会永久命中，不换库改了也没用）。
5. **取帧路径**：先直挂 URL（流式 Range，零额外内存）；canvas 被跨源污染（真身 `app://`，
   `toDataURL` 抛 SecurityError）则记 `directBlocked`，本环境后续走 blob 中转，并加 **48MB 上限**
   （旧实现无条件整片 `fetch`——单条实测 16.9MB，vault 视频总量 1.07GB，是内存炸弹）；取完立即 `load()` 断流。
6. 兜底 `hydrateRailVideo` 的 `preload` 也改 `auto`（`metadata` 读不出帧，兜底本身也是黑的）。

**验收**：7/7 视频格为真帧（极差 297~683）。

## §2 章节栏视频格播放角标移除

- 用户两次提出。第一次只改了「小图落地时撤角标」的收口（`swapThumbToImg`），
  **渲染期的 `uiIcon(ACTION_ICON.play)` 没删**——缩略图出来前一直可见、取帧失败时永久可见。
- 本轮删净：`thumbEl` 视频分支不再挂角标（视频身份改由 `--v` teal 渐变底承载）；
  `!src` 无资源分支视频也不再挂；`swapThumbToImg` 三路统一「出图即清 `[data-icon]`」；
  「那年今天」时光条同口径（`showThumb()` 出图撤角标）；删掉死规则 `.bz-diary-month-thumb--v svg`。
- 验收：7/7 有真帧小图、`[data-icon]` 计数 0、格内子元素只剩 `img`。

## §3 日期筛选弹窗「没有背景色」（真 bug，CSS 变量作用域）

- **根因**：设计变量 `--dw-*` 只声明在 `.bz-diary` 上，而弹窗 `.bz-diary-datefilter` 是
  `document.body.appendChild` 挂 body 的，在 `.bz-diary` **根之外** → 卡片 `var(--dw-bg)` 计算值阶段
  整体失效 = transparent（边框/文字色一并丢）。
- **修复**：token 块选择器改 `.bz-diary, .bz-diary-datefilter`；面板根自身的布局属性另拆一条 `.bz-diary` 规则。
- **通用约定**：日记域凡挂 body 的弹层都吃不到 `--dw-*`（datetime-picker / dialogs / repair-modal 走内联宿主变量而幸免），
  新增同类弹层**必须把类名加进 token 选择器组**——CSS 内已写警示注释。
- 验收：卡片背景 `rgb(255,255,255)`、遮罩 `rgba(220,220,220,.4)`、标题 `rgb(34,34,34)` 全部恢复。

## §4 日期筛选：默认选中当前年份 + 弹窗视觉重做

- 默认年：新增 `defaultFilterYear()`——当前年（无数据则回落最新年），
  `openDatePicker()` 由 `selDateFilter?.year ?? null` 改为 `?? this.defaultFilterYear()`；
  打开即出 12 个月份格，仍只是浏览临时值、不提交筛选。
- 视觉重做（旧版「460px 居中大卡 + 4 列实心方块」与域内语言脱节）：卡宽 372；
  head 复刻日节头（左标题 15px/600 + 右动作 + `::after` 发丝线）；「全部」仅在有筛选时出现；
  关闭钮规格对齐 `.bz-diary-icon-btn`；年份 chips 对齐 `.bz-diary-chip`（11px 药丸 + faint 计数 + 选中实心 accent）；
  月份改 3 列轻量格（表面底 + 右侧裸计数，空月虚线且**常态留 1px 透明边框**防虚框撑高行）；
  新增「年份」「月份」小标签（11px / 字距 0.08em）。
- 补 **域 reset 缺项**：弹窗在 `.bz-diary` 外，吃不到 `box-sizing` 与清 margin → 就地补一份。

## §5 头行按钮精简

- 移除「关闭 / 设置 / 按年月跳转」三枚按钮（用户要求），markup 只留 `add` + `search`；
  `ACT_ICON` 删 `date-picker`/`settings`/`close` 词条；`bindPanel` 删对应死绑定。
- 日期筛选入口仍由品牌行 `div[data-act="date-picker"]`（点「日记本」标题）承担。
- **遗留隐患（已向用户明示）**：移动端 `.bz-diary-mob` 全屏无遮罩可点，去掉 ✕ 后唯一关闭路径是 ESC，
  触屏没有键盘 —— 用户尚未拍板是否补移动端专用关闭。
- **连带影响（预期收益）**：`bindPanel` 里唯一的 `import('../settings-panel')` 随设置按钮一并删除 →
  评审壳的 settings-panel 全域 schema 闭包（连带 secondbrain/pomodoro/smartcat 的 schema）
  不再进包，`prototype-behavior.js` 由 1.73MB 降至 0.65MB（−28k 行）。
  代价：评审期不能再从日记本 ⚙️ 直达设置面板；PROTOTYPE.md 与 fake-obsidian 注释已同步。

## §6 章节栏开墙即高亮当前月份

- 旧实现只挂 `wall.scroll` 监听，不滚动就一个月份都不亮。
- 重构 `setupRailHighlight` 为 `sync()` + `schedule()`，绑定后立即 schedule 一次（rAF 延一帧等布局落地）；
  节流槽改 `rafId`，cleanup 取消未落地帧；**rAF 带 setTimeout 兜底**（jsdom/旧内核）。
- 验收：开墙即 `on = 2026-08`（正在看的最新月）。

## §7 日节头粘顶与上方之间的空隙（真 bug，sticky 包含块）

- **实测定位**：`wallRect.top=235` 而 `stuckHead.top=239`，那 4px 里 `elementFromPoint` 命中
  `DIV.bz-diary-item bz-diary-text` —— 缝隙里露的是滚过去的正文。
- **根因（通用知识）**：`position: sticky; top: 0` 的包含块是滚动容器的**内容框**，
  容器带 `padding-top` 时节头只能停在「容器顶 + padding」处，**padding 那一条永远盖不住**。
- **修复**：`.bz-diary-wall` 的 `padding: 4px 24px 32px` → `padding: 0 24px 32px`。
- 验收：`paddingTop=0`、节头顶 == 墙体顶 == 235、缝隙带探测数组为空。

## §8 章节栏「章 节」标题块移除

- 删除 `.bz-diary-rail-title` **整个块**（非只清文字留空块）；`styles.css` 同步删该规则
  （含其 sticky 遮罩行为）；原 `S3` 的 `.bz-diary-rail-title + .bz-diary-rail-year` 顶垫收窄
  改钉 `.bz-diary-rail-year:first-child`。
- 验收：`hasTitle=false`、栏内首个子元素 = 年份标签、栏文本以「2026」打头。

## §9 四版皮肤探索（用户评判「都不好看」，全数撤回）

- 做过并**已全部撤回**：`skins/{letterpress,frosted,terminal,contact}.css` + `prototype-skins.html`
  对比壳 + `prototype-view.html` 的 `?skin=` 钩子。
- 四方向：铅印（黑白铅字）/ 毛玻璃（冷调半透明）/ 终端（等宽荧光）/ 印样（4 列密集）。
  机制上四版均按 `body.skin-*` 兜底实现、token 双挂 `.bz-diary` + `.bz-diary-datefilter`，验证生效——
  **问题不在工程，在审美判据**：用户结论为全部不采纳，本轮不留下任何皮肤代码。
- 复盘（供下次）：四版都改「皮肤」，而首屏最重的元素（顶部 3~4 行灰胶囊 + 头部）未动；
  且「铅印/终端」用衬线/等宽配中文，Windows 字体链回退，观感劣于预期。

## 门禁

- `tsc --noEmit` 0 错；`tests/diary` + `tests/core` + `tests/smoke`（52 文件 / 782 用例）全绿。
- 新增回归：空帧判据 6 例、视频格全程无角标、时光条视频格、开墙恰有一个月份高亮、
  `.bz-diary-wall` 顶垫必须为 0、日期弹窗默认年份 + 变量作用域、章节栏无标题块。
- 原型侧另用 CDP 探针逐项实测（像素极差 / 计算样式 / 元素命中），结论见各节「验收」。
