/**
 * 收藏本 UI（ticket 177：P1「标签工作台」落码，对照拍板原型重写）
 *
 * 桌面：整宽头行「收藏本」（仅标题，设置收敛设置面板）+ 左标签栏（全部 + 9 类 + 计数）
 *   + 右内容区——主头行（当前标签 / N 条收藏 / 主按钮「添加收藏」）→ 工具栏
 *   （搜索 + 排序循环钮）→ 单列卡片流。
 * 移动 ≤768：真全屏；头行右上图标组 ＋添加 → ⇅排序 → 🔍搜索(展开) → ✕关闭；
 *   标签 chips 横滑；搜索默认隐藏点 🔍 展开。
 * 交互：桌面点卡片行 = 操作浮层（打开/置顶/跳转笔记/刷新余额/编辑/归档/删除）；
 *   右键 = 同浮层；移动点行 = 底部详情抽屉（动作 + 底部删除）。全 icon lucide。
 *
 * 契约保留（与旧域等价）：favorites.json 零迁移；smartcat 事件载荷（add/edit/delete/
 *   archive + favoritesEditChanges）；置顶/归档/删除撤销；余额自动查询与档位色；
 *   设置键 favoritesSortKey/favoritesMobileDefaultFullscreen；⚙️ 设置收敛设置面板
 *   （favoritesSettingsSchema 空态）；file-sync 后台不动（index.ts）。
 */
