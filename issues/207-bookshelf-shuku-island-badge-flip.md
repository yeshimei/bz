# Issue 207: 书库正名 + 排序浮岛 + 月柱翻转 + 状态文字角标

日期：2026-09-06　状态：已交付
前置：issue 199（浮岛 segmented 拍板）/ issue 201（收藏本排序 uiChoice float 先例）/ issue 204（书架统计行布局修复）

## 需求（grill-with-docs 四问拍板）

1. 「书架墙」正名「书库」：**界面 + 小橘文案都改**（用户拍板扩大到行为流口径）；
2. 主页面排序（最近阅读/书名/作者/进度 四档下拉）改浮岛，搜索框拉长，**照待办**：搜索 flex 拉长 + 浮岛收内容宽靠右；
3. 「每月读完」月柱翻转：**本月置首**，向右倒退到 11 个月前；
4. 书卡右上角状态圆点改文字签（浅底小字签档）：未读=灰签、在读=品牌橙签、已读不渲染任何东西。文案用数据词 未读/在读（用户更正：不引入「未看/在看」新词），全域状态文案零改动。

## 实现

### 一、正名书库（用户可见文案清零书架墙）

- 面板头行标题（ui.ts bz-panel-title）、空态「书库还是空的」、设置按钮题注「打开书库设置」；
- 命令名 `bz-bookshelf-open` → 「书库」（main.ts，ID 不变）；
- 设置面板域名「书库」（settings-panel/ui.ts，desc 藏书封面墙保留）；
- home 磁贴名（home/domains.ts）；体检报告三处（checkup/files.ts EPUB 阅读数据（书库）、checks-orphans.ts 进度 tick 与封面缺失 detail）；
- 报告空态主按钮「去书库添加」（reading-report/index.ts）；报告视图「‹ 返回书架」→「返回书库」（rail 入口 + 移动头行钮题注）；
- 小橘行为流：「你把《X》加入/移出了书库」（behavior-wording.ts、description-generators.ts）；
- CONTEXT.md：「书库 (Library)」与「书架墙」两词条合并为「书库 (Bookshelf, 原名「书架墙」)」，加 _Avoid_，全文残留「书架墙面板」改「书库面板」；
- 契约不动：命令 ID bz-bookshelf-*、`书库/` 目录名、全部设置键、frontmatter 状态值 未读/在读/已读、smartcat 来源标签/credibility 规则。

### 二、排序浮岛 + 搜索拉长（ui.ts + styles.css）

- 桌面工具行排序 uiSelect → `uiChoice<SortKey>` float（同待办：滑动白卡指示器、aria-label「排序方式」），保持 `className: 'bz-bs-sort'` 供遮罩点击委托分流；onChange 语义不变（M.sortMode 会话临时态 + renderShelves）；
- 删域内 `.bz-bs-search { flex: 0 0 240px }` 定宽覆盖 → 回落共享 `.bz-search` 的 flex:1 拉长；
- 移动抽屉排序维持 uiSegmented 原样（浮岛为桌面工具行专属，同待办口径）。

### 三、月柱翻转（data.ts computeStats）

构建逻辑不变，循环后 `bars.reverse()`——bars[0]=本月（isThis 高亮随首柱），bars[11]=11 个月前；标签与数据同柱由既有映射保证；峰值/累计底注与 reading-report 年卡月柱（独立实现）不受影响。

### 四、状态文字角标（ui.ts bookCardHTML + styles.css）

- `.bz-bs-statusdot` 圆点退役（statusColor 保留——详情弹窗状态 chip/编辑钮 dot 仍用）；
- 新 `.bz-bs-status-tag`：绝对定位同原圆点槽（top/right 7px），10px 半粗 + 胶囊浅底（未读 = surface-hover 底 + text-2 字；在读 = brand-soft 底 + brand 字）；已读零渲染（模板层 ternary，非 CSS 隐藏）；桌面/移动书卡同结构同款。

## 测试

- 翻转：data.test 两处月柱断言倒置 + 零值柱用例补「bars[0] 标签 = 本月」；
- 角标 +1：三态书卡——未读/在读出签（在读带 .reading）、已读无签、`.bz-bs-statusdot` 零残留；
- 浮岛 +1：sort-slot 出 `.bz-choice--float` 四档（最近阅读/书名/作者/进度）、无 uiSelect 残留、aria-label；
- 文案同步：smoke 命令名、settings-panel 域名三处、面板头行标题、报告空态按钮、smartcat 文案两例 + credibility 样例词（移出书库）。

## 跟进（二轮拍板，2026-09-06）

1. **书卡状态角标整个下线**：浅底字签实测「不好看」，连同圆点方案一并废弃——书卡封面一律零状态标识（状态只在侧栏筛选与详情弹窗呈现）；`.bz-bs-status-tag` 样式与模板删除，`bz-bs-report-chev` 之外的同轮遗留一并清理。
2. **报告入口尾随三角删除**：左栏「阅读分析报告 ›」/「‹ 返回书库」的 chevron-right 移除，`.bz-bs-report-chev` 样式删除。
3. **工具行 spacer 清理**：搜索框与排序浮岛间的残留 `bz-main-spacer`（旧排序靠右布局遗物）删除，搜索 flex:1 直抵浮岛。

测试：角标用例翻转为「零角标」断言（圆点/字签/尾随三角全否）；书架 ui.test 39/39 绿。
