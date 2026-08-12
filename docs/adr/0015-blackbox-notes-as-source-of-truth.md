# 0015 黑匣子条目笔记化——笔记即事实源（附双链与铁律豁免边界）

黑匣子（bz 第 19 域）v2 将三类条目（概念与实体/文献笔记/核心知识）存于 `blackbox.json` 纯 JSON，用户经 grilling 会话（2026-08）决策改为**笔记化落盘**：`黑匣子/概念|摘抄|想法/*.md`，**笔记即事实源**，blackbox.json 降级为派生层（画像/事件/复盘/对话/词表）+ id→路径索引（ADR-0013 的 v2 schema 的 entries 段随之废除，v2 → v3 自动迁移）。

动机：知识要成为 vault 一等公民——用户在 Obsidian 里直接编辑笔记（改标题/改内容），主面板与 AI 实时同步（metadataCache changed + vault rename/delete 事件 → 索引重建 + 面板刷新）；笔记间用 Obsidian 原生双链组织（摘抄 → [[来源]]+[[概念]]、概念 ↔ [[关联概念]]、想法 → [[摘抄]]），反链由 Obsidian 原生反链面板呈现，来源笔记除下述豁免外绝不写入。

**Considered Options**：① JSON 事实源 + 笔记只读镜像——用户手改笔记会被静默覆盖，体验割裂，否；② 双写 + mtime 回读双向同步——最重，否；③ 笔记即事实源（选定）。

**铁律 #1 豁免边界**：选中文字录入概念/摘抄时，把来源笔记中选区原文替换为 `[[目标笔记|原文字]]`（恒用别名形式，显示仍是原文字）——这是**唯一**写来源笔记的动作，带四重守卫（选区与 frontmatter/代码块/数学块重叠、选区已是链接 → 跳过），其余笔记格式一律不可动。用户明确要求此豁免。

**Consequences**: 新笔记格式（frontmatter：id/type/createdAt/emotions/people/scene/source + 正文关联区双链）自落盘起冻结，同 JSON schema 铁律；黑匣子是第一个"笔记为数据"的域，与其他 18 域（全 JSON）架构不同；面板/检索/AI 全部改读笔记；rename 后 Obsidian 自动更新全库 wikilink，插件索引按 frontmatter id 重映射；定位（行级跳转 loc）与悬浮回显随本决策砍掉（双链替代，用户决策）。