import { notice, notify, notifyUndo, notifySaveError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { refreshItemSheet, registerSheetCompanion, unregisterSheetCompanion, closeItemMenu, openItemMenu, openItemSheet, type ItemAction } from '../core/item-actions';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { escapeHtml } from '../core/utils';
import { getApp } from '../core/app';
import { uiIcon } from '../core/ui';
import { emitDomainEvent } from '../core/domain-bus';
import { favoritesEditChanges } from '../smartcat/favorites-source';
import type { SettingsSchema } from '../core/settings-schema';
import { TAGS, tagEmoji, tagLabel, domainOf, normalizeUrl, isUrlLike } from './config';
import { BalanceService, FavoritesAIService } from './ai';
import type { DataManager } from './data';
import type { FavoritesItem } from './types';

/** 搜索防抖（180ms，旧域同值） */
const SEARCH_DEBOUNCE_MS = 180;
/** 排序：created（最新收藏）/ title（标题排序） */
type SortMode = 'created' | 'title';

const MOB_SHOW = 'bz-fav-mobsearch-show';

/** lucide 图标名 */
const ICON = {
  all: 'layout-grid',
  archived: 'archive',
  unarchive: 'archive-restore',
  add: 'plus',
  sort: 'arrow-up-down',
  search: 'search',
  close: 'x',
  open: 'external-link',
  pin: 'pin',
  pinOff: 'pin-off',
  note: 'file-text',
  refresh: 'refresh-cw',
  edit: 'pencil',
  archive: 'archive',
  del: 'trash-2',
  empty: 'star',
  balance: 'wallet',
  globe: 'globe',
};

/** 域级模块状态（模块单例；卸载/测试重置） */
interface FavState {
  overlay: HTMLElement | null;
  items: FavoritesItem[];
  /** 当前标签筛选（null = 全部；存标签 label） */
  tag: string | null;
  /** 已归档视图（ticket 188：左栏「已归档」入口；数据仍 favorites.json，ADR-0074 冷存语义不变） */
  archived: boolean;
  q: string;
  sort: SortMode;
  renderFn: (() => void) | null;
}

const M: FavState = {
  overlay: null,
  items: [],
  tag: null,
  archived: false,
  q: '',
  sort: 'created',
  renderFn: null,
};

export function resetFavoritesState(): void {
  M.overlay = null;
  M.items = [];
  M.tag = null;
  M.archived = false;
  M.q = '';
  M.sort = 'created';
  M.renderFn = null;
}

// ==================== 设置 schema（⚙️ 已收敛设置面板；空态域） ====================

export function favoritesSettingsSchema(): SettingsSchema {
  return { groups: [mobileFullscreenGroup('favoritesMobileDefaultFullscreen', { desc: '' })] };
}

// ==================== 小工具 ====================

function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** lucide 占位 HTML（渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

/** 容器内 data-lucide 占位 → setIcon 真图标（保持 class 修饰） */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    const fresh = uiIcon(name as any, '');
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

/** 本地时间 YYYY-MM-DD HH:mm:ss（created/archivedAt 写入格式） */
function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 排序键读（favoritesSortKey 设置；非法回退 created） */
function readSortKey(): SortMode {
  const v = (tryGetSettings() as any)?.favoritesSortKey;
  return v === 'title' ? 'title' : 'created';
}

// ==================== 派生 ====================

/** 可见条目 = 非归档（ADR-0074 冷存不可见，装载点唯一过滤） */
function visible(): FavoritesItem[] {
  return M.items.filter((i) => !i.archived);
}

/** 已归档条目（ticket 188「已归档」视图数据源；数据仍在 favorites.json） */
function archivedItems(): FavoritesItem[] {
  return M.items.filter((i) => !!i.archived);
}

/** 当前视图条目池：默认非归档；已归档视图仅归档条目 */
function pool(): FavoritesItem[] {
  return M.archived ? archivedItems() : visible();
}

/** 搜索 haystack（ticket 188 加 url：标题/简介/链接/关联笔记/标签文案） */
function haystackOf(it: FavoritesItem): string {
  return [it.title, it.description, it.url || '', (it.linkedNote || ''), ...(it.tags || []).map(tagLabel)].join(' ').toLowerCase();
}

function filtered(): FavoritesItem[] {
  let list = pool();
  if (!M.archived && M.tag) list = list.filter((i) => (i.tags || []).includes(M.tag as string));
  if (M.q) {
    const kw = M.q.toLowerCase();
    list = list.filter((i) => haystackOf(i).includes(kw));
  }
  const byTime = (a: FavoritesItem, b: FavoritesItem) =>
    (b.created || '').localeCompare(a.created || '') || (b.id || '').localeCompare(a.id || '');
  const byTitle = (a: FavoritesItem, b: FavoritesItem) =>
    (a.title || '').localeCompare(b.title || '', 'zh') || byTime(a, b);
  const base = M.sort === 'title' ? [...list].sort(byTitle) : [...list].sort(byTime);
  // 置顶恒最前：稳定分区（组内保持 base 排序，不得用比较器重排——会退化为时间序）
  const pinned = base.filter((i) => i.pinned);
  const rest = base.filter((i) => !i.pinned);
  return [...pinned, ...rest];
}

function tagCount(label: string): number {
  return visible().filter((i) => (i.tags || []).includes(label)).length;
}

function itemById(id: string): FavoritesItem | undefined {
  return M.items.find((i) => i.id === id);
}

/** 行内标签（选中分类时只显示匹配标签） */
function displayTagsOf(item: FavoritesItem): string[] {
  if (M.tag) return (item.tags || []).filter((t) => t === M.tag);
  return item.tags || [];
}

// ==================== 余额（列表读数 + 自动查询） ====================

function balanceToneClass(balance: string): string {
  const n = parseFloat(balance);
  if (isNaN(n)) return '';
  if (n < 10) return ' bz-fav-balance--err';
  if (n < 100) return ' bz-fav-balance--warn';
  return ' bz-fav-balance--ok';
}

let balanceService = new BalanceService();
/** 打开面板时批量刷新余额（只写回非缓存成功结果；失败仅内存错误态） */
async function refreshBalances(dm: DataManager): Promise<void> {
  const items = visible();
  if (!items.some((i) => i.llmConfig?.apiKeys)) return;
  const updates: Record<string, { balance?: string; balanceCacheTime?: number; balanceError?: string | null }> = {};
  let any = false;
  await Promise.all(
    items
      .filter((i) => i.llmConfig?.apiKeys)
      .map(async (it) => {
        if (it.balance && balanceService.isCacheValid(it.balanceCacheTime)) return;
        any = true;
        try {
          const r = await balanceService.fetchBalance(it.llmConfig!);
          updates[it.id] = { balance: r.balance, balanceCacheTime: r.timestamp, balanceError: null };
        } catch (e: any) {
          updates[it.id] = { balanceError: e?.message || '查询失败' };
        }
      })
  );
  if (!any) return;
  try {
    // 余额批量写回走 DataManager 串行队列读改写（D2 收编）：基于队列内磁盘现值套本批，
    // 与并发 add/update/删除撤销不再互踩（原 P1-37 写前重读语义保留，整体原子化）
    const latest = await dm.mutateAll((data) => {
      for (const id of Object.keys(updates)) {
        const idx = data.findIndex((d) => d.id === id);
        if (idx === -1) continue;
        const u = updates[id];
        if (u.balance !== undefined) {
          data[idx] = { ...data[idx], balance: u.balance, balanceCacheTime: u.balanceCacheTime ?? null, balanceError: u.balanceError ?? null };
        } else {
          data[idx] = { ...data[idx], balanceError: u.balanceError ?? null };
        }
      }
    });
    // 更新内存以触发重渲
    const idxs = new Set(Object.keys(updates));
    M.items = latest.map((d) => (idxs.has(d.id) ? { ...d } : d));
    M.renderFn?.();
  } catch (e) {
    console.error('[favorites-balance]', e);
  }
}

// ==================== 主面板结构 ====================

function panelHtml(): string {
  return `<div class="bz-fav-panel bz-panel-mtop">
  <div class="bz-fav-head">
    <div class="bz-fav-title">收藏本</div>
    <div class="bz-fav-head-btns">
      <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-fav-mob-only" data-fav-add title="添加收藏">${iconSpan(ICON.add)}</button>
      <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-fav-mob-only" data-fav-sort title="排序">${iconSpan(ICON.sort)}</button>
      <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-fav-mob-only" data-fav-mobsearch title="搜索">${iconSpan(ICON.search)}</button>
      <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-fav-mob-only" data-fav-close title="关闭">${iconSpan(ICON.close)}</button>
    </div>
  </div>
  <div class="bz-fav-body">
    <aside class="bz-fav-side">
      <div class="bz-fav-side-label">标签</div>
      <div class="bz-fav-side-scroll" data-fav-tags></div>
    </aside>
    <div class="bz-fav-main">
      <div class="bz-fav-main-head">
        <div class="bz-fav-main-title" data-fav-title>全部</div>
        <div class="bz-fav-main-count" data-fav-count></div>
        <div class="bz-fav-main-spacer"></div>
        <button class="bz-btn bz-btn--primary" data-fav-add>${iconSpan(ICON.add, 'bz-ic--sm')} 添加收藏</button>
      </div>
      <div class="bz-fav-toolbar">
        <div class="bz-fav-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-fav-search placeholder="搜索标题 / 简介 / 链接 / 标签…"></div>
        <button class="bz-btn bz-fav-sort-btn" data-fav-sort>${iconSpan(ICON.sort, 'bz-ic--sm')} <span data-fav-sort-label>最新收藏</span></button>
      </div>
      <div class="bz-fav-mobscenes" data-fav-mobtags></div>
      <div class="bz-fav-mobsearch" data-fav-mobsearch-row>
        <div class="bz-fav-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-fav-mobsearch-inp placeholder="搜索标题 / 简介 / 链接 / 标签…"></div>
      </div>
      <div class="bz-fav-content" data-fav-content></div>
    </div>
  </div>
</div>`;
}

// ==================== 主面板生命周期 ====================

let mainEscRegistered = false;

let _dm: DataManager | null = null;
let _ai: FavoritesAIService | null = null;
let _app: any = null;
/** 依赖注入（面板打开 / 直接添加命令前调用；幂等可重复） */
export function initFavoritesUI(app: any, dm: DataManager, ai: FavoritesAIService): void {
  _app = app;
  _dm = dm;
  _ai = ai;
}
/** 打开主面板（toggle：开着再点关闭） */
export function openPanel(app: any, dm: DataManager, ai: FavoritesAIService): void {
  initFavoritesUI(app, dm, ai);
  if (M.overlay) {
    closePanel();
    return;
  }
  M.sort = readSortKey();
  const overlay = document.createElement('div');
  overlay.className = 'bz-fav-overlay';
  overlay.innerHTML = panelHtml();
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（原静态 z-index:100000 已删）
  M.overlay = overlay;
  M.renderFn = () => renderAll();
  // 排序钮 label 与持久化排序键同步（收藏本按钮文案跟随当前模式）
  const sortLabel = overlay.querySelector('[data-fav-sort-label]') as HTMLElement | null;
  if (sortLabel) sortLabel.textContent = M.sort === 'title' ? '标题排序' : '最新收藏';

  applyMobileWindowFullscreen(
    overlay.querySelector('.bz-fav-panel') as HTMLElement,
    (tryGetSettings() as any)?.favoritesMobileDefaultFullscreen === true
  );
  mountIcons(overlay);

  // ESC（主面板 + 表单）
  if (!mainEscRegistered) {
    mainEscRegistered = true;
    escManager.register('bz-fav', {
      isVisible: () => !!M.overlay || !!document.querySelector('.bz-fav-form'),
      close: () => {
        const form = document.querySelector('.bz-fav-form') as HTMLElement | null;
        if (form) requestCloseForm(form);
        else closePanel();
      },
    });
  }

  // ---- 事件委托（overlay 顶层） ----
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePanel(); return; }
    if (t.closest('[data-fav-add]')) { openForm(null); return; }
    if (t.closest('[data-fav-sort]')) { cycleSort(); return; }
    if (t.closest('[data-fav-close]')) { closePanel(); return; }
    if (t.closest('[data-fav-mobsearch]')) { toggleMobSearch(overlay); return; }
  });
  // 左栏 / 移动 chips 标签（统一按 data-fav-tag 处理；__all = 全部；__archived = 已归档视图）
  overlay.querySelectorAll('[data-fav-tags], [data-fav-mobtags]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-fav-tag]') as HTMLElement | null;
      if (!b) return;
      const label = b.dataset.favTag as string;
      // 再点当前标签 = 取消筛选回全部；点「全部」= 全部；点「已归档」= 归档视图
      if (label === '__all') { M.tag = null; M.archived = false; }
      else if (label === '__archived') { M.tag = null; M.archived = !M.archived; }
      else { M.archived = false; M.tag = M.tag === label ? null : label; }
      renderAll();
    });
  });

  // 搜索（桌面 + 移动，防抖）
  const bindSearch = (inp: HTMLInputElement) => {
    inp.addEventListener('input', () => {
      clearTimeout((inp as any)._favDeb);
      (inp as any)._favDeb = setTimeout(() => {
        M.q = inp.value.trim();
        renderAll();
      }, SEARCH_DEBOUNCE_MS);
    });
  };
  bindSearch(overlay.querySelector('[data-fav-search]') as HTMLInputElement);
  bindSearch(overlay.querySelector('[data-fav-mobsearch-inp]') as HTMLInputElement);

  // 内容区：卡片点击（移动抽屉 / 桌面浮层）+ 右键
  const content = overlay.querySelector('[data-fav-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const card = t.closest('[data-fav-id]') as HTMLElement | null;
    if (!card) return;
    e.stopPropagation();
    const it = itemById(card.dataset.favId as string);
    if (!it) return;
    if (isMobileEnv()) openMobSheet(it);
    else openRowMenu(card, it);
  });
  content.addEventListener('contextmenu', (e) => {
    const card = (e.target as HTMLElement).closest('[data-fav-id]') as HTMLElement | null;
    if (!card || isMobileEnv()) return;
    e.preventDefault();
    const it = itemById(card.dataset.favId as string);
    if (it) openRowMenuAt(card, it, e.clientX, e.clientY);
  });

  void (async () => {
    await loadItems();
    renderAll();
    void refreshBalances(dm);
  })();
}

