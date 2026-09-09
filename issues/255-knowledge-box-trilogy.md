# 255 · 知识盒三部重构（literature → knowledge 更名 + 主题展示）

ADR-0112。三盒并入一个域并全链更名「知识盒」：

- 部壹·文献：词典行列表 + 全文预览弹层 + 提炼成卡（源链/领域自动带、连一张旧卡+一句为什么、源文献 related 互链）；两种录入（术语 AI 预览 / 视频任务管线）原逻辑承继、纸墨皮重绘
- 部贰·卡片：卡片目录扫描展示（领域读序 domain→category→未分类，存量零迁移、旧数据不动）
- 部叁·主题：主题笔记仅展示（MarkdownRenderer 只读渲染）；检索归第二大脑，关联机制探索中
- 更名：src/literature→src/knowledge、命令 bz-knowledge-*、设置键 knowledge*（零迁移）、事件 knowledge:tasks/file-*、数据文件 knowledge.json（旧文件一次性原样复制迁移）、DOMAIN_ICONS/home 曝光位/smartcat 通道与文案同步
- 移除：领域筛选/搜索/双击打开/抽屉/面板设置按钮/引导（原型唯一真理）

原型：.zcode/ui-prototypes/knowledge-box-c/index.html（用户评审通过）
测试：tests/knowledge/* 适配 + ui.test 重写 13 契约；全量 4169 绿。
