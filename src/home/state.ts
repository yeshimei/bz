/**
 * 内容首页（home 域）状态：模块级可变对象 H（对齐 cinema state 单例模式）。
 * issue 232 活动河改版：钉选/快照退役，面板数据 = 活动河聚合（river.ts）。
 */
import type { App } from 'obsidian';
import type { RiverData } from './river';
import type { HomeOrder } from './shared';
import type { PomodoroPhase } from '../core/pomodoro-phase';

export interface HomeState {
  /**
   * 面板 DOM（issue 290）：创建后**常驻**——关闭只是隐藏保留渲染（重开原地秒显），
   * 卸载（unloadHome）才真移除。是否显示中看 overlayVisible，别拿本字段判可见性。
   */
  currentOverlay: HTMLElement | null;
  /** 面板是否显示中（issue 290）：关闭 = false（DOM 留着），显示/创建 = true */
  overlayVisible: boolean;
  appRef: App | null;
  /**
   * 最近一次活动河聚合（打开/刷新时采集；失败 null → 空态）。
   * issue 290 起随面板关闭**保留**（重开秒显上次渲染），unloadHome 归零。
   */
  river: RiverData | null;
  /** 活动河采集失败标记（H12）：失败出「采集失败 + 重试」空态，与「加载中」骨架区分 */
  riverFailed: boolean;
  /** 入口顺序（打开时读 home.json；空数组 = 用 DOMAINS 默认顺序）。desk/mob 两套互不影响 */
  order: HomeOrder;
  /**
   * 番茄钟界面相位（打开/刷新面板时读一次）——入口菜单那**唯一**一条番茄钟项的文案/命令由它决定
   * （见 shared.pomodoroMenuAction）。四个值互斥：idle / focusing / paused / break。
   * 类型单源 = core/pomodoro-phase（产出方 pomodoro/ui.ts::menuPhase）。
   */
  pomodoroPhase: PomodoroPhase;
  /**
   * 时间线当前查看日（'YYYY-MM-DD'；null = 没点过周历，由「默认打开日」定）。
   * **必须挂在 H 里**（曾以 ui.ts 模块级变量存在，resetHomeState 归不到零）。
   * 失效时机（issue 290 反转）：随面板关闭**保留**（DOM 渲染保留的应有之义，重开停在上次查看日）、
   * 随 resetHomeState（卸载/重建）归零——早先「随关闭失效」防的是 remove 后模块变量残留
   * 导致的非预期渲染；显式保留 DOM 后重开显示旧渲染成为预期，该前提不再成立。
   */
  riverView: string | null;
}

export const H: HomeState = {
  currentOverlay: null,
  overlayVisible: false,
  appRef: null,
  river: null,
  riverFailed: false,
  order: { version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] },
  pomodoroPhase: 'idle',
  riverView: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetHomeState(): void {
  H.currentOverlay = null;
  H.overlayVisible = false;
  H.appRef = null;
  H.river = null;
  H.riverFailed = false;
  H.order = { version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] };
  H.pomodoroPhase = 'idle';
  H.riverView = null;
}
