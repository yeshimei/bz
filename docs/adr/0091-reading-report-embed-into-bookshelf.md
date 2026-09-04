# ADR-0091：读书报告内嵌化——独立报告弹窗退役，报告改为书架墙面板内视图

- 状态：已接受（2026-09-04）
- 关联：ADR-0090（影视分析报告内嵌化，同期姊妹票）、ADR-0013（报告并入 EPUB 书目）、issue 190（movie-report 半票）

## 背景
src/reading-report 是旧脚本逐字移植的 10 段长报告独立弹窗域（分片渲染 + progress toast + 错误人话化已到位）；书架墙（bookshelf）面板已稳定，但「阅读分析报告」入口经深链 `bz-reading-report-open` 另开独立弹窗，与影视侧（ADR-0090 影视报告并入影院内嵌页）范式漂移。全域体验审查（review-all-domains-ux）拍板：**报告全面内嵌化**——用户原话：「书的报告，影视报告都一样，写进面板中」。

## 决策
1. **独立弹窗退役**：reading-report 域不再建窗——遮罩/窗口/关闭钮/ESC 层/`allocZ`/`applyMobileWindowFullscreen` 全部退役；域保留 stats.ts（纯函数）+ report.ts（HTML 生成）+ index.ts（面板内容区渲染器 `renderReadingReport(container, app, opts)`）。分片渲染（ticket 40）、progress toast、错误人话化（m1b）机制原样保留；`cancelReadingReport` 作废在途渲染，在切视图/关面板/插件卸载三路收口。
2. **面板内视图**：bookshelf 状态增加 `M.view: 'shelf' | 'report'`，主面板内容区为两互斥视图容器。左栏「阅读分析报告」入口与移动头行报告钮面板内互切；报告视图左栏入口变「‹ 返回书架」（桌面返回路径，对齐面板范式），报告视图内关闭钮仅移动端显示。
3. **命令改直达**：`bz-reading-report-open`（id/名称/icon 不变）= 打开书架墙面板并切报告视图（`openBookshelfReport`：面板未开冷开直落、已开就地切换幂等）。home 首页报告磁贴、剪藏本深链、书架左栏入口同一去向，自动受益。
4. **同面板筛选（原深链作废）**：报告作者 Top5 卡带 `data-rr-author`、分类行带 `data-rr-cat`，点击在书架视图内预填——作者名进搜索、分类进左栏分类正交筛——不再跨面板跳转。
5. **统计口径只算书库目录**：`getAllBookNotes` 对齐书架墙 `scanMarkdownBooks`——只统计书库目录（bookshelfFolderPath 回落链）内的书，库外 book 标签笔记不再混入报告；EPUB（weave-data.json 全库聚合，ADR-0013）口径不变。
6. **图表升级三件（「圆形统计被否」拍板）**：a) 时段/分类/互动三个环形图改水平条形行（`generateBarRows` 共享范式，配色消费 core/chart-palette 粉彩系列）；b) 热力图去 `slice(0,1)` 硬编码，段头 ‹ › 月份切换（`getHeatmapMonthKeys` 全月范围，边界月禁用，只重渲染热力图主体）；c) 年度统计年卡点击展开该年 12 月柱（`getYearMonthBars` 月桶口径与翻月同源，`generateMonthBarColumns` 与趋势月柱共用生成器）。
7. **自动刷新**：报告视图存续期间书库数据变化自动重算只更新报告内容区——bookshelf 既有 `registerAutoRefresh`（vault:md-* + weave-data.json modify，300ms 防抖）按 `M.view` 分流，零新增订阅。
8. **lucide 化**：🧮 标题、❌ 关闭、🏆 排名、📈📉 等趋势 emoji 全清（trophy/chevron-left/chevron-right/arrow-left 等）；域内新交互元素样式写 reading-report/styles.css，容器布局归 bookshelf/styles.css。
9. **空态带动作**：空库空态用 uiEmpty + uiBtn 工厂（组件库基线），主按钮「去书架墙添加」切回书架视图收录。
10. **设置键评估**：`bookshelfMobileDefaultFullscreen` 保留——语义仍成立（书架墙面板与读书笔记弹窗 notes-ui 仍消费），报告随面板同控，不产生死键。

## 理由
- 与 ADR-0090 同一范式闭环：报告写进面板，单一入口单一实现，桌面导航靠左栏、移动靠头行，报告视图不新造第二套窗口骨架。
- 用户显式拍板（2026-09-04）：「书的报告，影视报告都一样，写进面板中」；命令 id 保留（域仍存在，只是不再是弹窗，`bz-reading-report-open` 三段式仍指认有效语义；home/clipbook 深链零迁移）。

## 后果
- smoke 命令表不变（id/名称/数量均不动）；`REPORT_COMMAND_ID` 常量自 bookshelf/constants 删除（面板内直调，不再经 executeCommandById）。
- tests/reading-report index/error 用例从弹窗容器改面板内容区容器；bookshelf ui 增视图切换/返回/同面板筛选/自动刷新/渲染中止用例；stats/report 纯函数用例覆盖口径与图表升级。
- data.json 无设置键增删；`libraryMobileDefaultFullscreen` 旧键仍退役不变。
