# 267 — 首页入口按端独立排序/隐藏 + 域快捷菜单 + 设置面板侧栏七组

- status: done（已合并 master `8d19662a`，构建部署完成）
- type: feat（首页交互 + 设置面板信息架构）
- 分支: worktree `feat/home-ui`（从 master d2f48191 分叉，合并前同步至 6585a69c）
- 提交: `b3bf881c`（源 + 原型）· `e0525a6a`（产物）· `53bf84b8`（merge）· `8d19662a`（主仓产物 + 行尾根治）
- 依据: AGENTS 铁律 5（域 UI 唯一真理源 = 与原型共用的实现源码）/ ADR-0104（markup 单源）/ ADR-0106（行为单源）/ issue 246（外观组范式）

## 背景

用户 2026-09-10 在快速原型模式下逐条点名四件事，随后追加「同步」走完整收尾：

1. 首页域增加「外观」组放到最上面；
2. 拖拽的那个组放下面；
3. 去掉「已隐藏」三个字，隐藏的就排到最下面；
4. 左侧边栏重新分类分得更细。

另有一项在同期提出：移动端域设置页右上角关闭按钮删掉（左侧已有返回钮）。

本 issue 是 `feat/home-ui` 分支的收尾归档——该分支此前还承载了「入口右键菜单/长按抽屉」
「入口顺序自由排序」两批改动（用户逐条点名确认清单后落地），一并记在此处。

## §1 入口顺序与显隐：home.json v3，按端各一份

**形状** = `{ version:3, desk:[], mob:[], hiddenDesk:[], hiddenMob:[] }`。

顺序与隐藏**都按端各一份**：桌面删的域不会从移动端消失。旧 v2 的单一 `hidden` 两端共用
是 bug —— 两端屏幕上的入口形态本就不同（桌面是入口行、移动是两列瓦片），在一端调另一端的
顺序只能靠想象，因此拍板「各端只调自己，互不影响也互相改不到」。

- 读：`loadHomeOrder`（`src/home/order.ts`）→ v2 的 `hidden` 由两端各继承一份（迁移）；
- 写：`saveHomeConfig(order)` 提交**整份**（含另一端，本端编辑不动另一端）。

### 1.1 修 `reorderTo` 的下标口径（真 bug）

旧实现按**完整序列**（含隐藏项）解释拖拽落点下标 → 有隐藏项时落点整体错位。
`reorderTo` 新增第 4 参 `hidden`，语义改为「下标**只对可见域计数**，落盘 = 新可见序列 + hidden 追尾」。
纯层在 `src/home/shared.ts`（node 可测）。

## §2 入口编辑器：浮层弹窗 → 面板内联

新增 `src/home/entry-editor.ts`（`mountHomeEntryEditor`），由首页域「入口」组的 custom 行挂进
设置面板插槽。**不再开浮层弹窗、不再有「编辑入口…」按钮、不再挂「移除的域仍可从命令面板打开」说明行。**

交互：拖动排序（Pointer Events；触屏先按住 ~200ms 再拖，短滑归列表滚动）+ 点 × 移除。

**移除的域不分区、无「已隐藏」标题**（用户拍板）——就地排到同一列表最下面，弱化显示
（`.bz-home-ent-row--off`：`opacity:.72` + 拖柄 `visibility:hidden`，不参与排序），
点 + 即可加回可见列尾部。`.bz-home-ent-sec` 与 `.bz-home-ent-list--off` 全退役。

## §3 首页域拆两组：外观在上、入口在下

组[0]「外观」走 issue 246 通用范式：`choiceCards` 布局「活动河」+ 主题「米白」（`layoutKey homeLayout` 联动），
新增占位键 `homeLayout`/`homeSkin`（`src/settings.ts`，默认 `default`/`cream`）+ 预览类
`.bz-sp-mini.bz-sp-prev-cream`（`src/settings-panel/styles.css`）。域 UI 消费待将来做真皮肤时接入。

组[1]「入口」= custom 行挂内联编辑器。**schema 层不传端**——由 entry-editor 依 `isMobileEnv()` 自行判定。

> 注意：没有 `custom` 行时本域会被 `listableDomains` 滤掉（button 行不计数），别再把它换成 button 行。

## §4 域快捷菜单（同分支早先落地，一并归档）

右键菜单/长按抽屉走 `core/item-actions`，清单在 `src/home/shared.ts` 的 `DOMAIN_MENU`：
**只放域自己的快捷动作**（不放「打开 X」——入口本身就是打开；不放「整理顺序」——排序改直接拖拽）。
**本表没有条目的域 = 不挂右键菜单/长按抽屉**（空的就别弹）。

