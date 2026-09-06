/**
 * 书架墙（bookshelf）域 UI：书脊墙 1:1 复刻（issue 218；原型 .zcode/ui-prototypes/bookshelf-10/p4-full.html）
 *
 * 布局（原型口径，完全替代旧封面网格/左栏/统计卡/月柱/筛选抽屉）：
 *   头行（小号木匾「书库 · LIBRARY」与纸质统计标签行同行居左：全馆/已读讫/在读抽出/未读倒叠 +
 *   分类册数，点选筛选、再点回全；筛选激活时未选中标签 .off 弱化；issue 226 匾额复位）＋
 *   工具行（纸感检索 + 三档排序 segmented）＋ 墙体（分类分区动态装箱：
 *   每排按当前墙宽逐条塞满才换排；已读盖「讫」印；在读抽出一截垂书签带；未读收墙尾「倒叠区」）
 *   ＋ 墙尾格言。书脊：高度=累计阅读时长、厚度=字数（开方缩放，无字数回退批注密度）、
 *   竖排书名按「：」拆主/副双列（text-orientation: upright，字号 14→9px 自适应、列宽上限 64px）。
 * 窗口缩放防抖重装箱；移动端同构（窄墙自动多排），无独立移动布局。
 * 点击书脊 → 借书卡详情（纸卡排版 + 印章；issue 223 只读化：纯展示，无编辑/删除，状态圆点示意）。
 * 报告视图（读书报告内嵌化）：面板内视图容器保留，入口仅命令 bz-reading-report-open（墙面上无入口）。
 * 皮肤（issue 216 十肤随迁）：面板根挂 bz-bs-skin-{id}，皮肤改墙/纸/铜墨变量（styles.css）。
 * 铁律 6：弹窗骨架/空态/输入走组件库；墙体系为域独有视觉（styles.css .bz-bs-wall*）。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { notice, notify, notifyUndo } from '../core/notice';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, uiEmpty, mountIcons } from '../core/ui';
import { escapeHtml } from '../core/utils';
import { renderReadingReport, cancelReadingReport, handleReportInteraction } from '../reading-report';
import {
  STATUS_COLORS, SORT_LABEL, ICON,
  EMPTY_BOOKS_ICON, EMPTY_SEARCH_ICON, EMPTY_FILTER_ICON,
} from './constants';
import { M, applyDefaultView, type BookshelfItem, type BookshelfView, type SideId, type SortKey } from './state';
import {
  rebuildItems, getDisplayItems, resolveFolderPath, resolveBookTag,
} from './data';
import { closeBookNoteModals } from './notes-ui';
import { buildEpubResumeLink } from './epub-notes';

// ---------- 小工具 ----------

/** lucide 占位 HTML（innerHTML 拼接用；渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

/** HTML 转义（core escapeHtml 的 unknown 容错壳） */
function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** 封面资源 URL（vault 路径 → resource URL）；无文件/非图返回 null（借书卡封面用） */
function coverUrl(it: BookshelfItem, app: App): string | null {
  if (!it.cover) return null;
  const f = app.vault.getAbstractFileByPath(it.cover);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

/** 坏图回退占位（capture 阶段 error 不冒泡；container 级一次挂载） */
function bindCoverFallback(container: HTMLElement): void {
  if (container.dataset.bsCoverFallbackBound === '1') return;
  container.dataset.bsCoverFallbackBound = '1';
  container.addEventListener('error', (e) => {
    const img = e.target as HTMLElement;
    if (!img || img.tagName !== 'IMG') return;
    const ph = document.createElement('div');
    ph.className = 'bz-bs-d-cover-ph';
    ph.innerHTML = `${iconSpan('library')}<span>无封面</span>`;
    mountIcons(ph);
    img.replaceWith(ph);
  }, true);
}

/** 状态徽章色（token 引用；数据语义色） */
function statusColor(status: string): string {
  return STATUS_COLORS[status] || 'var(--bz-text-3)';
}

/** 条目稳定 id（data-bs-* 回查用） */
function itemId(it: BookshelfItem): string {
  return it.file?.path ?? it.epubVaultPath ?? '';
}

// ---------- 书脊视觉（原型 p4-full 口径） ----------

/** 分类色板（常见分类覆盖 + 兜底散列；取值同原型 CAT） */
const CAT: Record<string, { bg: string; fg: string }> = {
  '文学': { bg: '#8f4a3a', fg: '#f2e4d8' }, '推理': { bg: '#7a3b52', fg: '#f2dee6' },
  '哲学': { bg: '#4f6f52', fg: '#e9efe6' }, '科幻': { bg: '#3d5a73', fg: '#e2ecf4' },
  '心理学': { bg: '#5c5273', fg: '#e9e4f2' }, '摄影': { bg: '#2f4858', fg: '#dbe8f0' },
  '天文学': { bg: '#1f3242', fg: '#c9dde9' }, '生物学': { bg: '#6d7a3f', fg: '#eef0dc' },
  '龙与地下城': { bg: '#4a3626', fg: '#e8d9b0' },
  '历史': { bg: '#8a6d3b', fg: '#f5ecd8' }, '武侠': { bg: '#9a5a2f', fg: '#f7ead9' },
  '奇幻': { bg: '#3f5a4a', fg: '#dfeee4' }, '艺术': { bg: '#6b4a6e', fg: '#efe2f0' },
  '未分类': { bg: '#6b6257', fg: '#ded8ce' },
};
const FALLBACKS = ['#8a6d3b', '#4f6f52', '#3d5a73', '#8f4a3a', '#5c5273', '#7a3b52', '#6d7a3f', '#2f4858'];

/** 分类色（未入色板按名散列兜底） */
function catColor(cat: string): { bg: string; fg: string } {
  if (CAT[cat]) return CAT[cat];
  return fallbackColor(cat);
}
function fallbackColor(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  return { bg: FALLBACKS[h % FALLBACKS.length], fg: '#f0e8d8' };
}

function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, v + p));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** 墙内标尺（每次 rebuildItems 后重算）：高度按时长、厚度按字数开方 */
let wallMaxHrs = 3600000;
let wallMaxWc = 10000;
function rescaleWall(): void {
  wallMaxHrs = Math.max(3600000, ...M.items.map((b) => b.readingTimeMs));
  wallMaxWc = Math.max(10000, ...M.items.map((b) => b.wordCount));
}

