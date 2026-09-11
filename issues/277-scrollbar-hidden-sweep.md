# issue 277：隐藏滚动条收敛为界面级一条规则（含可见条清理）

日期：2026-09-11 ｜ 用户拍板（一句话需求）：隐藏主界面和子弹窗的滚动条 ｜ 关联：ADR-0122（第 2 条：隐藏滚动条作用域 = bz 自有界面全量）、ADR-0080、docs/ui-design-manual.md（滚动条节）

## §1 现状与根因

手册早已拍板「全站隐藏滚动条（滚动功能保留），新 UI 一律不加滚动条样式」（`docs/ui-design-manual.md:352`，ADR-0080 同款），但实现是按域零散铺的：全仓 `scrollbar` 声明 60 余条落在 12 个域，且有可见条残留与整片漏网。

**可见条（违规）**：

- `src/knowledge/styles.css:153`（`.bz-kb-sc`）、`:306`（`.bz-kb-sheet-body`）、`:522`（`.bz-kb-list`）三处 `scrollbar-width: thin`。
- `src/encrypt/styles.css:50-51` 自绘 6px 滚动条（`::-webkit-scrollbar { width: 6px }` + thumb）。

**漏网根因（三条独立）：

1. **知识盒吃不到通用壳通杀**：它是全插件唯一自带私有面板壳的域（`popup.className = 'bz-kb-window kb'`，`src/knowledge/ui.ts:360`），于是 `src/core/ui/components.css:742-748` 的 `.bz-panel-overlay * / .bz-panel-frame *` 规则覆盖不到它；域内自己写的三处又是 `thin`（可见），预览弹层 `.bz-kb-sheet-body`（`:301`）、子弹窗 `.bz-lit-dialog`（`:623-637`，`overflow-y: auto` 无隐藏声明）各自为政。
2. **body 级弹层不在任何通杀作用域**：`createOverlay` 的 mask/popup 挂在 `document.body` 下（`src/core/dom.ts:167-194`），不在 `.bz-panel-overlay`/`.bz-panel-frame` 子树内 → `.bz-overlay-popup`（`components.css:587-599`，`max-height: 82vh; overflow-y: auto`）超长即出条。
3. **非 `bz-` 前缀的 legacy 容器**：`#knowledge-mask` / `#knowledge-video-popup` / `#knowledge-add-popup` / `#knowledge-history-popup`（`src/knowledge/ui.ts:354/882/1181/1337`）、日记三弹层 `#add-diary-popup`（`src/diary/ui/dialogs.ts:262`）、`.diary-tag-selector-popup`（`dialogs.ts:86`）、`.diary-datetime-scroll-container`（`src/diary/ui/datetime-picker.ts:60`）、`#review-entries-container`（`src/review/ui.ts:106`）、`#__shared_confirm_popup__`（`src/core/flow-dialog.ts:132`）——前缀不统一，靠前缀通杀会漏。

**已正确的现有实现**（作为删冗余的对照，均已隐藏）：cinema 28 条逐皮肤、secondbrain 8 组、diary、home、bookshelf、password-vault、settings-panel、review、`.bz-item-sheet-body`（`src/core/styles.css:751-757`）、`src/core/ui/components.css:742-748`。

## §2 修法契约（core 一条通杀 + 清理违规点）

**新增界面级规则**（落在 `src/core/ui/components.css` 既有隐藏滚动条区块，与面板壳规则并列为一条）：

```css
/* bz 界面级隐藏滚动条（ADR-0122）：滚动功能保留（不动 overflow），只隐藏条。
   作用域 = bz 自有界面：bz- 前缀类/ID + 通用面板壳整树 + 非 bz 前缀的遗留容器。
   刻意不用 * 通配——Obsidian 核心 UI（文件树/编辑器/核心设置）不属本插件，不隐藏。 */
.bz-panel-overlay, .bz-panel-overlay *,
.bz-panel-frame, .bz-panel-frame *,
[class^="bz-"], [class*=" bz-"],
[id^="bz-"], [id^="knowledge-"],
#add-diary-popup, .diary-tag-selector-popup, .diary-datetime-scroll-container,
#review-entries-container, #__shared_confirm_popup__ {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
/* 同选择器组 *::-webkit-scrollbar { display: none; } */
```

选择器清单按实现时的全量 grep 定稿：上表已含实查的全部 `document.body.appendChild` 弹层（belongings/bookshelf/cinema/checkup/clipbook/memo/favorites/encrypt/attach/reading-report 的弹层都带 `bz-` 前缀或挂 `.bz-panel-overlay`，前缀通杀已覆盖）。**判据**：新清单加完后跑一遍「全仓 scrollbar 声明 + overflow 容器」对照，凡仍可能露条的容器把选择器并入清单，**不得回退成域内自建规则**。

**清理违规点**（删，不新增）：

