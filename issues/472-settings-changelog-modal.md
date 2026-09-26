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

## v2 迭代（2026-09-26，用户反馈：给用户看 + 自动版本号 + 主次）

**需求**：根据提交历史自动加版本号；内容展示有主次；用通用更新日志表达，写给用户而非程序员。

**口径**
1. 版本切点 = 「主构建部署产物」提交日（部署即发版，2026-09-08 起有此约定）；此前史前史按自然周归并。
   版本前向合成：首版 v1.0.0（08-07 诞生周），块内含 feat → 次版本 +1（修订归 0），仅 fix/perf → 修订 +1
   （判定用原始提交类型，不受内容过滤影响）。当前合成到 v1.24.0，**回写 manifest.json**（单一版本事实源）。
2. 内容改写（用户视角）：主题句 = 「——」前段落，其后细节作弱化副行（≤78 字截断）；剥 issue/ticket/ADR/呈报
   尾注与中置括号引用、emoji、早期「N 测试」计数；内部工程条目过滤（评审/走查/收口/守卫/契约/基准/单源/重构…）；
   副行残留开发措辞（测试/断言/收口/清账）→ 清空副行保留主题句；主题句超 42 字截断。
3. 展示主次两级：块内分「新功能（主，accent 标题 + 主层级行）/ 问题修复 / 体验优化（次，灰调）」；
   条目 = 域标签 chip + 主题句 + 弱化副行。版本栏最新在前，当前版带「当前」签；默认选中最新版。
4. 域分类降级为条目上的小标签（v1 的左栏域导航让位给版本导航——通用更新日志以版本为纲）。

**数据规模**：25 版本 / 508 条（v1 全量 1314 条 → 用户向过滤后 508）。

## v2.1 打磨（2026-09-26，用户截图反馈）

1. 布局修复：条目内层容器误用外层同类 .bz-chg-body（display:flex），主题句与副行被挤成一行 →
   内层独立为 .bz-chg-entry（块级堆叠），副行恢复「另起一行灰色小字」的设计层级。
2. 符号转逗号：用户要求一句话表达、分隔只用逗号——加号/箭头/斜杠/间隔点/竖线/顿号一律转逗号并折叠空格，
   主题句与副行同规则；数据测试钉符号禁令（SYMBOL_RE）。
3. 澄清口径：日志覆盖建仓（2026-08-07）以来全部历史提交，feat/fix/perf 共 1314 条，过滤内部条目后 508 条。