export function closePanel(): void {
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  M.renderFn = null;
}

export function unloadFavoritesUI(): void {
  closePanel();
  resetFavoritesState();
}

async function loadItems(): Promise<void> {
  try {
    M.items = await dataManagerOf().getAll();
  } catch (e) {
    M.items = [];
    // 读取失败不再静默显示「暂无收藏」（用户会误以为数据丢了）
    notice('收藏数据读取失败，已显示为空列表', 'error');
    console.error('[favorites-load]', e);
  }
}

/** 数据刷新（外部写盘后：删除/置顶/归档/编辑后调用） */
async function reload(): Promise<void> {
  await loadItems();
  M.renderFn?.();
}

// ==================== 渲染 ====================

function renderAll(): void {
  if (!M.overlay) return;
  renderTags();
  renderCount();
  renderContent();
}

function renderTags(): void {
  const overlay = M.overlay!;
  const mkSide = (label: string, emojiOrIcon: string, cnt: number, active: boolean) =>
    `<button class="bz-fav-side-item${active ? ' bz-fav-nav-active' : ''}" data-fav-tag="${esc(label)}"><span class="bz-fav-side-emoji">${emojiOrIcon}</span><span class="bz-fav-side-name">${esc(label)}</span><span class="bz-fav-nav-cnt">${cnt}</span></button>`;
  renderTagLists(overlay, mkSide);
  const titleEl = overlay.querySelector('[data-fav-title]') as HTMLElement;
  if (M.archived) titleEl.textContent = '已归档';
  else if (M.tag) titleEl.innerHTML = `${tagEmoji(M.tag)} ${esc(M.tag)}`;
  else titleEl.textContent = '全部';
}

/** 左栏 + 移动 chips 渲染（全部 → 已归档 → 9 类；已归档计数独立于标签） */
function renderTagLists(overlay: HTMLElement, mkSide: (label: string, emojiOrIcon: string, cnt: number, active: boolean) => string): void {
  const side = overlay.querySelector('[data-fav-tags]') as HTMLElement;
  side.innerHTML =
    mkSide('__all', iconSpan(ICON.all), visible().length, !M.archived && M.tag === null) +
    mkSide('__archived', iconSpan(ICON.archived), archivedItems().length, M.archived) +
    TAGS.map((t) => mkSide(t.label, t.emoji, tagCount(t.label), !M.archived && M.tag === t.label)).join('');
  mountIcons(side);
  const mob = overlay.querySelector('[data-fav-mobtags]') as HTMLElement;
  const mkChip = (label: string, emojiOrIcon: string, cnt: number, active: boolean) =>
    `<button class="bz-fav-mobchip${active ? ' bz-fav-mobchip-active' : ''}" data-fav-tag="${esc(label)}">${emojiOrIcon}<span>${esc(label)}</span><span class="bz-fav-chip-cnt">${cnt}</span></button>`;
  mob.innerHTML =
    mkChip('__all', iconSpan(ICON.all), visible().length, !M.archived && M.tag === null) +
    mkChip('__archived', iconSpan(ICON.archived), archivedItems().length, M.archived) +
    TAGS.map((t) => mkChip(t.label, t.emoji, tagCount(t.label), !M.archived && M.tag === t.label)).join('');
  mountIcons(mob);
}

function renderCount(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const n = filtered().length;
  const el = overlay.querySelector('[data-fav-count]') as HTMLElement | null;
  if (el) el.textContent = M.archived ? `${n} 条已归档` : `${n} 条收藏`;
}

/** 搜索无结果时归档池命中数（ticket 188：冷存找回提示） */
function archivedMatchesOf(q: string): number {
  const kw = q.toLowerCase();
  return archivedItems().filter((i) => haystackOf(i).includes(kw)).length;
}

