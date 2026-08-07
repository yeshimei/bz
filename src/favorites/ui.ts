/**
 * 收藏本 UI 管理器（ticket 11）：源码 收藏本.js L237-1423 逐字移植。
 */
import moment from 'moment';
import { notice } from '../core/dom';
import { longPress, createIconBtn } from '../core/dom';
import { confirm } from '../core/confirm';
import { escManager } from '../core/esc-manager';
import { getApp } from '../core/app';
import { CONFIG } from './config';
import { BalanceService, FavoritesAIService } from './ai';
import type { DataManager } from './data';
import type { FavoritesItem } from './types';

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

  // DOM 引用
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  container: HTMLElement | null = null;
  tagContainer: HTMLElement | null = null;
  searchWrapper: HTMLElement | null = null;
  searchInput: HTMLInputElement | null = null;
  searchToggleBtn: HTMLButtonElement | null = null;

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

  // ---------- 构建主 UI ----------
  build() {
    // 遮罩
    this.mask = document.createElement('div');
    this.mask.id = 'fav-mask';
    Object.assign(this.mask.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--background-modifier-cover)',
      zIndex: 9998,
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
    });
    this.mask.onclick = (e) => {
      if (e.target === this.mask) this.hide();
    };

    // 弹出面板
    this.popup = document.createElement('div');
    this.popup.id = 'fav-popup';
    Object.assign(this.popup.style, {
      background: 'var(--background-primary)',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    });
    if (window.innerWidth <= 768) {
      Object.assign(this.popup.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        maxWidth: '100%',
        maxHeight: '100vh',
        height: '100vh',
        borderRadius: '0',
        paddingTop: '24px',
      });
    }

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
    this.container.style.cssText = 'flex:1; overflow-y:auto; padding: 12px 20px 20px 20px;';
    this.popup.appendChild(this.container);

    this.mask.appendChild(this.popup);
    document.body.appendChild(this.mask);

    // 构建添加对话框（独立）
    this._buildAddDialog();
  }

  _buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--background-modifier-border); flex-shrink:0;';

    const title = document.createElement('h3');
    title.textContent = '📌 收藏';
    title.style.cssText = 'margin:0; font-size:18px; font-weight:600; color:var(--text-normal);';
    header.appendChild(title);

    const actionGroup = document.createElement('div');
    actionGroup.style.cssText = 'display:flex; gap:12px; align-items:center;';

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
      this.searchToggleBtn!.textContent = this.searchVisible ? '🔍' : '🔍';
      this.searchToggleBtn!.style.opacity = this.searchVisible ? '1' : '0.5';
    });
    this.searchToggleBtn.style.opacity = '0.5';
    actionGroup.appendChild(this.searchToggleBtn);

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
    const isMobile = window.innerWidth <= 768;
    container.style.cssText = isMobile
      ? 'padding: 8px 20px; display:flex; flex-wrap:nowrap; gap:6px; border-bottom:1px solid var(--background-modifier-border); overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch;'
      : 'padding: 8px 20px; display:flex; flex-wrap:wrap; gap:6px; border-bottom:1px solid var(--background-modifier-border);';

    for (const { tag, emoji } of CONFIG.DEFAULT_TAGS) {
      const btn = document.createElement('button');
      btn.textContent = `${emoji} ${tag}`;
      btn.className = 'fav-tag-btn';
      btn.dataset.tag = tag;
      Object.assign(btn.style, {
        borderRadius: '10px',
        background: 'var(--background-secondary)',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--text-normal)',
        padding: '4px 12px',
        border: 'none',
        boxShadow: 'none',
        transition: 'all 0.2s',
      });
      btn.onclick = () => {
        this.selectedTag = this.selectedTag === tag ? null : tag;
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
      const tag = el.dataset.tag;
      if (this.selectedTag === tag) {
        el.style.background = 'var(--interactive-accent)';
        el.style.color = 'var(--text-on-accent)';
      } else {
        el.style.background = 'var(--background-secondary)';
        el.style.color = 'var(--text-normal)';
      }
    });
    this._updateTagCounts();
  }

  _updateTagCounts() {
    const btns = this.tagContainer!.querySelectorAll('.fav-tag-btn');
    btns.forEach((btn) => {
      const el = btn as HTMLElement;
      const tag = el.dataset.tag!;
      const emoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === tag)?.emoji || '📌';
      // 所有按钮始终可见
      el.style.display = 'inline-flex';
      if (this.selectedTag) {
        // 选中分类后，只显示选中的标签名，其他显示标签名+计数
        if (tag === this.selectedTag) {
          el.innerHTML = `${emoji} ${tag}`;
        } else {
          const count = this.currentItems.filter((item) => item.tags && item.tags.includes(tag)).length;
          el.innerHTML = `${emoji} ${tag} <span style="margin-left:4px;font-size:10px;opacity:0.8;">(${count})</span>`;
        }
      } else {
        const count = this.currentItems.filter((item) => item.tags && item.tags.includes(tag)).length;
        el.innerHTML = `${emoji} ${tag} <span style="margin-left:4px;font-size:10px;opacity:0.8;">(${count})</span>`;
      }
    });
  }

  // ---------- 搜索框 ----------
  _buildSearch(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 8px 20px; flex-shrink:0;';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '🔍 搜索收藏（标题/简介/标签）...';
    Object.assign(this.searchInput.style, {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '14px',
      boxSizing: 'border-box',
      outline: 'none',
    });
    this.searchInput.oninput = () => {
      this.searchKeyword = this.searchInput!.value;
      this.render();
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

    if (this.searchKeyword.trim()) {
      const kw = this.searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(kw)) ||
          (item.description && item.description.toLowerCase().includes(kw)) ||
          (item.tags && item.tags.some((t) => t.toLowerCase().includes(kw)))
      );
    }

    this.container.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '暂无收藏 🎉';
      empty.style.cssText = 'padding:40px; text-align:center; color:var(--text-faint); font-size:16px;';
      this.container.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      this.container.appendChild(this._renderCard(item));
    }
  }

  _renderCard(item: FavoritesItem): HTMLElement {
    const app = getApp();
    const card = document.createElement('div');
    card.className = 'fav-card';
    Object.assign(card.style, {
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid var(--background-modifier-border)',
      borderRadius: '10px',
      background: 'var(--background-primary)',
      cursor: 'default',
      transition: 'background 0.15s',
      position: 'relative',
    });

    // 置顶样式
    if (item.pinned) {
      card.style.background = 'var(--background-modifier-hover)';
      card.style.borderLeft = '3px solid var(--interactive-accent)';
    }

    card.onmouseenter = () => {
      if (!item.pinned) card.style.background = 'var(--background-modifier-hover)';
    };
    card.onmouseleave = () => {
      if (!item.pinned) card.style.background = 'var(--background-primary)';
    };

    // ---- 标题行 ----
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';

    // 标题部分：如果有 url，创建链接；否则只显示文本
    const titleElement = document.createElement('span');
    titleElement.textContent = item.title || '无标题';
    Object.assign(titleElement.style, {
      fontSize: '16px',
      fontWeight: '600',
      color: 'var(--text-normal)',
    });

    let url = item.url ? item.url.trim() : '';
    if (url) {
      // 有链接：转换成链接元素
      const link = document.createElement('a');
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      link.href = url;
      link.target = '_blank';
      link.textContent = item.title || '无标题';
      Object.assign(link.style, {
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-accent)',
        textDecoration: 'none',
        cursor: 'pointer',
      });
      link.onmouseenter = () => (link.style.textDecoration = 'underline');
      link.onmouseleave = () => (link.style.textDecoration = 'none');
      link.onclick = (e) => e.stopPropagation();
      titleRow.appendChild(link);
    } else {
      // 无链接：直接显示文本
      titleRow.appendChild(titleElement);
    }

    // ---- 大模型余额显示（紧跟标题后） ----
    if (item.llmConfig && item.llmConfig.apiKeys && item.llmConfig.balanceUrl) {
      const balanceSpan = document.createElement('span');
      balanceSpan.style.cssText = 'font-size:12px; color:var(--text-muted); margin-left:4px; white-space:nowrap;';

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

      // 点击刷新余额
      balanceSpan.style.cursor = 'pointer';
      balanceSpan.title = '点击刷新余额';
      balanceSpan.onclick = async (e) => {
        e.stopPropagation();
        balanceSpan.textContent = '(刷新中...)';
        balanceSpan.style.opacity = '0.6';
        try {
          const result = await this.balanceService.fetchBalance(item.llmConfig!);
          item.balance = result.balance;
          item.balanceCacheTime = result.timestamp;
          item.balanceError = null;
          await this.dataManager.update(item.id, {
            balance: result.balance,
            balanceCacheTime: result.timestamp,
          });
          this.render();
        } catch (error: any) {
          item.balanceError = error.message;
          this.render();
        }
      };

      titleRow.appendChild(balanceSpan);
    }

    // ---- 添加 📄 跳转按钮（如果存在 linkedNote） ----
    if (item.linkedNote) {
      const jumpIcon = document.createElement('span');
      jumpIcon.textContent = ' 📄';
      jumpIcon.style.cssText = `
            font-size: 16px;
            cursor: pointer;
            color: var(--text-accent);
            margin-left: 4px;
            user-select: none;
        `;
      jumpIcon.title = `跳转到笔记: ${item.linkedNote}`;
      jumpIcon.onclick = (e) => {
        e.stopPropagation();
        const file = app.vault.getAbstractFileByPath(item.linkedNote!);
        if (file) {
          app.workspace.openLinkText(item.linkedNote!, '', false);
        } else {
          notice(`笔记文件不存在: ${item.linkedNote}`);
        }
      };
      titleRow.appendChild(jumpIcon);
    }

    // 类型标签（选中分类时只显示匹配的，否则显示全部）
    if (item.tags && item.tags.length) {
      const displayTags = this.selectedTag ? item.tags.filter((t) => t === this.selectedTag) : item.tags;
      const tagGroup = document.createElement('div');
      tagGroup.style.cssText = 'display:flex; gap:6px; margin-left:auto; flex-shrink:0;';
      for (const tag of displayTags) {
        const tagEmoji = CONFIG.DEFAULT_TAGS.find((t) => t.tag === tag)?.emoji || '📌';
        const tagBadge = document.createElement('span');
        tagBadge.textContent = `${tagEmoji} ${tag}`;
        tagBadge.style.cssText = 'font-size:12px; padding:2px 10px; border-radius:12px; background:var(--background-secondary); color:var(--text-muted); white-space:nowrap; cursor:default;';
        tagGroup.appendChild(tagBadge);
        this._attachLongPressEdit(tagBadge, item);
      }
      titleRow.appendChild(tagGroup);
    }
    card.appendChild(titleRow);

    // ---- 简介（为空则不显示） ----
    if (item.description) {
      const desc = document.createElement('div');
      desc.textContent = item.description;
      desc.style.cssText = 'font-size:14px; color:var(--text-muted); line-height:1.5; margin-bottom:8px; word-break:break-word;';
      card.appendChild(desc);
    }

    // ---- 元信息（日期） ----
    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex; gap:12px; font-size:12px; color:var(--text-faint);';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = item.created || '';
    this._attachLongPressDelete(timeSpan, item);
    meta.appendChild(timeSpan);
    card.appendChild(meta);

    return card;
  }

  // ---------- 长按删除 ----------
  _attachLongPressDelete(element: HTMLElement, item: FavoritesItem) {
    longPress(
      element,
      () => {
        confirm({
          title: '删除确认',
          message: '确定删除收藏 "' + item.title + '" 吗？',
          onConfirm: () => this._deleteItem(item.id),
        });
      },
      CONFIG.LONG_PRESS_DELAY
    );
  }

  // ---------- 长按类型 -> 编辑 ----------
  _attachLongPressEdit(element: HTMLElement, item: FavoritesItem) {
    longPress(element, () => this._editItem(item), CONFIG.LONG_PRESS_DELAY);
  }

  // ---------- 编辑项 ----------
  _editItem(item: FavoritesItem) {
    this.editingItemId = item.id;
    this._showAddDialog(item);
  }

  // ---------- 刷新 ----------
  async refreshData() {
    this.currentItems = await this.dataManager.getAll();
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
      const updates: Record<string, { balance: string; balanceCacheTime: number }> = {};
      let hasUpdates = false;

      for (const item of this.currentItems) {
        if (balanceResults[item.id]) {
          const result = balanceResults[item.id];
          if (result.balance && !result.cached) {
            // 只更新非缓存的结果
            item.balance = result.balance;
            item.balanceCacheTime = result.timestamp!;
            updates[item.id] = {
              balance: result.balance,
              balanceCacheTime: result.timestamp!,
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
    }
  }

  // 批量更新数据库
  async _batchUpdate(updates: Record<string, { balance: string; balanceCacheTime: number }>) {
    const data = await this.dataManager.read();
    let modified = false;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (updates[item.id]) {
        data[i] = { ...item, ...updates[item.id] };
        modified = true;
      }
    }

    if (modified) {
      await this.dataManager.write(data);
    }
  }

  async _deleteItem(id: string) {
    await this.dataManager.delete(id);
    await this.refreshData();
  }

  // ---------- 显示/隐藏主面板 ----------
  show() {
    if (this.isVisible) return;
    this.isVisible = true;
    this.mask!.style.display = 'flex';
    this.popup!.style.display = 'flex';
    this._registerEscape();
    void this.refreshData();
  }

  hide() {
    this.isVisible = false;
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    this._unregisterEscape();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // ---------- ESC 管理 ----------
  _registerEscape() {
    this._escHandle = escManager.register('fav', {
      isVisible: () => this.isVisible || !!this.addMask && this.addMask.style.display === 'flex',
      close: () => {
        if (this.addMask && this.addMask.style.display === 'flex') { this._hideAddDialog(); return; }
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
    // 遮罩
    this.addMask = document.createElement('div');
    this.addMask.id = 'fav-add-mask';
    Object.assign(this.addMask.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 10001,
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
    });
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this._hideAddDialog();
    };

    // 弹窗
    this.addPopup = document.createElement('div');
    this.addPopup.id = 'fav-add-popup';
    Object.assign(this.addPopup.style, {
      background: 'var(--background-primary)',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      padding: '24px',
      maxWidth: '450px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });

    // 标题
    const title = document.createElement('h4');
    title.textContent = '添加收藏';
    title.style.cssText = 'margin:0 0 4px 0; font-size:18px; font-weight:600; color:var(--text-normal);';
    this.addPopup.appendChild(title);

    // ---- 标题输入 ----
    this.addTitleInput = document.createElement('input');
    this.addTitleInput.type = 'text';
    this.addTitleInput.placeholder = '标题';
    Object.assign(this.addTitleInput.style, {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '14px',
      boxSizing: 'border-box',
    });
    this.addPopup.appendChild(this.addTitleInput);

    // ---- 链接输入 ----
    this.addUrlInput = document.createElement('input');
    this.addUrlInput.type = 'text';
    this.addUrlInput.placeholder = '链接';
    Object.assign(this.addUrlInput.style, {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '14px',
      boxSizing: 'border-box',
    });
    this.addPopup.appendChild(this.addUrlInput);

    // ---- 简介输入 ----
    this.addDescInput = document.createElement('textarea');
    this.addDescInput.placeholder = '简介（可选）';
    Object.assign(this.addDescInput.style, {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '14px',
      boxSizing: 'border-box',
      resize: 'vertical',
      minHeight: '60px',
      fontFamily: 'inherit',
    });
    this.addPopup.appendChild(this.addDescInput);

    // ---- 类型选择（遍历所有默认标签） ----
    this.addTypeContainer = document.createElement('div');
    this.addTypeContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;';

    for (const { tag, emoji } of CONFIG.DEFAULT_TAGS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-type-btn';
      btn.dataset.tag = tag;
      btn.textContent = `${emoji} ${tag}`;
      Object.assign(btn.style, {
        padding: '6px 14px',
        borderRadius: '20px',
        background: 'var(--background-secondary)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '14px',
        border: 'none',
        boxShadow: 'none',
        transition: 'all 0.2s',
      });
      btn.onclick = () => {
        const isActive = btn.classList.contains('active');
        if (isActive) {
          btn.style.background = 'var(--background-secondary)';
          btn.style.color = 'var(--text-muted)';
          btn.classList.remove('active');
        } else {
          btn.style.background = 'var(--interactive-accent)';
          btn.style.color = 'var(--text-on-accent)';
          btn.classList.add('active');
        }
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
    pinRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;';

    this.addPinBtn = document.createElement('button');
    this.addPinBtn.type = 'button';
    this.addPinBtn.textContent = '📌 置顶';
    Object.assign(this.addPinBtn.style, {
      padding: '6px 14px',
      borderRadius: '20px',
      background: 'var(--background-secondary)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      fontSize: '14px',
      border: 'none',
      boxShadow: 'none',
      transition: 'all 0.2s',
    });
    this.addPinBtn.onclick = () => {
      const isActive = this.addPinBtn!.classList.contains('active');
      if (isActive) {
        this.addPinBtn!.style.background = 'var(--background-secondary)';
        this.addPinBtn!.style.color = 'var(--text-muted)';
        this.addPinBtn!.classList.remove('active');
      } else {
        this.addPinBtn!.style.background = 'var(--interactive-accent)';
        this.addPinBtn!.style.color = 'var(--text-on-accent)';
        this.addPinBtn!.classList.add('active');
      }
    };
    pinRow.appendChild(this.addPinBtn);
    this.addPopup.appendChild(pinRow);

    // ---- 按钮组 ----
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex; gap:12px; justify-content:flex-end; margin-top:8px;';

    // AI 推荐按钮
    this.addAiBtn = document.createElement('button');
    this.addAiBtn.textContent = '✨ AI 推荐';
    Object.assign(this.addAiBtn.style, {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      background: 'var(--background-secondary)',
      cursor: 'pointer',
      fontSize: '14px',
      color: 'var(--text-normal)',
      boxShadow: 'none',
    });
    this.addAiBtn.onclick = () => this._handleAIRecommend();
    btnGroup.appendChild(this.addAiBtn);

    // 取消按钮
    this.addCancelBtn = document.createElement('button');
    this.addCancelBtn.textContent = '取消';
    Object.assign(this.addCancelBtn.style, {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      background: 'var(--background-secondary)',
      cursor: 'pointer',
      fontSize: '14px',
      color: 'var(--text-normal)',
      boxShadow: 'none',
    });
    this.addCancelBtn.onclick = () => this._hideAddDialog();
    btnGroup.appendChild(this.addCancelBtn);

    // 确定按钮（文本动态变化）
    this.addSaveBtn = document.createElement('button');
    this.addSaveBtn.textContent = '确定';
    Object.assign(this.addSaveBtn.style, {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      background: 'var(--interactive-accent)',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      color: 'var(--text-on-accent)',
      boxShadow: 'none',
    });
    this.addSaveBtn.onclick = () => this._saveNewItem();
    btnGroup.appendChild(this.addSaveBtn);

    this.addPopup.appendChild(btnGroup);

    this.addMask.appendChild(this.addPopup);
    document.body.appendChild(this.addMask);
  }

  // 构建大模型配置区域
  _buildLLMConfigSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
            margin-top: 12px;
            padding: 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            background: var(--background-secondary);
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

    const title = document.createElement('div');
    title.textContent = '🧠 大模型配置';
    title.style.cssText = 'font-size:14px; font-weight:600; color:var(--text-normal); margin-bottom:4px;';
    section.appendChild(title);

    // API Keys（多行文本框）
    const keysLabel = document.createElement('label');
    keysLabel.textContent = 'API Keys（每行一个，第一个用于余额查询）:';
    keysLabel.style.cssText = 'font-size:12px; color:var(--text-muted);';
    section.appendChild(keysLabel);

    this.llmApiKeysInput = document.createElement('textarea');
    this.llmApiKeysInput.placeholder = 'sk-key1\nsk-key2\nsk-key3';
    Object.assign(this.llmApiKeysInput.style, {
      width: '100%',
      padding: '8px',
      borderRadius: '6px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '13px',
      boxSizing: 'border-box',
      minHeight: '60px',
      fontFamily: 'monospace',
      resize: 'vertical',
    });
    section.appendChild(this.llmApiKeysInput);

    // 余额查询URL（完整URL）
    const balanceUrlLabel = document.createElement('label');
    balanceUrlLabel.textContent = '余额查询URL（完整URL）:';
    balanceUrlLabel.style.cssText = 'font-size:12px; color:var(--text-muted);';
    section.appendChild(balanceUrlLabel);

    this.llmBalanceUrlInput = document.createElement('input');
    this.llmBalanceUrlInput.type = 'text';
    this.llmBalanceUrlInput.placeholder = 'https://api.deepseek.com/user/balance';
    Object.assign(this.llmBalanceUrlInput.style, {
      width: '100%',
      padding: '8px',
      borderRadius: '6px',
      border: '1px solid var(--background-modifier-border)',
      background: 'var(--background-primary)',
      color: 'var(--text-normal)',
      fontSize: '13px',
      boxSizing: 'border-box',
    });
    section.appendChild(this.llmBalanceUrlInput);

    // 提示信息
    const hint = document.createElement('div');
    hint.textContent = '💡 系统会自动从返回对象中查找余额数字';
    hint.style.cssText = 'font-size:11px; color:var(--text-faint); margin-top:4px;';
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

    // 清空输入
    this.addTitleInput!.value = '';
    this.addUrlInput!.value = '';
    this.addDescInput!.value = '';

    // 重置置顶按钮
    this.addPinBtn!.classList.remove('active');
    this.addPinBtn!.style.background = 'var(--background-secondary)';
    this.addPinBtn!.style.color = 'var(--text-muted)';

    // 重置类型按钮（全部取消选中）
    const btns = this.addTypeContainer!.querySelectorAll('.fav-type-btn');
    btns.forEach((b) => {
      const el = b as HTMLElement;
      el.style.background = 'var(--background-secondary)';
      el.style.color = 'var(--text-muted)';
      el.classList.remove('active');
    });

    if (item) {
      // 编辑模式：填充数据
      this.addTitleInput!.value = item.title || '';
      this.addUrlInput!.value = item.url || '';
      this.addDescInput!.value = item.description || '';
      // 置顶状态
      if (item.pinned) {
        this.addPinBtn!.classList.add('active');
        this.addPinBtn!.style.background = 'var(--interactive-accent)';
        this.addPinBtn!.style.color = 'var(--text-on-accent)';
      }
      // 选中条目对应的所有标签
      const tags = item.tags || (item.type ? [item.type] : []);
      if (tags.length) {
        btns.forEach((b) => {
          const el = b as HTMLElement;
          if (el.dataset.tag && tags.includes(el.dataset.tag)) {
            el.style.background = 'var(--interactive-accent)';
            el.style.color = 'var(--text-on-accent)';
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

    this.addMask!.style.display = 'flex';
    this.addPopup!.style.display = 'flex';
    setTimeout(() => this.addUrlInput!.focus(), 100);
  }

  _hideAddDialog() {
    if (this.addMask) {
      this.addMask.style.display = 'none';
      this.addPopup!.style.display = 'none';
      this.editingItemId = null; // 重置编辑状态
    }
  }

  async _handleAIRecommend() {
    if (!this.aiService.isAvailable()) {
      notice('⚠️ AI 服务未配置或不可用');
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

    const tagList = CONFIG.DEFAULT_TAGS.map((t) => t.tag).join('、');
    const prompt = `你是一个智能收藏整理助手。用户正在添加一条收藏，请根据用户已输入的信息，全面优化和补全所有字段。

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
      this.addAiBtn!.textContent = '⏳ AI 整理中...';
      this.addAiBtn!.disabled = true;

      const result = await this.aiService.ai!.json(prompt);
      let parsed: any;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error('AI 返回格式异常，无法解析');
      }

      if (parsed.title) this.addTitleInput!.value = parsed.title;
      if (parsed.url) this.addUrlInput!.value = parsed.url;
      if (parsed.description) this.addDescInput!.value = parsed.description;

      // 处理 AI 推荐的标签（支持 tags 数组和单个 tag 两种格式）
      const recommendedTags = parsed.tags || (parsed.tag ? [parsed.tag] : null);
      if (recommendedTags && Array.isArray(recommendedTags)) {
        const btns = this.addTypeContainer!.querySelectorAll('.fav-type-btn');
        // 先全部取消选中
        btns.forEach((b) => {
          const el = b as HTMLElement;
          el.style.background = 'var(--background-secondary)';
          el.style.color = 'var(--text-muted)';
          el.classList.remove('active');
        });
        // 选中匹配的标签
        const validTags = CONFIG.DEFAULT_TAGS.map((t) => t.tag);
        const unknownTags: string[] = [];
        recommendedTags.forEach((tag: string) => {
          if (validTags.includes(tag)) {
            btns.forEach((b) => {
              const el = b as HTMLElement;
              if (el.dataset.tag === tag) {
                el.style.background = 'var(--interactive-accent)';
                el.style.color = 'var(--text-on-accent)';
                el.classList.add('active');
              }
            });
          } else {
            unknownTags.push(tag);
          }
        });
        if (unknownTags.length) {
          notice(`AI 推荐的标签 "${unknownTags.join('、')}" 不在列表中，已忽略`);
        }
      }

      notice('✅ AI 智能整理完成！');
    } catch (e: any) {
      console.error('AI 整理失败:', e);
      notice('AI 整理失败：' + e.message);
    } finally {
      this.addAiBtn!.textContent = '✨ AI 推荐';
      this.addAiBtn!.disabled = false;
    }
  }

  async _saveNewItem() {
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
      const apiKeys = this.llmApiKeysInput!.value.trim();
      const balanceUrl = this.llmBalanceUrlInput!.value.trim();

      // 验证必填项
      if (!apiKeys) {
        notice('请填写API Keys');
        return;
      }

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
        }
      }
    }

    try {
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
          }
        }
        await this.dataManager.update(this.editingItemId, data);
        notice('收藏已更新 ✅');
      } else {
        data.id = Date.now().toString();
        await this.dataManager.add(data);
        notice('收藏已添加 ✅');
      }
      await this.refreshData();
      this._hideAddDialog();
    } catch (e: any) {
      notice('保存失败：' + e.message);
    }
  }

  // ---------- 对外暴露添加方法（供命令调用） ----------
  openAddDialog() {
    this._showAddDialog();
  }
}