移动抽屉盒头版式：上排 = 彩色域图标 + 域名一行、下排 = 灰字（域名副题）；作用域 `.bz-home-menu`，
经 `core/item-actions` 新增的 `sheetClass` 通道传入。番茄钟菜单文案随专注态动态
（`isFocusing()` → 「停止专注」/「开始专注」）。

## §5 设置面板：侧栏七组 + 移动域页去关闭钮

`NAV_SECS`（`src/settings-panel/ui.ts`）重分七组：

| 组 | 域 |
|---|---|
| 基础 | global / appearance / home |
| 智能 | ai / secondbrain |
| 记录 | diary / memo / belongings |
| 收集 | clipping / favorites |
| 媒体与阅读 | cinema / bookshelf / review / knowledge |
| 工具 | pomodoro / smartcat |
| 安全 | encrypt / password-vault |

18 个可见域全在表内，**无「其他」尾组**。桌面导航与移动列表同源同序（共用 `groupDomains`）。

**移动端域设置页去掉右上角关闭钮**：域页已有一枚返回钮弹回首页，再叠一枚关闭会并排、误触率高；
关面板走首页页那枚。`buildMobile` 里域页那枚不再挂（`data-sp-mob-tools="domain"` 留空壳），
全 DOM 只剩首页页一枚。

## §6 原型自检同步（本轮主要工作量）

**症状**：设置壳自检从 48 项处 `ERR Cannot read properties of undefined (reading 'querySelector')` 崩掉，
**后半段（移动端整段）从来没跑过**。根因是三个独立问题叠在 dir-picker 那一节：

1. **首页域那节之后没切回日记本域** → 面板停在首页页，而 dir-picker 那节用当前窗格找「日记目录」行
   → 永远 `undefined`。修：本节开头显式 `diaryNav.click()` + `waitPaneGroups(3)` 恢复窗格上下文。
2. **`bz-sp-path-btn` 只在空态渲染**（有值走 chip）——种子给了 `diaryDirectory`，行里根本没有按钮
   → master 上就是这里崩（`Cannot read properties of null (reading 'click')`）。
   修：入口改「chip / 按钮二选一」，面包屑断言改「回显当前值」。
3. **种子缺 `homeLayout`** → 主题行 `layoutKey` 联动把唯一选项「米白」滤空（与 diarySkin 同口径）。
   修：`fake-sim.ts` 的 `SEED_SETTINGS` 补 `homeLayout`/`homeSkin`。

顺带修的既有陈旧段：`bz-sp-mob-modal` 全表已不存在（M1 早改成**推入成页**，标记是 `bz-sp-mob-pushed`）；
`diarySkinTheme` 种子值随 ADR-0115 正名 `ivory`→`gallery`（旧值不在 schema options 里，卡无选中态）；
AI 徽标断言 `9`→`5`（采样参数组 4 行已于 2026-09-08 退役）。

**结果**：设置壳 **82/82**、首页壳 **70/70** 全绿（此前设置壳从未跑完，4 项长期红）。

## §7 行尾根治（收尾时踩到）

`.gitattributes` 此前只固定了 `prototypes/**/*.js`，**未覆盖原型侧 `.ts` 种子**
（`fake-sim.ts` / `fake/*.ts`）。这批文件被 build-preview 内联进产物，而**源指纹是对磁盘字节算的**
—— `autocrlf=true` 下 worktree 检出 CRLF、主仓 LF，两份 git 都认为干净但指纹不同，
换个位置重出就刷一遍指纹行（6 个壳受影响，「构建位置无关」的承诺对这批文件失效）。

修：补 `prototypes/**/*.ts text eol=lf` 并把 26 个种子的工作区重整为 LF。
实测产物连续两次重出逐字节一致、指纹与构建位置无关。

## 门禁

| 项 | 结果 |
|---|---|
| `vitest run` | 257 文件 / **4153 用例全绿** |
| `tsc --noEmit` | 0 错 |
| 设置壳自检 | **82/82**（本轮新增 29 项断言） |
| 首页壳自检 | **70/70** |
| 新鲜度守卫 | 24 例绿 |
| `pnpm run build` | 通过，已部署 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz` + 仓库根 |

## 遗留

- 首页时间线改读小橘行为流（用户已批白名单口径 A：只放 22 个 `source:type` 组合，
  `news:skipped` 等噪音丢弃；真实 vault 数据统计见 `.workbuddy/memory/2026-09-10.md`）。未开工。
- `homeLayout`/`homeSkin` 是占位键（可看可选可落盘），域 UI 消费待做真皮肤时接入。
