/**
 * 收藏本 UI 管理器（ticket 11）：源码 收藏本.js L237-1423 逐字移植。
 */
import moment from 'moment';
import { notice, notify, notifyUndo, notifySaveError } from '../core/notice';
import { createIconBtn, topifyZ } from '../core/dom';
import { allocZ } from '../core/z-order';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import {
  attachItemActions,
  refreshItemSheet,
  registerSheetCompanion,
  unregisterSheetCompanion,
  closeItemMenu,
  type ItemAction,
} from '../core/item-actions';
import { getApp } from '../core/app';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { CONFIG } from './config';
import { BalanceService, FavoritesAIService } from './ai';
import type { DataManager } from './data';
import type { FavoritesItem } from './types';
import { emitDomainEvent } from '../core/domain-bus';
import { favoritesEditChanges } from '../smartcat/favorites-source';

/** 搜索防抖时长（ticket 42）：输入停止 180ms 后才重新筛选渲染 */
const SEARCH_DEBOUNCE_MS = 180;
/** 单击直开双击窗口（ticket 61）：同卡 300ms 内重复点击不重开（防双击连开两个标签页） */
const OPEN_CLICK_WINDOW_MS = 300;
/** 分页大小（ticket 141）：主列表每页 50 条，滚动到底自动加载（movie 域同款交互） */
const PAGE_SIZE = 50;

/** 排序键（ticket 141）：created=创建时间最新优先（默认）/ title=标题 / domain=域名 */
const SORT_KEYS = ['created', 'title', 'domain'] as const;
type SortKey = (typeof SORT_KEYS)[number];
/** 排序选项（与 movie 筛选排序弹窗同交互风格：按钮组实时生效） */
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created', label: '创建时间最新优先' },
  { key: 'title', label: '标题' },
  { key: 'domain', label: '域名' },
];

/**
 * 右键菜单「点外关闭」手势标记（审查阻断 A）：
 * 菜单开着时点卡片 = 关闭菜单的手势，该次点击不得顺带直开链接。
 * 时序：item-actions 的 document 捕获层会在同一 mousedown 里先关菜单（onMouseDownCapture → closeItemMenu），
 * 卡片 click handler（冒泡阶段）再查 `.bz-item-menu` 已是 disconnected——因此必须在 **window 捕获层**
 * （早于 document 捕获）观测「按下时菜单还开着」，记下标记供随后的 click 消费。
 */
let menuDismissPending = false;
let menuWatcherInstalled = false;
function installMenuDismissWatcher(): void {
  if (menuWatcherInstalled) return;
  menuWatcherInstalled = true;
  window.addEventListener(
    'mousedown',
    () => {
      menuDismissPending = !!document.querySelector('.bz-item-menu')?.isConnected;
    },
    true
  );
}

/**
 * 收藏本设置 schema（ticket 131 声明式；空态域唯一内容为通用「移动端」组）。
 * 移动端全屏文案：原符号文案「移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）」按
 * ticket 100 收敛为多数派逐字文案（与域组 A belongings 同口径，settings-copy-lint-a 白名单注释）。
 */
export function favoritesSettingsSchema(): SettingsSchema {
  return { groups: [mobileFullscreenGroup('favoritesMobileDefaultFullscreen', { desc: '' })] };
}

export class UIManager {
  dataManager: DataManager;
  aiService: FavoritesAIService;
  balanceService = new BalanceService();
  onRefresh: ((items: FavoritesItem[]) => void) | null;

  currentItems: FavoritesItem[] = [];
  selectedTag: string | null = null;    // null = 全部
  searchKeyword = '';
  isVisible = false;
  searchVisible = false;                // 搜索框是否可见
  editingItemId: string | null = null;  // 正在编辑的条目ID
  _sheetEditPending = false;            // 本次编辑弹窗来自抽屉（保存后需关抽屉，用户拍板 Q8）

  // DOM 引用
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  container: HTMLElement | null = null;
  tagContainer: HTMLElement | null = null;
  searchWrapper: HTMLElement | null = null;
  searchInput: HTMLInputElement | null = null;
  searchToggleBtn: HTMLButtonElement | null = null;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null = null; // 搜索防抖（ticket 42）

  // 分页（ticket 141）：已渲染条数 / 滚动加载防重入 / 本次渲染的筛选+排序结果
  loadedCount = 0;
  isLoadingMore = false;
  _filteredItems: FavoritesItem[] = [];

  // 排序弹窗（ticket 141）与 ESC 层
  _sortMask: HTMLElement | null = null;
  _sortEscHandle: { unregister: () => void } | null = null;

  // 添加弹窗打开时的输入基线（ticket 141 通病 3 脏表单检测：相对基线有变化才拦）
  _addBaseline: { title: string; url: string; desc: string; keys: string; balanceUrl: string } | null = null;

  // 保存防重入（ticket 141 通病 4）
  _saving = false;

  // 添加对话框 DOM
  addMask: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  addTypeContainer: HTMLElement | null = null;
  addTitleInput: HTMLInputElement | null = null;
  addUrlInput: HTMLInputElement | null = null;
  addDescInput: HTMLTextAreaElement | null = null;
  addAiBtn: HTMLButtonElement | null = null;
  addSaveBtn: HTMLButtonElement | null = null;
  addCancelBtn: HTMLButtonElement | null = null;
  addPinBtn: HTMLButtonElement | null = null;
  llmConfigSection: HTMLElement | null = null;
  llmApiKeysInput: HTMLTextAreaElement | null = null;
  llmBalanceUrlInput: HTMLInputElement | null = null;

  // ESC 处理器引用
  _escHandle: { unregister: () => void } | null = null;

  constructor(dataManager: DataManager, aiService: FavoritesAIService, onRefresh: ((items: FavoritesItem[]) => void) | null) {
    this.dataManager = dataManager;
    this.aiService = aiService;
    this.onRefresh = onRefresh;
  }

  // ---------- 排序键读写（ticket 141） ----------
  /**
   * 当前排序键：读 data.json favoritesSortKey（ticket 141 加法扩展，经 settings-provider 持久化）。
   * 偏离说明：任务原案为 favorites.json 顶层加 sortKey 字段——favorites.json 顶层是纯条目数组，
   * 顶层加字段需改根结构为对象，会破坏仍在用的外部统计脚本 主页.js（读 favorites.length）并违背
   * 「既有结构不改」铁律；故按 memoSortMode/movieDefaultSort 同惯例落设置键，非法值/无字段回退默认。
   */
  get sortKey(): SortKey {
    const v = (tryGetSettings() as any).favoritesSortKey;
    return (SORT_KEYS as readonly string[]).includes(v) ? (v as SortKey) : 'created';
  }

  /** 写排序键（内存对象直改 + saveSettings 落 data.json；设置未注入时静默降级为会话内生效） */
  _setSortKey(key: SortKey): void {
    try {
      (getSettings() as any).favoritesSortKey = key;
    } catch {
      /* 设置提供者未注入（早期调用）：仅本次会话内存生效 */
    }
    void saveSettings();
  }

