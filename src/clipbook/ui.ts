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
import { Component, MarkdownRenderer, TFile } from 'obsidian';
import { getApp } from '../core/app';
import { notice, notifyActionError, notifySaveError, notifyUndo } from '../core/notice';
import { uiBtn, uiEmpty, uiResizable, uiVSplitter, mountIcons } from '../core/ui';
import { cmpZh, debounce, formatRelativeTime, localDayKey, openExternalUrl } from '../core/utils';
import { isMobileEnv } from '../core/mobile';
import { topifyZ } from '../core/dom';
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
import { stripClipChrome } from './md';
import { queryBySource, queryBySourceFull, aggregateSites, clipArticle, bucketByState } from './store';
import {
  panelHtml, railItemHtml, railFootHtml, tocListHtml,
  readerHtml, mobListHtml, mobDetailHtml, mobTocHtml, mobNoHitHtml, type MobChapter, siteTint,
  deskFoldRowHtml, foldBodyHtml, ICO, clipReportEntryHtml,
} from './render';
import { M, resetClipbookState } from './state';
import { readNewsAndSidecar } from './loader';
import { readNewsData } from './news-data';
import { writeClipNote } from './save';
import { getKnowledgeBoxes } from '../core/knowledge-boxes';
import { applyBodyTransforms, applyClipContentTransforms, findMarkdownSnippet, addArticleMark, addPendingSourceNote, clearArticleTracking, linkAliasText, type ClipMark } from './anchor';
import { saveClipImage, fetchImageDataUrl } from './image-save';
import {
  flowSave, flowMarkRead, flowDeleteNews, setReadingSession, pauseReadingSession, flushReadingSession,
  flowMarkAllRead, flowUndoHandled, flowUndoDeleteNews, flowUndoMarkAllRead,
} from './flow';
import { openClipbookReport } from './report-ui';
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
/** 装载错误态（效率#16）：null = 正常；corrupt（news.json 损坏）/ exception（读盘通道异常）
 *  两态 + 原因。错误时中栏出「读取失败」错误空态（带重试钮）替代引导空态——
 *  防「暂无内容」假空态误导用户以为数据全丢（数据明明在盘上） */
let loadError: { kind: 'corrupt' | 'exception'; reason: string } | null = null;
/** 会话内滚位记忆（效率#17）：id → scrollTop，切走存、切回恢复；beginSession 清空（跨会话不背） */
const readScrollMemo = new Map<string, number>();
const READ_SCROLL_MEMO_MAX = 200; // 上限防涨（FIFO 淘汰最旧即可，不必 LRU）

// ================= 增强包常量与状态 =================
const SEARCH_DEBOUNCE_MS = 180; // 对齐保险库/备忘录
const PANEL_MIN_W = 760; // 桌面缩放钳制（三栏骨架最小可读宽度）
const PANEL_MIN_H = 520;
const PANEL_MAX_W = 1600;
const PANEL_MAX_H = 1000;
/** 剪藏正文缓存（notePath → 剥 frontmatter 后正文；clipping:file-* 目录事件失效） */
const clipBodyCache = new Map<string, string>();
/** 桌面搜索防抖（issue 365 收编 core debounce：尾触语义与原手写定时器等价，面板关闭 cancel） */
const searchDebounced = debounce(() => {
  setSearchKw(deskSearchEl ? deskSearchEl.value.trim() : '');
  renderList();
  renderRail();
}, SEARCH_DEBOUNCE_MS);
let panelResizeDetach: { detach: () => void; flush: () => void } | null = null;
let panelSplit: { el: HTMLElement; restore: () => void; flush: () => void; detach: () => void } | null = null;
/** 分割线钳制：中栏（目录）最小宽 / 右栏（阅读）最小宽（对齐 PANEL_MIN_W 下整体不溢出） */
const SPLIT_MIN_MID = 220;
const SPLIT_MIN_READ = 320;

// ================= 生命周期 =================
/** 幂等初始化面板 DOM（首开建结构 + 装载 + 订阅；重复调用只切可见性） */
export function initPanel(app: any, showNow = false): void {
  M.appRef = app;
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
  topifyZ(overlayEl); // CB1：显示即发号（ADR-0067）——与已发号的其他面板同屏时「后显示恒在上」
  panelSplit?.restore(); // 分割线尺寸记忆（容器可见后 restore 才能按实际宽度钳制）
  M.open = true;
  beginSession();
  // C5/ADR-0063：已装载且无目录事件（!dirty）直接用内存缓存渲染——零扫描瞬时显示；
  // 首开未装载或有变更才异步重读
  if (dirty || !loaded) {
    // 效率#17：首开装载骨架——中栏 dim 占位一行，装载完成 renderAll 自然覆盖；
    // 三栏全空与错误态同貌，先给一句「正在装载」对冲误导（dirty 重载不占位：旧面仍可读）
    if (!loaded && listEl) listEl.innerHTML = '<p class="dim">正在装载剪藏…</p>';
    void loadIfNeeded();
  }
  else renderAll();
  // 效率#6 + 效率#12（桌面）：先给右栏落一次焦点（j/k 即时可用），尾部聚焦搜索框
  // （打开 → 直接打字的本能链路第一步；focus 不 select，已有词不全选）——移动端遵 core
  // 口径跳过聚焦防软键盘
  if (!isMobileEnv()) {
    readPaneEl?.focus({ preventScroll: true });
    deskSearchEl?.focus();
  }
}

/** 装载（防重入 + 首载后保留内存面，目录事件增量走 reloadIfOpen）。
 *  装载完成 = 数据基线更新（新会话）：目录事件引入新剪藏/新 news 后按当前状态重排快照。 */
let loadPromise: Promise<void> | null = null;
function loadIfNeeded(): Promise<void> {
  if (loading) return loadPromise || Promise.resolve();
  if (!M.open && overlayEl) return Promise.resolve();
  loading = true;
  loadPromise = readNewsAndSidecar()
    .then((res) => {
      // C9 + 效率#16：news.json 损坏（status='corrupt'）不再静默——错误态标记 + 错误空态
      //（renderList 分流）+ onRetry 通知，不再呈现「暂无内容」假空态误导。missing（首用引导）语义不动。
      if (res && res.status === 'corrupt') {
        loadError = { kind: 'corrupt', reason: 'news.json 损坏（原文件已保留）' };
        notifyActionError(new Error(loadError.reason), '剪藏本数据读取', { onRetry: retryLoad });
      } else {
        loadError = null;
      }
      dirty = false; loaded = true; beginSession(); renderAll();
    })
    .catch((e) => {
      // 效率#16：装载通道异常（同步盘锁住/权限等）——错误态标记 + onRetry 通知 + 错误空态，
      // 首开不再纯白三栏、错误与真空可辨
      console.error('[剪藏本] 装载失败', e);
      loadError = { kind: 'exception', reason: e instanceof Error ? e.message : String(e) };
      notifyActionError(e, '剪藏本数据读取', { onRetry: retryLoad });
      if (M.open) renderAll();
    })
    .finally(() => { loading = false; loadPromise = null; });
  return loadPromise;
}

/** 错误空态「重试」出口（效率#16）：清错误标记重新装载（成功/失败均由 loadIfNeeded 收敛渲染） */
function retryLoad(): void {
  loadError = null;
  void loadIfNeeded();
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
  // issue 358：关面板前把本段阅读会话封存入账侧写 readLog（时长不因关面板丢失）
  void flushReadingSession();
  panelResizeDetach?.flush(); // 关面板即落盘面板尺寸（review P2：恢复旧 flushPendingSize 语义）
  panelSplit?.flush(); // 关面板即落盘分割线宽度（同上语义）
  hideSelBar(); // CB7：划选工具框挂 body，面板藏了框还悬着（要等下一次 mousedown 才被兜底收走）
  M.open = false;
  M.mobDetailOpen = false;
  // C7：移动详情 overlay 的 DOM 显示态同步复位——原实现只清布尔，重开面板会直接落在上次的详情屏
  if (mobDetailEl) mobDetailEl.style.display = 'none';
  if (overlayEl) overlayEl.style.display = 'none';
}