function renderContent(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const content = overlay.querySelector('[data-fav-content]') as HTMLElement;
  const list = filtered();
  if (!list.length) {
    const archHits = !M.archived && M.q ? archivedMatchesOf(M.q) : 0;
    const desc = M.q
      ? (archHits > 0 ? `归档中有 ${archHits} 条匹配，左栏「已归档」可查看` : '试试其他关键词，或清除搜索')
      : '点右上角「添加收藏」记一条';
    content.innerHTML = `<div class="bz-empty"><span class="bz-empty-ic">${iconSpan(ICON.empty)}</span>
      <div class="bz-empty-title">${M.q ? `没有匹配「${esc(M.q)}」的收藏` : (M.archived ? '暂无归档' : '暂无收藏')}</div>
      <div class="bz-empty-desc">${desc}</div></div>`;
    mountIcons(content);
    return;
  }
  content.innerHTML = list.map((it) => cardHtml(it)).join('');
  mountIcons(content);
}

function cardHtml(it: FavoritesItem): string {
  const pinnedCls = it.pinned ? ' bz-fav-card--pinned' : '';
  const linkCls = it.url ? ' bz-fav-card--link' : '';
  const rawUrl = (it.url || '').trim();
  const host = rawUrl ? domainOf(normalizeUrl(rawUrl)) : '';
  const desc = (it.description || '').trim();
  const note = (it.linkedNote || '').trim();
  const tags = displayTagsOf(it);
  const tagBadges = tags.map((t) => `<span class="bz-badge bz-badge--accent">${tagEmoji(t)} ${esc(t)}</span>`).join('');
  const noteBadge = note
    ? `<span class="bz-badge bz-fav-note-badge">${iconSpan(ICON.note, 'bz-ic--xs')} ${esc(note.split('/').pop()!.replace(/\.md$/i, ''))}</span>`
    : '';
  const pinMark = it.pinned ? `${iconSpan(ICON.pin, 'bz-ic--xs')} 置顶 · ` : '';
  const timeBadge = `<span class="bz-badge bz-fav-time-badge">${pinMark}${esc(it.created || '')}</span>`;
  // 弱化域名徽章（ticket 188：meta 行尾；解析失败不出徽章）
  const hostBadge = host ? `<span class="bz-badge bz-fav-host-badge">${iconSpan(ICON.globe, 'bz-ic--xs')} ${esc(host)}</span>` : '';
  const balHtml = it.balance
    ? `<div class="bz-fav-balance-wrap"><span class="bz-fav-balance${balanceToneClass(it.balance)}">${esc(it.balance)}</span></div>`
    : it.balanceError
      ? `<div class="bz-fav-balance-wrap"><span class="bz-fav-balance bz-fav-balance--err" title="${esc(it.balanceError)}">查询失败</span></div>`
      : '';
  return `<div class="bz-fav-card${pinnedCls}${linkCls}" data-fav-id="${esc(it.id)}">
    <div class="bz-fav-card-main">
      <div class="bz-fav-title-row"><span class="bz-fav-title" title="${esc(host || it.title)}">${esc(it.title || '无标题')}</span></div>
      ${desc ? `<div class="bz-fav-desc">${esc(desc)}</div>` : ''}
      <div class="bz-fav-meta">${tagBadges}${noteBadge}${timeBadge}${hostBadge}</div>
    </div>${balHtml}
  </div>`;
}

// ==================== 排序循环 / 移动搜索切换 ====================

function cycleSort(): void {
  M.sort = M.sort === 'created' ? 'title' : 'created';
  const s = getSettings() as any;
  if (s) {
    s.favoritesSortKey = M.sort;
    void saveSettings().catch(() => { /* 设置未注入（测试）静默 */ });
  }
  const overlay = M.overlay;
  if (overlay) {
    const lbl = overlay.querySelector('[data-fav-sort-label]') as HTMLElement | null;
    if (lbl) lbl.textContent = M.sort === 'created' ? '最新收藏' : '标题排序';
  }
  renderCount();
  renderContent();
}

function toggleMobSearch(overlay: HTMLElement): void {
  const row = overlay.querySelector('[data-fav-mobsearch-row]') as HTMLElement;
  const on = !row.classList.contains(MOB_SHOW);
  row.classList.toggle(MOB_SHOW, on);
  if (on) {
    const inp = overlay.querySelector('[data-fav-mobsearch-inp]') as HTMLInputElement | null;
    setTimeout(() => inp?.focus(), 60);
  }
}

// ==================== 行操作浮层（桌面菜单 / 移动抽屉） ====================

/** 抽屉头部（与列表卡一致的 emoji + 标题 + meta） */
function sheetHeadOf(it: FavoritesItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const emoji = document.createElement('span');
  emoji.className = 'bz-fav-sheet-emoji';
  emoji.textContent = tagEmoji((it.tags && it.tags[0]) || it.type || '') || '📌';
  const info = document.createElement('div');
  info.className = 'bz-fav-sheet-info';
  const title = document.createElement('div');
  title.className = 'bz-fav-sheet-title';
  title.textContent = it.title || '无标题';
  info.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'bz-fav-sheet-meta';
  meta.innerHTML = (it.tags || []).map((t) => `<span class="bz-fav-sheet-tag">${tagEmoji(t)} ${esc(t)}</span>`).join('');
  if (it.balance) {
    const b = document.createElement('span');
    b.className = 'bz-fav-sheet-balance' + balanceToneClass(it.balance);
    b.textContent = `余额 ${it.balance}`;
    meta.appendChild(b);
  }
  info.appendChild(meta);
  head.appendChild(emoji);
  head.appendChild(info);
  return head;
}

