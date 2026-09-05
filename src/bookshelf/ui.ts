/**
 * 书架墙（bookshelf）域 UI：书脊墙 1:1 复刻（issue 218；原型 .zcode/ui-prototypes/bookshelf-10/p4-full.html）
 *
 * 布局（原型口径，完全替代旧封面网格/左栏/统计卡/月柱/筛选抽屉）：
 *   木匾刊头（书脊墙 · SPINE WALL）＋ 纸质统计标签行（全馆/已读讫/在读抽出/未读倒叠 + 分类册数，
 *   点选筛选、再点回全）＋ 工具行（纸感检索 + 三档排序 segmented）＋ 墙体（分类分区动态装箱：
 *   每排按当前墙宽逐条塞满才换排；已读盖「讫」印；在读抽出一截垂书签带；未读收墙尾「倒叠区」）
 *   ＋ 墙尾格言。书脊：高度=累计阅读时长、厚度=字数（开方缩放，无字数回退批注密度）、
 *   竖排书名按「：」拆主/副双列（text-orientation: upright，字号 14→9px 自适应、列宽上限 64px）。
 * 窗口缩放防抖重装箱；移动端同构（窄墙自动多排），无独立移动布局。
 * 点击书脊 → 借书卡详情（纸卡排版 + 印章；保留全部编辑能力：状态/进度/读完日期/书评/直达原文/
 *   读书笔记/删除，EPUB 只读）。保存语义与撤销回滚不变（persistBook/rollbackBook）。
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
import { uiModal, uiChoice, uiRange, uiEmpty, mountIcons } from '../core/ui';
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
import { showBookNotes, showEpubBookNotes, closeBookNoteModals } from './notes-ui';
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

/**
 * 直达原文（借书卡「打开笔记/继续读」按钮）：md = 打开笔记；EPUB = Weave 深链跳当前位置。
 * 点击瞬间 progress 反馈，打开后转 success，失败转 error。
 */
