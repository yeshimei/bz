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
import { uiEmpty, uiResizable, uiVSplitter, mountIcons } from '../core/ui';
import { cmpZh, formatRelativeTime, localDayKey } from '../core/utils';
import { isMobileEnv } from '../core/mobile';
import { escManager } from '../core/esc-manager';
import { attachItemActions, closeItemMenu, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { openSettingsModal } from '../core/settings-modal';
import type { SettingsSchema } from '../core/settings-schema';
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { ensureAutoSummary, stopAutoSummary, regenerateSummary } from '../auto-summary';
import { dataSourceGroupRows } from './news-sources-group';
import { articleKeyOf } from './constants';
import { readDataSourceState, type DataSourceState } from './news-source-settings';
import type { ClipArticle } from './types';
import { toParagraphs, stripClipChrome } from './md';
import { queryBySource, queryBySourceFull, aggregateSites, clipArticle, bucketByState } from './store';
import {
  panelHtml, railItemHtml, railFootHtml, tocListHtml, paragraphsHtml as paragraphsMarkup,
  clipLoadingHtml, readerHtml, mobListHtml, mobDetailHtml, mobTocHtml, mobNoHitHtml, type MobChapter, siteTint,
  deskFoldRowHtml, foldBodyHtml, ICO,
} from './render';
import { M, resetClipbookState } from './state';
import { readNewsAndSidecar, clipDir } from './loader';
import { writeClipNote } from './save';
import {
  flowSave, flowMarkRead, flowDeleteNews, setReadingSession, pauseReadingSession,
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
let loading = false;
let dirty = false; // 数据变化待刷标志（目录事件回调期）
let loaded = false; // C5：本次会话是否已成功装载过（false = 首开必须装载）

// ================= 增强包常量与状态 =================
const SEARCH_DEBOUNCE_MS = 180; // 对齐保险库/备忘录
const PANEL_MIN_W = 760; // 桌面缩放钳制（三栏骨架最小可读宽度）
const PANEL_MIN_H = 520;
const PANEL_MAX_W = 1600;
const PANEL_MAX_H = 1000;
/** 剪藏正文缓存（notePath → 剥 frontmatter 后正文；clipping:file-* 目录事件失效） */
const clipBodyCache = new Map<string, string>();
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let panelResizeDetach: { detach: () => void; flush: () => void } | null = null;
let panelSplit: { el: HTMLElement; restore: () => void; flush: () => void; detach: () => void } | null = null;
/** 分割线钳制：中栏（目录）最小宽 / 右栏（阅读）最小宽（对齐 PANEL_MIN_W 下整体不溢出） */
const SPLIT_MIN_MID = 220;
const SPLIT_MIN_READ = 320;

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

/** 显示面板（幂等：数据就绪直接渲染；未装载先装载）。
 *  ADR-0108：每次打开面板 = 新会话（重排点）——快照重建使已读/已收条目按当前状态重新落段。 */
export function showPanel(): void {
  if (!overlayEl) {
    // DOM 已被卸载清空（极端时序）→ 重建
    buildDom(M.appRef);
  }
  overlayEl!.style.display = 'flex';
  panelSplit?.restore(); // 分割线尺寸记忆（容器可见后 restore 才能按实际宽度钳制）
  M.open = true;
  beginSession();
  // C5/ADR-0063：已装载且无目录事件（!dirty）直接用内存缓存渲染——零扫描瞬时显示；
  // 首开未装载或有变更才异步重读
  if (dirty || !loaded) void loadIfNeeded();
  else renderAll();
}

/** 装载（防重入 + 首载后保留内存面，目录事件增量走 reloadIfOpen）。
 *  装载完成 = 数据基线更新（新会话）：目录事件引入新剪藏/新 news 后按当前状态重排快照。 */
let loadPromise: Promise<void> | null = null;
function loadIfNeeded(): Promise<void> {
  if (loading) return loadPromise || Promise.resolve();
  if (!M.open && overlayEl) return Promise.resolve();
  loading = true;
  loadPromise = readNewsAndSidecar()
    .then(() => {
      dirty = false; loaded = true; beginSession(); renderAll();
    })
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
  }
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
  mobItemOrder = [];
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
  // 桌面搜索（enh 包 1）：180ms 防抖对齐保险库/备忘录
  deskSearchEl!.addEventListener('input', () => {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      setSearchKw(deskSearchEl ? deskSearchEl.value.trim() : '');
      renderList();
      renderRail();
    }, SEARCH_DEBOUNCE_MS);
  });
  // 右栏常驻委托（enh 包 3/6c）：正文外链（md 锚点 data-clip-ext）+「打开笔记」点击 + ←→/jk 条目切换
  readPaneEl!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const ext = t.closest('a[data-clip-ext]') as HTMLAnchorElement | null;
    if (ext) { e.preventDefault(); try { window.open(ext.href, '_blank'); } catch { /* jsdom 无 window.open */ } return; }
    if (t.closest('[data-clip-open-note]') && M.cur) openNote(M.cur);
  });
  readPaneEl!.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); stepArticle(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); stepArticle(1); }
  });
  // 移动：搜索切换（原型顶栏「搜索」文字钮；显式 block/none——CSS 无默认 display，由骨架 inline none 兜底）
  mobSearchBtn!.addEventListener('click', () => {
    const show = mobSearchbarEl!.style.display === 'none';
    mobSearchbarEl!.style.display = show ? 'block' : 'none';
    if (show) mobInput!.focus();
    else { mobInput!.value = ''; setSearchKw(''); renderMobToc(); }
  });
  mobInput!.addEventListener('input', () => {
    searchKw = mobInput!.value.trim();
    renderMobToc(); // 搜索态：命中全平铺（含已收），折叠不生效
  });
  // 「关闭」（原型语义）：清搜索并收全部；无任何待复位态 = 退出面板（移动面板无其它关闭入口）
  mobCloseBtn!.addEventListener('click', () => {
    const barOpen = mobSearchbarEl ? mobSearchbarEl.style.display === 'block' : false;
    if (searchKw || barOpen || expandedMobArch.size) {
      searchKw = '';
      expandedMobArch.clear();
      if (mobInput) mobInput.value = '';
      if (mobSearchbarEl) mobSearchbarEl.style.display = 'none';
      renderMobToc();
    } else {
      closePanel();
    }
  });
  // 移动：返回（详情屏2 → 屏1，原型文字钮）
  mobBackBtn!.addEventListener('click', () => {
    M.mobDetailOpen = false;
    mobDetailEl!.style.display = 'none';
    renderAll();
  });
  // 移动：头栏保存钮（文字钮「存为剪藏 / 已存」）
  mobSaveBtnEl!.addEventListener('click', () => {
    void doSave(M.cur);
  });
  // 移动详情「读下一则」（原型脚；同章内下一则，章末回目录）——按 id 定位（目录条目为重建实例，indexOf 恒 -1）
  // 点压缩制前先放行正文外链（data-clip-ext，与桌面右栏同一打开链）
  mobDetailEl!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const ext = t.closest('a[data-clip-ext]') as HTMLAnchorElement | null;
    if (ext) { e.preventDefault(); try { window.open(ext.href, '_blank'); } catch { /* jsdom 无 window.open */ } return; }
    if (!t.closest('[data-clip-mob-next]') || !M.cur) return;
    const grp = mobItemOrder.filter((x) => x.srcName === M.cur!.srcName);
    const idx = grp.findIndex((x) => x.id === M.cur!.id);
    const next = grp[idx + 1];
    if (next) openMobDetail(next.id); else (mobBackBtn as HTMLElement).click();
  });

  // ESC
  escKey = 'bz-clipbook';
  escHandle = escManager.register(escKey, {
    isVisible: () => !!overlayEl && overlayEl.style.display !== 'none',
    close: () => closePanel(),
  });
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
/** 移动目录全量条目序（toc 展示序，详情「第 X 则 / N」与「读下一则」用） */
let mobItemOrder: ClipArticle[] = [];

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

