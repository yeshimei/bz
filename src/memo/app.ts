/**
 * 备忘录主应用（备忘录.js App 逐字移植 + 设置开关扩展）
 * 状态、初始化（file-open 提醒 / 启动自动弹出）、loadData/refresh。
 * ticket 59：到期轮询合并入启动自动弹窗（hasPendingUrgent 已覆盖到期条件），剪贴板监听删除。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { UIManager, Renderer } from './ui';
import { DataManager, type BzSettingsLike } from './data';
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
  initialized: false,
  fileOpenRegistered: false,
  _fileOpenRef: null as any,
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

    await this.loadData();
    this.initialized = true;

    // 启动自动弹出：重要/到期条目存在时弹面板（到期提醒合并于此，不再独立轮询）
    if (settings.autoPopupOnStart !== false && hasPendingUrgent(this.state.todoItems)) {
      setTimeout(() => UIManager.showMain(null, true), 300);
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

  async loadData() {
    this.state.todoItems = await DataManager.loadItems();
  },

  async refresh() {
    await this.loadData();
    const container = UIManager.getEntriesContainer();
    if (container) Renderer.render(container, this.state.todoItems, this.state.showArchived);
  },

  /** 插件卸载时清理监听 */
  unload() {
    this.ensureFileOpenListener(false);
    // 移除注入 DOM
    const ids = ['todo-mask', 'todo-popup', 'add-todo-mask', 'add-todo-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  },
};
