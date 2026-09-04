/**
 * 备忘录主应用（备忘录.js App 逐字移植 + 设置开关扩展）
 * 状态、初始化、loadData/refresh。
 * ticket 59：到期轮询合并入启动自动弹窗（后随入口改道移除），剪贴板监听删除。
 * 入口改道（memo→todo 接管迁移第 3 项提前实施）：启动自动弹出与 file-open 提醒的
 * 弹窗触发已自本域移除，改由 todo 域提醒后台承担（src/todo/reminder.ts，落点=待办面板）；
 * 本域只剩面板 UI、同源同步与数据读写，不做任何被动弹窗。
 */
import { getApp } from '../core/app';
import { UIManager, Renderer } from './ui';
import { DataManager, type BzSettingsLike } from './data';
import type { MemoItem } from './types';

// ---------- 同源 memo.json 跨域同步（对照 todo T1：todo 面板/后台任务改动 → 已开 memo 面板防抖重读） ----------
let vaultSyncRef: any = null;
let vaultSyncApp: any = null;
let vaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false; // 自己写盘引发的 modify 不重复刷新（写路径已自 refresh）
let origMemoWrite: ((data: any) => Promise<unknown>) | null = null; // 包装前原始 write（卸载还原）

/** 订阅 vault modify：memo.json 变更（todo 面板/后台任务/外部）→ memo 面板开着时防抖重读 */
function subscribeVaultSync(app: any): void {
  if (vaultSyncRef) return;
  // 包装 DataManager.write：memo 自己的写盘置 syncing，modify 事件不再重复刷新（写路径已自 refresh）
  if (!origMemoWrite) {
    origMemoWrite = DataManager.write.bind(DataManager);
    DataManager.write = async (data: any) => {
      syncing = true;
      try {
        return await origMemoWrite!(data);
      } finally {
        syncing = false;
      }
    };
  }
  vaultSyncApp = app;
  vaultSyncRef = app.vault.on('modify', (file: any) => {
    if (syncing) return; // 自己写盘
    // 面板没开不刷（口径同 registerEscape：主面板 display === 'block' 才算开着）
    if (!(UIManager.mask && UIManager.mask.style.display === 'block')) return;
    if (file && file.path !== DataManager.todoFilePath) return; // 只关心 memo.json
    if (vaultSyncTimer !== null) clearTimeout(vaultSyncTimer);
    vaultSyncTimer = setTimeout(() => {
      vaultSyncTimer = null;
      void App.refresh();
    }, 150);
  });
}
function unsubscribeVaultSync(): void {
  if (vaultSyncRef) {
    vaultSyncApp?.vault?.offref?.(vaultSyncRef);
    vaultSyncRef = null;
    vaultSyncApp = null;
  }
  if (vaultSyncTimer !== null) {
    clearTimeout(vaultSyncTimer);
    vaultSyncTimer = null;
  }
  syncing = false;
  // 还原 write 包装（卸载后不再拦截，避免引用的闭包残留）
  if (origMemoWrite) {
    DataManager.write = origMemoWrite;
    origMemoWrite = null;
  }
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
    UIManager.registerEscape();

    subscribeVaultSync(app); // 同源 memo.json 跨域同步（todo 面板/后台任务改动 → 面板开着时重读）

    await this.loadData();
    this.initialized = true;
    // 入口改道：启动自动弹出与 file-open 提醒不再由本域触发（todo/reminder.ts 接管，落点=待办面板）
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
    unsubscribeVaultSync(); // 退订 vault modify + 还原 DataManager.write 包装
    // 移除注入 DOM
    const ids = ['todo-mask', 'todo-popup', 'add-todo-mask', 'add-todo-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  },
};