/** 当前源过滤条件（M.sel → queryBySource 入参） */
function currentSrc(): SrcFilter {
  const s = M.sel;
  if (s.kind === 'clip') return { kind: 'clip' };
  if (s.kind === 'site') return { kind: 'site', site: s.site };
  if (s.kind === 'inbox') return { kind: 'inbox', platform: s.platform, up: s.up || undefined };
  return { kind: 'all' };
}

function currentList(): ClipArticle[] {
  return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], currentSrc(), M.upInfo);
}

// ================= 会话目录快照（ADR-0108 冻结序） =================
// 打开面板（装载会话）时按源拍一次「目录序」——只记 **id 序 + 分桶分区**，不存对象（避免
// 标读后拿到陈旧 st）。渲染时按 id 现取 ClipArticle（读最新态：灰显/绿显由当前 st 决定）。
// 会话内任何状态流转不重排（快照分区固定不动）；唯一重排点 = 重开面板（新会话 / epoch++）。
type DirSnap = { unread: string[]; read: string[]; saved: string[] };
let dirEpoch = 0;                                   // 会话世代（重开面板 +1 = 重排点）
let dirSnap = new Map<string, DirSnap>();           // srcKey → 会话快照（id 序 + 分区）
let snapEpochs = new Map<string, number>();         // srcKey → 快照所处世代
/** 桌面折叠开合记忆（read/saved 两段独立；key = `${srcKey}#read|saved`） */
const deskFoldOpen = new Set<string>();
/** 手动碰过（开或收）的折叠 key——默认自动展开规则不覆盖手动态 */
const deskFoldTouched = new Set<string>();

