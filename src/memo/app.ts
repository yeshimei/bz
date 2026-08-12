/**
 * 备忘录主应用（备忘录.js App 逐字移植 + 设置开关扩展）
 * 状态、初始化（file-open 提醒 / focus 剪贴板监听）、到期通知轮询、loadData/refresh。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { UIManager, Renderer } from './ui';
import { DataManager, getPlatformName, type BzSettingsLike } from './data';
import { extractUrlAndDisplay } from '../core/utils';
import { getDueStatus } from './due';
import type { MemoItem } from './types';

/** 是否存在未完成的重要或到期备忘录（启动弹窗 / file-open 提醒共用） */
function hasPendingUrgent(items: MemoItem[], path?: string | null): boolean {
  return items.some(
    (i) =>
      i.completed === null &&
      (!path || i.notePath === path) &&
      (i.priority === 'important' || (i.due && getDueStatus(i.due) !== 'future'))
  );
}

export const App = {
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
  // 到期通知轮询
  dueNotifyTimer: null as ReturnType<typeof setInterval> | null,
  notifiedDue: new Set<string>(),
  // 当前设置快照（行为开关读取）
  settings: {} as BzSettingsLike,

  async init(settings: BzSettingsLike) {
    const app = getApp();
    DataManager.init(settings);
    this.state.showFileName = settings.showFileName !== false;
    this.state.showArchived = settings.memoShowArchivedByDefault === true;
    this.settings = settings;

    UIManager.createMainUI();
    UIManager.createAddDialog();
    UIManager.createConfirmDialog();
    UIManager.registerEscape();

    this.ensureFileOpenListener(settings.openNoteReminder !== false);
    this.ensureClipboardListener(settings.clipboardMonitor !== false);

    await this.loadData();
    this.initialized = true;
    this.startDueNotify(settings);

    if (settings.autoPopupOnStart !== false && hasPendingUrgent(this.state.todoItems)) {
      setTimeout(() => UIManager.showMain(null, true), 300);
    }

    if (settings.clipboardMonitor !== false) {
      setTimeout(() => {
        this.clipboardFocusHandler();
      }, 1000);
    }
  },

  /** file-open 提醒监听：开关式注册/反注册（设置变更重载场景） */
  ensureFileOpenListener(enable: boolean) {
    const app = getApp();
    if (!enable) {
      if (this.fileOpenRegistered && this._fileOpenRef) {
        try {
          app.workspace.offref(this._fileOpenRef);
        } catch (e) { /* 忽略 */ }
        this.fileOpenRegistered = false;
        this._fileOpenRef = null;
      }
      return;
    }
    if (this.fileOpenRegistered) return;
    this.fileOpenRegistered = true;
    this._fileOpenRef = app.workspace.on('file-open', async (file: any) => {
      if (!file) return;
      const path = file.path;
      if (this.state.remindedFiles.has(path)) return;
      if (hasPendingUrgent(this.state.todoItems, path)) {
        this.state.remindedFiles.add(path);
        UIManager.showMain((item) => item.notePath === path, true);
      }
    });
  },

  /** focus 剪贴板监听：开关式注册/反注册 */
  ensureClipboardListener(enable: boolean) {
    if (!enable) {
      if (this.focusRegistered) {
        if (this._focusRef) {
          try {
            window.removeEventListener('focus', this._focusRef as any);
          } catch (e) { /* 忽略 */ }
        }
        this.focusRegistered = false;
        this._focusRef = null;
      }
      return;
    }
    if (this.focusRegistered) return;
    this.focusRegistered = true;
    this._focusRef = window.addEventListener('focus', () => {
      this.clipboardFocusHandler();
    });
  },

  /** 到期通知轮询：到期/逾期待办 Notice 提醒（同一条目同状态仅提醒一次） */
  startDueNotify(settings: BzSettingsLike) {
    this.stopDueNotify();
    if (settings.memoDueNotify === false) return;
    const intervalSec = Math.max(10, parseInt(settings.memoDueCheckInterval || '300', 10) || 300);
    this.dueNotifyTimer = setInterval(() => {
      this.checkDueNotify();
    }, intervalSec * 1000);
  },

  checkDueNotify() {
    for (const item of this.state.todoItems) {
      if (item.completed !== null || !item.due) continue;
      const status = getDueStatus(item.due);
      if (status !== 'overdue' && status !== 'today') continue;
      const key = `${item.id}:${status}`;
      if (this.notifiedDue.has(key)) continue;
      this.notifiedDue.add(key);
      const prefix = status === 'overdue' ? '已过期' : '今日到期';
      notice(`${prefix}：${item.title}`, status === 'overdue' ? 'error' : 'warning');
    }
  },

  stopDueNotify() {
    if (this.dueNotifyTimer) {
      clearInterval(this.dueNotifyTimer);
      this.dueNotifyTimer = null;
    }
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
    this.stopDueNotify();
    this.ensureFileOpenListener(false);
    this.ensureClipboardListener(false);
    // 移除注入 DOM
    const ids = ['todo-mask', 'todo-popup', 'add-todo-mask', 'add-todo-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  },
};
