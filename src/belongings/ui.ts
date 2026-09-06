/**
 * 归物本 UI（issue 221：P20「瑞士大字报」整体换血，对照拍板原型 p20-full.html 重写）
 *
 * 桌面：无壳头行（issue 219b/c 收藏本完全原型化范式）：海报 hero 即头，点遮罩/Esc 关闭，⚙ 收敛设置面板 →
 *   海报主区——
 *   特大字标题（= 筛选名，issue 208 头行标题语义）+ 字距标语 + KPI 行
 *   （在库件数强调/在库投入/日均成本/已离场·回收）→ 筛选 chips（全部/资产/四态带计数，
 *   再点回全部，issue 208 范式）→ 工具行（搜索 + 年份 + 排序三档 segmented + 记一笔）→
 *   大字网格（3 列纸面卡：NO.XX 编号 + 状态徽章 + 特大 emoji + 名称 + 大字价格 + meta；
 *   hover 整卡反色；离场卡灰化；末行空位补纸面 filler 防露格线）→ 脚注（共 N · 显示 M · 回本冲抵）。
 *   点卡片 = 详情弹窗（字段全览 + 四态流转条 + 编辑/删除）；操作菜单仍走右键（issue 202）。
 * 移动 ≤768：真全屏；窄头行 ＋记一笔 → 🔍搜索(展开) → ✕（移动专属）；chips 横滑（bz-mobstrip）；
 *   hero 压缩 2×2；网格单列；点卡弹底部抽屉（core/item-actions）。全 icon lucide（分类 emoji 属数据保留）。
 *
 * 计算口径不变（ADR-0089）：总资产/在库投入 = 在用+闲置原价合计；日均成本 =（总购入 - 转卖回本 Σ售价）/
 *   累计持有天数；单件日均 = 价格/已用天数（0 天 = 全价）；出离条目天数封口 exit_date。
 * 排序三档为纯视图增强：最近购入（默认）/投入最高/日均最高。
 *
 * 契约保留：belongings.json 零迁移；smartcat 事件（add/edit/status/delete + belongingsEditChanges）；
 *   belongingsDefaultStatus / belongingsMobileDefaultFullscreen 设置键；命令路径 openForm（面板未开可弹）；
 *   自动刷新（数据文件 modify，自写短路）；主题变化重渲染；ESC 分层（详情→表单→主面板）；
 *   脏表单 confirmDiscard；notifyUndo 撤销；topifyZ 动态发号（ADR-0067）。
 * 视觉换血按 ADR-0097 判例：.bz-bel--poster 域内 token 作用域覆盖 + .bz-bel-* 装饰类，
 *   按钮/输入/chip/segmented/空态/菜单/抽屉基线继续消费组件库（ADR-0094），不新造共享件。
 */
import { notice, notifyUndo } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { escapeHtml } from '../core/utils';
import { mountIcons, uiEmpty, uiChip, uiSegmented, uiSuggest } from '../core/ui';
import { openItemMenu, openItemSheet, refreshItemSheet, registerSheetCompanion, unregisterSheetCompanion, closeItemMenu, type ItemAction, resetItemMenuClickGuard } from '../core/item-actions';
import { emitDomainEvent } from '../core/domain-bus';
import { belongingsEditChanges } from '../smartcat/belongings-source';
import type { SettingsSchema } from '../core/settings-schema';
import { loadDatabase, saveDatabase, calculateDaysUsedUntil, getDataFilePath } from './data';
import { DEFAULT_CATEGORIES } from './default-categories.gen';
import type { BelongingsDatabase, BelongingsItem } from './types';

/** 状态（数据四态精确串；key = 稳定英文标识） */
const STATUS: Record<string, { label: string; key: string; ic: string }> = {
  using: { label: '使用中', key: 'using', ic: 'check' },
  idle: { label: '闲置', key: 'idle', ic: 'package' },
  sold: { label: '已转卖', key: 'sold', ic: 'banknote' },
  discard: { label: '已丢弃', key: 'discard', ic: 'archive' },
};
const STATUS_LABELS = ['使用中', '闲置', '已转卖', '已丢弃'];
const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'using', label: '使用中' },
  { key: 'idle', label: '闲置' },
  { key: 'sold', label: '已转卖' },
  { key: 'discard', label: '已丢弃' },
];

