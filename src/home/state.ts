/**
 * 内容首页（home 域）状态：模块级可变对象 H（对齐 cinema state 单例模式）。
 * issue 232 活动河改版：钉选/快照退役，面板数据 = 活动河聚合（river.ts）。
 */
import type { App } from 'obsidian';
import type { RiverData } from './river';

export interface HomeState {
  currentOverlay: HTMLElement | null;
  appRef: App | null;
  /** 最近一次活动河聚合（打开时采集；失败 null → 空态） */
  river: RiverData | null;
  /** 关闭动画防抖 */
  closing: boolean;
}

export const H: HomeState = {
  currentOverlay: null,
  appRef: null,
  river: null,
  closing: false,
};

/** 测试/重建用：整体重置模块状态 */
export function resetHomeState(): void {
  H.currentOverlay = null;
  H.appRef = null;
  H.river = null;
  H.closing = false;
}
