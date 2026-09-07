/**
 * 归物本 UI（issue 237/ADR-0104 起 markup 单源：面板/网格/详情/表单的 HTML 全部出自
 * ./render.ts（渲染纯层，评审壳 prototype.html 经 prototype-render.js 消费同一份）——
 * 本文件只保留行为层：生命周期、事件绑定、core 服务接线、数据读写。
 *
 * 桌面：无壳头行（issue 219b/c 收藏本完全原型化范式）：海报 hero 即头，点遮罩/Esc 关闭，⚙ 收敛设置面板 →
 *   海报主区——特大字标题（= 筛选名，issue 208 头行标题语义）+ 字距标语 + KPI 行
 *   （在库件数强调/在库投入/日均成本/已离场·回收）→ 筛选 chips（全部/资产/四态带计数，
 *   再点回全部，issue 208 范式）→ 工具行（搜索 + 年份 + 排序三档 segmented + 记一笔）→
 *   大字网格（3 列纸面卡：NO.XX 编号 + 状态徽章 + 特大 emoji + 名称 + 大字价格 + meta；
 *   hover 整卡反色；离场卡灰化；末行空位补纸面 filler 防露格线）。
 *   点卡片 = 详情弹窗（字段全览 + 四态流转条 + 编辑/删除）；操作菜单仍走右键（issue 202）。
 * 移动 ≤768：真全屏；窄头行 ＋记一笔 → 🔍搜索(展开) → ✕（移动专属）；chips 横滑（bz-mobstrip）；
 *   hero 压缩 2×2；网格单列；点卡弹底部抽屉（core/item-actions）。全 icon lucide；数据 emoji 走
 *   emoji-icon-map 全量映射（issue 231 拍板全转），未入表 emoji 原样兜底。
 *
 * 契约保留：belongings.json 零迁移；smartcat 事件（add/edit/status/delete + belongingsEditChanges）；
 *   belongingsDefaultStatus / belongingsMobileDefaultFullscreen 设置键；命令路径 openForm（面板未开可弹）；
 *   自动刷新（数据文件 modify，自写短路）；主题变化重渲染；ESC 分层（详情→表单→主面板）；
 *   脏表单 confirmDiscard；notifyUndo 撤销；topifyZ 动态发号（ADR-0067）。
 * 视觉换血按 ADR-0097 判例：.bz-bel--poster 域内 token 作用域覆盖 + .bz-bel-* 装饰类，
 *   chips/segmented/空态在 render.ts 串里沿用组件库皮（bz-chip/bz-segmented/bz-empty，ADR-0094 视觉）。
 */
