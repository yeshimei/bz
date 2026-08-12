# 48 — 黑匣子流式面板样式收敛 + 移动端断点

**What to build:** `styles.css` 黑匣子面板段重写：流式骨架样式（header 动作区 / 类型标签栏 / 搜索框 / 日期分隔条 / 三类卡片）/ 删五标签与三浏览页旧样式（tab、概念墙网格、文献架列表、想法池列表）/ 保留事件卡、画像卡、详情、chips、词表样式（弹窗复用）；移动端断点照搬日记本（768px 宽 95% + 顶部圆角 + 类型标签单行横滚 + 紧凑内边距 / 480px 全屏）；长按手势与 fixMobileSelect 不搬（卡片无编辑/复制交互）。

**Blocked by:** 46, 47

**Status:** done

## 验收标准

- [ ] 流式样式：`#bz-blackbox-panel` 布局 = flex column（header/标签栏/搜索/流）；类型胶囊 `.bz-blackbox-type-btn` + 选中态（仿日记标签按钮）；搜索框（仿 diary-search-input）；日期分隔条 `.bz-blackbox-stream-date`（sticky top 0，z-index 10）；卡片 `.bz-blackbox-stream-card`（边框圆角 12px 内边距 20px，仿 diary-entry-card）+ 三类型铺法类
- [ ] 删除旧样式：`.bz-blackbox-panel-tabs/.panel-tab-btn/.panel-tab-btn-on/.panel-content/.panel-tab-content`、`.bz-blackbox-wall-grid/.concept-card*`、`.bz-blackbox-shelf-*`（列表形态）、`.bz-blackbox-pool-*`（列表形态）；保留 `.bz-blackbox-event-card*`、`.bz-blackbox-profile-*`、`.bz-blackbox-detail-*`、`.bz-blackbox-term-chip*`、`.bz-blackbox-emotion-tag`、`.bz-blackbox-people-tag`、`.bz-blackbox-words-setting` 等弹窗/录入复用样式
- [ ] 移动端：`@media (max-width: 768px)` #bz-blackbox-panel 宽 95%、顶部圆角（16px 16px 0 0）、类型标签单行横滚隐藏滚动条、卡片/日期条紧凑；`@media (max-width: 480px)` 全屏无圆角；人物/时间线弹窗 95% 宽（沿用既有）
- [ ] 全量验证：`npx tsc --noEmit` 无新增错误；`npm test` 全绿；smoke.test.ts 命令清单不变（4 命令）

## 引用

- `.scratch/blackbox-suite-plugin/spec.md`「样式」「移动端」节
- `styles.css` 黑匣子段（678/992/1503 行区间，中间态样式收敛到 styles.css 的既有惯例）
