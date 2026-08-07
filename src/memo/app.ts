/**
 * 备忘录主应用（备忘录.js App 逐字移植）
 * 状态、初始化（file-open 提醒 / focus 剪贴板监听）、loadData/refresh。
 */
import { createAI, type AIService } from '../core/ai';
import { getApp } from '../core/app';
import { UIManager, Renderer } from './ui';
import { DataManager, getPlatformName, type MemoSettingsLike } from './data';
import { extractUrlAndDisplay } from '../core/utils';
import { getDueStatus } from './due';
import type { MemoItem } from './types';

export const App = {
  ai: null as AIService | null,
  state: {
    todoItems: [] as MemoItem[],
    filter: null as ((item: MemoItem) => boolean) | null,
    sortByPriority: false,
    showArchived: false,
    remindedFiles: new Set<string>(),
    showFileName: true,
  },
  lastClipboardUrl: null as string | null,
  initialized: false,
  fileOpenRegistered: false,
  focusRegistered: false,
  _fileOpenRef: null as any,
  _focusRef: null as any,

  async init(settings: MemoSettingsLike) {
    const app = getApp();
    DataManager.init(settings);
    this.state.showFileName = settings.showFileName !== false;

    // 插件版：直接创建 AIService（Q3 里 createAI(params) 但构造函数忽略 params）
    this.ai = createAI();

    UIManager.injectStyles();
    UIManager.createMainUI();
    UIManager.createAddDialog();
    UIManager.createConfirmDialog();
    UIManager.registerEscape();

    if (!this.fileOpenRegistered) {
      this.fileOpenRegistered = true;
      this._fileOpenRef = app.workspace.on('file-open', async (file: any) => {
        if (!file) return;
        const path = file.path;
        if (this.state.remindedFiles.has(path)) return;
        const shouldRemind = this.state.todoItems.some(
          (i) =>
            i.notePath === path &&
            i.completed === null &&
            (i.priority === 'important' || (i.due && getDueStatus(i.due) !== 'future'))
        );
        if (shouldRemind) {
          this.state.remindedFiles.add(path);
          UIManager.showMain((item) => item.notePath === path, true);
        }
      });
    }

    if (!this.focusRegistered) {
      this.focusRegistered = true;
      this._focusRef = window.addEventListener('focus', () => {
        this.clipboardFocusHandler();
      });
    }

    await this.loadData();
    this.initialized = true;

    if (settings.autoPopupOnStart !== false) {
      const shouldPopup = this.state.todoItems.some(
        (i) =>
          i.completed === null &&
          (i.priority === 'important' || (i.due && getDueStatus(i.due) !== 'future'))
      );
      if (shouldPopup) {
        setTimeout(() => UIManager.showMain(null, true), 300);
      }
    }

    setTimeout(() => {
      this.clipboardFocusHandler();
    }, 1000);
  },

  async loadData() {
    this.state.todoItems = await DataManager.loadItems();
  },

  async refresh() {
    await this.loadData();
    const container = UIManager.getEntriesContainer();
    if (container) Renderer.render(container, this.state.todoItems, this.state.showArchived);
  },

  clipboardFocusHandler: async function (this: typeof App) {
    // 如果添加对话框已经打开，不再重复触发
    if (UIManager.addMask && UIManager.addMask.style.display === 'block') {
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        const { url } = extractUrlAndDisplay(trimmed);
        // 只有当 URL 存在、匹配平台映射、且与上次处理的 URL 不同时才打开
        if (url && url !== this.lastClipboardUrl) {
          // 检查 URL 是否匹配平台映射（例如知乎、B站等）
          const platform = getPlatformName(url);
          if (platform) {
            this.lastClipboardUrl = url; // 记录当前 URL
            setTimeout(() => UIManager.showAddDialog(null), 1000);
          }
        }
      }
    } catch (e) {
      // 忽略权限错误或读取失败
    }
  },

  /** 插件卸载时清理监听 */
  unload() {
    const app = getApp();
    if (this._fileOpenRef && this.fileOpenRegistered) {
      try {
        app.workspace.offref(this._fileOpenRef);
      } catch (e) { /* 忽略 */ }
      this.fileOpenRegistered = false;
      this._fileOpenRef = null;
    }
    if (this._focusRef && this.focusRegistered) {
      window.removeEventListener('focus', this._focusRef as any);
      this.focusRegistered = false;
      this._focusRef = null;
    }
    // 移除注入 DOM
    const ids = ['todo-mask', 'todo-popup', 'add-todo-mask', 'add-todo-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  },
};