/** 卸载（main.ts onunload） */
export function unloadPanel(): void {
  pauseReadingSession();
  void flushReadingSession(); // issue 358：卸载同样封存阅读会话入账
  closeItemMenu();
  if (escHandle) {
    try { escHandle.unregister(); } catch (e) { /* 忽略 */ }
    escHandle = null;
  }
  // issue 329：划选工具框清理（document 级监听 + 单例 DOM + 快照）
  document.removeEventListener('selectionchange', onSelectionChanged);
  document.removeEventListener('mousedown', onDocMouseDown, true);
  if (selChangeTimer !== null) {
    clearTimeout(selChangeTimer);
    selChangeTimer = null;
  }
  hideSelBar();
  if (selBarEl) {
    selBarEl.remove();
    selBarEl = null;
  }
  selSnap = null;
  imgSnap = null;
  searchDebounced.cancel();
  if (panelResizeDetach) {
    panelResizeDetach.detach(); // detach 内补落未存的防抖尾值（persist 收尾）
    panelResizeDetach = null;
  }
  if (panelSplit) {
    panelSplit.detach(); // detach 内补落未存的防抖尾值（persist 收尾）
    panelSplit = null;
  }
  clipBodyCache.clear();
  clipBodyInflight.clear(); // 在途读盘位一并清（卸载后迟到读盘只写缓存，不拦重开后的新 kick）
  setSearchKw(''); // 卸载清搜索词（模块级变量，泄漏会污染下一次装载的列表/rail 计数）
  M.open = false;
  M.mobDetailOpen = false;
  loading = false;
  loadPromise = null;
  dirty = false;
  loaded = false;
  loadError = null; // 错误态不跨卸载残留（重开按新装载判定）
  if (overlayEl) overlayEl.remove();
  overlayEl = null;
  readerEl = null;
  readPaneEl = null;
  railListEl = null;
  railFootEl = null;
  listEl = null;
  mobListEl = null;
  mobDetailEl = null;
  mobTitleEl = null; // CB8：置空清单与 buildDom 收集对齐（漏项 = 卸载后残留 DOM 引用）
  mobSaveBtnEl = null; // 同上
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
  // rail 脚注·阅读报告入口（issue 358）：「我读了什么」弹层（剪藏本自有报告，非书库深链）
  railFootEl!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-clp-rep-entry]')) openClipbookReport(app);
  });
  // 审查修复批 P3⑦：入口 role=button tabindex=0 补 Enter/Space（假可达修复，与弹层关闭钮同款）
  railFootEl!.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as HTMLElement).closest('[data-clp-rep-entry]')) {
      e.preventDefault();
      openClipbookReport(app);
    }
  });
  // 移动头行「报告」文字钮（issue 358）：同一弹层
  const mobReportBtn = overlayEl.querySelector('[data-clip-mob-report]');
  mobReportBtn!.addEventListener('click', () => openClipbookReport(app));
  // 桌面 rail 源切换（再点已选源回「全部未读」，issue 208）
  railListEl!.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('[data-src]') as HTMLElement | null;
    if (!row) return;
    toggleSource(JSON.parse(row.dataset.src || 'null'));
  });
  // 桌面搜索（enh 包 1）：180ms 防抖对齐保险库/备忘录；✕ 显隐随词同步（效率#12）
  deskSearchEl!.addEventListener('input', () => { syncDeskSearchClear(); searchDebounced(); });
  // 效率#11：搜索框内 ESC 清词——有词 = 只清词不冒泡（escManager 的 document 层收不到，
  // 防「清词变成关整个面板」）；无词放行（关面板语义不变，与移动「关闭」钮二段语义同向）
  deskSearchEl!.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !deskSearchEl!.value.trim()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearDeskSearch();
  });
  // 效率#12：尾部 ✕ 一键清除（有词才显示，syncDeskSearchClear 同步）——点 = 清词 + 刷新 + 焦点回框
  overlayEl.querySelector('[data-clip-search-clear]')?.addEventListener('click', () => clearDeskSearch());
  // 右栏常驻委托（enh 包 3/6c）：正文外链（md 锚点 data-clip-ext）+「打开笔记」点击 + ←→/jk 条目切换
  readPaneEl!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const ext = t.closest('a[data-clip-ext]') as HTMLAnchorElement | null;
    if (ext) { e.preventDefault(); openExternalUrl(getApp(), ext.href); return; }
    // issue 329：划词锚定双链点击 → 文献盒内拦下直达预览（目录外不拦原生导航）。
    // stopPropagation 必须有：Obsidian 对 internal-link 另有自己的监听，只 preventDefault 挡不住
    // ——预览与原生导航同时发生，移动端两者相争直接崩（用户实测 OB 重启）
    const ilink = t.closest('a.internal-link') as HTMLAnchorElement | null;
    if (ilink && interceptKnowledgeLink(ilink)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // issue 329：正文图片单击 → 图片工具框（保存图片 / 存为图版）
    const img = t.closest('img');
    if (img && img.closest('[data-clip-md]')) { e.preventDefault(); showImageSelBar(img as HTMLImageElement); return; }
    if (t.closest('[data-clip-open-note]') && M.cur) openNote(M.cur);
  }, true); // capture：先于 Obsidian 的 internal-link 监听
  readPaneEl!.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // CB5：修饰键组合不劫持（Ctrl/Cmd+K 等还给自己）
    // C-UI3：「打开笔记」role=button tabindex=0 补键盘可达（railFoot 入口同款修复，Enter/Space 触发）
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest?.('[data-clip-open-note]')) {
      e.preventDefault();
      if (M.cur) openNote(M.cur);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); stepArticle(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); stepArticle(1); }
  });
  // issue 329：划选工具框事件（桌面右栏）——mouseup 即时检查、滚动即收（scroll 不冒泡，直绑滚动容器）
  readPaneEl!.addEventListener('mouseup', onReaderMouseUp);
  const readScrollEl = readPaneEl!.querySelector('.bz-clip-read-scroll');
  if (readScrollEl) readScrollEl.addEventListener('scroll', hideSelBar, { passive: true });
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
  mobBackBtn!.addEventListener('click', () => closeMobDetail());
  // 移动：头栏保存钮（文字钮「存为剪藏 / 已存」）
  mobSaveBtnEl!.addEventListener('click', () => {
    if (M.cur?.st === 'saved') return; // 已存置灰（issue 329 评审）：重复保存会冲掉划词标记并重复下载图片
    void doSave(M.cur);
  });
  // 移动详情「读下一则」（原型脚；同章内下一则，章末回目录）——按 id 定位（目录条目为重建实例，indexOf 恒 -1）
  // 点压缩制前先放行正文外链（data-clip-ext，与桌面右栏同一打开链）
  mobDetailEl!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const ext = t.closest('a[data-clip-ext]') as HTMLAnchorElement | null;
    if (ext) { e.preventDefault(); openExternalUrl(getApp(), ext.href); return; }
    // issue 329：移动详情同款——双链直达预览拦截 + 图片单击工具框（桌面/移动同套逻辑）
    const ilink = t.closest('a.internal-link') as HTMLAnchorElement | null;
    if (ilink && interceptKnowledgeLink(ilink)) {
      // 同桌面：capture + 掐断传播，防 Obsidian 原生导航与预览同时发生（移动端崩溃源）
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const img = t.closest('img');
    if (img && img.closest('[data-clip-mob-md]')) { e.preventDefault(); showImageSelBar(img as HTMLImageElement); return; }
    if (!t.closest('[data-clip-mob-next]') || !M.cur) return;
    const grp = mobItemOrder.filter((x) => x.srcName === M.cur!.srcName);
    const idx = grp.findIndex((x) => x.id === M.cur!.id);
    const next = grp[idx + 1];
    if (next) openMobDetail(next.id); else (mobBackBtn as HTMLElement).click();
  }, true); // capture：同桌面右栏
  // issue 329：划选工具框事件（移动详情正文 + 双端公共层）——mouseup / selectionchange 防抖双端同套
  mobDetailEl!.addEventListener('mouseup', onReaderMouseUp);
  const mobBodyScrollEl = overlayEl.querySelector('[data-clip-mob-detail-body]');
  if (mobBodyScrollEl) mobBodyScrollEl.addEventListener('scroll', hideSelBar, { passive: true });
  document.addEventListener('selectionchange', onSelectionChanged);
  document.addEventListener('mousedown', onDocMouseDown, true);
  // issue 341：移动端正文划选——原生长按菜单（剪切/复制/粘贴）与划选工具框同位抢位，
  // 正文容器内拦下 contextmenu（Android WebView 认 preventDefault 的那条路径；iOS 走 styles.css
  // 的 -webkit-touch-callout）。capture：先于 Obsidian 自己的正文监听。作用域只到正文容器
  // （[data-clip-md]/[data-clip-mob-md]）——列表卡片右键菜单、桌面右键均不受影响。
  overlayEl.addEventListener('contextmenu', onReaderContextMenu, true);

  // ESC（C19：详情屏开着时第一层收详情返回列表，再按一次才关面板）
  escKey = 'bz-clipbook';
  escHandle = escManager.register(escKey, {
    isVisible: () => !!overlayEl && overlayEl.style.display !== 'none',
    close: () => {
      if (M.mobDetailOpen) { closeMobDetail(); return; }
      closePanel();
    },
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
  // C-UI7：移动搜索栏一并复位——原实现只清桌面词，通知「查看」定位链换源后移动输入框
  // 仍有词、列表却按无词全量渲染，两端打架
  if (mobSearchbarEl) mobSearchbarEl.style.display = 'none';
  const mobInput = overlayEl ? (overlayEl.querySelector('[data-clip-mob-input]') as HTMLInputElement | null) : null;
  if (mobInput) mobInput.value = '';
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

/** ✕ 显隐同步（效率#12）：有词才显示（input/ESC/✕/开面板四路都过这里） */
function syncDeskSearchClear(): void {
  const btn = overlayEl ? (overlayEl.querySelector('[data-clip-search-clear]') as HTMLElement | null) : null;
  if (btn) btn.hidden = !deskSearchEl?.value.trim();
}

/** 桌面清词统一出口（效率#11 ESC / 效率#12 ✕ 同一收口）：输入框与状态词清空 +
 *  ✕ 显隐同步 + 列表/rail 刷新 + 焦点回框 */
function clearDeskSearch(): void {
  if (deskSearchEl) deskSearchEl.value = '';
  setSearchKw('');
  syncDeskSearchClear();
  renderList();
  renderRail();
  deskSearchEl?.focus();
}
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
  if (M.mobDetailOpen) {
    if (M.cur) renderMobDetail();
    else {
      // C20：详情开着但当前条目已消失（被删且列表清空 → M.cur=null）→ 收起详情 overlay，
      // 不留残留的已删文章详情屏（重开面板/返回钮之外的静默收口）
      M.mobDetailOpen = false;
      if (mobDetailEl) mobDetailEl.style.display = 'none';
    }
  }
}

/** 移动详情屏 → 返回列表（返回钮与 ESC 第一层共用；C19）。
 *  审查修复批 P2②：详情动线接入会话计时（与桌面同套）——返回目录 = 详情段封存入账。 */
function closeMobDetail(): void {
  pauseReadingSession();
  void flushReadingSession();
  M.mobDetailOpen = false;
  if (mobDetailEl) mobDetailEl.style.display = 'none';
  renderAll();
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

/** 会话边界（ADR-0108）：每次打开面板 = 新会话 = 重排点——递增世代使全部快照失效、折叠默认态复位。
 *  C16：移动端折叠记忆（expandedMobArch）与桌面 deskFoldOpen 同口径在此复位——原实现只在
 *  卸载时清，重开面板仍停在上次展开的「已读/已收」段；详情往返不经过本函数，态不丢。 */
function beginSession(): void {
  epochReset();
  deskFoldOpen.clear();
  deskFoldTouched.clear();
  expandedMobArch.clear();
  readScrollMemo.clear(); // 效率#17：滚位记忆是会话内的，重开面板不背旧位
}

/** 搜索谓词（中栏列表过滤与 rail 计数共用——issue 206：搜索时各源统计联动）。
 *  hay 域（效率#15）：title/summary/site/srcName/author/tags 之外补 body 与 url——
 *  news 条目 body 已在内存（issue 274 起正文保留），零 IO；url 是 articleKeyOf 的键（数据在手）。
 *  clip 条目正文在盘上不进 hay（全文阈值检索未拍板，placeholder 口径如实）。 */
function matchesSearch(a: ClipArticle): boolean {
  const kw = (searchKw || '').toLowerCase();
  if (!kw) return true;
  return a.title.toLowerCase().includes(kw) ||
    a.summary.toLowerCase().includes(kw) ||
    a.site.toLowerCase().includes(kw) ||
    a.srcName.toLowerCase().includes(kw) ||
    a.author.toLowerCase().includes(kw) ||
    a.body.toLowerCase().includes(kw) ||
    a.url.toLowerCase().includes(kw) ||
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

  // B站 UP 展开（C2：Map 按 author/uid 去重；C6：upInfo 回填名字显示）。
  // 效率#5：改**全量**收集（原 !a.read 未读面——UP 未读归零整行消失，往期无处可去）；
  // 未读数照实显 0（cnt 现查），排序已有未读降序兜底不碍位
  const biliUps = new Map<string, string>(); // key=author 原始值（uid），value=展示名（回填回退）
  for (const a of arts) {
    if (a.platform === 'B站' && a.author) {
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

  // 剪藏本（聚合，saved 语义；搜索时显示命中数）——剪藏本源无未读语义，不挂批量已读钮
  const clipActive = M.sel.kind === 'clip';
  const clipHit = countOf({ kind: 'clip' });
  html += railItemHtml({ kind: 'clip' }, '剪藏本', clipHit, clipNotes.length, 'clip', '', clipActive, '');

  railListEl.innerHTML = html;
  mountIcons(railListEl);
  // rail 脚注（issue 214）：今日已读 N 篇（news.json stats.byDate，键 YYYY-MM-DD；缺省 0）
  // + 阅读报告入口（issue 358「我读了什么」；行为委托 buildDom 里 data-clp-rep-entry）
  if (railFootEl) {
    railFootEl.innerHTML = railFootHtml(M.stats?.byDate?.[localDayKey()] || 0) + clipReportEntryHtml();
    mountIcons(railFootEl); // 审查修复批 P3⑥：入口 chevron-right 图标兑现（innerHTML 后必须补挂）
  }
  // rail 源行动作（enh 包 4）：右键/长按出「全部标为已读」等源级批量操作——
  // rail 是导航层，动作挂在源行而非条目卡，中栏「列表零操作」拍板不被破坏
  const rows = railListEl.querySelectorAll<HTMLElement>('[data-src]');
  rows.forEach((row) => {
    let sel: any = null;
    try { sel = JSON.parse(row.dataset.src || 'null'); } catch (e) { return; }
    if (!sel) return;
    // C1：site 行必须进 site 源分支——原三元链缺该分支时落 {kind:'all'}，站点右键「全部标为已读（N 篇）」
    // 的 N 变成**全库未读**数、确认框却写「把「某站点」的 N 篇…」，一次确认把整个未读流标读
    const source = sel.kind === 'clip'
      ? { kind: 'clip' as const }
      : sel.kind === 'inbox'
        ? { kind: 'inbox' as const, platform: String(sel.platform || ''), up: sel.up ? String(sel.up) : undefined }
        : sel.kind === 'site'
          ? { kind: 'site' as const, site: String(sel.site || '') }
          : { kind: 'all' as const };
    const actions = buildRailActions(String(row.title || ''), source);
    if (actions.length) attachItemActions(row, actions, { sheetTitle: String(row.title || ''), menuClass: 'bz-clip-menu-editorial' });
  });
}

/** 报告 Top5 回看入口（效率#20）：按条目 key（articleKeyOf / clip:<path>）定位并选中。
 *  clip 条目走 revealClipArticle（切剪藏本源 + 装载后定位）；news 条目切「全部未读」源后
 *  selectArticle（deskFlat 快照含已读/已收骨架——报告榜上几乎全是已处理条目）。
 *  数据未装载时先开面板触发装载，完成后重试一次；定位失败保持面板打开，不抛错。 */
export function revealArticleByKey(key: string): void {
  const k = String(key || '');
  if (!k) return;
  if (k.startsWith('clip:')) { void revealClipArticle(k.slice('clip:'.length)); return; }
  const trySelect = (): boolean => {
    // M.articles 存 news.json raw（无 .id）——条目 id 由 articleKeyOf 派生（ClipArticle.id 同式）
    const hit = M.articles.find((x) => articleKeyOf(x) === k);
    if (!hit) return false;
    if (!M.open) showPanel();
    selectSource({ kind: 'all' });
    selectArticle(articleKeyOf(hit));
    return true;
  };
  if (trySelect()) return;
  showPanel();
  void loadIfNeeded()
    .then(() => { trySelect(); })
    .catch(() => { /* 装载失败保持原状 */ });
}

/** 该源未读 news 数（效率#4）：移动章头常驻灰态钮的显隐与 N 口径 = buildRailActions 的
 *  unreadList.length（queryBySource 未处理流 ∩ origin==='news'；剪藏条目无未读语义不计）。
 *  桌面 rail 的行内 ✓✓ 钮已退役（2026-09-19），本函数现服务移动章头 + rail 源级动作判定。 */
function railUnreadN(source: SrcFilter): number {
  return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], source, M.upInfo)
    .filter((a) => a.origin === 'news').length;
}

/** rail 源级动作（enh 包 4）：该源还有未读时提供「全部标为已读」；剪藏本源无未读语义不挂。
 *  2026-09-19 起是桌面端源级批量已读的唯一入口（行内钮退役，右键菜单触发）。 */
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

/** 批量已读：确认框写明 N 篇 → 单次读改写落盘 → 撤销兜底（flowUndoMarkAllRead 恢复快照）。
 *  通知篇数取返回的实际 bumped（新-9：确认框停留窗口内竞态不虚报）；bumped=0（窗口内
 *  已被「打开即已读」消化）不弹假通知。 */
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
  const { bumped, snapshot } = await flowMarkAllRead(items.map((a) => a.raw).filter(Boolean));
  if (!bumped) { await refreshAfterAction(); return; }
  notifyUndo(`已把 ${bumped} 篇标为已读`, () => void (async () => {
    await flowUndoMarkAllRead(snapshot);
    notice('已撤销：条目恢复未读', 'success');
    await refreshAfterAction();
  })());
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
  // 效率#16：装载错误态分流——错误空态（图标 + 原因 + 重试钮）替代引导空态，
  // 防 corrupt/读盘异常呈现「暂无内容」假空态误导用户以为数据全丢
  if (loadError) {
    listEl.innerHTML = '';
    listEl.appendChild(uiEmpty({
      icon: 'circle-alert',
      title: `剪藏本数据读取失败：${loadError.reason}`,
      actions: uiBtn({ label: '重试', icon: 'rotate-ccw', onClick: () => retryLoad() }),
    }));
    M.cur = null;
    if (readerEl) renderReader();
    return;
  }
  const src = currentSrc();
  if (src.kind === 'clip') {
    // 剪藏本源：全量平铺（冻结序不适用；read/saved 均无语义）
    const list = queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo).filter((a) => !searchKw || matchesSearch(a));
    if (!list.length) {
      listEl.innerHTML = '';
      // C15：搜索零命中走「查无此条」（news 源同态文案），不误报「剪藏本为空」
      listEl.appendChild(uiEmpty({ icon: 'scissors', title: searchKw ? '查无此条' : '剪藏本为空' }));
      M.cur = null;
      if (readerEl) renderReader();
      return;
    }
    if (!list.some((a) => a.id === (M.cur && M.cur.id))) {
      M.cur = list[0];
      // F4：重选后同步右栏——防「高亮 A 读 B」（搜索命中悄悄换选中，阅读区仍显示旧文章，
      // j/k 从幻觉位置步进）；renderAll 路径下与外层 renderReader 重复渲染一次，幂等无害
      if (readerEl) renderReader();
    }
    listEl.innerHTML = tocListHtml(list, M.cur ? M.cur.id : null, (a) => relTime(a.timeTs), searchKw);
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
    listEl.innerHTML = tocListHtml(hit, curId, timeOf, searchKw);
    M.list = hit;
    bindItemMenus();
    return;
  }
  const b = dirFor(src);
  const snapUnreadN = b.unread.length; // 快照桶大小 = 打开目录时未读数（会话内读完不触发闪开）
  // 非搜索态 kw 恒空（折叠段内不高亮）；统一传参，搜索语义单点在 tocListHtml
  let html = tocListHtml(b.unread, curId, timeOf, searchKw);
  // 已读段（快照 read 桶；默认收起——打开即无未读且已收空时自动展开兜底）
  if (b.read.length) {
    const open = deskFoldIsOpen('read', b.read.length, b.saved.length, snapUnreadN);
    html += deskFoldRowHtml('read', b.read.length, open);
    html += foldBodyHtml(tocListHtml(b.read, curId, timeOf, searchKw), open);
  }
  // 已收段（快照 saved 桶；打开即无未读默认展开）
  if (b.saved.length) {
    const open = deskFoldIsOpen('saved', b.saved.length, b.saved.length, snapUnreadN);
    html += deskFoldRowHtml('saved', b.saved.length, open);
    html += foldBodyHtml(tocListHtml(b.saved, curId, timeOf, searchKw), open);
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
    // menuClass：菜单挂 body（域内后代选择器不可达），编辑部皮肤靠根挂类生效（同 memo 皮肤先例）。
    // 抽屉头对齐核心标准（issue 329 追加修订）：sheetTitle/sheetSub 走 item-actions 组件库两行头部
    // （自带省略截断），域内自绘头部退役
    attachItemActions(card, actions, { sheetTitle: art.title, sheetSub: art.summary || undefined, menuClass: 'bz-clip-menu-editorial' });
    // 单击选中 → 阅读
    card.addEventListener('click', (e) => {
      if (e.target && (e.target as HTMLElement).closest('.bz-item-sheet')) return;
      selectArticle(art.id);
      // 效率#6：焦点接力右栏——点目录即「通电」j/k，不必再点一下右栏才知道快捷键活着
      if (!isMobileEnv()) readPaneEl?.focus({ preventScroll: true });
    });
  });
  // 桌面折叠行点击/键盘开合（已读/已收两段独立；renderList 重建 DOM 后重挂）。
  // C-UI5：deskFoldRowHtml 已带 tabindex="0"，此处补 Enter/Space——键盘/开关类辅助工具可达
  listEl.querySelectorAll<HTMLElement>('[data-desk-fold]').forEach((row) => {
    const toggle = () => {
      const kind = (row.getAttribute('data-desk-fold') as 'read' | 'saved') || 'saved';
      toggleDeskFold(kind);
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
  });
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
  // B站条目不提供保存至剪藏（ADR-0147 推翻 ADR-0068 分流保存；知识盒影像入口仍可录 B站链接）
  if (a.st !== 'saved' && a.raw?.platform !== 'B站') {
    out.push({ icon: 'download', label: '保存到剪藏本', title: '保存为正式剪藏', onClick: () => void doSave(a) });
  }
  // issue 329 追加修订：复制原文链接（桌面右键与移动长按抽屉共用此函数，一处接入两端生效）
  out.push({ icon: 'link', label: '复制原文链接', onClick: () => void copyText(a.url, '原文链接已复制') });
  // C14：已读/已收条目不再挂「标记为已读」——doMarkRead 的 st!=='unread' 守卫会静默吞掉，菜单不给无效入口
  if (a.st === 'unread') {
    out.push({ icon: 'check', label: '标记为已读', title: '不再出现在收件流', onClick: () => void doMarkRead(a) });
  }
  out.push({ icon: 'trash-2', label: '删除', kind: 'danger', title: '从收件流删除', onClick: () => deleteNewsItem(a) });
  return out;
}

