/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：主面板 UI。
 *
 * 桌面三栏（rail 源列表 / 中栏条目 / 右栏阅读）+ 移动端双屏（源胶囊列表 / 详情+头栏保存钮）。
 * 对齐拍板原型 clipping-p3-siteboxes.html 的结构与极简口味：头行仅品牌+标题+「聚合讯已接入」，
 * 无右上角图标（关闭=点遮罩/ESC；移动真全屏有 ✕）；动作收进条目右键菜单（item-actions 复用）；
 * 「阅读分析数据」沉底左栏底部。
 *
 * 铁律 6：基线全部消费组件库（.bz-* 类与 --bz-* token）；本文件只管布局骨架 + 交互，
 * 域独有视觉在 styles.css（.bz-clip-*）。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { uiIcon } from '../core/ui';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { escManager } from '../core/esc-manager';
import { topifyZ, createSiteIcon } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { attachItemActions, closeItemMenu, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { openSettingsModal } from '../core/settings-modal';
import type { SettingsSchema } from '../core/settings-schema';
import { tryGetSettings } from '../core/settings-provider';
import { ensureAutoSummary, stopAutoSummary } from '../auto-summary';
import { buildNewsSourcesGroup } from '../clipping/news-sources-group';
import { batchSizeRow, mobileFullscreenGroup } from '../core/settings-common';
import type { ClipArticle } from './types';
import { esc } from './constants';
import { toParagraphs } from './md';
import { queryBySource } from './store';
import { M, resetClipbookState } from './state';
import { readNewsAndSidecar, clipDir } from './loader';
import { flowSave, flowMarkRead, flowToggleReading, flowDeleteNews, setReadingSession, pauseReadingSession } from './flow';
import type { ClipNote } from './scan';

// ================= 模块级 UI 引用 =================
let overlayEl: HTMLElement | null = null;
let railListEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let readerEl: HTMLElement | null = null;
let mobSourcesEl: HTMLElement | null = null;
let mobListEl: HTMLElement | null = null;
let mobDetailEl: HTMLElement | null = null;
let mobTitleEl: HTMLElement | null = null;
let mobSaveBtnEl: HTMLElement | null = null;
let analyBtnEl: HTMLElement | null = null;
let mobSearchbarEl: HTMLElement | null = null;
let escKey = '';
let escHandle: { unregister(): void } | null = null;
let escRegistered = false;
let loading = false;
let dirty = false; // 数据变化待刷标志（目录事件回调期）

// ================= 图标（lucide，禁 emoji） =================
const ICO = {
  inbox: 'inbox',
  feed: 'rss',
  clip: 'scissors',
  bili: 'play-square',
  mail: 'mail',
  book: 'book-open',
  check: 'check',
  download: 'download',
  external: 'external-link',
  trash: 'trash-2',
  chart: 'bar-chart-3',
  search: 'search',
  x: 'x',
  arrow: 'arrow-left',
  link: 'link',
  globe: 'globe',
  folder: 'folder-open',
  rotate: 'rotate-ccw',
  radio: 'radio',
};

// ================= 生命周期 =================
/** 幂等初始化面板 DOM（首开建结构 + 装载 + 订阅；重复调用只切可见性） */
export function initPanel(app: any, showNow = false): void {
  M.appRef = app;
  M.dir = clipDir();
  M.isMobile = (typeof (window as any).Platform !== 'undefined' && !!(window as any).Platform.isMobile)
    || (navigator && navigator.maxTouchPoints > 0 && (window.innerWidth || 0) <= 768);
  if (!overlayEl) buildDom(app);
  if (showNow) showPanel();
  else void loadIfNeeded();
}

/** 显示面板（幂等：数据就绪直接渲染；未装载先装载） */
export function showPanel(): void {
  if (!overlayEl) {
    // DOM 已被卸载清空（极端时序）→ 重建
    buildDom(M.appRef);
  }
  overlayEl!.style.display = 'flex';
  M.open = true;
  void loadIfNeeded();
}

/** 装载（防重入 + 首载后保留内存面，目录事件增量走 reloadIfOpen） */
let loadPromise: Promise<void> | null = null;
function loadIfNeeded(): Promise<void> {
  if (loading) return loadPromise || Promise.resolve();
  if (!M.open && overlayEl) return Promise.resolve();
  loading = true;
  loadPromise = readNewsAndSidecar()
    .then(() => { renderAll(); })
    .catch((e) => { console.error('[剪藏本] 装载失败', e); notice('剪藏本数据读取失败', 'error'); })
    .finally(() => { loading = false; loadPromise = null; });
  return loadPromise;
}

/** 目录文件事件触发的重载（仅面板打开时；防抖在 index 层） */
export function reloadIfOpen(): void {
  if (!M.open) return;
  dirty = true;
  void loadIfNeeded();
}

/** 关闭面板（隐藏 overlay；DOM 保留——重开零扫描复用缓存；unloadPanel 才移除） */
export function closePanel(): void {
  pauseReadingSession();
  M.open = false;
  M.mobDetailOpen = false;
  if (overlayEl) overlayEl.style.display = 'none';
}

/** 卸载（main.ts onunload） */
export function unloadPanel(): void {
  pauseReadingSession();
  closeItemMenu();
  if (escHandle) {
    try { escHandle.unregister(); } catch (e) { /* 忽略 */ }
    escHandle = null;
    escRegistered = false;
  }
  M.open = false;
  M.mobDetailOpen = false;
  loading = false;
  loadPromise = null;
  dirty = false;
  if (overlayEl) overlayEl.remove();
  overlayEl = null;
  resetClipbookState();
}

// ================= DOM 构建 =================
function buildDom(app: any): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'bz-clip-overlay';
  overlayEl.style.display = 'none';
  // 桌面三栏 + 移动双屏容器（isMobileEnv 决定显示哪套，CSS 媒体查询兜底隐藏）
  overlayEl.innerHTML = `
    <div class="bz-clip-frame">
      <!-- 桌面三栏 -->
      <div class="bz-clip-desk">
        <div class="bz-clip-desk-head">
          <div class="bz-clip-brand">${iconSpan('scissors', 'bz-ic--sm')}</div>
          <div class="bz-clip-title">剪藏本</div>
          <div class="bz-clip-head-pipe"></div>
          <div class="bz-clip-head-sub">聚合讯已接入</div>
          <div class="bz-clip-head-sp"></div>
        </div>
        <div class="bz-clip-desk-body">
          <div class="bz-clip-rail">
            <div class="bz-clip-rail-list" data-clip-rail></div>
            <div class="bz-clip-rail-foot">
              <button class="bz-clip-analy" data-clip-analy title="打开阅读分析数据报告">${iconSpan('bar-chart-3', 'bz-ic--sm')}<span>阅读分析数据</span></button>
            </div>
          </div>
          <div class="bz-clip-mid">
            <div class="bz-clip-list" data-clip-list></div>
          </div>
          <div class="bz-clip-read">
            <div class="bz-clip-read-scroll"><div class="bz-clip-read-body" data-clip-reader></div></div>
          </div>
        </div>
      </div>
      <!-- 移动双屏 -->
      <div class="bz-clip-mob" data-clip-mob>
        <div class="bz-clip-mob-top">
          <div class="bz-clip-mob-title">剪藏本</div>
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-search title="搜索">${iconSpan('search')}</button>
          <button class="bz-icon-btn bz-icon-btn--lg bz-icon-btn--close" data-clip-mob-close title="关闭">${iconSpan('x')}</button>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="搜索标题、摘要、站点、标签">
        </div>
        <div class="bz-clip-mob-sources" data-clip-mob-sources></div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-back title="返回">${iconSpan('arrow-left')}</button>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <button class="bz-clip-mob-save" data-clip-mob-save title="保存到剪藏本">${iconSpan('download', 'bz-ic--sm')}</button>
        </div>
        <div class="bz-clip-mob-detail-body" data-clip-mob-detail-body></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  railListEl = overlayEl.querySelector('[data-clip-rail]');
  listEl = overlayEl.querySelector('[data-clip-list]');
  readerEl = overlayEl.querySelector('[data-clip-reader]');
  mobSourcesEl = overlayEl.querySelector('[data-clip-mob-sources]');
  mobListEl = overlayEl.querySelector('[data-clip-mob-list]');
  mobDetailEl = overlayEl.querySelector('[data-clip-mob-detail]');
  mobTitleEl = overlayEl.querySelector('[data-clip-mob-title]');
  mobSaveBtnEl = overlayEl.querySelector('[data-clip-mob-save]');
  analyBtnEl = overlayEl.querySelector('[data-clip-analy]');
  const mobSearchBtn = overlayEl.querySelector('[data-clip-mob-search]');
  const mobCloseBtn = overlayEl.querySelector('[data-clip-mob-close]');
  const mobBackBtn = overlayEl.querySelector('[data-clip-mob-back]');
  mobSearchbarEl = overlayEl.querySelector('[data-clip-mob-searchbar]') as HTMLElement;
  const mobSearchbar = mobSearchbarEl;
  const mobInput = overlayEl.querySelector('[data-clip-mob-input]') as HTMLInputElement;

  // 点遮罩关闭（桌面无关闭钮）
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closePanel();
  });
  // 桌面 rail 源切换
  railListEl!.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('[data-src]') as HTMLElement | null;
    if (!row) return;
    selectSource(JSON.parse(row.dataset.src || 'null'));
  });
  // 中栏条目点击 → 阅读；右键 → item-actions（卡片内挂）
  // 阅读分析数据
  analyBtnEl!.addEventListener('click', () => {
    closePanel();
    (getApp() as any).commands.executeCommandById('bz-reading-report-open');
  });
  // 移动：搜索切换
  mobSearchBtn!.addEventListener('click', () => {
    const show = mobSearchbarEl!.style.display === 'none';
    mobSearchbarEl!.style.display = show ? '' : 'none';
    if (show) mobInput!.focus();
    else { mobInput!.value = ''; setSearchKw(''); renderMobList(); }
  });
  mobInput!.addEventListener('input', () => {
    searchKw = mobInput!.value.trim();
    renderMobList();
  });
  // 移动：关闭 / 返回
  mobCloseBtn!.addEventListener('click', () => closePanel());
  mobBackBtn!.addEventListener('click', () => {
    M.mobDetailOpen = false;
    mobDetailEl!.style.display = 'none';
    renderAll();
  });
  // 移动：头栏保存钮
  mobSaveBtnEl!.addEventListener('click', () => {
    void doSave(M.cur);
  });

  // ESC
  escKey = 'bz-clipbook';
  escHandle = escManager.register(escKey, {
    isVisible: () => !!overlayEl && overlayEl.style.display !== 'none',
    close: () => closePanel(),
  });
  escRegistered = true;
  applyMobileWindowFullscreen(overlayEl.querySelector('.bz-clip-frame') as HTMLElement, mobileFullscreenDefault());
  // 移动源胶囊点击（委托，含搜索态）
  mobSourcesEl!.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('[data-src]') as HTMLElement | null;
    if (!chip) return;
    selectSource(JSON.parse(chip.dataset.src || 'null'));
  });
  // 移动列表点击 → 详情
  mobListEl!.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
    if (!item) return;
    openMobDetail(item.dataset.id || '');
  });
}

function iconSpan(name: string, extra = ''): string {
  return `<span class="bz-ic${extra ? ' ' + extra : ''}" data-lucide="${name}"></span>`;
}

/** 移动端默认全屏（读设置；缺省对齐 clipping 默认 true） */
function mobileFullscreenDefault(): boolean {
  const s = tryGetSettings() as any;
  return s?.clipbookMobileDefaultFullscreen !== false;
}

function selectSource(src: any): void {
  M.sel = {
    kind: src.kind,
    platform: String(src.platform || ''),
    up: src.up ? String(src.up) : null,
  };
  M.mobDetailOpen = false;
  setSearchKw('');
  renderAll();
}

/** 读当前搜索词（state 扩展占位——直接模块级变量） */
let searchKw = '';
function setSearchKw(kw: string): void { searchKw = kw; }

// ================= 装载后全量渲染 =================
function renderAll(): void {
  if (!M.open) return;
  renderRail();
  renderList();
  renderReader();
  renderMobSources();
  renderMobList();
  if (M.mobDetailOpen && M.cur) {
    // 详情保持打开态（数据刷新后重绘正文）
    renderMobDetail();
  }
}

/** 数据面刷新（目录事件/动作后调用；保留选中与阅读态） */
function refreshData(): void {
  renderAll();
}

// ================= 视图派生 =================
function srcList(): { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' } {
  const s = M.sel;
  if (s.kind === 'clip') return { kind: 'clip' };
  if (s.kind === 'inbox') return { kind: 'inbox', platform: s.platform, up: s.up || undefined };
  return { kind: 'all' };
}

function currentList(): ClipArticle[] {
  return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], srcList());
}

function listWithSearch(): ClipArticle[] {
  const kw = (searchKw || '').toLowerCase();
  let list = currentList();
  if (kw) {
    list = list.filter((a) =>
      a.title.toLowerCase().includes(kw) ||
      a.summary.toLowerCase().includes(kw) ||
      a.site.toLowerCase().includes(kw) ||
      a.srcName.toLowerCase().includes(kw) ||
      a.author.toLowerCase().includes(kw) ||
      a.tags.some((t) => t.toLowerCase().includes(kw))
    );
  }
  return list;
}

// ================= 渲染：左 rail =================
function railItemHtml(kind: string, label: string, count: number, unread: number, icon: string | null, color: string | null, active: boolean, sub?: string): string {
  const sel = { kind, platform: kind === 'inbox' ? label : '', up: null };
  return `
    <div class="bz-clip-rail-row${active ? ' on' : ''}" data-src='${JSON.stringify(sel)}' title="${esc(label)}">
      ${icon === 'feed'
        ? `<span class="bz-clip-rail-badge" style="--rail-c:${color || '#58a6ff'}">${esc(sub || label.slice(0, 1))}</span>`
        : icon === 'bili'
          ? `<span class="bz-clip-rail-badge bili" style="--rail-c:${color || '#58a6ff'}">${esc(sub || label.slice(0, 1))}</span>`
          : icon === 'clip'
            ? `<span class="bz-clip-rail-ic">${iconSpan('scissors')}</span>`
            : `<span class="bz-clip-rail-ic ${kind === 'all' ? 'accent' : ''}">${icon ? iconSpan(icon) : ''}</span>`}
      <span class="bz-clip-rail-name">${esc(label)}</span>
      ${unread > 0 ? `<span class="bz-clip-rail-unread">${unread}</span>` : `<span class="bz-clip-rail-count">${count}</span>`}
    </div>`;
}

function renderRail(): void {
  if (!railListEl) return;
  const arts = M.articles;
  const unread = arts.filter((a) => !a.read).length;
  const clipNotes = M.clipNotes || [];
  const clips = clipNotes.length;
  let html = railItemHtml('all', '全部未读', unread, 0, 'inbox', '#58a6ff', M.sel.kind === 'all', '');

  // 平台段
  const platformLabels: Array<[string, string]> = [['B站', '#e8669a'], ['果壳科学人', '#2fae8c'], ['知乎日报', '#58a6ff']];
  for (const [pfx, color] of platformLabels) {
    const cnt = arts.filter((a) => !a.read && (a.platform === pfx || (pfx === '果壳科学人' && a.platform === '果壳') || (pfx === '知乎日报' && a.platform === '知乎'))).length;
    const active = M.sel.kind === 'inbox' && M.sel.platform === pfx;
    html += railItemHtml('inbox', pfx, cnt, cnt, 'feed', color, active, '');
  }

  // B站 UP 展开（upInfo 回填名字）
  const biliUps = new Map<string, string>();
  for (const a of arts) if (!a.read && a.platform === 'B站' && a.author) biliUps.set(String(a.author), String(a.author));
  for (const [name] of biliUps) {
    const cnt = arts.filter((a) => !a.read && a.platform === 'B站' && String(a.author || '') === name).length;
    const active = M.sel.kind === 'inbox' && M.sel.platform === 'B站' && M.sel.up === name;
    html += railItemHtml('inbox', name, cnt, cnt, 'bili', '#8b7cf6', active, name.slice(0, 1));
  }

  // 剪藏本（聚合，saved 语义）
  const clipActive = M.sel.kind === 'clip';
  html += railItemHtml('clip', '剪藏本', clips, 0, 'clip', '', clipActive, '');

  railListEl.innerHTML = html;
}

// ================= 渲染：中栏列表 =================
function dotHtml(st: string): string {
  return `<span class="bz-clip-dot ${st}"></span>`;
}

function renderList(): void {
  if (!listEl) return;
  const list = listWithSearch();
  if (list.length === 0) {
    listEl.innerHTML = `<div class="bz-clip-empty">${iconSpan('inbox')}<span>这个源暂无内容</span></div>`;
    if (readerEl) readerEl.innerHTML = '';
    return;
  }
  // 保持阅读项在列表内（不在则取第一条）
  if (!list.some((a) => a.id === (M.cur && M.cur.id))) {
    M.cur = list[0];
  }
  listEl.innerHTML = list.map((a) => `
    <div class="bz-clip-item${M.cur && M.cur.id === a.id ? ' on' : ''}" data-id="${esc(a.id)}">
      <div class="bz-clip-item-t">${dotHtml(a.st)}<span>${esc(a.title)}</span></div>
      ${a.summary ? `<div class="bz-clip-item-sum">${esc(a.summary)}</div>` : ''}
      <div class="bz-clip-item-meta">
        <span class="bz-clip-item-site">${esc(a.srcName)}</span>
        <span class="bz-clip-item-time">${relTime(a.timeTs)}</span>
      </div>
    </div>`).join('');
  // 卡片右键/长按（item-actions 复用）
  bindItemMenus();
}

function relTime(ts: number): string {
  if (!ts) return '';
  try {
    return formatRelativeTime(new Date(ts));
  } catch (e) {
    return '';
  }
}

/** 给中栏卡片挂右键/长按菜单（item-actions：桌面 contextmenu / 触屏长按抽屉） */
function bindItemMenus(): void {
  if (!listEl) return;
  const cards = listEl.querySelectorAll<HTMLElement>('.bz-clip-item');
  cards.forEach((card) => {
    const a = M.list.find((x) => x.id === card.dataset.id) || M.cur;
    const art = currentList().find((x) => x.id === card.dataset.id);
    if (!art) return;
    const actions = buildItemActions(art);
    attachItemActions(card, actions, { sheetHead: buildSheetHead(art) });
    // 单击选中 → 阅读
    card.addEventListener('click', (e) => {
      if (e.target && (e.target as HTMLElement).closest('.bz-item-sheet')) return;
      selectArticle(art.id);
    });
  });
  // 记录当前列表缓存（右键菜单取用）
  M.list = currentList();
}

function buildSheetHead(a: ClipArticle): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-clip-sheet-head';
  const t = document.createElement('div');
  t.className = 'bz-clip-sheet-title';
  t.textContent = a.title;
  const s = document.createElement('div');
  s.className = 'bz-clip-sheet-sum';
  s.textContent = a.summary || '';
  head.appendChild(t);
  head.appendChild(s);
  return head;
}

/** 条目动作（右键/抽屉）：与原型菜单一致 + 剪藏条目打开笔记 */
function buildItemActions(a: ClipArticle): ItemAction[] {
  const out: ItemAction[] = [];
  if (a.origin === 'clip') {
    out.push(
      { icon: 'external-link', label: '打开笔记', title: '打开剪藏笔记', onClick: () => openNote(a) },
      { icon: 'link', label: '复制双链', title: '复制双链引用', onClick: () => void copyText(`[[${a.notePath}|${a.title}]]`, '双链已复制') },
      { icon: 'globe', label: '复制原文链接', sub: a.domain || undefined, onClick: () => void copyText(a.url, '原文链接已复制') },
    );
    if (a.note && (a.note as ClipNote).file) {
      out.push({ icon: 'trash-2', label: '删除', kind: 'danger', title: '删除剪藏笔记', onClick: () => deleteClipNote(a) });
    }
    return out;
  }
  // news 条目
  if (a.st !== 'saved') {
    out.push({ icon: 'download', label: '保存到剪藏本', title: '保存为正式剪藏', onClick: () => void doSave(a) });
  } else {
    out.push({ icon: 'rotate-ccw', label: '移出剪藏本', title: '取消保存标记', onClick: () => void doUnsave(a) });
  }
  out.push({ icon: 'check', label: '标记为已读', title: '不再出现在收件流', onClick: () => void doMarkRead(a) });
  if (a.st === 'reading') {
    out.push({ icon: 'book-open', label: '取消在读', onClick: () => void doToggleReading(a) });
  } else {
    out.push({ icon: 'book-open', label: '标记在读', onClick: () => void doToggleReading(a) });
  }
  if (a.url) {
    out.push({ icon: 'globe', label: '查看原文', sub: a.domain || undefined, onClick: () => openExternal(a.url) });
  }
  out.push({ icon: 'trash-2', label: '删除', kind: 'danger', title: '从收件流删除', onClick: () => deleteNewsItem(a) });
  return out;
}

// ================= 渲染：右栏阅读 =================
function renderReader(): void {
  if (!readerEl) return;
  const a = M.cur;
  if (!a) {
    readerEl.innerHTML = `<div class="bz-clip-read-empty">${iconSpan('book-open')}<span>从列表选择一篇文章开始阅读</span></div>`;
    return;
  }
  setReadingSession(a.id);
  const stLabel = a.st === 'saved' ? '已保存' : a.st === 'reading' ? '在读' : a.st === 'read' ? '已读' : '未读';
  const flagCls = a.st === 'saved' ? 'ok' : a.st === 'reading' ? 'warn' : 'info';
  const siteIcon = a.domain ? siteIconHtml(a.domain) : favChip(a.site);
  const paras = a.body ? toParagraphs(a.body).map((p) =>
    p.type === 'quote'
      ? `<blockquote>${esc(p.text)}</blockquote>`
      : `<p>${esc(p.text)}</p>`
  ).join('') : '';

  readerEl.innerHTML = `
    <div class="bz-clip-art-site">${siteIcon}<span class="bz-clip-art-site-name">${esc(a.srcName)}</span>${a.typeLabel ? `<span class="bz-clip-art-type">${esc(a.typeLabel)}</span>` : ''}</div>
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(a.timeText || relTime(a.timeTs))}</span>
      <span class="bz-clip-art-flag ${flagCls}">${iconSpan(a.st === 'saved' ? 'check' : a.st === 'reading' ? 'book-open' : 'mail', 'bz-ic--xs')}${stLabel}</span>
    </div>
    ${a.summary ? `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan('sparkles', 'bz-ic--xs')}摘要</span>${esc(a.summary)}</div>` : ''}
    <div class="bz-clip-art-md">${paras || `<p class="dim">${esc(a.body ? a.body : a.origin === 'clip' ? '' : '正文已清空（已处理条目）')}</p>`}</div>
    ${a.origin === 'news' && a.url ? `<a class="bz-clip-art-origin" href="${esc(a.url)}" target="_blank" rel="noopener">查看原文 ${iconSpan('external-link', 'bz-ic--xs')}</a>` : ''}
  `;
}

function favChip(site: string): string {
  const ch = esc(String(site || '剪').slice(0, 1));
  return `<span class="bz-clip-favchip">${ch}</span>`;
}

function siteIconHtml(domain: string): string {
  // 由 createSiteIcon 真实渲染（yandex favicon）；jsdom 下返回 null → 回退字 chip
  const img = createSiteIcon(domain, 15);
  if (!img) return favChip('');
  const holder = document.createElement('span');
  holder.className = 'bz-clip-favimg';
  holder.appendChild(img);
  return holder.outerHTML;
}

// ================= 动作 =================
function selectArticle(id: string): void {
  const list = currentList();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  M.cur = a;
  renderList();
  renderReader();
  renderMobDetail();
}

async function doSave(a: ClipArticle | null): Promise<void> {
  if (!a || a.origin !== 'news') return;
  const ok = await flowSave(a);
  if (!ok) return;
  await refreshAfterAction();
}

async function doUnsave(a: ClipArticle | null): Promise<void> {
  if (!a || a.origin !== 'news') return;
  pauseReadingSession();
  // 移出 = 还原为未读（仅清 news 侧 state；目录文件保留——保底 saved 判定仍命中）
  await import('./store').then(async (st) => {
    const sidecar = { ...M.sidecar };
    const key = a.id;
    delete sidecar.articleOverrides[key];
    sidecar.savedArchive = (sidecar.savedArchive || []).filter((s) => s.url !== a.url);
    await st.writeSidecar(sidecar);
    M.sidecar = sidecar;
    await refreshAfterAction();
  });
}

async function doMarkRead(a: ClipArticle | null): Promise<void> {
  if (!a || a.origin !== 'news') return;
  await flowMarkRead(a);
  notice('已标记为已读', 'success');
  await refreshAfterAction();
}

async function doToggleReading(a: ClipArticle | null): Promise<void> {
  if (!a || a.origin !== 'news') return;
  const next = await flowToggleReading(a);
  notice(next === 'reading' ? '已标记在读' : '已取消在读', 'success');
  await refreshAfterAction();
}

async function deleteNewsItem(a: ClipArticle): Promise<void> {
  const ok = await openFlowDialog({
    title: '确认删除',
    message: `确定从收件流删除「${a.title}」吗？\n此操作不可撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  await flowDeleteNews(a);
  notice('已删除', 'success');
  await refreshAfterAction();
}

