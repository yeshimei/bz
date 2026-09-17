/**
 * 今日回顾（recap 域）出口：纯函数库（ADR-0157 面板退役后域降级为「数据库」）。
 *
 * 独立面板（ui/state/styles + 命令 bz-recap-today）已随 ADR-0157 退役；
 * 2026-09-17 用户点名去掉首页「生成今日总结」入口，summarize 的 UI 出口也随之归零
 * （保留纯函数 + 全套单测，与 knowledge::summarizeTermSummary 同处理：拆 UI 不拆数据层）。
 * 与 reading-report 内嵌化（ADR-0091）同范式：域存、面板亡。
 * 消费方：home/river.ts（摘要数字/周历/连击数据源，走 collectRecap）。
 */
export * from './aggregate';
export * from './summarize';