/** 书脊内联样式：高度=时长（150~230px）、厚度=字数开方（22~56px，无字数回退批注密度）、
 *  分类色（未读倒扣灰）+ 同分类 ±7% 明度抖动；颜色走 --c1/--c2 变量（皮肤层可接管） */
function spineVars(it: BookshelfItem): string {
  const dense = it.highlights + it.thinks;
  const wc = it.wordCount > 0 ? it.wordCount : dense * 800;
  const h = 150 + (it.readingTimeMs / wallMaxHrs) * 80;
  const th = 22 + Math.sqrt(Math.min(wc, wallMaxWc) / wallMaxWc) * 34;
  const c = it.status === '未读' ? { bg: '#6b6257', fg: '#ded8ce' } : catColor(it.category || '未分类');
  let sh = 0;
  for (const ch of it.title) sh = (sh * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  const jit = (sh % 15) - 7;
  return `height:${Math.round(h)}px;width:${Math.round(th)}px;--c1:${shade(c.bg, jit)};--c2:${c.fg}`;
}

/** 长书名自适应：按「：」拆主/副题双竖列（丛书书脊范式），各列独立缩字号（下限 9px），
 *  拉丁/数字直立；书脊按列数加宽（上限 64px） */
function fitTitle(spine: HTMLElement, it: BookshelfItem): void {
  const t = spine.querySelector('.bz-bs-spine-title') as HTMLElement;
  const avail = parseFloat(spine.style.height) - 36;
  let parts = it.title.split(/[:：]/);
  if (parts.length > 2) parts = [parts[0], parts.slice(1).join('：')];
  const fitFs = (n: number) => Math.max(9, Math.min(14, Math.floor(avail / (1.18 * Math.max(1, n)))));
  const cols = parts.map((p) => ({ p, fs: fitFs([...p].length) }));
  let width = 24;
  for (const c of cols) width += Math.ceil(c.fs * 1.25) + 6;
  t.innerHTML = cols
    .map((c, i) => `<span class="${i === 0 ? 't-main' : 't-sub'}" style="font-size:${c.fs}px;letter-spacing:${Math.max(1, Math.round(c.fs * 0.18))}px">${esc(c.p)}</span>`)
    .join('');
  spine.style.width = `${Math.min(64, Math.max(parseFloat(spine.style.width), width))}px`;
}

/** 单条书脊 HTML（未读倒扣灰 / 在读抽出一截垂书签带 / 已读盖「讫」印） */
function spineHTML(it: BookshelfItem): string {
  const cls = it.status === '已读' ? 'read' : it.status === '在读' ? 'reading' : 'unread';
  return `<div class="bz-bs-spine ${cls}" style="${spineVars(it)}" data-bs-id="${esc(itemId(it))}" data-bs-epub="${it.isEpub ? '1' : ''}" title="${esc(it.title)} · ${esc(it.status)}${it.progress > 0 ? ' ' + it.progress + '%' : ''}">
    <span class="bz-bs-spine-title"></span>
    ${it.status === '已读' ? '<span class="stamp">讫</span>' : ''}
    ${it.status === '在读' ? '<span class="ribbon"></span>' : ''}
  </div>`;
}

// ---------- 墙体渲染（动态装箱） ----------

function mkBookend(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'bz-bs-bookend';
  return d;
}

function mkSpine(it: BookshelfItem): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = spineHTML(it);
  const sp = wrap.firstElementChild as HTMLElement;
  fitTitle(sp, it);
  return sp;
}

