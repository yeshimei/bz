# ADR-0094：组件库扩充批次——新域重复样式收编共享库 + 带功能工厂 9 件

- 状态：已接受（2026-09-05）
- 关联：issue 195、`docs/ui-kit-manual.md`（§3/§4/§5 回写）、`docs/ui-design-manual.md` §6.4（控件高度中档与头行高度）、提案原稿 `.zcode/ui-prototypes/ui-extract/extract.css`（画廊原型定稿）

## 背景

新体系（`src/core/ui/`）落地后，todo/clipbook/cinema/bookshelf/favorites/belongings/recap/home 等域各自手写了大量同形制的面板骨架与控件：面板壳 8 份逐字重复、影院式整宽头行 4 份（+clipbook 50px 变体）、主头行 4 份、工具行 4 份、搜索框 6 份、左栏侧栏 6-8 套（clipbook 最全）、移动横滑 chips 5 份、统计卡 2 份近似拷贝 + 4 份简版、候选浮层 4 域自绘、进度条 4 份。同时社区对标（shadcn/ui · Ant Design）的常用控件（alert/kbd/skeleton/tabs/menu/sheet/taginput/rating/ring/checkbox 等）在画廊原型（`.zcode/ui-prototypes/bz-ui-gallery/`）中已定稿但未入主仓。为「全域替换」批次（issue 195 后续）备好共享层，先落库、后替换。

## 决策

1. **新域重复样式收编为共享库批次**：以上逐字重复的域内样式，归一为 `src/core/ui/components.css` 扩充批次（§A 面板壳 ~ §M 扩充第二批，40+ 类族），token 补 `--bz-control-h-md`（30px 中档）与 `--bz-head-h/-lg`（44/50px 头行档）。取值全部来自既有域最佳实现（来源见 components.css 注释），不新造视觉值。
2. **命名归一**：跨域同物异名统一为一套 BEM——提示条收编为 `.bz-alert`（域内 info-bar/hint 等别名废弃）、下拉/右键菜单收编为 `.bz-menu`（dropdown/ctxmenu/item-menu）、底部抽屉收编为 `.bz-sheet`（item-sheet/筛选抽屉/详情抽屉）；候选浮层独立为 `.bz-popover`（`.bz-select-menu` 同形制，`select.ts` 本体不动，A4 合并延后）。
3. **带功能工厂只配 9 件**（`src/core/ui/`，转发桶 `index.ts` 暴露）：`uiIconSpan`/`mountIcons`（收编 6+ 域本地 iconSpan/mountIcons 副本）、`uiSearch`、`uiMainHead`、`uiRail`、`uiMobStrip`、`uiStat`、`uiProgress`、`uiPopover`；另给 `uiResizable` 加可选 `persist`（ADR-0084 尺寸记忆收编：load 恢复 + onChange 防抖 300ms save + detach flush，仿 todo 域 savedPanelSize/rememberPanelSize，不传行为不变）。
4. **分两批落地**：本批只落共享库（样式 + 工厂 + 测试 + 手册回写），**不动任何存量域**；全域替换随后另票执行（替换时逐域确认旧类名与新体系无同名冲突，对齐 ui-kit-manual §6 新旧边界）。

### 工厂范围取舍（skip 项理由）

其余扩充组件（alert/kbd/skeleton/tabs/menu/sheet/taginput/rating/ring/desc-list/divider/checkbox/radio/input-number/status/crumbs/steps/table/card/list/media/avatar/fab/pagination/collapse/timeline/popconfirm/quote/mark/code/multiselect/monthpicker/strength/stat-trend/data-tip）**本批只落纯视觉规格、不配工厂**——判定依据 = ui-kit-manual §7 新增流程：**只有多域重复实现且交互/状态逻辑需要句柄的组件才升工厂**；上述控件是纯展示或一次交互（域内 addEventListener 即可），手写 HTML + `mountIcons` 直接消费 §3.2 类，先例 `todo/ui.ts` 模板拼装。若全域替换批次中发现某组件的交互逻辑也在多域重复（如 pagination 的页码窗口计算、taginput 的 chips 状态），再按 §7 流程升工厂并回写 §4，本批不预设。`.bz-progress` 虽是纯视觉，但 4 域同构 + setValue 钳制逻辑重复，故破例配工厂（`uiProgress`）。

## 理由

- 收编先行可让全域替换批次变成「纯搬运 + 删域内 CSS」，评审面从视觉回归缩到结构替换，降低 20 域级联风险。
- 命名归一避免替换期出现双名并存（铁律：不并存双写）；`.bz-select-menu` 暂不动，待 A4 合并时一并处理。
- 工厂克制：纯视觉组件配工厂会制造无状态的空壳 API，反增维护面；`uiResizable.persist` 把各域防抖记忆代码（todo/clipbook 各一份）收进共享层，是本批唯一的行为性增量。

## 后果

- `src/core/ui/index.ts` 导出面扩大（+9 工厂 +9 类型）；测试 `tests/core/ui.test.ts` 净增 37 用例（52→89：结构/类名/事件/句柄/persist 防抖）。
- 存量域样式零变化（本批未替换任何域）；根 `styles.css` 需构建聚合后才见新类。
- 全域替换批次遗留：8 域面板壳/头行、6 域搜索、6-8 域侧栏等的替换与域内旧类删除；`.bz-select` 与 `.bz-popover` 的合并（A4）延后。
- 手册已同步：ui-kit-manual §3.1/§3.2/§4/§5、ui-design-manual §6.4。
