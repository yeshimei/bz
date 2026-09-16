# ADR-0154 · recap 独立面板退役：「生成今日总结」并入 home

日期：2026-09-16 · 关联：issue 346、ADR-0132（home 时间线换行为流源）、ADR-0091（reading-report 内嵌化先例）、ADR-0093（launcher 退役先例）

## 背景

recap（今日回顾）面板 = 当天摘要 + 当天时间轴 + AI 总结写日记三件事，但可达性先天不足：
全插件 63 条命令里唯一「仅命令面板可达」的面板类命令（无 home 磁贴、无 ribbon、无域内入口）。
同时它的时间轴还在用 ADR-0132 已整体退役的 ctime/mtime 推导口径——该口径在批量编辑下
出过 441+ 文件误报事故，home 时间线当时已换行为流源，recap 时间轴是同一套脆弱口径的
最后全量消费方（ADR-0132 自认「收敛到摘要计数」，未处理面板侧）。

而 home 的今日摘要卡 / 周历 / 日记连击早已直接消费 `collectRecap`（home/river.ts），
两者的「今天发生了什么」职责实质重叠。

## 决策

1. **recap 独立面板退役**：`bz-recap-today` 命令、面板 UI（ui.ts/state.ts/styles.css）
   随批删除，main.ts 摘除 import 与 unloadRecap 接线；ctime/mtime 时间轴 UI 一并消失
   （脆弱口径的最后消费方随之清零）。
2. **「生成今日总结」并入 home 今日摘要卡**：AI 总结写日记（summarize 链路）是 recap
   独有价值，迁入 home 今日摘要卡作为一行动作；home 本就持有 collectRecap 数据，零新依赖。
3. **recap 域降级为数据库**：`collectRecap`/`aggregate` 作为纯函数库保留（home 周历、
   连击、摘要数字的数据源），与 reading-report 内嵌化（ADR-0091）同范式：域存、面板亡。

## 后果

+ 消灭全插件可达性最差的面板与最后一份 ctime/mtime 全量消费口径。
+ 「生成今日总结」落到用户每天真的会打开的 home 上，功能不退役只搬家。
− 习惯命令面板直达今日回顾的用户失去独立入口（摘要信息 home 已覆盖）。
− recap 作为「域」名义仍存（数据库），域清单语境应按「home 的当日数据源」表述。