function openBookDirect(it: BookshelfItem, app: App): void {
  if (it.isEpub && !it.epubVaultPath) return;
  if (!it.isEpub && !it.file) return;
  const h = notify('正在打开…', { type: 'progress' });
  const done = () => { h.setMessage('已打开'); h.setType('success'); };
  const fail = (e: unknown) => {
    console.error('打开书失败:', e);
    h.setMessage('打开失败');
    h.setType('error');
  };
  if (it.isEpub) {
    void (async () => {
      try {
        const resume = await buildEpubResumeLink(app, it.epubVaultPath || '');
        await app.workspace.openLinkText(resume || (it.epubVaultPath || ''), '', false);
        done();
      } catch (e) {
        fail(e);
      }
    })();
  } else {
    void (app.workspace.openLinkText(it.file!.path, '', false) as Promise<void>).then(done, fail);
  }
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
  let html = statusDefs.map((d) => `
    <div class="bz-bs-taglabel${(d.f === 'all' ? M.side === 'all' && M.catFilter === 'all' : M.side === d.f) ? ' on' : ''}" data-bs-side="${d.f}">
      <span class="pin"></span><div class="n">${d.n}</div><div class="t">${d.t}</div>
    </div>`).join('');
  for (const [cat, c] of catPairs) {
    const hrs = c.ms > 0 ? ` · ${Math.round(c.ms / 3600000)} 时` : '';
    html += `<div class="bz-bs-taglabel dim-cat${M.catFilter === cat ? ' on' : ''}" data-bs-cat="${esc(cat)}">
      <span class="pin"></span><div class="n">${esc(cat)}</div><div class="t">${c.n} 册${hrs}</div>
    </div>`;
  }
  el.innerHTML = html;
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

// ---------- 借书卡详情（改状态/进度/日期/书评；EPUB 只读） ----------

let detailModalClose: (() => void) | null = null;
let confirmModalClose: (() => void) | null = null;

/** 关闭本域浮层弹窗（详情 + 删除确认 + 读书笔记；closeOverlay 调用） */
function closeDomainModals(): void {
  closeBookNoteModals();
  if (confirmModalClose) { confirmModalClose(); confirmModalClose = null; }
  if (detailModalClose) { detailModalClose(); detailModalClose = null; }
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 借书卡（原型口径：pull-note + 纸卡双栏 + 台账 + 批注密度条 + 印章）；
 *  编辑控件（状态/进度/读完日期/书评）融进卡内，功能零回退 */
function openBookDetail(it: BookshelfItem, app: App): void {
  const readonly = it.isEpub;
  const cu = coverUrl(it, app);
  const cover = cu ? `<img src="${esc(cu)}" alt="">` : `<div class="bz-bs-d-cover-ph">${iconSpan('library')}<span>无封面</span></div>`;
  const review = it.bookReview
    ? `<div class="bz-bs-d-quote">“${esc(it.bookReview)}”</div>`
    : '<div class="bz-bs-d-quote dim">——尚无书评——</div>';
  const dense = it.highlights + it.thinks;
  const seal = it.status === '已读' ? '讫' : it.status === '在读' ? '阅' : '藏';
  const directLabel = it.status === '在读' ? '继续读' : it.isEpub ? '打开原文' : '打开笔记';
  const hoursText = it.readingTimeFormat || (it.readingTimeMs > 0 ? (it.readingTimeMs / 3600000).toFixed(1) + ' 小时' : '—');

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
          <tr><td>状态</td><td class="bz-bs-d-status"><span class="bz-chip bz-chip--tint" style="--bz-chip-tint:${statusColor(it.status)};--bz-chip-tint-fg:var(--bz-on-overlay)">${esc(it.status)}</span>
            <button type="button" class="bz-bs-d-openlink" data-bs-d-open>${directLabel}</button></td></tr>
          <tr><td>累计时长</td><td>${esc(hoursText)}</td></tr>
          <tr><td>阅读进度</td><td><span class="bz-bs-d-progrow"><span class="bz-bs-d-prog"></span><b class="bz-bs-d-prognum">${it.progress}%</b></span></td></tr>
          <tr class="bz-bs-d-cdatewrap"${it.status === '已读' ? '' : ' style="display:none"'}><td>读完日期</td><td><input type="date" class="bz-input bz-bs-d-cdate" value="${esc(it.completionDate || todayStr())}"></td></tr>
          <tr><td>起读 · 读完</td><td>${esc(it.readingDate || '—')} · ${esc(it.completionDate || '—')}</td></tr>
          <tr><td>划线 / 想法</td><td>${dense > 0 ? `<button type="button" class="bz-bs-d-openlink" data-bs-notes title="查看读书笔记">${it.highlights} 条 / ${it.thinks} 条</button>` : `${it.highlights} 条 / ${it.thinks} 条`}</td></tr>
          ${it.pages ? `<tr><td>页数</td><td>${it.pages} 页</td></tr>` : ''}
        </table>
        <div class="bz-bs-d-meter">
          <div class="cap">批注密度（划线 + 想法 = ${dense}）</div>
          <div class="bar"><i style="width:${Math.min(100, (dense / Math.max(10, dense)) * 100)}%"></i></div>
        </div>
        <div class="bz-bs-label">书评</div>
        <textarea class="bz-input bz-bs-d-review" placeholder="写一句这本书…">${esc(it.bookReview || '')}</textarea>
        ${readonly ? '<div class="bz-bs-d-readonly">EPUB 书目由 Weave 阅读器记录：状态、进度随阅读自动更新，这里只读展示。</div>' : ''}
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

  // 状态行：现态 chip 后跟状态切换 choice（slots）
  const statusCell = popup.querySelector('.bz-bs-d-status') as HTMLElement;
  const statusChoice = uiChoice({
    options: ['在读', '已读', '未读'].map((v) => ({ value: v, label: v, dot: statusColor(v) })),
    value: it.status,
    onChange: (v) => {
      progInput.disabled = readonly || v === '已读' || v === '未读';
      if (v === '已读') {
        progInput.value = '100';
        paintProg();
        if (!cdateInput.value) cdateInput.value = todayStr();
        cdateWrap.style.display = '';
      } else {
        if (v === '未读') { progInput.value = '0'; paintProg(); }
        cdateWrap.style.display = 'none';
      }
    },
  });
  statusCell.appendChild(statusChoice.el);

  // 直达原文/继续读：关借书卡后打开原文（md 笔记 / Weave 深链）
  popup.querySelector('[data-bs-d-open]')?.addEventListener('click', () => {
    close();
    openBookDirect(it, app);
  });

  // 读书笔记入口（划线/想法行）：md 开笔记行弹窗；EPUB 走 weave 聚合弹窗
  popup.querySelector('[data-bs-notes]')?.addEventListener('click', () => {
    if (it.isEpub) showEpubBookNotes(app, it.epubVaultPath || '', it.title);
    else if (it.file) showBookNotes(app, it.file.path, it.title);
  });

  // 进度滑杆 + 读完日期 + 书评（EPUB 只读禁用）
  const cdateWrap = popup.querySelector('.bz-bs-d-cdatewrap') as HTMLElement;
  const cdateInput = popup.querySelector('.bz-bs-d-cdate') as HTMLInputElement;
  const progInput = uiRange({ min: 0, max: 100, value: it.progress, disabled: readonly || it.status === '已读' || it.status === '未读' });
  const progNumEl = popup.querySelector('.bz-bs-d-prognum') as HTMLElement;
  const progWrap = popup.querySelector('.bz-bs-d-prog') as HTMLElement;
  function paintProg(): void { progNumEl.textContent = `${Math.round(parseFloat(progInput.value))}%`; }
  progInput.addEventListener('input', paintProg);
  progWrap.appendChild(progInput);
  const reviewEl = popup.querySelector('.bz-bs-d-review') as HTMLTextAreaElement;
  if (readonly) {
    reviewEl.disabled = true;
    statusChoice.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    progInput.disabled = true;
    cdateInput.disabled = true;
  }

  // 操作区：删除（md 书）＋ 取消/保存
  const actions = document.createElement('div');
  actions.className = 'bz-bs-d-actions';
  if (!readonly && it.file) {
    const del = document.createElement('button');
    del.className = 'bz-btn bz-btn--danger-ghost bz-bs-d-danger';
    del.type = 'button';
    del.innerHTML = iconSpan('trash-2', 'bz-ic--sm') + '删除';
    del.addEventListener('click', () => {
      const confHtml = `<div class="bz-bs-confirm">
        <div class="bz-bs-confirm-ic">${iconSpan('alert-circle')}</div>
        <p>确定删除《${esc(it.title)}》吗？</p>
        <div class="bz-bs-confirm-sub">书目笔记会被移入回收站，划线等记录一并删除</div>
        <div class="bz-btn-row bz-btn-row--center">
          <button class="bz-btn bz-btn--ghost" data-bs-c="0">取消</button>
          <button class="bz-btn bz-btn--danger" data-bs-c="1">删除</button>
        </div></div>`;
      const conf = uiModal({ content: confHtml, maxWidth: 320, className: `bz-bs-confirm-pop ${bsSkinClass()}`, onClose: () => { confirmModalClose = null; } });
      confirmModalClose = conf.close;
      mountIcons(conf.popup);
      conf.popup.querySelector('[data-bs-c="1"]')?.addEventListener('click', () => {
        void (async () => {
          try {
            if (it.file) await app.vault.trash(it.file, true);
            close();
            conf.close();
            await rebuildItems(app);
            renderAll(app);
            notice(`已删除书目《${it.title}》`, 'success');
          } catch (e) {
            console.error('删除书目失败:', e);
            notice('删除失败', 'error');
          }
        })();
      });
      conf.popup.querySelector('[data-bs-c="0"]')?.addEventListener('click', () => conf.close());
    });
    actions.appendChild(del);
  }
  const spacer = document.createElement('span');
  spacer.className = 'bz-bs-d-spacer';
  actions.appendChild(spacer);
  const cancel = document.createElement('button');
  cancel.className = 'bz-btn bz-btn--ghost';
  cancel.type = 'button';
  cancel.textContent = '取消';
  cancel.addEventListener('click', () => close());
  actions.appendChild(cancel);
  if (!readonly) {
    const save = document.createElement('button');
    save.className = 'bz-btn bz-btn--primary bz-bs-d-save';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', () => {
      void (async () => {
        const status = (statusChoice.el.querySelector('.is-on') as HTMLElement | null)?.dataset.value || it.status;
        const progVal = Math.round(parseFloat(progInput.value) || 0);
        const review = reviewEl.value.trim();
        const snap = { status: it.status, progress: it.progress, readingDate: it.readingDate, completionDate: it.completionDate, bookReview: it.bookReview };
        const completionDate = status === '已读' ? cdateInput.value.trim() : '';
        try {
          await persistBook(it, app, { status, progress: progVal, review, completionDate });
          close();
          await rebuildItems(app);
          renderAll(app);
          notifyUndo(`已保存《${it.title}》`, () => { void rollbackBook(it, app, snap); }, { type: 'restore' });
        } catch (e) {
          console.error('保存书目失败:', e);
          notice('保存失败', 'error');
        }
      })();
    });
    actions.appendChild(save);
  }
  popup.appendChild(actions);
  mountIcons(popup);
  bindCoverFallback(popup);
}

