/**
 * 第二大脑 UI 工具（ticket 103；对齐 QA 闪念.js L798-925）
 */
import type { App } from 'obsidian';
import { MarkdownRenderer, Component } from 'obsidian';
import { getApp } from '../core/app';

/** 跳转到笔记段落 */
export function jumpToChunk(file: any, chunkText: string, highlight = false): void {
  try {
    const app: App = getApp();
    const f = app.vault.getAbstractFileByPath(file.path);
    if (!f) return;
    const leaf = app.workspace.getLeaf();
    leaf
      .openFile(f as any)
      .then(() => {
        if (highlight) {
          const view = leaf.view as any;
          const ed = view?.editor;
          if (ed) {
            const text = ed.getValue();
            const idx = text.indexOf(chunkText);
            if (idx !== -1) {
              // P2：from 直接取 offsetToPos(idx)（原 posToOffset 恒真三元只会得到文档开头）
              const from = ed.offsetToPos(idx);
              const to = ed.offsetToPos(idx + chunkText.length);
              ed.setSelection(from, to);
            }
          }
        }
      })
      .catch(() => {
        /* 打开失败（文件被删/改名等）：忽略，避免 unhandled rejection（ticket 107） */
      });
  } catch {
    /* ignore */
  }
}

/** 渲染 markdown（异步失败也回退 textContent——QA L815-822 同语义；ticket 107 修移植回归） */
export function renderMarkdown(el: HTMLElement, md: string, app: App): void {
  try {
    const ctx = new Component();
    Promise.resolve((MarkdownRenderer as any).render(app, md, el, '', ctx)).catch(() => {
      el.textContent = md;
    });
  } catch {
    el.textContent = md;
  }
}

/** 使元素可拖拽 */
export function makeDraggable(el: HTMLElement, handle: HTMLElement, onMove?: (x: number, y: number) => void): () => void {
  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;
  const onDown = (e: MouseEvent) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    e.preventDefault();
  };
  const onMoveHandler = (e: MouseEvent) => {
    if (!dragging) return;
    let x = origX + (e.clientX - startX);
    let y = origY + (e.clientY - startY);
    // 视口钳制（QA L906-908 同语义，ticket 107 补回移植时丢失的边界约束）
    x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    onMove?.(x, y);
  };
  const onUp = () => {
    dragging = false;
  };
  handle.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMoveHandler);
  document.addEventListener('mouseup', onUp);
  return () => {
    handle.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMoveHandler);
    document.removeEventListener('mouseup', onUp);
  };
}

/** 使元素可缩放（8 向） */
export function makeResizable(el: HTMLElement, minW = 200, minH = 120): () => void {
  const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
  const handles: HTMLElement[] = [];
  let dragging: string | null = null;
  let startX = 0, startY = 0, origW = 0, origH = 0, origLeft = 0, origTop = 0;

  const onResizeDown = (dir: string) => (e: MouseEvent) => {
    dragging = dir;
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    origW = rect.width;
    origH = rect.height;
    origLeft = rect.left;
    origTop = rect.top;
    e.preventDefault();
  };
  const onResizeMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let { w, h, l, t } = { w: origW, h: origH, l: origLeft, t: origTop };
    if (dragging.includes('e')) w = Math.max(minW, origW + dx);
    if (dragging.includes('s')) h = Math.max(minH, origH + dy);
    if (dragging.includes('w')) { w = Math.max(minW, origW - dx); l = origLeft + (origW - w); }
    if (dragging.includes('n')) { h = Math.max(minH, origH - dy); t = origTop + (origH - h); }
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = l + 'px';
    el.style.top = t + 'px';
  };
  const onResizeUp = () => {
    dragging = null;
  };

  for (const dir of dirs) {
    const h = document.createElement('div');
    h.style.cssText = `position:absolute;${dir.includes('n') ? 'top:-3px;' : ''}${dir.includes('s') ? 'bottom:-3px;' : ''}${dir.includes('w') ? 'left:-3px;' : ''}${dir.includes('e') ? 'right:-3px;' : ''}width:7px;height:7px;cursor:${dir}-resize;z-index:10;`;
    h.addEventListener('mousedown', onResizeDown(dir));
    el.appendChild(h);
    handles.push(h);
  }
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeUp);
  return () => {
    handles.forEach((h) => h.remove());
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeUp);
  };
}
