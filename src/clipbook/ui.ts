/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：主面板 UI。
 *
 * 桌面三栏（rail 源列表 / 中栏条目 / 右栏阅读）+ 移动端双屏（源胶囊列表 / 详情+头栏保存钮）。
 * 对齐拍板原型 clipping-p3-siteboxes.html 的结构与极简口味：头行仅品牌+标题+副题「未读流与剪藏」，
 * 无右上角图标（关闭=点遮罩/ESC；移动真全屏有 ✕）；动作收进条目右键菜单（item-actions 复用）；
 * 「阅读分析数据」沉底左栏底部。
 *
 * 增强包（enh-clipbook）：桌面搜索（180ms 防抖）/ 移动长按抽屉（动作与桌面右键同源）/
 * 右栏读剪藏正文（cachedRead + 缓存）/ rail 源行批量已读 / 误删误标可撤销（notifyUndo）/
 * 阅读动线（10s 自动落在读、处理后前进下一篇、←→/jk 切换）/ 阅读字号三档 /
 * 桌面面板拖拽缩放 + 尺寸记忆（ADR-0084 先例）。
 *
 * 铁律 6：基线全部消费组件库（.bz-* 类与 --bz-* token）；本文件只管布局骨架 + 交互，
 * 域独有视觉在 styles.css（.bz-clip-*）。
 */
import { getApp } from '../core/app';
import { notice, notifyUndo } from '../core/notice';
import { uiIcon, uiSegmented, uiResizable } from '../core/ui';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { escManager } from '../core/esc-manager';
import { topifyZ, createSiteIcon } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { attachItemActions, closeItemMenu, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { openSettingsModal } from '../core/settings-modal';
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { ensureAutoSummary, stopAutoSummary } from '../auto-summary';
import { buildNewsSourcesGroup } from './news-sources-group';
import { batchSizeRow, mobileFullscreenGroup } from '../core/settings-common';
import type { ClipArticle } from './types';
import { esc } from './constants';
import { toParagraphs, stripClipChrome } from './md';
import { queryBySource } from './store';
import { M, resetClipbookState } from './state';
import { readNewsAndSidecar, clipDir } from './loader';
import {
  flowSave, flowMarkRead, flowToggleReading, flowDeleteNews, setReadingSession, pauseReadingSession,
  flowMarkAllRead, flowUndoHandled, flowUndoDeleteNews,
} from './flow';
import type { ClipNote } from './scan';

// ================= 模块级 UI 引用 =================
let overlayEl: HTMLElement | null = null;
let railListEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let readerEl: HTMLElement | null = null;
let readPaneEl: HTMLElement | null = null; // .bz-clip-read（键盘导航/打开笔记委托的常驻容器）
let mobSourcesEl: HTMLElement | null = null;
let mobListEl: HTMLElement | null = null;
let mobDetailEl: HTMLElement | null = null;
let mobTitleEl: HTMLElement | null = null;
let mobSaveBtnEl: HTMLElement | null = null;
let analyBtnEl: HTMLElement | null = null;
let mobSearchbarEl: HTMLElement | null = null;
let deskSearchEl: HTMLInputElement | null = null; // 桌面搜索输入
let escKey = '';
let escHandle: { unregister(): void } | null = null;
let escRegistered = false;
let loading = false;
let dirty = false; // 数据变化待刷标志（目录事件回调期）
let loaded = false; // C5：本次会话是否已成功装载过（false = 首开必须装载）

// ================= 增强包常量与状态 =================
const SEARCH_DEBOUNCE_MS = 180; // 对齐保险库/待办
let AUTO_READING_MS = 10000; // 右栏停留超 10s 自动落「在读」（测试可缩短）
const PANEL_MIN_W = 760; // 桌面缩放钳制（三栏骨架最小可读宽度）
const PANEL_MIN_H = 520;
const PANEL_MAX_W = 1600;
const PANEL_MAX_H = 1000;
/** 剪藏正文缓存（notePath → 剥 frontmatter 后正文；clipping:file-* 目录事件失效） */
const clipBodyCache = new Map<string, string>();
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let autoReadingTimer: ReturnType<typeof setTimeout> | null = null;
let panelResizeDetach: { detach: () => void } | null = null;
let pendingSizeTimer: ReturnType<typeof setTimeout> | null = null;

/** 测试钩子：缩短自动落「在读」的停留阈值（真机恒 10s） */
export function __autoReadingDelayForTests(ms: number): void {
  AUTO_READING_MS = ms;
}

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
  // C5/ADR-0063：已装载且无目录事件（!dirty）直接用内存缓存渲染——零扫描瞬时显示；
  // 首开未装载或有变更才异步重读
  if (dirty || !loaded) void loadIfNeeded();
  else renderAll();
}