/** 落盘语义（md 书）：状态/进度/书评/读完日期 → frontmatter（已读补 completionDate+readingDate、
 *  在读补 readingDate 清 completionDate、未读清两日期归零；书评空删键） */
async function persistBook(
  it: BookshelfItem,
  app: App,
  patch: { status: string; progress: number; review: string; completionDate?: string },
): Promise<void> {
  if (!it.file) return;
  await app.fileManager.processFrontMatter(it.file, (fm: Record<string, unknown>) => {
    if (patch.status === '已读') {
      fm.readingProgress = 100;
      if (!fm.readingDate) fm.readingDate = todayStr();
      fm.completionDate = patch.completionDate || (typeof fm.completionDate === 'string' && fm.completionDate ? fm.completionDate : todayStr());
    } else if (patch.status === '在读') {
      fm.readingProgress = Math.max(1, Math.min(99, patch.progress));
      if (!fm.readingDate) fm.readingDate = todayStr();
      delete fm.completionDate;
    } else {
      fm.readingProgress = 0;
      delete fm.readingDate;
      delete fm.completionDate;
    }
    if (patch.review) fm.bookReview = patch.review;
    else delete fm.bookReview;
  });
  it.status = patch.status;
  it.progress = patch.status === '已读' ? 100 : patch.status === '在读' ? Math.min(99, patch.progress) : 0;
  if (patch.status === '已读') {
    if (!it.readingDate) it.readingDate = todayStr();
    it.completionDate = patch.completionDate || it.completionDate || todayStr();
  } else if (patch.status === '在读') {
    if (!it.readingDate) it.readingDate = todayStr();
    it.completionDate = null;
  } else {
    it.readingDate = null;
    it.completionDate = null;
  }
  if (patch.review) it.bookReview = patch.review;
  else it.bookReview = null;
}