// ================= 渲染：右栏阅读 =================
/** 正文 Obsidian 内置渲染（issue 273 review；diary/knowledge 同范式）：MarkdownRenderer 异步
 *  水合占位容器；渲染失败/空产出回退纯文本。alive = 竞态守卫（切篇后容器随重渲重建，丢弃迟到水合） */
async function hydrateArticleMarkdown(el: HTMLElement, md: string, sourcePath: string, alive: () => boolean): Promise<void> {
  try {
    const comp = new Component();
    await MarkdownRenderer.render(getApp(), md, el, sourcePath, comp);
    comp.unload();
  } catch { /* 渲染失败 → 纯文本兜底 */ }
  if (!alive()) return;
  if (!el.querySelector('*') || !el.textContent?.trim()) el.textContent = md;
  // C6：bindImgFallback 在异步水合之前跑过（当时容器里还没有 img）——水合产出后才插入的图片
  // 需补挂失败监听，否则外链图加载失败留裂图（issue 206 全链路失效）
  bindImgFallback(el);
}

/** 渲染前正文变换（issue 329 / ADR-0144）：news 条目按侧写追踪（划词 marks + 已存图片映射）
 *  跑 applyBodyTransforms 后再交 MarkdownRenderer；无标记零开销原样返回。
 *  clip 条目正文即盘上原文（已保存条目划词直写 md，不走侧写），不在此变换。
 *  ADR-0122 契约不受影响：变换发生在字符串层，渲染前容器清空、追加渲染照旧。 */
