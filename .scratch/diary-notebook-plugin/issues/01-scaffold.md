# 01 — 工程骨架与空插件装载

**What to build:** TS + esbuild 的标准 Obsidian 插件工程就位：构建命令一键产出可安装产物（manifest、main.js、styles.css）到 vault 插件目录；vault 设置页出现「日记本」插件并启用无报错（暂无可视功能）；vitest + jsdom 测试框架就位，`npm test` 与类型检查作为门禁可运行。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `npm run build` 产出插件三件套到 vault 插件目录
- [ ] vault 中启用「日记本」不报错，可正常禁用/启用
- [ ] `npm test` 跑通（含一个冒烟测试）
- [ ] 类型检查通过