/** 单个分类分区装箱：按当前墙宽逐条塞书脊，塞不下才换排（隔板从排首占位参与测宽）；
 *  窗口缩放由 resize 防抖整墙重排 */
function packZone(shelf: HTMLElement, cat: string, books: BookshelfItem[]): void {
  let zone: HTMLElement | null = null;
  const newRow = () => {
    zone = document.createElement('div');
    zone.className = 'bz-bs-zone';
    zone.appendChild(mkBookend());
    const dv = document.createElement('div');
    dv.className = 'bz-bs-divider';
    dv.textContent = cat + ' 区';
    zone.appendChild(dv);
    shelf.appendChild(zone);
  };
  for (let i = 0; i < books.length; i++) {
    if (!zone) newRow();
    const sp = mkSpine(books[i]);
    zone!.appendChild(sp);
    if (zone!.scrollWidth > zone!.clientWidth) {
      zone!.removeChild(sp);
      if (!zone!.querySelector('.bz-bs-spine')) zone!.appendChild(sp); // 单条就超宽：硬塞防死循环
      else { i--; zone = null; } // 这条留到下一排
    }
  }
  zone = null;
}

/** 空态三态（库空 / 搜索无命中 / 筛选无书）——uiEmpty 工厂 */
function wallEmptyHTML(): string {
  const cfg = !M.items.length
    ? { icon: EMPTY_BOOKS_ICON, title: '书库还是空的', desc: `把书籍笔记放进「${resolveFolderPath()}」文件夹，并在 frontmatter 添加 tags: ${resolveBookTag()} 标签` }
    : M.searchKeyword
      ? { icon: EMPTY_SEARCH_ICON, title: '没有找到相关的书', desc: '试试其他关键词，或换一个筛选' }
      : { icon: EMPTY_FILTER_ICON, title: '这个筛选下还没有书', desc: '换一个状态或分类标签，或用搜索找找' };
  return `<div class="bz-bs-wall-empty">${uiEmpty({ icon: cfg.icon, title: cfg.title, desc: cfg.desc }).outerHTML}</div>`;
}

/** 整墙渲染：分类分区（未读入倒叠区）+ 动态装箱 + 在墙计数 */
function renderWall(app: App): void {
  void app;
  const shelf = M.currentOverlay?.querySelector('#bz-bs-shelf') as HTMLElement | null;
  if (!shelf) return;
  rescaleWall();
  const list = getDisplayItems();
  const onShelf = list.filter((b) => b.status !== '未读');
  const unread = list.filter((b) => b.status === '未读');
  shelf.innerHTML = '';
  const hint = M.currentOverlay?.querySelector('#bz-bs-hint') as HTMLElement | null;
  if (hint) hint.textContent = `${onShelf.length + unread.length} 册在墙`;
  if (!onShelf.length && !unread.length) {
    shelf.innerHTML = wallEmptyHTML();
    return;
  }
  // 分类分区（未读除外）按册数降序；排序档决定分区内书序
  const zones = new Map<string, BookshelfItem[]>();
  for (const b of onShelf) {
    const k = b.category || '未分类';
    const arr = zones.get(k) || [];
    arr.push(b);
    zones.set(k, arr);
  }
  const sortedZones = [...zones.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cat, books] of sortedZones) packZone(shelf, cat, books);
  if (unread.length) {
    const zone = document.createElement('div');
    zone.className = 'bz-bs-zone';
    const dv = document.createElement('div');
    dv.className = 'bz-bs-divider';
    dv.textContent = '倒 叠 区';
    zone.appendChild(dv);
    zone.appendChild(mkBookend());
    for (const b of unread) zone.appendChild(mkSpine(b));
    zone.appendChild(mkBookend());
    shelf.appendChild(zone);
  }
}