  // ---------- 构建主 UI ----------
  build() {
    // 右键菜单点外关闭手势观察（审查阻断 A）：幂等安装
    installMenuDismissWatcher();
    // 移动端列表样式：平铺 + 隐藏滚动条
    // （遮罩/面板视觉样式已收敛 src/favorites/styles.css ticket 141；display 显隐与动态 z 留运行时）
    this.mask = document.createElement('div');
    this.mask.id = 'fav-mask';
    this.mask.style.zIndex = String(allocZ()); // ADR-0067：创建即发号（显示时 topifyZ 再抬）
    this.mask.onclick = (e) => {
      if (e.target === this.mask) this.hide();
    };

    // 弹出面板
    this.popup = document.createElement('div');
    this.popup.id = 'fav-popup';

    // 标题栏（含搜索切换按钮）
    this.popup.appendChild(this._buildHeader());

    // 标签栏
    this.tagContainer = this._buildTagBar();
    this.popup.appendChild(this.tagContainer);

    // 搜索框（默认隐藏）
    this.searchWrapper = this._buildSearch();
    this.searchWrapper.style.display = 'none';
    this.popup.appendChild(this.searchWrapper);

    // 列表容器
    this.container = document.createElement('div');
    this.container.id = 'fav-entries-container';
    this.popup.appendChild(this.container);

    this.mask.appendChild(this.popup);
    document.body.appendChild(this.mask);

    // 无限滚动（ticket 141 分页：滚动到底自动加载下一页）
    this._setupInfiniteScroll();

    // 构建添加对话框（独立）
    this._buildAddDialog();
  }

  _buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'fav-header';

    const title = document.createElement('h3');
    title.textContent = '收藏本';
    header.appendChild(title);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'bz-fav-head-actions';

    // 添加按钮（✏️）
    const addBtn = this._createButton('✏️', '添加收藏', () => this._showAddDialog());
    actionGroup.appendChild(addBtn);

    // 搜索切换按钮（🔍）
    this.searchToggleBtn = this._createButton('🔍', '搜索', () => {
      this.searchVisible = !this.searchVisible;
      this.searchWrapper!.style.display = this.searchVisible ? 'block' : 'none';
      if (this.searchVisible) {
        this.searchInput!.focus();
      }
      // 显隐态视觉走类（ticket 141 样式收敛：原内联 opacity）
      this.searchToggleBtn!.classList.toggle('bz-fav-search-toggle--on', this.searchVisible);
    });
    this.searchToggleBtn.classList.add('bz-fav-search-toggle');
    actionGroup.appendChild(this.searchToggleBtn);

    // 排序弹窗（ticket 141：与 movie 筛选排序弹窗同交互风格，🔀 只做排序非设置）
    const sortBtn = this._createButton('🔀', '排序', () => this._openSortModal());
    actionGroup.appendChild(sortBtn);

    // 设置弹窗（ADR-0009：收藏本无行为设置，空态域；ticket 131 声明式——分组卡片 + maxWidth 520）
    const settingsBtn = this._createButton('⚙️', '收藏本设置', () => {
      openSettingsModal({
        title: '收藏本设置',
        maxWidth: 520, // 拍板 Q11：空态域统一分组卡片口径，宽度向 520 看齐（与归物本一致）
        schema: favoritesSettingsSchema(),
        emptyText: '收藏本没有可配置的设置项',
        emptyDesc: '数据文件路径由全局设置「数据存储路径」统一管理',
      });
    });

    // ⚙️ 设置置于关闭正前（用户拍板：所有窗口设置按钮都在关闭前）
    actionGroup.appendChild(settingsBtn);

    // 关闭按钮（❌）
    const closeBtn = this._createButton('❌', '关闭', () => this.hide());
    actionGroup.appendChild(closeBtn);

