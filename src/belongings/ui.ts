/**
 * 归物本 UI（ticket 177：P6「状态边栏 × 时间轴」落码，对照拍板原型重写）
 *
 * 桌面：整宽头行「归物本」（仅标题，设置收敛设置面板）+ 左状态栏（全部 + 四态 + 计数）
 *   + 右内容区——主头行（「购入时间轴」/ N 件 · 总投入 ￥M / 主按钮「记一笔」）→
 *   工具栏（搜索 + 年份下拉）→ 统计条（总资产强调卡 / 日均成本 / 在册件数）→
 *   时间轴（年节 → 月节点 → 物件行；年节可折叠；转卖/丢弃行弱化）。
 * 移动 ≤768：真全屏；头行右上 ＋记一笔 → 🔍搜索(展开) → ✕关闭；状态 chips 横滑；
 *   统计两卡；时间轴同构；点行弹底部详情抽屉。全 icon lucide（分类 emoji 属数据保留）。
 *
 * 计算口径：总资产 = 在用+闲置原价合计；在册件数 = 全部件数；单件日均成本 = 价格 / 已用天数（0 天 = 全价）。
 * ticket 189（ADR-0089 出离闭环）修订：已用天数对出离条目（转卖/丢弃）封口在 exit_date（data.calculateDaysUsedUntil）；
 *   日均成本 =（总购入 - 转卖回本 Σ售价）/ 累计持有天数——推翻 ADR-0083「转卖不填价」，售价为可选字段。
 *
 * 契约保留：belongings.json 零迁移（新字段可选加法）；smartcat 事件（add/edit/status/delete + belongingsEditChanges）；
 *   belongingsMobileDefaultFullscreen 设置键；自动刷新（打开期间监听数据文件 modify，自写短路）；
 *   主题变化重渲染（MutationObserver 仅关心 theme 类）；⚙️ 设置收敛设置面板。
 * ticket 189 增强：状态流转/删除接撤销（notifyUndo）；年节当年/上一年默认展开更早折叠；
 *   统计卡可点（总资产=在用+闲置合成筛选、在册件数=回全部）；表单防丢检查；头行钮间距/触屏档。
 */
import { setIcon } from 'obsidian';
import { notice, notifyUndo } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { escapeHtml } from '../core/utils';
import { openItemMenu, openItemSheet, refreshItemSheet, registerSheetCompanion, unregisterSheetCompanion, closeItemMenu, type ItemAction } from '../core/item-actions';
import { emitDomainEvent } from '../core/domain-bus';
import { belongingsEditChanges } from '../smartcat/belongings-source';
import type { SettingsSchema } from '../core/settings-schema';
import { loadDatabase, saveDatabase, calculateDaysUsedUntil, getDataFilePath } from './data';
import { DEFAULT_CATEGORIES } from './default-categories.gen';
import type { BelongingsDatabase, BelongingsItem } from './types';

/** 状态（数据四态精确串；key = 稳定英文标识） */
const STATUS: Record<string, { label: string; key: string; ic: string; dot: string }> = {
  using: { label: '使用中', key: 'using', ic: 'check', dot: 'var(--bz-success)' },
  idle: { label: '闲置', key: 'idle', ic: 'package', dot: 'var(--bz-info)' },
  sold: { label: '已转卖', key: 'sold', ic: 'banknote', dot: 'var(--bz-warning)' },
  discard: { label: '已丢弃', key: 'discard', ic: 'archive', dot: 'var(--bz-text-3)' },
};
const STATUS_LABELS = ['使用中', '闲置', '已转卖', '已丢弃'];
const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'using', label: '使用中' },
  { key: 'idle', label: '闲置' },
  { key: 'sold', label: '已转卖' },
  { key: 'discard', label: '已丢弃' },
];
const MOB_SHOW = 'bz-bel-mobsearch-show';
const THEME_CLASSES = new Set(['theme-dark', 'theme-light']);

const ICON = {
  all: 'layout-grid',
  add: 'plus',
  search: 'search',
  close: 'x',
  edit: 'pencil',
  del: 'trash-2',
  empty: 'package',
  wallet: 'wallet',
  cal: 'calendar',
  layers: 'layers',
  chevR: 'chevron-right',
  expand: 'plus',
};

// ==================== 模块状态 ====================

interface BelState {
  overlay: HTMLElement | null;
  db: BelongingsDatabase | null;
  /** 状态筛选 key（null = 全部） */
  status: string | null;
  /** 年份筛选（'' = 全部） */
  year: string;
  q: string;
  /** 年节折叠（year -> true 折叠） */
  collapsed: Record<string, boolean>;
  renderFn: (() => void) | null;
}

const M: BelState = {
  overlay: null,
  db: null,
  status: null,
  year: '',
  q: '',
  collapsed: {},
  renderFn: null,
};

export function resetBelongingsState(): void {
  M.overlay = null;
  M.db = null;
  M.status = null;
  M.year = '';
  M.q = '';
  M.collapsed = {};
  M.renderFn = null;
}

// ==================== 设置 schema ====================

export function belongingSettingsSchema(): SettingsSchema {
  return { groups: [mobileFullscreenGroup('belongingsMobileDefaultFullscreen', { desc: '' })] };
}

// ==================== 小工具 ====================