/** 构建行操作集（动作序：打开→置顶→跳转笔记→刷新余额→编辑→归档→删除，ADR-0074 归档贴删除前） */
function buildActions(it: FavoritesItem, rebuild: () => void): ItemAction[] {
  const acts: ItemAction[] = [];
  const rawUrl = (it.url || '').trim();
  const note = (it.linkedNote || '').trim();
  if (rawUrl) {
    acts.push({
      icon: 'external-link',
      label: '打开',
      title: '在浏览器打开',
      onClick: () => openExternal(normalizeUrl(rawUrl)),
    });
  }
  acts.push({
    icon: it.pinned ? 'pin-off' : 'pin',
    label: it.pinned ? '取消置顶' : '置顶',
    title: '置顶收藏',
    keepOpen: true,
    onClick: () => {
      const next = !it.pinned;
      const prev = it.pinned;
      it.pinned = next;
      void dataManagerOf().update(it.id, { pinned: next })
        .catch((e) => {
          it.pinned = prev;
          notifySaveError(e, '置顶收藏');
        })
        .finally(() => {
          void reload();
          rebuild();
        });
    },
  });
  if (note) {
    acts.push({
      icon: 'file-text',
      label: '跳转笔记',
      sub: note.split('/').pop()?.replace(/\.md$/i, ''),
      title: `跳转到笔记：${note}`,
      onClick: () => jumpToNote(it),
    });
  }
  if (it.llmConfig?.apiKeys && it.llmConfig.balanceUrl) {
    acts.push({
      icon: 'refresh-cw',
      label: '刷新余额',
      title: '重新查询大模型余额',
      keepOpen: true,
      sub: it.balanceError ? '查询失败' : it.balance || '未查询',
      onClick: () => {
        if ((it as any)._favQuerying) return;
        (it as any)._favQuerying = true;
        rebuild();
        void (async () => {
          try {
            const r = await balanceService.fetchBalance(it.llmConfig!);
            it.balance = r.balance;
            it.balanceCacheTime = r.timestamp;
            it.balanceError = null;
            await dataManagerOf().update(it.id, { balance: r.balance, balanceCacheTime: r.timestamp, balanceError: null });
          } catch (e: any) {
            it.balanceError = e?.message || '查询失败';
          } finally {
            (it as any)._favQuerying = false;
            void reload();
            rebuild();
          }
        })();
      },
    });
  }
  acts.push({
    icon: 'pencil',
    label: '编辑',
    title: '编辑收藏',
    keepOpen: true,
    onClick: () => {
      openForm(it);
    },
  });
  // 归档/取消归档（ticket 188：已归档条目动作翻转为取消归档——冷存找回入口；ADR-0074 数据仍在 favorites.json）
  acts.push(it.archived
    ? {
      icon: 'archive-restore',
      label: '取消归档',
      title: '恢复到主列表',
      onClick: () => {
        void unarchiveItem(it);
      },
    }
    : {
      icon: 'archive',
      label: '归档',
      title: '归档收藏',
      onClick: () => {
        void openFlowDialog({
          title: '归档收藏',
          message: `确定归档收藏「${it.title}」吗？归档后不在主列表显示（数据保留），可在通知中撤销。`,
          actions: [
            { label: '取消', value: 'cancel' },
            { label: '归档', value: 'ok', cta: true },
          ],
        }).then((v) => {
          if (v === 'ok') void archiveItem(it);
        });
      },
    });
  acts.push({
    icon: 'trash-2',
    label: '删除',
    kind: 'danger',
    title: '删除收藏',
    sub: it.created || undefined,
    onClick: () => {
      void openFlowDialog({
        title: '删除收藏',
        message: `确定删除收藏「${it.title}」吗？删除后可在通知中撤销。`,
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '删除', value: 'del', danger: true, cta: true },
        ],
      }).then((v) => {
        if (v === 'del') void deleteItem(it);
      });
    },
  });
  return acts;
}

/** 桌面：点行 → 浮层（锚定卡片右下，右键坐标优先） */
function openRowMenu(row: HTMLElement, it: FavoritesItem): void {
  const r = row.getBoundingClientRect();
  openRowMenuAt(row, it, r.right, r.top);
}
function openRowMenuAt(row: HTMLElement, it: FavoritesItem, x: number, y: number): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadOf(it2));
  };
  openItemMenu(x, y, buildActions(it, rebuild), true);
}

/** 移动：底部详情抽屉 */
function openMobSheet(it: FavoritesItem): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadOf(it2));
  };
  openItemSheet(buildActions(it, rebuild), { sheetHead: sheetHeadOf(it) });
}

// ==================== 归档 / 取消归档 / 删除 ====================

/** 归档后可撤销（ticket 188）：toast 挂「撤销」，点击回写 archived=false 恢复主列表 */
async function archiveItem(it: FavoritesItem): Promise<void> {
  try {
    await dataManagerOf().update(it.id, { archived: true, archivedAt: localNow() });
    emitDomainEvent('favorites', { kind: 'archive', title: it.title });
    await reload();
    notifyUndo(`已归档收藏「${it.title}」`, () => {
      void (async () => {
        try {
          await dataManagerOf().update(it.id, { archived: false, archivedAt: null });
          emitDomainEvent('favorites', { kind: 'unarchive', title: it.title });
          await reload();
        } catch (e) {
          notifySaveError(e, '恢复收藏');
        }
      })();
    }, { type: 'archive' });
  } catch (e) {
    notifySaveError(e, '归档收藏');
  }
}

/** 取消归档（已归档视图动作）：回主列表 */
async function unarchiveItem(it: FavoritesItem): Promise<void> {
  try {
    await dataManagerOf().update(it.id, { archived: false, archivedAt: null });
    emitDomainEvent('favorites', { kind: 'unarchive', title: it.title });
    await reload();
    notice(`已取消归档，「${it.title}」回到主列表`, 'success');
  } catch (e) {
    notifySaveError(e, '取消归档');
  }
}

async function deleteItem(it: FavoritesItem): Promise<void> {
  const snapshot = it;
  try {
    await dataManagerOf().delete(it.id);
    emitDomainEvent('favorites', { kind: 'delete', title: it.title });
    await reload();
    notifyUndo(`已删除收藏「${it.title}」`, () => {
      void (async () => {
        try {
          await dataManagerOf().restoreItem(snapshot);
          await reload();
        } catch (e) {
          notifySaveError(e, '恢复收藏');
        }
      })();
    });
  } catch (e) {
    notifySaveError(e, '删除收藏');
  }
}

// ==================== 数据服务（注入/持有；声明见主面板生命周期节） ====================

function dataManagerOf(): DataManager {
  if (!_dm) throw new Error('收藏本数据管理器未初始化');
  return _dm;
}
function aiServiceOf(): FavoritesAIService {
  if (!_ai) throw new Error('收藏本 AI 服务未初始化');
  return _ai;
}
function appOf(): any {
  return _app || getApp();
}
function openExternal(url: string): void {
  const app = appOf();
  try {
    (app as any).openUrl?.(url);
  } catch (e) {
    const electron = (window as any).require && (window as any).require('electron');
    if (electron && electron.shell) electron.shell.openExternal(url);
  }
}
function jumpToNote(it: FavoritesItem): void {
  const note = (it.linkedNote || '').trim();
  if (!note) return;
  const app = appOf();
  const file = app.vault?.getAbstractFileByPath?.(note);
  if (!file) {
    notice(`笔记文件不存在：${note}`, 'warning');
    return;
  }
  closePanel();
  void (app.workspace as any)?.openLinkText?.(note, '', false);
}

