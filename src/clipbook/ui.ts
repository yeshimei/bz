/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：主面板 UI。
 *
 * 桌面三栏（rail 源列表 / 中栏条目 / 右栏阅读）+ 移动端双屏（源胶囊列表 / 详情+头栏保存钮）。
 * 对齐拍板定稿原型 p1-final.html 的编辑部印刷风（issue 214）：头行 = 品牌 + 期号行（无副题），
 * 无右上角图标（关闭=点遮罩/ESC；移动真全屏有 ✕）；动作收进条目右键菜单（item-actions 复用）；
 * 搜索框在左栏列表顶部（issue 206：从头行移入 rail，搜索时各源统计联动）；
 * 左栏 = 10 版对照拍板的 V1 点线索引（衬线名 + 点线 + 未读/总数）；
 * 中栏目录序号制（未读唯一视觉 = 序号颜色，未读在前）；阅读面无底部动作（剪藏保留「打开笔记」文字脚）。
 *
 * 增强包（enh-clipbook）：桌面搜索（180ms 防抖）/ 移动长按抽屉（动作与桌面右键同源）/
 * 右栏读剪藏正文（cachedRead + 缓存）/ rail 源行批量已读 / 误删误标可撤销（notifyUndo）/
 * 阅读动线（10s 自动落在读、处理后前进下一篇、←→/jk 切换）/ 阅读字号三档 /
 * 桌面面板拖拽缩放 + 尺寸记忆（ADR-0084 先例；ADR-0094 走 uiResizable persist）。
 * issue 206：rail 平台动态聚合 + 列表最新在前 / 正文图片段渲染 /
 * 站点 favicon 高清多源回退（全失败才首字 chip）/ 切文章右栏滚动归零。
 * issue 222：rail 换按 site 属性分类（平台聚合行退役，B站 UP 子行/剪藏本行保留）/
 * 中右栏 uiVSplitter 分割线拖宽 + clipbookMidWidth 尺寸记忆。
 *
 * 铁律 6：基线全部消费组件库（.bz-* 类与 --bz-* token）；ADR-0094 起面板壳/头行/搜索/
 * rail/横滑条/空态/尺寸记忆收编共享层，本文件只管布局骨架 + 交互，
 * 域独有视觉在 styles.css（.bz-clip-*）。
 *
 * issue 247：markup 单源化（ADR-0104）——面板骨架/rail 行/目录条目/阅读面/移动端
 * markup 全部出自 render.ts（纯层，原型 × 插件一份），本文件只管生命周期/事件委托/
 * 数据流；行为单源（ADR-0106）经 fake-sim.ts 打进评审壳 prototype.html（alias obsidian→fake）。
 */