function transformBodyForRead(a: ClipArticle, body: string): string {
  if (a.origin !== 'news') return body;
  const marks = ((M.sidecar as any).marks as Record<string, ClipMark[]> | undefined)?.[a.id] || [];
  const swaps = ((M.sidecar as any).savedImages as Record<string, Array<{ src: string; local: string }>> | undefined)?.[a.id] || [];
  if (!marks.length && !swaps.length) return body;
  return applyBodyTransforms(body, marks, swaps).body;
}

/** 正文图片加载失败隐藏（外链图缓存失效/断网时不留裂图；MarkdownRenderer 产出的 img 无专属类，按容器取） */
function bindImgFallback(container: HTMLElement): void {
  container.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });
    // CB6：挂监听前已加载失败的图（缓存 404/慢网竞态，error 不会再触发）——按 complete + naturalWidth 直判摘除
    if (img.complete && img.naturalWidth === 0) img.remove();
  });
}

/** 测试钩子：CB6 回归用（bindImgFallback 私有，经渲染链驱动成本过高） */
export function __bindImgFallbackForTests(container: HTMLElement): void {
  bindImgFallback(container);
}

function renderReader(): void {
  if (!readerEl) return;
  const a = M.cur;
  hideSelBar(); // 切篇/重渲收工具框（旧选区 rect 已失效）
  applyReaderFontSize();
  if (!a) {
    readerEl.innerHTML = '';
    readerEl.appendChild(uiEmpty({ icon: 'book-open', title: '从列表选择一篇文章开始阅读' }));
    return;
  }
  // issue 358：会话计时携带条目元信息（title/srcName）——封存入账 readLog 时「哪篇、哪里来」
  setReadingSession(a.id, { title: a.title, src: a.srcName });
  // 正文（issue 273 review）：news 直用 body；clip 懒加载 cachedRead → 剥壳缓存原文；
  // markdown 一律交 Obsidian MarkdownRenderer 异步水合（note = 容器占位文案）
  let body = '';
  let note = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    if (cached !== undefined) {
      body = cached;
      if (!body) note = '（笔记暂无正文）';
    } else {
      note = '正在读取剪藏正文…';
    }
  } else {
    body = a.body;
    if (!body) note = '正文已清空（已处理条目）';
  }

  readerEl.innerHTML = readerHtml(a, { time: a.timeText || relTime(a.timeTs), note });
  // 活动篇标记（issue 329 第三批）：loadClipBody 双端 kick 后，桌面容器可能仍显旧篇
  // （移动详情切篇不重渲桌面）——hydrateActiveClipBody/clipBodyReadFail 桌面分支按此防串篇
  readerEl.dataset.clipReaderId = a.id;
  mountIcons(readerEl);
  bindImgFallback(readerEl);
  const mdEl = readerEl.querySelector('[data-clip-md]') as HTMLElement | null;
  if (mdEl && body) {
    // issue 329：渲染前按侧写标记变换（划词双链 + 已存图片换链），news.json 原文不被写
    void hydrateArticleMarkdown(mdEl, transformBodyForRead(a, body), a.notePath || '', () => !!M.cur && M.cur.id === a.id && !!readerEl && readerEl.contains(mdEl));
  }
  if (a.origin === 'clip') void loadClipBody(a);
}

/** 剪藏正文就绪后的双端原位水合（loadClipBody 完成回调，issue 329 第三批）：
 *  桌面右栏 [data-clip-md] 与移动详情 [data-clip-mob-md] 谁在展示当前条目就水合谁（可同时），
 *  各自 alive 守卫防迟到水合串篇；空正文 = 占位终态（不与水合共存）。
 *  C5：MarkdownRenderer.render 是**追加**语义（铁律 6）——水合前清掉「正在读取剪藏正文…」占位，
 *  否则正文顶部永久残留占位一行。 */
function hydrateActiveClipBody(a: ClipArticle, body: string): void {
  const targets: Array<{ host: HTMLElement | null; sel: string; dim: boolean; alive: (md: HTMLElement) => boolean }> = [
    {
      host: readerEl, sel: '[data-clip-md]', dim: true,
      // 桌面守卫叠 dataset.clipReaderId：移动 kick 读盘期间桌面可能还显旧篇，防把新正文水合进旧篇容器
      alive: (md) => !!readerEl && readerEl.dataset.clipReaderId === a.id && !!M.cur && M.cur.id === a.id && readerEl.contains(md),
    },
    {
      host: mobDetailEl, sel: '[data-clip-mob-md]', dim: false,
      alive: (md) => M.mobDetailOpen && !!M.cur && M.cur.id === a.id && !!mobDetailEl && mobDetailEl.contains(md),
    },
  ];
  for (const t of targets) {
    const md = t.host ? (t.host.querySelector(t.sel) as HTMLElement | null) : null;
    if (!md || !t.alive(md)) continue;
    if (!body) {
      md.innerHTML = `<p${t.dim ? ' class="dim"' : ''}>（笔记暂无正文）</p>`;
      continue;
    }
    md.innerHTML = '';
    void hydrateArticleMarkdown(md, body, a.notePath || '', () => t.alive(md));
  }
}

/** 剪藏正文读取失败的双端占位（issue 329 第三批：移动详情与桌面同文案，可打开笔记查看） */
function clipBodyReadFail(a: ClipArticle): void {
  if (readerEl && readerEl.dataset.clipReaderId === a.id && M.cur && M.cur.id === a.id) {
    const md = readerEl.querySelector('[data-clip-md]') as HTMLElement | null;
    if (md) md.innerHTML = `<p class="dim">正文读取失败，可打开笔记查看</p>`;
  }
  if (M.mobDetailOpen && M.cur && M.cur.id === a.id && mobDetailEl) {
    const md = mobDetailEl.querySelector('[data-clip-mob-md]') as HTMLElement | null;
    if (md) md.innerHTML = `<p>正文读取失败，可打开笔记查看</p>`;
  }
}

/** 在途读盘去重（同 path 单飞，issue 329 第三批）：renderReader 与 renderMobDetail 存在
 *  同帧连续调用路径（renderAll 等），同一未缓存 clip 篇会被双 kick——双读盘后两次「清空+追加」
 *  水合在 MarkdownRenderer 追加语义（铁律 6）下叠出重复正文；后到 kick 直接 return，
 *  先到完成后 hydrateActiveClipBody 双端统一水合已覆盖。失败也清位防永久卡死 */
const clipBodyInflight = new Set<string>();

/** 剪藏正文懒加载（enh 包 3）：cachedRead → 剥 frontmatter/dataviewjs → 按 path 缓存**原文**；
 *  完成/失败时按当前活动视图原位水合（issue 329 第三批起双端：桌面右栏 + 移动详情；
 *  MarkdownRenderer，不整篇重渲染，防滚动位置重置）。renderReader/renderMobDetail 均可 kick，幂等 */
async function loadClipBody(a: ClipArticle): Promise<void> {
  const path = a.notePath;
  if (!path || clipBodyCache.has(path) || clipBodyInflight.has(path)) return;
  const note = a.note as ClipNote | undefined;
  if (!note || !note.file) return;
  clipBodyInflight.add(path);
  let body = '';
  try {
    body = stripClipChrome(await getApp().vault.cachedRead(note.file));
  } catch (e) {
    clipBodyInflight.delete(path);
    clipBodyReadFail(a);
    return;
  }
  clipBodyInflight.delete(path);
  clipBodyCache.set(path, body);
  hydrateActiveClipBody(a, body);
}

/** 目录事件失效正文缓存（enh 包 3；index.ts registerAutoRefresh 调用） */
export function invalidateClipBodyCache(path: string): void {
  clipBodyCache.delete(String(path || ''));
}