    header.appendChild(actionGroup);
    return header;
  }

  _createButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
    return createIconBtn(text, title, onClick);
  }

  // ---------- 标签栏（无"全部"按钮） ----------
  _buildTagBar(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'fav-tagbar';
    // 类型多行平铺：移动端由 styles.css .fav-tagbar 覆写（常规卡窄幅也全部可见，不藏类型）

    for (const { tag, emoji } of CONFIG.DEFAULT_TAGS) {
      const btn = document.createElement('button');
      btn.textContent = `${emoji} ${tag}`;
      btn.className = 'fav-tag-btn';
      btn.dataset.tag = tag;
      btn.onclick = () => {
        this.selectedTag = this.selectedTag === tag ? null : tag;
        this.loadedCount = 0; // 筛选变化重置分页（ticket 141）
        this._refreshTagsUI();
        this.render();
      };
      container.appendChild(btn);
    }
    return container;
  }

  _refreshTagsUI() {
    const btns = this.tagContainer!.querySelectorAll('.fav-tag-btn');
    btns.forEach((btn) => {
      const el = btn as HTMLElement;
      // 选中态视觉走类（ticket 141 样式收敛：原内联 background/color）
      el.classList.toggle('bz-fav-tag-btn--active', this.selectedTag === el.dataset.tag);
    });
    this._updateTagCounts();
  }

  _updateTagCounts() {
    const btns = this.tagContainer!.querySelectorAll('.fav-tag-btn');
    btns.forEach((btn) => {
      const el = btn as HTMLElement;
      const tag = el.dataset.tag!;
      const emoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === tag)?.emoji || '📌';
      // 选中分类后，选中项只显示标签名；其余（含未选中任何分类时）显示标签名+计数
      if (this.selectedTag && tag === this.selectedTag) {
        el.innerHTML = `${emoji} ${tag}`;
      } else {
        const count = this.currentItems.filter((item) => item.tags && item.tags.includes(tag)).length;
        el.innerHTML = `${emoji} ${tag} <span class="bz-fav-tag-count">(${count})</span>`;
      }
    });
  }

  // ---------- 搜索框 ----------
  _buildSearch(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'bz-fav-search-wrapper';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '🔍 搜索收藏（标题/简介/标签）...';
    this.searchInput.className = 'bz-fav-search-input';
    this.searchInput.oninput = () => {
      this.searchKeyword = this.searchInput!.value;
      this.loadedCount = 0; // 搜索词变化重置分页（ticket 141）
      // 搜索防抖（ticket 42）：关键词即时记录，渲染延迟到输入静置 180ms 后，防高频输入卡顿
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        this.render();
      }, SEARCH_DEBOUNCE_MS);
    };

    wrapper.appendChild(this.searchInput);
    return wrapper;
  }

  // ---------- 渲染卡片 ----------
  render() {
    if (!this.container) return;

    let filtered = this.currentItems;

    if (this.selectedTag) {
      filtered = filtered.filter((item) => item.tags && item.tags.includes(this.selectedTag!));
    }

    const kw = this.searchKeyword.trim();
    if (kw) {
      const lower = kw.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(lower)) ||
          (item.description && item.description.toLowerCase().includes(lower)) ||
          (item.tags && item.tags.some((t) => t.toLowerCase().includes(lower)))
      );
    }

    // 排序（ticket 141）：置顶优先于排序（保持现状语义），再按排序键排列
    const sk = this.sortKey;
    const domainOf = (item: FavoritesItem): string => {
      const u = (item.url || '').trim();
      return u ? this._hostOf(this._normalizeUrl(u)).toLowerCase() : '';
    };
    filtered = [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sk === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sk === 'domain') return domainOf(a).localeCompare(domainOf(b));
      return (b.created || '').localeCompare(a.created || ''); // created：最新优先（现状默认）
    });
    this._filteredItems = filtered;

    this.container.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-fav-empty';
      if (kw) {
        // 搜索无结果（ticket 141）：与空库欢迎语区分
        empty.textContent = `没有匹配「${kw}」的收藏`;
        const hint = document.createElement('div');
        hint.className = 'bz-fav-empty-hint';
        hint.textContent = '试试其他关键词，或清除搜索';
        empty.appendChild(hint);
      } else {
        // 空库首步引导（ticket l6-fav 解冻）：正文无 emoji，图标可提及（✏️ = 头部添加按钮）
        const emptyMain = document.createElement('div');
        emptyMain.textContent = '暂无收藏 🎉';
        empty.appendChild(emptyMain);
        const emptyHint = document.createElement('div');
        emptyHint.className = 'bz-fav-empty-hint';
        emptyHint.textContent = '点右上角 ✏️ 添加第一个收藏';
        empty.appendChild(emptyHint);
      }
      this.container.appendChild(empty);
      return;
    }

    // 分页（ticket 141）：每页 50 条，滚动到底自动加载（movie 域同款）
    if (this.loadedCount === 0) this.loadedCount = Math.min(PAGE_SIZE, filtered.length);
    const showCount = Math.min(this.loadedCount, filtered.length);

    for (const item of filtered.slice(0, showCount)) {
      this.container.appendChild(this._renderCard(item));
    }

    if (showCount < filtered.length) {
      const loadMore = document.createElement('div');
      loadMore.className = 'bz-fav-load-more';
      loadMore.textContent = '滚动加载更多...';
      this.container.appendChild(loadMore);
    }
  }

  /** 无限滚动（ticket 141，movie 域同款）：容器滚动近底部自动追加下一页 */
  _setupInfiniteScroll(): void {
    const container = this.container!;
    const oldListener = (container as any)._bzFavScrollListener;
    if (oldListener) container.removeEventListener('scroll', oldListener);
    const listener = () => {
      if (this.isLoadingMore) return;
      if (this.loadedCount >= this._filteredItems.length) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
        this.isLoadingMore = true;
        this.loadedCount = Math.min(this.loadedCount + PAGE_SIZE, this._filteredItems.length);
        this.render();
        this.isLoadingMore = false;
      }
    };
    (container as any)._bzFavScrollListener = listener;
    container.addEventListener('scroll', listener);
  }

  _renderCard(item: FavoritesItem): HTMLElement {
    const card = document.createElement('div');
    const rawUrl = (item.url || '').trim();
    card.className = 'fav-card' + (item.pinned ? ' bz-fav-card--pinned' : '') + (rawUrl ? ' bz-fav-card--link' : '');
    // 卡片视觉样式收敛 styles.css（ticket 141）：有链接 = 可见的点击入口（ticket 61，bz-fav-card--link cursor）

    // ---- 打开可见入口（ticket 61·拍板）----
    // 单击卡片主体（含标题/简介/元信息区）直接打开链接；长按/右键抽屉保持不变。
    // 与旧「标题纯文本、列表干净」拍板相悖——用户已重新拍板要可见入口（冲突记录见提交说明）。
    // 防手势冲突（审查修复）：① 长按松手的残余/合成 click 由 item-actions 捕获层吞掉，不走到这里；
    // ② 文本选中中不直开（允许复制标题，审查建议 B）；③ 右键菜单开着时点卡片 = 关菜单，不直开（阻断 A）；
    // ④ 双击窗口（300ms）内同卡重复点击不重开，防双击连开两个标签页。
    if (rawUrl) {
      let lastOpenAt = 0;
      card.addEventListener('click', () => {
        if (window.getSelection()?.toString()) return; // 选字/复制场景不直开（审查建议 B）
        if (menuDismissPending) {
          menuDismissPending = false; // 菜单点外关闭手势：消费标记，不直开（审查阻断 A）
          return;
        }
        const now = Date.now();
        if (now - lastOpenAt < OPEN_CLICK_WINDOW_MS) return;
        lastOpenAt = now;
        this._openExternal(this._normalizeUrl(rawUrl));
      });
    }

    // ---- 标题行（标题/链接 + 余额 + 跳转 + 标签） ----
    card.appendChild(this._renderTitleRow(item));

    // ---- 简介（为空则不显示） ----
    if (item.description) {
      const desc = document.createElement('div');
      desc.textContent = item.description;
      desc.className = 'bz-fav-desc';
      card.appendChild(desc);
    }

    // ---- 元信息（日期） ----
    const meta = document.createElement('div');
    meta.className = 'bz-fav-meta';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = item.created || '';
    meta.appendChild(timeSpan);
    card.appendChild(meta);

    // ---- 统一长按抽屉（手势收敛：列表仅保留整卡长按，其余手势全部移除） ----
    let queryingBalance = false; // 刷新余额进行中（小字显示「查询中…」）
    const buildActions = (): ItemAction[] => {
      const acts: ItemAction[] = [];

      // 1. 打开（有链接才显示；小字=域名）
      if (rawUrl) {
        const openUrl = this._normalizeUrl(rawUrl);
        acts.push({
          icon: 'external-link',
          label: '打开',
          sub: this._hostOf(openUrl),
          title: '在浏览器打开',
          onClick: () => this._openExternal(openUrl),
        });
      }

      // 2. 置顶/取消置顶（keepOpen：原地翻转 + 抽屉刷新）
      acts.push({
        icon: item.pinned ? 'pin-off' : 'pin',
        label: item.pinned ? '取消置顶' : '置顶',
        title: '置顶收藏',
        keepOpen: true,
        onClick: () => {
          void (async () => {
            item.pinned = !item.pinned;
            try {
              await this.dataManager.update(item.id, { pinned: item.pinned });
            } catch (e) {
              item.pinned = !item.pinned; // 写盘失败回滚内存翻转，防列表态与数据态漂移
              notifySaveError(e, '置顶收藏');
              return;
            }
            void this.refreshData(); // 列表重排（置顶优先），抽屉保持
            rebuild();
          })();
        },
      });

      // 3. 跳转笔记（有关联笔记才显示；小字=笔记名）
      const note = (item.linkedNote || '').trim();
      if (note) {
        acts.push({
          icon: 'file-text',
          label: '跳转笔记',
          sub: note.split('/').pop() || note,
          title: `跳转到笔记：${note}`,
          onClick: () => {
            const app = getApp();
            const file = app.vault.getAbstractFileByPath(note);
            if (file) {
              app.workspace.openLinkText(note, '', false);
            } else {
              notice(`笔记文件不存在：${note}`);
            }
          },
        });
      }

      // 4. 刷新余额（有大模型配置才显示；keepOpen，小字动态更新）
      if (item.llmConfig && item.llmConfig.apiKeys && item.llmConfig.balanceUrl) {
        acts.push({
          icon: 'refresh-cw',
          label: '刷新余额',
          sub: queryingBalance ? '查询中…' : item.balanceError ? '查询失败' : item.balance || '未查询',
          title: '重新查询大模型余额',
          keepOpen: true,
          onClick: () => {
            void (async () => {
              if (queryingBalance) return;
              queryingBalance = true;
              rebuild();
              try {
                const result = await this.balanceService.fetchBalance(item.llmConfig!);
                item.balance = result.balance;
                item.balanceCacheTime = result.timestamp;
                item.balanceError = null;
                try {
                  await this.dataManager.update(item.id, {
                    balance: result.balance,
                    balanceCacheTime: result.timestamp,
                  });
                } catch (e) {
                  notifySaveError(e, '保存余额'); // 查询成功但写盘失败：人话提示，错误态不误标
                }
              } catch (error: any) {
                item.balanceError = error.message;
              }
              queryingBalance = false;
              void this.refreshData();
              rebuild();
            })();
          },
        });
      }

      // 5. 编辑（keepOpen：编辑弹窗叠在抽屉上；保存成功后关抽屉——用户拍板 Q8）
      acts.push({
        icon: 'pencil',
        label: '编辑',
        title: '编辑收藏',
        keepOpen: true,
        onClick: () => {
          this.editingItemId = item.id;
          this._sheetEditPending = true;
          this._showAddDialog(item);
        },
      });

      // 6. 归档（ADR-0074 纯冷存：confirm 确认后写 archived，条目从界面消失且无 UI 反悔，数据留 favorites.json）
      acts.push({
        icon: 'archive',
        label: '归档',
        title: '归档收藏',
        onClick: () => {
          void openFlowDialog({
            title: '归档确认',
            message: '确定归档收藏 "' + item.title + '" 吗？归档后不在列表显示，数据保留在 favorites.json。',
            actions: [
              { label: '取消', value: 'cancel' },
              { label: '确定', value: 'ok', cta: true },
            ],
          }).then((v) => {
            if (v === 'ok') {
              void (async () => {
                await this._archiveItem(item.id);
                closeItemMenu();
              })();
            }
          });
        },
      });

      // 7. 删除（danger；confirm 确认后删除并关抽屉）
      acts.push({
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        sub: item.created || undefined,
        title: '删除收藏',
        onClick: () => {
          void openFlowDialog({
            title: '删除确认',
            message: '确定删除收藏 "' + item.title + '" 吗？',
            actions: [
              { label: '取消', value: 'cancel' },
              { label: '确定', value: 'ok', cta: true },
            ],
          }).then((v) => {
            if (v === 'ok') {
              void (async () => {
                await this._deleteItem(item.id);
                closeItemMenu();
              })();
            }
          });
        },
      });

      return acts;
    };
    const rebuild = () => refreshItemSheet(buildActions(), this._buildSheetHead(item));
    attachItemActions(card, buildActions(), { sheetHead: this._buildSheetHead(item) });

    return card;
  }

  /** 标题行：标题（纯文本）+ 余额展示 + 类型标签组；打开入口在卡片主体单击（ticket 61，标题不做 <a>） */
  _renderTitleRow(item: FavoritesItem): HTMLElement {
    const titleRow = document.createElement('div');
    titleRow.className = 'bz-fav-title-row';

    // 标题：纯文本（打开入口 = 单击卡片主体直开链接，ticket 61；「打开」仍在抽屉，标题不做 <a> 保持列表干净）
    const titleElement = document.createElement('span');
    titleElement.textContent = item.title || '无标题';
    titleElement.className = 'bz-fav-title';
    titleRow.appendChild(titleElement);

    // ---- 大模型余额显示（紧跟标题后，纯展示；刷新在抽屉「刷新余额」） ----
    if (item.llmConfig && item.llmConfig.apiKeys && item.llmConfig.balanceUrl) {
      titleRow.appendChild(this._renderBalanceSpan(item));
    }

    // 类型标签（选中分类时只显示匹配的，否则显示全部）
    if (item.tags && item.tags.length) {
      const displayTags = this.selectedTag ? item.tags.filter((t) => t === this.selectedTag) : item.tags;
      const tagGroup = document.createElement('div');
      tagGroup.className = 'bz-fav-tag-group';
      for (const tag of displayTags) {
        const tagEmoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === tag)?.emoji || '📌';
        const tagBadge = document.createElement('span');
        tagBadge.textContent = `${tagEmoji} ${tag}`;
        tagBadge.className = 'bz-fav-tag-badge';
        tagGroup.appendChild(tagBadge);
      }
      titleRow.appendChild(tagGroup);
    }
    return titleRow;
  }

  /** 余额 span：按余额档位着色（动态计算留内联，ticket 141 样式收敛仅迁静态部分）；纯展示（刷新走抽屉「刷新余额」，5 分钟缓存） */
  _renderBalanceSpan(item: FavoritesItem): HTMLElement {
    const balanceSpan = document.createElement('span');
    balanceSpan.className = 'bz-fav-balance';

    if (item.balanceError) {
      balanceSpan.textContent = `(❌ ${item.balanceError})`;
      balanceSpan.style.color = 'var(--text-error)';
    } else if (item.balance) {
      const balanceNum = parseFloat(item.balance);
      let color = 'var(--text-success)';
      if (balanceNum < 10) color = 'var(--text-error)';
      else if (balanceNum < 100) color = 'var(--text-warning)';

      balanceSpan.textContent = `(余额: ${item.balance})`;
      balanceSpan.style.color = color;
    } else {
      balanceSpan.textContent = '(查询中...)';
      balanceSpan.style.opacity = '0.6';
    }

    return balanceSpan;
  }

  // ---------- 抽屉辅助 ----------
  /** 链接补协议头（原 <a> 渲染时的规范化逻辑，抽屉「打开」沿用） */
  _normalizeUrl(url: string): string {
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  /** 打开动作小字：域名（去 www；解析失败截断原文） */
  _hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 24);
    }
  }

  /** 外部浏览器打开（app.openUrl 优先，Electron shell 兜底，与备忘录同路径） */
  _openExternal(url: string): void {
    const app = getApp();
    try {
      (app as any).openUrl(url);
    } catch {
      const electron = (window as any).require && (window as any).require('electron');
      if (electron && electron.shell) electron.shell.openExternal(url);
    }
  }

  /**
   * 抽屉头部：分类 emoji + 标题一行，第二行小字 = 置顶标记 + 标签徽章组 + 余额（若有）。
   * 与列表显示一致（网易云式选中信息展示）；置顶条目 📌 前缀。
   */
  _buildSheetHead(item: FavoritesItem): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.className = 'bz-fav-sheet-body';

    // 分类 emoji（第一个标签的 emoji）
    const primaryTag = (item.tags && item.tags[0]) || item.type || '';
    const emoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === primaryTag)?.emoji || '📌';
    const emojiEl = document.createElement('span');
    emojiEl.className = 'bz-fav-sheet-emoji';
    emojiEl.textContent = emoji;
    body.appendChild(emojiEl);

    const info = document.createElement('div');
    info.className = 'bz-fav-sheet-info';

    const title = document.createElement('div');
    title.className = 'bz-fav-sheet-title';
    title.textContent = (item.pinned ? '📌 ' : '') + (item.title || '无标题');
    info.appendChild(title);

    // 第二行小字：标签徽章 + 余额
    const meta = document.createElement('div');
    meta.className = 'bz-fav-sheet-meta';
    for (const tag of item.tags || []) {
      const tagEmoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === tag)?.emoji || '📌';
      const badge = document.createElement('span');
      badge.className = 'bz-fav-sheet-tag';
      badge.textContent = `${tagEmoji} ${tag}`;
      meta.appendChild(badge);
    }
    if (item.llmConfig && item.llmConfig.apiKeys && item.llmConfig.balanceUrl) {
      const bal = document.createElement('span');
      bal.className = 'bz-fav-sheet-balance' + (item.balanceError ? ' bz-fav-sheet-balance--error' : '');
      bal.textContent = item.balanceError ? `余额查询失败` : item.balance ? `余额 ${item.balance}` : '余额未查询';
      meta.appendChild(bal);
    }
    if (meta.children.length) info.appendChild(meta);

    body.appendChild(info);
    head.appendChild(body);
    return head;
  }

  // ---------- 刷新 ----------
  async refreshData() {
    // ticket 140（ADR-0074 纯冷存）：归档条目在唯一装载点排除——主列表/搜索/标签计数/余额批量随之全不含
    this.currentItems = (await this.dataManager.getAll()).filter((item) => !item.archived);
    this.currentItems.sort((a, b) => {
      // 置顶的排在前面
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.created || '').localeCompare(a.created || '');
    });

    // 查询大模型条目的余额
    await this._fetchBalances();

    this.render();
    this._refreshTagsUI();
    if (this.onRefresh) this.onRefresh(this.currentItems);
  }

  // 查询余额并更新
  async _fetchBalances() {
    try {
      const balanceResults = await this.balanceService.fetchAllBalances(this.currentItems);

      // 批量更新，避免多次读写数据库
      const updates: Record<string, { balance: string; balanceCacheTime: number; balanceError?: string | null }> = {};
      let hasUpdates = false;

      for (const item of this.currentItems) {
        if (balanceResults[item.id]) {
          const result = balanceResults[item.id];
          if (result.balance && !result.cached) {
            // 只更新非缓存的结果（P1-36：成功即清错误态，防「余额查询失败」粘滞）
            item.balance = result.balance;
            item.balanceCacheTime = result.timestamp!;
            item.balanceError = null;
            updates[item.id] = {
              balance: result.balance,
              balanceCacheTime: result.timestamp!,
              balanceError: null,
            };
            hasUpdates = true;
          } else if (result.error) {
            item.balanceError = result.error;
          }
        }
      }

      // 一次性更新所有需要更新的数据
      if (hasUpdates) {
        await this._batchUpdate(updates);
      }
    } catch (error) {
      console.error('余额查询失败:', error);
      notify('余额查询失败', { type: 'warning', dedupeKey: 'favorites-balance' });
    }
  }

  // 批量更新数据库（P1-37：写前重读整库比对——读-写窗口内被其他写入者改过，
  // 则基于最新值重新套用本批结果后再写，把丢更新窗口从秒级收窄到毫秒级）
  async _batchUpdate(updates: Record<string, { balance: string; balanceCacheTime: number; balanceError?: string | null }>) {
    const applyBatch = (data: FavoritesItem[]) => {
      let modified = false;
      const next = data.map((item) => {
        if (!updates[item.id]) return item;
        modified = true;
        return { ...item, ...updates[item.id] };
      });
      return modified ? next : null;
    };

    const snapshot = await this.dataManager.read();
    const patched = applyBatch(snapshot);
    if (!patched) return;

    // 写前重读比对：内容变了 → 基于最新值重套本批结果再写
    const latest = await this.dataManager.read();
    const baseline =
      JSON.stringify(snapshot) !== JSON.stringify(latest) ? (applyBatch(latest) ?? latest) : patched;
    await this.dataManager.write(baseline);
  }

  async _deleteItem(id: string) {
    // 删除前取完整条目快照（撤销恢复的数据源；并发下缺失则退化为普通删除提示）
    const item = this.currentItems.find((d) => d.id === id);
    try {
      await this.dataManager.delete(id);
    } catch (e) {
      notifySaveError(e, '删除收藏');
      return;
    }
    // ticket 078（域事件派发）：删除动作观察（删除成功后通知；数据缺失不通知）
    if (item) emitDomainEvent('favorites', { kind: 'delete', title: item.title });
    await this.refreshData();
    if (item) {
      // 撤销删除（ticket 141 通病 1）：删除落地后给反悔窗口，点「撤销」原样插回并刷新
      notifyUndo(`已删除收藏「${item.title}」`, () => {
        void (async () => {
          try {
            await this.dataManager.restoreItem(item);
            await this.refreshData();
          } catch (e) {
            notifySaveError(e, '恢复收藏');
          }
        })();
      });
    } else {
      notice('已删除收藏', 'success');
    }
  }

  async _archiveItem(id: string) {
    const item = this.currentItems.find((d) => d.id === id);
    try {
      await this.dataManager.update(id, { archived: true, archivedAt: moment().format('YYYY-MM-DD HH:mm:ss') });
    } catch (e) {
      notifySaveError(e, '归档收藏');
      return;
    }
    // ticket 140（域事件派发）：归档动作观察（ADR-0074 冷存无查看面，观察流是唯一可读痕迹；数据缺失不通知）
    if (item) emitDomainEvent('favorites', { kind: 'archive', title: item.title });
    await this.refreshData();
    notice('已归档收藏', 'archive');
  }

  // ---------- 显示/隐藏主面板 ----------
  show() {
    if (this.isVisible) return;
    this.isVisible = true;
    this.loadedCount = 0; // 每次打开重置分页（ticket 141）
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.popup, tryGetSettings().favoritesMobileDefaultFullscreen === true);
    topifyZ(this.mask!, this.popup!); // ADR-0067：显示即发号，谁后显示谁在上
    this.mask!.style.display = 'flex';
    this.popup!.style.display = 'flex';
    this._registerEscape();
    void this.refreshData();
  }

  hide() {
    this.isVisible = false;
    if (this._sortMask) this._closeSortModal(); // 主面板关闭时排序弹窗一并收起
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    this._unregisterEscape();
  }

  // ---------- 排序弹窗（ticket 141：🔀 头部入口，movie 筛选排序弹窗同交互风格——按钮组实时生效，点外/❌ 关闭） ----------
  _openSortModal(): void {
    if (this._sortMask) {
      this._closeSortModal();
      return;
    }

    const mask = document.createElement('div');
    mask.className = 'bz-fav-sort-mask';
    mask.style.zIndex = String(allocZ()); // ADR-0067：新建即显示即发号

    const popup = document.createElement('div');
    popup.className = 'bz-fav-sort-popup';

    const head = document.createElement('div');
    head.className = 'bz-fav-sort-head';
    const title = document.createElement('h3');
    title.textContent = '排序';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '❌';
    closeBtn.className = 'bz-win-close bz-fav-sort-close';
    closeBtn.addEventListener('click', () => this._closeSortModal());
    head.appendChild(title);
    head.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'bz-fav-sort-body';
    this._renderSortOptions(body);

    popup.appendChild(head);
    popup.appendChild(body);
    mask.appendChild(popup);
    document.body.appendChild(mask);

    mask.addEventListener('click', (e) => {
      if (e.target === mask) this._closeSortModal();
    });

    this._sortMask = mask;
    this._sortEscHandle = escManager.register('fav-sort', {
      isVisible: () => !!this._sortMask && this._sortMask.isConnected,
      close: () => this._closeSortModal(),
    });
  }

  /** 排序选项按钮组（实时生效：点击即写排序键 + 重排列表；弹窗保持打开同 movie） */
  _renderSortOptions(body: HTMLElement): void {
    body.innerHTML = '';
    const group = document.createElement('div');
    group.className = 'bz-fav-sort-group';
    for (const opt of SORT_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.className = 'bz-fav-sort-option' + (this.sortKey === opt.key ? ' bz-fav-sort-option--active' : '');
      btn.addEventListener('click', () => {
        this._setSortKey(opt.key);
        this.loadedCount = 0; // 排序变化重置分页（ticket 141）
        this.render();
        this._renderSortOptions(body);
      });
      group.appendChild(btn);
    }
    body.appendChild(group);
  }

  _closeSortModal(): void {
    if (this._sortMask) {
      this._sortMask.remove();
      this._sortMask = null;
    }
    if (this._sortEscHandle) {
      this._sortEscHandle.unregister();
      this._sortEscHandle = null;
    }
  }

  // ---------- ESC 管理 ----------
  _registerEscape() {
    this._escHandle = escManager.register('fav', {
      isVisible: () => this.isVisible || !!this.addMask && this.addMask.style.display === 'flex',
      close: () => {
        if (this._sortMask) { this._closeSortModal(); return; } // 排序弹窗还开着（防兜底路径跳过其 ESC 层）
        if (this.addMask && this.addMask.style.display === 'flex') { this._requestCloseAddDialog(); return; }
        if (this.isVisible) this.hide();
      },
    });
  }

  _unregisterEscape() {
    if (this.addMask && this.addMask.style.display === 'flex') return; // 添加窗口还开着，保留 handler
    if (this._escHandle) { this._escHandle.unregister(); this._escHandle = null; }
  }

  // ==================== 添加/编辑对话框 ====================
  _buildAddDialog() {
    // 遮罩（视觉样式收敛 styles.css ticket 141；display 显隐与动态 z 留运行时）
    this.addMask = document.createElement('div');
    this.addMask.id = 'fav-add-mask';
    this.addMask.style.zIndex = String(allocZ()); // ADR-0067：创建即发号
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this._requestCloseAddDialog();
    };

    // 弹窗
    this.addPopup = document.createElement('div');
    this.addPopup.id = 'fav-add-popup';
    this.addPopup.style.zIndex = String(allocZ()); // ADR-0067：创建即发号

    // 标题
    const title = document.createElement('h4');
    title.textContent = '添加收藏';
    this.addPopup.appendChild(title);

    // ---- 标题输入 ----
    this.addTitleInput = document.createElement('input');
    this.addTitleInput.type = 'text';
    this.addTitleInput.placeholder = '标题';
    this.addTitleInput.className = 'bz-fav-input';
    this.addPopup.appendChild(this.addTitleInput);

    // ---- 链接输入 ----
    this.addUrlInput = document.createElement('input');
    this.addUrlInput.type = 'text';
    this.addUrlInput.placeholder = '链接';
    this.addUrlInput.className = 'bz-fav-input';
    this.addPopup.appendChild(this.addUrlInput);

    // ---- 简介输入 ----
    this.addDescInput = document.createElement('textarea');
    this.addDescInput.placeholder = '简介（可选）';
    this.addDescInput.className = 'bz-fav-input bz-fav-input--area';
    this.addPopup.appendChild(this.addDescInput);

    // ---- 类型选择（遍历所有默认标签） ----
    this.addTypeContainer = document.createElement('div');
    this.addTypeContainer.className = 'bz-fav-chip-row';

    for (const { tag, emoji } of CONFIG.DEFAULT_TAGS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-type-btn';
      btn.dataset.tag = tag;
      btn.textContent = `${emoji} ${tag}`;
      btn.onclick = () => {
        // 选中态视觉走 .fav-type-btn.active 类（ticket 141 样式收敛：原内联 background/color）
        btn.classList.toggle('active');
        // 控制大模型配置区域显示
        this._toggleLLMConfigVisibility();
      };
      this.addTypeContainer!.appendChild(btn);
    }
    this.addPopup.appendChild(this.addTypeContainer);

    // ---- 大模型配置区域（默认隐藏） ----
    this.llmConfigSection = this._buildLLMConfigSection();
    this.llmConfigSection.style.display = 'none';
    this.addPopup.appendChild(this.llmConfigSection);

    // ---- 置顶切换（与分类按钮同风格） ----
    const pinRow = document.createElement('div');
    pinRow.className = 'bz-fav-chip-row';

    this.addPinBtn = document.createElement('button');
    this.addPinBtn.type = 'button';
    this.addPinBtn.textContent = '📌 置顶';
    this.addPinBtn.className = 'bz-fav-pin-btn';
    this.addPinBtn.onclick = () => {
      this.addPinBtn!.classList.toggle('active');
    };
    pinRow.appendChild(this.addPinBtn);
    this.addPopup.appendChild(pinRow);

    // ---- 按钮组 ----
    const btnGroup = document.createElement('div');
    btnGroup.className = 'bz-fav-btn-group';

    // AI 推荐按钮
    this.addAiBtn = document.createElement('button');
    this.addAiBtn.textContent = '✨ AI 整理';
    this.addAiBtn.className = 'bz-fav-btn-secondary';
    this.addAiBtn.onclick = () => this._handleAIRecommend();
    btnGroup.appendChild(this.addAiBtn);

    // 取消按钮
    this.addCancelBtn = document.createElement('button');
    this.addCancelBtn.textContent = '取消';
    this.addCancelBtn.className = 'bz-fav-btn-secondary';
    this.addCancelBtn.onclick = () => this._hideAddDialog();
    btnGroup.appendChild(this.addCancelBtn);

    // 确定按钮（文本动态变化）
    this.addSaveBtn = document.createElement('button');
    this.addSaveBtn.textContent = '确定';
    this.addSaveBtn.className = 'bz-fav-btn-primary';
    this.addSaveBtn.onclick = () => this._saveNewItem();
    btnGroup.appendChild(this.addSaveBtn);

    this.addPopup.appendChild(btnGroup);

    this.addMask.appendChild(this.addPopup);
    document.body.appendChild(this.addMask);
  }

  // 构建大模型配置区域
  _buildLLMConfigSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'bz-fav-llm-section';

    const title = document.createElement('div');
    title.textContent = '🧠 大模型配置';
    title.className = 'bz-fav-llm-title';
    section.appendChild(title);

    // API Keys（多行文本框）
    const keysLabel = document.createElement('label');
    keysLabel.textContent = 'API Keys（每行一个，第一个用于余额查询）:';
    keysLabel.className = 'bz-fav-llm-label';
    section.appendChild(keysLabel);

    this.llmApiKeysInput = document.createElement('textarea');
    this.llmApiKeysInput.placeholder = 'sk-key1\nsk-key2\nsk-key3';
    this.llmApiKeysInput.className = 'bz-fav-llm-input bz-fav-llm-input--area';
    section.appendChild(this.llmApiKeysInput);

    // 余额查询URL（完整URL）
    const balanceUrlLabel = document.createElement('label');
    balanceUrlLabel.textContent = '余额查询URL（完整URL）:';
    balanceUrlLabel.className = 'bz-fav-llm-label';
    section.appendChild(balanceUrlLabel);

    this.llmBalanceUrlInput = document.createElement('input');
    this.llmBalanceUrlInput.type = 'text';
    this.llmBalanceUrlInput.placeholder = 'https://api.deepseek.com/user/balance';
    this.llmBalanceUrlInput.className = 'bz-fav-llm-input';
    section.appendChild(this.llmBalanceUrlInput);

    // 提示信息
    const hint = document.createElement('div');
    hint.textContent = '💡 系统会自动从返回对象中查找余额数字';
    hint.className = 'bz-fav-llm-hint';
    section.appendChild(hint);

    return section;
  }

  // 切换大模型配置区域显示
  _toggleLLMConfigVisibility() {
    const activeBtns = this.addTypeContainer!.querySelectorAll('.fav-type-btn.active');
    const selectedTags = Array.from(activeBtns).map((b) => (b as HTMLElement).dataset.tag);
    const isLLMSelected = selectedTags.includes('大模型');

    this.llmConfigSection!.style.display = isLLMSelected ? 'flex' : 'none';
  }

  // 显示对话框，可传入要编辑的项（若传入则为编辑模式）
  _showAddDialog(item: FavoritesItem | null = null) {
    if (!this.addMask) return;
    this._registerEscape(); // 命令直开添加窗口时 handler 可能未注册
    // 来自抽屉的编辑：注册附属浮层，弹窗内点击不误关抽屉
    if (this._sheetEditPending) registerSheetCompanion(this.addMask);

    // 清空输入
    this.addTitleInput!.value = '';
    this.addUrlInput!.value = '';
    this.addDescInput!.value = '';

    // 重置置顶按钮（选中态走 .active 类，ticket 141 样式收敛）
    this.addPinBtn!.classList.remove('active');

    // 重置类型按钮（全部取消选中）
    const btns = this.addTypeContainer!.querySelectorAll('.fav-type-btn');
    btns.forEach((b) => {
      (b as HTMLElement).classList.remove('active');
    });

    if (item) {
      // 编辑模式：填充数据
      this.addTitleInput!.value = item.title || '';
      this.addUrlInput!.value = item.url || '';
      this.addDescInput!.value = item.description || '';
      // 置顶状态
      if (item.pinned) {
        this.addPinBtn!.classList.add('active');
      }
      // 选中条目对应的所有标签
      const tags = item.tags || (item.type ? [item.type] : []);
      if (tags.length) {
        btns.forEach((b) => {
          const el = b as HTMLElement;
          if (el.dataset.tag && tags.includes(el.dataset.tag)) {
            el.classList.add('active');
          }
        });
      }

      // 填充大模型配置（如果有）
      if (item.llmConfig) {
        this.llmApiKeysInput!.value = item.llmConfig.apiKeys || '';
        this.llmBalanceUrlInput!.value = item.llmConfig.balanceUrl || '';
      } else {
        this.llmApiKeysInput!.value = '';
        this.llmBalanceUrlInput!.value = '';
      }

      // 根据标签选择控制大模型配置区域显示
      this._toggleLLMConfigVisibility();

      this.addSaveBtn!.textContent = '更新';
      // 修改弹窗标题
      this.addPopup!.querySelector('h4')!.textContent = '编辑收藏';
    } else {
      this.editingItemId = null; // 确保清除编辑状态
      this.addSaveBtn!.textContent = '确定';
      this.addPopup!.querySelector('h4')!.textContent = '添加收藏';
    }

    // 脏表单检测基线（ticket 141 通病 3）：打开时的输入快照——相对基线有变化才拦关闭
    this._addBaseline = {
      title: this.addTitleInput!.value,
      url: this.addUrlInput!.value,
      desc: this.addDescInput!.value,
      keys: this.llmApiKeysInput!.value,
      balanceUrl: this.llmBalanceUrlInput!.value,
    };
    // 上次保存失败等残留的保存态复位（ticket 141 防假死）
    this.addSaveBtn!.disabled = false;

    topifyZ(this.addMask!, this.addPopup!); // ADR-0067：显示即发号
    this.addMask!.style.display = 'flex';
    this.addPopup!.style.display = 'flex';
    setTimeout(() => this.addUrlInput!.focus(), 100);
  }

  /** 关闭前脏表单拦截（ticket 141 通病 3）：任一输入框相对打开时基线有变化 → confirmDiscard 确认放弃才关；完全未动直接关 */
  _requestCloseAddDialog(): void {
    if (this._addDirty()) {
      confirmDiscard(() => this._hideAddDialog());
      return;
    }
    this._hideAddDialog();
  }

  /** 脏检测：标题/链接/简介/大模型配置任一输入框与基线不一致即为脏 */
  _addDirty(): boolean {
    const b = this._addBaseline;
    if (!b || !this.addMask || this.addMask.style.display !== 'flex') return false;
    return (
      this.addTitleInput!.value !== b.title ||
      this.addUrlInput!.value !== b.url ||
      this.addDescInput!.value !== b.desc ||
      this.llmApiKeysInput!.value !== b.keys ||
      this.llmBalanceUrlInput!.value !== b.balanceUrl
    );
  }

  _hideAddDialog() {
    if (this.addMask) {
      this.addMask.style.display = 'none';
      this.addPopup!.style.display = 'none';
      this.editingItemId = null; // 重置编辑状态
    }
    this._addBaseline = null; // 基线随弹窗关闭失效（ticket 141 通病 3）
    unregisterSheetCompanion(this.addMask!);
    this._sheetEditPending = false;
  }

  async _handleAIRecommend() {
    // ticket 23：守卫真实读取插件 AI 配置（isAvailable 已改为按 core/ai 口径判定，不再恒真）；
    // 未配置直接 warning 拦截，不弹 progress、不进入整理中态
    if (!this.aiService.isAvailable()) {
      notice('AI 服务未配置或不可用', 'warning');
      return;
    }

    const currentTitle = this.addTitleInput!.value.trim();
    const currentUrl = this.addUrlInput!.value.trim();
    const currentDesc = this.addDescInput!.value.trim();
    const activeBtns = this.addTypeContainer!.querySelectorAll('.fav-type-btn.active');
    const currentTags = Array.from(activeBtns).map((b) => (b as HTMLElement).dataset.tag);

    // ======== 修改点：只要有一项非空即可 ========
    if (!currentUrl && !currentTitle && !currentDesc) {
      notice('请至少输入标题、链接或简介中的一项，以便 AI 参考');
      return;
    }

    this.addAiBtn!.textContent = '⏳ AI 整理中...';
    this.addAiBtn!.disabled = true;
    // 动态消息（与影视 AI 荐片同模板：progress 常驻 → 阶段 setMessage → 完成 setType）
    const handle = notify('AI 分析中…', { type: 'progress' });

    // GitHub 仓库链接：先取真实仓库信息（仓库名预填标题，简介翻译与标签选择由下方 AI 一并处理）
    let ghInfo: { title: string; description: string; fetched: boolean } | null = null;
    try {
      ghInfo = await this.aiService.fetchGitHubInfo(currentUrl);
      if (ghInfo.title && !this.addTitleInput!.value.trim()) {
        this.addTitleInput!.value = ghInfo.title;
      }
      if (ghInfo.fetched) {
        handle.setMessage('已获取仓库信息，正在整理…');
      } else {
        handle.setMessage('仓库简介获取失败，按常规整理…');
      }
    } catch (e) {
      ghInfo = null; // 非 GitHub 地址：按常规整理
    }

    const tagList = CONFIG.DEFAULT_TAGS.map((t) => t.tag).join('、');
    const prompt = ghInfo
      ? `你是一个智能收藏整理助手。用户正在添加一条 GitHub 仓库收藏，请根据仓库信息和用户已输入的内容，优化和补全所有字段。

用户当前输入：
- 标题：${this.addTitleInput!.value.trim() || '(空)'}
- 链接：${currentUrl || '(空)'}
- 简介：${currentDesc || '(空)'}
- 已选的标签：${currentTags.length ? currentTags.join('、') : '(未选择)'}

GitHub 仓库信息（来自 GitHub API）：
- 仓库名：${ghInfo.title}
- 仓库简介：${ghInfo.description || '(无简介或获取失败)'}

请执行以下操作：
1. **标题**：如果用户已填写标题则保留不变；否则直接使用仓库名「${ghInfo.title}」，不要修改或另起标题。
2. **链接**：保持 GitHub 仓库链接不变；如果缺少协议头（http:// 或 https://）请自动补全。
3. **简介**：${ghInfo.description
        ? '将上面的仓库简介**忠实翻译成中文**（保持原意，不扩写、不总结、不凑字数；若原简介已是中文则原样保留）。'
        : '仓库无简介或简介获取失败，**简介必须返回空字符串**（严禁编造或自行生成简介）。'}
4. **标签**：从以下固定标签列表中选择最合适的 1-3 个标签（可多选）：${tagList}。该链接是 GitHub 仓库，必须包含 GitHub 标签，再补充最匹配的其他标签。

最终必须以严格合法的 JSON 格式返回，仅包含以下四个字段：
{"title":"仓库名", "url":"优化后的链接", "description":"翻译后的中文简介", "tags":["标签1","标签2"]}

不要返回任何其他文字或解释，只返回 JSON。`
      : `你是一个智能收藏整理助手。用户正在添加一条收藏，请根据用户已输入的信息，全面优化和补全所有字段。

用户当前输入：
- 标题：${currentTitle || '(空)'}
- 链接：${currentUrl || '(空)'}
- 简介：${currentDesc || '(空)'}
- 已选的标签：${currentTags.length ? currentTags.join('、') : '(未选择)'}

请执行以下操作：
1. **标题**：如果用户未填或不够清晰，请根据链接或内容重新生成一个简洁醒目（10字以内）的标题。
2. **链接**：如果链接缺少协议头（http:// 或 https://），请自动补全；如果链接明显错误或缺失，请根据标题进行合理推测（若无法推测则保留原文）。
3. **简介**：重新整理或生成一段 20-50 字的简洁简介，概括该收藏的用途或核心内容。
4. **标签**：从以下固定标签列表中选择最合适的 1-3 个标签（可多选）：${tagList}。如果用户当前选择的标签不合适，请替换为更准确的；若合适则保留原标签。

最终必须以严格合法的 JSON 格式返回，仅包含以下四个字段：
{"title":"优化后的标题", "url":"优化后的链接", "description":"优化后的简介", "tags":["标签1","标签2"]}

不要返回任何其他文字或解释，只返回 JSON。`;

    try {
      const result = await this.aiService.ai!.json(prompt);
      let parsed: any;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error('AI 返回格式异常，无法解析');
      }

      // AI 整理不覆盖手写（ticket 22 + 审查竞态 D）：回填前**重读输入框当前值**——
      // AI 处理期间用户新填/改动的内容同样不被覆盖（快照竞态），仅补全仍为空的字段；
      // GitHub 仓库名预填视为已存在的输入内容，同样不被 AI 覆盖；未知标签的忽略 notice 保留在后文
      if (parsed.title && !this.addTitleInput!.value.trim()) this.addTitleInput!.value = parsed.title;
      if (parsed.url && !this.addUrlInput!.value.trim()) this.addUrlInput!.value = parsed.url;
      if (parsed.description && !this.addDescInput!.value.trim()) this.addDescInput!.value = parsed.description;

      // 处理 AI 推荐的标签（支持 tags 数组和单个 tag 两种格式）
      let recommendedTags = parsed.tags || (parsed.tag ? [parsed.tag] : null);
      // GitHub 仓库链接：确保 GitHub 类型被选中（AI 漏选时兜底）
      if (ghInfo) {
        if (!recommendedTags) recommendedTags = ['GitHub'];
        else if (!recommendedTags.includes('GitHub')) recommendedTags = ['GitHub', ...recommendedTags];
      }
      if (recommendedTags && Array.isArray(recommendedTags)) {
        const btns = this.addTypeContainer!.querySelectorAll('.fav-type-btn');
        // 先全部取消选中（选中态走 .active 类，ticket 141 样式收敛）
        btns.forEach((b) => {
          (b as HTMLElement).classList.remove('active');
        });
        // 选中匹配的标签
        const validTags = CONFIG.DEFAULT_TAGS.map((t) => t.tag);
        const unknownTags: string[] = [];
        recommendedTags.forEach((tag: string) => {
          if (validTags.includes(tag)) {
            btns.forEach((b) => {
              const el = b as HTMLElement;
              if (el.dataset.tag === tag) {
                el.classList.add('active');
              }
            });
          } else {
            unknownTags.push(tag);
          }
        });
        if (unknownTags.length) {
          notice(`AI 整理的标签 "${unknownTags.join('、')}" 不在列表中，已忽略`);
        }
      }

      handle.setType('success');
      handle.setMessage('AI 整理完成');
    } catch (e: any) {
      console.error('AI 整理失败:', e);
      // GitHub 仓库链接且用户未填简介：降级填入仓库简介原文（未翻译），供手动处理
      if (ghInfo && ghInfo.description && !this.addDescInput!.value.trim()) {
        this.addDescInput!.value = ghInfo.description;
      }
      handle.setType('error');
      handle.setMessage('AI 整理失败：' + e.message);
    } finally {
      this.addAiBtn!.textContent = '✨ AI 整理';
      this.addAiBtn!.disabled = false;
    }
  }

  async _saveNewItem() {
    if (this._saving) return; // 防重入（ticket 141 通病 4）：保存进行中忽略再次点击
    const activeBtns = this.addTypeContainer!.querySelectorAll('.fav-type-btn.active');
    if (!activeBtns.length) {
      notice('请至少选择一个分类');
      return;
    }
    const selectedTags = Array.from(activeBtns).map((b) => (b as HTMLElement).dataset.tag);

    const title = this.addTitleInput!.value.trim();
    const url = this.addUrlInput!.value.trim();   // 允许为空
    const description = this.addDescInput!.value.trim();

    if (!title) {
      notice('请输入标题');
      return;
    }
    // 移除了对 url 的非空检查

    // 大模型配置先读出（校验 + 判定本次保存是否触发余额同步查询）
    const apiKeys = this.llmApiKeysInput!.value.trim();
    const balanceUrl = this.llmBalanceUrlInput!.value.trim();
    if (selectedTags.includes('大模型') && !apiKeys) {
      notice('请填写 API Keys');
      return;
    }

    // 保存态（ticket 141 通病 4）：立即禁用确定 + 文案提示，完成或失败都在 finally 恢复。
    // 本次会触发 AI 余额同步查询（大模型 + apiKeys + balanceUrl）时文案区分，提示等待原因。
    this._saving = true;
    const willQueryBalance = selectedTags.includes('大模型') && !!apiKeys && !!balanceUrl;
    this.addSaveBtn!.disabled = true;
    this.addSaveBtn!.textContent = willQueryBalance ? '查询余额中…' : '保存中…';

    try {
      const data: any = {
        type: selectedTags[0],
        url,                       // 可以为空字符串
        title,
        description,
        tags: selectedTags,
        pinned: this.addPinBtn!.classList.contains('active'),
        created: moment().format('YYYY-MM-DD HH:mm:ss'),
      };

      // 如果选中了"大模型"标签，保存大模型配置
      if (selectedTags.includes('大模型')) {
        data.llmConfig = {
          apiKeys,
          balanceUrl: balanceUrl || '',
        };

        // 如果有余额查询URL，立即查询余额
        if (apiKeys && balanceUrl) {
          try {
            const balanceService = new BalanceService();
            const result = await balanceService.fetchBalance(data.llmConfig);
            data.balance = result.balance;
            data.balanceCacheTime = result.timestamp;
          } catch (error: any) {
            console.warn('初始余额查询失败:', error.message);
            // 保存失败状态，但不阻止保存
            data.balanceError = error.message;
            notify('余额查询失败', { type: 'warning', dedupeKey: 'favorites-balance' });
          }
        }
      }

      if (this.editingItemId) {
        const all = await this.dataManager.getAll();
        const old = all.find((d) => d.id === this.editingItemId);
        if (old) {
          data.created = old.created;
          // 保留旧的余额信息（如果配置没变）
          if (
            old.llmConfig && data.llmConfig &&
            old.llmConfig.apiKeys === data.llmConfig.apiKeys &&
            old.llmConfig.balanceUrl === data.llmConfig.balanceUrl
          ) {
            data.balance = old.balance;
            data.balanceCacheTime = old.balanceCacheTime;
          } else if (old.llmConfig && !data.llmConfig) {
            // P1-36：取消「大模型」标签 → 显式清空旧配置与余额状态（防幽灵查询与残留展示）
            data.llmConfig = null;
            data.balance = null;
            data.balanceCacheTime = null;
            data.balanceError = null;
          } else if (old.llmConfig && data.llmConfig) {
            // P1-36：更换 apiKeys/balanceUrl → 旧余额缓存一并失效置空（本次已查到新余额则以新值为准）
            if (data.balance == null) {
              data.balance = null;
              data.balanceCacheTime = null;
            }
            if (!data.balanceError) data.balanceError = null; // 清继承的旧错误态
          }
        }
        await this.dataManager.update(this.editingItemId, data);
        // ticket 078（域事件派发）：编辑动作观察（old vs data 生成 α 变化列表；old 缺失（并发删除）不通知）
        if (old) {
          emitDomainEvent('favorites', { kind: 'edit', title: data.title, changes: favoritesEditChanges(old, data) });
        }
        notice('收藏已更新', 'success');
      } else {
        data.id = Date.now().toString();
        await this.dataManager.add(data);
        // ticket 078（域事件派发）：添加动作观察（用最终落盘的 data 对象）
        emitDomainEvent('favorites', { kind: 'add', item: data });
        notice('收藏已添加', 'success');
      }
      const fromSheet = this._sheetEditPending; // 保存成功后关抽屉（用户拍板 Q8）
      await this.refreshData();
      this._hideAddDialog();
      if (fromSheet) closeItemMenu();
    } catch (e: any) {
      notice('保存失败：' + e.message, 'error');
    } finally {
      // 保存完成/失败都恢复按钮（弹窗已关时仅复位标志，下次 _showAddDialog 会复位文案）
      this._saving = false;
      this.addSaveBtn!.disabled = false;
      this.addSaveBtn!.textContent = this.editingItemId ? '更新' : '确定';
    }
  }

  // ---------- 对外暴露添加方法（供命令调用） ----------
  openAddDialog() {
    this._showAddDialog();
  }
}