const THEME_CLASSES = new Set(['theme-dark', 'theme-light']);

const ICON = {
  add: 'plus',
  search: 'search',
  close: 'x',
  del: 'trash-2',
  empty: 'package',
  chevR: 'chevron-right',
};

// ==================== 模块状态 ====================

interface BelState {
  overlay: HTMLElement | null;
  db: BelongingsDatabase | null;
  /** 状态筛选 key（null = 全部；asset = 在库合成） */
  status: string | null;
  /** 年份筛选（'' = 全部） */
  year: string;
  q: string;
  /** 排序档（recent 最近购入 / price 投入最高 / daily 日均最高） */
  sort: 'recent' | 'price' | 'daily';
  renderFn: (() => void) | null;
}

const M: BelState = {
  overlay: null,
  db: null,
  status: null,
  year: '',
  q: '',
  sort: 'recent',
  renderFn: null,
};

export function resetBelongingsState(): void {
  M.overlay = null;
  M.db = null;
  M.status = null;
  M.year = '';
  M.q = '';
  M.sort = 'recent';
  M.renderFn = null;
}

// ==================== 设置 schema ====================

/** 默认状态筛选合法值（与 chips 同源；空串=全部） */
const DEFAULT_STATUS_VALUES = ['', 'using', 'idle', 'sold', 'discard'];

