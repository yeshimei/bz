# 472 · 设置面板更新日志弹窗

## 需求

设置面板侧边栏最下面增加「更新日志」入口，点击打开独立弹窗；弹窗皮肤与设置面板一致。
内容依据 git 提交历史整理，**以各个域为分类**。写法参照社区规范调研结论：
Keep a Changelog（为人类写、条目化、注明生成口径）+ Conventional Commits（type→
新增/修复/优化三类的映射精神），按本项目「域为纲」落地。

## 方案

- **数据层（生成器，不入插件运行时）**：`scripts/_gen-changelog.mjs`，`pnpm changelog` 重跑。
  口径：feat/fix/perf 非 merge 提交 → scope→域映射（对齐设置面板 DOMAINS id，剪藏本=clipping）
  → 无 scope 关键词兜底 → 剥 issue/ticket 号前缀 → 前 16 字符键去重（保最新日期+较长文本）
  → 域内日期倒序。产物 `src/settings-panel/changelog-data.ts`（27 域 1313 条）入库随构建打包。
- **UI 层**：`src/settings-panel/changelog.ts`——`.bz-panel-overlay/.bz-panel-frame` 新壳
  （checkup 范式），frame 挂 `.bz-sp-skin` 即得面板亮/暗两套令牌（同皮）。hide 型常驻层：
  重开抬顶（ADR-0067 topifyZ）+ ESC 栈序重放注册 + trapPanelFocus。主体 = 左域栏
  （图标+名+计数徽标，复用 DOMAIN_ICONS）+ 右条目列表（日期 + 新增/修复/优化徽标 + 正文）。
  头行汇总「共 N 条 · 生成日期」。
- **侧栏入口**：`layouts/jingwei/render.ts` deskShellHtml 在 aside 内 nav 之后加 footer。
  nav 随搜索/切域整树重渲，入口必须是 nav 的**兄弟节点**；独立类 `.bz-sp-foot-chg`
  （**不复用** `.bz-sp-nav-item` 契约类——测试按它数导航项）。aside 转弹性列，nav 内滚，
  footer 常驻底缘。
- **卸载**：changelog 属 settings-panel 域，`unloadSettingsPanel()` 内收口（不动 main.ts）。
- **移动端**：入口是桌面侧栏项，移动 M1 无侧栏故无入口（非目标）；弹窗本体带 ≤768 回退
  （域栏转顶部横向签排）。

## 非目标

- 命令面板命令（未要求，弹窗仅面板入口）。
- 按版本分组（仓库无版本 tag，manifest 恒 1.0.0；按域分类即需求）。
- 移动端入口。

## 测试

- `tests/settings-panel/changelog-data.test.ts`（node）：域唯一非空、日期倒序、类型枚举、
  前缀已剥、META.total 一致。
- `tests/settings-panel/changelog.test.ts`（jsdom）：入口绑定与兄弟节点定位、契约类不污染、
  弹窗同皮、域栏与数据一致、域切换、条目三段结构、ESC/遮罩关闭、重开恢复、卸载幂等。

## 门禁备注

worktree 内全量测试按惯例排除 preview-freshness（CRLF 假红，ADR-0104/0133 省事口径）；
`prototypes/settings-panel/prototype-behavior.js` 与 `main.js/styles.css` 产物在合并回主仓后
`node scripts/build-preview.mjs` + `pnpm run build` 重出（行为单源：壳加载真 ui.ts 依赖链，
src 落地后原型自动生效，无需改原型文件）。
