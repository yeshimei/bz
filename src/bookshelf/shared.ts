/**
 * 书架墙（bookshelf）渲染纯层（ADR-0104 markup 单源；迁法照 belongings 试点批）。
 *
 * 本文件是「原型 × 插件」markup 的唯一事实源：面板骨架/头行标签/排序 segmented/
 * 书脊墙装箱/空态/借书卡 HTML 与筛选排序管道全部出自这里——
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 原型侧：dev watch 打成 prototype-render.js（IIFE，挂 window.BZR_bookshelf），壳消费同一份。
 * 纯层契约（tests/core/render-purity.test.ts 守卫）：import 白名单仅 `../core/ui/str`
 * 与域内 constants/types（state 仅 type-only，编译期擦除）。
 * ADR-0105：本文件 = 跨布局共享层（口径计算/管道/借书卡）；布局差异层在 layouts/<布局>/。
 * 域入口仍是 render.ts（聚合共享层与各布局，对外 API 不变）。；禁 obsidian/moment/core 服务/
 * 组件库 barrel；禁模块级可变状态（条目与视图状态显式入参）；图标一律 `<i data-lucide>` 占位，
 * 由各端 mountIcons 物化。窗口缩放墙内标尺以 BsWallScale 显式传递（wallScale() 计算）。
 */
import { esc, iconSpan } from '../core/ui/str';
import { STATUS_COLORS } from './constants';
import type { BookshelfItem, SideId, SortKey } from './state';

// ---------- 小工具 ----------

/** 状态徽章色（token 引用；数据语义色） */
export function statusColor(status: string): string {
  return STATUS_COLORS[status] || 'var(--bz-text-3)';
}

/** 条目稳定 id（data-bs-* 回查用）；演示数据无 file/epubVaultPath，回退 id 字段 */
export function itemId(it: BookshelfItem): string {
  return it.file?.path ?? it.epubVaultPath ?? (it as BookshelfItem & { id?: string }).id ?? '';
}

// ---------- 筛选排序管道（data.ts 迁入；data.ts re-export 兼容旧引用） ----------

/** 条目主日期（排序）：读完日 > 开始日；无日期按文件创建时间（演示数据走 ctime 字段） */
export function primaryDate(it: BookshelfItem): number {
  const d = it.completionDate || it.readingDate;
  if (d) {
    const t = new Date(d).getTime();
    if (!isNaN(t)) return t;
  }
  if (it.file?.stat?.ctime) return it.file.stat.ctime;
  return (it as BookshelfItem & { ctime?: number }).ctime || 0;
}

/** 排序：title localeCompare('zh')；time=时长最长（同值按主日期兜底）；其余键（含旧 date/progress）=主日期新者在前 */
export function sortItems(list: BookshelfItem[], key: SortKey | string): BookshelfItem[] {
  const sorted = [...list];
  if (key === 'title') {
    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh'));
  } else if (key === 'time') {
    sorted.sort((a, b) => (b.readingTimeMs - a.readingTimeMs) || (primaryDate(b) - primaryDate(a)));
  } else {
    sorted.sort((a, b) => (primaryDate(b) - primaryDate(a)) || (b.readingTimeMs - a.readingTimeMs));
  }
  return sorted;
}

/** 当前状态筛（全部 = 不过滤） */
export function currentSideItems(items: BookshelfItem[], side: SideId | string): BookshelfItem[] {
  if (side === 'all') return items;
  const status = side === 'reading' ? '在读' : side === 'unread' ? '未读' : '已读';
  return items.filter((it) => it.status === status);
}

/** 分类展示名（EPUB 无分类 null → 归「未分类」桶） */
export function categoryLabel(it: BookshelfItem): string {
  return it.category || '未分类';
}

/** 分类正交过滤（'all' = 不过滤；与状态筛独立叠加） */
export function catFilterItems(list: BookshelfItem[], cat: string): BookshelfItem[] {
  if (!cat || cat === 'all') return list;
  return list.filter((it) => categoryLabel(it) === cat);
}