function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}
/** lucide 占位 → setIcon（Obsidian 原生，替换为真图标保持 class 修饰） */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    try {
      const fresh = document.createElement('span');
      fresh.className = 'bz-ic';
      if (cls && cls !== 'bz-ic') fresh.className = cls;
      setIcon(fresh, name);
      el.replaceWith(fresh);
    } catch (e) { /* 未知图标忽略 */ }
  });
}
function money(n: number): string {
  return '￥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function moneyShort(n: number): string {
  return '￥' + (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 分类 emoji（取首段 emoji；无 emoji 显示首字） */
function catEmoji(cat: string): string {
  const m = String(cat || '').match(/^(\p{Extended_Pictographic})/u);
  return m ? m[1] : String(cat || '')[0] || '📦';
}
function catNameOf(cat: string): string {
  return String(cat || '').replace(/^\p{Extended_Pictographic}\s*/u, '');
}
function statusKeyOf(label: string): string {
  return STATUS_ORDER.find((s) => s.label === label)?.key ?? label;
}
function statusOf(keyOrLabel: string): { key: string; label: string } {
  const byKey = STATUS_ORDER.find((s) => s.key === keyOrLabel);
  if (byKey) return byKey;
  const byLabel = STATUS_ORDER.find((s) => s.label === keyOrLabel);
  return byLabel || { key: 'using', label: '使用中' };
}

// ==================== 派生 ====================

function itemList(): BelongingsItem[] {
  return M.db ? Object.values(M.db.items) : [];
}
/** 是否出离态（转卖/丢弃） */
function isExited(it: BelongingsItem): boolean {
  return it.current_status === '已转卖' || it.current_status === '已丢弃';
}
/** 出离日期（非出离态恒 null；ADR-0089 陪伴天数封口锚点） */
function exitDateOf(it: BelongingsItem): string | null {
  return isExited(it) ? (it.exit_date || null) : null;
}
/** 已用天数：出离条目封口在 exit_date，其余截至今天（复用 data 单一口径） */
function daysUsed(it: BelongingsItem): number {
  return calculateDaysUsedUntil(it.purchase_date, exitDateOf(it));
}
function dailyCostOf(it: BelongingsItem): number {
  const days = daysUsed(it);
  const price = Number(it.purchase_price) || 0;
  return days > 0 ? price / days : price;
}
/** 总资产 = 在用 + 闲置原价合计 */
function totalAssets(): number {
  return itemList()
    .filter((i) => i.current_status === '使用中' || i.current_status === '闲置')
    .reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
}
/** 日均成本 =（总购入 - 转卖回本 Σ售价）/ 累计持有天数（ADR-0089：售价可选，未记 = 0 回本） */
function avgDailyCost(): number {
  let cost = 0;
  let days = 0;
  for (const it of itemList()) {
    cost += Number(it.purchase_price) || 0;
    if (it.current_status === '已转卖' && Number(it.sold_price) > 0) cost -= Number(it.sold_price);
    days += daysUsed(it);
  }
  return days ? cost / days : 0;
}
function totalSpend(): number {
  return itemList().reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
}
function statusCount(label: string): number {
  return itemList().filter((i) => i.current_status === label).length;
}
function filtered(): BelongingsItem[] {
  return itemList()
    .filter((i) => {
      if (!M.status) return true;
      // ticket 189：总资产卡合成筛选（在用+闲置）
      if (M.status === 'asset') return i.current_status === '使用中' || i.current_status === '闲置';
      return i.current_status === statusOf(M.status).label;
    })
    .filter((i) => (M.year ? String(i.purchase_date || '').startsWith(M.year) : true))
    .filter((i) => {
      if (!M.q) return true;
      const q = M.q.toLowerCase();
      return [i.name, i.category, i.description].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => String(b.purchase_date || '').localeCompare(String(a.purchase_date || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'zh'));
}
function yearsAvailable(): string[] {
  const set = new Set<string>();
  itemList().forEach((i) => {
    const y = String(i.purchase_date || '').slice(0, 4);
    if (y) set.add(y);
  });
  return [...set].sort().reverse();
}
function itemById(id: string): BelongingsItem | undefined {
  return M.db?.items[id];
}

// ==================== 主面板结构 ====================

function panelHtml(): string {
  return `<div class="bz-bel-panel bz-panel-mtop">
  <div class="bz-bel-head">
    <div class="bz-bel-title">归物本</div>
    <div class="bz-bel-head-btns">
      <button class="bz-icon-btn bz-bel-mob-only" data-bel-add title="记一笔">${iconSpan(ICON.add)}</button>
      <button class="bz-icon-btn bz-bel-mob-only" data-bel-mobsearch title="搜索">${iconSpan(ICON.search)}</button>
      <button class="bz-icon-btn bz-bel-mob-only" data-bel-close title="关闭">${iconSpan(ICON.close)}</button>
    </div>
  </div>
  <div class="bz-bel-body">
    <aside class="bz-bel-side">
      <div class="bz-bel-side-label">状态</div>
      <div class="bz-bel-side-scroll" data-bel-status></div>
    </aside>
    <div class="bz-bel-main">
      <div class="bz-bel-main-head">
        <div class="bz-bel-main-title">购入时间轴</div>
        <div class="bz-bel-main-count" data-bel-count></div>
        <div class="bz-bel-main-spacer"></div>
        <button class="bz-btn bz-btn--primary" data-bel-add>${iconSpan(ICON.add, 'bz-ic--sm')} 记一笔</button>
      </div>
      <div class="bz-bel-toolbar">
        <div class="bz-bel-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-bel-search placeholder="搜索名称 / 分类…"></div>
        <div class="bz-bel-yearsel">
          <select class="bz-bel-select" data-bel-year></select>
          ${iconSpan(ICON.chevR, 'bz-bel-select-chev')}
        </div>
      </div>
      <div class="bz-bel-mobscenes" data-bel-mobstatus></div>
      <div class="bz-bel-mobsearch" data-bel-mobsearch-row>
        <div class="bz-bel-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-bel-mobsearch-inp placeholder="搜索名称 / 分类…"></div>
      </div>
      <div class="bz-bel-stats" data-bel-stats></div>
      <div class="bz-bel-content" data-bel-content></div>
    </div>
  </div>
</div>`;
}

// ==================== 主面板生命周期 ====================

/** ESC 层（bz-bel）：主面板 || 表单——表单悬浮时 ESC 先关表单，不穿透关掉身后的主面板（对照 favorites bz-fav） */
let mainEscRegistered = false;
function ensureBelongingsEsc(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-bel', {
    isVisible: () => !!M.overlay || !!document.querySelector('.bz-bel-form-mask'),
    close: () => {
      const form = document.querySelector('.bz-bel-form-mask') as HTMLElement | null;
      if (form) {
        // 脏表单走 confirmDiscard 拦截（ticket 189，对照 favorites）
        requestCloseBelForm(form);
      } else {
        closePanel();
      }
    },
  });
}
/** 数据文件 modify 自动刷新（打开期间注册，关闭注销——用户拍板实时刷新） */
let autoRefreshOff: (() => void) | null = null;
/** 本会话写盘标记（自写短路：modify 事件不回读重渲） */
let selfWritePending = false;
/** 主题变化监听（模块级持有，卸载时断开） */
let bodyThemeObserver: MutationObserver | null = null;
/** 打开中互斥（loadDatabase await 窗口内重入直接忽略，杜绝双触发双遮罩——僵尸遮罩只能重载） */
let opening = false;

export async function openPanel(): Promise<void> {
  if (M.overlay) {
    closePanel();
    return;
  }
  if (opening) return;
  opening = true;
  try {
    await openPanelInner();
  } finally {
    opening = false;
  }
}

async function openPanelInner(): Promise<void> {
  M.db = await loadDatabase();
  const overlay = document.createElement('div');
  overlay.className = 'bz-bel-overlay';
  overlay.innerHTML = panelHtml();
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（原静态 z-index:100000 已删）
  M.overlay = overlay;
  M.renderFn = () => renderAll();
  applyMobileWindowFullscreen(
    overlay.querySelector('.bz-bel-panel') as HTMLElement,
    (tryGetSettings() as any)?.belongingsMobileDefaultFullscreen === true
  );
  mountIcons(overlay);

  // ESC（主面板 + 表单双窗口径；表单也可能先于面板打开——命令路径）
  ensureBelongingsEsc();

  // ---- 事件委托 ----
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePanel(); return; }
    if (t.closest('[data-bel-add]')) { void openForm(null); return; }
    if (t.closest('[data-bel-close]')) { closePanel(); return; }
    if (t.closest('[data-bel-mobsearch]')) { toggleMobSearch(overlay); return; }
    // 统计卡可点（ticket 189）：总资产=在用+闲置合成筛选（再点取消）；在册件数=清筛选回全部
    const statCard = t.closest('[data-bel-statclick]') as HTMLElement | null;
    if (statCard) {
      const kind = statCard.dataset.belStatclick;
      if (kind === 'asset') M.status = M.status === 'asset' ? null : 'asset';
      else if (kind === 'count') {
        M.status = null; M.year = ''; M.q = '';
        const sel = overlay.querySelector('[data-bel-year]') as HTMLSelectElement | null;
        if (sel) sel.value = '';
        (['[data-bel-search]', '[data-bel-mobsearch-inp]'] as const).forEach((s2) => {
          const inp = overlay.querySelector(s2) as HTMLInputElement | null;
          if (inp) inp.value = '';
        });
      }
      renderAll();
      return;
    }
  });
  // 状态（左栏 / 移动 chips）
  overlay.querySelectorAll('[data-bel-status], [data-bel-mobstatus]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-bel-st]') as HTMLElement | null;
      if (!b) return;
      const k = b.dataset.belSt as string;
      if (k === '__all') {
        // 再点「全部」= 取消筛选回未筛选（nav 高亮回落到全部）
        M.status = null;
      } else {
        // 再点当前项 = 取消筛选回全部；点其他状态 = 切换
        M.status = M.status === k ? null : k;
      }
      renderAll();
    });
  });
  // 年份下拉（桌面/移动同步）
  const yearSel = overlay.querySelector('[data-bel-year]') as HTMLSelectElement;
  yearSel.addEventListener('change', () => {
    M.year = yearSel.value;
    renderAll();
  });
  // 搜索
  const bindSearch = (inp: HTMLInputElement) => {
    inp.addEventListener('input', () => {
      clearTimeout((inp as any)._belDeb);
      (inp as any)._belDeb = setTimeout(() => {
        M.q = inp.value.trim();
        renderStats();
        renderCount();
        renderContent();
      }, 180);
    });
  };
  bindSearch(overlay.querySelector('[data-bel-search]') as HTMLInputElement);
  bindSearch(overlay.querySelector('[data-bel-mobsearch-inp]') as HTMLInputElement);

  // 内容区：行点击（移动抽屉 / 桌面浮层）+ 右键 + 年节折叠
  const content = overlay.querySelector('[data-bel-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const yearHead = t.closest('[data-bel-yearhead]') as HTMLElement | null;
    if (yearHead) {
      const y = yearHead.dataset.belYearhead as string;
      M.collapsed[y] = !M.collapsed[y];
      renderContent();
      return;
    }
    const expand = t.closest('[data-bel-expand]') as HTMLElement | null;
    if (expand) {
      M.collapsed[expand.dataset.belExpand as string] = false;
      renderContent();
      return;
    }
    const row = t.closest('[data-bel-id]') as HTMLElement | null;
    if (!row) return;
    e.stopPropagation();
    const it = itemById(row.dataset.belId as string);
    if (!it) return;
    if (isMobileEnv()) openMobSheet(it);
    else openRowMenu(row, it);
  });
  content.addEventListener('contextmenu', (e) => {
    const row = (e.target as HTMLElement).closest('[data-bel-id]') as HTMLElement | null;
    if (!row || isMobileEnv()) return;
    e.preventDefault();
    const it = itemById(row.dataset.belId as string);
    if (it) openRowMenuAt(row, it, e.clientX, e.clientY);
  });

  renderAll();
  startAutoRefresh();
  observeTheme();
}

