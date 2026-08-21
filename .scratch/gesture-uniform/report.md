# 手势操作统一侦查报告

> 日期：2026-08；范围：bz 插件各功能域主界面列表的「打开 / 修改 / 编辑 / 删除」手势实现盘点与统一方案。
> 结论先行：**长按实现有 7 份拷贝、3 种时长、操作语义映射五花八门、桌面端零悬停按钮**——建议以 `core/dom.ts longPress` 唯一化 + 新增统一「行操作条/菜单」组件收敛。

---

## 一、现状盘点（按域）

### 1.1 各域列表手势一览

| 域 | 打开/预览 | 编辑/修改 | 删除/移出 | 长按实现 | 时长 |
|---|---|---|---|---|---|
| diary 日记本 | 内容**双击**→跳 md；emoji **单击**→标签选择器 | 标签选择器内「保存」（改标签/加密） | 标签选择器内「删除」按钮 | 手写 `addLongPress`（entries.ts:316，含 `getEnableLongPressSetting` 开关残留） | 800ms |
| memo 备忘录 | 标题链接**单击**→笔记/URL；checkbox 完成 | **场景标签长按**→编辑弹窗 | **时间标签长按**→删除（core confirm） | 手写 `attachLongPress`（ui.ts:107，场景/时间共用，无移动阈值） | 500ms |
| belongings 归物本 | 无（单击即进编辑，无详情/预览） | **单击卡片（<500ms）**→编辑弹窗 | **长按卡片 600ms**→删除（自绘确认弹窗 + createModalShell 整套自绘 UI） | 手写 pointerdown 计时（ui.ts:205，无移动取消、无 touch-action 处理） | 600ms |
| clipping 剪藏本 | **双击**卡片→跳原文 md；单击无操作 | 无（列表内不可编辑） | **日期 span 长按**→删除（自绘确认 mask） | 手写 `addLongPress`（view.ts:582，10px 阈值仅 touchmove 检查） | 800ms |
| password 密码本 | 平台链接**单击**跳转；账号/密码**单击**复制；👁 显隐 | **密码区/备注长按**→编辑弹窗 | **日期 span 长按**→删除（自绘确认） | 手写 `attachLongPress`（ui.ts:27，无 preventDefault、无移动阈值） | 500ms |
| favorites 收藏本 | 标题链接**单击**→打开 URL；📄 按钮跳笔记 | **类型标签长按**→编辑弹窗 | **日期 span 长按**→删除（core confirm） | **core `longPress`**（已收敛 ✅） | 600ms（CONFIG.LONG_PRESS_DELAY） |
| library 书库 | 封面/标题**单击**→读书笔记；EPUB 封面**双击**→阅读器 | 笔记树/批注视图：想法**内容长按**→编辑 | 批注/划线**日期长按**→删除 | **core `longPress`**（已收敛 ✅；主列表本身无手势） | 500ms |
| movie 影视 | 卡片**双击**→打开 md 文件 | **状态徽标（在看/想看）单击**→编辑弹窗 | 无列表内删除（编辑弹窗内删） | 无长按（纯 click/dblclick） | — |
| review 复习计划 | 内容**单击**→打开笔记 | 阶段标签**单击**→评分弹窗（标记复习） | **时间 span 长按**→移出复习（自绘确认） | 手写内联计时（ui.ts:470） | 500ms |
| encrypt 保险箱 | **单击**卡片→预览 | 无（还原即"取出"） | **长按卡片**→还原（core confirm；语义为还原非删除） | **core `longPress`**（已收敛 ✅） | 500ms |
| launcher 入口页 | **单击**磁贴→运行命令 | **长按 0.5s**→编辑模式；编辑模式**单击**→操作菜单（改名/图标/尺寸/删除） | 操作菜单「🗑 删除磁贴」/ 左上角 × | 手写 pointerdown 长按 + 拖拽（ui.ts:606，位移 10px 阈值，自有模型） | 500ms |
| flash 闪念 | 结果卡**双击**→跳转；**悬停 300ms**→预览 | 无（WIP） | 无 | 无长按 | — |
| quiz / news / pomodoro / attach / ai-agent / reading-report / bili | 非手势管理型列表（答题流、dataviewjs 渲染、文件选择、外部工具） | — | — | — | — |

### 1.2 长按实现副本清单（核心问题）

`core/dom.ts longPress`（500ms 默认；mousedown/touchstart 计时；移动 10px 取消；touchstart preventDefault + 短按补发合成 click）是唯一"标准件"，但只有 **favorites / library / encrypt** 在用。其余 7 处手写副本：

1. **memo** `attachLongPress`（500ms）：无 10px 移动阈值（任何 touchmove 直接取消）；不补发合成 click；start 里 preventDefault。
2. **password** `attachLongPress`（500ms）：无 preventDefault、无移动阈值——长按后 touchend 会继续冒泡，依赖目标元素没有 click 监听才不误触（脆弱）。
3. **clipping** `addLongPress`（800ms）：`isLongPress` 标志 + touchend preventDefault；**10px 阈值只在 touchmove 检查**——桌面 mousedown 后拖动不会取消。
4. **diary** `addLongPress`（800ms）：与 clipping 同构，另带 `getEnableLongPressSetting()`（设置项已移除、恒启用，属于死代码残留）。
5. **belongings** pointerdown 计时（600ms）：无移动取消（按住滑动也触发删除！）、无 touch-action；且用的是「单击 <500ms = 编辑」模型，与其他域"长按 = 操作、单击 = 打开"完全相反。
6. **review** 内联计时（500ms）：与 password 副本同构但内联在卡片渲染里。
7. **launcher** pointerdown 长按 + 拖拽（500ms）：特殊场景（编辑模式），可保留但时长应引用统一常量。