/** 装载（防重入 + 首载后保留内存面，目录事件增量走 reloadIfOpen） */
let loadPromise: Promise<void> | null = null;
function loadIfNeeded(): Promise<void> {
  if (loading) return loadPromise || Promise.resolve();
  if (!M.open && overlayEl) return Promise.resolve();
  loading = true;
  loadPromise = readNewsAndSidecar()
    .then(() => { dirty = false; loaded = true; renderAll(); })
    .catch((e) => { console.error('[剪藏本] 装载失败', e); notice('剪藏本数据读取失败', 'error'); })
    .finally(() => { loading = false; loadPromise = null; });
  return loadPromise;
}

/** 目录文件事件触发的重载（面板隐藏期记脏不丢——C5：重开时按需重读而非丢弃事件后全量重扫） */
export function reloadIfOpen(): void {
  dirty = true;
  if (!M.open) return;
  void loadIfNeeded();
}

/** 关闭面板（隐藏 overlay；DOM 保留——重开零扫描复用缓存；unloadPanel 才移除） */
export function closePanel(): void {
  pauseReadingSession();
  disarmAutoReading();
  flushPendingSize(); // 防抖窗口内关闭：立即落盘面板尺寸（照 todo T2）
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
  disarmAutoReading();
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  if (panelResizeDetach) {
    panelResizeDetach.detach();
    panelResizeDetach = null;
  }
  flushPendingSize();
  clipBodyCache.clear();
  M.open = false;
  M.mobDetailOpen = false;
  loading = false;
  loadPromise = null;
  dirty = false;
  loaded = false;
  if (overlayEl) overlayEl.remove();
  overlayEl = null;
  readerEl = null;
  readPaneEl = null;
  railListEl = null;
  listEl = null;
  mobListEl = null;
  mobSourcesEl = null;
  mobDetailEl = null;
  mobSearchbarEl = null;
  deskSearchEl = null;
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
          <div class="bz-clip-head-sub">未读流与剪藏</div>
          <div class="bz-clip-head-sp"></div>
          <div class="bz-clip-search">${iconSpan('search')}<input class="bz-input" type="text" data-clip-desk-search placeholder="搜索标题、摘要、站点、标签"></div>
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
          <div class="bz-clip-read" data-clip-read-pane tabindex="0">
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
  readPaneEl = overlayEl.querySelector('[data-clip-read-pane]');
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
  deskSearchEl = overlayEl.querySelector('[data-clip-desk-search]') as HTMLInputElement;

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
  // 桌面搜索（enh 包 1）：180ms 防抖对齐保险库/待办
  deskSearchEl!.addEventListener('input', () => {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      setSearchKw(deskSearchEl ? deskSearchEl.value.trim() : '');
      renderList();
      renderRail();
    }, SEARCH_DEBOUNCE_MS);
  });
  // 右栏常驻委托（enh 包 3/6c）：「打开笔记」点击 + ←→/jk 条目切换（字号分段内按键不劫持）
  readPaneEl!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-clip-open-note]') && M.cur) openNote(M.cur);
  });
  readPaneEl!.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('.bz-segmented')) return; // 字号分段方向键归组件库
    if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); stepArticle(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); stepArticle(1); }
  });
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
  const frameEl = overlayEl.querySelector('.bz-clip-frame') as HTMLElement;
  applyMobileWindowFullscreen(frameEl, mobileFullscreenDefault());
  // 桌面面板拖拽缩放 + 尺寸记忆（enh 包 8，照 todo ADR-0084 先例）：仅桌面写内联宽高——
  // 内联样式优先级高于移动端媒体查询的满屏规则；uiResizable 自身对触屏也空操作兜底
  if (!isMobileEnv()) {
    const saved = savedPanelSize();
    frameEl.style.width = `${saved.w}px`;
    frameEl.style.height = `${saved.h}px`;
    panelResizeDetach = uiResizable(frameEl, {
      minW: PANEL_MIN_W, minH: PANEL_MIN_H, maxW: PANEL_MAX_W, maxH: PANEL_MAX_H,
      onChange: (w, h) => rememberPanelSize(w, h),
    });
  }
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
  if (deskSearchEl) deskSearchEl.value = '';
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

