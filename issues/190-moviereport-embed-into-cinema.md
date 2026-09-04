# 190 — 影视分析报告内嵌化：独立窗退役、并入影院面板（ADR-0090）

## 背景
review-all-domains-ux 全域体验审查拍板「报告全面内嵌化」。用户原话：「不用弹窗了，写进面板中」。影院面板已有内嵌分析页（15 板块 + 正规化配色），src/movie-report 独立弹窗（19 板块）与之大量同源但更全。

## 用户拍板（已全部拍板，实施项）
1. 独立窗退役；命令改「打开影院面板并切到内嵌分析页」；id 是否保留自行判断（须三段式 + smoke 同步）。
2. 独立版多出的板块/统计维度并入内嵌页，不丢能力；共用 core/chart-palette 与 --bz-cinema-* 变量。
3. 19 板块标题 emoji 全换 lucide（照影院 sectionHTML icon 参数化）；关闭钮改 uiIconBtn 仅移动端；窗口标题既有拍板文案可保留。
4. 空库空态加主按钮「打开影院添加」（执行 bz-cinema-open）。
5. 头行小计：「N 部 · 已看 N · YYYY–YYYY」。
6. 打开期间自动刷新（照影院 registerAutoRefresh 先例，只更新内容区）。
7. 图表升级：三环形图改水平条形行（圆形统计被否）；热力图翻月；年卡展开 12 月柱。
   —— 实施核实：三环形图/热力图/年卡全部位于 reading-report（读书报告图表升级包，归书架墙内嵌化任务）；本票对齐「圆形统计被否」精神，将影视域唯一环形图（类型分布）改水平条形行。
8. 删 src/movie-report/** 与 tests/movie-report/**；全仓 grep 无残留；build-css SOURCES（无该域样式，零改动）；设置键（无独立键，零改动）；smartcat 等消费方（无引用，零改动）。

## 变更
- **删**：src/movie-report/{analysis,index,state}.ts、tests/movie-report/（2 文件）
- **src/cinema/state.ts**：CinemaItem + duration/seasonText
- **src/cinema/data.ts**：parseMovieFile 解析「片长」「季集」
- **src/cinema/analysis.ts**：19 板块（+片长画像/追剧深度）、类型分布条形行、19 板块 lucide 图标齐、空态动作按钮、analysisHeadSub 头行小计、buildStatPageHtml 整页组装
- **src/cinema/ui.ts**：renderStatPageHtml 委托 analysis；空态按钮点击 → 添加表单；新条目字面量补 duration/seasonText
- **src/cinema/index.ts**：openCinemaAnalysis（ensure + view='stat' + 开面板/就地切）
- **src/main.ts**：import 换线；bz-movie-report → bz-cinema-analysis（名称/icon 保留）；onunload 删 unloadMovieReport
- **tests**：smoke 命令表；tests/cinema/analysis.test.ts（+片长/季集/19 板块对照/条形行/小计/空态/整页 7 用例）；tests/cinema/ui.test.ts（+直达/空态动作/自动刷新 3 用例）
- **docs**：CONTEXT.md（影院段 + movie-report 退役段）；本 ADR

## 门禁
pnpm exec tsc --noEmit 0 错 + pnpm test 全量绿 + diff 自审；worktree 内不 build。
