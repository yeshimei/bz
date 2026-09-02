/* ============================================================
 * bz 组件库 · 图标（src/core/ui/icon.ts）
 * lucide 图标元素工厂。
 * ============================================================ */
import type { BzIconName } from './types';

/** 生成 lucide 图标 <i>（Obsidian 用 lucide 图标库，调用方确保 createIcons 已跑） */
export function uiIcon(name: BzIconName, extraClass = ''): HTMLElement {
  const i = document.createElement('i');
  i.className = `bz-ic${extraClass ? ' ' + extraClass : ''}`;
  i.setAttribute('data-lucide', name);
  return i;
}
