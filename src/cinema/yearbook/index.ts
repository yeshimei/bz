/**
 * 观影志（yearbook）· 对外出口
 *
 * 一个模块三件事：`deriveYb`（真实字段派生）+ `yearbookHtml`（26 幕版式）+ `bindYearbook`（翻幕引擎）。
 * 影院域其它地方只从这里取，不直接摸 data/scenes/motions/engine。
 */
export { deriveYb, parseMinutes, parseEpisodes, dayOf, humanMinutes, YB_WEEK, type YbData, type YbRank, type YbYear } from './data';
export { yearbookHtml, yearbookFixedHtml, yearbookOpenHtml, YB_SCENES, type YbSceneDef } from './scenes';
export { bindYearbook, type YbHandle } from './engine';
