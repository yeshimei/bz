# 02 — core 共享层

**What to build:** 共享基础设施（自 Q3.js 移植，未来其他脚本迁移复用）：ESC 全局层级管理器（register/unregister/destroy，ESC 从最上层找可见层关闭）、通用确认弹窗（DOM 与原版一致，接入本地 ESC 管理器）、工具函数（HTML 转义、随机块 ID、睡眠）。全部可在 jsdom 中工作。

**Blocked by:** 01 — 工程骨架与空插件装载

**Status:** ready-for-agent

- [ ] ESC 管理器：多层注册后 ESC 关闭最上层可见层；unregister/destroy 生效
- [ ] 确认弹窗：标题/文案/按钮文本、确认与取消回调、ESC 关闭、点击遮罩关闭
- [ ] 工具函数行为正确
