# 04 — 解析层

**What to build:** 从文件内容解析日记条目（纯函数，不碰 DOM/vault）：按 `# emoji序列 HH:mm` 标题切分条目的日记解析（emoji 序列→多标签、时间越界跳过、空行分段、旧 `type` 字段兼容、加密条目标记）；影视条目（frontmatter 影评/观影日期/海报/tags → 主标签映射）；信条目（frontmatter date/readonly，正文去 frontmatter）；自然语言时间解析（`N分钟前`/`N小时前`/`N天前`/`N秒前`/`昨天 HH:mm`/`前天 HH:mm`/标准格式）。

**Blocked by:** 03 — 标签配置、类型与状态

**Status:** ready-for-agent

- [ ] 日记解析全分支测试通过
- [ ] 影视/信解析全分支测试通过（缺失 frontmatter/无效日期/readonly 忽略）
- [ ] 自然语言时间全分支测试通过（含非法输入返回 null）