- `src/knowledge/styles.css:153 / :306 / :522`：删 `scrollbar-width: thin`。
- `src/encrypt/styles.css:50-51`：删自绘 6px `::-webkit-scrollbar` 与 thumb。
- 删除新规则已覆盖的重复实现：cinema（:47-48、:76-77、:117-118、:125-126、:132-133、:216-217、:306-307、:323-324、:346-347、:353-354、:392-393、:404-405、:431-432、:438-439）、secondbrain（:13-17、:450-455、:513-517、:655-661、:750-756、:1125-1127、:1230-1232、:1271-1273）、home（:61-62、:95）~~删除~~（本轮遗留：并行会话正在改该文件，避让；下轮清退）、bookshelf（:559-563）、password-vault（:60-65）、settings-panel（:276-281）、review（:23-24）、diary（:57-66）、core（`src/core/styles.css:751-757` 的 `.bz-item-sheet-body`）~~删除~~（本轮遗留：并行会话正在改该文件，避让；下轮清退）。
- 保留 `src/diary/ui/datetime-picker.ts:66` 的行内 `scrollbar-width: none`（内联样式、与新规则同向，无冲突；删了要动 ts）。
- `.bz-sb-scroll-y` 工具类（`src/secondbrain/styles.css:11-17`）随冗余声明一并退役——类仍在使用（`render.ts` / `reference-panel.ts` / `mobile-panel.ts`），只删其隐藏声明，类名保留为语义标记。

**边界**：不隐藏滚动**功能**（`overflow` 一律不动）；不动 Obsidian 本体界面（`*` 通配被显式否掉）；折叠/展开、键盘翻页、触底懒加载等行为零改动。

## §3 测试

- 新增 `tests/core/ui-scrollbar.test.ts`（读源文件文本范式，同 `tests/knowledge-style-fix.test.ts`）：
  1. `src/core/ui/components.css` 含界面级规则，覆盖 `[class^="bz-"]`、`[id^="bz-"]`、`[id^="knowledge-"]`、`#review-entries-container`；
  2. `src/knowledge/styles.css`、`src/encrypt/styles.css` 不再含 `scrollbar-width: thin` 与 `::-webkit-scrollbar { width`；
  3. 全仓 `src/**/styles.css` 零残留：`scrollbar-width: (thin|auto)` 与 `::-webkit-scrollbar-thumb` 为 0 命中（杜绝可见条回潮）。
- 改写 `tests/core/enh-sweep-c.test.ts:119-128`：原断言锁 review 域内自有规则（`#review-entries-container, #review-entries-container * { scrollbar-width: none`），改为「core 存在界面级隐藏规则」+「review 域内不再重复定义」。

## 改动清单

- **样式**：`src/core/ui/components.css`（新增界面级规则、并入面板壳规则）；`src/knowledge/styles.css`、`src/encrypt/styles.css`（删违规）；cinema / secondbrain / home / bookshelf / password-vault / settings-panel / review / diary / core 各删重复实现。
- **构建产物**：根 `styles.css` 由 `pnpm run build` 重新聚合（勿手改）。
- **测试**：新增 `tests/core/ui-scrollbar.test.ts`；改 `tests/core/enh-sweep-c.test.ts`。
- **文档**：`docs/ui-design-manual.md:352` 滚动条节改指界面级单源规则（域内不再自造）；ADR-0122 记录作用域边界。

## 验收

- [ ] 知识盒主界面、预览弹层、添加任务/术语子弹窗、历史弹窗均无可见滚动条，滚动照常
- [ ] body 级弹层（createOverlay 通用壳 / 设置弹窗 / 路径选择器 / 模型选择器 / 归物本详情与表单 / 收藏本表单）无可见滚动条
- [ ] 影院四种皮肤、第二大脑三界面、剪藏本、备忘录、回顾、阅读报告、保险库逐一面过目无条
- [ ] Obsidian 文件树/编辑器/核心设置**未**受影响（滚动条照旧）
- [ ] 全量门禁：`pnpm test` + `pnpm exec tsc --noEmit` + 自审 + diff 审查 + 主仓 `pnpm run build` 部署（分支侧 test / tsc / 自审 / diff 审查已过；主仓 build 部署待合并后执行）

> **首轮执行遗留（2026-09-11）**：`src/core/styles.css` 的 `.bz-item-sheet-body`（:751-757）与 `src/home/styles.css`（:61-62、:95）两处「已隐藏的冗余声明」本轮未删——主仓有并行会话正在改这两个文件，避让防合并冲突；新核心界面级规则已覆盖同批容器，删除纯属去重、不删不影响任何可见效果，留待下轮清退。
> **review 收口（2026-09-12）**：review（Standards 轴）点名的 bookshelf（借书卡详情弹窗/内部滚动体）与 diary（#add-diary-popup/.diary-tag-selector-popup/.diary-datetime-scroll-container 三组域内重复定义）残留冗余已当场清退（`f1a0546b`）；上述两条避让项仍留待下轮。