/** 测试钩子：正文缓存键快照（C18 回归——rename 必须按 oldPath 失效旧键，否则缓存只增不减） */
export function __clipBodyCacheKeysForTests(): string[] {
  return [...clipBodyCache.keys()];
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

/** ←→/jk 条目切换（右栏聚焦时）。C8：步进集必须与目录同集——
 *  搜索态 = 命中平铺集（防切到不在命中列表、目录无高亮的条目）；剪藏本源 = 平铺列表
 *  （原 dirFor().unread 对 clip 源恒空，j/k 静默无效）；其余 news 源 = 未读桶快照序。 */
function stepArticle(delta: number): void {
  const src = currentSrc();
  const list = searchKw
    ? M.list
    : src.kind === 'clip'
      ? currentList()
      : dirFor(src).unread;
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
  // 效率#17：会话内滚位记忆——切走先存当前篇 scrollTop（上限 FIFO 防涨），落位后恢复目标篇
  // 的记忆值；无记忆 = 归顶（维持 issue 206「切换从开头读」语义，仅「回看」方向受益）
  const readScroller = () => (readPaneEl ? (readPaneEl.querySelector('.bz-clip-read-scroll') as HTMLElement | null) : null);
  if (changed && M.cur) {
    const sc = readScroller();
    if (sc) {
      if (readScrollMemo.size >= READ_SCROLL_MEMO_MAX) {
        const oldest = readScrollMemo.keys().next().value;
        if (oldest !== undefined) readScrollMemo.delete(oldest);
      }
      readScrollMemo.set(M.cur.id, sc.scrollTop);
    }
  }
  M.cur = a;
  // ADR-0108 Q5：桌面也「打开即已读」——与移动同动线（含 ←→/jk 步进）；会话内原位灰显
  markReadOnOpen(a);
  renderList();
  renderReader();
  renderMobDetail();
  if (changed) {
    const sc = readScroller();
    if (sc) sc.scrollTop = readScrollMemo.get(a.id) || 0;
  }
  // 效率#6：焦点接力右栏（j/k 即时可用；preventScroll 防落焦跳动滚动位）
  if (!isMobileEnv()) readPaneEl?.focus({ preventScroll: true });
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
  // F3：已读/已收条目不重复标读——防统计重复计数 + 重复 news:read 事件（smartcat 三跳重复喂），
  // 防「已收」条目 state:'saved' 被覆盖成 'skipped'（日后删除剪藏时该条从已收掉进已读，统计虚增）
  if (a.st !== 'unread') return;
  // C32：动作前快照按磁盘现态重取——「打开即已读」已把内存 raw.read 同步置 true（会话读取位），
  // 直接 {...a.raw} 会把污染态当动作前态，6 秒内撤销「恢复未读」实际仍已读
  const rawBefore = await rawBeforeFromDisk(a);
  let res;
  try {
    res = await flowMarkRead(a);
  } catch (e) {
    // CB2 UI 半：写层抛错不再 unhandled——人话错误 toast（写层透传由批 B 落地，未透传时本 catch 不触发）
    notifySaveError(e, '标记已读');
    return;
  }
  if (!res.changed) {
    // 盘面已是目标态（落盘窗口内重复标读；flow 内已守卫不发事件）→ 不给假撤销，只收敛显示
    await refreshAfterAction();
    return;
  }
  notifyUndo(`已将「${a.title}」标为已读`, () => void undoMarkRead(rawBefore));
  await refreshAfterAction();
}

/** 动作前 raw 快照（C32）：以磁盘现态为准（读不到盘/条目不在则回退内存 raw，不阻断动作） */
async function rawBeforeFromDisk(a: ClipArticle): Promise<any> {
  const key = articleKeyOf(a.raw || {});
  try {
    const res = await readNewsData();
    const hit = res.ok && !res.missing
      ? (res.data.articles || []).find((x: any) => articleKeyOf(x) === key)
      : null;
    if (hit) return { ...hit };
  } catch (e) { /* 读盘异常 → 回退内存快照 */ }
  return { ...(a.raw || {}) };
}

/** 撤销标记已读（enh 包 5）：恢复动作前条目态 + 统计回退，走串行写回队列 */
async function undoMarkRead(rawBefore: any): Promise<void> {
  try {
    await flowUndoHandled(rawBefore);
  } catch (e) {
    notifySaveError(e, '撤销'); // CB2 UI 半：撤销链失败可感知，不再 unhandled rejection
    return;
  }
  notice('已撤销：条目恢复未读', 'success');
  await refreshAfterAction();
}

/** 删除 news 条目（效率整改 5 免确认口径：notifyUndo 撤销兜底已覆盖误删风险，
 *  确认 + 撤销双保险只是多一次打断；对齐 memo 先例——点删除 → 已删除 + 撤销，一道） */
async function deleteNewsItem(a: ClipArticle): Promise<void> {
  const rawBefore = { ...(a.raw || {}) }; // 动作前快照（撤销插回 news.json 用）
  try {
    await flowDeleteNews(a);
  } catch (e) {
    notifySaveError(e, '删除条目'); // CB2 UI 半：删除链失败可感知，不再 unhandled rejection
    return;
  }
  void clearArticleTracking(a.id).catch(() => { /* 侧写残留无害，不阻断删除 */ });
  notifyUndo(`已删除条目「${a.title}」`, () => void undoDeleteNews(rawBefore));
  await refreshAfterAction();
}

/** 撤销删除 news 条目（enh 包 5）：raw 快照插回 news.json，走串行写回队列 */
async function undoDeleteNews(rawBefore: any): Promise<void> {
  await flowUndoDeleteNews(rawBefore);
  notice('已撤销删除：条目已恢复', 'success');
  await refreshAfterAction();
}

/** 删除剪藏笔记（效率整改 5 免确认 + issue 336/ADR-0149 trash 前 source 降级）：
 *  文件级删除进系统回收站 + 内容快照撤销原路径重建，双兜底覆盖误删，不再前置确认。
 *  导出仅供删除流集成测试复用（真实入口 = 条目动作菜单的删除项）。 */
export async function deleteClipNote(a: ClipArticle): Promise<void> {
  const note = a.note as ClipNote | undefined;
  if (note && note.file) {
    try {
      const path = a.notePath || note.path || '';
      let content = '';
      try { content = await getApp().vault.cachedRead(note.file); } catch (e) { /* 快照失败也继续删 */ }
      // issue 336 / ADR-0149 决策 1：trash 前把知识盒卡片里指向本剪藏的 source 降级回外链
      // （无 url 剪藏 → 改调摘除；trash 后 md-deleted 消费者对已退役卡片天然幂等跳过）。
      // 降级失败不阻断删除（同 materializeTracking 接受口径）；走跨域门面动态 import（ADR-0002）。
      try {
        const mod: any = await import('../knowledge');
        if (typeof mod.retireKnowledgeSourcesForClip === 'function') {
          await mod.retireKnowledgeSourcesForClip(getApp(), path, a.url || '');
        }
      } catch (e) {
        console.warn('[剪藏本] 知识卡片来源回退失败（接受，静默）', e);
      }
      await getApp().vault.trash(note.file, true); // 系统回收站（enh 包 5：替代硬删除）
      clipBodyCache.delete(path);
      void clearArticleTracking(a.id).catch(() => { /* 侧写残留无害，不阻断删除 */ });
      notifyUndo(`已删除剪藏「${a.title}」（已移入系统回收站）`, () => void undoTrashClip(path, content));
      await refreshAfterAction();
    } catch (e) {
      // 一致#15：错误人话化——动作名 + 原因 + 重试途径，替换无归因的「请检查文件权限」
      notifyActionError(e, '删除剪藏');
    }
  }
}

/** 撤销删除剪藏笔记（enh 包 5）：按动作前内容快照在原路径重建。
 *  P3 新-5：create 前目录兜底——用户顺手清了空目录时 create 直接抛错卡在最后一步，
 *  缺目录先补建；失败文案分型（同名冲突 / 其他原因），不再单一归因「同名文件」误导排查 */
async function undoTrashClip(path: string, content: string): Promise<void> {
  if (!path) return;
  try {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (dir && !getApp().vault.getAbstractFileByPath(dir)) {
      try { await getApp().vault.createFolder(dir); } catch (e) { /* 并发建目录竞态无害 */ }
    }
    await getApp().vault.create(path, content);
    clipBodyCache.delete(path);
    notice('已撤销删除：剪藏已恢复', 'success');
    await refreshAfterAction();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    notice(/exist|已存在/i.test(msg) ? '撤销失败：原路径已存在同名文件' : `撤销失败：${msg}，请重试`, 'error');
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
    notifyActionError(e, '复制'); // 一致#15：带原因可辨（剪贴板权限/非安全上下文各归其位）
  }
}

/**
 * 动作后刷新（数据面 + 列表 + rail 计数 + 阅读区）。
 * ADR-0108 冻结序：标读/收藏后条目**原位保留**（快照不动），M.cur 保持当前条目、不跳位；
 * 仅条目真消失（删除/剪藏目录删除）才补位到同位置下一条。
 */
async function refreshAfterAction(): Promise<void> {
  const prevId = M.cur?.id;
  const prevIdx = M.cur ? deskFlat().findIndex((x) => x.id === prevId) : -1;
  await readNewsAndSidecar();
  const flat = deskFlat();
  let advanced = false;
  if (prevId && flat.some((x) => x.id === prevId)) {
    M.cur = flat.find((x) => x.id === prevId) || M.cur; // 保留原位（可能 st 已变，刷新引用）
  } else if (flat.length) {
    // 当前条目已出收件流（保存/标读/删除）→ 自动前进到落位邻位（「处理后前进下一篇」动线）
    M.cur = flat[Math.min(Math.max(prevIdx, 0), flat.length - 1)];
    // prevId 为空（无当前篇，如撤销唯一条目后 refresh）只落引用不标读——「恢复原状」不被前进动线破坏
    advanced = !!prevId && !!M.cur && M.cur.id !== prevId;
  } else {
    M.cur = null;
  }
  // memo zrurtk：自动前进的「下一篇」也是被打开的文章——补齐换篇语义（打开即已读），
  // 此前只换引用不走 selectArticle，导致下一篇不标已读、滚动位还停在前一篇的位置
  if (advanced && M.cur) markReadOnOpen(M.cur);
  renderAll();
  if (advanced) {
    resetReadScroll();
    const mobBody = mobDetailEl ? (mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement | null) : null;
    if (M.mobDetailOpen && mobBody) mobBody.scrollTop = 0;
  }
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
  // 章头「✓✓」钮的动作集（效率#4）：组装期算一次，markup（markAllN）与接线（forEach）共用，
  // 口径与 rail 源行同一条「全部标为已读（N 篇）」确认链
  const siteActions = new Map<string, ItemAction[]>();
  for (const site of siteSet) {
    const snap = snapDirFor({ kind: 'site', site });
    const b = resolveSnap(snap, { kind: 'site', site });
    const unread = b.unread.filter(matchesSearch);
    const read = b.read.filter(matchesSearch);
    const saved = b.saved.filter(matchesSearch);
    if (!unread.length && !read.length && !saved.length) continue;
    const unreadN = unread.filter((a) => a.st === 'unread').length; // 章头未读数（搜索命中口径 + 会话内标读即时减）
    const markN = railUnreadN({ kind: 'site', site });
    if (markN > 0) siteActions.set(site, buildRailActions(site, { kind: 'site', site }));
    chapters.push({
      site,
      unread: unreadN,
      activeN: unread.length,
      readN: read.length,
      savedN: saved.length,
      markAllN: markN,
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
  mountIcons(mobListEl); // 章头「✓✓」灰态钮的 check-check 图标兑现（innerHTML 后必须补挂）
  // 移动长按抽屉（enh 包 2）：条目动作与桌面右键同源（buildItemActions）——一处接入两端全量对齐；
  // 抽屉头走核心 sheetTitle/sheetSub（issue 329 追加修订：与桌面卡同款，域内自绘头部退役）。
  // 章头挂源级「全部标为已读」（rail 源行动同源，源条退役后的迁移位）
  mobListEl.querySelectorAll<HTMLElement>('[data-id]').forEach((card) => {
    const art = byId.get(String(card.dataset.id || ''));
    if (!art) return;
    attachItemActions(card, buildItemActions(art), { sheetTitle: art.title, sheetSub: art.summary || undefined });
  });
  mobListEl.querySelectorAll<HTMLElement>('.bz-clip-mob-ch-hd').forEach((hd) => {
    let sel: any = null;
    try { sel = JSON.parse(hd.dataset.src || 'null'); } catch (e) { return; }
    if (!sel || sel.kind !== 'site') return;
    const actions = siteActions.get(String(sel.site)) || [];
    if (!actions.length) return;
    attachItemActions(hd, actions, { sheetTitle: String(sel.site), menuClass: 'bz-clip-menu-editorial' });
    // 常驻灰态「✓✓」小钮（效率#4 移动面）：长按抽屉之外的可见入口，点击 = 同款确认流；
    // markup 由 mobChHeadHtml 单源产出，此处只接线（stopPropagation 防冒泡误触条目委托）
    const mark = hd.querySelector('[data-clip-ch-markall]') as HTMLElement | null;
    if (mark) {
      mark.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        actions[0].onClick();
      });
    }
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
  // 审查修复批 P2②：进详情 = 开始阅读该篇（与桌面 renderReader 同套会话计时）——
  // 此前移动详情完全不计时，readLog 近乎恒空。「读下一则」换篇走同一入口，
  // setReadingSession 换 key 时自动封存旧篇；返回目录由 closeMobDetail 封存。
  setReadingSession(a.id, { title: a.title, src: a.srcName });
  renderMobDetail();
  if (mobDetailEl) mobDetailEl.style.display = 'flex';
  const body = mobDetailEl ? (mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement | null) : null;
  if (body) body.scrollTop = 0; // issue 206：进详情从开头读
  markReadOnOpen(a); // 打开即已读（不打断当前详情正文；返回目录时该条已让位沉入已收折叠段）
}

/** 打开即已读（m3 去在读 + ADR-0108 桌面接入）：打开一条未处理 news → 静默标已读（无 toast/撤销）。
 *  内存 read 位**同步**置（目录即时灰显、rail 计数即时减），落盘走串行队列（issue 274 起
 *  正文保留在盘，内存 raw 继续供本次会话阅读）。会话内该条按快照原位留灰，重开面板才重排沉段。 */
function markReadOnOpen(a: ClipArticle): void {
  if (!a || a.st !== 'unread') return;
  if (a.origin !== 'news') return;
  const raw = a.raw || M.articles.find((n) => articleKeyOf(n) === a.id);
  if (!raw || raw.read === true) return;
  raw.read = true; // 同步内存位（防重入 + 即时视觉/计数）
  // keepSession（审查修复批 P1①）：打开即已读本篇仍在阅读——不 pause/不尾置 flush，
  // 异步落盘不再清零该篇刚开的计时器；时长由切篇/关面板既有封存点入账
  void flowMarkRead(a, { keepSession: true }).then((res) => {
    // C17：rail 脚注「今日已读」取内存镜像 M.stats.byDate——静默打开即读的 +1 只在磁盘，
    // 不刷新时脚注停留旧值（到下次装载才追上）。回写落盘声明的统计快照（与磁盘同一口径）。
    if (res && res.changed && res.stats) M.stats = res.stats;
    // 若期间未重渲（极短窗口），补一次目录/徽标刷新收敛灰显
    if (M.open && !M.mobDetailOpen) { renderList(); renderRail(); }
  }).catch(() => { /* 落盘失败保持静默（下次装载还原） */ });
}

function renderMobDetail(): void {
  if (!mobDetailEl || !M.cur) return;
  const a = M.cur;
  hideSelBar(); // 切条目/重渲收工具框
  // 屏2 顶部：居中「站名 · 目录」（原型 .d-ch）
  if (mobTitleEl) mobTitleEl.textContent = `${a.srcName} · 目录`;
  // 保存钮（原型文字钮「存为剪藏 / 已存」；剪藏来源隐藏——doSave 对 origin!=='news' 静默 return）
  if (mobSaveBtnEl) {
    const saved = a.st === 'saved';
    mobSaveBtnEl.style.display = a.origin !== 'news' || a.raw?.platform === 'B站' ? 'none' : '';
    mobSaveBtnEl.classList.toggle('saved', saved);
    mobSaveBtnEl.classList.toggle('disabled', saved); // 置灰：已存条目不可再触发保存
    mobSaveBtnEl.textContent = saved ? '已存' : '存为剪藏';
  }
  // 正文（issue 329 第三批 Bug A）：news 直用 body；clip 与桌面 renderReader 同源——
  // clipBodyCache 有缓存即用（空正文 note=「（笔记暂无正文）」），未缓存显「正在读取」占位并
  // kick loadClipBody 读盘后双端原位水合；旧占位语「请在 Obsidian 中打开」退役（已收剪藏移动详情与未读条目一样可读）
  let mdBody = '';
  let note = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    if (cached !== undefined) {
      mdBody = cached;
      if (!mdBody) note = '（笔记暂无正文）';
    } else {
      note = '正在读取剪藏正文…';
    }
  } else {
    mdBody = transformBodyForRead(a, a.body);
    if (!mdBody) note = '正文已清空';
  }
  // C13：按 id 查——mobItemOrder 是快照重建的实例、M.cur 来自 queryBySource 新建实例，indexOf 身份失配
  const idx = mobItemOrder.findIndex((x) => x.id === a.id);
  const seq = idx >= 0 ? `第 ${idx + 1} 则 / ${mobItemOrder.length}` : '';
  // 详情正文 markup 单源 render.ts（m3 原型屏2）；markdown 交 MarkdownRenderer 异步水合
  const detailBody = mobDetailEl.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
  detailBody.innerHTML = mobDetailHtml(a, { time: a.timeText || relTime(a.timeTs), note, seq });
  mountIcons(detailBody);
  bindImgFallback(detailBody);
  const mdEl = detailBody.querySelector('[data-clip-mob-md]') as HTMLElement | null;
  if (mdEl && mdBody) {
    void hydrateArticleMarkdown(mdEl, mdBody, a.notePath || '', () => M.mobDetailOpen && !!M.cur && M.cur.id === a.id && !!mobDetailEl && mobDetailEl.contains(mdEl));
  }
  if (a.origin === 'clip') void loadClipBody(a); // 缓存未命中时读盘，完成后 hydrateActiveClipBody 原位水合
}

// ================= 划选工具框（issue 329 / ADR-0144：桌面/移动同套） =================
// 阅读正文划选文字 → 光标上方浮框：复制 Markdown / 存为名词 / 存为段落；
// 单击图片 → 浮框：保存图片 / 存为图版。选区塌陷/点击别处/Esc/滚动即收。
// 录入动作动态 import('../knowledge') 契约 API（openTermNote/openPassageNote/openImageNote，
// 新参全可选；本域按存在调用——旧版本缺导出时提示，不崩）。生成后不自动打开笔记。

/** 工具框单例 DOM（挂 body，脱离面板滚动/重建影响） */
let selBarEl: HTMLElement | null = null;
let selBarEsc: { unregister(): void } | null = null;
let selChangeTimer: ReturnType<typeof setTimeout> | null = null;
/** 动作发起后的静默窗口：点按钮触发的 selectionchange 不再重弹工具框 */
let selBarHoldUntil = 0;
/** 文字动作快照（显示工具框时定格，防动作执行中切篇错锚） */
interface SelSnapshot { articleId: string; text: string; body: string; }
let selSnap: SelSnapshot | null = null;
/** 图片动作快照 */
interface ImgSnapshot { articleId: string; src: string; }
let imgSnap: ImgSnapshot | null = null;

function ensureSelBar(): HTMLElement {
  if (selBarEl && selBarEl.isConnected) return selBarEl;
  const bar = document.createElement('div');
  bar.className = 'bz-clip-selbar';
  bar.style.display = 'none';
  // 动作委托（data-clip-selbar-act）；mousedown 不拦——document 捕获层按 contains 判定「外部点击」
  bar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-clip-selbar-act]') as HTMLElement | null;
    if (!btn) return;
    e.stopPropagation();
    void runSelBarAct(btn.getAttribute('data-clip-selbar-act') || '');
  });
  document.body.appendChild(bar);
  selBarEl = bar;
  return bar;
}

