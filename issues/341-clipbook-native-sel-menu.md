# Issue 341 — 剪藏本正文屏蔽移动端原生选择菜单（系统工具框与划选工具框抢位）

**状态：已修复并经用户真机验收**（2026-09-16；验收确认压制生效 → 同日撤销移动端让位，见文末）

## 现象（用户诉求）

移动端剪藏本阅读正文里选中文字后，**系统**还会弹出自己的工具框——iOS 是 Callout
（拷贝 / 查询 / 共享），Android 是选择 ActionMode（剪切 / 复制 / 粘贴）——与 issue 329
（ADR-0144）的自绘划选工具框贴在同一位置相互遮挡。

用户给了一份通用做法（拦 `contextmenu` + `-webkit-touch-callout: none` + `selectionchange` 自绘），
问能否照搬到本场景。作用域由用户钉死：**剪藏本的正文**。

## 根因（为什么不能照搬「收回选择豁免」）

1. **系统选择菜单是 OS 层 UI，不在 DOM 里**，没有"移除它"的 API，只能分别按平台压掉入口：
   - iOS WKWebView：`-webkit-touch-callout` 是唯一开关；
   - Android WebView：长按起选走 Chrome 的 Selection ActionMode，只能在 `contextmenu` 上
     `preventDefault`（部分版本管用，**不保证**）。
2. **正文必须保留 `user-select: text`**：ADR-0144 的划选工具框正是靠原生选区取文本，
   收回豁免连选区都没了。所以其它域（日记本 `tests/diary/mobile-press-guard.test.ts` 的反向约束）
   那套"移动端收 `user-select`"的干净做法在剪藏本不可用——剪藏本是全插件唯一的选择豁免域。

## 修复

1. `src/clipbook/styles.css`：新增 `[data-clip-md], [data-clip-mob-md] { -webkit-touch-callout: none }`——
   **作用域与 UI 侧拦截同口径**（只到正文文本容器；标题 / meta / 脚注没有替代工具框，保留原生菜单）。
   上方那条选择豁免规则（`.bz-clip-read, .bz-clip-mob-detail` 的 `user-select: text` /
   `-webkit-user-select: text`）**原样不动**。
2. `src/clipbook/ui.ts`：`buildDom` 在 `overlayEl` 上挂 **capture 阶段** `contextmenu` →
   新模块级 `onReaderContextMenu`：**仅 `isMobileEnv()`** 且
   `ev.target.closest('[data-clip-md],[data-clip-mob-md]')` 命中才 `preventDefault`。
   capture 是为了先于 Obsidian 自己的正文监听。
3. `MOBILE_SYS_BAR_CLEARANCE = 48` 当时**保留为兜底**（屏蔽是 best-effort，拦不住时仍靠让位）
   —— 真机验收确认压住后**已删除**，见文末。

## 作用域（不误伤，测试逐条钉住）

- **只在移动端**：桌面右键是鼠标惯用件，不放行也不拦，行为不变。
- **只拦正文容器内**：列表卡片右键菜单（item-actions）、rail/面板骨架、菜单层一概不拦。
- **不动选区与工具框**：工具框仍由 `selectionchange` + `mouseup` 双端同套驱动；
  拦下 contextmenu 后划选照常出三动作（有专门用例）。

## 已知限制与代价（如实交代，勿承诺过头）

- **iOS**：`-webkit-touch-callout: none` 是 WKWebView 压 Callout 的官方开关。**已真机验收**（2026-09-16）。
- **Android**：`preventDefault` 对 Selection ActionMode 只是 best-effort。**已真机验收**（2026-09-16）——
  据此撤销了原来的 48px 让位兜底。
- **代价**：正文原生「复制 / 全选」随之消失。ADR-0144 已拍板「复制 = Markdown 源语法」，
  工具框刻意没有纯文本复制钮；若要补「复制文字」钮属新决策，需用户拍板。

## 真机验收与让位撤销（2026-09-16 后续 · 用户驱动）

用户真机实测：**压制生效**——正文长按不再弹系统选择菜单。

