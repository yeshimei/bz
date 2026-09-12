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
import { escManager } from '../core/esc-manager';
import { isMobileEnv } from '../core/mobile';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { openItemMenu, openItemSheet, closeItemMenu, type ItemAction } from '../core/item-actions';
import { getApp } from '../core/app';
import { mountIcons } from '../core/ui';
import { emitDomainEvent } from '../core/domain-bus';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { favoritesEditChanges } from '../smartcat/favorites-source';
import type { SettingsSchema } from '../core/settings-schema';
import { TAGS, normalizeUrl, isUrlLike } from './config';
import {
  actionSpecs, formHtml, pickChipsHtml, hueOf, relTime,
  panelHtml, renderPanelView, localNow, normalizeFavSort,
  type FavActionSpec,
  type FavSort,
  type FavoritesItem,
} from './render';
import { FavoritesAIService } from './ai';
import type { DataManager } from './data';

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
              ...TAGS.map((t) => ({ value: t.label, label: t.label })),
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
    ],
  };
}

/** 打开默认筛选（设置 favoritesOpenFilter，issue 296）：''=全部；'@last'=取关面板记忆
 *  favoritesLastFilter（memoOpenScene '@last' 同款先例）；标签 label=固定该标签；
 *  非法值（含标签已不在九类）回落全部 */
function resolveOpenFilter(): { tag: string | null; archived: boolean } {
  const s = tryGetSettings();
  const v = s?.favoritesOpenFilter;
  if (v === '@last') {
    const last = s?.favoritesLastFilter;
    if (last === '@archived') return { tag: null, archived: true };
    if (last && TAGS.some((t) => t.label === last)) return { tag: last, archived: false };
    return { tag: null, archived: false };
  }
  if (v && TAGS.some((t) => t.label === v)) return { tag: v, archived: false };
  return { tag: null, archived: false };
}

// ==================== 主面板生命周期 ====================

let mainEscRegistered = false;

/** ESC 层注册（主面板 + 表单浮层）。
 *  openPanel 与 openForm 开头各调一次：命令（bz-favorites-add）可不经面板直开表单，
 *  ESC 层必须随表单在场（对照 belongings ensureBelongingsEsc 同款）。
 *  2026-09-11 收编 core：菜单/抽屉浮层（含 ESC 条目/遮罩点击/下滑关闭）全归 core/item-actions
 *  自持，本条目只管面板与表单；closeItemMenu 兜底收残（core 幂等，浮层未开时 no-op）。 */