/** 统计标签行（纸质标签；点选筛选、再点回全馆）——状态四张 + 分类册数标签 */
function renderLabels(): void {
  const el = M.currentOverlay?.querySelector('#bz-bs-labels') as HTMLElement | null;
  if (!el) return;
  const statusDefs: { f: SideId; n: number; t: string }[] = [
    { f: 'all', n: M.items.length, t: '全馆藏书' },
    { f: 'done', n: M.items.filter((x) => x.status === '已读').length, t: '已读 · 讫' },
    { f: 'reading', n: M.items.filter((x) => x.status === '在读').length, t: '在读 · 抽出' },
    { f: 'unread', n: M.items.filter((x) => x.status === '未读').length, t: '未读 · 倒叠' },
  ];
  // 分类标签只数在架书（未读在倒叠区另有口径）；按时长汇总副文案
  const cats = new Map<string, { n: number; ms: number }>();
  for (const b of M.items) {
    if (b.status === '未读') continue;
    const k = b.category || '未分类';
    const c = cats.get(k) || { n: 0, ms: 0 };
    c.n++;
    c.ms += b.readingTimeMs;
    cats.set(k, c);
  }
  const catPairs = [...cats.entries()].sort((a, b) => b[1].n - a[1].n);
  // 弱化口径（issue 226 对齐原型 .off）：任一筛选激活时，未选中标签（状态+分类）弱化；
  // 「全馆藏书」恒亮作为「回到全部」出口
  const filtering = M.side !== 'all' || M.catFilter !== 'all';
  let html = statusDefs.map((d) => {
    const on = d.f === 'all' ? M.side === 'all' && M.catFilter === 'all' : M.side === d.f;
    const off = filtering && !on && d.f !== 'all';
    return `
    <div class="bz-bs-taglabel${on ? ' on' : ''}${off ? ' off' : ''}" data-bs-side="${d.f}">
      <span class="pin"></span><div class="n">${d.n}</div><div class="t">${d.t}</div>
    </div>`;
  }).join('');
  // 分类标签独立子容器（桌面 display:contents 隐身；移动端并入头行一行横滑——styles.css @media 块；与原型同构）
  const catHtml = catPairs.map(([cat, c]) => {
    const hrs = c.ms > 0 ? ` · ${Math.round(c.ms / 3600000)} 时` : '';
    const off = filtering && M.catFilter !== cat;
    return `<div class="bz-bs-taglabel dim-cat${M.catFilter === cat ? ' on' : ''}${off ? ' off' : ''}" data-bs-cat="${esc(cat)}">
      <span class="pin"></span><div class="n">${esc(cat)}</div><div class="t">${c.n} 册${hrs}</div>
    </div>`;
  }).join('');
  el.innerHTML = `${html}<div class="bz-bs-cats">${catHtml}</div>`;
}

/** 排序三档 segmented（点选即生效） */
function renderSortSeg(app: App): void {
  void app;
  const seg = M.currentOverlay?.querySelector('#bz-bs-sortseg') as HTMLElement | null;
  if (!seg) return;
  seg.innerHTML = (Object.keys(SORT_LABEL) as SortKey[])
    .map((k) => `<button type="button" data-bs-sort="${k}"${M.sortMode === k ? ' class="on"' : ''}>${SORT_LABEL[k]}</button>`)
    .join('');
}

function renderAll(app: App): void {
  renderLabels();
  renderSortSeg(app);
  renderWall(app);
}
export { renderAll };

// ---------- 搜索关键字回写（报告筛选回墙预填口径不变） ----------

function syncSearchInputs(): void {
  const input = M.currentOverlay?.querySelector('#bz-bs-dsearch') as HTMLInputElement | null;
  if (input) input.value = M.searchKeyword;
}

// ---------- 面板内视图（报告内嵌化：命令 bz-reading-report-open 专用，墙面无入口） ----------

