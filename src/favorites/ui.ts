/**
 * 收藏本 UI（issue 227「C5 终版」1:1 换血，对照拍板原型 c5-linen-full.html / ADR-0101）
 *
 * 视觉（用户拍板豁免铁律 6）：面板内 UI 全部逐字照搬原型——亚麻十字纹底 + 白卡墙（胶带三色循环
 * + 右上磁圆点=首标签色）+ 磁贴标签行（全部/已归档灰/9 类，行尾 lucide plus「新收藏」chip）+
 * 右键 linen 浮层菜单（打开/置顶/编辑/归档⇄取消归档 | 删除）+ 移动底部抽屉（磁点+标题+meta+动作列）
 * + 表单（标题/链接/简介/标签多选/置顶开关 + AI 整理钮）。竖排标签徽记脚注 + 相对时间行。
 * 头行仅「收藏本」16px（无副题）；卡片无 host/图钉/笔记徽记/余额。空态照原型文案。
 * 主题跟随 Obsidian 亮暗（.theme-dark 变量组），不照搬原型手动切换钮。
 *
 * markup 单源（issue 242/ADR-0104/0105）：面板/磁贴/卡片/菜单/抽屉/表单的 innerHTML 全部
 * 出自 ./render（shared.ts + layouts/board/render.ts）——本文件只留行为绑定与 core 服务；
 * renderTagsInto 为纯层磁贴渲染唯一出口（原 renderTags/renderTagsInto 命名债随迁移统一）。
 *
 * 退役（ADR-0101 用户拍板）：大模型/余额整功能（表单区块/刷新余额/余额徽记/BalanceService/
 *   自动查询链）；关联笔记整功能（表单字段/跳转笔记/卡片徽记 + file-sync.ts 整链）；
 *   favoritesTimeFormat 键（固定相对时间：刚刚/N 分钟前/N 小时前/N 天前，超 7 天回落 M-D）。
 *
 * 跨域服务保留（不属面板 UI）：notice/flow-dialog/esc-manager/mobile/z-order/settings-provider。
 * 契约保留：favorites.json 零迁移（llmConfig、balance 系、linkedNote 字段读不炸写不产）；
 *   smartcat 事件载荷（add/edit/delete/archive + favoritesEditChanges）；置顶/归档/删除撤销；
 *   命令 ID 不动。
 */
import { notice, notify, notifyUndo, notifySaveError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { longPress } from '../core/dom';
import { registerPanelEsc } from '../core/esc-manager';
import { isMobileEnv } from '../core/mobile';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { openItemMenu, openItemSheet, closeItemMenu, type ItemAction } from '../core/item-actions';
import { getApp } from '../core/app';
import { openExternalUrl } from '../core/utils';
import { mountIcons, uiModal } from '../core/ui';
import { bindFormSubmit } from '../core/ui/modal';
import { emitDomainEvent } from '../core/domain-bus';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { favoritesEditChanges } from '../smartcat/favorites-source';
import type { SettingsSchema } from '../core/settings-schema';
import { getTags, getTagById, newTagId, resetTagsState, setTags, getStoragePath, normalizeUrl, isUrlLike } from './config';
import {
  actionSpecs, formHtml, pickChipsHtml, hueOf, relTime,
  panelHtml, renderPanelView, localNow, normalizeFavSort, esc, iconSpan, emptyHtml,
  VIEW_ALL, VIEW_ARCHIVED, RESERVED_TAG_LABELS, safeTagIcon,
  type FavActionSpec,
  type FavSort,
  type FavoritesItem,
} from './render';
import { FavoritesAIService, normalizeAiOrganizeResult } from './ai';
import { DataManager } from './data';
// ADR-0002：app ↔ ui 环引用仅函数级延迟解析——本 import 只在 tagManagerDm() 运行时取用，
// 模块顶层零互访（两侧模块均已初始化后才会走到标签管理入口）
import { FavoritesApp } from './app';
import type { FavTag } from './types';

/** 域级模块状态（模块单例；卸载/测试重置）。tag/archived 切片与纯层 FavView 结构兼容 */
interface FavState {
  overlay: HTMLElement | null;
  items: FavoritesItem[];
  /** 当前标签筛选（null = 全部；存标签 label） */
  tag: string | null;
  /** 已归档视图（磁贴行「已归档」贴纸入口；数据仍 favorites.json，ADR-0074 冷存语义不变） */
  archived: boolean;
  /** 当前排序（打开时按 favoritesDefaultSort 播种，issue 296；纯层 filteredItems 消费） */
  sort: FavSort;
  renderFn: (() => void) | null;
}

const M: FavState = {
  overlay: null,
  items: [],
  tag: null,
  archived: false,
  sort: 'new',
  renderFn: null,
};

export function resetFavoritesState(): void {
  M.overlay = null;
  M.items = [];
  M.tag = null;
  M.archived = false;
  M.sort = 'new';
  M.renderFn = null;
}

// ==================== 设置 schema（⚙️ 已收敛设置面板） ====================
// ADR-0101：「日期显示」行随 favoritesTimeFormat 退役（固定相对时间）。

export function favoritesSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'favoritesSkin' }, options: [{ value: 'default', label: '标签工作台', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'favoritesSkinTheme' }, layoutKey: 'favoritesSkin', options: [{ value: 'linen', label: '亚麻', layout: 'default', prevClass: 'bz-sp-prev-linen' }] },
        ],
      },
      {
        // 显示组（issue 296）：打开默认筛选 + 默认排序——只管「打开面板时是什么」，面板内切换不回写
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '打开默认筛选',
            binding: { key: 'favoritesOpenFilter' },
            options: [
              { value: '', label: '全部' },
              { value: '@last', label: '记住上次' },
              ...getTags().map((t) => ({ value: t.label, label: t.label })),
            ],
          },
          {
            type: 'select',
            name: '默认排序',
            binding: { key: 'favoritesDefaultSort' },
            options: [
              { value: 'new', label: '最新收藏' },
              { value: 'old', label: '最早收藏' },
              { value: 'title', label: '按标题' },
            ],
          },
        ],
      },
      {
        // 标签管理（issue 363 标签自定义）：增删改排序，定义落 data.json 设置键 favoriteTags（config 单源）。
        // custom 行 = 域内自绘管理列表（行内文案不经设置文案 lint，与其他管理弹窗同惯例）
        icon: 'tags',
        name: '标签管理',
        rows: [
          {
            type: 'custom',
            render: (body, ctx) => renderTagManager(body, ctx),
          },
        ],
      },
    ],
  };
}

