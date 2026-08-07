# 13 — 阅读数据分析报告

**What to build:** 阅读数据分析报告完整移植：11 章节报告生成、HTML 弹窗展示、show-reading-report 命令（书库互调）。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 报告章节完整移植（生成函数逐字保留）：年度统计、作者统计、阅读速度分析、时间分布图表、习惯深度分析、阅读趋势（月度/季度平均/完成率/趋势方向）、热力图（月份网格/强度/颜色/tooltip）、聚焦分析（时间模式/一致性/总分/建议）、类别分析（多样性/平衡度/趋势/推荐/分布图）、笔记互动分析（思考比/参与度/模式/深度/连接度/图表/建议）、实用建议
- [ ] 展示：showReportInPopup（HTML 弹窗 + 暗色模式适配 + 进度条 generateProgressBar + 图表组件）
- [ ] 数据源：metadataCache（getMarkdownFiles/getFileCache）扫描书库/读书笔记
- [ ] 命令 `show-reading-report` 裸注册；书库按钮互调可用
- [ ] 测试：纯函数统计口径（年度/完成率/一致性/思考比等抽样断言）
