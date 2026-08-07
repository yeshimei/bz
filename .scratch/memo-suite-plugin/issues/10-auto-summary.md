# 10 — 自动摘要

**What to build:** 常驻监听 `归档/网页剪藏` 新文件，AI 生成摘要/标签写回 frontmatter。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] vault create 监听（目录前缀边界判断，只处理 归档/网页剪藏 下新文件）
- [ ] AI 处理：正文截断 6000 字符 → 提示词（标题 15-30 字禁标点/作者可 null/摘要 150-250 字禁「本文」前缀/3-6 个中文标签≤5 字）→ ai.prompt(prompt, 'deepseek-v4-flash')
- [ ] frontmatter 全字段重建（数组→列表、空值→""、引号/换行转义），写回 title/author/summary/tags
- [ ] 失败静默降级（console.warn，不打断使用）
- [ ] 设置开关（常驻监听可关）
- [ ] 测试：create 事件触发 → mock AI → frontmatter 写回断言
