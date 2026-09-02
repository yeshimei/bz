/* ============================================================
 * bz 组件库 · 图标（src/core/ui/icon.ts）
 * lucide 图标元素工厂（对齐 core 既有 setIcon 机制：Obsidian
 * 无 createIcons 全局扫描，真实环境须经 setIcon 渲染原生 SVG）。
 * 调用方确保 Obsidian 的 setIcon 已挂（插件运行时必然）。
 * ============================================================ */
import { setIcon } from 'obsidian';
import type { BzIconName } from './types';

/** 生成 lucide 图标 <span>（经 setIcon 渲染；额外类挂到元素上做尺寸/语义色修饰） */
export function uiIcon(name: BzIconName, extraClass = ''): HTMLElement {
  const i = document.createElement('span');
  i.className = 'bz-ic' + (extraClass ? ' ' + extraClass : '');
  setIcon(i, name);
  return i;
}
