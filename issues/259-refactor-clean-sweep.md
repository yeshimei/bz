# 259 — 全域重构 + 大扫除（rules-books 规则驱动）

- status: done
- type: refactor（行为保持，零功能变更）
- 分支: `refactor/clean-sweep-259`（worktree `bz-refactor-clean`）
- 规则依据: `.scratch/agent-rules-books` mini 版三册（Refactoring / Clean Code / A Philosophy of Software Design）

## 结果

72 文件，+729/−958，净 −229 行；全量门禁 4195 测试 + tsc --noEmit 全绿。

| 组 | 范围 | 要点 | 域内测试 |
|---|---|---|---|
| G1 | encrypt, password-vault | 5 处确认框样板→`askConfirm` 单源；`renderDesktop`(~125行) 沿资产缝线拆 4；`DEFAULT_PW_CHARSET` 单源化；死代码 ~23 行 | 232 ✓ |
| G2 | diary-wall, reading-report | 删 diary 拷贝残留死导出 3 个 + 死导出 2 个（~116 行）；`isEncHidden` 谓词收 5 处；`renderWall`/`openSheet` 拆解；魔数命名 | 215 ✓ |
| G3 | smartcat | `as any` 95→51；退避/id 构造魔数常量化；`consumeLibraryDiff` 五段构块收敛 | 1138 ✓ |
| G4 | knowledge, todo | todo `as any` 21 处清真实类型（API 边界 5 处保留）；死状态 `noteView`/`editingId`；死 ICON 键 8 个 | 217 ✓ |
| G5 | review, secondbrain | 死方法 3 个（`accuracyToRating`/`renderTop`/`openSettings`）；`quizWithAI` 舞步收 3 处；`DEFAULT_R_THRESHOLD` 归位 queue | 536 ✓ |
| G6 | 原型单源七域 | clipbook/cinema 死函数与死 state；settings-panel DOM 挂载 `as any`→WeakMap；favorites 按并行会话占用仅最保守清理 | 629 ✓ |
| G7 | core + 小域 | 设置行三行样板 ×7 收口 `newRowSetting`；ai.ts override 分支 7 处 `as any` 消除；core 240 导出全量 grep 确认零死导出 | 879 ✓ |

## 硬边界遵守

- 零行为变更：文案/命令 ID/DOM/类名/样式（css 全未动）/数据格式/统计口径未动；render.ts 仅删 1 行死导入（输出逐字节不变）。
- diary 域未投资；单源域导出签名全稳定；worktree 内未构建，原型产物由主仓库部署构建重出。

## 留拍板（未动）

1. encrypt ↔ password-vault 跨域大面积重复（`PasswordVaultDataManager` 几乎整文件等）——ADR-0109 有意拆回，合并需拍板。
2. core `AIService.reason/search/reasonAndSearch` 生产零调用仅测试引用——公共 API 面收缩需拍板。
3. `src/secondbrain/_cdp-selftest.mjs` 开发工具混居 src/——建议迁 scripts/。
4. secondbrain text-search 每查询两条 `[文本检索]` console.log——有意运维日志，可考虑 debug 开关。
5. report.ts 尾部空 grid 块/趋势段空头部 div（疑似死 markup）——受「markup 不变」保护，需产品侧确认。