随后用户提出：工具框与选区之间多出一段边距，要去掉。那段正是 issue 329 为躲系统菜单给
`placeSelBar` 加的移动端 48px 让位——菜单压住了，让位只剩空隙。故：

1. `src/clipbook/ui.ts`：删 `MOBILE_SYS_BAR_CLEARANCE` 常量与 `placeSelBar` 内的
   `const clearance = isMobileEnv() ? … : 0`，定位回到双端同一份算式（选区上 8px，放不下翻下方 8px）。
2. `tests/clipbook/toolbar.test.ts`：原「移动端让位 48」两例改为「零让位，与桌面同定位」
   （期望值 8px → 56px、86px → 38px），describe 更名「浮框定位：双端同口径」。
3. `tests/clipbook/native-sel-menu.test.ts` 头注释同步（不再有让位兜底）。
4. `docs/adr/0150-clip-native-selection-menu-suppress.md` 决策 4 由「48px 让位保留为兜底」
   改为「移动端让位已撤销」，状态转「已真机验收」。

**口径（不留兜底）**：屏蔽仍是 best-effort。将来若某版本 WebView 又压不住，工具框会重新与系统菜单
同位——届时把让位加回来（或换压制手段），而不是留一段恒久的空隙。让位是针对具体缺陷的补丁，
缺陷消失即应撤销。

## 回归测试（`tests/clipbook/native-sel-menu.test.ts`，12 例）

- 行为层 8 例：桌面正文 `[data-clip-md]` 被拦 / 正文内子元素委托路径被拦 / 桌面不拦 /
  移动详情 `[data-clip-mob-md]` 被拦 / 正文外（遮罩、rail）不拦 /
  桌面卡片 contextmenu 仍由 item-actions 接管弹菜单 / 移动端卡片 contextmenu 不被本拦截吞掉 /
  拦下 contextmenu 后划选仍能弹出工具框（防过度拦截）。
- 样式源静态断言 4 例（jsdom 不算 CSS 级联，同 `tests/clipbook/menu-skin-vars.test.ts` 手法）：
  文本容器规则含 `-webkit-touch-callout: none`、选择豁免规则**仍含** `user-select: text`
  且**不含** touch-callout（防误挂到整窗格）、CSS 容器名单与 `ui.ts` 的
  `closest('[data-clip-md],[data-clip-mob-md]')` **同口径**（漂移守卫：iOS 靠 CSS、Android 靠 JS，
  分叉在真机上表现为「一端压住一端没压住」）、`-webkit-touch-callout` 在本域样式源只出现一处。

## 门禁（worktree `wt/clip-selmenu`）

全量 **337 文件 / 5294 用例绿** + `tsc --noEmit` 0 错 + `preview-freshness` **27/27 绿**
（行为包 clipbook / memo / settings-panel 已重出）。

### 顺带修正：worktree 源指纹假失败（环境对齐，非本 issue 语义）

worktree 检出为 CRLF、而主仓库工作区的那 5 个文件（`src/pomodoro/{stats,render}.ts`、
`src/pomodoro/styles.css`、`src/cinema/settings.ts`、`src/core/settings-main-schema.ts`）为纯 LF，
两者**内容逐行一致、git 两边都判干净**。但源指纹按**磁盘字节**算（ADR-0104/0133、
spec §7 同源问题），故 worktree 内恒有 5 项 `preview-freshness` 假失败——
issue 340 的门禁段已把这条记为「worktree CRLF 已知伪失败」。

本次把这 5 个文件对齐为与主仓库**逐字节一致**（`git add` 后零 diff，git 视角不可见），
于是 worktree 内该守卫 27/27 全绿，且重出的行为包可安全带回主仓库
（指纹由「与主仓库相同的字节」算出，不是 worktree 的 CRLF 变体）。

**遗留（未做，另议）**：`.gitattributes` 只固定了 `main.js` / `prototypes/**/*.{js,ts}`，
`src/**` 未固定行尾 → 全新 clone（autocrlf=true 检出 CRLF）下这些域的原型新鲜度守卫仍会假红。
根治需给 `src/**` 定 `text eol=lf` 并整仓 renormalize，属跨域仓库级改动，本 issue 不顺手做。
