# 01 — memo-suite 插件骨架

**What to build:** 标准 Obsidian 插件 `memo-suite`（显示名「备忘录」）工程落地：构建产物输出 vault 插件目录、设置页框架（含 AI 配置）、ribbon 主入口、懒加载架构——后续 19 个 ticket 的基座。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 构建产物 main.js + manifest.json + styles.css 输出到 `E:/Obsidian/叫我包仔/.obsidian/plugins/memo-suite/`，用户手动启用后插件可加载
- [ ] 设置页出现：AI 配置（provider：deepseek/opencode-go、apiKey、endpoint/model 覆盖）与各域路径设置骨架（todoFilePath/dataFolder/storagePath/articleDirectory/folderPath 等）
- [ ] ribbon 主入口打开「备忘录」待办面板
- [ ] 命令全部沿用原脚本 id 裸注册（`app.commands.addCommand`）、不设置默认快捷键（ADR-0004）；卸载时 removeCommand 清理
- [ ] 懒加载：事件常驻域（自动摘要/AIAgent/闪念）按设置开关注册；UI 域首次打开初始化（沿用日记本 init 幂等模式）
- [ ] 与既有 QuickAdd 宏共存：不冲突、不破坏原数据
- [ ] 测试：骨架加载冒烟（mock obsidian 环境）