import { getApp } from '../core/app';
import { notice, notifyUndo } from '../core/notice';
import { uiSegmented, uiEmpty, uiResizable, uiVSplitter, mountIcons } from '../core/ui';
import { formatRelativeTime } from '../core/utils';
import { isMobileEnv } from '../core/mobile';
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { attachItemActions, closeItemMenu, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { openSettingsModal } from '../core/settings-modal';
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { ensureAutoSummary, stopAutoSummary, regenerateSummary } from '../auto-summary';
import { dataSourceGroupRows } from './news-sources-group';
import { readDataSourceState, type DataSourceState } from './news-source-settings';
import { batchSizeRow } from '../core/settings-common';
import type { ClipArticle } from './types';
import { toParagraphs, stripClipChrome } from './md';
import { queryBySource, aggregateSites } from './store';
import {
  panelHtml, railItemHtml, railFootHtml, tocListHtml, paragraphsHtml as paragraphsMarkup,
  clipLoadingHtml, readerHtml, mobListHtml, mobDetailHtml, mobTocHtml, type MobChapter, siteTint,
  iconSpan, type SrcSelJson,
} from './render';
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
let railFootEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let readerEl: HTMLElement | null = null;
let readPaneEl: HTMLElement | null = null; // .bz-clip-read（键盘导航/打开笔记委托的常驻容器）
let mobListEl: HTMLElement | null = null;
let mobDetailEl: HTMLElement | null = null;
let mobTitleEl: HTMLElement | null = null;
let mobSaveBtnEl: HTMLElement | null = null;
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
let panelResizeDetach: { detach: () => void; flush: () => void } | null = null;
let panelSplit: { el: HTMLElement; restore: () => void; flush: () => void; detach: () => void } | null = null;
/** 分割线钳制：中栏（目录）最小宽 / 右栏（阅读）最小宽（对齐 PANEL_MIN_W 下整体不溢出） */
const SPLIT_MIN_MID = 220;
const SPLIT_MIN_READ = 320;

/** 测试钩子：缩短自动落「在读」的停留阈值（真机恒 10s） */
export function __autoReadingDelayForTests(ms: number): void {
  AUTO_READING_MS = ms;
}

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
  panelSplit?.restore(); // 分割线尺寸记忆（容器可见后 restore 才能按实际宽度钳制）
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

/**
 * 打开剪藏本面板并定位到指定剪藏笔记（enh-autosum 包 3：自动摘要完成通知「查看」入口）。
 * 切「剪藏本」源（剪藏条目仅出现在该源）→ 面板装载完成后选中该条（中栏高亮 + 右栏阅读）。
 * 定位失败（路径不在剪藏目录/装载失败）保持面板打开，不抛错。
 */
export async function revealClipArticle(notePath: string): Promise<void> {
  const p = String(notePath || '');
  if (!p) return;
  selectSource({ kind: 'clip' });
  showPanel();
  if (loading && loadPromise) {
    try {
      await loadPromise;
    } catch (e) {
      /* 装载失败保持空态，不阻断定位 */
    }
  }
  const a = currentList().find((x) => x.id === 'clip:' + p);
  if (a) selectArticle(a.id);
}

/** 关闭面板（隐藏 overlay；DOM 保留——重开零扫描复用缓存；unloadPanel 才移除） */
export function closePanel(): void {
  pauseReadingSession();
  disarmAutoReading();
  panelResizeDetach?.flush(); // 关面板即落盘面板尺寸（review P2：恢复旧 flushPendingSize 语义）
  panelSplit?.flush(); // 关面板即落盘分割线宽度（同上语义）
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
    panelResizeDetach.detach(); // detach 内补落未存的防抖尾值（persist 收尾）
    panelResizeDetach = null;
  }
  if (panelSplit) {
    panelSplit.detach(); // detach 内补落未存的防抖尾值（persist 收尾）
    panelSplit = null;
  }
  clipBodyCache.clear();
  setSearchKw(''); // 卸载清搜索词（模块级变量，泄漏会污染下一次装载的列表/rail 计数）
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
  railFootEl = null;
  listEl = null;
  mobListEl = null;
  mobDetailEl = null;
  mobSearchbarEl = null;
  deskSearchEl = null;
  expandedMobArch.clear(); // 面板重开折叠态复位（会话内详情往返不丢）
  mobItemById = new Map();
  resetClipbookState();
}