/** 打开默认筛选（设置 favoritesOpenFilter，issue 296）：''=全部；'@last'=取关面板记忆
 *  favoritesLastFilter（memoOpenScene '@last' 同款先例）；标签 label=固定该标签；
 *  非法值（含标签已删除/改名，issue 363）回落全部 */
function resolveOpenFilter(): { tag: string | null; archived: boolean } {
  const s = tryGetSettings();
  const v = s?.favoritesOpenFilter;
  if (v === '@last') {
    const last = s?.favoritesLastFilter;
    if (last === '@archived') return { tag: null, archived: true };
    if (last && getTags().some((t) => t.label === last)) return { tag: last, archived: false };
    return { tag: null, archived: false };
  }
  if (v && getTags().some((t) => t.label === v)) return { tag: v, archived: false };
  return { tag: null, archived: false };
}

// ==================== 主面板生命周期 ====================

/** ESC 层注册（主面板 + 表单浮层）。
 *  openPanel 与 openForm 开头各调一次：命令（bz-favorites-add）可不经面板直开表单，
 *  ESC 层必须随表单在场。2026-09-11 收编 core：菜单/抽屉浮层（含 ESC 条目/遮罩点击/下滑关闭）
 *  全归 core/item-actions 自持，本条目只管面板与表单；closeItemMenu 兜底收残（core 幂等，
 *  浮层未开时 no-op）。
 *  2026-09-19 收编 registerPanelEsc 幂等样板（C3，memo/belongings/cinema/bookshelf/home/
 *  gameshelf 六域先例）：同 id 已注册静默跳过，层常驻由 isVisible 判活（escManager 软关 +
 *  判活自愈语义不变，手写 mainEscRegistered 旗标退役）。 */
function ensureFavoritesEsc(): void {
  registerPanelEsc('bz-fav',
    () => !!M.overlay || !!document.querySelector('.bz-fav-form'),
    () => {
      closeItemMenu();
      if (document.querySelector('.bz-fav-form')) requestCloseForm();
      else closePanel();
    });
}

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
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
  overlay.innerHTML = panelHtml(isMobileEnv());
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号
  M.overlay = overlay;
  M.renderFn = () => renderAll();

  // 打开默认（issue 296）：筛选与排序按设置播种——''=全部 / '@last'=关面板记忆 / 固定标签直选
  const openFilter = resolveOpenFilter();
  M.tag = openFilter.tag;
  M.archived = openFilter.archived;
  M.sort = normalizeFavSort(tryGetSettings()?.favoritesDefaultSort);

  mountIcons(overlay); // 头行关闭钮等 innerHTML 模板里的图标占位

  // ESC（主面板 + 浮层栈：菜单 → 抽屉 → 表单 → 面板）
  ensureFavoritesEsc();

  // ---- 事件委托（overlay 顶层） ----
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePanel(); return; }
    if (t.closest('[data-fav-add]')) { openForm(null); return; }
    if (t.closest('[data-fav-close]')) { closePanel(); return; }
  });
  // 磁贴行点击（桌面换行/移动换行同一容器统一委托；「全部」「已归档」为字面贴纸值）
  const stickers = overlay.querySelector('[data-fav-tags]') as HTMLElement;
  stickers.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-fav-tag]') as HTMLElement | null;
    if (!b) return;
    applyTagFilter(b.dataset.favTag as string);
  });

  // 内容区：卡片点击（移动抽屉 / 桌面有链直开）+ 右键 + 键盘（UI-06：卡片 role=button 后
  // Enter/Space 与点击同径——键盘用户不再到不了开链/抽屉）
  const content = overlay.querySelector('[data-fav-content]') as HTMLElement;
  const openCardDefault = (it: FavoritesItem): void => {
    if (isMobileEnv()) { openMobSheet(it); return; }
    // 桌面：点击不弹菜单（操作唯一入口右键）——有链接直开浏览器，无链接不动作
    const rawUrl = (it.url || '').trim();
    if (rawUrl) openExternal(normalizeUrl(rawUrl));
  };
  content.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const card = t.closest('[data-fav-id]') as HTMLElement | null;
    if (!card) return;
    e.stopPropagation();
    const it = itemById(card.dataset.favId as string);
    if (it) openCardDefault(it);
  });
  content.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = (e.target as HTMLElement).closest('[data-fav-id]') as HTMLElement | null;
    if (!card || e.target !== card) return; // 只响应卡片自身聚焦（内部无嵌套交互件，防御性限定）
    e.preventDefault(); // Space 滚动页面语义让位给「触发卡片」
    const it = itemById(card.dataset.favId as string);
    if (it) openCardDefault(it);
  });
  content.addEventListener('contextmenu', (e) => {
    const card = (e.target as HTMLElement).closest('[data-fav-id]') as HTMLElement | null;
    if (!card || isMobileEnv()) return;
    e.preventDefault();
    const it = itemById(card.dataset.favId as string);
    if (it) openRowMenuAt(it, e.clientX, e.clientY);
  });
  // 移动端长按卡片 → 底部抽屉（统一手势 core/dom.longPress：与 core/item-actions 同源，
  // 触屏滚动不受影响——被动监听 + 10px 移动取消）。点卡开抽屉的既有入口保留，长按为新增入口。
  longPress(
    content,
    (ev: any) => {
      const card = (ev.target as HTMLElement)?.closest?.('[data-fav-id]') as HTMLElement | null;
      if (!card) return;
      const it = itemById(card.dataset.favId as string);
      if (it) openMobSheet(it);
    },
    undefined,
    (ev: any) => isMobileEnv() && !!(ev.target as HTMLElement)?.closest?.('[data-fav-id]')
  );

  // 读盘占位（UI-07）：先渲一帧空态——大库/盘慢时打开不再白板（磁贴行 + 空态立现，
  // 数据到位后全量重渲）；读盘失败走 loadItems 的错误通知 + 空列表，占位帧语义不变
  renderAll();

  void (async () => {
    await loadItems();
    renderAll();
  })();
}

