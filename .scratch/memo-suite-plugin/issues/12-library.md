# 12 — 书库

**What to build:** 书库面板完整移植：书目列表、9 项显示开关、设置弹窗、读书笔记弹窗（高亮/评论）。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 面板 + `书库/` 与 `我的/读书笔记` 聚合（getBookItems/parseBookNotes）；排序（sortItemList key/order）
- [ ] 书目卡片：标题/作者（✍️）/阅读进度（📊 %）/阅读时间（⏱️）/文件大小（📦）/状态颜色（getStatusColors）/🧮 统计按钮
- [ ] 9 项设置：folderPath/notePath/bookTag + 显示开关 showFileSize/showReadingTime/showHighlights/showThinks/showReview/showCategory
- [ ] 面板内设置弹窗（openSettingsModal/closeSettingsModal）
- [ ] 读书笔记弹窗（showBookNotes：📚《书》的读书笔记，❝ 高亮 + 日期 + 评论）；高亮跳转（jumpToHighlight）、评论编辑（openEditCommentModal/updateComment）、删除高亮（deleteHighlight）
- [ ] 空态「📭 没有找到符合条件的书籍」「📭 没有找到高亮或批注」；高亮编辑/删除失败提示（原文不匹配）
- [ ] 命令 `open-library`/`open-book-notes` 裸注册；changelog 'library'
- [ ] 测试：书目解析/显示开关过滤/高亮 CRUD
