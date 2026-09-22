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
      // 防盗链：B 站图床（i0/i1.hdslb.com）对任何带 Referer 的取图请求回 403；移动端 WebView 的
      // origin 是 capacitor://localhost（iOS）/ http://localhost（Android），跨源取图必带 Referer
      // → 头像一律 403，再走下面的 onerror 被移除（表现＝「名单列表不显示头像」）。
      // 2026-09-22 实测（同 URL）：无 Referer 200；带 capacitor://localhost 或 http://localhost 均 403。
      // no-referrer 让取图不带 Referer，桌面/移动同口径；对本地资源无副作用。
      // 用 attribute 而非 IDL 属性：行为与浏览器一致，且 jsdom 未实现 referrerPolicy 的 IDL
      // 反射（测试可与生产同口径断言）。
      img.setAttribute('referrerpolicy', 'no-referrer');
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