export function closePanel(): void {
  if (M.overlay) {
    // 上次筛选记忆（favoritesOpenFilter='@last' 的取数源）：关面板记住当下视图，下次打开取回
    // （issue 296，memoLastScene 同款先例）。落设置不落 favorites.json——顶层纯条目数组不改根结构
    const s = tryGetSettings();
    if (s) {
      s.favoritesLastFilter = M.archived ? '@archived' : (M.tag || '');
      void saveSettings();
    }
    M.overlay.remove();
    M.overlay = null;
  }
  M.renderFn = null;
}

export function unloadFavoritesUI(): void {
  closePanel();
  resetFavoritesState();
  resetTagsState(); // issue 363：标签运行时集一并丢弃（设置键即真理，下次 getTags 自键重播种）
}

async function loadItems(): Promise<void> {
  try {
    M.items = await dataManagerOf().getAll();
  } catch (e) {
    M.items = [];
    // 读取失败不再静默显示空列表（用户会误以为数据丢了）
    notice('收藏数据读取失败，已显示为空列表', 'error');
    console.error('[favorites-load]', e);
  }
}

/** 数据刷新（外部写盘后：删除/置顶/归档/编辑后调用） */
async function reload(): Promise<void> {
  await loadItems();
  M.renderFn?.();
}

// ==================== 渲染（markup 全在 ./render；此处只接纯层胶水） ====================

function renderAll(): void {
  if (!M.overlay) return;
  // 悬空筛选归一（UI-08）：激活标签已不在标签集（设置面板删/改名后 M.tag 悬指）→ 回落全部。
  // 标签仍在但计数归零的激活 chip 由 chipsHtml 保渲染（灰显），不走此归一——视图不擅自切换。
  if (!M.archived && M.tag && !getTags().some((t) => t.label === M.tag)) M.tag = null;
  const panel = M.overlay.querySelector('.bz-fav-panel') as HTMLElement;
  renderPanelView(panel, M.items, M, { mountIcons, mobile: isMobileEnv() });
}

/** 标签筛选切换语义（磁贴行委托共用）：再点当前标签 = 取消筛选回全部；点「已归档」= 归档视图。
 *  只认哨兵值（UI-05/func-7）：磁贴行「全部/已归档」贴纸发 VIEW_ALL/VIEW_ARCHIVED 哨兵，
 *  与用户自定义标签 label 分命名空间——名为「已归档」的用户标签点选即按标签筛选，不再被劫持 */
function applyTagFilter(label: string): void {
  if (label === VIEW_ALL) { M.tag = null; M.archived = false; }
  else if (label === VIEW_ARCHIVED) { M.tag = null; M.archived = !M.archived; }
  else { M.archived = false; M.tag = M.tag === label ? null : label; }
  renderAll();
}

function itemById(id: string): FavoritesItem | undefined {
  return M.items.find((i) => i.id === id);
}

// ==================== 行操作（桌面菜单 / 移动抽屉共用） ====================

/** 动作元语 → 行为。归档/删除免确认直达（E1/C2，效率整改 5 口径 2026-09-19 落地）：
 *  接了 notifyUndo 的操作不再走 openFlowDialog 二次确认——撤销兜底已覆盖误操作风险，
 *  确认+撤销双保险只是多一次打断；同域两制（取消归档本就免确认）随之理顺。仅不可逆
 *  操作保留确认（本域仅「删除标签」确认框在位：bulk 迁移有跨条目副作用）。 */
function runAction(it: FavoritesItem, spec: FavActionSpec): void {
  const rawUrl = (it.url || '').trim();
  if (spec.act === 'open') {
    openExternal(normalizeUrl(rawUrl));
  } else if (spec.act === 'pin') {
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
      });
  } else if (spec.act === 'edit') {
    openForm(it);
  } else if (spec.act === 'archive') {
    // 归档（ADR-0074 数据仍在 favorites.json）：免确认直达 + notifyUndo 撤销
    void archiveItem(it);
  } else if (spec.act === 'unarchive') {
    void unarchiveItem(it);
  } else if (spec.act === 'del') {
    // 删除：免确认直达 + notifyUndo 撤销（撤销链完整，func-2 起撤销还补发 restored 事件）
    void deleteItem(it);
  }
}

// ==================== 行动浮层（2026-09-11 收编 core/item-actions） ====================

/** FavActionSpec → core ItemAction（lucide 图标名直通；danger→kind 红字档；
 *  onClick 闭包 runAction——动作序/确认文案契约不变，点击后 core 自动收浮层） */
function toItemActions(it: FavoritesItem): ItemAction[] {
  return actionSpecs(it).map((a) => ({
    icon: a.icon,
    label: a.label,
    kind: a.danger ? ('danger' as const) : undefined,
    onClick: () => runAction(it, a),
  }));
}

