/**
 * 收藏本主控制器（ticket 11 移植 + ticket 177 重构）
 * 命令经 main.ts 注册；本类为懒加载门面：持有数据管理器 + AI 服务，
 * UI 走 src/favorites/ui.ts 的模块函数（openPanel/openForm）。
 */
import { getSettings } from '../core/settings-provider';
import { getStoragePath } from './config';
import { DataManager } from './data';
import { FavoritesAIService } from './ai';
import { openPanel, openForm, initFavoritesUI } from './ui';

export class FavoritesApp {
  static instance: FavoritesApp | null = null;

  dataManager: DataManager | null = null;
  aiService: FavoritesAIService | null = null;
  initialized = false;

  static getInstance(): FavoritesApp {
    if (!FavoritesApp.instance) FavoritesApp.instance = new FavoritesApp();
    return FavoritesApp.instance;
  }

  async init() {
    if (this.initialized) return;
    const settings = getSettings() as any;
    // 文件名固定 favorites.json，设置只允许改目录（ADR-0009：storagePath 优先，旧字段兼容兜底）
    const storagePath = getStoragePath(settings?.storagePath || settings?.favoritesStoragePath);
    this.dataManager = new DataManager(storagePath);
    this.aiService = new FavoritesAIService();
    this.initialized = true;
  }

  /** 打开收藏面板（toggle 语义在 ui.openPanel 内） */
  async openPanel(app: any) {
    await this.init();
    if (this.dataManager && this.aiService) {
      openPanel(app, this.dataManager, this.aiService);
    }
  }

  /** 直接打开添加弹窗（bz-favorites-add 命令；无需先开面板） */
  openAdd(app: any) {
    if (this.dataManager && this.aiService) {
      initFavoritesUI(app, this.dataManager, this.aiService);
      openForm(null);
    }
  }

  getDataManager(): DataManager | null {
    return this.dataManager;
  }
}