/** 渲染报告视图内容区（挂载点 .bz-rr-content） */
function startReportRender(app: App): void {
  const container = M.currentOverlay?.querySelector('.bz-rr-content') as HTMLElement | null;
  if (!container) return;
  renderReadingReport(container, app, {
    onFilter: (kind, value) => applyReportFilter(app, kind, value),
    onBack: () => showView(app, 'shelf'),
  });
}

/** 报告点作者/分类行 → 切回书脊墙并预填筛选 */
function applyReportFilter(app: App, kind: 'author' | 'category', value: string): void {
  if (!value) return;
  if (kind === 'author') {
    M.searchKeyword = value;
    M.catFilter = 'all';
  } else {
    M.catFilter = value;
    M.searchKeyword = '';
  }
  syncSearchInputs();
  showView(app, 'shelf');
  renderAll(app);
}

/** 面板内切换视图（报告视图启动分片渲染；离开视图作废在途渲染） */
function showView(app: App, view: BookshelfView): void {
  const changed = M.view !== view;
  M.view = view;
  paintViewContainers();
  if (view === 'report') {
    startReportRender(app);
  } else if (changed) {
    cancelReadingReport();
  }
}

/** 打开报告视图（命令 bz-reading-report-open；面板未开先开面板） */
export function openReportView(app: App): void {
  if (!M.currentOverlay) {
    M.view = 'report';
    applyDefaultView();
    createOverlay(app);
  } else {
    showView(app, 'report');
  }
}

/** 报告视图存续期间书库数据变化 → 自动重算只更新报告内容区 */
export function refreshReportView(app: App): void {
  if (M.view === 'report' && M.currentOverlay) startReportRender(app);
}

/** 视图容器显隐（书脊墙 / 报告内容区互斥） */
function paintViewContainers(): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  overlay.querySelector('.bz-bs-view-shelf')?.classList.toggle('active', M.view === 'shelf');
  overlay.querySelector('.bz-bs-view-report')?.classList.toggle('active', M.view === 'report');
}

// ---------- 借书卡详情（issue 223：纯展示只读——不允许编辑/删除） ----------

let detailModalClose: (() => void) | null = null;

/** 关闭本域浮层弹窗（详情 + 读书笔记；closeOverlay 调用） */
function closeDomainModals(): void {
  closeBookNoteModals();
  if (detailModalClose) { detailModalClose(); detailModalClose = null; }
}

/** 借书卡（issue 223 只读版，拍板原型 p4-book-view 口径：pull-note + 纸卡双栏 + 台账 +
 *  静态进度条 + 批注密度条 + 印章；无编辑控件、无删除/保存，状态用圆点示意） */
function openBookDetail(it: BookshelfItem, app: App): void {
  const cu = coverUrl(it, app);
  const cover = cu ? `<img src="${esc(cu)}" alt="">` : `<div class="bz-bs-d-cover-ph">${iconSpan('library')}<span>无封面</span></div>`;
  const review = it.bookReview
    ? `<div class="bz-bs-d-quote">“${esc(it.bookReview)}”</div>`
    : '<div class="bz-bs-d-quote dim">——尚无书评——</div>';
  const dense = it.highlights + it.thinks;
  const seal = it.status === '已读' ? '讫' : it.status === '在读' ? '阅' : '藏';
  const hoursText = it.readingTimeFormat || (it.readingTimeMs > 0 ? (it.readingTimeMs / 3600000).toFixed(1) + ' 小时' : '—');
  const prog = Math.round(it.progress);

  const body = document.createElement('div');
  body.className = 'bz-bs-detail';
  body.innerHTML = `
    <div class="bz-bs-d-pull">已抽出这本书</div>
    <button type="button" class="bz-bs-d-x" data-bs-d-close title="放回书架">×</button>
    <div class="bz-bs-d-card">
      <div class="bz-bs-d-cover">${cover}</div>
      <div class="bz-bs-d-info">
        <h2 class="bz-bs-d-title">${esc(it.title)}</h2>
        <div class="bz-bs-d-sub">${esc(it.author)} · ${esc(it.category || '未分类')}${it.isEpub ? ' · EPUB' : ''}</div>
        ${review}
        <table class="bz-bs-d-ledger">
          <tr><td>状 态</td><td><span class="bz-bs-d-stdot" style="background:${statusColor(it.status)}"></span>${esc(it.status)}</td></tr>
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
      </div>
      <div class="bz-bs-d-seal">${seal}</div>
    </div>`;
  const { popup, close } = uiModal({
    content: body,
    maxWidth: 640,
    head: false,
    className: `bz-bs-d-popup ${bsSkinClass()}`,
    onClose: () => { detailModalClose = null; },
  });
  detailModalClose = close;
  popup.querySelector('[data-bs-d-close]')?.addEventListener('click', () => close());
  bindCoverFallback(popup);
}

