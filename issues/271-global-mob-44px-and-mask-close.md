# issue 271：移动端全屏页顶部 44px 统一 + 弹窗关闭钮全域退役（遮罩点关统一）

日期：2026-09-11 ｜ 用户拍板：所有域主页面移动端全屏；全屏页顶部 44px；非全屏弹窗一律删右上角关闭钮，统一点遮罩关闭

## 摸底结论

- **全屏主页 12+ 处已存在**（cinema-midnight/diary/memo/belongings/clipbook/favorites/review/bookshelf/home/knowledge/encrypt/password-vault/recap/settings-panel），顶部避让三种流派：core `.bz-panel-mtop` 接管（diary/belongings/clipbook/review/recap/knowledge/encrypt/settings-panel/home/favorites——后两者模板里已挂类）/ 域内自管 44px（bookshelf/password-vault/memo）/ **缺口：cinema**（`midnightMobHtml` 面板根漏挂 mtop，顶部只有 space-lg ≈16px）。
- **弹窗右上角关闭钮 13+ 形态**：多数带 `bz-win-close` 类——core 既有规则（用户早前拍板「非真全屏一律隐藏关闭按钮」）已在 CSS 层 display:none，本次从源码彻底退役；另有真显示的（cinema cn-modal-x、belongings bd-close、knowledge sheet/term close、checkup 头行 x、core uiModal head 钮）。
- 遮罩点关缺口仅 1 处：knowledge 术语录入弹窗（termMask 无 click handler）。

## 改动

**顶部 44px**
- cinema `layouts/midnight/render.ts`：mob 面板根挂 `bz-panel-mtop`（全站统一档 `max(44px, env(safe-area-inset-top))`，首子顶垫由 core 归零）。

**弹窗 ✕ 退役（全部改点遮罩/ESC 关闭；全屏灯箱与全屏主页面头行钮不在范围，保留）**
- cinema：详情/表单弹窗 `cn-modal-x` 两处（HTML/绑定/CSS 死样式）。
- knowledge：sheet 标题栏 ✕、视频录入 ❌、历史窗 ❌（连同空按钮容器）、术语弹窗 ✕；**termMask 补点遮罩关**（唯一缺口）。
- encrypt：加密笔记预览 ✕。
- review：统计窗 ✕、历史时间线 ✕（含域内死样式）。
- smartcat：聊天窗 ❌、数据面板 ❌（头行只剩标题）。
- belongings：详情弹窗 ✕（遮罩走 mousedown，保留）。
- checkup：居中弹窗头行 ✕。
- core `uiModal`：head 模式不再渲染关闭钮（保留标题头行），调用点（bookshelf 笔记两处 / attach 移动附件）语义不变。
- 死样式清理：knowledge `.bz-kb-sheet-close`/`.bz-lit-sheet-close`、review `.bz-review-history-close` 等；core 的 `bz-win-close` 门控规则保留（`bz-icon-btn--close`/`todo-btn-close`/`news-close-btn` 仍有消费者）。

**范围外**：secondbrain 主面板（100vw-24 窄卡，ADR-0114 并行会话占用中，跳过）；cinema gazette/booth 为探索稿手机框非正式主页。

## 门禁

全量 4235/4235 绿 + tsc 干净 + 原型行为/渲染包重出（build-preview，preview-freshness 24/24）。