function epochReset(): void { dirEpoch++; snapEpochs.clear(); }

/** 源 → 稳定 key（rail 切换/折叠态记忆） */
function srcKey(src: SrcFilter): string {
  if (src.kind === 'all') return 'all';
  if (src.kind === 'clip') return 'clip';
  if (src.kind === 'site') return 'site:' + src.site;
  return `inbox:${src.platform}:${src.up || ''}`;
}

/** 会话内取某源目录快照（世代不符重建 = 重开面板即重排；会话内复用不动） */
function snapDirFor(src: SrcFilter): DirSnap {
  const key = srcKey(src);
  const cur = dirSnap.get(key);
  if (cur && snapEpochs.get(key) === dirEpoch) return cur;
    const b = bucketByState(queryBySourceFull(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo));
  const snap: DirSnap = { unread: b.unread.map((a) => a.id), read: b.read.map((a) => a.id), saved: b.saved.map((a) => a.id) };
  dirSnap.set(key, snap);
  snapEpochs.set(key, dirEpoch);
  return snap;
}

/** 按 id 现取条目（快照 → 当前对象）：缺失即返回靠匹配 vt（id 已删就丢） */
function resolveSnap(snap: DirSnap, src: SrcFilter): { unread: ClipArticle[]; read: ClipArticle[]; saved: ClipArticle[] } {
  const live = new Map<string, ClipArticle>();
  for (const a of queryBySourceFull(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo)) live.set(a.id, a);
  const pick = (ids: string[]) => ids.map((id) => live.get(id)).filter((a): a is ClipArticle => !!a);
  return { unread: pick(snap.unread), read: pick(snap.read), saved: pick(snap.saved) };
}

/** 当前源会话目录解析（快照序现取三段；剪藏本源无冻结语义，走 queryBySource 平铺） */
function dirFor(src: SrcFilter): { unread: ClipArticle[]; read: ClipArticle[]; saved: ClipArticle[] } {
  return resolveSnap(snapDirFor(src), src);
}

/** 桌面目录全量平铺（菜单/打开条目查找用；顺序 = 快照三段拼接） */
function deskFlat(): ClipArticle[] {
  const b = dirFor(currentSrc());
  return [...b.unread, ...b.read, ...b.saved];
}

/** 桌面折叠开合判定（手动碰过 → 以 deskFoldOpen 为准；否则默认态：打开目录即无未读 → 默认展开「已收」，
 *  已收空则展开「已读」——兜底不空场；n = 该段条数，savedN = 已收段条数，snapUnreadN = 快照未读数） */
function deskFoldIsOpen(kind: 'read' | 'saved', n: number, savedN: number, snapUnreadN: number): boolean {
  const key = srcKey(currentSrc()) + '#' + kind;
  if (deskFoldTouched.has(key)) return deskFoldOpen.has(key);
  if (snapUnreadN > 0 || n <= 0) return false;
  if (kind === 'saved') return true;                       // 打开即无未读 → 默认展已收
  return savedN <= 0;                                      // 已收空 → 展已读兜底
}