// ==================== 添加 / 编辑 表单 ====================

interface FormBaseline {
  title: string;
  url: string;
  desc: string;
  keys: string;
  balanceUrl: string;
  note: string;   // ticket 188：关联笔记纳入防丢
  pinned: boolean; // ticket 188：置顶纳入防丢
  tags: string;   // ticket 188：标签（排序 join）纳入防丢
}

let _saving = false;
let _baseline: FormBaseline | null = null;

/** 表单当前 标签选中集 / 置顶态（DOM 读；供脏比较，避免闭包持有局部状态） */
function formTagsNow(popup: HTMLElement): string {
  return [...popup.querySelectorAll('#fz-tags [data-tag].is-on')]
    .map((b) => (b as HTMLElement).dataset.tag || '')
    .sort()
    .join('|');
}
function formPinNow(popup: HTMLElement): boolean {
  return !!(popup.querySelector('#fz-pin') as HTMLElement | null)?.classList.contains('on');
}

function formDirty(): boolean {
  if (!_baseline) return false;
  const popup = document.querySelector('.bz-fav-form') as HTMLElement | null;
  if (!popup) return false;
  const g = (id: string) => (popup.querySelector(id) as HTMLInputElement | null)?.value ?? '';
  return (
    g('#fz-title') !== _baseline.title ||
    g('#fz-url') !== _baseline.url ||
    g('#fz-desc') !== _baseline.desc ||
    g('#fz-keys') !== _baseline.keys ||
    g('#fz-balurl') !== _baseline.balanceUrl ||
    g('#fz-note') !== _baseline.note ||
    formPinNow(popup) !== _baseline.pinned ||
    formTagsNow(popup) !== _baseline.tags
  );
}

function requestCloseForm(popup: HTMLElement): void {
  if (formDirty()) confirmDiscard(() => closeForm(popup));
  else closeForm(popup);
}

function closeForm(popup: HTMLElement): void {
  _baseline = null;
  _saving = false;
  closeItemMenu();
  unregisterSheetCompanion(popup);
  // 连同遮罩一并移除（收尾扫尾修正：原只移除表单本体，留全屏空遮罩挡住下层交互）
  (popup.closest('.bz-fav-form-mask') ?? popup).remove();
}

/**
 * 关联笔记候选自动补全（ticket 188）：输入/聚焦时列 vault 笔记（路径包含过滤，上限 30），
 * 点选回填；外点关闭；Escape 只收下拉不关表单（与 belongings categoryPicker 同范式）。
 * 表单关闭后首个外部 mousedown 经 isConnected 自清监听。
 */
function notePicker(input: HTMLInputElement): void {
  let pop: HTMLElement | null = null;
  const close = () => {
    if (pop) {
      pop.remove();
      pop = null;
      document.removeEventListener('mousedown', onDocDown, true);
    }
  };
  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!input.isConnected) { close(); return; }
    if (pop?.contains(t) || input.contains(t)) return;
    close();
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    let files: string[] = [];
    try {
      files = ((appOf().vault as any)?.getMarkdownFiles?.() || []).map((f: any) => String(f.path || ''));
    } catch (e) { files = []; }
    // 排除与当前值完全相同的候选（点选回焦后不再复弹自身）
    const matched = files.filter((p) => p && p !== input.value.trim() && (!q || p.toLowerCase().includes(q))).slice(0, 30);
    if (!matched.length) { close(); return; }
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'bz-fav-notepop';
      input.parentElement!.appendChild(pop);
      document.addEventListener('mousedown', onDocDown, true);
    }
    pop.innerHTML = matched.map((p) => `<div class="bz-fav-noteopt" data-note="${esc(p)}">${esc(p)}</div>`).join('');
    pop.querySelectorAll('[data-note]').forEach((o) => o.addEventListener('click', () => {
      input.value = (o as HTMLElement).dataset.note as string;
      close();
      input.focus();
    }));
  };
  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  input.addEventListener('keydown', (e) => {
    // 下拉开着时 Escape 只收下拉（stopPropagation 防 escManager 关表单）；未开不拦
    if (e.key === 'Escape' && pop) {
      close();
      e.stopPropagation();
    }
  });
}

