/**
 * 今日回顾（recap 域）出口：纯函数库（ADR-0157 面板退役后域降级为「数据库」）。
 *
 * 独立面板（ui/state/styles + 命令 bz-recap-today）已随 ADR-0157 退役；
 * 「生成今日总结」的 AI 写日记链路迁入 home 今日摘要卡（时间线河卡动作行），
 * 本域保留五域「今天」聚合（collectRecap）与总结写日记（summarize）的纯函数实现，
 * 与 reading-report 内嵌化（ADR-0091）同范式：域存、面板亡。
 * 消费方：home/river.ts（摘要数字/周历/连击数据源）、home/ui.ts（生成今日总结动作）。
 */
export * from './aggregate';
export * from './summarize';