export function closePanel(): void {
  stopAutoRefresh();
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  M.renderFn = null;
}

export function cleanupBelongings(): void {
  stopAutoRefresh();
  if (bodyThemeObserver) {
    bodyThemeObserver.disconnect();
    bodyThemeObserver = null;
  }
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  resetBelongingsState();
}

// ==================== 数据文件自动刷新 / 主题监听 ====================

/** 打开期间监听数据文件变更（modify）自动刷新；自写短路吸收（P44 去双渲染） */
function startAutoRefresh(): void {
  stopAutoRefresh();
  const app = getApp();
  const filePath = getDataFilePath();
  const off = (app.vault as any).on('modify', (file: any) => {
    if (file?.path !== filePath) return;
    if (selfWritePending) return;
    void (async () => {
      M.db = await loadDatabase();
      M.renderFn?.();
    })();
  });
  autoRefreshOff = () => (app.vault as any).offref(off);
}
function stopAutoRefresh(): void {
  if (autoRefreshOff) {
    try { autoRefreshOff(); } catch (e) { /* 忽略 */ }
    autoRefreshOff = null;
  }
}

/** 主题变化重渲染（仅关心 body theme 类差异，P44 去全量） */
function observeTheme(): void {
  if (bodyThemeObserver) {
    bodyThemeObserver.disconnect();
    bodyThemeObserver = null;
  }
  const themeOf = () => {
    const cls = document.body.className.split(' ').find((c) => THEME_CLASSES.has(c));
    return cls || '';
  };
  let prev = themeOf();
  bodyThemeObserver = new MutationObserver(() => {
    const now = themeOf();
    if (now !== prev) {
      prev = now;
      M.renderFn?.();
    }
  });
  bodyThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/** 保存 + 渲染单点入口（自写短路标记） */
async function saveAndRender(): Promise<void> {
  if (!M.db) return;
  selfWritePending = true;
  try {
    await saveDatabase(M.db);
  } finally {
    selfWritePending = false;
  }
  M.renderFn?.();
}

// ==================== 渲染 ====================

function renderAll(): void {
  if (!M.overlay) return;
  renderStatus();
  renderYears();
  renderStats();
  renderCount();
  renderContent();
}

function renderStatus(): void {
  const overlay = M.overlay!;
  const side = overlay.querySelector('[data-bel-status]') as HTMLElement;
  const mkSide = (key: string, label: string, ic: string, cnt: number, active: boolean, dot?: string) =>
    `<button class="bz-bel-side-item${active ? ' bz-bel-nav-active' : ''}" data-bel-st="${key}"><span class="bz-bel-side-ic">${iconSpan(ic)}</span><span class="bz-bel-side-name">${esc(label)}</span><span class="bz-bel-nav-cnt">${cnt}</span></button>`;
  side.innerHTML =
    mkSide('__all', '全部', ICON.all, itemList().length, M.status === null) +
    STATUS_ORDER.map((s) => mkSide(s.key, s.label, STATUS[s.key].ic, statusCount(s.label), M.status === s.key)).join('');
  mountIcons(side);
  const mob = overlay.querySelector('[data-bel-mobstatus]') as HTMLElement;
  const mkChip = (key: string, label: string, ic: string, cnt: number, active: boolean) =>
    `<button class="bz-bel-mobchip${active ? ' bz-bel-mobchip-active' : ''}" data-bel-st="${key}">${iconSpan(ic)}<span>${esc(label)}</span><span class="bz-bel-chip-cnt">${cnt}</span></button>`;
  mob.innerHTML =
    mkChip('__all', '全部', ICON.all, itemList().length, M.status === null) +
    STATUS_ORDER.map((s) => mkChip(s.key, s.label, STATUS[s.key].ic, statusCount(s.label), M.status === s.key)).join('');
  mountIcons(mob);
}

function renderYears(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const sel = overlay.querySelector('[data-bel-year]') as HTMLSelectElement;
  const ys = yearsAvailable();
  // 外部数据变化后选中年份可能悬空（列表恒空但 UI 显示「全部年份」）——重置回全部
  if (M.year && !ys.includes(M.year)) M.year = '';
  const cur = M.year;
  sel.innerHTML = '<option value="">全部年份</option>' + ys.map((y) => `<option value="${y}"${cur === y ? ' selected' : ''}>${y}</option>`).join('');
  sel.value = cur;
}

function renderStats(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const wrap = overlay.querySelector('[data-bel-stats]') as HTMLElement;
  const s = {
    total: totalAssets(),
    avg: avgDailyCost(),
    count: itemList().length,
  };
  // ticket 189：总资产/在册件数两卡可点（合成筛选 / 回全部）；口径不动只加视图联动
  const card = (label: string, value: string, ic: string, main = false, click?: string) =>
    `<div class="${main ? 'bz-bel-stat-main' : 'bz-bel-stat'}${click ? ' bz-bel-stat--click' : ''}"${click ? ` data-bel-statclick="${click}" title="${click === 'asset' ? '只看在用与闲置' : '清除筛选回全部'}"` : ''}><span class="bz-bel-stat-label">${iconSpan(ic)}${esc(label)}</span><span class="bz-bel-stat-value">${value}</span></div>`;
  wrap.innerHTML =
    card('总资产', moneyShort(s.total), ICON.wallet, true, 'asset') +
    card('日均成本', '￥' + s.avg.toFixed(2), ICON.cal) +
    card('在册件数', String(s.count), ICON.layers, false, 'count');
  mountIcons(wrap);
}

function renderCount(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const el = overlay.querySelector('[data-bel-count]') as HTMLElement | null;
  if (!el) return;
  const list = filtered();
  const all = list.length === itemList().length;
  el.textContent = all ? `${itemList().length} 件 · 总投入 ${moneyShort(totalSpend())}` : `${list.length} 件`;
}

function renderContent(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const content = overlay.querySelector('[data-bel-content]') as HTMLElement;
  const list = filtered();
  if (!list.length) {
    // 空态文案区分：库空（这里还没有物品）vs 筛选/搜索无匹配（没有符合条件的物品）
    const noMatch = !!M.q || M.status !== null || M.year !== '';
    content.innerHTML = `<div class="bz-empty"><span class="bz-empty-ic">${iconSpan(ICON.empty)}</span>
      <div class="bz-empty-title">${noMatch ? '没有符合条件的物品' : '这里还没有物品'}</div>
      <div class="bz-empty-desc">${noMatch ? '换个筛选条件，或清除搜索' : '点右上角「记一笔」登记第一个物品'}</div></div>`;
    mountIcons(content);
    return;
  }
  // 分组 年 → 月（降序；空购买日期归「未标注」年尾）
  const groups: Record<string, Record<string, BelongingsItem[]>> = {};
  list.forEach((it) => {
    const y = String(it.purchase_date || '').slice(0, 4) || '未标注';
    const m = String(it.purchase_date || '').slice(5, 7) || '';
    (groups[y] = groups[y] || {})[m] = groups[y][m] || [];
    groups[y][m].push(it);
  });
  let html = '';
  const yearKeys = Object.keys(groups).sort().reverse();
  // 「未标注」恒置尾
  if (yearKeys.includes('未标注')) {
    yearKeys.splice(yearKeys.indexOf('未标注'), 1);
    yearKeys.push('未标注');
  }
  yearKeys.forEach((y) => {
    const yItems = list.filter((i) => (String(i.purchase_date || '').slice(0, 4) || '未标注') === y);
    const yCost = yItems.reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
    // ticket 189：当年/上一年默认展开、更早（含未标注）默认折叠；手动操作过以会话内状态为准
    const collapsed = M.collapsed[y] !== undefined ? M.collapsed[y] : yearDefaultCollapsed(y);
    html += `<div class="bz-bel-year">
      <div class="bz-bel-year-head${collapsed ? '' : ' is-open'}" data-bel-yearhead="${y}">${esc(y === '未标注' ? '未标注日期' : y)} <span class="bz-bel-year-meta">${yItems.length} 件 · 投入 ${moneyShort(yCost)}</span>${iconSpan(ICON.chevR, 'bz-bel-year-chev')}</div>`;
    if (!collapsed) {
      Object.keys(groups[y]).sort().reverse().forEach((m) => {
        html += `<div class="bz-bel-month"><div class="bz-bel-month-head">${m ? parseInt(m, 10) + ' 月' : '日期未知'}</div>`;
        groups[y][m].forEach((it) => { html += rowHtml(it); });
        html += '</div>';
      });
    } else {
      html += `<div class="bz-bel-collapsed" data-bel-expand="${y}">${iconSpan(ICON.expand, '')} 展开 ${y === '未标注' ? '未标注日期' : y + ' 年'}（${yItems.length} 件）</div>`;
    }
    html += '</div>';
  });
  content.innerHTML = html;
  mountIcons(content);
}

/** 年节默认折叠（ticket 189）：当年/上一年展开，更早与未标注折叠 */
function yearDefaultCollapsed(y: string): boolean {
  if (y === '未标注') return true;
  const yn = parseInt(y, 10);
  if (!Number.isFinite(yn)) return true;
  const cy = new Date().getFullYear();
  return yn < cy - 1;
}

function rowHtml(it: BelongingsItem): string {
  const inactive = isExited(it);
  const days = daysUsed(it);
  const daily = dailyCostOf(it);
  // 出离副行（ADR-0089）：陪伴天数封口；转卖记了售价追加「售出 ￥x」
  const soldPart = it.current_status === '已转卖' && Number(it.sold_price) > 0
    ? ` · 售出 ${moneyShort(Number(it.sold_price))}`
    : '';
  const rightSub = it.current_status === '已丢弃'
    ? `陪伴 ${days || '—'} 天`
    : it.current_status === '已转卖'
      ? `陪伴 ${days || '—'} 天${soldPart}`
      : `日均 ￥${daily.toFixed(1)}`;
  return `<div class="bz-bel-row${inactive ? ' bz-bel-row--inactive' : ''}" data-bel-id="${esc(it.id)}">
    <div class="bz-bel-thumb">${esc(catEmoji(it.category))}</div>
    <div class="bz-bel-row-main">
      <div class="bz-bel-name">${esc(it.name)}</div>
      <div class="bz-bel-sub"><span class="bz-bel-state bz-bel-state--${statusKeyOf(it.current_status)}">${iconSpan(STATUS[statusKeyOf(it.current_status)]?.ic || 'box')}${esc(it.current_status)}</span><span>${esc(catNameOf(it.category))}${it.purchase_date ? ' · ' + esc(String(it.purchase_date).slice(0, 10)) : ''}</span></div>
    </div>
    <div class="bz-bel-days${inactive ? ' bz-bel-days--inactive' : ''}">${days ? days + ' 天' : '—'}</div>
    <div class="bz-bel-right"><span class="bz-bel-price"><b>${moneyShort(Number(it.purchase_price) || 0)}</b></span><span class="bz-bel-daily">${rightSub}</span></div>
  </div>`;
}

// ==================== 行操作浮层 ====================

function sheetHeadOf(it: BelongingsItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const body = document.createElement('div');
  body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';
  const emoji = document.createElement('span');
  emoji.className = 'bz-item-sheet-emoji';
  emoji.textContent = catEmoji(it.category) || '📦';
  body.appendChild(emoji);
  const info = document.createElement('div');
  info.style.cssText = 'flex:1; min-width:0;';
  const title = document.createElement('div');
  title.className = 'bz-item-sheet-title';
  title.textContent = it.name;
  info.appendChild(title);
  const sub = document.createElement('div');
  sub.className = 'bz-item-sheet-sub';
  const catName = catNameOf(it.category);
  const days = daysUsed(it);
  sub.textContent = `${catName} · ${money(Number(it.purchase_price) || 0)} · 已用 ${days} 天`;
  info.appendChild(sub);
  body.appendChild(info);
  head.appendChild(body);
  return head;
}

/** 行操作（旧动作契约：四态流转 keepOpen → 编辑 keepOpen → 删除 danger）
 *  ticket 189：流转接 notifyUndo（回写旧状态 + 清出离日期）；转卖/丢弃落 exit_date（ADR-0089） */
function buildActions(it: BelongingsItem, rebuild: () => void): ItemAction[] {
  const acts: ItemAction[] = [];
  const iconOf: Record<string, any> = { 使用中: 'check-circle', 闲置: 'package', 已转卖: 'banknote', 已丢弃: 'archive' };
  STATUS_LABELS.forEach((s) => {
    if (s === it.current_status) return;
    acts.push({
      icon: iconOf[s],
      label: `标记为${s}`,
      keepOpen: true,
      onClick: () => {
        void (async () => {
          // 外部 modify 自动刷新会把 M.db 整体换新——按 id 从当前库重取再改，防旧引用改动静默丢失
          const cur = itemById(it.id);
          if (!cur) {
            notice('该物品已被外部变更删除，列表已刷新', 'warning');
            rebuild();
            return;
          }
          const prevStatus = cur.current_status;
          cur.current_status = s;
          // 出离闭环（ADR-0089）：入出离态记当天出离日期；退出出离态且旧值存在才清（避免写冗余 null）
          if (isExited(cur)) cur.exit_date = todayStr();
          else if (cur.exit_date != null) cur.exit_date = null;
          cur.last_updated = new Date().toISOString();
          await saveAndRender();
          emitDomainEvent('belongings', { kind: 'status', title: cur.name, status: s });
          notifyUndo(`「${cur.name}」已标记为${s}`, () => {
            void (async () => {
              const now = itemById(it.id);
              if (!now) {
                notice('该物品已被外部变更删除，无法撤销', 'warning');
                return;
              }
              now.current_status = prevStatus;
              if (now.exit_date != null) now.exit_date = null;
              now.last_updated = new Date().toISOString();
              await saveAndRender();
              notice(`已撤销，「${now.name}」回到${prevStatus}`, 'success');
            })();
          }, { type: 'restore' });
          rebuild();
        })();
      },
    });
  });
  acts.push({
    icon: 'pencil',
    label: '编辑',
    keepOpen: true,
    onClick: () => {
      openForm(it);
    },
  });
  acts.push({
    icon: 'trash-2',
    label: '删除',
    kind: 'danger',
    onClick: () => {
      void deleteItem(it);
    },
  });
  return acts;
}

function openRowMenu(row: HTMLElement, it: BelongingsItem): void {
  const r = row.getBoundingClientRect();
  openRowMenuAt(row, it, r.right, r.top);
}
function openRowMenuAt(row: HTMLElement, it: BelongingsItem, x: number, y: number): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadOf(it2));
  };
  openItemMenu(x, y, buildActions(it, rebuild), true);
}
function openMobSheet(it: BelongingsItem): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadOf(it2));
  };
  openItemSheet(buildActions(it, rebuild), { sheetHead: sheetHeadOf(it) });
}