// ---------- 面板皮肤（issue 216 十肤随迁；类挂面板根与弹窗根） ----------

const SKIN_IDS = ['nordic', 'dark', 'noir', 'wabi', 'bauhaus', 'blueprint', 'neon', 'kraft', 'velvet', 'mono'] as const;
type SkinId = (typeof SKIN_IDS)[number];

function normalizeSkin(v: unknown): SkinId {
  return SKIN_IDS.includes(v as SkinId) ? (v as SkinId) : 'nordic';
}

/** 当前皮肤类名（弹窗与面板共用同套皮肤；非法值回落雪松白） */
export function bsSkinClass(): string {
  return `bz-bs-skin-${normalizeSkin((tryGetSettings() as Record<string, unknown>).bookshelfSkin)}`;
}

/** 皮肤应用：面板根换挂皮肤类（设置行 onChange 热切换；未开面板仅落盘） */
export function applyBookshelfSkin(skin: unknown): void {
  if (!M.currentOverlay) return;
  const panel = M.currentOverlay.querySelector('.bz-bs-panel') as HTMLElement | null;
  if (!panel) return;
  panel.classList.remove(...SKIN_IDS.map((id) => `bz-bs-skin-${id}`));
  panel.classList.add(`bz-bs-skin-${normalizeSkin(skin)}`);
}

// ---------- 主面板创建（书脊墙 1:1 骨架） ----------

