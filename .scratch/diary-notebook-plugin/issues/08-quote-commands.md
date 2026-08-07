# 08 — 写摘抄与命令注册

**What to build:** 写摘抄流程：从当前编辑器取选中文本/当前行、span 内文本与 data-date/data-comment 提取、块 ID 补全（写入文件）、生成块引用双链；复用添加弹窗展示摘抄预览、默认选中「摘抄」标签、保存（书库/ 路径附加书名）→新增条目→跳转。命令注册：`diary-open-add-dialog`、`diary-create-quote`（原 id 保持，用户 Alt+A 热键继续生效）、`diary-open-panel`。

**Blocked by:** 06 — 主面板与条目列表, 07 — 弹窗族

**Status:** ready-for-agent

- [ ] 摘抄完整流程：选中文本→块 ID→预览→保存写回 mock 文件并新增条目
- [ ] 无选中时取当前行；无内容提示
- [ ] 命令 id 与热键兼容；保存后清理弹窗覆盖（保存/取消/遮罩还原）
