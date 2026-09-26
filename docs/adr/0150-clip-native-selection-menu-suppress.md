# ADR-0150 剪藏本正文屏蔽原生选择菜单（保住选择豁免，牺牲原生复制/全选）

- 状态：已接受（2026-09-16，用户提出诉求；**已实现并经用户真机验收**，验收后撤销了移动端让位）
- 关联：issue 341 / ADR-0144（划选工具框与锚定双链，本 ADR 补其移动端缺口）/ ADR-0082（剪藏本）
- 影响：`src/clipbook/styles.css`、`src/clipbook/ui.ts`、`CONTEXT.md`、
  `tests/clipbook/native-sel-menu.test.ts`、`tests/clipbook/toolbar.test.ts`

## 背景

ADR-0144 给剪藏本阅读正文开了 `user-select: text`（划选工具框靠原生选区取文本）。
移动端真机后果：长按选中文字时，**系统**也要弹自己的工具框（iOS Callout「拷贝/查询/共享」、
Android 选择 ActionMode「剪切/复制/粘贴」），与自绘工具框同位互遮。

系统选择菜单是 OS 层 UI，不在 DOM 内，没有移除它的 API。可选路径只有两条：

- **A. 收回选择豁免**（`user-select: none` + 自绘选区）——系统菜单自然消失。
  但剪藏本是全插件唯一的选择豁免域（日记本相反，见 `tests/diary/mobile-press-guard.test.ts`），
  收回就**没有原生选区**，ADR-0144 的工具框整体失效，等于推翻 ADR-0144。
- **B. 按平台压掉入口**，保住选择豁免。

## 决策

**取 B。正文保留 `user-select: text`，只压系统菜单的入口。**

1. **iOS（WKWebView）**：正文文本容器（`[data-clip-md]` / `[data-clip-mob-md]`）加
   `-webkit-touch-callout: none`——WKWebView 上压 Callout 的官方开关，也是 iOS 侧唯一开关。
2. **Android（WebView）**：同一容器内 capture 阶段拦 `contextmenu` + `preventDefault`。
   **两端作用域同一份容器名单**（CSS 一份、JS 一份，测试有漂移守卫）——只改一边会让
   「一端压住、一端没压住」。
3. **作用域只到正文文本容器**：仅移动端。标题 / meta / 脚注**不压**——那里 bz 没有替代工具框，
   保留原生菜单给用户复制；列表卡片右键菜单（item-actions）、面板骨架、桌面右键一律不碰。
4. **移动端 48px 让位已撤销**（2026-09-16，真机验收后）：issue 329 给 `placeSelBar` 加的
   系统菜单让位（`MOBILE_SYS_BAR_CLEARANCE`）随压制生效一并删除——菜单既然不再抢位，
   让位只剩一段恒久空隙。定位回到**双端同一份算式**（选区上 8px，放不下翻下方 8px）。

## 后果

- **接受**：正文里原生的「复制 / 全选」随之消失。与 ADR-0144「复制 = 复制 Markdown 源语法」
  口径自洽（工具框刻意没有纯文本复制钮）；若将来要补「复制文字」钮，属新决策，需重新拍板。
- **已真机验收（2026-09-16）**：用户实测正文长按不再弹系统选择菜单。残留风险仍在，但**不留兜底**：
  Android 的 `preventDefault` 对 Selection ActionMode 不保证在所有 WebView 版本 / 定制 ROM 生效，
  iOS 个别版本 `-webkit-touch-callout: none` 可能连带影响长按起选。真要复现，处置是把让位加回来
  （或换压制手段），而不是预置一段空隙——让位属于「针对具体缺陷的补丁」，缺陷消失即撤销。
- **零副作用域**：桌面行为、列表卡片菜单、选区与工具框交互均不变（有回归用例钉住）。