export function belongingSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '默认状态筛选',
            desc: '打开面板时选中的物品状态',
            binding: { key: 'belongingsDefaultStatus' },
            options: [
              { value: '', label: '全部' },
              { value: 'using', label: '使用中' },
              { value: 'idle', label: '闲置' },
              { value: 'sold', label: '已转卖' },
              { value: 'discard', label: '已丢弃' },
            ],
          },
        ],
      },
      mobileFullscreenGroup('belongingsMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}

// ==================== 小工具 ====================

function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
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
/** 在库 = 使用中 + 闲置 */
function inStock(it: BelongingsItem): boolean {
  return it.current_status === '使用中' || it.current_status === '闲置';
}
/** 在库投入 = 在用 + 闲置原价合计 */
function totalAssets(): number {
  return itemList().filter(inStock).reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
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
function statusCount(label: string): number {
  return itemList().filter((i) => i.current_status === label).length;
}
function stockCount(): number {
  return itemList().filter(inStock).length;
}
function filtered(): BelongingsItem[] {
  return itemList()
    .filter((i) => {
      if (!M.status) return true;
      // ticket 189：资产（在库）合成筛选（使用中+闲置）
      if (M.status === 'asset') return inStock(i);
      return i.current_status === statusOf(M.status).label;
    })
    .filter((i) => (M.year ? String(i.purchase_date || '').startsWith(M.year) : true))
    .filter((i) => {
      if (!M.q) return true;
      const q = M.q.toLowerCase();
      return [i.name, i.category, i.description].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (M.sort === 'price') return (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0);
      if (M.sort === 'daily') return dailyCostOf(b) - dailyCostOf(a);
      return String(b.purchase_date || '').localeCompare(String(a.purchase_date || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
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
  return `<div class="bz-bel-panel bz-panel-frame bz-panel-mtop bz-bel--poster">
  <div class="bz-bel-mobhead">
    <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-bel-mob-only" data-bel-close title="关闭">${iconSpan(ICON.close)}</button>
  </div>
  <div class="bz-bel-body">
    <div class="bz-bel-hero">
      <div class="bz-bel-hero-text">
        <div class="bz-bel-hero-title" data-bel-herotitle>全部</div>
        <div class="bz-bel-hero-sub" data-bel-herosub>BELONGINGS — NOTHING MORE, NOTHING LESS</div>
      </div>
      <div class="bz-bel-kpis" data-bel-kpis></div>
    </div>
    <div class="bz-bel-chips" data-bel-chips></div>
    <div class="bz-toolrow bz-bel-toolrow">
      <div class="bz-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-bel-search placeholder="搜索名称 / 分类…"></div>
      <div class="bz-bel-yearsel">
        <select class="bz-bel-select" data-bel-year></select>
        ${iconSpan(ICON.chevR, 'bz-bel-select-chev')}
      </div>
      <div class="bz-bel-sort" data-bel-sort></div>
      <button class="bz-btn bz-btn--md bz-bel-addbtn" data-bel-add>${iconSpan(ICON.add, 'bz-ic--sm')} 记一笔</button>
    </div>
    <div class="bz-mobstrip" data-bel-mobstatus></div>
    <div class="bz-bel-mobsort" data-bel-mobsort></div>
    <div class="bz-bel-content" data-bel-content></div>
    <button class="bz-btn bz-btn--md bz-bel-mobadd" data-bel-add>${iconSpan(ICON.add, 'bz-ic--sm')} 记一笔</button>
    <div class="bz-bel-foot">
      <span class="bz-bel-foot-brand">BZ·BELONGINGS — P20 SWISS POSTER</span>
      <span class="bz-bel-footnote" data-bel-footnote></span>
    </div>
  </div>
</div>`;
}

// ==================== 主面板生命周期 ====================

/** ESC 层（bz-bel）：详情 || 表单 || 主面板——顶层先关，不穿透（对照 favorites bz-fav） */
let mainEscRegistered = false;
function ensureBelongingsEsc(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-bel', {
    isVisible: () => !!M.overlay || !!document.querySelector('.bz-bel-form-mask') || !!document.querySelector('.bz-bel-detail-mask'),
    close: () => {
      const detail = document.querySelector('.bz-bel-detail-mask') as HTMLElement | null;
      if (detail) {
        closeBelDetail();
        return;
      }
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
  // 默认状态筛选接线（issue 194）：每次打开读设置，非法值回全部（设置是「下次打开的初始值」，
  // 面板内改选为会话内临时态，同收藏本 openPanel 语义）
  const st = (tryGetSettings() as Record<string, unknown>).belongingsDefaultStatus;
  M.status = typeof st === 'string' && DEFAULT_STATUS_VALUES.includes(st) && st !== '' ? st : null;
  M.db = await loadDatabase();
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
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

  // ESC（主面板 + 表单/详情多窗口径；表单也可能先于面板打开——命令路径）
  ensureBelongingsEsc();

  // ---- 排序 segmented（组件库 uiSegmented；桌面/移动双实例同步，视图档不落盘） ----
  const sortSegs: ReturnType<typeof uiSegmented<'recent' | 'price' | 'daily'>>[] = [];
  (['[data-bel-sort]', '[data-bel-mobsort]'] as const).forEach((sel) => {
    const host = overlay.querySelector(sel) as HTMLElement;
    const seg = uiSegmented<'recent' | 'price' | 'daily'>({
      options: [
        { value: 'recent', label: '最近购入' },
        { value: 'price', label: '投入最高' },
        { value: 'daily', label: '日均最高' },
      ],
      value: M.sort,
      onChange: (v) => {
        M.sort = v;
        sortSegs.forEach((s) => s.setValue(v));
        renderContent();
      },
    });
    host.replaceChildren(seg.el);
    sortSegs.push(seg);
  });

  // ---- 事件委托 ----
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePanel(); return; }
    if (t.closest('[data-bel-add]')) { void openForm(null); return; }
    if (t.closest('[data-bel-close]')) { closePanel(); return; }
    // KPI 可点（ticket 189 语义保留）：在库件数/在库投入 = 在库合成筛选（再点取消）
    const kpi = t.closest('[data-bel-statclick]') as HTMLElement | null;
    if (kpi) {
      const kind = kpi.dataset.belStatclick;
      if (kind === 'asset') M.status = M.status === 'asset' ? null : 'asset';
      renderAll();
      return;
    }
  });
  // 状态 chips：uiChip 工厂自带 onClick（renderChips 内接线）；
  // 移动横滑 chips 走事件委托（data-bel-st 语义同 chips）
  overlay.querySelectorAll('[data-bel-mobstatus]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-bel-st]') as HTMLElement | null;
      if (!b) return;
      applyStatusFilter(b.dataset.belSt as string);
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
        renderKpis();
        renderContent();
      }, 180);
    });
  };
  bindSearch(overlay.querySelector('[data-bel-search]') as HTMLInputElement);

  // 内容区：卡片点击（桌面=详情弹窗；移动=底部抽屉）+ 右键菜单
  const content = overlay.querySelector('[data-bel-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-bel-id]') as HTMLElement | null;
    if (!cell) return;
    e.stopPropagation();
    const it = itemById(cell.dataset.belId as string);
    if (!it) return;
    // 桌面点卡 = 详情弹窗（P20）；移动点卡 = 底部详情抽屉（issue 202：动作菜单只走右键/抽屉）
    if (isMobileEnv()) openMobSheet(it);
    else openBelDetail(it);
  });
  content.addEventListener('contextmenu', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-bel-id]') as HTMLElement | null;
    if (!cell || isMobileEnv()) return;
    e.preventDefault();
    const it = itemById(cell.dataset.belId as string);
    if (it) openRowMenuAt(it, e.clientX, e.clientY);
  });

  renderAll();
  startAutoRefresh();
  observeTheme();
}