// ==================== 删除（ticket 189：去威慑文案，确认后接撤销 toast） ====================

async function deleteItem(it: BelongingsItem): Promise<void> {
  const v = await openFlowDialog({
    title: '删除物品',
    message: `确定要删除物品「${it.name}」吗？删除后可在通知中撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'del', danger: true, cta: true },
    ],
  });
  if (v !== 'del' || !M.db) return;
  // 外部 modify 自动刷新会把 M.db 整体换新——确认后仍按 id 校验当前库中存在
  if (!M.db.items[it.id]) {
    notice('该物品已被外部变更删除，列表已刷新', 'warning');
    M.renderFn?.();
    return;
  }
  const snapshot = { ...M.db.items[it.id] };
  delete M.db.items[it.id];
  await saveAndRender();
  emitDomainEvent('belongings', { kind: 'delete', title: it.name });
  notifyUndo(`已删除「${it.name}」`, () => {
    void (async () => {
      if (!M.db) M.db = await loadDatabase();
      if (M.db.items[snapshot.id]) {
        notice(`已存在同 id 物品（${snapshot.id}），跳过恢复`, 'warning');
        return;
      }
      M.db.items[snapshot.id] = snapshot;
      await saveAndRender();
      notice(`已恢复「${snapshot.name}」`, 'success');
    })();
  }, { type: 'restore' });
}

// ==================== 表单（记一笔 / 编辑） ====================

/** 分类搜索选择弹层（输入过滤 + 键盘选择 + 外点关闭；Esc 分层：下拉开只收下拉） */
function categoryPicker(input: HTMLInputElement, current: string): void {
  const wrap = document.createElement('div');
  wrap.className = 'bz-bel-catpop';
  const close = () => {
    if (wrap.isConnected) {
      wrap.remove();
      document.removeEventListener('mousedown', onDocDown, true);
    }
  };
  const onDocDown = (e: MouseEvent) => {
    // 点在输入框/弹层内不关；其余外部点击关闭（关表单/切焦点即收起）
    const t = e.target as Node;
    if (wrap.contains(t) || input.contains(t)) return;
    close();
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const matched = DEFAULT_CATEGORIES.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 60);
    wrap.innerHTML = matched.map((c) =>
      `<div class="bz-bel-catopt${c === current ? ' on' : ''}" data-cat="${esc(c)}">${esc(catEmoji(c))} <span>${esc(catNameOf(c))}</span></div>`
    ).join('');
    wrap.querySelectorAll('[data-cat]').forEach((o) => o.addEventListener('click', () => {
      current = (o as HTMLElement).dataset.cat as string;
      input.value = current;
      close();
    }));
  };
  input.parentElement!.appendChild(wrap);
  document.addEventListener('mousedown', onDocDown, true);
  draw();
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      const opts = wrap.querySelectorAll<HTMLElement>('[data-cat]');
      const idx = [...opts].findIndex((o) => o.classList.contains('on'));
      const next = opts[Math.min(opts.length - 1, idx + 1)];
      if (next) { opts.forEach((o) => o.classList.remove('on')); next.classList.add('on'); }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const on = wrap.querySelector<HTMLElement>('[data-cat].on');
      if (on) { current = on.dataset.cat as string; input.value = current; close(); }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (wrap.isConnected) { close(); e.stopPropagation(); }
    }
  });
}

// ==================== 表单防丢（ticket 189，对照 favorites） ====================

interface BelFormBaseline {
  name: string;
  cat: string;
  price: string;
  date: string;
  status: string;
  desc: string;
  exitDate: string;
  soldPrice: string;
}
let _belBaseline: BelFormBaseline | null = null;

function belFormStatusNow(mask: HTMLElement): string {
  return (mask.querySelector('[data-status].is-on') as HTMLElement | null)?.dataset.status || '';
}

function belFormDirty(): boolean {
  if (!_belBaseline) return false;
  const mask = document.querySelector('.bz-bel-form-mask') as HTMLElement | null;
  if (!mask) return false;
  const g = (id: string) => (mask.querySelector(id) as HTMLInputElement | null)?.value ?? '';
  return (
    g('#bm-name') !== _belBaseline.name ||
    g('#bm-cat') !== _belBaseline.cat ||
    g('#bm-price') !== _belBaseline.price ||
    g('#bm-date') !== _belBaseline.date ||
    g('#bm-desc') !== _belBaseline.desc ||
    g('#bm-exitdate') !== _belBaseline.exitDate ||
    g('#bm-soldprice') !== _belBaseline.soldPrice ||
    belFormStatusNow(mask) !== _belBaseline.status
  );
}

function closeBelForm(mask: HTMLElement): void {
  _belBaseline = null;
  unregisterSheetCompanion(mask);
  mask.remove();
}

function requestCloseBelForm(mask: HTMLElement): void {
  if (belFormDirty()) confirmDiscard(() => closeBelForm(mask));
  else closeBelForm(mask);
}

export function openForm(it: BelongingsItem | null): void {
  // 命令路径（面板未开）先确保 db 已载（旧 addBelongingsItemCommand 语义）
  if (!M.db) {
    void loadDatabase().then((db) => {
      M.db = db;
      openForm(it);
    });
    return;
  }
  const editing = !!it;
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-bel-form-mask';
  const priceVal = it ? String(it.purchase_price ?? '') : '';
  const dateVal = it ? String(it.purchase_date || '').slice(0, 10) : todayStr();
  const catVal = it?.category ?? DEFAULT_CATEGORIES[0] ?? '';
  const descVal = it?.description ?? '';
  // 出离字段初值（ADR-0089）：编辑回填 exit_date；新记/未记 = 今天留空语义见下
  const exitDateVal = it?.exit_date ? String(it.exit_date).slice(0, 10) : todayStr();
  const soldPriceVal = it?.sold_price != null && Number.isFinite(Number(it.sold_price)) ? String(it.sold_price) : '';
  const exitedInit = !!it && isExited(it);
  mask.innerHTML = `
  <div class="bz-bel-form">
    <div class="bz-bel-form-title">${editing ? '编辑物品' : '记一笔'}</div>
    <div class="bz-bel-form-body">
      <div class="bz-field"><span class="bz-field-label">名称</span><input class="bz-input" id="bm-name" value="${esc(it?.name ?? '')}" placeholder="如：iPhone 15 Pro"></div>
      <div class="bz-field"><span class="bz-field-label">分类</span><input class="bz-input bz-bel-catinput" id="bm-cat" value="${esc(catVal)}" placeholder="输入或选择分类" autocomplete="off"></div>
      <div class="bz-bel-form-row">
        <div class="bz-field"><span class="bz-field-label">购买价格（元）</span><input class="bz-input" id="bm-price" type="number" min="0" step="0.01" value="${esc(priceVal)}" placeholder="0.00"></div>
        <div class="bz-field"><span class="bz-field-label">购买日期</span><input class="bz-input" id="bm-date" type="date" value="${esc(dateVal)}"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">状态</span><span class="bz-bel-statuspick" id="bm-status"></span></div>
      <div class="bz-bel-form-row" id="bm-exit"${exitedInit ? '' : ' hidden'}>
        <div class="bz-field"><span class="bz-field-label">出离日期</span><input class="bz-input" id="bm-exitdate" type="date" value="${esc(exitDateVal)}"></div>
        <div class="bz-field" id="bm-soldfield"${it?.current_status === '已转卖' ? '' : ' hidden'}><span class="bz-field-label">转卖售价（可选）</span><input class="bz-input" id="bm-soldprice" type="number" min="0" step="0.01" value="${esc(soldPriceVal)}" placeholder="留空不记售价"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">描述（可选）</span><textarea class="bz-input" id="bm-desc" placeholder="规格、颜色、购买原因等…">${esc(descVal)}</textarea></div>
      <div class="bz-bel-form-err" id="bm-err"></div>
      <div class="bz-btn-row bz-bel-form-actions">
        <div class="bz-bel-form-spacer"></div>
        <button type="button" class="bz-btn bz-btn--ghost" data-bm-cancel>取消</button>
        <button type="button" class="bz-btn bz-btn--primary" id="bm-save">${editing ? '更新' : '保存'}</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（原静态 z-index:110000 已删，恒压主面板）
  mountIcons(mask);
  ensureBelongingsEsc(); // 表单可在面板未开时打开（命令路径）——ESC 层在此保证已注册
  // 编辑自抽屉：companion 防误关
  const sheetOpen = !!document.querySelector('.bz-item-sheet-mask');
  if (editing && sheetOpen) registerSheetCompanion(mask);

  // 防丢基线（ticket 189）：开表单时的全字段快照
  _belBaseline = {
    name: it?.name ?? '',
    cat: catVal,
    price: priceVal,
    date: dateVal,
    status: it?.current_status || '使用中',
    desc: descVal,
    exitDate: exitDateVal,
    soldPrice: soldPriceVal,
  };

  // 分类搜索选择
  const catInput = mask.querySelector('#bm-cat') as HTMLInputElement;
  let curCat = catVal;
  categoryPicker(catInput, curCat);
  // 状态单选（平铺胶囊）；出离态展开出离记录行（ADR-0089）
  const statusPick = mask.querySelector('#bm-status') as HTMLElement;
  const exitRow = mask.querySelector('#bm-exit') as HTMLElement;
  const soldField = mask.querySelector('#bm-soldfield') as HTMLElement;
  let curStatus = it?.current_status || '使用中';
  const syncExitRow = () => {
    const exited = curStatus === '已转卖' || curStatus === '已丢弃';
    exitRow.hidden = !exited;
    soldField.hidden = curStatus !== '已转卖';
  };
  const drawStatus = () => {
    statusPick.innerHTML = STATUS_LABELS.map((s) =>
      `<button type="button" class="bz-choice-btn${s === curStatus ? ' is-on' : ''}" data-status="${esc(s)}">${iconSpan(STATUS[statusKeyOf(s)].ic, 'bz-ic--sm')}${esc(s)}</button>`
    ).join('');
    mountIcons(statusPick);
    statusPick.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
      curStatus = (b as HTMLElement).dataset.status as string;
      drawStatus();
    }));
    syncExitRow();
  };
  drawStatus();

  const errEl = mask.querySelector('#bm-err') as HTMLElement;
  const fail = (msg: string) => { errEl.textContent = msg; };
  const saveBtn = mask.querySelector('#bm-save') as HTMLButtonElement;
  // 保存防重入（对齐 favorites：双击/连点不并发双写——ticket 141 通病 4）
  let saving = false;

  mask.addEventListener('mousedown', (e) => { if (e.target === mask) requestCloseBelForm(mask); });
  mask.querySelector('[data-bm-cancel]')?.addEventListener('click', () => requestCloseBelForm(mask));
  saveBtn.addEventListener('click', () => {
    if (saving) return;
    const name = (mask.querySelector('#bm-name') as HTMLInputElement).value.trim();
    const price = parseFloat((mask.querySelector('#bm-price') as HTMLInputElement).value);
    const date = (mask.querySelector('#bm-date') as HTMLInputElement).value;
    if (!name) { fail('请输入物品名称'); return; }
    if (isNaN(price) || price < 0) { fail('请输入有效的价格'); return; }
    if (!date) { fail('请选择购买日期'); return; }
    const category = catInput.value.trim() || curCat;
    if (!category) { fail('请选择或输入分类'); return; }
    // 出离字段（ADR-0089）：转卖售价可选但填了必须合法
    const exited = curStatus === '已转卖' || curStatus === '已丢弃';
    const exitVal = exited ? (mask.querySelector('#bm-exitdate') as HTMLInputElement).value : '';
    const soldRaw = curStatus === '已转卖' ? (mask.querySelector('#bm-soldprice') as HTMLInputElement).value.trim() : '';
    let soldPrice: number | null = null;
    if (soldRaw !== '') {
      const sp = parseFloat(soldRaw);
      if (isNaN(sp) || sp < 0) { fail('请输入有效的售价'); return; }
      soldPrice = Math.round(sp * 100) / 100;
    }
    const desc = (mask.querySelector('#bm-desc') as HTMLTextAreaElement).value.trim();
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    void (async () => {
      try {
        if (it) {
          // 外部 modify 自动刷新会把 M.db 整体换新——保存前按 id 从当前库重取，防旧引用改动静默丢失
          const cur = itemById(it.id);
          if (!cur) {
            notice('该物品已被外部变更删除，本次保存未写入', 'warning');
            unregisterSheetCompanion(mask);
            closeItemMenu();
            mask.remove();
            return;
          }
          const snapshot = { ...cur };
          cur.name = name;
          cur.category = category;
          cur.purchase_price = Math.round(price * 100) / 100;
          cur.purchase_date = date;
          cur.current_status = curStatus;
          cur.description = desc;
          // 出离字段（ADR-0089）：只在出离态写值；退出出离态且旧值存在才清（避免给老记录写冗余 null）
          if (exited) cur.exit_date = exitVal || todayStr();
          else if (cur.exit_date != null) cur.exit_date = null;
          if (curStatus === '已转卖') cur.sold_price = soldPrice;
          else if (cur.sold_price != null) cur.sold_price = null; // 丢弃/在用态无售价语义
          cur.last_updated = new Date().toISOString();
          await saveAndRender();
          emitDomainEvent('belongings', { kind: 'edit', title: name, changes: belongingsEditChanges(snapshot, cur) });
          notice(`物品「${name}」已更新`, 'success');
        } else {
          if (!M.db) throw new Error('数据库未加载');
          const newItem: BelongingsItem = {
            id: 'item_' + Date.now(),
            name,
            category,
            purchase_price: Math.round(price * 100) / 100,
            purchase_date: date,
            current_status: curStatus,
            description: desc,
            created_date: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            ...(exited ? { exit_date: exitVal || todayStr() } : {}),
            ...(curStatus === '已转卖' ? { sold_price: soldPrice } : {}),
          };
          M.db.items[newItem.id] = newItem; // 用当前库（外部 modify 换新后旧 db 引用会丢写）
          await saveAndRender();
          emitDomainEvent('belongings', { kind: 'add', item: newItem });
          notice(`物品「${name}」已添加`, 'success');
        }
        _belBaseline = null;
        unregisterSheetCompanion(mask);
        closeItemMenu();
        mask.remove();
      } catch (e: any) {
        notice(`保存失败：${e?.message || '未知错误'}`, 'error');
        saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = it ? '更新' : '保存';
      }
    })();
  });
  setTimeout(() => (mask.querySelector('#bm-name') as HTMLInputElement)?.focus(), 100);
}
// ==================== 移动搜索切换 ====================

function toggleMobSearch(overlay: HTMLElement): void {
  const row = overlay.querySelector('[data-bel-mobsearch-row]') as HTMLElement;
  const on = !row.classList.contains(MOB_SHOW);
  row.classList.toggle(MOB_SHOW, on);
  if (on) {
    const inp = overlay.querySelector('[data-bel-mobsearch-inp]') as HTMLInputElement | null;
    setTimeout(() => inp?.focus(), 60);
  }
}