function ensureFavoritesEsc(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-fav', {
    isVisible: () => !!M.overlay || !!document.querySelector('.bz-fav-form'),
    close: () => {
      closeItemMenu();
      const form = document.querySelector('.bz-fav-form') as HTMLElement | null;
      if (form) requestCloseForm(form);
      else closePanel();
    },
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

  // 内容区：卡片点击（移动抽屉 / 桌面有链直开）+ 右键
  const content = overlay.querySelector('[data-fav-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const card = t.closest('[data-fav-id]') as HTMLElement | null;
    if (!card) return;
    e.stopPropagation();
    const it = itemById(card.dataset.favId as string);
    if (!it) return;
    if (isMobileEnv()) { openMobSheet(it); return; }
    // 桌面：点击不弹菜单（操作唯一入口右键）——有链接直开浏览器，无链接不动作
    const rawUrl = (it.url || '').trim();
    if (rawUrl) openExternal(normalizeUrl(rawUrl));
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
  const panel = M.overlay.querySelector('.bz-fav-panel') as HTMLElement;
  renderPanelView(panel, M.items, M, { mountIcons, mobile: isMobileEnv() });
}

/** 标签筛选切换语义（磁贴行委托共用）：再点当前标签 = 取消筛选回全部；点「已归档」= 归档视图 */
function applyTagFilter(label: string): void {
  if (label === '全部' || label === '__all') { M.tag = null; M.archived = false; }
  else if (label === '已归档' || label === '__archived') { M.tag = null; M.archived = !M.archived; }
  else { M.archived = false; M.tag = M.tag === label ? null : label; }
  renderAll();
}

function itemById(id: string): FavoritesItem | undefined {
  return M.items.find((i) => i.id === id);
}

// ==================== 行操作（桌面菜单 / 移动抽屉共用） ====================

/** 动作元语 → 行为（动作序与归档/删除确认文案契约逐字保留；ADR-0101 跳转笔记/刷新余额退役） */
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
    // 归档（ADR-0074 数据仍在 favorites.json）
    void openFlowDialog({
      title: '归档收藏',
      // issue 291：流程框挂 document.body，不在 .bz-fav-panel 树内——不显式带皮肤类就掉回 core 裸皮。
      // `bz-fav-flow-dialog` = 本域确认框专属类（styles.css 映射表单弹窗 .bz-fav-form 那套亚麻取值）；
      // `bz-fav-scope` 必须跟着传：亚麻/暖纸是私有 token（--pop/--pop-ink/--pop-mut/--mask/--acc），
      // 只在 .bz-fav-scope 命中时才定义，缺它变量全部解析失败。
      className: 'bz-fav-flow-dialog bz-fav-scope',
      message: `确定归档收藏「${it.title}」吗？归档后不在主列表显示（数据保留），可在通知中撤销。`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '归档', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v === 'ok') void archiveItem(it);
    });
  } else if (spec.act === 'unarchive') {
    void unarchiveItem(it);
  } else if (spec.act === 'del') {
    void openFlowDialog({
      title: '删除收藏',
      // issue 291：与归档确认同一套皮肤类（删除是危险主动作 → core 另挂 bz-flow-dialog--danger，
      // 与皮肤类并存不冲突）。类含义见归档确认处注释。
      className: 'bz-fav-flow-dialog bz-fav-scope',
      message: `确定删除收藏「${it.title}」吗？删除后可在通知中撤销。`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'del', danger: true, cta: true },
      ],
    }).then((v) => {
      if (v === 'del') void deleteItem(it);
    });
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
function openExternal(url: string): void {
  const app = appOf();
  try {
    // 不带 ?.：openUrl 缺失时抛 TypeError 落 catch 走 electron 兜底（与 memo/literature 写法对齐）
    (app as any).openUrl(url);
    return;
  } catch (e) { /* 落 electron 兜底 */ }
  try {
    const electron = (window as any).require && (window as any).require('electron');
    if (electron && electron.shell) {
      electron.shell.openExternal(url);
      return;
    }
  } catch (e) { /* 落 window.open 兜底 */ }
  // F14：移动端无 electron（也无 require），两层兜底都落空时不再静默——
  // 先试 window.open（系统浏览器），仍失败给人话提示
  try {
    const w = window.open(url, '_blank');
    if (w) return;
  } catch (e) { /* 环境不支持（jsdom 等）落提示 */ }
  notice('无法打开链接，请复制到浏览器打开', 'error');
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

function requestCloseForm(popup: HTMLElement): void {
  // issue 291：放弃草稿确认框同样要带本域皮肤类（第三个参数为 core 新增的 className 透传通道）。
  // 表单弹窗 openForm 的 mask 挂 body 时已自带 `bz-fav-form-mask` + `bz-fav-scope`，本框若不带，
  // 同一域里就出现「表单有皮、放弃确认没皮」；与归档/删除确认取同一串类，三框同皮。
  if (formDirty()) {
    confirmDiscard(() => closeForm(popup), undefined, 'bz-fav-flow-dialog bz-fav-scope');
  } else {
    closeForm(popup);
  }
}

function closeForm(popup: HTMLElement): void {
  _baseline = null;
  _saving = false;
  closeItemMenu(); // 表单开着时若菜单/抽屉残留在下，一并收掉（core 幂等）
  // 连同遮罩一并移除（不留全屏空遮罩挡住下层交互）
  (popup.closest('.bz-fav-form-mask') ?? popup).remove();
}

/** 表单弹窗内取输入值（id 选择器；空串兜底；formDirty/runAiFill/saveForm 共用） */
function inputVal(popup: HTMLElement, id: string): string {
  return (popup.querySelector(id) as HTMLInputElement | null)?.value ?? '';
}

/** 打开添加/编辑表单（原型 1:1：标题/链接/简介/标签多选/置顶开关 + AI 整理钮；无大模型/关联笔记） */
export function openForm(item: FavoritesItem | null): void {
  ensureFavoritesEsc(); // 命令可直开表单不经 openPanel：ESC 层随表单注册（F2）
  // 单例守卫（F15）：已有表单先收掉——防多层叠加（ESC 一次只关一层、遮罩层叠点击错位）
  const existing = document.querySelector('.bz-fav-form') as HTMLElement | null;
  if (existing) closeForm(existing);
  const it = item;
  const mask = document.createElement('div');
  mask.className = 'bz-fav-form-mask bz-fav-scope';
  mask.innerHTML = formHtml(it);
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号，恒压主面板
  mountIcons(mask);
  const popup = mask.querySelector('.bz-fav-form') as HTMLElement;

  _baseline = {
    title: it?.title || '',
    url: it?.url || '',
    desc: it?.description || '',
    pinned: !!it?.pinned,
    // 与 DOM 脏比较同口径（只数九类 chip）：TAGS 外标签不进基线，一开表单不误判脏（F10）
    tags: (it?.tags || []).filter((t) => TAGS.some((x) => x.label === t)).sort().join('|'),
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

  // 置顶开关（原型 .sw 滑钮逐字）
  const pinEl = popup.querySelector('#fz-pin') as HTMLElement;
  pinEl.addEventListener('click', () => pinEl.classList.toggle('bz-fav-on'));

  const errEl = popup.querySelector('#fz-err') as HTMLElement;

  // 遮罩点击 / 取消 → 脏拦截；保存
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) requestCloseForm(popup); });
  popup.querySelector('[data-fz-cancel]')?.addEventListener('click', () => requestCloseForm(popup));
  popup.querySelector('#fz-ai')?.addEventListener('click', () => void runAiFill(popup, sel, drawPick, errEl));
  popup.querySelector('#fz-save')?.addEventListener('click', () => void saveForm(popup, it, sel, errEl));

  setTimeout(() => (popup.querySelector('#fz-title') as HTMLInputElement)?.focus(), 100);
}

// ==================== AI 整理（真实调用，契约逐字保留） ====================

async function runAiFill(
  popup: HTMLElement,
  sel: Set<string>,
  redraw: () => void,
  errEl: HTMLElement
): Promise<void> {
  const ai = aiServiceOf();
  if (!ai.isAvailable()) {
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

/** AI 提示词（GitHub 版含翻译约束；简介禁编造） */
function aiPrompt(title: string, url: string, desc: string, ghInfo: { title: string; description: string; fetched: boolean } | null): string {
  const known = TAGS.map((t) => t.label).join('、');
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
  const url = inputVal(popup, '#fz-url').trim();
  if (!title) { errEl.textContent = '请输入标题'; return; }
  if (url && !/^https?:\/\//i.test(url)) { errEl.textContent = '链接需以 http(s):// 开头'; return; }
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