export function closePanel(): void {
  stopAutoRefresh();
  closeBelDetail();
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  M.renderFn = null;
}

export function cleanupBelongings(): void {
  stopAutoRefresh();
  closeBelDetail();
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
  renderHero();
  renderChips();
  renderYears();
  renderKpis();
  renderContent();
}

/** 状态筛选切换语义（chips onClick 与移动 chips 委托共用）：
 *  再点「全部」= 取消筛选回未筛选；再点当前项 = 取消筛选回全部 */
function applyStatusFilter(k: string): void {
  if (k === '__all') M.status = null;
  else M.status = M.status === k ? null : k;
  renderAll();
}

/** 海报大字标题 = 筛选名（issue 208 头行标题语义） */
function heroTitleText(): string {
  if (!M.status) return '全部';
  if (M.status === 'asset') return '资产';
  return statusOf(M.status).label;
}

function renderHero(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  (overlay.querySelector('[data-bel-herotitle]') as HTMLElement).textContent = heroTitleText();
  const sub = overlay.querySelector('[data-bel-herosub]') as HTMLElement;
  sub.textContent = M.status
    ? `归物本 — ${filtered().length} 件在列 · FILTERED VIEW`
    : '归物本 — BELONGINGS · NOTHING MORE, NOTHING LESS';
}