import { notice, notifyUndo, notifySaveError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { mountIcons, uiSuggest, uiIconSpan } from '../core/ui';
import { openItemMenu, openItemSheet, refreshItemSheet, registerSheetCompanion, unregisterSheetCompanion, closeItemMenu, type ItemAction, resetItemMenuClickGuard } from '../core/item-actions';
import { emitDomainEvent } from '../core/domain-bus';
import { belongingsEditChanges } from '../smartcat/belongings-source';
import type { SettingsSchema } from '../core/settings-schema';
import { loadDatabase, saveDatabase, getDataFilePath } from './data';
import {
  renderPanelView, panelHtml,
  belDetailHtml, flowBtnsHtml, belFormHtml, belFormInit, statusPickHtml, sheetHeadHtml,
  actionSpecs, todayStr, isExited, exitedStatus,
} from './render';
import type { BelongingsDatabase, BelongingsItem } from './types';
import { aiSuggestCategory } from './ai';

const THEME_CLASSES = new Set(['theme-dark', 'theme-light']);

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

/** 自绘下拉的 document 外点收起监听（openPanel 挂，closePanel 摘） */
let dropDocClick: ((e: MouseEvent) => void) | null = null;

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

// ==================== 数据存取 ====================

function itemList(): BelongingsItem[] {
  return M.db ? Object.values(M.db.items) : [];
}
function itemById(id: string): BelongingsItem | undefined {
  return M.db?.items[id];
}

// ==================== 主面板生命周期 ====================

/** ESC 层（bz-bel）：表单 || 详情 || 主面板——顶层先关，不穿透（对照 favorites bz-fav；
 *  表单叠详情时（详情点编辑）先关表单，修 B6 层序倒挂） */
let mainEscRegistered = false;
function ensureBelongingsEsc(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-bel', {
    isVisible: () => !!M.overlay || !!document.querySelector('.bz-bel-form-mask') || !!document.querySelector('.bz-bel-detail-mask'),
    close: () => {
      const form = document.querySelector('.bz-bel-form-mask') as HTMLElement | null;
      if (form) {
        // 脏表单走 confirmDiscard 拦截（ticket 189，对照 favorites）
        requestCloseBelForm(form);
        return;
      }
      const detail = document.querySelector('.bz-bel-detail-mask') as HTMLElement | null;
      if (detail) {
        closeBelDetail();
        return;
      }
      closePanel();
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

  // ---- 年份/移动排序下拉（自绘海报菜单，原生 select 弹层退役；与桌面 seg 双向同步） ----
  // 触发器开合 + 选项点选 + 外点收起，一处 document 委托；closePanel 时摘除
  const closeDrops = () => {
    overlay.querySelectorAll('.bz-bel-yearsel.is-open').forEach((w) => w.classList.remove('is-open'));
  };
  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const trig = t.closest('[data-bel-year],[data-bel-mobsortsel]') as HTMLElement | null;
    if (trig) {
      const wrap = trig.parentElement as HTMLElement;
      const wasOpen = wrap.classList.contains('is-open');
      closeDrops();
      if (!wasOpen) wrap.classList.add('is-open');
      return;
    }
    const opt = t.closest('.bz-bel-dropopt') as HTMLElement | null;
    if (opt) {
      closeDrops();
      const v = opt.dataset.v ?? '';
      if (opt.closest('[data-bel-yearmenu]')) M.year = v;
      else M.sort = v as BelState['sort'];
      renderAll();
      return;
    }
    closeDrops();
  };
  const onDropKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.closest('.bz-bel-select')) {
      e.preventDefault();
      (t as HTMLElement).click();
    }
  };
  document.addEventListener('click', onDocClick);
  overlay.addEventListener('keydown', onDropKey);
  dropDocClick = onDocClick;

  // ---- 事件委托（chips/排序/KPI 一处接管；桌面与移动横滑条共用 data-bel-st 钩子） ----
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePanel(); return; }
    if (t.closest('[data-bel-add]')) { void openForm(null); return; }
    if (t.closest('[data-bel-close]')) { closePanel(); return; }
    // 状态 chips：再点「全部」= 取消筛选回未筛选；再点当前项 = 取消筛选回全部
    const chip = t.closest('[data-bel-st]') as HTMLElement | null;
    if (chip) { applyStatusFilter(chip.dataset.belSt as string); return; }
    // 排序三档 segmented（桌面；移动走上方下拉 change）
    const segBtn = t.closest('.bz-segmented-btn') as HTMLElement | null;
    if (segBtn) {
      M.sort = segBtn.dataset.k as BelState['sort'];
      renderAll();
      return;
    }
    // KPI 可点（ticket 189 语义保留）：在库件数/在库投入 = 在库合成筛选（再点取消）
    const kpi = t.closest('[data-bel-statclick]') as HTMLElement | null;
    if (kpi) {
      const kind = kpi.dataset.belStatclick;
      if (kind === 'asset') M.status = M.status === 'asset' ? null : 'asset';
      renderAll();
      return;
    }
  });
  // 搜索（B3：防抖定时器在面板关闭后仍会触发——首行守卫 overlay 存活；渲染序列含 hero，
  // 副题「N 件在列」计数随搜索刷新）
  const bindSearch = (inp: HTMLInputElement) => {
    inp.addEventListener('input', () => {
      clearTimeout((inp as any)._belDeb);
      (inp as any)._belDeb = setTimeout(() => {
        if (!M.overlay) return;
        M.q = inp.value.trim();
        renderAll();
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
  if (dropDocClick) { document.removeEventListener('click', dropDocClick); dropDocClick = null; }
  if (M.overlay) {
    M.overlay.remove();
    M.overlay = null;
  }
  M.renderFn = null;
  // 会话态一并清（B1/B3）：面板关后命令/撤销路径若复用陈旧库会把外部改动覆盖写盘；
  // 搜索词残留会让重开面板「空搜索框配过滤后列表」。库按需重载（openForm/撤销回调自补）
  M.db = null;
  M.q = '';
}

export function cleanupBelongings(): void {
  stopAutoRefresh();
  closeBelDetail();
  if (dropDocClick) { document.removeEventListener('click', dropDocClick); dropDocClick = null; }
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

// ==================== 渲染（单源胶水：render.ts renderPanelView 六步全量） ====================

function renderAll(): void {
  if (!M.overlay) return;
  const panel = M.overlay.querySelector('.bz-bel-panel') as HTMLElement | null;
  if (!panel) return;
  // BelState 与 render.BelViewState 结构兼容（status/year/q/sort）；view.year 悬空回写直通 M
  renderPanelView(panel, itemList(), M, { mountIcons });
}

/** 状态筛选切换语义（chips 与移动横滑条委托共用）：
 *  再点「全部」= 取消筛选回未筛选；再点当前项 = 取消筛选回全部 */
function applyStatusFilter(k: string): void {
  if (k === '__all') M.status = null;
  else M.status = M.status === k ? null : k;
  renderAll();
}

// ==================== 详情弹窗（P20 桌面点卡） ====================

function closeBelDetail(): void {
  document.querySelector('.bz-bel-detail-mask')?.remove();
}

function openBelDetail(it: BelongingsItem): void {
  closeBelDetail();
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-bel-detail-mask';
  mask.innerHTML = belDetailHtml(it);
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（详情恒压主面板；表单再开时后发号恒压详情）
  mountIcons(mask);
  ensureBelongingsEsc(); // 详情可在面板未开时被带起（命令路径保险）

  // 四态流转条（当前态高亮；点击 = 同右键菜单流转，带撤销）
  const acts = mask.querySelector('[data-bd-acts]') as HTMLElement;
  const drawActs = () => {
    const cur = itemById(it.id);
    if (!cur) return;
    acts.innerHTML = flowBtnsHtml(cur.current_status);
  };
  drawActs();
  acts.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-bd-flow]') as HTMLElement | null;
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

/** 抽屉头：render.ts 串 → 元素（core/item-actions 契约收 HTMLElement；占位图标在此兑现） */
function sheetHeadEl(it: BelongingsItem): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = sheetHeadHtml(it);
  mountIcons(holder);
  return holder.firstElementChild as HTMLElement;
}

/** 状态流转核心（右键菜单 / 详情流转条共用）：落盘 + status 事件 + notifyUndo（回写旧状态 + 恢复出离日期）
 *  ticket 189：转卖/丢弃落 exit_date（ADR-0089）；B4：已是出离态再流转保留原封口日期 */
async function applyFlowWithUndo(it: BelongingsItem, s: string): Promise<void> {
  // 外部 modify 自动刷新会把 M.db 整体换新——按 id 从当前库重取再改，防旧引用改动静默丢失
  const cur = itemById(it.id);
  if (!cur) {
    notice('该物品已被外部变更删除，列表已刷新', 'warning');
    M.renderFn?.();
    return;
  }
  const prevStatus = cur.current_status;
  const prevExit = cur.exit_date;
  cur.current_status = s;
  // 出离闭环（ADR-0089）：从非出离态转入出离态记当天封口；已是出离态再流转保留原封口日期
  // （与表单编辑路径对齐，修复前转卖→丢弃会把锚点重置成今天）；退出出离态且旧值存在才清（避免写冗余 null）
  if (isExited(cur)) {
    if (!exitedStatus(prevStatus)) cur.exit_date = todayStr();
  } else if (cur.exit_date != null) {
    cur.exit_date = null;
  }
  cur.last_updated = new Date().toISOString();
  // 写盘失败兜底（B5）：内存已改必须从盘回滚——否则后续任意保存会把未落盘的改动补刀持久化
  try {
    await saveAndRender();
  } catch (e) {
    notifySaveError(e, '状态流转');
    M.db = await loadDatabase().catch(() => null);
    M.renderFn?.();
    return; // 失败路径不发领域事件、不弹撤销 toast
  }
  emitDomainEvent('belongings', { kind: 'status', title: cur.name, status: s });
  notifyUndo(`「${cur.name}」已标记为${s}`, () => {
    void (async () => {
      // B1：面板已关（closePanel 清 M.db）后撤销从盘重载，不误报「已被外部变更删除」
      if (!M.db) M.db = await loadDatabase();
      const now = itemById(it.id);
      if (!now) {
        notice('该物品已被外部变更删除，无法撤销', 'warning');
        return;
      }
      now.current_status = prevStatus;
      // B4：恢复流转前封口快照（出离→出离撤销不丢原日期）；无快照且现值非空才清（避免写冗余 null）
      if (prevExit != null) now.exit_date = prevExit;
      else if (now.exit_date != null) now.exit_date = null;
      now.last_updated = new Date().toISOString();
      await saveAndRender();
      notice(`已撤销，「${now.name}」回到${prevStatus}`, 'success');
    })();
  }, { type: 'restore' });
}

/** 行操作（specs → ItemAction：序列/图标/文案单源在 render.actionSpecs，onClick 行为在本侧） */
function buildActions(it: BelongingsItem, rebuild: () => void): ItemAction[] {
  return actionSpecs(it).map((sp) => ({
    icon: sp.icon,
    label: sp.label,
    keepOpen: sp.keepOpen,
    kind: sp.danger ? 'danger' : undefined,
    onClick: () => {
      if (sp.act === 'flow' && sp.status) {
        void (async () => {
          await applyFlowWithUndo(it, sp.status!);
          rebuild();
        })();
        return;
      }
      if (sp.act === 'edit') {
        openForm(it);
        return;
      }
      void deleteItem(it);
    },
  }));
}

function openRowMenuAt(it: BelongingsItem, x: number, y: number): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadEl(it2));
  };
  openItemMenu(x, y, buildActions(it, rebuild), true, 'bz-bel-menu');
  // 复位残余 click 抑制（issue 198 同款 P1）：右键时序会置位 armed 吞下一次左键；右键无补发 click，直接复位
  resetItemMenuClickGuard();
}
function openMobSheet(it: BelongingsItem): void {
  const rebuild = () => {
    const it2 = itemById(it.id);
    if (it2) refreshItemSheet(buildActions(it2, rebuild), sheetHeadEl(it2));
  };
  openItemSheet(buildActions(it, rebuild), { sheetHead: sheetHeadEl(it) });
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
  // 写盘失败兜底（B5）：条目已在内存摘除，须回滚——否则后续任意保存把删除补刀持久化
  try {
    await saveAndRender();
  } catch (e) {
    M.db.items[snapshot.id] = snapshot;
    notifySaveError(e, '删除物品');
    M.db = await loadDatabase().catch(() => null);
    M.renderFn?.();
    return; // 失败路径不发领域事件、不弹撤销 toast
  }
  emitDomainEvent('belongings', { kind: 'delete', title: it.name });
  notifyUndo(`已删除「${it.name}」`, () => {
    void (async () => {
      if (!M.db) M.db = await loadDatabase(); // B1：面板已关后撤销从盘重载
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

// ==================== 表单（记一笔 / 编辑；markup 单源 = render.belFormHtml） ====================

// 表单防丢（ticket 189，对照 favorites）：开表单时的全字段快照，脏表单关前 confirmDiscard

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
  // B8 防叠开：已有表单悬浮时聚焦既有表单直接返回——重复开会让模块级 _belBaseline 互踩、脏拦截失效
  const existing = document.querySelector('.bz-bel-form-mask') as HTMLElement | null;
  if (existing) {
    (existing.querySelector('input, textarea') as HTMLInputElement | null)?.focus();
    return;
  }
  // 命令路径（面板未开）先确保 db 已载（旧 addBelongingsItemCommand 语义）；B7：失败弹提示，不静默
  if (!M.db) {
    void loadDatabase()
      .then((db) => {
        M.db = db;
        openForm(it);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        notice('数据加载失败：' + msg, 'error');
      });
    return;
  }
  const init = belFormInit(it);
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-bel-form-mask';
  mask.innerHTML = belFormHtml(it);
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（原静态 z-index:110000 已删，恒压主面板）
  mountIcons(mask);
  ensureBelongingsEsc(); // 表单可在面板未开时打开（命令路径）——ESC 层在此保证已注册
  // 编辑自抽屉：companion 防误关
  const sheetOpen = !!document.querySelector('.bz-item-sheet-mask');
  if (it && sheetOpen) registerSheetCompanion(mask);

  // 防丢基线（ticket 189）：开表单时的全字段快照（初值口径与 belFormHtml 同源）
  _belBaseline = {
    name: it?.name ?? '',
    cat: init.catVal,
    price: init.priceVal,
    date: init.dateVal,
    status: it?.current_status || '使用中',
    desc: init.descVal,
    exitDate: init.exitDateVal,
    soldPrice: init.soldPriceVal,
  };

  // 分类搜索联想（组件库 uiSuggest，issue 203）+ 表单图标状态（issue 231/ADR-0102）：
  // 候选 = 历史分类；点选历史分类自动带上馆内图标；AI 归类同写 formIcon，随保存入 item.icon
  const catInput = mask.querySelector('#bm-cat') as HTMLInputElement;
  let formIcon: string | null = it?.icon || null;
  const iconChip = mask.querySelector('#bm-icon') as HTMLElement;
  const drawIconChip = () => {
    iconChip.replaceChildren();
    iconChip.hidden = !formIcon;
    if (formIcon) iconChip.appendChild(uiIconSpan(formIcon));
  };
  drawIconChip();
  const historyIconOf = (cat: string): string => (M.db?.categoryIcons?.[cat] as string) || '';
  uiSuggest({
    anchor: catInput,
    source: () => M.db?.categories ?? [],
    max: 60,
    iconOf: (raw: string) => {
      const name = historyIconOf(raw);
      return name ? uiIconSpan(name) : '';
    },
    onPick: (raw: string) => {
      const name = historyIconOf(raw);
      if (name) { formIcon = name; drawIconChip(); }
    },
  });
  // 状态单选（平铺胶囊，markup = render.statusPickHtml）；出离态展开出离记录行（ADR-0089）
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
    statusPick.innerHTML = statusPickHtml(curStatus);
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

  // AI 归类（issue 231/ADR-0102）：按名称建议分类 + 图标；未配置/失败内联降级，不阻塞手填
  const aiBtn = mask.querySelector('#bm-ai') as HTMLButtonElement;
  aiBtn.addEventListener('click', () => {
    if (aiBtn.disabled) return;
    const aiName = (mask.querySelector('#bm-name') as HTMLInputElement).value.trim();
    if (!aiName) { fail('先填物品名称，AI 才能归类'); return; }
    aiBtn.disabled = true;
    aiBtn.classList.add('is-busy');
    void (async () => {
      try {
        const sug = await aiSuggestCategory(aiName, M.db?.categories?.slice(0, 40) ?? []);
        catInput.value = sug.category;
        formIcon = sug.icon;
        drawIconChip();
        errEl.textContent = '';
      } catch (e: any) {
        fail('AI 归类失败：' + (e?.message || '未知错误'));
      } finally {
        aiBtn.disabled = false;
        aiBtn.classList.remove('is-busy');
      }
    })();
  });

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
    const category = catInput.value.trim() || init.catVal;
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
        // B1：面板可能已在表单开启期间被遮罩点击关闭（closePanel 清 M.db）——按需从盘重载，
        // 不然编辑路径按 id 重取落空误报「已被外部变更删除」、新增路径直接「数据库未加载」
        if (!M.db) M.db = await loadDatabase();
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
          cur.icon = formIcon;
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
            ...(formIcon ? { icon: formIcon } : {}),
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
