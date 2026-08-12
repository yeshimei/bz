# 01 — 数据层笔记化：v2→v3 自动迁移 + 笔记读写引擎 + 索引

**What to build:** 黑匣子数据从 blackbox.json 条目迁到 vault 笔记（`黑匣子/概念|摘抄|想法/*.md`），**笔记即事实源**（ADR-0015）：存量 v2 数据加载即自动迁移为笔记（幂等、失败条目保留重试）；新增笔记读写/解析/索引引擎（frontmatter + 正文关联区双链 → 内存条目）；所有保存路径（录入、卡片盒导入）改走笔记。**内存条目接口保持既有形状不变**——主面板/对话/复盘/事件提炼/AI 零改动继续工作，但数据已来自笔记。这是 expand 步，刻意不拆：拆开会进入"写 JSON、读笔记"的坏中间态。

**Blocked by:** None — can start immediately

**Status:** done（实现完成，1069 测试全绿）

- [ ] 存量 blackbox.json（v2）load 时自动迁移：概念标题=概念名，文献/想法标题=正文前 20 字（去空白），frontmatter（id/type/createdAt/感触外壳/卡片盒可选字段 category/tags/summary）与正文（定义/摘抄/想法 + 关联区 `[[…]]`）落盘正确；related/terms 按 id 解析为概念名写入关联区
- [ ] 迁移幂等：重载不重复生成；单条失败留在原数据段下次重试；完成后 blackbox.json 为 v3（entries 段删除、index id→路径 建立、派生层原样保留）
- [ ] 笔记读写引擎：按 id 建/读/改/删笔记；frontmatter 缺省字段容错（normalize）；关联区 `[[…]]` 解析回条目关联（related/terms）；标题冲突 `-N` 去重、文件名非法字符（`\/:*?"<>|`）清洗
- [ ] 录入保存路径与卡片盒导入产物全部落盘为笔记（导入的 category/tags/summary 保留在 frontmatter）
- [ ] 主面板/对话/复盘/事件提炼不改代码仍工作，数据来自笔记；既有测试在笔记数据源下保持绿色
- [ ] 测试：迁移幂等/解析容错/去重清洗/索引构建（mock vault 文件树）