function hideSelBar(): void {
  if (selBarEsc) {
    try { selBarEsc.unregister(); } catch (e) { /* 幂等 */ }
    selBarEsc = null;
  }
  if (selBarEl) selBarEl.style.display = 'none';
}

function armSelBarEsc(): void {
  // 只换 ESC 层，不动显示态（调用方刚把浮框置为可见；全量 hideSelBar 会把框藏回去）
  if (selBarEsc) {
    try { selBarEsc.unregister(); } catch (e) { /* 幂等 */ }
  }
  selBarEsc = escManager.register('bz-clipbook-selbar', {
    isVisible: () => !!selBarEl && selBarEl.style.display !== 'none',
    close: hideSelBar,
  });
}

/** 浮框定位：光标（选区/图片）上方 8px，放不下翻下方，视口内钳制（jsdom 零尺寸走估算兜底）。
 *  双端同一份口径：issue 329 曾给移动端额外让位 48px（躲系统选择菜单），issue 341 屏蔽生效后
 *  系统菜单不再抢位，让位只剩空隙，故撤销（2026-09-16 真机验收确认）。 */
function placeSelBar(rect: { top: number; left: number; bottom: number; right: number }): void {
  const bar = selBarEl!;
  const w = bar.offsetWidth || 240;
  const h = bar.offsetHeight || 36;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  let left = rect.left;
  let top = rect.top - h - 8;
  if (top < 8) top = (rect.bottom || rect.top) + 8;
  if (vw) left = Math.min(Math.max(left, 8), Math.max(8, vw - w - 8));
  if (vh) top = Math.min(Math.max(top, 8), Math.max(8, vh - h - 8));
  bar.style.left = `${left}px`;
  bar.style.top = `${top}px`;
}

/** 当前条目源 body（复制 Markdown 回查用）：clip 条目 = 正文缓存原文；news 条目 = body（只读，永不被写） */
function currentSourceBody(a: ClipArticle): string {
  if (a.origin === 'clip') return a.notePath ? (clipBodyCache.get(a.notePath) || '') : '';
  return a.body || '';
}