/** 打开添加/编辑表单（编辑来自行浮层时叠于其上：companion 防误关） */
export function openForm(item: FavoritesItem | null): void {
  const it = item;
  const editing = !!it;
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-fav-form-mask';
  mask.innerHTML = `
  <div class="bz-fav-form">
    <div class="bz-fav-form-title">${editing ? '编辑收藏' : '添加收藏'}</div>
    <div class="bz-fav-form-body">
      <div class="bz-field"><span class="bz-field-label">标题</span><input class="bz-input" id="fz-title" value="${it ? esc(it.title) : ''}" placeholder="如：某篇好文"></div>
      <div class="bz-field"><span class="bz-field-label">链接</span><input class="bz-input" id="fz-url" value="${it ? esc(it.url) : ''}" placeholder="https://…"></div>
      <div class="bz-field"><span class="bz-field-label">简介</span><textarea class="bz-input" id="fz-desc" placeholder="一句话记住它…">${it ? esc(it.description) : ''}</textarea></div>
      <div class="bz-field"><span class="bz-field-label">标签（可多选）</span><span class="bz-fav-tagpick" id="fz-tags"></span></div>
      <div class="bz-field bz-fav-form-inline"><button type="button" class="bz-fav-pinbtn${it?.pinned ? ' on' : ''}" id="fz-pin">${iconSpan(ICON.pin, 'bz-ic--sm')}<span>${it?.pinned ? '已置顶' : '置顶'}</span></button><span class="bz-field-desc">置顶后恒排最前</span></div>
      <div class="bz-field"><span class="bz-field-label">关联笔记（可选）</span><input class="bz-input" id="fz-note" value="${it ? esc(it.linkedNote || '') : ''}" placeholder="如：我的/AI 工具库.md"></div>
      <div class="bz-fav-llm" id="fz-llm">
        <div class="bz-fav-llm-title">${iconSpan(ICON.balance, 'bz-ic--sm')}大模型配置</div>
        <div class="bz-field"><span class="bz-field-label">API Keys（每行一个，第一个用于余额查询）</span><textarea class="bz-input" id="fz-keys" placeholder="sk-key1
sk-key2
sk-key3">${it?.llmConfig?.apiKeys ? esc(it.llmConfig.apiKeys) : ''}</textarea></div>
        <div class="bz-field"><span class="bz-field-label">余额查询 URL（完整 URL）</span><input class="bz-input" id="fz-balurl" value="${it?.llmConfig?.balanceUrl ? esc(it.llmConfig.balanceUrl) : ''}" placeholder="https://api.deepseek.com/user/balance"></div>
        <div class="bz-field-desc">系统会自动从返回对象中查找余额数字</div>
      </div>
      <div class="bz-fav-form-err" id="fz-err"></div>
      <div class="bz-btn-row bz-fav-form-actions">
        <button type="button" class="bz-btn bz-btn--ghost" data-fz-ai>${iconSpan('sparkles', 'bz-ic--sm')} AI 整理</button>
        <div class="bz-fav-form-spacer"></div>
        <button type="button" class="bz-btn bz-btn--ghost" data-fz-cancel>取消</button>
        <button type="button" class="bz-btn bz-btn--primary" id="fz-save">${editing ? '更新' : '保存'}</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（原静态 z-index:110000 已删，恒压主面板）
  mountIcons(mask);
  const popup = mask.querySelector('.bz-fav-form') as HTMLElement;
  // 编辑自抽屉浮层打开：注册 companion 防点弹窗误关抽屉（closeForm 注销）
  const sheetOpen = !!document.querySelector('.bz-item-sheet-mask');
  if (editing && sheetOpen) registerSheetCompanion(mask);

  _baseline = {
    title: it?.title || '',
    url: it?.url || '',
    desc: it?.description || '',
    keys: it?.llmConfig?.apiKeys || '',
    balanceUrl: it?.llmConfig?.balanceUrl || '',
    note: it?.linkedNote || '',
    pinned: !!it?.pinned,
    tags: [...(it?.tags || [])].sort().join('|'),
  };

  // 贴链自动搬家（ticket 188）：标题框粘贴 URL 形态内容 → 移入链接框并回焦标题
  const titleInp = popup.querySelector('#fz-title') as HTMLInputElement;
  const urlInp = popup.querySelector('#fz-url') as HTMLInputElement;
  titleInp.addEventListener('paste', (e: ClipboardEvent) => {
    const text = (e.clipboardData || (window as any).clipboardData)?.getData('text')?.trim() || '';
    if (!isUrlLike(text)) return;
    e.preventDefault();
    if (!urlInp.value.trim()) urlInp.value = normalizeUrl(text);
    setTimeout(() => titleInp.focus(), 0);
  });

  // 关联笔记候选自动补全（ticket 188，对照 belongings categoryPicker 范式）
  notePicker(popup.querySelector('#fz-note') as HTMLInputElement);

  // 标签多选 chips（.bz-choice-btn 风格复用）
  const pick = popup.querySelector('#fz-tags') as HTMLElement;
  const sel = new Set<string>(it?.tags || []);
  const drawPick = () => {
    pick.innerHTML = TAGS.map((t) =>
      `<button type="button" class="bz-choice-btn${sel.has(t.label) ? ' is-on' : ''}" data-tag="${esc(t.label)}">${t.emoji} ${esc(t.label)}</button>`
    ).join('');
    mountIcons(pick);
    pick.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
      const label = (b as HTMLElement).dataset.tag as string;
      if (sel.has(label)) sel.delete(label);
      else sel.add(label);
      b.classList.toggle('is-on', sel.has(label));
      syncLlm();
    }));
  };
  // LLM 区显隐：选中「大模型」才显示
  const llm = popup.querySelector('#fz-llm') as HTMLElement;
  const syncLlm = () => {
    const on = sel.has('大模型');
    llm.classList.toggle('bz-fav-llm-on', on);
  };
  drawPick();
  syncLlm();

  // 置顶开关
  let pin = !!(it?.pinned);
  const pinBtn = popup.querySelector('#fz-pin') as HTMLElement;
  const syncPin = () => {
    pinBtn.classList.toggle('on', pin);
    (pinBtn.querySelector('span') as HTMLElement).textContent = pin ? '已置顶' : '置顶';
  };
  pinBtn.addEventListener('click', () => { pin = !pin; syncPin(); });
  syncPin();

  const errEl = popup.querySelector('#fz-err') as HTMLElement;

  // 遮罩点击 / 取消 → 脏拦截
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) requestCloseForm(popup); });
  popup.querySelector('[data-fz-cancel]')?.addEventListener('click', () => requestCloseForm(popup));

  // AI 整理
  popup.querySelector('[data-fz-ai]')?.addEventListener('click', () => void runAiFill(popup, sel, drawPick, syncLlm, errEl));

  // 保存
  popup.querySelector('#fz-save')?.addEventListener('click', () => void saveForm(popup, it, sel, pin, errEl));

  setTimeout(() => (popup.querySelector('#fz-title') as HTMLInputElement)?.focus(), 100);
}

// ==================== AI 整理（旧契约逐字） ====================

async function runAiFill(
  popup: HTMLElement,
  sel: Set<string>,
  redraw: () => void,
  syncLlm: () => void,
  errEl: HTMLElement
): Promise<void> {
  const ai = aiServiceOf();
  if (!ai.isAvailable()) {
    notice('AI 服务未配置或不可用', 'warning');
    return;
  }
  const g = (id: string) => (popup.querySelector(id) as HTMLInputElement | null)?.value ?? '';
  const title = g('#fz-title').trim();
  const url = g('#fz-url').trim();
  const desc = g('#fz-desc').trim();
  if (!title && !url && !desc) {
    notice('请至少输入标题、链接或简介中的一项，以便 AI 参考');
    return;
  }
  const btn = popup.querySelector('[data-fz-ai]') as HTMLButtonElement;
  btn.disabled = true;
  const origin = btn.innerHTML;
  btn.textContent = 'AI 整理中…';
  const handle = notify('AI 分析中…', { type: 'progress' });
  try {
    let ghInfo: { title: string; description: string; fetched: boolean } | null = null;
    if (/github\.com\//.test(url)) {
      try {
        ghInfo = await ai.fetchGitHubInfo(url);
        handle.setMessage(ghInfo.fetched ? '已获取仓库信息，正在整理…' : '仓库简介获取失败，按常规整理…');
      } catch (e) {
        ghInfo = null;
      }
    }
    const text = aiPrompt(title, url, desc, ghInfo);
    if (!ai.ai) throw new Error('AI 服务不可用');
    const raw = await ai.ai.chat(text);
    const data = parseAiJson(raw);
    if (!data) throw new Error('AI 返回格式错误');
    const setVal = (id: string, v: unknown) => {
      const el = popup.querySelector(id) as HTMLInputElement | null;
      if (el && !el.value.trim() && v) el.value = String(v);
    };
    if (ghInfo?.fetched) setVal('#fz-title', ghInfo.title);
    setVal('#fz-title', data.title);
    setVal('#fz-url', data.url);
    setVal('#fz-desc', data.description);
    const rawTags: string[] = Array.isArray(data.tags) ? data.tags.map((x: any) => String(x)) : data.tags ? [String(data.tags)] : [];
    const known = TAGS.map((t) => t.label);
    const valid = rawTags.filter((t) => known.includes(t));
    const unknown = rawTags.filter((t) => !known.includes(t));
    if (unknown.length) notice(`AI 整理的标签「${unknown.join('、')}」不在列表中，已忽略`, 'warning');
    if (ghInfo && !valid.includes('GitHub')) valid.unshift('GitHub');
    sel.clear();
    valid.forEach((t) => sel.add(t));
    redraw();
    syncLlm();
    handle.setType('success');
    handle.setMessage('AI 整理完成');
  } catch (e: any) {
    handle.setType('error');
    handle.setMessage(`AI 整理失败：${e?.message || '未知错误'}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origin;
    errEl.textContent = '';
  }
}