/** 桌面：右键 → core 跟手菜单（.bz-item-menu：防溢出定位/动态 z/键盘导航/外点关全归共享层；
 *  全套 !important 抗 Obsidian 默认 button 居中压盖——自绘 .bz-fav-ctx 真机即被压歪） */
function openRowMenuAt(it: FavoritesItem, x: number, y: number): void {
  openItemMenu(x, y, toItemActions(it), true);
}

/** 移动：底部详情抽屉（2026-09-11 收编 core openItemSheet：与 diary/belongings/cinema 同壳；
 *  遮罩点击/下滑关闭/防穿透/z 发号归共享层。磁点 + 标题 + meta 头走 sheetHead 通道） */
function openMobSheet(it: FavoritesItem): void {
  openItemSheet(toItemActions(it), { sheetHead: favSheetHead(it) });
}

/** 抽屉头（core sheetHead）：磁点 + 标题 + meta（原 shared.sheetHtml 头段迁移为 DOM 构建） */
function favSheetHead(it: FavoritesItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-fav-sh-head';
  const dot = document.createElement('span');
  dot.className = 'bz-fav-sh-dot';
  dot.style.setProperty('--c', `hsl(${hueOf((it.tags || [])[0] || '')} 52% 58%)`);
  const box = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'bz-fav-sh-title';
  title.textContent = it.title || '无标题';
  const meta = document.createElement('div');
  meta.className = 'bz-fav-sh-meta';
  meta.textContent = `${relTime(it.created)}${it.pinned ? ' · 已置顶' : ''}${it.archived ? ' · 已归档' : ''}`;
  box.append(title, meta);
  head.append(dot, box);
  return head;
}

function closeSheet(): void {
  closeItemMenu();
}

// ==================== 归档 / 取消归档 / 删除 ====================

/** 归档后可撤销：toast 挂「撤销」，点击回写 archived=false 恢复主列表 */
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
          // 撤销补发领域事件（func-2）：归档撤销补 unarchive 先例在位，删除撤销同制补 restored——
          // 否则行为流只记「删除」，smartcat 上下文从此以为条目已删。kind 已双侧同步
          // （smartcat/favorites-source.ts 联合类型 + 文案/结构化分支，契约测试对账）
          emitDomainEvent('favorites', { kind: 'restored', title: it.title });
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

// ==================== 数据服务（注入/持有） ====================

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
/** 外链打开 = core 单源转发（一致#14：原域内 openUrl→electron→window.open 四层副本删除，
 *  行为逐字等价——单源即以本域 F14 修复后的完整兜底链为基准） */
function openExternal(url: string): void {
  openExternalUrl(appOf(), url);
}

// ==================== 添加 / 编辑 表单（markup 在 shared.formHtml） ====================

interface FormBaseline {
  title: string;
  url: string;
  desc: string;
  pinned: boolean;
  tags: string;
}

let _saving = false;
let _baseline: FormBaseline | null = null;
/** 表单弹窗关闭句柄（core uiModal close；closeForm 统一走此单路径） */
let _formClose: (() => void) | null = null;

/** 表单当前 标签选中集 / 置顶态（DOM 读；供脏比较，避免闭包持有局部状态） */
function formTagsNow(popup: HTMLElement): string {
  return [...popup.querySelectorAll('#fz-tags [data-tag].bz-fav-on')]
    .map((b) => (b as HTMLElement).dataset.tag || '')
    .sort()
    .join('|');
}
function formPinNow(popup: HTMLElement): boolean {
  return !!(popup.querySelector('#fz-pin') as HTMLElement | null)?.classList.contains('bz-fav-on');
}

function formDirty(): boolean {
  if (!_baseline) return false;
  const popup = document.querySelector('.bz-fav-form') as HTMLElement | null;
  if (!popup) return false;
  return (
    inputVal(popup, '#fz-title') !== _baseline.title ||
    inputVal(popup, '#fz-url') !== _baseline.url ||
    inputVal(popup, '#fz-desc') !== _baseline.desc ||
    formPinNow(popup) !== _baseline.pinned ||
    formTagsNow(popup) !== _baseline.tags
  );
}

function requestCloseForm(): void {
  // issue 291：放弃草稿确认框同样要带本域皮肤类（第三个参数为 core 新增的 className 透传通道）。
  // 表单弹窗壳已收编 core uiModal（issue 365 第 5 项，popup 挂表单域类 + scope）；
  // 本确认框若不带同串类，同一域里就出现「表单有皮、放弃确认没皮」；与归档/删除确认取同一串类，三框同皮。
  if (formDirty()) {
    confirmDiscard(() => closeForm(), undefined, 'bz-fav-flow-dialog bz-fav-scope');
  } else {
    closeForm();
  }
}

function closeForm(): void {
  _baseline = null;
  _saving = false;
  closeItemMenu(); // 表单开着时若菜单/抽屉残留在下，一并收掉（core 幂等）
  // uiModal close（幂等）：遮罩与 ESC 层一并收（不留全屏空遮罩挡住下层交互）
  _formClose?.();
  _formClose = null;
}

/** 表单弹窗内取输入值（id 选择器；空串兜底；formDirty/runAiFill/saveForm 共用） */
function inputVal(popup: HTMLElement, id: string): string {
  return (popup.querySelector(id) as HTMLInputElement | null)?.value ?? '';
}

/** 打开添加/编辑表单（原型 1:1：标题/链接/简介/标签多选/置顶开关 + AI 整理钮；无大模型/关联笔记）
 *  壳走 core uiModal 单源（issue 365 第 5 项）：遮罩创建/z 发号/遮罩点击关/ESC 关全归 uiModal，
 *  脏拦截经 requestClose 通道（遮罩点击/ESC → requestCloseForm，脏表单先弹放弃确认）。 */