**时长三档不一致**：500ms（core/memo/password/review/launcher）、600ms（favorites/belongings）、800ms（clipping/diary）。

### 1.3 操作语义映射混乱（核心问题）

- **"哪个区域 = 哪个操作"全靠记忆**，且互不相同：
  - 删除：memo=时间标签长按、password/clipping/favorites=日期长按、review=时间长按、encrypt=整卡长按、belongings=整卡长按、library=高亮日期长按、diary=标签选择器里的按钮。
  - 编辑：memo=场景标签长按、password=密码区/备注长按、favorites=类型标签长按、belongings=单击（！）、movie=徽标单击、library=高亮内容长按、diary=标签选择器。
- **打开手势不统一**：单击（favorites/review/encrypt/library/launcher）、双击（clipping/movie/diary）、单击=编辑（belongings，连打开都没有）。
- **桌面端零悬停操作按钮**（仅 flash hover 预览、favorites hover 底色），全部操作靠长按鼠标——桌面用户"长按"即按住不放，可发现性与效率都差。
- **删除确认也不统一**：core confirm（memo/favorites/encrypt/diary 的标签选择器代理）；自绘（password/review/clipping/belongings 各自一套 mask；belongings 甚至整套 createModalShell 弹窗体系）。
- 已知缺陷叠加：belongings 按住滑动误触删除、password 长按后可能透传 click、clipping/diary 桌面拖动不取消。

---

## 二、统一方案意见

### 2.1 目标：一套手势、一套组件、一套语义

| 操作 | 统一手势 | 说明 |
|---|---|---|
| 打开/预览 | **单击** | 所有域一致（belongings 补"详情/预览"入口，或单击即编辑保持现状——建议补预览） |
| 跳转原文/阅读器 | **双击** | 保留现状语义（clipping/movie/library 已用），并作为通用"列表→笔记"跳转 |
| 编辑/删除/更多 | **长按 → 操作条/菜单**；桌面 **hover 操作条** | 不再"长按=直接删除"，先出菜单再确认；删除必走 core confirm |
| 删除 | 菜单项 + **core confirm 二次确认** | 消灭 4 套自绘确认 |

### 2.2 基建：长按唯一化 + 统一操作条组件

1. **`core/dom.ts longPress` 唯一实现**，删除全部手写副本（改动用点见表）：
   - 补：mousedown 后移动也检查阈值（桌面拖动不误触）；保持合成 click 与 preventDefault 语义一致。
   - 新增全局常量 `GESTURE_LONG_PRESS_MS = 500`（或设置项，默认 500；clipping/diary 的 800、favorites/belongings 的 600 归属到设置或直接统一）。
2. **新增 `core/item-actions.ts` 统一组件**（与 notice/confirm/escManager 同层）：
   - `attachItemActions(card, { open?, edit?, delete?, extra? })`：向卡片注入 `.bz-item-actions` 操作条（样式写 styles.css，类名 `bz-` 前缀，守铁律 9）。
   - 桌面：hover 显示操作条（打开 📄 / 编辑 ✏️ / 删除 🗑）；触屏：长按弹出同构小菜单（或卡片右下角常显）。删除项自动接 `confirm()`。
   - launcher 磁贴操作菜单复用同一组件结构（保住"编辑模式=管理"既有心智，只换实现）。

### 2.3 各域迁移点（按优先级排）

| 优先级 | 域 | 改动 |
|---|---|---|
| P0 | memo / password / review / clipping / diary | 手写长按 → `longPress`；语义收敛：编辑/删除移入操作条+菜单，单击=打开 |
| P0 | belongings | 重建卡片交互：单击=详情/编辑、长按=菜单；删除确认换 core confirm；补移动取消 |
| P1 | favorites | 已用 core longPress，仅把"日期=删、类型=编"收敛为操作条（时长并入统一常量） |
| P1 | library / encrypt | 已用 core longPress，仅接操作条（高亮块属小块，可保留"内容=编辑/日期=删"并补 hover 提示，从轻） |
| P2 | movie | 补一致的操作条（桌面 hover），保留双击打开 |
| P2 | launcher | 时长引用统一常量；操作菜单接统一组件 |
| 不动 | flash（hover 预览/双击跳转）、quiz、news、pomodoro、attach、ai-agent | 非手势管理型列表，保持 |

### 2.4 风险与注意事项

- **铁律 3（DOM id/类名稳定）**：只新增 `.bz-item-actions` 等新类与组件，不改既有 id/类名；clipping `#article-*`、memo `#todo-*` 等均不动。
- **行为变化需用户感知**：长按从"直接删除"变"出菜单"，会改变老用户肌肉记忆——changelog 写明；clipping/diary 的 800ms 可先在设置里保留。
- **触屏滚动冲突**：统一长按的 touchstart preventDefault 要保持 core 版现有处理，diary 的 `fixMobileSelect` 文本选择逻辑迁移时保留。
- **测试**：tests/<域>/ 下长按相关用例（memo/password/clipping/diary/belongings/review 的 UI 层用例）随迁移同步改；core 长按补用例（含合成 click、移动取消、桌面拖动取消）。
- **不扩大范围**：铁律 4 已知缺陷与本任务无关，不动。

### 2.5 预期收益

- 用户心智统一：**单击=打开、双击=跳原文、长按/hover=操作**，不再记"日期管删、标签管编"的暗语；
- 代码面：-7 份长按副本、-4 套自绘确认、-3 档时长常量，删除类缺陷（belongings 滑动误触、password 透传 click）随之消失；
- 桌面/移动体验对齐：桌面 hover 操作条 = 触屏长按菜单，同一套语义。