/** 选区读盘：仅认双端阅读正文容器（桌面 [data-clip-md] / 移动 [data-clip-mob-md]）内的非空选区 */
function readTextSelection(): { text: string; rect: { top: number; left: number; bottom: number; right: number } } | null {
  const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = String(sel.toString() || '').trim();
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node && node.nodeType === 3 ? node.parentElement : (node as HTMLElement | null);
  const container = el && typeof el.closest === 'function'
    ? el.closest('[data-clip-md],[data-clip-mob-md]')
    : null;
  if (!container) return null;
  const r = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
  return { text, rect: r || ({ top: 0, left: 0, bottom: 0, right: 0 } as any) };
}

function showTextSelBar(info: { text: string; rect: { top: number; left: number; bottom: number; right: number } }): void {
  const a = M.cur;
  if (!a) return;
  const body = currentSourceBody(a);
  selSnap = { articleId: a.id, text: info.text, body };
  imgSnap = null;
  const bar = ensureSelBar();
  bar.innerHTML = `
    <button type="button" class="bz-clip-selbar-btn" data-clip-selbar-act="copy" title="复制选中内容的 Markdown 源语法">复制 Markdown</button>
    <button type="button" class="bz-clip-selbar-btn" data-clip-selbar-act="term" title="存为知识盒名词，并在此处留下锚定双链">存为名词</button>
    <button type="button" class="bz-clip-selbar-btn" data-clip-selbar-act="passage" title="存为知识盒段落，并在此处留下锚定双链">存为段落</button>`;
  bar.style.display = 'flex';
  topifyZ(bar); // 显示即发号（ADR-0067）：浮框挂 body 无静态档，主面板经 topifyZ 有号——
  // 不发号则 z-index:auto 恒被面板遮罩（z-index 数值元素）压住，工具框「看不见」但 DOM 在
  // （CSS 注释里写的 allocZ 此前从未接线，2026-09-19 用户报「被主弹窗遮挡」补齐）
  placeSelBar(info.rect);
  armSelBarEsc();
}

function showImageSelBar(imgEl: HTMLImageElement): void {
  const a = M.cur;
  if (!a) return;
  const src = imgEl.getAttribute('src') || '';
  if (!src) return;
  imgSnap = { articleId: a.id, src };
  selSnap = null;
  const bar = ensureSelBar();
  // 已本地化的嵌入图（src 非 http）没有「保存」语义，不出该项防误点报网络错误（issue 329 评审）
  const localImg = !/^https?:/i.test(src);
  bar.innerHTML = `
    ${localImg ? '' : '<button type="button" class="bz-clip-selbar-btn" data-clip-selbar-act="save-img" title="下载图片到剪藏图片文件夹">保存图片</button>'}
    <button type="button" class="bz-clip-selbar-btn" data-clip-selbar-act="img-note" title="存为知识盒图版（读图成文）">存为图版</button>`;
  bar.style.display = 'flex';
  topifyZ(bar); // 显示即发号（同上：不抬顶会被主面板遮罩压住）
  const r = typeof imgEl.getBoundingClientRect === 'function' ? imgEl.getBoundingClientRect() : null;
  placeSelBar(r || ({ top: 0, left: 0, bottom: 0, right: 0 } as any));
  armSelBarEsc();
}

/** 选区检查（mouseup 即时 + selectionchange 防抖共用）：塌陷/离开正文 → 收框 */
function checkTextSelection(): void {
  if (!M.open) return;
  if (Date.now() < selBarHoldUntil) return; // 动作静默窗口（点按钮引发的选区抖动不重弹）
  const info = readTextSelection();
  if (!info) {
    hideSelBar();
    return;
  }
  showTextSelBar(info);
}

function onSelectionChanged(): void {
  if (selChangeTimer !== null) clearTimeout(selChangeTimer);
  selChangeTimer = setTimeout(() => {
    selChangeTimer = null;
    checkTextSelection();
  }, 200);
}

function onReaderMouseUp(): void {
  if (selChangeTimer !== null) {
    clearTimeout(selChangeTimer);
    selChangeTimer = null;
  }
  checkTextSelection();
}

/** 移动端正文容器内拦下 contextmenu（issue 341）：原生长按菜单与划选工具框同位抢位。
 *  只拦 [data-clip-md]/[data-clip-mob-md] 内的目标——列表卡片右键菜单（item-actions）、
 *  桌面右键（鼠标惯用件）照旧；选区本身不受影响，工具框仍由 selectionchange 驱动。 */
function onReaderContextMenu(ev: MouseEvent): void {
  if (!isMobileEnv()) return;
  const t = ev.target as HTMLElement | null;
  if (!t || typeof t.closest !== 'function') return;
  if (t.closest('[data-clip-md],[data-clip-mob-md]')) ev.preventDefault();
}

/** 点工具框外即收（document 捕获层；工具框内按下不收） */
function onDocMouseDown(ev: MouseEvent): void {
  if (!selBarEl || selBarEl.style.display === 'none') return;
  if (selBarEl.contains(ev.target as Node)) return;
  hideSelBar();
}

/** 工具框动作分发 */
async function runSelBarAct(act: string): Promise<void> {
  selBarHoldUntil = Date.now() + 600;
  if (act === 'copy') {
    hideSelBar();
    await actCopyMarkdown();
    return;
  }
  if (act === 'term' || act === 'passage') {
    hideSelBar();
    await actSaveEntry(act);
    return;
  }
  if (act === 'save-img') {
    hideSelBar();
    await actSaveImage();
    return;
  }
  if (act === 'img-note') {
    hideSelBar();
    await actImageNote();
  }
}

/** 复制 Markdown：选区文本回查源 body 片段（保语法），回查失败回退纯文本 */
async function actCopyMarkdown(): Promise<void> {
  const snap = selSnap;
  if (!snap) return;
  const snippet = snap.body ? findMarkdownSnippet(snap.body, snap.text) : null;
  await copyText(snippet || snap.text, 'Markdown 已复制');
}

/** 快照校验：动作执行时仍是发起时的当前条目才落锚（切篇后丢弃） */
function articleForSnapshot(articleId: string): ClipArticle | null {
  return M.cur && M.cur.id === articleId ? M.cur : null;
}

/** 知识盒录入入口（存为名词/段落）：预填选区 + 原文来源，生成后不自动打开笔记（ADR-0144 决策 1）。
 *  契约 API（knowledge 域并行实现）按存在调用：openTermNote(app, term?, opts) / openPassageNote(app, opts)。 */
async function actSaveEntry(kind: 'term' | 'passage'): Promise<void> {
  const snap = selSnap;
  if (!snap) return;
  const a = articleForSnapshot(snap.articleId);
  if (!a) return;
  let mod: any = null;
  try {
    mod = await import('../knowledge');
  } catch (e) {
    notice('知识盒模块加载失败', 'error');
    return;
  }
  const fn = kind === 'term' ? mod.openTermNote : mod.openPassageNote;
  if (typeof fn !== 'function') {
    notice('知识盒尚未支持划词录入，请更新插件', 'warning');
    return;
  }
  const source = a.url ? { kind: 'url' as const, url: a.url, title: a.title } : undefined;
  const onCreated = (notePath: string) => {
    void handleAnchorCreated(kind, String(notePath || ''), snap, a);
  };
  if (kind === 'term') fn(getApp(), snap.text, { source, onCreated });
  else fn(getApp(), { text: snap.text, source, onCreated });
}

/** 双端阅读视图原位重渲（锚定/图片动作后即时出链）：桌面右栏 + 移动详情一并覆盖；
 *  同条目守卫内置（对齐原三处 `M.cur && M.cur.id === a.id`——切篇后丢弃本次刷新）。
 *  效率#8 轻版：同篇刷新（本函数守卫后必然同篇）**不整栏重建**——标题/摘要/meta 容器
 *  不动（节点身份与滚位保持，正文不闪空），只清正文容器后重跑变换与异步水合；
 *  正文源不可得（clip 未缓存等异常态）才回退全量渲染路径。导出供回归测试锚定。 */
function refreshReaderBodyInPlace(a: ClipArticle): void {
  if (!readerEl || readerEl.dataset.clipReaderId !== a.id) { renderReader(); return; }
  const md = readerEl.querySelector('[data-clip-md]') as HTMLElement | null;
  if (!md) { renderReader(); return; }
  let body = '';
  let note = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    if (cached === undefined) { renderReader(); return; } // 未缓存 → 全量（占位 + 懒加载链）
    body = cached;
    if (!body) note = '（笔记暂无正文）';
  } else {
    body = transformBodyForRead(a, a.body);
    if (!body) note = '正文已清空（已处理条目）';
  }
  md.innerHTML = '';
  if (note) {
    const p = document.createElement('p');
    p.className = 'dim';
    p.textContent = note;
    md.appendChild(p);
    return;
  }
  void hydrateArticleMarkdown(md, body, a.notePath || '', () => !!M.cur && M.cur.id === a.id && !!readerEl && readerEl.contains(md));
}

/** 移动详情同款原位重水合（效率#8）：标题/期次行/保存钮不动，只重跑 [data-clip-mob-md]。 */
function refreshMobBodyInPlace(a: ClipArticle): void {
  if (!mobDetailEl || !M.mobDetailOpen) return;
  const md = mobDetailEl.querySelector('[data-clip-mob-md]') as HTMLElement | null;
  if (!md) { renderMobDetail(); return; }
  let mdBody = '';
  let note = '';
  if (a.origin === 'clip') {
    const cached = a.notePath ? clipBodyCache.get(a.notePath) : undefined;
    if (cached === undefined) { renderMobDetail(); return; }
    mdBody = cached;
    if (!mdBody) note = '（笔记暂无正文）';
  } else {
    mdBody = transformBodyForRead(a, a.body);
    if (!mdBody) note = '正文已清空';
  }
  md.innerHTML = '';
  if (note) {
    const p = document.createElement('p');
    p.textContent = note;
    md.appendChild(p);
    return;
  }
  void hydrateArticleMarkdown(md, mdBody, a.notePath || '', () => M.mobDetailOpen && !!M.cur && M.cur.id === a.id && !!mobDetailEl && mobDetailEl.contains(md));
}

/** 锚定/图片动作后的刷新入口（原全量 renderReader/renderMobDetail 重建 → 效率#8 轻版原位水合）。
 *  导出仅供回归测试（同篇刷新标题节点身份不变）。 */
export function refreshReadingViews(articleId: string): void {
  if (!M.cur || M.cur.id !== articleId) return;
  refreshReaderBodyInPlace(M.cur);
  if (M.mobDetailOpen) refreshMobBodyInPlace(M.cur);
}