export function openForm(item: FavoritesItem | null): void {
  ensureFavoritesEsc(); // 命令可直开表单不经 openPanel：ESC 层随表单注册（F2），且须先于 uiModal 层入栈
  // 单例守卫（F15 + E3/FV2）：已有表单不再无条件 closeForm() 静默丢草稿——脏则走
  // requestCloseForm 的 confirmDiscard 放弃确认（确认前不开新表单），干净则直关后换新表单
  // （belongings openBelForm 守卫同款关闭纪律）
  if (document.querySelector('.bz-fav-form')) {
    if (formDirty()) {
      requestCloseForm();
      return;
    }
    closeForm();
  }
  const it = item;
  const host = document.createElement('div');
  host.innerHTML = formHtml(it);
  const { mask, popup, close } = uiModal({
    content: host.firstElementChild as HTMLElement,
    // 弹窗壳只挂 scope（token 域）；bz-fav-form 类由单源 markup 内容根携带（F15 教训：
    // 壳与内容同挂一类会双计单例守卫），亚麻卡几何锚 .bz-overlay-popup.bz-fav-scope
    className: 'bz-fav-scope',
    requestClose: () => requestCloseForm(),
    onClose: () => { _formClose = null; },
  });
  _formClose = close;
  mountIcons(mask);

  _baseline = {
    title: it?.title || '',
    url: it?.url || '',
    desc: it?.description || '',
    pinned: !!it?.pinned,
    // 与 DOM 脏比较同口径（只数当前标签集 chip，issue 363 动态）：标签集外标签不进基线，一开表单不误判脏（F10）
    tags: (it?.tags || []).filter((t) => getTags().some((x) => x.label === t)).sort().join('|'),
  };

  // 贴链自动搬家：标题框粘贴 URL 形态内容 → 移入链接框并回焦标题
  const titleInp = popup.querySelector('#fz-title') as HTMLInputElement;
  const urlInp = popup.querySelector('#fz-url') as HTMLInputElement;
  titleInp.addEventListener('paste', (e: ClipboardEvent) => {
    const text = (e.clipboardData || (window as any).clipboardData)?.getData('text')?.trim() || '';
    if (!isUrlLike(text)) return;
    e.preventDefault();
    if (!urlInp.value.trim()) urlInp.value = normalizeUrl(text);
    setTimeout(() => titleInp.focus(), 0);
  });

  // 标签多选 chips（markup 在 shared.pickChipsHtml；选中态切换在此绑定）
  const pick = popup.querySelector('#fz-tags') as HTMLElement;
  const sel = new Set<string>(it?.tags || []);
  const drawPick = () => {
    pick.innerHTML = pickChipsHtml(sel);
    pick.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
      const label = (b as HTMLElement).dataset.tag as string;
      if (sel.has(label)) sel.delete(label);
      else sel.add(label);
      b.classList.toggle('bz-fav-on', sel.has(label));
    }));
    mountIcons(pick);
  };
  drawPick();

  // 置顶开关（原型 .sw 滑钮逐字；UI-06：role=switch + aria-checked + Space/Enter 键盘，
  // core uiSwitch 范式——视觉不变，读屏与键盘用户可达）
  const pinEl = popup.querySelector('#fz-pin') as HTMLElement;
  const togglePin = () => {
    const on = pinEl.classList.toggle('bz-fav-on');
    pinEl.setAttribute('aria-checked', String(on));
  };
  pinEl.addEventListener('click', togglePin);
  pinEl.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePin();
    }
  });

  const errEl = popup.querySelector('#fz-err') as HTMLElement;

  // 取消 → 脏拦截；保存（遮罩点击关闭已归 uiModal requestClose 通道，不再自挂 mousedown）
  popup.querySelector('[data-fz-cancel]')?.addEventListener('click', () => requestCloseForm());
  popup.querySelector('#fz-ai')?.addEventListener('click', () => void runAiFill(popup, sel, drawPick, errEl));
  popup.querySelector('#fz-save')?.addEventListener('click', () => void saveForm(popup, it, sel, errEl));
  // 键盘提交（UI-11/E4）：core bindFormSubmit 单源——单行 input 纯 Enter 提交、textarea
  // 回车换行不拦、Ctrl/⌘+Enter 恒提交、isComposing 防 IME 误发（saveForm 自带 _saving 防重入）
  bindFormSubmit(popup, () => void saveForm(popup, it, sel, errEl));

  // 初始聚焦归 uiModal firstFocusable 单源（UI-03）：桌面落 #fz-title（markup 首个 input），
  // 移动端自动跳过 input/textarea 防软键盘顶起盖表单——原 setTimeout 强制聚焦已退役
}

// ==================== AI 整理（真实调用，契约逐字保留） ====================

