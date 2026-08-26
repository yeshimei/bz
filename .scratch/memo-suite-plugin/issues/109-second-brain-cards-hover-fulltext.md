# 109 — 第二大脑统计卡精简改版 + 灵感参考悬停全文

**What to build:** 用户 grilling 共识：顶卡去重精简（7→6）、嵌入维度新卡、固定网格布局、K/M 数值缩写、「最厚笔记 Top5」连根删除、悬停浮层加宽断词不限高。

**Blocked by:** 108

**Status:** in-progress

## 验收清单

- [ ] 顶卡 7→6：删「内容规模」（与下方内容规模明细区重复）、「白名单覆盖」（与覆盖笔记语义重叠），新增「嵌入维度」卡（`stats.dim`，tip 注明嵌入模型）
- [ ] 布局：桌面 `repeat(6,1fr)` 一行 6 列；≤768px `repeat(3,1fr)` 两行 3 列
- [ ] 数值 ≥10,000 用 K/M 缩写（如 19.7K / 1.24M），hover title 恒为千分位精确值
- [ ] 「最厚笔记 Top5」连根删：createUI 容器 + 渲染函数 + `computeStats.topThickets` 字段与接口 + statistics 测试断言
- [ ] 死代码清理：`clearSummaryCache`（108 后无调用方）、`fmtScale`（随内容规模卡孤儿化，若确认无他处消费）
- [ ] 悬停浮层：宽 300→460px、正文取消 `max-height:150px` 硬截断、补 `overflow-wrap:anywhere` 断词（长 URL/代码不横向裁切）、top 钳制尽量贴屏内、左贴边定位常量同步
- [ ] 不改动项（用户确认已实现）：拖出浮卡八向缩放（makeResizable）、浮卡正文全文（float 态 CSS 放开 clamp）
- [ ] 测试：statistics.test.ts 删 topThickets 断言、补 fmtCompact 与维度卡用例；受影响 UI 断言修正
- [ ] 门禁：pnpm test 全绿 + tsc --noEmit 0 + 构建部署验证 + 自审/diff 审查；文档同步（spec 59-60 + Further Notes、本 issue、PROGRESS）

## 决策记录（grilling 三轮）

- Q1 布局：桌面一行 6 张不再加卡；移动端一行 3 张共两行
- Q2 「白名单覆盖」替身 = 嵌入维度（数据现成零迁移，与索引健康互补）
- Q3 K 缩写门槛 = ≥10,000 才缩；以下原样；hover 给精确值
- Q4 / Q6 拖出卡缩放、浮卡超长块高度：用户确认既有实现已满足 → 需求关闭不动代码
- Q5 悬停浮层 = B 不限高随内容生长（超长块底部超出屏幕部分不可达的代价用户知悉；top 钳制尽量多显示）；加宽 + 断词仍做（治「折断」主诉）
- 触发范围维持整卡悬停（比仅标题更宽容）；智能左右定位维持
- 附带：clearSummaryCache 死代码顺手清
