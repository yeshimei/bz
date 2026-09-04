/**
 * 今日回顾（recap 域）状态：模块级可变对象 H（对齐 home/cinema 先例）。
 */
import type { App } from 'obsidian';
import type { RecapData } from './aggregate';

export interface RecapState {
  appRef: App | null;
  currentOverlay: HTMLElement | null;
  /** 最近一次渲染的聚合数据（R3「生成今日总结」输入；打开面板采集后写入） */
  lastData: RecapData | null;
  /** R3 总结生成进行中（防重复点击：AI 请求+写盘期间再点直接忽略） */
  generating: boolean;
}

export const H: RecapState = { appRef: null, currentOverlay: null, lastData: null, generating: false };

/** 卸载后复位（unloadRecap 调用；重开面板不残留旧引用） */
export function resetRecapState(): void {
  H.appRef = null;
  H.currentOverlay = null;
  H.lastData = null;
  H.generating = false;
}