// ================= DOM 构建 =================
function buildDom(app: any): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'bz-panel-overlay';
  overlayEl.style.display = 'none';
  // 面板骨架 markup 单源 render.ts（issue 247）：桌面三栏 + 移动双屏 + 移动详情 overlay
  // （isMobileEnv 决定显示哪套，CSS 媒体查询兜底隐藏）
  overlayEl.innerHTML = panelHtml();
  mountIcons(overlayEl);
  document.body.appendChild(overlayEl);

  railListEl = overlayEl.querySelector('[data-clip-rail]');
  railFootEl = overlayEl.querySelector('[data-clip-rail-foot]');
  listEl = overlayEl.querySelector('[data-clip-list]');
  readerEl = overlayEl.querySelector('[data-clip-reader]');
  readPaneEl = overlayEl.querySelector('[data-clip-read-pane]');
  mobListEl = overlayEl.querySelector('[data-clip-mob-list]');
  mobDetailEl = overlayEl.querySelector('[data-clip-mob-detail]');
  mobTitleEl = overlayEl.querySelector('[data-clip-mob-title]');
  mobSaveBtnEl = overlayEl.querySelector('[data-clip-mob-save]');
  const mobSearchBtn = overlayEl.querySelector('[data-clip-mob-search]');
  const mobCloseBtn = overlayEl.querySelector('[data-clip-mob-close]');
  const mobBackBtn = overlayEl.querySelector('[data-clip-mob-back]');
  mobSearchbarEl = overlayEl.querySelector('[data-clip-mob-searchbar]') as HTMLElement;
  const mobSearchbar = mobSearchbarEl;
  const mobInput = overlayEl.querySelector('[data-clip-mob-input]') as HTMLInputElement;
  deskSearchEl = overlayEl.querySelector('[data-clip-desk-search]') as HTMLInputElement;

  // 头行无按钮（issue 214 三轮用户拍板：去 ⚙/✕，关闭 = 点遮罩/ESC）；设置走命令/设置面板
  // 点遮罩关闭（桌面无关闭钮）
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closePanel();
  });
  // 桌面 rail 源切换（再点已选源回「全部未读」，issue 208）
  railListEl!.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('[data-src]') as HTMLElement | null;
    if (!row) return;
    toggleSource(JSON.parse(row.dataset.src || 'null'));
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
  // 移动：搜索切换
  mobSearchBtn!.addEventListener('click', () => {
    const show = mobSearchbarEl!.style.display === 'none';
    mobSearchbarEl!.style.display = show ? '' : 'none';
    if (show) mobInput!.focus();
    else { mobInput!.value = ''; setSearchKw(''); renderMobToc(); }
  });
  mobInput!.addEventListener('input', () => {
    searchKw = mobInput!.value.trim();
    renderMobToc(); // 搜索态：命中全平铺（含已收），折叠不生效
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
  // 移动详情「打开笔记」文字脚（issue 248，对齐桌面 openNote）
  mobDetailEl!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-clip-open-note]') && M.cur) openNote(M.cur);
  });

  // ESC
  escKey = 'bz-clipbook';
  escHandle = escManager.register(escKey, {
    isVisible: () => !!overlayEl && overlayEl.style.display !== 'none',
    close: () => closePanel(),
  });
  escRegistered = true;
  const frameEl = overlayEl.querySelector('.bz-clip-frame') as HTMLElement;
  // 桌面面板拖拽缩放 + 尺寸记忆（enh 包 8 → ADR-0094 persist 选项）：仅桌面写内联宽高——
  // 内联样式优先级高于移动端媒体查询的满屏规则；恢复/防抖落盘/收尾补存全由 uiResizable 承担
  // （挂载时 load 恢复并钳制、onChange 后防抖 300ms 调 save、detach 未落尾值立即补存）；
  // uiResizable 自身对触屏也空操作兜底
  if (!isMobileEnv()) {
    panelResizeDetach = uiResizable(frameEl, {
      minW: PANEL_MIN_W, minH: PANEL_MIN_H, maxW: PANEL_MAX_W, maxH: PANEL_MAX_H,
      persist: { load: savedPanelSize, save: rememberPanelSize },
    });
    // 中栏 ⇄ 右栏分割线（issue 222）：拖动改中栏定宽、右栏弹性吸收；
    // restore 在 showPanel 面板可见后调（display:none 容器宽度为 0 无法钳制）
    const midEl = overlayEl.querySelector('.bz-clip-mid') as HTMLElement;
    const readEl = overlayEl.querySelector('.bz-clip-read') as HTMLElement;
    panelSplit = uiVSplitter({
      left: midEl, right: readEl,
      minLeft: SPLIT_MIN_MID, minRight: SPLIT_MIN_READ,
      persist: { load: savedSplitWidth, save: rememberSplitWidth },
    });
    midEl.insertAdjacentElement('afterend', panelSplit.el);
  }
  // 移动目录点击：折叠行收展 / 条目进详情（fold 优先判断——fold 行无 data-id；源横滑条已退役，issue 248）
  mobListEl!.addEventListener('click', (e) => {
    const fold = (e.target as HTMLElement).closest('[data-fold]') as HTMLElement | null;
    if (fold) { toggleMobArch(fold); return; }
    const item = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
    if (!item) return;
    openMobDetail(item.dataset.id || '');
  });
}

function selectSource(src: any): void {
  M.sel = {
    kind: src.kind,
    platform: String(src.platform || ''),
    up: src.up ? String(src.up) : null,
    site: String(src.site || ''),
  };
  M.mobDetailOpen = false;
  setSearchKw('');
  if (deskSearchEl) deskSearchEl.value = '';
  renderAll();
}

/** 源选择统一入口（issue 208 全域统一交互）：再点当前选中源 = 回「全部未读」；「全部未读」行点击仍走直选 */
function toggleSource(src: any): void {
  const same = src && src.kind !== 'all'
    && src.kind === M.sel.kind
    && String(src.platform || '') === M.sel.platform
    && (src.up ? String(src.up) : null) === M.sel.up
    && String(src.site || '') === M.sel.site;
  selectSource(same ? { kind: 'all' } : src);
}

/** 读当前搜索词（state 扩展占位——直接模块级变量） */
let searchKw = '';
function setSearchKw(kw: string): void { searchKw = kw; }
/** 已展开「已收」的章（site）集合（issue 248：详情往返不丢折叠态；面板重开复位） */
const expandedMobArch = new Set<string>();
/** 移动目录全量条目索引（issue 248：arch 内剪藏条目点开详情——currentList 只是当前源 news 流） */
let mobItemById = new Map<string, ClipArticle>();