async function deleteClipNote(a: ClipArticle): Promise<void> {
  const ok = await openFlowDialog({
    title: '确认删除',
    message: `确定删除剪藏「${a.title}」吗？\n此操作不可撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  const note = a.note as ClipNote | undefined;
  if (note && note.file) {
    try {
      await getApp().vault.delete(note.file);
      notice('已删除剪藏', 'success');
      await refreshAfterAction();
    } catch (e) {
      notice('删除失败，请检查文件权限', 'error');
    }
  }
}

function openNote(a: ClipArticle): void {
  if (!a.notePath) return;
  getApp().workspace.openLinkText(a.notePath, '', false, { active: true });
  closePanel();
}

function openExternal(url: string): void {
  const app = getApp();
  try {
    (app as any).openUrl ? (app as any).openUrl(url) : window.open(url, '_blank');
  } catch (e) {
    notice('无法打开链接', 'error');
  }
}

async function copyText(text: string, okMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notice(okMsg, 'success');
  } catch (e) {
    notice('复制失败', 'error');
  }
}

/** 动作后刷新（数据面 + 列表 + rail 计数 + 阅读区；选中保留） */
async function refreshAfterAction(): Promise<void> {
  await readNewsAndSidecar();
  // 当前阅读项若已出列表（已处理/删除）→ 切到列表第一条
  const list = currentList();
  if (M.cur && !list.some((x) => x.id === M.cur!.id)) {
    M.cur = list[0] || null;
  }
  renderAll();
}

// ================= 渲染：移动 =================
function mobSrcChipHtml(kind: string, label: string, unread: number, active: boolean, icon: string | null, sub?: string): string {
  const sel = { kind, platform: kind === 'inbox' ? label : '', up: null };
  return `
    <div class="bz-clip-mob-src${active ? ' on' : ''}" data-src='${JSON.stringify(sel)}'>
      ${icon === 'feed' ? `<span class="bz-clip-favchip sm">${esc(sub || label.slice(0, 1))}</span>` : ''}
      <span>${esc(label)}</span>
      ${unread ? `<span class="bz-clip-mob-ub">${unread}</span>` : ''}
    </div>`;
}

function renderMobSources(): void {
  if (!mobSourcesEl) return;
  const arts = M.articles;
  let html = mobSrcChipHtml('all', '全部未读', arts.filter((a) => !a.read).length, M.sel.kind === 'all', 'radio');
  // 平台三 chip + B站 UP chip
  for (const pfx of ['B站', '果壳科学人', '知乎日报']) {
    const cnt = arts.filter((a) => !a.read && (a.platform === pfx || (pfx === '果壳科学人' && a.platform === '果壳') || (pfx === '知乎日报' && a.platform === '知乎'))).length;
    html += mobSrcChipHtml('inbox', pfx, cnt, M.sel.kind === 'inbox' && M.sel.platform === pfx, 'feed', pfx.slice(0, 1));
  }
  for (const a of arts) {
    if (a.read || a.platform !== 'B站' || !a.author) continue;
    const name = String(a.author);
    const cnt = arts.filter((x) => !x.read && x.platform === 'B站' && String(x.author || '') === name).length;
    if (cnt === 0) continue;
    html += mobSrcChipHtml('inbox', name, cnt, M.sel.kind === 'inbox' && M.sel.platform === 'B站' && M.sel.up === name, 'bili', name.slice(0, 1));
  }
  html += mobSrcChipHtml('clip', '剪藏本', 0, M.sel.kind === 'clip', 'clip');
  mobSourcesEl.innerHTML = html;
}

function renderMobList(): void {
  if (!mobListEl) return;
  const list = listWithSearch();
  if (!list.length) {
    mobListEl.innerHTML = `<div class="bz-clip-empty sm">${iconSpan('inbox')}<span>暂无内容</span></div>`;
    return;
  }
  mobListEl.innerHTML = list.map((a) => `
    <div class="bz-clip-mob-item" data-id="${esc(a.id)}">
      <div class="bz-clip-item-t">${dotHtml(a.st)}<span>${esc(a.title)}</span></div>
      ${a.summary ? `<div class="bz-clip-item-sum">${esc(a.summary)}</div>` : ''}
      <div class="bz-clip-item-meta"><span>${esc(a.srcName)}</span><span class="bz-clip-item-time">${relTime(a.timeTs)}</span></div>
    </div>`).join('');
}

function openMobDetail(id: string): void {
  const list = currentList();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  M.cur = a;
  M.mobDetailOpen = true;
  renderMobDetail();
  if (mobDetailEl) mobDetailEl.style.display = 'flex';
}

function renderMobDetail(): void {
  if (!mobDetailEl || !M.cur) return;
  const a = M.cur;
  if (mobTitleEl) mobTitleEl.textContent = `${a.srcName} · ${a.typeLabel || a.site}`;
  // 保存钮态
  if (mobSaveBtnEl) {
    const saved = a.st === 'saved';
    mobSaveBtnEl.classList.toggle('saved', saved);
    mobSaveBtnEl.title = saved ? '已保存到剪藏本' : '保存到剪藏本';
    mobSaveBtnEl.innerHTML = iconSpan(saved ? 'check' : 'download', 'bz-ic--sm');
  }
  const stLabel = a.st === 'saved' ? '已保存' : a.st === 'reading' ? '在读' : a.st === 'read' ? '已读' : '未读';
  const flagCls = a.st === 'saved' ? 'ok' : a.st === 'reading' ? 'warn' : 'info';
  const paras = a.body ? toParagraphs(a.body).map((p) =>
    p.type === 'quote' ? `<blockquote>${esc(p.text)}</blockquote>` : `<p>${esc(p.text)}</p>`
  ).join('') : '';
  (mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement).innerHTML = `
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <div class="bz-clip-mob-d-meta"><span class="bz-clip-favchip">${esc(a.srcName.slice(0, 1))}</span><span>${esc(a.srcName)}</span><span class="bz-clip-mob-d-time">${esc(a.timeText || relTime(a.timeTs))}</span></div>
    <div class="bz-clip-art-flag ${flagCls}">${iconSpan(a.st === 'saved' ? 'check' : a.st === 'reading' ? 'book-open' : 'mail', 'bz-ic--xs')}${stLabel}</div>
    ${a.summary ? `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan('sparkles', 'bz-ic--xs')}摘要</span>${esc(a.summary)}</div>` : ''}
    <div class="bz-clip-art-md">${paras || `<p class="dim">${esc(a.origin === 'clip' ? '（剪藏笔记正文请在 Obsidian 中打开）' : '正文已清空')}</p>`}</div>
  `;
}

// ================= 设置 schema（ADR-0064 声明式；settings-panel 域清单挂载） =================
export function clipbookSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '基础',
        rows: [
          { type: 'path', mode: 'single', name: '剪藏目录', desc: '存放网页剪藏文章的文件夹', binding: { key: 'articleDirectory' } },
          batchSizeRow('articleBatchSize'),
        ],
      },
      {
        icon: 'sparkles',
        name: '智能',
        rows: [
          {
            type: 'toggle', name: '自动摘要', desc: '新剪藏的文章自动生成 AI 摘要', binding: { key: 'autoSummaryEnabled' },
            onChange: (v: boolean) => {
              if (v) ensureAutoSummary(getApp());
              else stopAutoSummary();
            },
          },
          { type: 'select', name: '摘要长度', desc: '控制生成的摘要详略程度', binding: { key: 'autoSummaryLength' }, options: [
            { value: 'simple', label: '简短（50-100 字）' },
            { value: 'standard', label: '标准（150-250 字）' },
            { value: 'detailed', label: '详细（300-400 字）' },
          ], visibleWhen: (s: any) => s.autoSummaryEnabled === true, isChild: true },
          { type: 'toggle', name: '生成标签', desc: '为剪藏生成中文标签', binding: { key: 'autoSummaryTagsEnabled' }, visibleWhen: (s: any) => s.autoSummaryEnabled === true, isChild: true },
          { type: 'text', name: '标签数量', desc: '生成的标签个数写成区间，如 3-6', binding: { key: 'autoSummaryTagCount' }, visibleWhen: (s: any) => s.autoSummaryEnabled === true && s.autoSummaryTagsEnabled === true, isChild: true },
          { type: 'select', name: '摘要时机', desc: '保存后立刻生成，或仅打开文件时才补全', binding: { key: 'autoSummaryTiming' }, options: [
            { value: 'immediate', label: '保存后立刻' },
            { value: 'lazy', label: '懒触发（打开时）' },
          ], visibleWhen: (s: any) => s.autoSummaryEnabled === true, isChild: true },
        ],
      },
      {
        icon: 'radio',
        name: '数据源',
        rows: [
          { type: 'custom', render: (body: HTMLElement, ctx: any) => buildNewsSourcesGroup(body, ctx.refreshVisibility) },
        ],
      },
      mobileFullscreenGroup('clipbookMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}

/** 打开剪藏本设置弹窗（域内 ⚙️ 无头行按钮——设置面板域已聚合；入口仅设置面板与命令） */
export function openSettings(app: any): void {
  const schema = clipbookSettingsSchema();
  // 适配 core/settings-modal 签名（title/maxWidth/schema/onClose）
  openSettingsModal({
    title: '剪藏本设置',
    maxWidth: 560,
    schema,
    onClose: () => {
      // 目录变更检测：重设 M.dir 并全量重载
      const s = tryGetSettings() as any;
      const next = ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
      if (next !== M.dir) {
        M.dir = next;
        M.clipNotes = null;
        M.clipUrls = new Set();
        void reloadIfOpen();
      }
    },
  });
}
