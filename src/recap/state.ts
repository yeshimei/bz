/**
 * 今日回顾（recap 域）状态：模块级可变对象 H（对齐 home/cinema 先例）。
 */
import type { App } from 'obsidian';

export interface RecapState {
  appRef: App | null;
  currentOverlay: HTMLElement | null;
}

export const H: RecapState = { appRef: null, currentOverlay: null };

/** 卸载后复位（unloadRecap 调用；重开面板不残留旧引用） */
export function resetRecapState(): void {
  H.appRef = null;
  H.currentOverlay = null;
}