function renderChips(): void {
  const overlay = M.overlay!;
  const host = overlay.querySelector('[data-bel-chips]') as HTMLElement;
  const defs: { key: string; label: string; cnt: number }[] = [
    { key: '__all', label: '全部', cnt: itemList().length },
    { key: 'asset', label: '资产', cnt: stockCount() },
    ...STATUS_ORDER.map((s) => ({ key: s.key, label: s.label, cnt: statusCount(s.label) })),
  ];
  host.replaceChildren(...defs.map((d) => {
    const active = d.key === '__all' ? M.status === null : M.status === d.key;
    const c = uiChip({ label: d.label, count: d.cnt, selected: active, onClick: () => applyStatusFilter(d.key) });
    c.dataset.belSt = d.key;
    return c;
  }));
  // 移动横滑 chips（.bz-mobstrip；p20 m-chips：纯文字+计数，无图标）
  const mob = overlay.querySelector('[data-bel-mobstatus]') as HTMLElement;
  const mkChip = (key: string, label: string, cnt: number, active: boolean) =>
    `<button class="bz-mobstrip-chip${active ? ' is-on' : ''}" data-bel-st="${key}"><span>${esc(label)}</span><span class="bz-chip-cnt">${cnt}</span></button>`;
  mob.innerHTML =
    mkChip('__all', '全部', itemList().length, M.status === null) +
    mkChip('asset', '资产', stockCount(), M.status === 'asset') +
    STATUS_ORDER.map((s) => mkChip(s.key, s.label, statusCount(s.label), M.status === s.key)).join('');
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

function renderKpis(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const wrap = overlay.querySelector('[data-bel-kpis]') as HTMLElement;
  const gone = itemList().filter(isExited);
  const recover = gone.reduce((s, i) => s + (Number(i.sold_price) || 0), 0);
  // ticket 189：在库两卡可点（合成筛选，再点取消）；口径不动只加视图联动。
  const kpi = (num: string, label: string, opts: { hero?: boolean; click?: boolean } = {}) =>
    `<div class="bz-bel-kpi${opts.hero ? ' bz-bel-kpi--hero' : ''}${opts.click ? ' bz-bel-kpi--click' : ''}"${opts.click ? ' data-bel-statclick="asset" title="只看在库（使用中与闲置）"' : ''}><b>${num}</b><span>${esc(label)}</span></div>`;
  wrap.innerHTML =
    kpi(String(stockCount()), '在库件数', { hero: true, click: true }) +
    kpi(moneyShort(totalAssets()), '在库投入', { click: true }) +
    kpi('￥' + avgDailyCost().toFixed(2), '日均成本') +
    kpi(`${gone.length} 件 · ${moneyShort(recover)}`, '已离场 · 回收');
}

function renderContent(): void {
  const overlay = M.overlay;
  if (!overlay) return;
  const content = overlay.querySelector('[data-bel-content]') as HTMLElement;
  const list = filtered();
  if (!list.length) {
    // 空态文案区分：库空（这里还没有物品）vs 筛选/搜索无匹配（没有符合条件的物品）
    const noMatch = !!M.q || M.status !== null || M.year !== '';
    content.replaceChildren(uiEmpty({
      icon: ICON.empty,
      title: noMatch ? '没有符合条件的物品' : '这里还没有物品',
      desc: noMatch ? '换个筛选条件，或清除搜索' : '点「记一笔」登记第一个物品',
    }));
    (overlay.querySelector('[data-bel-footnote]') as HTMLElement).textContent = '';
    return;
  }
  // 末行空位补纸面 filler（P20：黑缝线只出现在卡与卡之间，空区保持纸面）。
  // 列数在网格入 DOM 后量（jsdom 无布局 → 空串回退单列，rem 恒 0 不补）
  const gridEl = document.createElement('div');
  gridEl.className = 'bz-bel-grid';
  gridEl.dataset.belGrid = '';
  gridEl.innerHTML = list.map((it, idx) => cellHtml(it, idx)).join('');
  content.replaceChildren(gridEl);
  const cols = ((getComputedStyle(gridEl).gridTemplateColumns as string) || '').split(' ').filter(Boolean).length || 1;
  const rem = list.length % cols;
  if (rem) gridEl.insertAdjacentHTML('beforeend', `<div class="bz-bel-filler" style="grid-column:span ${cols - rem}"></div>`);
  mountIcons(content);
  const fn = overlay.querySelector('[data-bel-footnote]') as HTMLElement;
  fn.textContent = `共 ${itemList().length} 件 · 显示 ${list.length} 件 · 回本冲抵 ${moneyShort(itemList().reduce((s, i) => s + (Number(i.sold_price) || 0), 0))}`;
}

/** 网格卡（P20 大字报）：NO.XX 编号 + 状态徽章 + 特大 emoji + 名称 + 大字价格 + meta */
function cellHtml(it: BelongingsItem, idx: number): string {
  const gone = isExited(it);
  const idle = it.current_status === '闲置';
  const days = daysUsed(it);
  const daily = dailyCostOf(it);
  const key = statusKeyOf(it.current_status);
  // 出离尾注（ADR-0089）：封口日期 + 转卖售价
  const exitNote = gone
    ? `${it.exit_date ? ' → ' + esc(String(it.exit_date).slice(0, 10)) : ''}${it.current_status === '已转卖' && Number(it.sold_price) > 0 ? ' · 售出 ' + moneyShort(Number(it.sold_price)) : ''}`
    : '';
  const dailyStr = daily < 0.01 ? daily.toFixed(4) : daily.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const mut = gone
    ? `${esc(String(it.purchase_date || '').slice(0, 10) || '日期未知')} 起 · 陪伴 ${days || '—'} 天${exitNote}`
    : `${esc(String(it.purchase_date || '').slice(0, 10) || '日期未知')} 起 · ${days || '—'} 天 · 日均 ￥${dailyStr}`;
  return `<div class="bz-bel-cell${gone ? ' bz-bel-cell--gone' : ''}${idle ? ' bz-bel-cell--idle' : ''}" data-bel-id="${esc(it.id)}">
    <span class="bz-bel-cell-idx">NO.${String(idx + 1).padStart(2, '0')} — ${esc(catNameOf(it.category) || '未分类')}</span>
    <span class="bz-bel-tag bz-bel-tag--${key}">${iconSpan(STATUS[key]?.ic || 'box', 'bz-ic--sm')}${esc(it.current_status)}</span>
    <span class="bz-bel-cell-em">${esc(catEmoji(it.category))}</span>
    <span class="bz-bel-name">${esc(it.name)}</span>
    <span class="bz-bel-price">${moneyShort(Number(it.purchase_price) || 0)}</span>
    <span class="bz-bel-mut">${mut}</span>
  </div>`;
}

// ==================== 详情弹窗（P20 桌面点卡） ====================

function closeBelDetail(): void {
  document.querySelector('.bz-bel-detail-mask')?.remove();
}

function openBelDetail(it: BelongingsItem): void {
  closeBelDetail();
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-bel-detail-mask';
  const gone = isExited(it);
  mask.innerHTML = `<div class="bz-bel-detail">
    <div class="bz-bel-detail-head">
      <div class="bz-bel-detail-title">${esc(it.name)}</div>
      <button class="bz-icon-btn" data-bd-close title="关闭">${iconSpan(ICON.close)}</button>
    </div>
    <div class="bz-bel-detail-idrow">
      <span class="bz-bel-cell-em">${esc(catEmoji(it.category))}</span>
      <div class="bz-bel-detail-idinfo">
        <div class="bz-bel-detail-cat">${esc(it.category || '未分类')}</div>
        <div class="bz-bel-detail-desc">${esc(it.description || '无备注')}</div>
      </div>
      <span class="bz-bel-tag bz-bel-tag--${statusKeyOf(it.current_status)}">${iconSpan(STATUS[statusKeyOf(it.current_status)]?.ic || 'box', 'bz-ic--sm')}${esc(it.current_status)}</span>
    </div>
    <div class="bz-bel-detail-fields">
      <div class="bz-bel-dfield"><span>购买价</span><b>${money(Number(it.purchase_price) || 0)}</b></div>
      <div class="bz-bel-dfield"><span>购买日期</span><b>${esc(String(it.purchase_date || '').slice(0, 10) || '—')} · ${daysUsed(it)} 天</b></div>
      <div class="bz-bel-dfield"><span>日均成本</span><b>￥${dailyCostOf(it).toFixed(2)}${gone ? '（已封口）' : '/天 · 越用越便宜'}</b></div>
      ${gone ? `<div class="bz-bel-dfield"><span>出离日期</span><b>${esc(it.exit_date || '—')}${it.current_status === '已转卖' && Number(it.sold_price) > 0 ? ' · 售出 ' + money(Number(it.sold_price)) : ''}</b></div>` : ''}
      <div class="bz-bel-dfield"><span>录入 / 更新</span><b>${esc(String(it.created_date || '').slice(0, 10))} / ${esc(String(it.last_updated || '').slice(0, 10))}</b></div>
    </div>
    <div class="bz-bel-detail-acts" data-bd-acts></div>
    <div class="bz-btn-row bz-bel-detail-btns">
      <div class="bz-bel-form-spacer"></div>
      <button type="button" class="bz-btn bz-btn--ghost" data-bd-edit>${iconSpan('pencil', 'bz-ic--sm')} 编辑</button>
      <button type="button" class="bz-btn bz-btn--primary bz-bel-delbtn" data-bd-del>${iconSpan(ICON.del, 'bz-ic--sm')} 删除</button>
    </div>
  </div>`;
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（详情恒压主面板；表单再开时后发号恒压详情）
  mountIcons(mask);
  ensureBelongingsEsc(); // 详情可在面板未开时被带起（命令路径保险）

  // 四态流转条（当前态高亮；点击 = 同右键菜单流转，带撤销）
  const acts = mask.querySelector('[data-bd-acts]') as HTMLElement;
  const drawActs = () => {
    const cur = itemById(it.id);
    if (!cur) return;
    acts.innerHTML = STATUS_LABELS.map((s) =>
      `<button type="button" class="bz-bel-flowbtn${s === cur.current_status ? ' is-cur' : ''}${s === '闲置' ? ' bz-bel-c2' : ''}" data-bd-flow="${esc(s)}">${esc(s)}</button>`
    ).join('');
  };
  drawActs();
  acts.addEventListener('click', (e) => {    const b = (e.target as HTMLElement).closest('[data-bd-flow]') as HTMLElement | null;
    if (!b) return;
    const cur = itemById(it.id);
    if (!cur) { closeBelDetail(); return; }
    void (async () => {
      await applyFlowWithUndo(cur, b.dataset.bdFlow as string);
      const now = itemById(it.id);
      if (!now) { closeBelDetail(); return; }
      drawActs();
      // 详情头行字段同步（状态徽章/出离行随流转刷新）
      openBelDetail(itemById(it.id)!);
    })();
  });
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) closeBelDetail(); });
  mask.querySelector('[data-bd-close]')?.addEventListener('click', closeBelDetail);
  mask.querySelector('[data-bd-edit]')?.addEventListener('click', () => {
    const cur = itemById(it.id);
    if (cur) openForm(cur);
  });
  mask.querySelector('[data-bd-del]')?.addEventListener('click', () => {
    const cur = itemById(it.id);
    if (cur) void deleteItem(cur);
  });
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