/** AI 提示词（GitHub 版含翻译约束；简介禁编造） */
function aiPrompt(title: string, url: string, desc: string, ghInfo: { title: string; description: string; fetched: boolean } | null): string {
  const known = TAGS.map((t) => `${t.label}（${t.emoji}）`).join('、');
  const base = `你是收藏整理助手。把用户输入的收藏信息整理成 JSON（只输出 JSON，不输出任何多余文字），严格以下格式：
{"title":"标题","url":"链接","description":"简介","tags":["标签1","标签2"]}
规则：
- 标题 ≤ 10 字；
- 简介 20-50 字；
- 链接缺协议头自动补 https://，无法判断则原样返回；
- 标签只能从固定列表选 1-3 个：${known}；
- 简介必须忠实，禁止编造。`;
  const gh = ghInfo
    ? `\nGitHub 仓库：${ghInfo.title}\n仓库简介${ghInfo.fetched ? '' : '（获取失败，简介必须返回空字符串，严禁编造或自行生成简介）'}：${ghInfo.description}\n- 简介忠实翻译成中文（保持原意，不扩写、不总结、不凑字数；若原简介已是中文则原样保留）；\n- GitHub 链接必须包含 GitHub 标签。`
    : '';
  return `${base}${gh}\n输入：标题「${title}」链接「${url}」简介「${desc}」`;
}

/** 解析 AI 返回 JSON（parse 失败正则提取对象） */
function parseAiJson(raw: string): { title?: string; url?: string; description?: string; tags?: unknown } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch (e2) {
      return null;
    }
  }
}

// ==================== 保存 ====================

async function saveForm(popup: HTMLElement, it: FavoritesItem | null, sel: Set<string>, pin: boolean, errEl: HTMLElement): Promise<void> {
  if (_saving) return;
  const g = (id: string) => (popup.querySelector(id) as HTMLInputElement | null)?.value ?? '';
  const title = g('#fz-title').trim();
  const url = g('#fz-url').trim();
  if (!title) { errEl.textContent = '请输入标题'; return; }
  if (url && !/^https?:\/\//i.test(url)) { errEl.textContent = '链接需以 http(s):// 开头'; return; }
  if (sel.size === 0) { errEl.textContent = '请至少选择一个标签'; return; }
  const desc = g('#fz-desc').trim();
  const note = g('#fz-note').trim();
  const tags = [...sel];
  const hasAiTag = sel.has('大模型');
  const keys = hasAiTag ? g('#fz-keys').trim() : '';
  const balanceUrl = hasAiTag ? g('#fz-balurl').trim() : '';
  if (hasAiTag && !keys) { errEl.textContent = '请填写 API Keys'; return; }

  _saving = true;
  const saveBtn = popup.querySelector('#fz-save') as HTMLButtonElement;
  saveBtn.disabled = true;
  const willQuery = hasAiTag && !!keys && !!balanceUrl;
  // 保存不被余额查询阻塞（ticket 188）：按钮只表达「保存中」，查询后台跑
  saveBtn.textContent = '保存中…';
  const dm = dataManagerOf();
  try {
    if (it) {
      const old = it;
      const next: FavoritesItem = {
        ...old,
        title,
        url,
        description: desc,
        tags,
        pinned: pin,
        linkedNote: note || null,
      };
      const sameCfg = old.llmConfig?.apiKeys === keys && old.llmConfig?.balanceUrl === balanceUrl;
      if (hasAiTag) {
        if (!sameCfg) {
          next.llmConfig = { apiKeys: keys, balanceUrl };
          next.balance = null;
          next.balanceCacheTime = null;
          next.balanceError = null;
        }
      } else if (old.llmConfig) {
        next.llmConfig = null;
        next.balance = null;
        next.balanceCacheTime = null;
        next.balanceError = null;
      }
      const changes = favoritesEditChanges(old, next);
      await dm.update(old.id, next);
      emitDomainEvent('favorites', { kind: 'edit', title: next.title, changes });
      notice('收藏已更新', 'success');
    } else {
      const data: FavoritesItem = {
        id: Date.now().toString(),
        tags,
        title,
        description: desc,
        pinned: pin,
        url,
        balance: null,
        balanceCacheTime: null,
        balanceError: null,
        linkedNote: note || null,
        created: localNow(),
        type: tags[0],
      };
      if (hasAiTag) data.llmConfig = { apiKeys: keys, balanceUrl };
      // 先落盘关表单（ticket 188），余额查询放后台不挡保存
      await dm.add(data);
      emitDomainEvent('favorites', { kind: 'add', item: data });
      notice('收藏已添加', 'success');
      closeForm(popup);
      await reload();
      if (willQuery) {
        void (async () => {
          try {
            const r = await balanceService.fetchBalance(data.llmConfig!);
            await dm.update(data.id, { balance: r.balance, balanceCacheTime: r.timestamp, balanceError: null });
          } catch (e: any) {
            await dm.update(data.id, { balanceError: e?.message || '查询失败' }).catch(() => { /* 落盘失败静默（警告已弹） */ });
            notify('余额查询失败', { type: 'warning', dedupeKey: 'favorites-balance' });
          }
          await reload();
        })();
      }
      return;
    }
    closeForm(popup);
    await reload();
  } catch (e: any) {
    notice(`保存失败：${e?.message || '未知错误'}`, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = it ? '更新' : '保存';
  } finally {
    _saving = false;
  }
}