/** 窗口缩放防抖重装箱（createOverlay 挂载 / closeOverlay 摘除） */
let wallResizeHandler: (() => void) | null = null;
let wallResizeTimer: ReturnType<typeof setTimeout> | null = null;

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
  overlay.style.zIndex = String(allocZ());
  const fullscreen = (tryGetSettings() as Record<string, unknown>).bookshelfMobileDefaultFullscreen === true;

  overlay.innerHTML = `
    <div class="bz-panel-frame bz-bs-panel bz-panel-mtop ${bsSkinClass()}">
      <div class="bz-bs-wallpage">
        <div class="bz-bs-header">
          <div class="bz-bs-plaque"><h1>书库</h1><p>LIBRARY</p></div>
          <div class="bz-bs-labels" id="bz-bs-labels"></div>
        </div>
        <div class="bz-bs-tools">
          <input id="bz-bs-dsearch" class="bz-bs-search" type="text" placeholder="检索书名或作者…" autocomplete="off">
          <div class="bz-bs-seg" id="bz-bs-sortseg"></div>
          <div class="bz-bs-hint" id="bz-bs-hint"></div>
        </div>
        <div class="bz-bs-view bz-bs-view-shelf active">
          <div class="bz-bs-room">
            <div class="bz-bs-shelf" id="bz-bs-shelf"></div>
            <div class="bz-bs-wallnote">—— 书脊的高度是时长，厚度是批注，抽出的是正在进行 ——</div>
          </div>
        </div>
        <div class="bz-bs-view bz-bs-view-report">
          <div class="bz-rr-head">
            <span class="bz-rr-title">${iconSpan(ICON.report, 'bz-ic--sm')}阅读分析报告</span>
            <button class="bz-icon-btn bz-rr-close" data-rr-goto-shelf title="返回书库">${iconSpan(ICON.close)}</button>
          </div>
          <div class="bz-rr-content"></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll(app);
  applyMobileWindowFullscreen(overlay.querySelector('.bz-bs-panel') as HTMLElement, fullscreen);

  // 单一委托：标签筛选 / 排序 / 报告视图交互 / 书脊详情
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closeOverlay(); return; }
    // 状态标签（再点已选 = 回全馆；「全馆」清状态+分类全部筛选——issue 226 修「点了没反应」）
    const side = t.closest('[data-bs-side]') as HTMLElement | null;
    if (side) {
      const id = (side.dataset.bsSide || 'all') as SideId;
      if (id === 'all') {
        M.side = 'all';
        M.catFilter = 'all';
      } else {
        M.side = M.side === id ? 'all' : id;
      }
      renderLabels();
      renderWall(app);
      return;
    }
    // 分类标签（与状态正交；再点已选 = 回全馆）
    const cat = t.closest('[data-bs-cat]') as HTMLElement | null;
    if (cat) {
      const name = cat.dataset.bsCat || 'all';
      M.catFilter = name !== 'all' && M.catFilter === name ? 'all' : name;
      renderLabels();
      renderWall(app);
      return;
    }
    // 排序三档
    const sortBtn = t.closest('[data-bs-sort]') as HTMLElement | null;
    if (sortBtn) {
      M.sortMode = (sortBtn.dataset.bsSort || 'recent') as SortKey;
      renderSortSeg(app);
      renderWall(app);
      return;
    }
    // 报告视图内交互（reading-report 域）与返回/预填
    if (M.view === 'report') {
      const rrContent = overlay.querySelector('.bz-rr-content') as HTMLElement | null;
      if (rrContent && handleReportInteraction(rrContent, t)) return;
      if (t.closest('[data-rr-goto-shelf]')) { showView(app, 'shelf'); return; }
      const rrAuthor = t.closest('[data-rr-author]') as HTMLElement | null;
      if (rrAuthor) { applyReportFilter(app, 'author', rrAuthor.getAttribute('data-rr-author') || ''); return; }
      const rrCat = t.closest('[data-rr-cat]') as HTMLElement | null;
      if (rrCat) { applyReportFilter(app, 'category', rrCat.getAttribute('data-rr-cat') || ''); return; }
    }
    // 书脊 → 借书卡
    const spine = t.closest('[data-bs-id]') as HTMLElement | null;
    if (spine && M.view === 'shelf') {
      const epub = spine.dataset.bsEpub === '1';
      const it = M.items.find((x) => epub ? x.epubVaultPath === spine.dataset.bsId : x.file?.path === spine.dataset.bsId);
      if (it) openBookDetail(it, app);
      return;
    }
  });

  // 检索（200ms 防抖）
  const searchInput = overlay.querySelector('#bz-bs-dsearch') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = searchInput.value.trim();
      renderWall(app);
    }, 200);
  });
  // 重开残留回写：防「墙被不可见关键字过滤但输入框为空」的排查黑洞
  if (M.searchKeyword) searchInput.value = M.searchKeyword;

  // 窗口缩放 → 防抖重装箱（墙宽变化）
  wallResizeHandler = () => {
    if (wallResizeTimer) clearTimeout(wallResizeTimer);
    wallResizeTimer = setTimeout(() => {
      wallResizeTimer = null;
      if (M.currentOverlay && M.view === 'shelf') renderWall(app);
    }, 150);
  };
  window.addEventListener('resize', wallResizeHandler);

  mountIcons(overlay);
  paintViewContainers();
  // B8：首扫加载态——rebuild 完成前墙位显示占位，防异步读 weave-data 空白闪烁
  const shelf0 = overlay.querySelector('#bz-bs-shelf') as HTMLElement | null;
  if (shelf0) shelf0.innerHTML = `<div class="bz-bs-wall-empty">${uiEmpty({ icon: 'loader', title: '正在整理书架…', desc: '' }).outerHTML}</div>`;
  void rebuildItems(app).then(() => {
    if (M.view === 'report') showView(app, 'report');
    else renderAll(app);
  });
}

export function closeOverlay(): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  if (wallResizeTimer) { clearTimeout(wallResizeTimer); wallResizeTimer = null; }
  if (wallResizeHandler) {
    window.removeEventListener('resize', wallResizeHandler);
    wallResizeHandler = null;
  }
  closeDomainModals();
  cancelReadingReport();
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
}

// ---------- ESC（主面板） ----------

let mainEscRegistered = false;
let mainEscHandle: { unregister: () => void } | null = null;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  mainEscHandle = escManager.register('bz-bookshelf', {
    isVisible: () => !!M.currentOverlay,
    close: () => closeOverlay(),
  });
}

/** 注销 ESC 层（卸载时调用；escManager 层不随插件卸载自动清理） */
export function unregisterEscapeHandler(): void {
  if (!mainEscRegistered) return;
  mainEscRegistered = false;
  mainEscHandle?.unregister();
  mainEscHandle = null;
}
