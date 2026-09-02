/**
 * 内容首页（home 域）状态：模块级可变对象 H（对齐 cinema state 单例模式）
 */
import type { App } from 'obsidian';
import type { HomeSnapshot } from './snapshot';

export interface HomeState {
  currentOverlay: HTMLElement | null;
  appRef: App | null;
  /** 最近一次统计快照（打开/刷新时更新） */
  snapshot: HomeSnapshot | null;
  /** 桌面端编辑模式 */
  editing: boolean;
  /** 已钉选域 id 顺序（内存态；落盘 home.json） */
  pinned: string[];
  /** 加载/保存开关（幂等） */
  initialized: boolean;
  /** 关闭动画防抖 */
  closing: boolean;
}

export const H: HomeState = {
  currentOverlay: null,
  appRef: null,
  snapshot: null,
  editing: false,
  pinned: [],
  initialized: false,
  closing: false,
};

/** 测试/重建用：整体重置模块状态 */
export function resetHomeState(): void {
  H.currentOverlay = null;
  H.appRef = null;
  H.snapshot = null;
  H.editing = false;
  H.pinned = [];
  H.initialized = false;
  H.closing = false;
}