async function runAiFill(
  popup: HTMLElement,
  sel: Set<string>,
  redraw: () => void,
  errEl: HTMLElement
): Promise<void> {
  const ai = aiServiceOf();
  if (!(await ai.isAvailable())) {
    notice('AI 服务未配置或不可用', 'warning');
    return;
  }
  const title = inputVal(popup, '#fz-title').trim();
  const url = inputVal(popup, '#fz-url').trim();
  const desc = inputVal(popup, '#fz-desc').trim();
  if (!title && !url && !desc) {
    notice('请至少输入标题、链接或简介中的一项，以便 AI 参考');
    return;
  }
  const btn = popup.querySelector('#fz-ai') as HTMLButtonElement;
  const aiLabel = btn.lastElementChild as HTMLElement;
  btn.disabled = true;
  aiLabel.textContent = 'AI 整理中…';
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
    // func-5 接线（批 A 数据侧收口 normalizeAiOrganizeResult）：url 补协议、tags 数组化、
    // 字段 String 纠偏——AI 按提示词「无法判断原样返回」的无协议链接不再被保存校验拦截，
    // 「整理完即可存」闭环
    const res = normalizeAiOrganizeResult(data);
    const setVal = (id: string, v: unknown) => {
      const el = popup.querySelector(id) as HTMLInputElement | null;
      if (el && !el.value.trim() && v) el.value = String(v);
    };
    if (ghInfo?.fetched) setVal('#fz-title', ghInfo.title);
    setVal('#fz-title', res.title);
    setVal('#fz-url', res.url);
    setVal('#fz-desc', res.description);
    const rawTags: string[] = res.tags;
    const known = getTags().map((t) => t.label);
    const valid = rawTags.filter((t) => known.includes(t));
    const unknown = rawTags.filter((t) => !known.includes(t));
    if (unknown.length) notice(`AI 整理的标签「${unknown.join('、')}」不在列表中，已忽略`, 'warning');
    // GitHub 强标签按 id 解耦（issue 363）：改名后仍取当前 label；标签已删除则跳过特判
    const ghTag = getTagById('github');
    if (ghInfo?.fetched && ghTag && !valid.includes(ghTag.label)) valid.unshift(ghTag.label);
    sel.clear();
    valid.forEach((t) => sel.add(t));
    redraw();
    handle.setType('success');
    handle.setMessage('AI 整理完成');
  } catch (e: any) {
    handle.setType('error');
    handle.setMessage(`AI 整理失败：${e?.message || '未知错误'}`);
  } finally {
    btn.disabled = false;
    aiLabel.textContent = 'AI 整理';
    errEl.textContent = '';
  }
}

/** AI 提示词（GitHub 版含翻译约束；简介禁编造；标签清单随 getTags() 动态——issue 363） */
function aiPrompt(title: string, url: string, desc: string, ghInfo: { title: string; description: string; fetched: boolean } | null): string {
  const known = getTags().map((t) => t.label).join('、');
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

async function saveForm(popup: HTMLElement, it: FavoritesItem | null, sel: Set<string>, errEl: HTMLElement): Promise<void> {
  if (_saving) return;
  const title = inputVal(popup, '#fz-title').trim();
  // E6 写侧半：保存前 normalizeUrl 归一（无协议自动补 https://，空串跳过不产协议头）——
  // 手输链接与贴链/读侧同一待遇，校验只拦不可救形态
  const rawUrl = inputVal(popup, '#fz-url').trim();
  const url = rawUrl ? normalizeUrl(rawUrl) : '';
  if (!title) { errEl.textContent = '请输入标题'; return; }
  if (url && !/^https?:\/\//i.test(url)) { errEl.textContent = '链接需以 http(s):// 开头'; return; } // 归一后恒过，防御性保留
  if (sel.size === 0) { errEl.textContent = '请至少选择一个标签'; return; }
  const desc = inputVal(popup, '#fz-desc').trim();
  const tags = [...sel];
  const pin = formPinNow(popup);

  _saving = true;
  const saveBtn = popup.querySelector('#fz-save') as HTMLButtonElement;
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';
  const dm = dataManagerOf();
  try {
    if (it) {
      const old = it;
      // linkedNote/llmConfig 已整功能退役（ADR-0101）：编辑不触碰旧值（数据字段保留不迁移）
      const next: FavoritesItem = {
        ...old,
        title,
        url,
        description: desc,
        tags,
        pinned: pin,
      };
      const changes = favoritesEditChanges(old, next);
      await dm.update(old.id, next);
      emitDomainEvent('favorites', { kind: 'edit', title: next.title, changes });
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
        linkedNote: null,
        created: localNow(),
        type: tags[0],
      };
      await dm.add(data);
      emitDomainEvent('favorites', { kind: 'add', item: data });
    }
    closeForm();
    await reload();
  } catch (e: any) {
    notifySaveError(e);
    saveBtn.disabled = false;
    saveBtn.textContent = it ? '保存' : '添加';
  } finally {
    _saving = false;
  }
}

// ==================== 标签管理（issue 363：设置面板「标签管理」组 custom 行） ====================
// 定义本体 data.json 设置键 favoriteTags（data.saveTags → config.setTags 写设置层 + saveSettings
// 持久化）；改名/删除时存量条目经 updateTagLabelBulk 批量跟随（范式 = memo updateSceneBulk）；
// 行内文案不经设置文案 lint（custom 插槽惯例）。挂 .bz-fav-scope 取域私有 token（flow-dialog 同款通道）。
// UI 全域内自绘（ADR-0101 拍板：favorites 不引组件库按钮，review-fix-b 守卫）——按钮/输入框
// 自建 DOM + `data-lucide` 占位经 mountIcons 兑现；编辑弹窗壳收编 core uiModal（同 openForm
// 口径），内容根复用 .bz-fav-form / .bz-fav-btns，与「添加·编辑收藏」同皮。

/** 图标选择集（lucide 名；含内置 9 类原图标，供新增/编辑挑选） */
const TAG_ICON_CHOICES = [
  'tag', 'bookmark', 'star', 'heart', 'github', 'globe', 'app-window', 'brain-circuit',
  'keyboard', 'bot', 'zap', 'beer', 'waypoints', 'book-open', 'film', 'music',
  'gamepad-2', 'package', 'briefcase', 'graduation-cap', 'link', 'folder',
];

/** 管理用数据管理器（arch-4 收口）：改取 FavoritesApp 单例的 dataManager，与主面板同实例——
 *  storagePath 运行中变更不热切换（语义 =「需重载插件后全面生效」，与 ADR-0009 手动迁移
 *  Notice 同口径），双实例两轨漂移不再存在。init 前为 null（正常链路不可达：标签管理入口
 *  都在懒加载 init 之后），现构造兜底仅承担测试/时序防御，不构成第二语义。 */
function tagManagerDm(): DataManager {
  return FavoritesApp.getInstance().dataManager
    ?? new DataManager(getStoragePath((tryGetSettings() as any)?.storagePath));
}

/** 管理列表渲染（custom 行 render 入口）：先画当前生效集，loadTags（含旧文件迁移）完成后重画 */
function renderTagManager(body: HTMLElement, _ctx: { rowEl: HTMLElement; refreshVisibility: () => void }): void {
  const dm = tagManagerDm();
  const wrap = document.createElement('div');
  wrap.className = 'bz-fav-scope bz-fav-tagmgr';
  body.appendChild(wrap);
  const draw = () => drawTagManager(wrap, dm, draw);
  draw();
  void dm.loadTags().then(draw).catch(() => { /* 载入失败保持当前生效集 */ });
}

function drawTagManager(wrap: HTMLElement, dm: DataManager, redraw: () => void): void {
  wrap.innerHTML = '';
  const tags = getTags();
  /** 行内小图标钮（域内自绘，样式 .bz-fav-tagmgr-btn；UI-13：挂 core bz-touch-target，
   *  26px 钮 + ::after 外扩触达 ≥40px，零几何改动） */
  const icBtn = (ic: string, title: string, disabled: boolean, danger: boolean, onClick: () => void): HTMLElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-fav-tagmgr-btn bz-touch-target' + (danger ? ' bz-fav-tagmgr-btn--danger' : '');
    b.title = title;
    b.setAttribute('aria-label', title);
    b.disabled = disabled;
    b.innerHTML = `<i data-lucide="${ic}"></i>`;
    b.addEventListener('click', onClick);
    return b;
  };
  for (const tag of tags) {
    const row = document.createElement('div');
    row.className = 'bz-fav-tagmgr-row';
    const ic = document.createElement('span');
    ic.className = 'bz-fav-tagmgr-ic';
    // UI-10：动态 tag.ic 不直插 innerHTML——safeTagIcon 白名单（不合者回落 'tag'）后经 iconSpan
    ic.innerHTML = iconSpan(safeTagIcon(tag.ic));
    const name = document.createElement('span');
    name.className = 'bz-fav-tagmgr-name';
    name.textContent = tag.label;
    const ops = document.createElement('span');
    ops.className = 'bz-fav-tagmgr-ops';
    const idx = tags.indexOf(tag);
    ops.append(
      icBtn('chevron-up', '上移', idx === 0, false, () => void moveTag(dm, idx, -1, redraw)),
      icBtn('chevron-down', '下移', idx === tags.length - 1, false, () => void moveTag(dm, idx, 1, redraw)),
      icBtn('pencil', '编辑', false, false, () => openTagEditor(dm, tag, redraw)),
      icBtn('trash-2', '删除', false, true, () => void deleteTagFlow(dm, tag, redraw)),
    );
    row.append(ic, name, ops);
    wrap.appendChild(row);
  }
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'bz-fav-tagmgr-add';
  addBtn.innerHTML = `<i data-lucide="plus"></i><span>添加标签</span>`;
  addBtn.addEventListener('click', () => openTagEditor(dm, null, redraw));
  wrap.appendChild(addBtn);
  mountIcons(wrap);
}