// ================= 视图派生 =================
function srcList(): { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' } {
  const s = M.sel;
  if (s.kind === 'clip') return { kind: 'clip' };
  if (s.kind === 'inbox') return { kind: 'inbox', platform: s.platform, up: s.up || undefined };
  return { kind: 'all' };
}

function currentList(): ClipArticle[] {
  return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], srcList(), M.upInfo);
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
/** data-src JSON 序列化选择器（UP 行携带 platform=B站 + up=uid） */
type SrcSelJson = { kind: 'all' } | { kind: 'inbox'; platform: string; up: string | null } | { kind: 'clip' };

function railItemHtml(sel: SrcSelJson, label: string, count: number, unread: number, icon: string | null, color: string | null, active: boolean, sub?: string): string {
  // G：JSON 过 esc 再进单引号属性——UP 主名含单引号时原实现提前闭合属性，点击 JSON.parse 抛错该源失效
  return `
    <div class="bz-clip-rail-row${active ? ' on' : ''}" data-src='${esc(JSON.stringify(sel))}' title="${esc(label)}">
      ${icon === 'feed'
        ? `<span class="bz-clip-rail-badge" style="--rail-c:${color || '#58a6ff'}">${esc(sub || label.slice(0, 1))}</span>`
        : icon === 'bili'
          ? `<span class="bz-clip-rail-badge bili" style="--rail-c:${color || '#58a6ff'}">${esc(sub || label.slice(0, 1))}</span>`
          : icon === 'clip'
            ? `<span class="bz-clip-rail-ic">${iconSpan('scissors')}</span>`
            : `<span class="bz-clip-rail-ic ${sel.kind === 'all' ? 'accent' : ''}">${icon ? iconSpan(icon) : ''}</span>`}
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
  let html = railItemHtml({ kind: 'all' }, '全部未读', unread, 0, 'inbox', '#58a6ff', M.sel.kind === 'all', '');

  // 平台段
  const platformLabels: Array<[string, string]> = [['B站', '#e8669a'], ['果壳科学人', '#2fae8c'], ['知乎日报', '#58a6ff']];
  for (const [pfx, color] of platformLabels) {
    const cnt = arts.filter((a) => !a.read && (a.platform === pfx || (pfx === '果壳科学人' && a.platform === '果壳') || (pfx === '知乎日报' && a.platform === '知乎'))).length;
    const active = M.sel.kind === 'inbox' && M.sel.platform === pfx;
    html += railItemHtml({ kind: 'inbox', platform: pfx, up: null }, pfx, cnt, cnt, 'feed', color, active, '');
  }

  // B站 UP 展开（C2：Map 按 author/uid 去重；C6：upInfo 回填名字显示）
  const biliUps = new Map<string, string>(); // key=author 原始值（uid），value=展示名（回填回退）
  for (const a of arts) {
    if (!a.read && a.platform === 'B站' && a.author) {
      const uid = String(a.author);
      const backfilled = M.upInfo?.[uid]?.name;
      if (!biliUps.has(uid)) biliUps.set(uid, backfilled ? String(backfilled) : uid);
    }
  }
  for (const [uid, name] of biliUps) {
    const cnt = arts.filter((a) => !a.read && a.platform === 'B站' && String(a.author || '') === uid).length;
    const active = M.sel.kind === 'inbox' && M.sel.platform === 'B站' && M.sel.up === uid;
    // G：UP 行 data-src 携带 platform=B站 + up=uid（旧实现 platform=展示名、up=null，
    // 点击后按平台名过滤恒空——UP 源点开是空列表且高亮不复位）
    html += railItemHtml({ kind: 'inbox', platform: 'B站', up: uid }, name, cnt, cnt, 'bili', '#8b7cf6', active, name.slice(0, 1));
  }

  // 剪藏本（聚合，saved 语义）
  const clipActive = M.sel.kind === 'clip';
  html += railItemHtml({ kind: 'clip' }, '剪藏本', clips, 0, 'clip', '', clipActive, '');

  railListEl.innerHTML = html;
  // rail 源行动作（enh 包 4）：右键/长按出「全部标为已读」等源级批量操作——
  // rail 是导航层，动作挂在源行而非条目卡，中栏「列表零操作」拍板不被破坏
  const rows = railListEl.querySelectorAll<HTMLElement>('[data-src]');
  rows.forEach((row) => {
    let sel: any = null;
    try { sel = JSON.parse(row.dataset.src || 'null'); } catch (e) { return; }
    if (!sel) return;
    const source = sel.kind === 'clip'
      ? { kind: 'clip' as const }
      : sel.kind === 'inbox'
        ? { kind: 'inbox' as const, platform: String(sel.platform || ''), up: sel.up ? String(sel.up) : undefined }
        : { kind: 'all' as const };
    const actions = buildRailActions(String(row.title || ''), source);
    if (actions.length) attachItemActions(row, actions, { sheetTitle: String(row.title || '') });
  });
}

/** rail 源级动作（enh 包 4）：该源还有未读时提供「全部标为已读」；剪藏本源无未读语义不挂 */
function buildRailActions(label: string, source: { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' }): ItemAction[] {
  const unreadList = queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], source, M.upInfo)
    .filter((a) => a.origin === 'news');
  if (!unreadList.length) return [];
  const n = unreadList.length;
  return [{
    icon: 'check',
    label: `全部标为已读（${n} 篇）`,
    title: `把「${label}」的 ${n} 篇未读标为已读`,
    onClick: () => void markAllRead(label, unreadList),
  }];
}

/** 批量已读：确认框写明 N 篇 → 单次读改写落盘 */
async function markAllRead(label: string, items: ClipArticle[]): Promise<void> {
  const ok = await openFlowDialog({
    title: '全部标为已读',
    message: `将把「${label}」的 ${items.length} 篇未读全部标为已读。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: `全部已读（${items.length} 篇）`, value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  await flowMarkAllRead(items.map((a) => a.raw).filter(Boolean));
  notice(`已把 ${items.length} 篇标为已读`, 'success');
  await refreshAfterAction();
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
    // G：切到空源清当前阅读——M.cur 残留上一源文章会被 renderReader/mob 详情再渲染
    M.cur = null;
    if (readerEl) renderReader();
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
  // news 条目（C3：原「移出剪藏本」分支已删——收件流 filter 剔除 saved 后该动作永不可达；
  // 剪藏本视图对已存条目提供「删除」，语义空间已覆盖）
  if (a.st !== 'saved') {
    out.push({ icon: 'download', label: '保存到剪藏本', title: '保存为正式剪藏', onClick: () => void doSave(a) });
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
function paragraphsHtml(body: string): string {
  return toParagraphs(body).map((p) =>
    p.type === 'quote'
      ? `<blockquote>${esc(p.text)}</blockquote>`
      : `<p>${esc(p.text)}</p>`
  ).join('');
}

function renderReader(): void {
  if (!readerEl) return;
  const a = M.cur;
  applyReaderFontSize();
  if (!a) {
    readerEl.innerHTML = `<div class="bz-clip-read-empty">${iconSpan('book-open')}<span>从列表选择一篇文章开始阅读</span></div>`;
    return;
  }
  setReadingSession(a.id);
  armAutoReading(a);
  const stLabel = a.st === 'saved' ? '已保存' : a.st === 'reading' ? '在读' : a.st === 'read' ? '已读' : '未读';
  const flagCls = a.st === 'saved' ? 'ok' : a.st === 'reading' ? 'warn' : 'info';
  const siteIcon = a.domain ? siteIconHtml(a.domain) : favChip(a.site);
  // 正文（enh 包 3）：news 现算；clip 懒加载 cachedRead → 剥 frontmatter → 段落化，按 path 缓存
  let paras = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    paras = cached !== undefined ? paragraphsHtml(cached) : `<p class="dim">正在读取剪藏正文…</p>`;
  } else {
    paras = a.body ? paragraphsHtml(a.body) : '';
  }
  // 「打开笔记」主按钮（enh 包 3：右栏读剪藏正文后保留笔记入口）
  const openNoteBtn = a.origin === 'clip' && a.notePath
    ? `<div class="bz-clip-art-actions"><button class="bz-btn bz-btn--primary bz-btn--sm" data-clip-open-note type="button">${iconSpan('external-link', 'bz-ic--xs')}打开笔记</button></div>`
    : '';

  readerEl.innerHTML = `
    <div class="bz-clip-art-site">${siteIcon}<span class="bz-clip-art-site-name">${esc(a.srcName)}</span>${a.typeLabel ? `<span class="bz-clip-art-type">${esc(a.typeLabel)}</span>` : ''}</div>
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(a.timeText || relTime(a.timeTs))}</span>
      <span class="bz-clip-art-flag ${flagCls}">${iconSpan(a.st === 'saved' ? 'check' : a.st === 'reading' ? 'book-open' : 'mail', 'bz-ic--xs')}${stLabel}</span>
    </div>
    <div class="bz-clip-art-fs" data-clip-fs></div>
    ${a.summary ? `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan('sparkles', 'bz-ic--xs')}摘要</span>${esc(a.summary)}</div>` : ''}
    ${openNoteBtn}
    <div class="bz-clip-art-md" data-clip-md>${paras || `<p class="dim">${esc(a.origin === 'clip' ? '（笔记暂无正文）' : '正文已清空（已处理条目）')}</p>`}</div>
    ${a.origin === 'news' && a.url ? `<a class="bz-clip-art-origin" href="${esc(a.url)}" target="_blank" rel="noopener">查看原文 ${iconSpan('external-link', 'bz-ic--xs')}</a>` : ''}
  `;
  mountFontSizeSeg();
  if (a.origin === 'clip') void loadClipBody(a);
}

