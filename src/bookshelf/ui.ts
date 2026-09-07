/**
 * 书架墙（bookshelf）域 UI 行为层：书脊墙 1:1（issue 218 → 226 定稿；ADR-0104 后 markup 单源 render.ts）。
 *
 * markup/视图口径/装箱全部出自 ./render.ts（含面板骨架、头行标签、排序 segmented、
 * 书脊墙、空态、借书卡、筛选排序管道）；本文件只留：
 *   生命周期（overlay 创建/关闭/resize 防抖）、事件委托、core 服务接线
 *   （uiModal/escManager/notice/mobile/z-order）、皮肤类解析、报告视图内嵌、vault 封面。
 *
 * 布局与视觉基准见 render.ts 头注与 styles.css；窗口缩放防抖重装箱；
 * 移动端同构（窄墙自动多排），无独立移动布局。
 * 皮肤（issue 235 五肤×亮暗）：面板根挂 bz-bs-skin-{id} + bz-bs-mode-{light|dark}；
 * 点「书库」匾 = 移动端关闭出口。
 * 铁律 6：弹窗骨架走组件库 uiModal；墙体系为域独有视觉（styles.css .bz-bs-wall*）。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, mountIcons } from '../core/ui';
import { renderReadingReport, cancelReadingReport, handleReportInteraction } from '../reading-report';
import { M, applyDefaultView, type BookshelfItem, type BookshelfView, type SideId, type SortKey } from './state';
import { rebuildItems, getDisplayItems, resolveFolderPath, resolveBookTag } from './data';
import {
  detailBodyHtml, labelsHtml, panelHtml, renderWallInto, sortSegHtml, wallLoadingHTML,
} from './render';
import { closeBookNoteModals } from './notes-ui';

/** 渲染钩子：render.ts 纯层产出的 `<i data-lucide>` 占位由 core setIcon 物化 */
const HOOKS = { mountIcons };

// ---------- 封面（vault 资源；纯层不可入） ----------

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
    ph.innerHTML = `<i data-lucide="library" class="bz-ic"></i><span>无封面</span>`;
    mountIcons(ph);
    img.replaceWith(ph);
  }, true);
}

// ---------- 渲染（render.ts 胶水：标签/排序/整墙各回各的挂点） ----------

function renderAll(_app?: unknown): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  const labels = overlay.querySelector('#bz-bs-labels') as HTMLElement | null;
  if (labels) labels.innerHTML = labelsHtml(M.items, M.side, M.catFilter);
  const seg = overlay.querySelector('#bz-bs-sortseg') as HTMLElement | null;
  if (seg) seg.innerHTML = sortSegHtml(M.sortMode);
  const shelf = overlay.querySelector('#bz-bs-shelf') as HTMLElement | null;
  if (!shelf) return;
  renderWallInto(shelf, {
    hint: overlay.querySelector('#bz-bs-hint') as HTMLElement | null,
    all: M.items,
    list: getDisplayItems(),
    q: M.searchKeyword,
    emptyFolder: resolveFolderPath(),
    emptyTag: resolveBookTag(),
    hooks: HOOKS,
  });
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
  renderAll();
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

/** 借书卡（issue 223 只读版：pull-note + 纸卡双栏 + 台账 + 静态进度条 + 批注密度条 + 印章；
 *  markup 走 render.ts detailBodyHtml，本层只负责封面资源与 uiModal 壳） */
function openBookDetail(it: BookshelfItem, app: App): void {
  const body = document.createElement('div');
  body.className = 'bz-bs-detail';
  body.innerHTML = detailBodyHtml(it, coverUrl(it, app));
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

// ---------- 面板皮肤（五肤×亮暗双模式；类挂面板根与弹窗根） ----------

const SKIN_IDS = ['nordic', 'noir', 'kraft', 'velvet', 'mono'] as const;
type SkinId = (typeof SKIN_IDS)[number];

function normalizeSkin(v: unknown): SkinId {
  return SKIN_IDS.includes(v as SkinId) ? (v as SkinId) : 'nordic';
}

/** 亮暗模式类（随 Obsidian 主题体；每肤两套变体见 styles.css「亮暗模式变体」节） */
function bsModeClass(): string {
  return document.body.classList.contains('theme-dark') ? 'bz-bs-mode-dark' : 'bz-bs-mode-light';
}

/** 当前皮肤+亮暗模式类（弹窗与面板共用；退役肤/非法值读取回落雪松白） */
export function bsSkinClass(): string {
  return `bz-bs-skin-${normalizeSkin((tryGetSettings() as Record<string, unknown>).bookshelfSkin)} ${bsModeClass()}`;
}

/** 皮肤应用：面板根换挂皮肤+模式类（设置行 onChange 热切换；未开面板仅落盘） */
export function applyBookshelfSkin(skin: unknown): void {
  if (!M.currentOverlay) return;
  const panel = M.currentOverlay.querySelector('.bz-bs-panel') as HTMLElement | null;
  if (!panel) return;
  panel.classList.remove(...SKIN_IDS.map((id) => `bz-bs-skin-${id}`), 'bz-bs-mode-light', 'bz-bs-mode-dark');
  panel.classList.add(`bz-bs-skin-${normalizeSkin(skin)}`, bsModeClass());
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

  overlay.innerHTML = panelHtml(bsSkinClass());

  document.body.appendChild(overlay);
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll();
  applyMobileWindowFullscreen(overlay.querySelector('.bz-bs-panel') as HTMLElement, fullscreen);

  // 单一委托：匾额关闭（移动端）/ 标签筛选 / 排序 / 报告视图交互 / 书脊详情
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closeOverlay(); return; }
    // 移动端关闭出口 = 点「书库」匾收面板（桌面不响应，点面板外/Esc 关）
    if (t.closest('[data-bs-plaque]')) {
      if (isMobileEnv()) closeOverlay();
      return;
    }
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
      renderAll();
      return;
    }
    // 分类标签（与状态正交；再点已选 = 回全馆）
    const cat = t.closest('[data-bs-cat]') as HTMLElement | null;
    if (cat) {
      const name = cat.dataset.bsCat || 'all';
      M.catFilter = name !== 'all' && M.catFilter === name ? 'all' : name;
      renderAll();
      return;
    }
    // 排序三档
    const sortBtn = t.closest('[data-bs-sort]') as HTMLElement | null;
    if (sortBtn) {
      M.sortMode = (sortBtn.dataset.bsSort || 'recent') as SortKey;
      renderAll();
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
      renderAll();
    }, 200);
  });
  // 重开残留回写：防「墙被不可见关键字过滤但输入框为空」的排查黑洞
  if (M.searchKeyword) searchInput.value = M.searchKeyword;

  // 窗口缩放 → 防抖重装箱（墙宽变化）
  wallResizeHandler = () => {
    if (wallResizeTimer) clearTimeout(wallResizeTimer);
    wallResizeTimer = setTimeout(() => {
      wallResizeTimer = null;
      if (M.currentOverlay && M.view === 'shelf') renderAll();
    }, 150);
  };
  window.addEventListener('resize', wallResizeHandler);

  mountIcons(overlay);
  paintViewContainers();
  // B8：首扫加载态——rebuild 完成前墙位显示占位，防异步读 weave-data 空白闪烁
  const shelf0 = overlay.querySelector('#bz-bs-shelf') as HTMLElement | null;
  if (shelf0) shelf0.innerHTML = wallLoadingHTML();
  void rebuildItems(app).then(() => {
    if (M.view === 'report') showView(app, 'report');
    else renderAll();
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