/** 排序调整（上移/下移）：交换后整体落盘（saveTags 写设置键 + saveSettings 即时生效） */
async function moveTag(dm: DataManager, idx: number, delta: number, redraw: () => void): Promise<void> {
  const tags = [...getTags()];
  const j = idx + delta;
  if (j < 0 || j >= tags.length) return;
  [tags[idx], tags[j]] = [tags[j], tags[idx]];
  try {
    await dm.saveTags(tags);
    redraw();
  } catch (e) {
    notifySaveError(e, '调整标签排序');
  }
}

/** 新增/编辑弹窗（壳收编 core uiModal，与表单弹窗同口径 issue 365 第 5 项；markup 用独立
 *  内容根 .bz-fav-tageditor——不再复用 .bz-fav-form（func-6：该类是收藏表单单例守卫/ESC 判活
 *  的专用契约钩子，复用会让守卫误命中双层遮罩；皮由 styles.css :is 组并列承载，两弹窗同皮））：
 *  名称 + 图标胶囊；编辑改名先 updateTagLabelBulk 迁条目再存定义。
 *  UI-12：补 requestClose 关闭礼节——名称非空且非初值时走 confirmDiscard（遮罩/ESC 不再
 *  静默丢输入），与同域主表单同一套脏拦截纪律。 */