/** 剪藏正文懒加载（enh 包 3）：cachedRead → 剥 frontmatter/dataviewjs → 按 path 缓存；
 *  完成时仍是当前篇则原位填充正文（不整篇重渲染，防滚动位置重置） */
async function loadClipBody(a: ClipArticle): Promise<void> {
  const path = a.notePath;
  if (!path || clipBodyCache.has(path)) return;
  const note = a.note as ClipNote | undefined;
  if (!note || !note.file) return;
  let body = '';
  try {
    body = stripClipChrome(await getApp().vault.cachedRead(note.file));
  } catch (e) {
    if (M.cur && M.cur.id === a.id && readerEl) {
      const md = readerEl.querySelector('[data-clip-md]') as HTMLElement | null;
      if (md) md.innerHTML = `<p class="dim">正文读取失败，可打开笔记查看</p>`;
    }
    return;
  }
  clipBodyCache.set(path, body);
  if (M.cur && M.cur.id === a.id && readerEl) {
    const md = readerEl.querySelector('[data-clip-md]') as HTMLElement | null;
    if (md) md.innerHTML = body ? paragraphsHtml(body) : `<p class="dim">（笔记暂无正文）</p>`;
  }
}

/** 目录事件失效正文缓存（enh 包 3；index.ts registerAutoRefresh 调用） */
export function invalidateClipBodyCache(path: string): void {
  clipBodyCache.delete(String(path || ''));
}