/** 划词锚定落盘两路（ADR-0144 决策 4）：已保存条目直写剪藏 md；未保存条目侧写暂存（渲染层出链）。
 *  两路都同步回写文献笔记 source（已保存 = 内部路径即刻；未保存 = 物化时回写）。 */
async function handleAnchorCreated(kind: 'term' | 'passage', notePath: string, snap: SelSnapshot, a: ClipArticle): Promise<void> {
  if (!notePath) return;
  try {
    if (a.origin === 'clip' && a.notePath) {
      // 已保存条目：直写剪藏 md（同 applyBodyTransforms 变换管线，仅动正文不动 frontmatter）
      const app = getApp();
      const file = app.vault.getAbstractFileByPath(a.notePath) as TFile | null;
      if (file) {
        const content = await app.vault.read(file);
        const next = applyClipContentTransforms(content, [{ find: snap.text, notePath, kind }], []);
        if (next !== content) await app.vault.modify(file, next);
        invalidateClipBodyCache(a.notePath); // 正文缓存失效，重读即见双链
      }
      await upgradeSourceFor(notePath, a);
      refreshReadingViews(a.id);
    } else {
      // 未保存条目：news.json 不可写 → 侧写 marks 暂存，渲染层立即出双链，保存物化时进 md
      M.sidecar = await addArticleMark(a.id, { find: snap.text, notePath, kind });
      // 登记 pendingSource（issue 329 Bug 4）：保存物化时据此把文献笔记 source 回写为内部双链；
      // 只记 marks 不登记会让升级名单恒空 → 外链残留死路
      M.sidecar = await addPendingSourceNote(a.id, notePath);
      refreshReadingViews(a.id);
    }
  } catch (e) {
    console.warn('[剪藏本] 划词锚定写入失败', e);
    notifyActionError(e, '锚定写入'); // 一致#15：动作名 + 原因 + 重试途径
  }
}

/** 文献笔记 source 升级（ADR-0144 决策 5）：回写为 `[[剪藏路径|条目标题]]`（无块 id）。
 *  契约 API upgradeNoteSourceInternal 按存在调用；失败静默（断链代价可接受）。 */
async function upgradeSourceFor(notePath: string, a: ClipArticle): Promise<void> {
  if (!a.notePath) return;
  try {
    const mod: any = await import('../knowledge');
    if (typeof mod.upgradeNoteSourceInternal !== 'function') return;
    await mod.upgradeNoteSourceInternal(getApp(), notePath, `[[${a.notePath}|${linkAliasText(a.title)}]]`);
  } catch (e) {
    console.warn('[剪藏本] 升级文献来源失败（静默接受）', e);
  }
}

/** 保存图片（图片工具框动作一）：requestUrl 落盘（URL 自带名/时间戳命名）→ 已保存直写换链 / 未保存记侧写 */
async function actSaveImage(): Promise<void> {
  const snap = imgSnap;
  if (!snap) return;
  const a = articleForSnapshot(snap.articleId);
  if (!a) return;
  try {
    const res = await saveClipImage({
      src: snap.src,
      articleKey: a.id,
      savedNotePath: a.origin === 'clip' ? a.notePath : null,
    });
    if (res.sidecar) M.sidecar = res.sidecar; // 内存侧写同步（渲染层立即换链）
    if (a.origin === 'clip' && a.notePath) invalidateClipBodyCache(a.notePath);
    refreshReadingViews(a.id); // 原位重渲（外层滚动容器不重置；移动详情打开时一并重渲，issue 329 Bug 2）
  } catch (e) {
    console.warn('[剪藏本] 保存图片失败', e);
    notice('图片保存失败，请检查网络后重试', 'error');
  }
}

/** 存为图版（图片工具框动作二）：拉图转 data URL 预填进图版录入（确认写入才落盘），plate 无正文锚定仅 source 跟随 */
async function actImageNote(): Promise<void> {
  const snap = imgSnap;
  if (!snap) return;
  const a = articleForSnapshot(snap.articleId);
  if (!a) return;
  let dataUrl = '';
  try {
    dataUrl = await fetchImageDataUrl(snap.src);
  } catch (e) {
    notice('图片读取失败，无法生成图版', 'error');
    return;
  }
  let mod: any = null;
  try {
    mod = await import('../knowledge');
  } catch (e) {
    notice('知识盒模块加载失败', 'error');
    return;
  }
  if (typeof mod.openImageNote !== 'function') {
    notice('知识盒尚未支持图版录入，请更新插件', 'warning');
    return;
  }
  const source = a.url ? { kind: 'url' as const, url: a.url, title: a.title } : undefined;
  mod.openImageNote(getApp(), {
    source,
    images: [dataUrl],
    onCreated: (notePath: string) => {
      void handlePlateCreated(String(notePath || ''), a);
    },
  });
}

/** 图版来源登记（plate 无正文锚定，仅 source 跟随——ADR-0144 决策 5）：已保存立即升级，未保存记 pendingSource */
async function handlePlateCreated(notePath: string, a: ClipArticle): Promise<void> {
  if (!notePath) return;
  try {
    if (a.origin === 'clip' && a.notePath) {
      await upgradeSourceFor(notePath, a);
    } else {
      M.sidecar = await addPendingSourceNote(a.id, notePath);
    }
  } catch (e) {
    console.warn('[剪藏本] 图版来源登记失败', e);
    notifyActionError(e, '图版来源登记'); // 一致#15：动作名 + 原因 + 重试途径
  }
}

// ================= 点击拦截：锚定双链直达文献预览（issue 329 / ADR-0144 决策 3） =================

/** knowledgeDirectory（缺省「文献盒」，路径归一） */
function knowledgeDir(): string {
  // 单源（ADR-0141）：三盒目录归一走 core/knowledge-boxes，不再手写重复归一（issue 333 评审）
  return getKnowledgeBoxes(tryGetSettings() as any).lit;
}

/** internal-link href → vault 内实际路径（去 heading 锚点、补 .md、判存在）；缺失返回 null（不拦）。
 *  三级解析（issue 329 Bug 3 / issue 340 修正）：全路径直查（含补 .md）→ 裸 basename 先按
 *  「知识盒内同名笔记」直查（锚定别名双链 `[[basename|文字]]` 必指盒内笔记，vault 存在性判定
 *  即可解析，不依赖 metadataCache）→ 再退 metadataCache.getFirstLinkpathDest 全库解析。
 *  不得用 getFirstLinkfileDest：该 API 在 Obsidian 1.12/1.13 实装中不存在（d.ts 亦无），
 *  typeof 守卫静默空转 → 拦截恒失效 → 原生导航（桌面笔记开在全屏面板后=无反应；移动端 webview
 *  直接导航=OB 重启，issue 340 实测）。 */
function resolveInternalTarget(href: string): string | null {
  const app = getApp();
  let p = String(href || '').split('#')[0].trim().replace(/\\/g, '/');
  if (!p) return null;
  try { p = decodeURIComponent(p); } catch (e) { /* 保留原串 */ }
  if (!p.toLowerCase().endsWith('.md')) {
    const withMd = p + '.md';
    if (app.vault.getAbstractFileByPath(withMd)) p = withMd;
  }
  if (app.vault.getAbstractFileByPath(p)) return p;
  if (!p.includes('/')) {
    const inBox = knowledgeDir() + '/' + p + '.md';
    if (app.vault.getAbstractFileByPath(inBox)) return inBox;
    // 兜底：全库 basename 解析（d.ts 正牌 API，TFile|null；sourcePath 空串=全库口径）。
    // 测试 mock 可能无该 API，守卫 + 兜错，异常维持原生导航
    try {
      const mc: any = (app as any).metadataCache;
      if (mc && typeof mc.getFirstLinkpathDest === 'function') {
        const dest = mc.getFirstLinkpathDest(p, '');
        const destPath = dest && typeof dest === 'object' ? dest.path : dest;
        if (destPath && app.vault.getAbstractFileByPath(destPath)) return String(destPath);
      }
    } catch (e) { /* 解析异常维持原生导航 */ }
  }
  return null;
}

/** 拦截判定（同步，供 click 内 preventDefault）：文献盒内的双链 → 直达预览；返回 true = 已拦截 */
function interceptKnowledgeLink(link: HTMLAnchorElement): boolean {
  const path = resolveInternalTarget(link.dataset.href || link.getAttribute('href') || '');
  if (!path) return false;
  const dir = knowledgeDir();
  if (!path.startsWith(dir + '/')) return false; // 目录外：原生导航不拦
  void openKnowledgePreviewSafe(path);
  return true;
}

/** 文献预览直达：契约 API openKnowledgePreview 按存在调用；抛错/缺失回退原生打开（openLinkText） */
async function openKnowledgePreviewSafe(path: string): Promise<void> {
  try {
    const mod: any = await import('../knowledge');
    if (typeof mod.openKnowledgePreview === 'function') {
      await mod.openKnowledgePreview(getApp(), path);
      return;
    }
  } catch (e) {
    console.warn('[剪藏本] 文献预览直达失败，回退原生打开', e);
  }
  try {
    getApp().workspace.openLinkText(path, '', false, { active: true });
  } catch (e) { /* 环境无 workspace（测试）忽略 */ }
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
        icon: 'eye',
        // 2026-09-12：原「基础」组拆为「显示」（阅读字号）+「目录」（剪藏文件夹），对齐全域分组范式
        name: '显示',
        rows: [
          { type: 'select', name: '阅读字号', desc: '桌面阅读面正文字号', binding: { key: 'clipbookReaderFontSize' }, options: [
            { value: 'small', label: '小' },
            { value: 'medium', label: '中' },
            { value: 'large', label: '大' },
          ], onChange: () => applyReaderFontSize() },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          { type: 'path', mode: 'single', name: '剪藏文件夹', desc: '存放网页剪藏文章的文件夹', binding: { key: 'articleDirectory' } },
          // issue 329：保存正文图片的落地目录（留空回落剪藏目录 assets）
          { type: 'path', mode: 'single', name: '图片文件夹', desc: '保存网页图片的文件夹，留空存到剪藏目录下的 assets', binding: { key: 'clipbookImageFolder' } },
        ],
      },
      {
        icon: 'sparkles',
        name: '自动摘要',
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
      // C12：剪藏目录以设置为唯一真理源（loader 每次扫描直读 clipDir()，无 M.dir 缓存）——
      // 关闭设置弹窗即清目录快照并重载：域内改「剪藏文件夹」与设置面板域改键（无域内通知）
      // 两条路径归一，重开面板/下次扫描即生效
      M.clipNotes = null;
      M.clipUrls = new Set();
      void reloadIfOpen();
    },
  });
}
