# ADR-0090：影视分析报告内嵌化——独立报告窗退役，能力并入影院面板

- 状态：已接受（2026-09-04）
- 关联：ADR-0048（movie-report 独立域）、ADR-0087（旧 movie 域退役）、issue 190

## 背景
影院面板自增量增强起已有内嵌分析页（`M.view='stat'`，src/cinema/analysis.ts），且已完成配色正规化（`--bz-cinema-*` 变量亮暗两套 + core/chart-palette 共享色板）。src/movie-report 独立弹窗（19 板块）与内嵌页大量同源但更全，两套并存造成视觉/范式漂移与双份维护。全域体验审查（review-all-domains-ux）拍板：**报告全面内嵌化**——影视分析报告不再独立弹窗，独立窗内容并入影院内嵌分析页，命令入口改直达内嵌页。

## 决策
1. **独立窗退役、删域**：删除 `src/movie-report/`（analysis/index/state，588+33+23 行）与 `tests/movie-report/`；`unloadMovieReport` 与 ESC 层 `movie-analysis` 随域删除。
2. **命令改直达**：`bz-movie-report` 退役，新命令 `bz-cinema-analysis`（名称「影视分析报告」保留用户习惯，icon pie-chart 不变）→ `openCinemaAnalysis(app)`：ensureCinema + `M.view='stat'`，面板未开则开面板落分析页，已开则就地切换（幂等，复用影院面板，不新造第二套面板）。
3. **能力并入内嵌页（不丢能力）**：独立版独有的两板块并入——「片长画像」（片长分桶/平均片长/分组均长）与「追剧深度」（季集平均/追剧榜）；CinemaItem 增加 `duration`（frontmatter「片长」）与 `seasonText`（frontmatter「季集」）两字段的解析；内嵌页凑齐原 19 板块全量。
4. **lucide 化收尾**：19 板块标题全部带 lucide 线条图标（补 hourglass/timer/tv/heart/scale，原 emoji 全清）；独立窗关闭钮/窗口标题随窗消亡，不迁移。
5. **空态带动作**：分析页空库空态加主按钮「添加影视」（`data-cinema-analysis-add` → 页内打开添加表单；拍板原文「打开影院添加（bz-cinema-open）」为独立窗语境，内嵌后已在影院面板内，直达添加表单且避免 bz-cinema-open toggle 语义误关面板）。
6. **头行小计**：分析页头行右侧加「N 部 · 已看 N · YYYY–YYYY」（analysisHeadSub；单年只出一年，无记录省略年份段）。
7. **自动刷新复用**：报告页存续期间数据变化自动重算，走影院既有 `registerAutoRefresh`（cinema:file-* / vault:md-* → 300ms 防抖 → rebuildItems + renderAll，仅更新内容区），不新增订阅。
8. **图表升级（对齐「圆形统计被否」拍板）**：类型分布 SVG 环形图改水平条形行（softBarHTML 支持逐条目色，类型组仍用 CHART_TYPE_COLORS）；原拍板项中的热力图翻月/年卡下钻属读书报告（reading-report）图表升级包，归读书报告内嵌化任务，不在本票。

## 理由
- 单一实现单一入口：影视统计只维护 cinema/analysis.ts 一份，色板/变量/组件与影院完全同源。
- 用户显式拍板（2026-09-04）：「不用弹窗了，写进面板中」。
- 命令 id 随域走（三段式 `bz-<域>-<动作>`）：域已删，id 不再指认存在的东西；旧 id 无别名保留（Obsidian 快捷键按 id 绑定，需重绑一次，ADR 存档）。

## 后果
- smoke 命令表 bz-movie-report → bz-cinema-analysis（数量不变，31 条）。
- data.json 无设置键变化（独立窗从未有独立键，移动全屏沿用 cinema 键，ADR-0087 已定）。
- tests/cinema 增补：片长/季集数据层、19 板块对照断言、条形行断言、头行小计、空态动作、openCinemaAnalysis 直达、自动刷新。
- 读书报告内嵌化与图表升级包另行实施（书架墙面板）。