// ---- 阅读字号三档（enh 包 7：小/中/大，settings 记忆） ----
function readerFontSize(): 'small' | 'medium' | 'large' {
  const v = String((tryGetSettings() as any)?.clipbookReaderFontSize || '');
  return v === 'small' || v === 'large' ? (v as 'small' | 'large') : 'medium';
}

function applyReaderFontSize(): void {
  if (!readerEl) return;
  const fs = readerFontSize();
  readerEl.classList.toggle('fs-sm', fs === 'small');
  readerEl.classList.toggle('fs-lg', fs === 'large');
}

function mountFontSizeSeg(): void {
  const holder = readerEl ? (readerEl.querySelector('[data-clip-fs]') as HTMLElement | null) : null;
  if (!holder) return;
  const seg = uiSegmented<string>({
    options: [
      { value: 'small', label: '小' },
      { value: 'medium', label: '中' },
      { value: 'large', label: '大' },
    ],
    value: readerFontSize(),
    label: '阅读字号',
    onChange: (v) => {
      const s = getSettings() as any;
      s.clipbookReaderFontSize = v;
      void saveSettings();
      applyReaderFontSize();
    },
  });
  seg.el.classList.add('bz-segmented--sm');
  holder.appendChild(seg.el);
}

// ---- 阅读动线（enh 包 6）：自动落「在读」+ ←→/jk 切换 ----