/** 关键字过滤（书名/作者/分类） */
export function kwFilter(list: BookshelfItem[], kw: string): BookshelfItem[] {
  if (!kw) return list;
  const k = kw.trim().toLowerCase();
  return list.filter((it) => `${it.title} ${it.author || ''} ${it.category || ''}`.toLowerCase().includes(k));
}

/** 展示视图快照（状态/分类/关键字/排序显式入参——纯层禁模块级可变状态） */
export interface BsView {
  side: SideId;
  catFilter: string;
  q: string;
  sortMode: SortKey;
}

/** 当前展示列表（状态 + 分类 + 关键字 + 排序），渲染统一入口 */
export function getDisplayItems(items: BookshelfItem[], view: BsView): BookshelfItem[] {
  let list = currentSideItems(items, view.side);
  list = catFilterItems(list, view.catFilter);
  list = kwFilter(list, view.q);
  return sortItems(list, view.sortMode);
}

/** 借书卡 body HTML（issue 223 只读；封面源由调用方给——插件 vault resource URL，壳分类色 SVG data URI） */
export function detailBodyHtml(it: BookshelfItem, coverSrc: string | null): string {
  const cover = coverSrc ? `<img src="${esc(coverSrc)}" alt="">` : `<div class="bz-bs-d-cover-ph">${iconSpan('library')}<span>无封面</span></div>`;
  const review = it.bookReview
    ? `<div class="bz-bs-d-quote">“${esc(it.bookReview)}”</div>`
    : '<div class="bz-bs-d-quote dim">——尚无书评——</div>';
  const dense = it.highlights + it.thinks;
  const seal = it.status === '已读' ? '讫' : it.status === '在读' ? '阅' : '藏';
  /* 「继续」：在读条目行内跳书钮（点击回到原文；行为接线在 ui.ts openBookDetail） */
  const go = it.status === '在读'
    ? ` <button type="button" class="bz-bs-d-go" data-bs-d-continue title="继续阅读">继续</button>`
    : '';
  const hoursText = it.readingTimeFormat || (it.readingTimeMs > 0 ? (it.readingTimeMs / 3600000).toFixed(1) + ' 小时' : '—');
  const prog = Math.round(it.progress);
  return `
    <div class="bz-bs-d-pull">已抽出这本书</div>
    <div class="bz-bs-d-card">
      <div class="bz-bs-d-cover">${cover}</div>
      <div class="bz-bs-d-info">
        <h2 class="bz-bs-d-title">${esc(it.title)}</h2>
        <div class="bz-bs-d-sub">${esc(it.author)} · ${esc(it.category || '未分类')}${it.isEpub ? ' · EPUB' : ''}</div>
        <div class="bz-bs-d-body">
        ${review}
        <table class="bz-bs-d-ledger">
          <tr><td>状 态</td><td><span class="bz-bs-d-stdot" style="background:${statusColor(it.status)}"></span>${esc(it.status)}${go}</td></tr>
          <tr><td>累计时长</td><td>${esc(hoursText)}</td></tr>
          <tr><td>起读 · 读完</td><td>${esc(it.readingDate || '—')} · ${esc(it.completionDate || '—')}</td></tr>
          <tr><td>划线 / 想法</td><td>${it.highlights} 条 / ${it.thinks} 条</td></tr>
          ${it.pages ? `<tr><td>页 数</td><td>${it.pages} 页</td></tr>` : ''}
          ${it.wordCount ? `<tr><td>字 数</td><td>${it.wordCount.toLocaleString()} 字</td></tr>` : ''}
        </table>
        <div class="bz-bs-d-meter">
          <div class="cap"><span>阅读进度</span><b class="bz-bs-d-prognum">${prog}%</b></div>
          <div class="bar"><i style="width:${prog}%"></i></div>
        </div>
        <div class="bz-bs-d-meter">
          <div class="cap">批注密度（划线 + 想法 = ${dense}）</div>
          <div class="bar"><i style="width:${Math.min(100, (dense / Math.max(10, dense)) * 100)}%"></i></div>
        </div>
        <div class="bz-bs-d-seal">${seal}</div>
        </div>
      </div>
    </div>`;
}
export interface RenderHooks { mountIcons(root: HTMLElement): void }