// ================= 装载后全量渲染 =================
function renderAll(): void {
  if (!M.open) return;
  renderHeadIssue();
  renderRail();
  renderList();
  renderReader();
  renderMobToc();
  if (M.mobDetailOpen && M.cur) {
    // 详情保持打开态（数据刷新后重绘正文）
    renderMobDetail();
  }
}

/** 头行期号（issue 214）：「YYYY 年 M 月 D 日 · 第 N 期」，N = news 总条数（含已处理），随刷新更新 */
function renderHeadIssue(): void {
  const el = overlayEl ? (overlayEl.querySelector('[data-clip-issue]') as HTMLElement | null) : null;
  if (!el) return;
  const d = new Date();
  el.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 第 ${M.articles.length} 期`;
}

// ================= 视图派生 =================
/** 源过滤条件（queryBySource 入参别名；issue 222 加 site 源） */
type SrcFilter = { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' } | { kind: 'site'; site: string };

function srcList(): SrcFilter {
  const s = M.sel;
  if (s.kind === 'clip') return { kind: 'clip' };
  if (s.kind === 'site') return { kind: 'site', site: s.site };
  if (s.kind === 'inbox') return { kind: 'inbox', platform: s.platform, up: s.up || undefined };
  return { kind: 'all' };
}

function currentList(): ClipArticle[] {
  return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], srcList(), M.upInfo);
}

/** 搜索谓词（中栏列表过滤与 rail 计数共用——issue 206：搜索时各源统计联动） */
function matchesSearch(a: ClipArticle): boolean {
  const kw = (searchKw || '').toLowerCase();
  if (!kw) return true;
  return a.title.toLowerCase().includes(kw) ||
    a.summary.toLowerCase().includes(kw) ||
    a.site.toLowerCase().includes(kw) ||
    a.srcName.toLowerCase().includes(kw) ||
    a.author.toLowerCase().includes(kw) ||
    a.tags.some((t) => t.toLowerCase().includes(kw));
}

function listWithSearch(): ClipArticle[] {
  return currentList().filter(matchesSearch);
}

/** 编辑部目录序（issue 214）：未读在前、组内保持最新在前（稳定排序）；仅桌面目录消费，移动端维持最新在前 */
function sortedView(): ClipArticle[] {
  return [...listWithSearch()].sort((a, b) => (a.st === 'unread' ? 0 : 1) - (b.st === 'unread' ? 0 : 1));
}

// ================= 渲染：左 rail =================
function renderRail(): void {
  if (!railListEl) return;
  const arts = M.articles;
  const clipNotes = M.clipNotes || [];
  // 源计数（issue 206：搜索时 = 该源命中数，统计联动；无搜索 = 未读数/总数）
  const countOf = (source: SrcFilter): number =>
    queryBySource(arts, M.sidecar, M.clipUrls, clipNotes, source, M.upInfo).filter(matchesSearch).length;
  const allHit = countOf({ kind: 'all' });
  // V1 计数口径（issue 214）：未读（搜索态 = 命中数）/ 总数（全量含已处理）
  let html = railItemHtml({ kind: 'all' }, '全部未读', allHit, arts.length, 'inbox', '#58a6ff', M.sel.kind === 'all', '');

  // 站点行动态聚合（issue 222：rail 按 site 属性分类，issue 206 平台聚合行退役）——
  // 全库站点 = 剪藏全量 + 未读 news 面（行总数 = 该源列表长度，口径同 queryBySource site 源）；
  // 排序总数降序 → 未读降序 → 名 zh 序；徽标色按站名哈希（编辑部皮肤本就隐藏徽标）
  for (const row of aggregateSites(arts, clipNotes, new Set((M.sidecar.savedArchive || []).map((x) => x.url)), M.clipUrls)) {
    const full = queryBySource(arts, M.sidecar, M.clipUrls, clipNotes, { kind: 'site', site: row.site }, M.upInfo);
    const unreadN = full.filter((a) => a.st !== 'saved').length;
    const hit = countOf({ kind: 'site', site: row.site });
    const active = M.sel.kind === 'site' && M.sel.site === row.site;
    html += railItemHtml({ kind: 'site', site: row.site }, row.site, searchKw ? hit : unreadN, full.length, 'feed', siteTint(row.site), active, '');
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
    const cnt = countOf({ kind: 'inbox', platform: 'B站', up: uid });
    const upTotal = arts.filter((a) => a.platform === 'B站' && String(a.author || '') === uid).length;
    const active = M.sel.kind === 'inbox' && M.sel.platform === 'B站' && M.sel.up === uid;
    // G：UP 行 data-src 携带 platform=B站 + up=uid（旧实现 platform=展示名、up=null，
    // 点击后按平台名过滤恒空——UP 源点开是空列表且高亮不复位）
    // B站徽标色由 .bz-clip-rail .bz-rail-badge.bili 样式侧单源承担（不再内联传 #8b7cf6）
    html += railItemHtml({ kind: 'inbox', platform: 'B站', up: uid }, name, cnt, upTotal, 'bili', '', active, name.slice(0, 1));
  }

  // 剪藏本（聚合，saved 语义；搜索时显示命中数）
  const clipActive = M.sel.kind === 'clip';
  const clipHit = countOf({ kind: 'clip' });
  html += railItemHtml({ kind: 'clip' }, '剪藏本', clipHit, clipNotes.length, 'clip', '', clipActive, '');

  railListEl.innerHTML = html;
  mountIcons(railListEl);
  // rail 脚注（issue 214）：今日已读 N 篇（news.json stats.byDate，键 YYYY-MM-DD；缺省 0）
  if (railFootEl) {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    railFootEl.innerHTML = railFootHtml(M.stats?.byDate?.[key] || 0);
  }
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
    if (actions.length) attachItemActions(row, actions, { sheetTitle: String(row.title || ''), menuClass: 'bz-clip-menu-editorial' });
  });
}

/** rail 源级动作（enh 包 4）：该源还有未读时提供「全部标为已读」；剪藏本源无未读语义不挂 */
function buildRailActions(label: string, source: SrcFilter): ItemAction[] {
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
function renderList(): void {
  if (!listEl) return;
  const list = sortedView();
  if (list.length === 0) {
    listEl.innerHTML = '';
    listEl.appendChild(uiEmpty({ icon: 'inbox', title: '这个源暂无内容' }));
    // G：切到空源清当前阅读——M.cur 残留上一源文章会被 renderReader/mob 详情再渲染
    M.cur = null;
    if (readerEl) renderReader();
    return;
  }
  // 保持阅读项在列表内（不在则取第一条）
  if (!list.some((a) => a.id === (M.cur && M.cur.id))) {
    M.cur = list[0];
  }
  // 编辑部目录（issue 214 原型对齐）：序号 + 标题 + 「站点 · 时间」一行；摘要不入目录
  // （markup 单源 render.ts，issue 247）
  listEl.innerHTML = tocListHtml(list, M.cur ? M.cur.id : null, (a) => relTime(a.timeTs));
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
    // menuClass：菜单挂 body（域内后代选择器不可达），编辑部皮肤靠根挂类生效（同 todo 皮肤先例）
    attachItemActions(card, actions, { sheetHead: buildSheetHead(art), menuClass: 'bz-clip-menu-editorial' });
    // 单击选中 → 阅读
    card.addEventListener('click', (e) => {
      if (e.target && (e.target as HTMLElement).closest('.bz-item-sheet')) return;
      selectArticle(art.id);
    });
  });
  // 记录当前列表缓存（右键菜单取用；与桌面目录展示同序）
  M.list = sortedView();
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
      // 重新生成摘要（enh 包 1）：手动 force 重跑——只重建 summary/tags，不吞用户改过的标题；
      // 桌面右键与移动长按抽屉共用 buildItemActions，此处一处接入两端全量生效
      out.push({
        icon: 'sparkles',
        label: '重新生成摘要',
        title: 'AI 重新生成该剪藏的摘要与标签，不改动已有标题',
        onClick: () => { void regenerateSummary(getApp(), (a.note as ClipNote).file); },
      });
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
/** 图片段来源解析（issue 206）：外链直用；Obsidian 嵌链 `![[path]]` 走 vault 资源路径；其余拒载 */
function resolveImgSrc(src: string): string | null {
  const s = String(src || '').trim();
  if (/^(https?:|app:|capacitor:|data:image\/)/i.test(s)) return s;
  const wiki = s.match(/^!\[\[([^\]]+)\]\]$/);
  if (wiki) {
    const p = wiki[1].split('|')[0].trim(); // ![[img.png|300]] 剥别名尺寸
    try {
      const af = getApp().vault.getAbstractFileByPath(p);
      if (af) return getApp().vault.getResourcePath(af as any);
    } catch (e) { /* 文件不存在/解析失败 → 跳过该图 */ }
    return null;
  }
  return null;
}

function paragraphsHtml(body: string): string {
  // 段落 markup 单源 render.ts（issue 247）：段落化（md.ts 纯层）+ 图片解析（行为层钩子）
  return paragraphsMarkup(toParagraphs(body), resolveImgSrc);
}

/** 正文图片加载失败隐藏（缓存 URL 失效/断网时不留裂图） */
function bindImgFallback(container: HTMLElement): void {
  container.querySelectorAll('img.bz-clip-art-img').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });
  });
}

function renderReader(): void {
  if (!readerEl) return;
  const a = M.cur;
  applyReaderFontSize();
  if (!a) {
    readerEl.innerHTML = '';
    readerEl.appendChild(uiEmpty({ icon: 'book-open', title: '从列表选择一篇文章开始阅读' }));
    return;
  }
  setReadingSession(a.id);
  armAutoReading(a);
  // 正文（enh 包 3）：news 现算；clip 懒加载 cachedRead → 剥 frontmatter → 段落化，按 path 缓存
  let paras = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    paras = cached !== undefined ? paragraphsHtml(cached) : clipLoadingHtml();
  } else {
    paras = a.body ? paragraphsHtml(a.body) : '';
  }

  readerEl.innerHTML = readerHtml(a, { time: a.timeText || relTime(a.timeTs), paras });
  mountIcons(readerEl);
  bindImgFallback(readerEl);
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
    if (md) {
      md.innerHTML = body ? paragraphsHtml(body) : `<p class="dim">（笔记暂无正文）</p>`;
      bindImgFallback(md);
    }
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
  renderMobToc(); // issue 224：移动目录同刷（落在读后让位重排需重绘）
}

/** ←→/jk 条目切换（右栏聚焦时；列表顺序即阅读顺序，与目录展示同序） */
function stepArticle(delta: number): void {
  const list = sortedView();
  if (!list.length) return;
  const idx = M.cur ? list.findIndex((x) => x.id === M.cur!.id) : -1;
  const nextIdx = idx === -1 ? 0 : Math.min(list.length - 1, Math.max(0, idx + delta));
  const next = list[nextIdx];
  if (next && (!M.cur || next.id !== M.cur.id)) selectArticle(next.id);
}

// ---- 站点首字 chip（favicon 高清解析链已随 issue 214 阅读面极简化退役；chip 仍服务移动端） ----

/** 首字 chip（加载期占位 / 移动端来源标识） */
function favChipEl(site: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'bz-clip-favchip';
  el.textContent = String(site || '剪').slice(0, 1) || '剪';
  return el;
}

// ================= 动作 =================
/** 右栏滚动容器归零（issue 206：切换文章后从开头读，刷新同篇不重置） */
function resetReadScroll(): void {
  const sc = readPaneEl ? (readPaneEl.querySelector('.bz-clip-read-scroll') as HTMLElement | null) : null;
  if (sc) sc.scrollTop = 0;
}

function selectArticle(id: string): void {
  const list = currentList();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  const changed = !M.cur || M.cur.id !== a.id;
  M.cur = a;
  renderList();
  renderReader();
  renderMobDetail();
  if (changed) resetReadScroll();
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
  notifyUndo(`已将「${a.title}」标为已读`, () => void undoMarkRead(rawBefore));
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
    title: '删除条目',
    message: `确定从收件流删除「${a.title}」吗？删除后可在通知中撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  const rawBefore = { ...(a.raw || {}) }; // 动作前快照（撤销插回 news.json 用）
  await flowDeleteNews(a);
  notifyUndo(`已删除条目「${a.title}」`, () => void undoDeleteNews(rawBefore));
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
    title: '删除剪藏',
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
      notifyUndo(`已删除剪藏「${a.title}」（已移入系统回收站）`, () => void undoTrashClip(path, content));
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

// ================= 面板尺寸记忆（enh 包 8 → uiResizable persist，ADR-0094） =================

/** 记忆尺寸安全读取（null=未拖过 → 不写内联，走 CSS 默认 1180×760；越界值由 uiResizable 钳到硬上限 + 视口 92%） */
function savedPanelSize(): { w: number; h: number } | null {
  const s = tryGetSettings() as any;
  const w = Number(s?.clipbookPanelWidth) || 0;
  const h = Number(s?.clipbookPanelHeight) || 0;
  if (w < PANEL_MIN_W || h < PANEL_MIN_H) return null;
  return { w, h };
}

/** 落盘（uiResizable 防抖 300ms 后调用；键语义不变 clipbookPanelWidth/Height） */
function rememberPanelSize(w: number, h: number): void {
  const s = tryGetSettings() as any;
  if (!s) return;
  s.clipbookPanelWidth = w;
  s.clipbookPanelHeight = h;
  void saveSettings();
}

/** 分割线宽度记忆读取（null=未拖过 → 不写内联，中栏走 CSS 默认 360px；越界值由 uiVSplitter 钳制） */
function savedSplitWidth(): number | null {
  const v = Number((tryGetSettings() as any)?.clipbookMidWidth) || 0;
  return v > 0 ? v : null;
}

/** 分割线宽度落盘（uiVSplitter 防抖 300ms 后调用；键 clipbookMidWidth） */
function rememberSplitWidth(w: number): void {
  const s = tryGetSettings() as any;
  if (!s) return;
  s.clipbookMidWidth = w;
  void saveSettings();
}

// ================= 渲染：移动（issue 248 目录化：site 章 + 已收折叠） =================
function renderMobToc(): void {
  if (!mobListEl) return;
  const arts = M.articles;
  const clipNotes = M.clipNotes || [];
  const savedUrls = new Set((M.sidecar.savedArchive || []).map((x) => x.url));
  const searching = !!searchKw;
  const timeOf = (a: ClipArticle): string => relTime(a.timeTs);
  const chapters: MobChapter[] = [];
  const byId = new Map<string, ClipArticle>();
  // 章 = site（aggregateSites 与桌面 rail 同源口径：剪藏全量 + 未读 news 面，总数降序）
  for (const row of aggregateSites(arts, clipNotes, savedUrls, M.clipUrls)) {
    const full = queryBySource(arts, M.sidecar, M.clipUrls, clipNotes, { kind: 'site', site: row.site }, M.upInfo)
      .filter(matchesSearch);
    if (!full.length) continue;
    const active = full.filter((a) => a.st !== 'saved')
      .sort((x, y) => (x.st === 'unread' ? 0 : 1) - (y.st === 'unread' ? 0 : 1)); // 未读在前，组内保序
    const arch = full.filter((a) => a.st === 'saved');
    chapters.push({
      site: row.site,
      unread: active.filter((a) => a.st === 'unread').length,
      activeN: active.length,
      savedN: arch.length,
      activeHtml: mobListHtml(active, timeOf),
      archHtml: arch.length ? mobListHtml(arch, timeOf) : '',
    });
    [...active, ...arch].forEach((a) => byId.set(a.id, a));
  }
  mobItemById = byId;
  if (!chapters.length) {
    mobListEl.classList.remove('searching');
    mobListEl.innerHTML = '';
    mobListEl.appendChild(uiEmpty({ icon: 'inbox', title: '暂无内容' }));
    return;
  }
  mobListEl.classList.toggle('searching', searching);
  mobListEl.innerHTML = mobTocHtml(chapters, searching);
  restoreMobFolds();
  // 移动长按抽屉（enh 包 2）：条目动作与桌面右键同源（buildItemActions）——一处接入两端全量对齐；
  // 章头挂源级「全部标为已读」（rail 源行动同源，issue 248 源条退役后的迁移位）
  mobListEl.querySelectorAll<HTMLElement>('[data-id]').forEach((card) => {
    const art = byId.get(String(card.dataset.id || ''));
    if (!art) return;
    attachItemActions(card, buildItemActions(art), { sheetHead: buildSheetHead(art) });
  });
  mobListEl.querySelectorAll<HTMLElement>('.bz-clip-mob-ch-hd').forEach((hd) => {
    let sel: any = null;
    try { sel = JSON.parse(hd.dataset.src || 'null'); } catch (e) { return; }
    if (!sel || sel.kind !== 'site') return;
    const actions = buildRailActions(String(sel.site), { kind: 'site', site: String(sel.site) });
    if (actions.length) attachItemActions(hd, actions, { sheetTitle: String(sel.site), menuClass: 'bz-clip-menu-editorial' });
  });
}

/** 重渲染后按展开集合恢复折叠行 .open（详情往返后仍展开） */
function restoreMobFolds(): void {
  if (!mobListEl || !expandedMobArch.size) return;
  mobListEl.querySelectorAll<HTMLElement>('.bz-clip-mob-ch').forEach((chEl) => {
    const hd = chEl.querySelector('[data-src]') as HTMLElement | null;
    if (!hd) return;
    let sel: any = null;
    try { sel = JSON.parse(hd.dataset.src || 'null'); } catch (e) { return; }
    if (!sel || sel.kind !== 'site' || !expandedMobArch.has(String(sel.site))) return;
    const fold = chEl.querySelector('[data-fold]') as HTMLElement | null;
    if (fold) setFoldOpen(fold, true);
  });
}

/** 折叠行开合：翻转 .open、同步 aria/文案；site 记入 expandedMobArch（跨重渲染保持） */
function toggleMobArch(foldEl: HTMLElement): void {
  const open = !foldEl.classList.contains('open');
  setFoldOpen(foldEl, open);
  const ch = foldEl.closest('.bz-clip-mob-ch');
  const hd = ch ? ch.querySelector('[data-src]') : null;
  let site = '';
  if (hd) {
    try { site = String((JSON.parse((hd as HTMLElement).dataset.src || 'null')).site || ''); } catch (e) { site = ''; }
  }
  if (site) {
    if (open) expandedMobArch.add(site); else expandedMobArch.delete(site);
  }
}

function setFoldOpen(foldEl: HTMLElement, open: boolean): void {
  foldEl.classList.toggle('open', open);
  foldEl.setAttribute('aria-expanded', String(open));
  const lab = foldEl.querySelector('[data-fold-lab]') as HTMLElement | null;
  if (!lab) return;
  const n = foldEl.nextElementSibling ? foldEl.nextElementSibling.childElementCount : 0;
  lab.innerHTML = open ? '收起' : `已收 <b>${n}</b> 篇`;
}

function openMobDetail(id: string): void {
  // 目录含全站（含已收剪藏段）：currentList 只是当前源视图，未命中回退目录全量索引（issue 248）
  let a = currentList().find((x) => x.id === id);
  if (!a) a = mobItemById.get(id);
  if (!a) return;
  M.cur = a;
  M.mobDetailOpen = true;
  renderMobDetail();
  if (mobDetailEl) mobDetailEl.style.display = 'flex';
  const body = mobDetailEl ? (mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement | null) : null;
  if (body) body.scrollTop = 0; // issue 206：进详情从开头读
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
    mountIcons(mobSaveBtnEl);
  }
  const paras = a.body ? paragraphsHtml(a.body) : '';
  // 详情正文 markup 单源 render.ts（issue 247）
  const detailBody = mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
  detailBody.innerHTML = mobDetailHtml(a, { time: a.timeText || relTime(a.timeTs), paras });
  mountIcons(detailBody);
  bindImgFallback(detailBody);
}

