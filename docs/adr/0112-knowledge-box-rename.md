# 知识盒：三盒并入 + literature 域更名 knowledge + 主题仅展示

背景：文献盒（literature）升级为知识体系枢纽「知识盒」，并入卡片盒与主题盒的展示与提炼入口。用户拍板：①三盒并入一个域并全链更名（命令 ID `bz-knowledge-*`、设置键 `knowledge*`，零迁移——沿用 ticket 136 键名更名先例）；②面板 UI 以评审通过的原型为唯一真理（P5 词典风、三部切换：部壹文献/部贰卡片/部叁主题）；③主题部仅做展示——写作与检索归 Obsidian + 第二大脑（灵感参考 / AI 对话），知识盒不做检索、不建大纲、不替用户定流程（候选提取等关联机制探索中，暂不实现）；④文献→卡片提炼：手动为默认，落卡铁律=连一张旧卡+一句为什么，来源与领域自动带（related 键）；⑤卡片盒存量 1505 篇零迁移，领域读取顺序 domain→category→未分类；⑥复习计划与第二大脑完全不动。

## Considered Options

- 三盒各自成域 / 纯文件夹不做域（均否：碎片化或无属主；用户定位「整体是一个知识架构系统」）
- 大纲空位驱动、AI 起草、聚合起草等主题流程（均否：用户明确「主题笔记就是一个笔记，我自己写自己组织」）
- 候选提取（从主题笔记引用中提炼候选卡，交用户抉择）：方向获认可但用户明示「还没想好」，整体搁置探索

## Consequences

- `src/literature` → `src/knowledge`；事件通道 `literature:tasks` → `knowledge:tasks`；smartcat 等消费方同步
- 设置键 `literature*` → `knowledge*`（零迁移，默认值=既存行为）；新增 `knowledgeCardboxDirectory`（默认 卡片盒）、`knowledgeTopicDirectory`（默认 主题盒）
- 卡片写入卡片盒：frontmatter category=领域、related=来源文献；同时在来源文献 frontmatter.related 追加新卡（互链）
