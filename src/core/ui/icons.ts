/* ============================================================
 * bz 组件库 · 图标挂载（src/core/ui/icons.ts）
 * uiIconSpan：图标 span 工厂（同 uiIcon，别名收编域内 iconSpan 语义）；
 * mountIcons：把手写 HTML 模板（innerHTML 拼接）里的 <i data-lucide>
 *   占位批量替换为 setIcon 渲染的真图标（保留原 class 修饰）。
 * 收编 todo/belongings/bookshelf 等域各自的本地 mountIcons 副本。
 * ============================================================ */
import { setIcon } from 'obsidian';

/** 图标 span（span.bz-ic + setIcon 渲染 lucide；额外类做尺寸/语义色修饰） */
export function uiIconSpan(name: string, extraClass = ''): HTMLSpanElement {
  const i = document.createElement('span');
  i.className = 'bz-ic' + (extraClass ? ' ' + extraClass : '');
  setIcon(i, name);
  return i;
}

/** 扫描 root 内 [data-lucide] 占位逐个 setIcon（class 原样保留；未知图标静默忽略） */
export function mountIcons(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    if (!name) return;
    try {
      const fresh = uiIconSpan(name);
      const cls = el.className;
      if (cls && cls !== 'bz-ic') fresh.className = cls;
      el.replaceWith(fresh);
    } catch {
      /* 未知图标忽略 */
    }
  });
}