// ================= 设置 schema（ADR-0064 声明式；settings-panel 域清单挂载） =================
/** 数据源组依赖外部 news.json（异步读盘），入口先 await readDataSourceState() 预载状态再建 schema */
export function clipbookSettingsSchema(dataSource: DataSourceState): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'clipbookSkin' }, options: [{ value: 'default', label: '编辑部', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'clipbookSkinTheme' }, layoutKey: 'clipbookSkin', options: [{ value: 'newsprint', label: '新闻纸', layout: 'default', prevClass: 'bz-sp-prev-newsprint' }] },
        ],
      },
      {
        icon: 'folder-open',
        name: '基础',
        rows: [
          { type: 'path', mode: 'single', name: '剪藏目录', desc: '存放网页剪藏文章的文件夹', binding: { key: 'articleDirectory' } },
          { type: 'number', name: '面板宽度记忆', desc: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', binding: { key: 'clipbookPanelWidth' }, min: 0, step: 10 },
          { type: 'number', name: '面板高度记忆', desc: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', binding: { key: 'clipbookPanelHeight' }, min: 0, step: 10 },
          { type: 'number', name: '目录栏宽度记忆', desc: '拖动目录与阅读分隔线后自动记忆，0 为未拖过', binding: { key: 'clipbookMidWidth' }, min: 0, step: 10 },
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
        rows: dataSourceGroupRows(dataSource),
      },
    ],
  };
}

/** 打开剪藏本设置弹窗（域内 ⚙️ 无头行按钮——设置面板域已聚合；入口仅设置面板与命令） */
export async function openSettings(app: any): Promise<void> {
  // 数据源组声明行依赖 news.json 状态，先读盘再建 schema（加载间隙由弹窗打开时机吸收）
  const dataSource = await readDataSourceState();
  const schema = clipbookSettingsSchema(dataSource);
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
