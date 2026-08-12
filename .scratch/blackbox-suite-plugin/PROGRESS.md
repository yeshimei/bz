# PROGRESS — 黑匣子域（blackbox-suite-plugin）

> 进度恢复点。每次重要节点更新。唯一事实源 = `.scratch/blackbox-suite-plugin/spec.md`（v3 笔记化）。

## 2026-08 · grilling 会话落盘（v3 笔记化架构）

**会话产出**：spec.md 重写为 v3（笔记化 + 双链 + 实时同步）、ADR-0015、CONTEXT.md 更新（黑匣子/来源笔记/三类条目词条）、本文件。

**最终决策速记**（详见 spec.md）：

- 三类条目笔记化落盘 `黑匣子/概念|摘抄|想法/*.md`，**笔记即事实源**（ADR-0015）；blackbox.json v3 = 派生层 + id→路径索引
- 双链：摘抄→`[[来源]]`+`[[概念]]`、概念↔关联、想法→`[[摘抄]]`；来源笔记选区内原位注入 `[[目标|原文字]]`（铁律 #1 显式豁免 + 四重守卫）
- 标题：摘抄/想法 AI 生成（失败降级前 20 字），概念 = 概念名；文件名冲突 `-N`
- 实时同步：metadataCache changed + vault rename/delete/create → 索引重建 + 面板 refreshAll
- 录入：概念双输入（名 + 文本，文本空→生成卡片 / 非空→确定录入）、正文 textarea 自适应 ≤8 行、选中文字自动填充锁定（只读）
- 命令：+3 直达命令 `bz-blackbox-capture-concept/-literature/-thought`（保存即关）；`bz-blackbox-capture` 保留
- 面板：标题「黑匣子」；搜索框默认隐藏、🔍 在 ⚙️设置 前切换、隐藏即清空关键词
- 定位（loc 行级跳转）与悬浮回显**砍掉**（双链替代，用户决策）
- 迁移：v2 → v3 load 时自动、幂等（entries → 笔记，概念=名/其余=前 20 字，失败条目重试）

**待实现 tickets（建议顺序）**：

- [ ] T1 数据层：blackbox.json v3（index/派生层）+ v2→v3 迁移 + 笔记 frontmatter 解析/normalize + 标题去重/文件名清洗（纯函数）
- [ ] T2 录入弹窗：概念双输入/按钮条件/锁定/自适应行高、摘抄/想法流程 + AI 标题（保存时）+ 保存即关
- [ ] T3 命令与面板：三直达命令注册（main.ts COMMANDS + smoke）、面板标题「黑匣子」、搜索框切换（隐藏即清空）、面板读笔记渲染（frontmatter + 正文 + 关联区 chips）
- [ ] T4 双链与同步：原位注入（替换 + 四重守卫）、metadataCache/vault 事件 → 索引 + 面板刷新
- [ ] T5 迁移工具收尾 + 全量测试更新（tests/blackbox/ 各文件 + smoke）
