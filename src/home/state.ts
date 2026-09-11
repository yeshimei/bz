/**
 * 内容首页（home 域）状态：模块级可变对象 H（对齐 cinema state 单例模式）。
 * issue 232 活动河改版：钉选/快照退役，面板数据 = 活动河聚合（river.ts）。
 */
import type { App } from 'obsidian';
import type { RiverData } from './river';
import type { HomeOrder } from './shared';
import type { PomodoroPhase } from '../core/pomodoro-phase';

export interface HomeState {
  currentOverlay: HTMLElement | null;
  appRef: App | null;
  /** 最近一次活动河聚合（打开时采集；失败 null → 空态） */
  river: RiverData | null;
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
   * **必须挂在 H 里**：它随面板关闭失效、随 resetHomeState 归零——
   * 曾以 ui.ts 模块级变量存在，关面板后仍留着上一天的选中，重开就以旧日渲染
   * （2026-09-11 默认范围放宽到 7 天窗口后暴露：前一天不再被窗口滤掉，旧选中生效了）。
   */
  riverView: string | null;
}

export const H: HomeState = {
  currentOverlay: null,
  appRef: null,
  river: null,
  order: { version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] },
  pomodoroPhase: 'idle',
  riverView: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetHomeState(): void {
  H.currentOverlay = null;
  H.appRef = null;
  H.river = null;
  H.order = { version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] };
  H.pomodoroPhase = 'idle';
  H.riverView = null;
}