/** 点击桌面折叠行（toggle 后翻转手动态并重渲目录） */
function toggleDeskFold(kind: 'read' | 'saved'): void {
  const key = srcKey(currentSrc()) + '#' + kind;
  deskFoldTouched.add(key);
  if (deskFoldOpen.has(key)) deskFoldOpen.delete(key); else deskFoldOpen.add(key);
  renderList();
}

/** 会话边界（ADR-0108）：每次打开面板 = 新会话 = 重排点——递增世代使全部快照失效、折叠默认态复位 */
function beginSession(): void {
  epochReset();
  deskFoldOpen.clear();
  deskFoldTouched.clear();
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
    railFootEl.innerHTML = railFootHtml(M.stats?.byDate?.[localDayKey()] || 0);
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
    className: 'bz-clip-dialog-editorial',
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
/**
 * 桌面中栏目录（ADR-0108 会话冻结序）：
 *  - 剪藏本源（src.kind==='clip'）：无未读/已读生命周期，维持原样平铺（Q8）；
 *  - news 面源（all/site/inbox）：未读常显（会话快照 unread 桶现取——会话内新标读原位灰显，
 *    计数即时减）+「已读 N 篇」折叠段（快照 read 桶）+「已收 N 篇」折叠段（快照 saved 桶）。
 *  - 折叠默认收起；目录无未读时默认展开「已收」（已收空则展开「已读」）——桌面兜底不空场。
 *  - 搜索态：命中平铺（无折叠行），与移动端检索语义一致。
 */
function renderList(): void {
  if (!listEl) return;
  const src = currentSrc();
  if (src.kind === 'clip') {
    // 剪藏本源：全量平铺（冻结序不适用；read/saved 均无语义）
    const list = queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo).filter((a) => !searchKw || matchesSearch(a));
    if (!list.length) {
      listEl.innerHTML = '';
      listEl.appendChild(uiEmpty({ icon: 'scissors', title: '剪藏本为空' }));
      M.cur = null;
      if (readerEl) renderReader();
      return;
    }
    if (!list.some((a) => a.id === (M.cur && M.cur.id))) M.cur = list[0];
    listEl.innerHTML = tocListHtml(list, M.cur ? M.cur.id : null, (a) => relTime(a.timeTs));
    M.list = list;
    bindItemMenus();
    return;
  }
  const flat = deskFlat();
  if (!flat.length) {
    listEl.innerHTML = '';
    listEl.appendChild(uiEmpty({ icon: 'inbox', title: '这个源暂无内容' }));
    // G：切到空源清当前阅读——M.cur 残留上一源文章会被 renderReader/mob 详情再渲染
    M.cur = null;
    if (readerEl) renderReader();
    return;
  }
  // 保持阅读项在目录内（不在则取未读段首条）
  if (!flat.some((a) => a.id === (M.cur && M.cur.id))) {
    M.cur = flat[0];
  }
  const timeOf = (a: ClipArticle) => relTime(a.timeTs);
  const curId = M.cur ? M.cur.id : null;
  // 搜索态：命中平铺（不分段，折叠行不渲染）
  if (searchKw) {
    const hit = flat.filter(matchesSearch);
    if (!hit.length) {
      listEl.innerHTML = '';
      listEl.appendChild(uiEmpty({ icon: 'search-x', title: '查无此条' }));
      M.cur = null; // G：零命中 = 空目录语义（清阅读残留）
      if (readerEl) renderReader();
      M.list = [];
      return;
    }
    listEl.innerHTML = tocListHtml(hit, curId, timeOf);
    M.list = hit;
    bindItemMenus();
    return;
  }
  const b = dirFor(src);
  const snapUnreadN = b.unread.length; // 快照桶大小 = 打开目录时未读数（会话内读完不触发闪开）
  let html = tocListHtml(b.unread, curId, timeOf);
  // 已读段（快照 read 桶；默认收起——打开即无未读且已收空时自动展开兜底）
  if (b.read.length) {
    const open = deskFoldIsOpen('read', b.read.length, b.saved.length, snapUnreadN);
    html += deskFoldRowHtml('read', b.read.length, open);
    html += foldBodyHtml(tocListHtml(b.read, curId, timeOf), open);
  }
  // 已收段（快照 saved 桶；打开即无未读默认展开）
  if (b.saved.length) {
    const open = deskFoldIsOpen('saved', b.saved.length, b.saved.length, snapUnreadN);
    html += deskFoldRowHtml('saved', b.saved.length, open);
    html += foldBodyHtml(tocListHtml(b.saved, curId, timeOf), open);
  }
  listEl.innerHTML = html;
  M.list = flat; // 菜单/点击查找全目录
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

/** 给中栏卡片挂右键/长按菜单（item-actions：桌面 contextmenu / 触屏长按抽屉）。
 *  art 从目录全量（M.list = 快照三段现取拼接）查——折叠段（已读/已收）条目同样可打开/菜单。 */
function bindItemMenus(): void {
  if (!listEl) return;
  const all = M.list;
  const cards = listEl.querySelectorAll<HTMLElement>('.bz-clip-item');
  cards.forEach((card) => {
    const art = all.find((x) => x.id === card.dataset.id) || M.cur;
    if (!art || art.id !== card.dataset.id) return;
    const actions = buildItemActions(art);
    // menuClass：菜单挂 body（域内后代选择器不可达），编辑部皮肤靠根挂类生效（同 memo 皮肤先例）
    attachItemActions(card, actions, { sheetHead: buildSheetHead(art), menuClass: 'bz-clip-menu-editorial' });
    // 单击选中 → 阅读
    card.addEventListener('click', (e) => {
      if (e.target && (e.target as HTMLElement).closest('.bz-item-sheet')) return;
      selectArticle(art.id);
    });
  });
  // 桌面折叠行点击开合（已读/已收两段独立；renderList 重建 DOM 后重挂）
  listEl.querySelectorAll<HTMLElement>('[data-desk-fold]').forEach((row) => {
    row.addEventListener('click', () => {
      const kind = (row.getAttribute('data-desk-fold') as 'read' | 'saved') || 'saved';
      toggleDeskFold(kind);
    });
  });
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

// ---- 阅读字号三档（enh 包 7：小/中/大）----
// 档位由设置面板「剪藏本 · 基础 · 阅读字号」驱动（阅读面内分段控件已退役），此处只负责落类

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

// ---- 阅读动线（去在读后：无自动落读；条目切换靠 ←→/jk 与显式「标记为已读」动作） ----

/** ←→/jk 条目切换（右栏聚焦时；阅读顺序 = 未读桶快照序，与目录常显同序） */
function stepArticle(delta: number): void {
  const list = dirFor(currentSrc()).unread;
  if (!list.length) return;
  const idx = M.cur ? list.findIndex((x) => x.id === M.cur!.id) : -1;
  const nextIdx = idx === -1 ? 0 : Math.min(list.length - 1, Math.max(0, idx + delta));
  const next = list[nextIdx];
  if (next && (!M.cur || next.id !== M.cur.id)) selectArticle(next.id);
}

// ================= 动作 =================
/** 右栏滚动容器归零（issue 206：切换文章后从开头读，刷新同篇不重置） */
function resetReadScroll(): void {
  const sc = readPaneEl ? (readPaneEl.querySelector('.bz-clip-read-scroll') as HTMLElement | null) : null;
  if (sc) sc.scrollTop = 0;
}

function selectArticle(id: string): void {
  const a = deskFlat().find((x) => x.id === id);
  if (!a) return;
  const changed = !M.cur || M.cur.id !== a.id;
  M.cur = a;
  // ADR-0108 Q5：桌面也「打开即已读」——与移动同动线（含 ←→/jk 步进）；会话内原位灰显
  markReadOnOpen(a);
  renderList();
  renderReader();
  renderMobDetail();
  if (changed) resetReadScroll();
}

async function doSave(a: ClipArticle | null): Promise<void> {
  if (!a) return;
  if (a.origin !== 'news') return;
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

async function deleteNewsItem(a: ClipArticle): Promise<void> {
  const ok = await openFlowDialog({
    className: 'bz-clip-dialog-editorial',
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
    className: 'bz-clip-dialog-editorial',
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
 * ADR-0108 冻结序：标读/收藏后条目**原位保留**（快照不动），M.cur 保持当前条目、不跳位；
 * 仅条目真消失（删除/剪藏目录删除）才补位到同位置下一条。
 */
async function refreshAfterAction(): Promise<void> {
  const prevIdx = M.cur ? deskFlat().findIndex((x) => x.id === M.cur!.id) : -1;
  await readNewsAndSidecar();
  const flat = deskFlat();
  if (M.cur && flat.some((x) => x.id === M.cur!.id)) {
    M.cur = flat.find((x) => x.id === M.cur!.id) || M.cur; // 保留原位（可能 st 已变，刷新引用）
  } else if (flat.length) {
    M.cur = flat[Math.min(Math.max(prevIdx, 0), flat.length - 1)];
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

// ================= 渲染：移动（m3 目录索引：site 章 + 已读/已收双折叠，ADR-0108） =================
function renderMobToc(): void {
  if (!mobListEl) return;
  const arts = M.articles;
  const clipNotes = M.clipNotes || [];
  const savedUrls = new Set((M.sidecar.savedArchive || []).map((x) => x.url));
  const searching = !!searchKw;
  const timeOf = (a: ClipArticle): string => relTime(a.timeTs);
  const chapters: MobChapter[] = [];
  const byId = new Map<string, ClipArticle>();
  const order: ClipArticle[] = [];
  // 章 = site：会话快照（ADR-0108）三桶现取——未读常显（会话内新标读原位灰显）/ 已读段 / 已收段。
  // 承接排重与桌面同源：url 命中剪藏（clipByUrl/savedArchive）的 news 由 clip 承接 → st=saved 进已收，
  // 已读骨架不双显（clipArticle 承接判定一致）。
  const siteSet = new Set<string>();
  for (const a of arts) {
    const s = String((a && (a.site || a.platform)) || '').trim() || '未知';
    siteSet.add(s);
  }
  for (const n of clipNotes || []) {
    const s = String((n && n.site) || '').trim() || '未知';
    siteSet.add(s);
  }
  for (const site of siteSet) {
    const snap = snapDirFor({ kind: 'site', site });
    const b = resolveSnap(snap, { kind: 'site', site });
    const unread = b.unread.filter(matchesSearch);
    const read = b.read.filter(matchesSearch);
    const saved = b.saved.filter(matchesSearch);
    if (!unread.length && !read.length && !saved.length) continue;
    const unreadN = unread.filter((a) => a.st === 'unread').length; // 章头未读数（搜索命中口径 + 会话内标读即时减）
    chapters.push({
      site,
      unread: unreadN,
      activeN: unread.length,
      readN: read.length,
      savedN: saved.length,
      activeHtml: mobListHtml(unread, timeOf),
      readHtml: read.length ? mobListHtml(read, timeOf) : '',
      savedHtml: saved.length ? mobListHtml(saved, timeOf) : '',
    });
    [...unread, ...read, ...saved].forEach((a) => { byId.set(a.id, a); order.push(a); });
  }
  // 章序：总数降序 → 未读降序 → 名 zh 序（与桌面 rail 口径同向）
  chapters.sort((x, y) => (y.activeN + y.readN + y.savedN) - (x.activeN + x.readN + x.savedN) || y.unread - x.unread || cmpZh(x.site, y.site));
  mobItemById = byId;
  mobItemOrder = order;
  if (!chapters.length) {
    mobListEl.innerHTML = mobNoHitHtml(searching ? '查无此条' : '暂无剪藏内容');
    return;
  }
  mobListEl.innerHTML = mobTocHtml(chapters, searching, expandedMobArch);
  // 移动长按抽屉（enh 包 2）：条目动作与桌面右键同源（buildItemActions）——一处接入两端全量对齐；
  // 章头挂源级「全部标为已读」（rail 源行动同源，源条退役后的迁移位）
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

/** 折叠行开合（原型 .c-fold 行为）：kind 段 arch.hidden 翻转 + fold.on；`${kind}:${site}` 记入展开记忆（跨重渲染保持） */
function toggleMobArch(foldEl: HTMLElement): void {
  const ch = foldEl.closest('.bz-clip-mob-ch');
  const hd = ch ? ch.querySelector('[data-src]') : null;
  let site = '';
  if (hd) {
    try { site = String((JSON.parse((hd as HTMLElement).dataset.src || 'null')).site || ''); } catch (e) { site = ''; }
  }
  const kind = (foldEl.getAttribute('data-fold-kind') as 'read' | 'saved') || 'saved';
  const key = `${kind}:${site}`;
  const arch = ch ? (ch.querySelector(`[data-arch-kind="${kind}"]`) as HTMLElement | null) : null;
  const opening = !!arch && arch.hidden;
  if (arch) arch.hidden = !opening;
  foldEl.classList.toggle('on', opening);
  foldEl.setAttribute('aria-expanded', String(opening));
  const lab = foldEl.querySelector('.bz-clip-mob-fold-lab') as HTMLElement | null;
  if (lab) {
    const n = arch ? arch.childElementCount : 0;
    const label = kind === 'read' ? '已读' : '已收';
    lab.innerHTML = opening ? '收起' : `${label} <b>${n}</b> 篇`;
  }
  if (site) {
    if (opening) expandedMobArch.add(key); else expandedMobArch.delete(key);
  }
}

function openMobDetail(id: string): void {
  // 目录含全站（含已收剪藏段）：currentList 只是当前源视图，未命中回退目录全量索引
  let a = currentList().find((x) => x.id === id);
  if (!a) a = mobItemById.get(id);
  if (!a) return;
  M.cur = a;
  M.mobDetailOpen = true;
  renderMobDetail();
  if (mobDetailEl) mobDetailEl.style.display = 'flex';
  const body = mobDetailEl ? (mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement | null) : null;
  if (body) body.scrollTop = 0; // issue 206：进详情从开头读
  markReadOnOpen(a); // 打开即已读（不打断当前详情正文；返回目录时该条已让位沉入已收折叠段）
}

/** 打开即已读（m3 去在读 + ADR-0108 桌面接入）：打开一条未处理 news → 静默标已读（无 toast/撤销）。
 *  内存 read 位**同步**置（目录即时灰显、rail 计数即时减），落盘走串行队列（正文磁盘清空，
 *  内存 raw 保留给本次会话阅读）。会话内该条按快照原位留灰，重开面板才重排沉段。 */
function markReadOnOpen(a: ClipArticle): void {
  if (!a || a.st !== 'unread') return;
  if (a.origin !== 'news') return;
  const raw = a.raw || M.articles.find((n) => articleKeyOf(n) === a.id);
  if (!raw || raw.read === true) return;
  raw.read = true; // 同步内存位（防重入 + 即时视觉/计数）
  void flowMarkRead(a).then(() => {
    // 落盘完成无需额外动作；若期间未重渲（极短窗口），补一次目录/徽标刷新收敛灰显
    if (M.open && !M.mobDetailOpen) { renderList(); renderRail(); }
  }).catch(() => { /* 落盘失败保持静默（下次装载还原） */ });
}

function renderMobDetail(): void {
  if (!mobDetailEl || !M.cur) return;
  const a = M.cur;
  // 屏2 顶部：居中「站名 · 目录」（原型 .d-ch）
  if (mobTitleEl) mobTitleEl.textContent = `${a.srcName} · 目录`;
  // 保存钮（原型文字钮「存为剪藏 / 已存」；剪藏来源隐藏——doSave 对 origin!=='news' 静默 return）
  if (mobSaveBtnEl) {
    const saved = a.st === 'saved';
    mobSaveBtnEl.style.display = a.origin !== 'news' ? 'none' : '';
    mobSaveBtnEl.classList.toggle('saved', saved);
    mobSaveBtnEl.textContent = saved ? '已存' : '存为剪藏';
  }
  const paras = a.body ? paragraphsHtml(a.body) : '';
  const idx = mobItemOrder.indexOf(a);
  const seq = idx >= 0 ? `第 ${idx + 1} 则 / ${mobItemOrder.length}` : '';
  // 详情正文 markup 单源 render.ts（m3 原型屏2）
  const detailBody = mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
  detailBody.innerHTML = mobDetailHtml(a, { time: a.timeText || relTime(a.timeTs), paras, seq });
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
          { type: 'select', name: '阅读字号', desc: '桌面阅读面正文字号', binding: { key: 'clipbookReaderFontSize' }, options: [
            { value: 'small', label: '小' },
            { value: 'medium', label: '中' },
            { value: 'large', label: '大' },
          ], onChange: () => applyReaderFontSize() },
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
