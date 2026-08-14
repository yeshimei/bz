# 64 — 设置/样式/装配收尾

**What to build:** 黑匣子 v4 装配收尾：设置弹窗 6 项（AI provider/ollama URL/ollama 模型/maxHistory/showSpeculativeEvents/情绪词表可编辑，删 reviewThreshold/typeFilter）、移动端双断点（768/480，沿用日记本）、styles.css 收敛（删 v3 样式）、smoke 命令清单 3 个、全量测试绿 + tsc 零新增 + 构建直出 vault + 提交。

**Blocked by:** 60, 61, 62, 63

**Status:** ready-for-agent

- [ ] 设置弹窗 6 项生效（字段消费点：提炼/面板/对话）
- [ ] 移动端断点 + 样式收敛（无运行时注入 style）
- [ ] smoke 命令清单 3 个；全量测试绿 + tsc 零新增
- [ ] 构建直出 vault；一次提交