function openTagEditor(dm: DataManager, existing: FavTag | null, redraw: () => void): void {
  const host = document.createElement('div');
  host.innerHTML = `
    <div class="bz-fav-tageditor">
    <h2>${existing ? '编辑标签' : '添加标签'}</h2>
    <div class="bz-fav-fld"><label>名称</label><input id="fz-tag-name" value="${esc(existing?.label || '')}" placeholder="如：装修灵感"></div>
    <div class="bz-fav-fld"><label>图标</label><div class="bz-fav-tageditor-ics" id="fz-tag-ics"></div></div>
    <div class="bz-fav-btns">
      <button type="button" data-fz-tag-cancel>取消</button>
      <button type="button" id="fz-tag-save" class="bz-fav-pri">${existing ? '保存' : '添加'}</button>
    </div>
    </div>`;
  // 弹窗壳只挂 scope（token 域）；内容根携独立类（func-6：bz-fav-form 单例守卫不误命中）
  const { popup, close } = uiModal({
    content: host.firstElementChild as HTMLElement,
    className: 'bz-fav-scope',
    maxWidth: 380,
    requestClose: () => {
      const input = popup.querySelector('#fz-tag-name') as HTMLInputElement | null;
      // 轻量脏检：名称非空且与编辑初值不同 = 有未保存输入 → 放弃确认；空白/未改直关
      if (input && input.value.trim() && input.value.trim() !== (existing?.label || '')) {
        confirmDiscard(() => close(), undefined, 'bz-fav-flow-dialog bz-fav-scope');
      } else {
        close();
      }
    },
  });
  mountIcons(popup);
  const input = popup.querySelector('#fz-tag-name') as HTMLInputElement;
  let picked = existing?.ic || 'tag';
  const icPick = popup.querySelector('#fz-tag-ics') as HTMLElement;
  const drawIcs = () => {
    icPick.innerHTML = '';
    for (const name of TAG_ICON_CHOICES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-fav-tageditor-ic' + (name === picked ? ' bz-fav-on' : '');
      b.innerHTML = `<i data-lucide="${name}"></i>`;
      b.addEventListener('click', () => { picked = name; drawIcs(); });
      icPick.appendChild(b);
    }
    mountIcons(icPick);
  };
  drawIcs();

  const doSave = async (): Promise<void> => {
    const label = input.value.trim();
    if (!label) { notice('请输入标签名称'); return; }
    // 保留字防御（func-7）：内置视图哨兵/磁贴字面值/@last 设置哨兵不可用作标签名——
    // 撞名会让磁贴筛选分流被哨兵分支劫持（详见 shared.RESERVED_TAG_LABELS）
    if (RESERVED_TAG_LABELS.includes(label)) { notice('该名称与内置视图冲突，请换一个名称'); return; }
    if (getTags().some((t) => t.label === label && t.id !== existing?.id)) { notice('已有同名标签'); return; }
    const next = [...getTags()];
    const prevTags = [...getTags()]; // 改动前定义快照（落盘失败回滚用）
    let bulkDone = false; // 是否已迁移条目（决定失败时是否反向回滚）
    try {
      if (existing) {
        const idx = next.findIndex((t) => t.id === existing.id);
        if (idx === -1) { notice('标签不存在，请重试', 'error'); return; }
        // 改名存量跟随（issue 363）：先批量迁移条目 tags[]+type，成功后才写新定义——防条目与定义脱钩
        if (next[idx].label !== label) {
          await dm.updateTagLabelBulk(next[idx].label, label);
          bulkDone = true;
        }
        next[idx] = { ...next[idx], label, ic: picked };
      } else {
        next.push({ id: newTagId(), label, ic: picked });
      }
      await dm.saveTags(next);
      notice(existing ? `已更新标签「${label}」` : `已添加标签「${label}」`, 'success');
      close();
      redraw();
    } catch (e) {
      // 审查修复：定义落盘失败时条目可能已被 bulk 迁走——反向 bulk 迁回 + 内存定义回旧值，
      // 条目/定义不再脱钩（磁盘设置键未被本次污染，回滚后三方一致；反向迁移失败留痕下次改名可纠）
      if (bulkDone && existing) {
        try {
          await dm.updateTagLabelBulk(label, existing.label);
        } catch (e2) {
          console.error('[favorites-tags] 改名回滚失败（条目暂挂新名）:', e2);
        }
      }
      setTags(prevTags);
      notifySaveError(e, '保存标签');
    }
  };
  popup.querySelector('[data-fz-tag-cancel]')?.addEventListener('click', () => close());
  popup.querySelector('#fz-tag-save')?.addEventListener('click', () => void doSave());
  // 键盘提交（UI-04/C6）：手写 keydown Enter 退役，收编 core bindFormSubmit——获得 isComposing
  // 防 IME 误发（中文候选确认键不再误触发保存）+ Ctrl/⌘+Enter 恒提交语义
  bindFormSubmit(popup, () => void doSave());
  // 初始聚焦归 uiModal firstFocusable 单源（UI-03）：桌面落名称框，移动端跳过 input 防软键盘
}

/** 删除标签：至少留一个；带条目时确认迁入「网站」（id 'web'，已删则取剩余第一个）。
 *  审查修复：与改名同形态——bulk 迁完条目后定义落盘失败，反向 bulk 迁回 + 内存定义回快照。 */
async function deleteTagFlow(dm: DataManager, tag: FavTag, redraw: () => void): Promise<void> {
  const prevTags = [...getTags()]; // 改动前定义快照（落盘失败回滚用）
  const rest = getTags().filter((t) => t.id !== tag.id);
  if (!rest.length) { notice('至少保留一个标签'); return; }
  const fallback = rest.find((t) => t.id === 'web') ?? rest[0];
  let count = 0;
  try {
    const items = await dm.getAll();
    count = items.filter((i) => (i.tags || []).includes(tag.label)).length;
  } catch { /* 读失败按 0 条处理：删除定义本身不受影响 */ }
  const ok = await openFlowDialog({
    title: '删除标签',
    className: 'bz-fav-flow-dialog bz-fav-scope',
    message: count > 0
      ? `确定删除标签「${tag.label}」吗？\n其中 ${count} 条收藏将迁入标签「${fallback.label}」。`
      : `确定删除标签「${tag.label}」吗？\n标签将从标签列表中移除。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'del', danger: true, cta: true },
    ],
  });
  if (ok !== 'del') return;
  let bulkDone = false;
  try {
    if (count > 0) {
      await dm.updateTagLabelBulk(tag.label, fallback.label);
      bulkDone = true;
    }
    await dm.saveTags(rest);
    notice(`已删除标签「${tag.label}」`, 'success');
    redraw();
  } catch (e) {
    if (bulkDone) {
      try {
        await dm.updateTagLabelBulk(fallback.label, tag.label);
      } catch (e2) {
        console.error('[favorites-tags] 删除回滚失败（条目暂挂兜底标签）:', e2);
      }
    }
    setTags(prevTags);
    notifySaveError(e, '删除标签');
  }
}
