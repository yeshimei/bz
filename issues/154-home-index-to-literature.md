# 154 — 主页统计条「索引」改「文献」，点击开文献盒

**状态**：✅ 已完成

## 用户拍板

> 索引改为文献，点击打开文献盒

## 改动（vault 脚本 `CONFIG/SCRIPTS/DataView/主页.js`，仓库外 + CONTEXT.md）

- 统计条第三组首项由「N 索引」改「N 文献」：计数 `indexCount`（`我的/索引/` 页数）→ `literatureCount = dv.pages('"文献盒"').length`，与卡片/主题的文件夹口径一致。
- 点击动作 `__homeActions.索引`（type: note，开 `我的/其他/收藏夹/索引.md`）→ `__homeActions.文献`（type: open，`bz-literature-open` 命令，开文献盒主面板）。
- 插件侧零改动：`bz-literature-open` → `openLiteraturePanel`（src/literature/index.ts）已就绪。
- CONTEXT.md「主页统计条」词条同步：特例仅剩「主题/卡片」，补 ticket 154 说明并更新 _Avoid_。

## 验收

- 主页.md 重新渲染后显示「N 文献」，点击打开文献盒主面板。
- 文档型改动，无代码路径，构建/测试不受影响。