/** 右栏停留超 AUTO_READING_MS 自动落「在读」（可手动覆盖：手动标已读/取消后 st 变化即不生效） */
function armAutoReading(a: ClipArticle): void {
  disarmAutoReading();
  if (!M.open || a.origin !== 'news' || a.st !== 'unread') return;
  autoReadingTimer = setTimeout(() => {
    autoReadingTimer = null;
    void autoMarkReading(a.id);
  }, AUTO_READING_MS);
}

function disarmAutoReading(): void {
  if (autoReadingTimer) {
    clearTimeout(autoReadingTimer);
    autoReadingTimer = null;
  }
}

async function autoMarkReading(id: string): Promise<void> {
  if (!M.open || !M.cur || M.cur.id !== id) return;
  const cur = currentList().find((x) => x.id === id);
  if (!cur || cur.origin !== 'news' || cur.st !== 'unread') return; // 已被手动处理 → 不抢
  await flowToggleReading(cur);
  await readNewsAndSidecar();
  const next = currentList().find((x) => x.id === id);
  if (next) M.cur = next;
  renderList();
  renderRail();
  renderReader();
}

/** ←→/jk 条目切换（右栏聚焦时；列表顺序即阅读顺序） */
function stepArticle(delta: number): void {
  const list = currentList();
  if (!list.length) return;
  const idx = M.cur ? list.findIndex((x) => x.id === M.cur!.id) : -1;
  const nextIdx = idx === -1 ? 0 : Math.min(list.length - 1, Math.max(0, idx + delta));
  const next = list[nextIdx];
  if (next && (!M.cur || next.id !== M.cur.id)) selectArticle(next.id);
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

async function doMarkRead(a: ClipArticle | null): Promise<void> {
  if (!a || a.origin !== 'news') return;
  const rawBefore = { ...(a.raw || {}) }; // 动作前快照（撤销恢复 read/state/body 用）
  await flowMarkRead(a);
  notifyUndo('已标记为已读', () => void undoMarkRead(rawBefore));
  await refreshAfterAction();
}

/** 撤销标记已读（enh 包 5）：恢复动作前条目态 + 统计回退，走串行写回队列 */
async function undoMarkRead(rawBefore: any): Promise<void> {
  await flowUndoHandled(rawBefore);
  notice('已撤销：条目恢复未读', 'success');
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
    message: `确定从收件流删除「${a.title}」吗？删除后可在通知中撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  const rawBefore = { ...(a.raw || {}) }; // 动作前快照（撤销插回 news.json 用）
  await flowDeleteNews(a);
  notifyUndo('已删除', () => void undoDeleteNews(rawBefore));
  await refreshAfterAction();
}

/** 撤销删除 news 条目（enh 包 5）：raw 快照插回 news.json，走串行写回队列 */
async function undoDeleteNews(rawBefore: any): Promise<void> {
  await flowUndoDeleteNews(rawBefore);
  notice('已撤销删除：条目已恢复', 'success');
  await refreshAfterAction();
}

async function deleteClipNote(a: ClipArticle): Promise<void> {
  const ok = await openFlowDialog({
    title: '确认删除',
    message: `确定删除剪藏「${a.title}」吗？文件将移入系统回收站。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  const note = a.note as ClipNote | undefined;
  if (note && note.file) {
    try {
      const path = a.notePath || note.path || '';
      let content = '';
      try { content = await getApp().vault.cachedRead(note.file); } catch (e) { /* 快照失败也继续删 */ }
      await getApp().vault.trash(note.file, true); // 系统回收站（enh 包 5：替代硬删除）
      clipBodyCache.delete(path);
      notifyUndo('已移入回收站', () => void undoTrashClip(path, content));
      await refreshAfterAction();
    } catch (e) {
      notice('删除失败，请检查文件权限', 'error');
    }
  }
}

/** 撤销删除剪藏笔记（enh 包 5）：按动作前内容快照在原路径重建 */
async function undoTrashClip(path: string, content: string): Promise<void> {
  if (!path) return;
  try {
    await getApp().vault.create(path, content);
    clipBodyCache.delete(path);
    notice('已撤销删除：剪藏已恢复', 'success');
    await refreshAfterAction();
  } catch (e) {
    notice('撤销失败：原路径已存在同名文件', 'error');
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

/**
 * 动作后刷新（数据面 + 列表 + rail 计数 + 阅读区）。
 * 阅读动线（enh 包 6b）：条目被处理/删除后前进到同位置下一篇（原位补位，不打断扫读）；
 * 仍在列表（如「在读」切换）则保持选中并刷新引用。
 */
async function refreshAfterAction(): Promise<void> {
  const prevIdx = M.cur ? currentList().findIndex((x) => x.id === M.cur!.id) : -1;
  await readNewsAndSidecar();
  const list = currentList();
  if (M.cur && list.some((x) => x.id === M.cur!.id)) {
    M.cur = list.find((x) => x.id === M.cur!.id) || M.cur;
  } else if (list.length) {
    M.cur = list[Math.min(Math.max(prevIdx, 0), list.length - 1)];
  } else {
    M.cur = null;
  }
  renderAll();
}

// ================= 面板尺寸记忆（enh 包 8，照 todo ADR-0084 先例） =================

/** 记忆尺寸安全读取（0=未拖过 → 走默认 1180×760；越界值钳到硬上限 + 视口 92%） */
function savedPanelSize(): { w: number; h: number } {
  const s = tryGetSettings() as any;
  const w = Number(s?.clipbookPanelWidth) || 0;
  const h = Number(s?.clipbookPanelHeight) || 0;
  const defW = 1180;
  const defH = 760;
  if (w < PANEL_MIN_W || h < PANEL_MIN_H) return { w: defW, h: defH };
  const capW = Math.min(PANEL_MAX_W, Math.floor(window.innerWidth * 0.92));
  const capH = Math.min(PANEL_MAX_H, Math.floor(window.innerHeight * 0.92));
  return { w: Math.min(w, capW), h: Math.min(h, capH) };
}

/** 拖动期间 trailing 防抖 150ms 落盘一次（拖一次边界不写几十次 settings） */
function rememberPanelSize(w: number, h: number): void {
  const s = tryGetSettings() as any;
  if (!s) return;
  s.clipbookPanelWidth = w;
  s.clipbookPanelHeight = h;
  if (pendingSizeTimer !== null) clearTimeout(pendingSizeTimer);
  pendingSizeTimer = setTimeout(() => {
    pendingSizeTimer = null;
    void saveSettings();
  }, 150);
}

function flushPendingSize(): void {
  if (pendingSizeTimer !== null) {
    clearTimeout(pendingSizeTimer);
    pendingSizeTimer = null;
    void saveSettings();
  }
}

// ================= 渲染：移动 =================
function mobSrcChipHtml(sel: SrcSelJson, label: string, unread: number, active: boolean, icon: string | null, sub?: string): string {
  return `
    <div class="bz-clip-mob-src${active ? ' on' : ''}" data-src='${esc(JSON.stringify(sel))}'>
      ${icon === 'feed' ? `<span class="bz-clip-favchip sm">${esc(sub || label.slice(0, 1))}</span>` : ''}
      <span>${esc(label)}</span>
      ${unread ? `<span class="bz-clip-mob-ub">${unread}</span>` : ''}
    </div>`;
}

function renderMobSources(): void {
  if (!mobSourcesEl) return;
  const arts = M.articles;
  let html = mobSrcChipHtml({ kind: 'all' }, '全部未读', arts.filter((a) => !a.read).length, M.sel.kind === 'all', 'radio');
  // 平台三 chip + B站 UP chip
  for (const pfx of ['B站', '果壳科学人', '知乎日报']) {
    const cnt = arts.filter((a) => !a.read && (a.platform === pfx || (pfx === '果壳科学人' && a.platform === '果壳') || (pfx === '知乎日报' && a.platform === '知乎'))).length;
    html += mobSrcChipHtml({ kind: 'inbox', platform: pfx, up: null }, pfx, cnt, M.sel.kind === 'inbox' && M.sel.platform === pfx, 'feed', pfx.slice(0, 1));
  }
  // B站 UP chip（C2：Map 按 author/uid 去重——原同 UP N 条未读渲染 N 个同名 chip；C6：upInfo 回填名）
  const mobUps = new Map<string, string>();
  for (const a of arts) {
    if (a.read || a.platform !== 'B站' || !a.author) continue;
    const uid = String(a.author);
    const backfilled = M.upInfo?.[uid]?.name;
    if (!mobUps.has(uid)) mobUps.set(uid, backfilled ? String(backfilled) : uid);
  }
  for (const [uid, name] of mobUps) {
    const cnt = arts.filter((x) => !x.read && x.platform === 'B站' && String(x.author || '') === uid).length;
    if (cnt === 0) continue;
    html += mobSrcChipHtml({ kind: 'inbox', platform: 'B站', up: uid }, name, cnt, M.sel.kind === 'inbox' && M.sel.platform === 'B站' && M.sel.up === uid, 'bili', name.slice(0, 1));
  }
  html += mobSrcChipHtml({ kind: 'clip' }, '剪藏本', 0, M.sel.kind === 'clip', 'clip');
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
  // 移动长按抽屉（enh 包 2）：动作构建器与桌面右键同源（buildItemActions）——
  // 一处接入两端全量对齐（手册 §8.2：不得在移动端隐藏功能）；单击进详情走容器委托不受影响
  const cards = mobListEl.querySelectorAll<HTMLElement>('[data-id]');
  cards.forEach((card) => {
    const art = list.find((x) => x.id === card.dataset.id);
    if (!art) return;
    attachItemActions(card, buildItemActions(art), { sheetHead: buildSheetHead(art) });
  });
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
    // C9：剪藏来源条目不显示保存钮（doSave 对 origin!=='news' 静默 return——原为点了无反馈的假按钮）
    mobSaveBtnEl.style.display = a.origin !== 'news' ? 'none' : '';
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
          { type: 'number', name: '面板宽度记忆', desc: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', binding: { key: 'clipbookPanelWidth' }, min: 0, step: 10 },
          { type: 'number', name: '面板高度记忆', desc: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', binding: { key: 'clipbookPanelHeight' }, min: 0, step: 10 },
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
          ], visibleWhen: (s: any) => s.autoSummaryEnabled === true, isChild: true,
          // 时机变更即时生效：重注册监听（lazy↔immediate 切换无需重启；对齐上方自动摘要开关）
          onChange: () => {
            stopAutoSummary();
            ensureAutoSummary(getApp());
          } },
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