/** 状态流转核心（右键菜单 / 详情流转条共用）：落盘 + status 事件 + notifyUndo（回写旧状态 + 清出离日期）
 *  ticket 189：转卖/丢弃落 exit_date（ADR-0089） */
async function applyFlowWithUndo(it: BelongingsItem, s: string): Promise<void> {
  // 外部 modify 自动刷新会把 M.db 整体换新——按 id 从当前库重取再改，防旧引用改动静默丢失
  const cur = itemById(it.id);
  if (!cur) {
    notice('该物品已被外部变更删除，列表已刷新', 'warning');
    M.renderFn?.();
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
}

/** 行操作（旧动作契约：四态流转 keepOpen → 编辑 keepOpen → 删除 danger） */
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
          await applyFlowWithUndo(it, s);
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

function openRowMenuAt(it: BelongingsItem, x: number, y: number): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadOf(it2));
  };
  openItemMenu(x, y, buildActions(it, rebuild), true, 'bz-bel-menu');
  // 复位残余 click 抑制（issue 198 同款 P1）：右键时序会置位 armed 吞下一次左键；右键无补发 click，直接复位
  resetItemMenuClickGuard();
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
  closeBelDetail(); // 详情内删除：详情随之关闭
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

// 分类搜索联想（issue 203：收敛为组件库 uiSuggest——聚焦/输入惰性弹出、外点收起、
// Esc 只收下拉；候选 = DEFAULT_CATEGORIES 全库子串过滤，上限 60，emoji 前缀 + 去缀名）

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
  const catVal = it?.category ?? ''; // 新记不回填默认分类（issue 202），留空待选
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
      <div class="bz-field"><span class="bz-field-label">分类</span><input class="bz-input" id="bm-cat" value="${esc(catVal)}" placeholder="输入或选择分类" autocomplete="off"></div>
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

  // 分类搜索联想（组件库 uiSuggest，issue 203）
  const catInput = mask.querySelector('#bm-cat') as HTMLInputElement;
  let curCat = catVal;
  uiSuggest({
    anchor: catInput,
    source: () => DEFAULT_CATEGORIES,
    max: 60,
    iconOf: catEmoji,
    labelOf: catNameOf,
  });
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
      `<button type="button" class="bz-choice-btn${s === curStatus ? ' is-on' : ''}${s === '闲置' ? ' bz-bel-c2' : ''}" data-status="${esc(s)}">${iconSpan(STATUS[statusKeyOf(s)].ic, 'bz-ic--sm')}${esc(s)}</button>`
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
