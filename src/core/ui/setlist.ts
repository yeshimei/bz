/* ============================================================
 * bz 组件库 · 可移除列表（src/core/ui/setlist.ts）
 * 条目 = 头像（可选）+ 主文案 + 副文案 + 移除钮，四布局变体（缺省 chips 流式胶囊）。
 * **唯一 markup/行为源**：core 设置渲染器（settings-schema）与设置面板渲染器
 * （settings-panel/renderer）同调本工厂——此前两端各有一份 DOM/串实现，结构漂移即布局事故
 * （2026-09-12 面板 ListRow 条目横铺事故的根治）。
 * 样式在 ui/components.css（.bz-setlist 及其 --rows/--grid/--chips/--dense 修饰）。
 * ============================================================ */
import type { BzSetlistOpts } from './types';

/** 可移除列表（.bz-setlist）：头像/主文案/副文案/移除钮；缺省 chips 流式胶囊（2026-09-12 拍板） */
export function uiSetlist(opts: BzSetlistOpts): HTMLDivElement {
  const variant = opts.variant ?? 'chips';
  const box = document.createElement('div');
  box.className = `bz-setlist bz-setlist--${variant}${opts.className ? ` ${opts.className}` : ''}`;
  if (opts.items.length === 0) {
    if (opts.emptyText) {
      const empty = document.createElement('div');
      empty.className = 'bz-setlist-empty';
      empty.textContent = opts.emptyText;
      box.appendChild(empty);
    }
    return box;
  }
  for (const it of opts.items) {
    const item = document.createElement('div');
    item.className = 'bz-setlist-item';
    item.dataset.key = it.key;
    // 副文案（UID/URL 等）在 chips 变体不展示 → title 悬停提示保信息可达
    if (it.sub) item.title = it.sub;
    if (it.imageUrl) {
      const img = document.createElement('img');
      img.className = 'bz-setlist-avatar';
      img.src = it.imageUrl;
      img.alt = '';
      img.onerror = () => img.remove(); // 头像加载失败不占位
      item.appendChild(img);
    }
    const text = document.createElement('div');
    text.className = 'bz-setlist-text';
    const name = document.createElement('div');
    name.className = 'bz-setlist-name';
    name.textContent = it.label;
    text.appendChild(name);
    if (it.sub) {
      const sub = document.createElement('div');
      sub.className = 'bz-setlist-sub';
      sub.textContent = it.sub;
      text.appendChild(sub);
    }
    item.appendChild(text);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bz-setlist-remove bz-touch-target--xl';
    remove.textContent = opts.removeLabel || '移除';
    if (opts.onRemove) {
      const key = it.key;
      remove.addEventListener('click', () => opts.onRemove?.(key));
    }
    item.appendChild(remove);
    box.appendChild(item);
  }
  return box;
}
