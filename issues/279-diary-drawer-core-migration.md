# issue 279：日记本抽屉真机无反应修复 + diary/favorites 抽屉右键菜单收编 core

日期：2026-09-11 ｜ 用户拍板：①「移动端长按没有任何反应，你看看其他域是怎么实现的」②「抽屉里的列表是居中对齐的，样式和别的域不太一样」③「收编收藏夹的」④「彻底取消 user-select:text 两端」 ｜ 关联：issue 217（正文可选中豁免）、issue 271（移动端全域规范）、ADR-0067（动态 z 发号）、ADR-0106（行为单源）

## §1 真机故障与真因（主因）

**现象**：日记本移动端长按条目，抽屉全程不出，且无任何提示。

**真因（单点，非多因）**：抽屉换核到 core `openItemSheet` 后，新的富媒体头带「右上角关闭钮」，其图标取 `ACTION_ICON.close` —— 而 `ACTION_ICON` 表**没有 `close` 键**（旧表只有 open/copyLink/copyContent/attachment/editTags/encrypt/decrypt/remove/play/music/image）。

链路：`openItemSheet` → `mkSheetHead` → `uiIcon(undefined)` → 真机 Obsidian `setIcon` 内部 `getIcon` 首行 `name.startsWith('lucide-')` 抛 `Cannot read properties of undefined (reading 'startsWith')` → 整条抽屉构建中断（`document.body.appendChild` 之前就炸）→ 用户侧 0 反馈。

**两侧同时漏网的原因**（本次一并加固，均为通用判据）：

1. `ACTION_ICON` 注解为 `Record<string, IconName>` —— 该注解**放行任意键**，取不存在的键编译期不报错；改 `satisfies Record<string, IconName>` 后键集由字面量推断，缺键即编译错误。
2. `tests/mock-obsidian-entry.ts` 的 `setIcon` 宽容实现（`el.dataset.icon = name`）静默吞下 `undefined`，与真机失败模式不一致 → 改成严格档：图标名非字符串/空即抛 `TypeError`。与 ADR-0122 第 2 条（替身必须复刻宿主语义）同源判据。

## §2 换核（与用户「列表居中 / 样式不一致」诉求同源）

**居中真因**：diary 自绘 `.bz-sheet` 壳缺 core 的 `!important` 抗压盖组（core 对 `.bz-item-menu/.bz-item-sheet button` 有 `justify-content: flex-start !important` + `text-align: left !important` + 背景/边框/阴影清零），真机 Obsidian 移动端默认 button 样式把动作行压成居中。

**改法**：diary 自绘抽屉壳整体退役，走 core `openItemSheet`——壳/动作行/遮罩/外点关/下拉关/防穿透/z 发号全归共享层，域内只出富媒体头（`mkSheetHead`：emoji + 时间行 + 正文预览 + 媒体缩略 + 右上关闭钮，经 `sheetHead` 通道）。动作集与桌面右键同源（`buildMenuActions` + 抽屉特有「附件」项与正文字数小字）。

**favorites 同批收编**（用户点名）：自绘 `.bz-fav-ctx` / `.bz-fav-sheet` 退役 → core `openItemMenu` / `openItemSheet`；`actionSpecs`（动作序/语义键契约）与磁点头皮肤（`favSheetHead`）保留；ESC 层简化（浮层自持，`closeItemMenu` 兜底）。

**挂 body 取色口径**：抽屉挂 `document.body`，不在域根树内 → 域变量（diary `--dw-*`、favorites 米色系）解析不到，域内新写规则一律取 core token / Obsidian 全局变量（日记缩略图头同款处理，`--dw-*` 全数替换）。

## §3 手势（真机长按链路）

- 移动端长按改**影院同款逐卡绑定**（弃 diary 独有的「容器委托 + filter」形态）：`item.addEventListener('contextmenu', preventDefault)` + `longPress(item, …)`。
- `bindWallContext` 的 contextmenu 委托加移动端分流：真机触屏长按 ~500ms 会伴发 `contextmenu`，不分流就弹桌面跟手菜单盖住抽屉（影院 mobile-3fix B 同款真机缺陷）。
- `user-select: text` 两端退役（用户拍板）：系统文本选择接管会发 `touchcancel` 掐死 `longPress` 500ms 计时；diary 曾是全插件唯一开豁免的域（issue 217 正文可复制），现回归 `none`（继承 `.bz-diary-item`），`tests/diary/mobile-press-guard.test.ts` 静态守卫防回归。

## §4 同类替换

- `src/diary/render.ts`：`wallPanelHTML()` 删除自绘抽屉 markup（含 `sheet-close` 图标键）。
- `src/favorites/shared.ts`：`ctxMenuHtml` / `sheetHtml` 退役。
- `openSheet` 兜底：构建期异常上屏 `notice` + 复位 `sheetEntry`（真机无控制台，见 §1）；栈进 `console`。

## §5 验收

- `pnpm test` 266 文件 / 4192 例全绿；`tsc --noEmit` 干净。
- 新增回归：长按 + contextmenu 同发只出抽屉（`tests/diary/actions.test.ts`）、移动端长按手势守卫（`tests/diary/mobile-press-guard.test.ts`）。
- 原型壳自检迁移 core 选择器（`.bz-item-sheet` / `.bz-item-menu` / `.bz-item-sheet-item`），diary 壳新增长按开抽屉全链断言。
- 真机：用户复验通过（2026-09-11）。