/** 保存撤销回滚（notifyUndo 回调）：frontmatter 还原快照旧值 + 本地条目同步 + 重扫渲染 */
async function rollbackBook(
  it: BookshelfItem,
  app: App,
  snap: { status: string; progress: number; readingDate: string | null; completionDate: string | null; bookReview: string | null },
): Promise<void> {
  if (!it.file) return;
  try {
    await app.fileManager.processFrontMatter(it.file, (fm: Record<string, unknown>) => {
      if (snap.readingDate) fm.readingDate = snap.readingDate;
      else delete fm.readingDate;
      if (snap.completionDate) fm.completionDate = snap.completionDate;
      else delete fm.completionDate;
      fm.readingProgress = snap.progress;
      if (snap.bookReview) fm.bookReview = snap.bookReview;
      else delete fm.bookReview;
    });
    it.status = snap.status;
    it.progress = snap.progress;
    it.readingDate = snap.readingDate;
    it.completionDate = snap.completionDate;
    it.bookReview = snap.bookReview;
    await rebuildItems(app);
    renderAll(app);
    notice('已撤销修改', 'success');
  } catch (e) {
    console.error('撤销书目修改失败:', e);
    notice('撤销失败', 'error');
  }
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
        <div class="bz-bs-plaque">
          <h1>书脊墙</h1>
          <p>SPINE WALL · 以书脊读一座书房</p>
        </div>
        <div class="bz-bs-labels" id="bz-bs-labels"></div>
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
            <button class="bz-icon-btn bz-rr-close" data-rr-goto-shelf title="返回书脊墙">${iconSpan(ICON.close)}</button>
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
    // 状态标签（再点已选 = 回全馆；「全馆」恒置 all）
    const side = t.closest('[data-bs-side]') as HTMLElement | null;
    if (side) {
      const id = (side.dataset.bsSide || 'all') as SideId;
      M.side = id !== 'all' && M.side === id ? 'all' : id;
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
