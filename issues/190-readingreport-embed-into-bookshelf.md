# 190 — 读书报告内嵌化：独立弹窗退役、报告改为书架墙面板内视图（ADR-0091）

## 背景
review-all-domains-ux 全域体验审查拍板「报告全面内嵌化」。用户原话：「书的报告，影视报告都一样，写进面板中」。src/reading-report 为旧脚本逐字移植的 10 段长报告独立弹窗域（分片渲染/progress toast/错误人话化已到位）；书架墙面板已稳定，报告入口原经深链另开独立弹窗。

## 用户拍板（已全部拍板，实施项）
1. 报告嵌入书架墙面板：左栏「阅读分析报告」入口=面板内切换到报告视图，带返回书架路径；独立窗退役删除。
2. bz-reading-report-open 改「打开书架墙面板并切报告视图」（home 报告磁贴/书架左栏入口自动受益）；id 与 smoke 命令表同步。
3. 统计只算书库目录：对齐书架墙口径，库外 book 标签笔记不再混入（口径注释 + 用例）。
4. 报告内同面板筛选：作者 Top5/分类行点击=同面板切回书架并预填筛选（作者进搜索/分类进分类筛），原深链作废。
5. 图表升级三件：三环形图改水平条形行；热力图去 slice(0,1) 加 ‹ › 翻月；年卡点击展开该年 12 月柱（与翻月共用月柱生成）。
6. 报告视图存续期间自动刷新，只更新内容区（参考影院 registerAutoRefresh 先例）。
7. lucide 化：🧮/❌/🏆 等 emoji 换 lucide；报告视图关闭钮仅移动端。
8. 空态带动作：主按钮引导回书架收录。
9. 设置键评估：bookshelfMobileDefaultFullscreen 若语义被面板覆盖则删（评估结论：书架墙面板/读书笔记弹窗仍消费，保留并在 settings.ts 注明）。
10. 通知正文无 emoji 自查（通过）。

## 变更
- **src/reading-report/index.ts**：重写为面板内容区渲染器（renderReadingReport/cancelReadingReport/handleReportInteraction/unloadReadingReport）；弹窗/遮罩/ESC/z-order/移动全屏覆写退役
- **src/reading-report/stats.ts**：getAllBookNotes 只算书库目录；新增 getHeatmapMonthKeys/getYearMonthBars；趋势 icon 字段 lucide 名
- **src/reading-report/report.ts**：generateBarRows/generateMonthBarColumns 共享图元；三环形图退役；热力图翻月段头；年卡展开体；data-rr-author/data-rr-cat 筛选属性
- **src/reading-report/styles.css**：条形行/翻月段头/月柱/年卡展开体/可点行样式
- **src/bookshelf/{state,ui,index,constants,styles.css}**：M.view 视图容器与切换、报告入口互切绘制、面板委托接报告交互、registerAutoRefresh 按 view 分流、openBookshelfReport、closeOverlay/unload 收口 cancelReadingReport；REPORT_COMMAND_ID 删除
- **src/main.ts**：bz-reading-report-open 回调换线 openBookshelfReport（id/名称不变）
- **src/settings.ts**：bookshelfMobileDefaultFullscreen 注释更新（保留理由）
- **tests**：reading-report index/error/report/stats 同步重写 + 新用例；bookshelf ui +7 用例（视图切换/返回/命令路径/作者筛选/分类筛选/自动刷新/渲染中止）
- **docs**：CONTEXT.md（阅读报告段 + 移动全屏键段）；本 ADR

## 门禁
pnpm exec tsc --noEmit 0 错 + pnpm test 全量绿（合并 master 后 3997 用例）；worktree 内不 build。
