# 366 · 实现：账本域（51，349 拍板完成）

> labels: wayfinder:task ｜ map: 346 ｜ status: open ｜ assignee: — ｜ blocked-by: —
> 上游：349 拍板票（已闭）、348 识图研究票（已闭）；367 CSV 研究已取消（用户拍板不需要）

## 拍板记录（用户 2026-09-17 逐项确认）

1. **主入口 = 识图为主**：面板首屏即「发截图」——粘贴/选图（支持多张排队）→ AI 提取 → 确认卡（金额/分类/日期/商户可改再入账，绝不自动落账；低置信度高亮）。手记为次要入口（工具行「记一笔」）。识图入口旁明示「截图将发送至第三方 AI 服务」（研究票 348 风险条款）。
2. **分类 = 内置+自定义**：内置 ~12 常用分类，用户可增删改；定义存 data.json 设置键（范式=363 修订后的 favoriteTags）。
3. **首版报表 = 全量**：月度总览（收/支/结余）+ 分类占比条形 + 月度趋势柱状 + 商户 Top N，周期切换；reading-report 分片渲染范式。
4. **归物本联动 = 首版不做**（二版候选）。

## 通道设计（两通道同一确认-入账管线；2026-09-17 用户拍板砍 CSV 通道，367 取消）

- **识图（主）**：见上；core `ai.json({ text, images })` 通道，提取 JSON 契约带「看不见的字段填 null」防幻觉约束；模型不支持视觉时人话报错引导。
- **手记（兜底）**：composer 式快速录入。

## 实现口径

- 数据 `CONFIG/STORAGE/ledger.json`：条目 `{id, amount(整数分), direction: income|expense, categoryId, date, merchant?, note?, source: manual|photo, created}`；零迁移首版直建。
- 命令：`bz-ledger-open`「账本」+ `bz-ledger-add`「记一笔」；main.ts 注册。
- 面板：overlay 范式（ESC 层/topifyZ/移动 `.bz-panel-mtop` 真全屏 44px 顶距/桌面遮罩点击关）；暗色全 token（吸取 356/358 修复教训）。
- 门禁：数据层+UI 层测试 + smoke 同步；门禁全绿。

## Resolution

（完成后填写）
