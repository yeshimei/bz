/**
 * 收藏本主控制器（ticket 11）：源码 收藏本.js L1426-1499 移植。
 * 插件版：命令已由 main.ts 注册（删除 _registerCommands）；设置经 getSettings()。
 */
import { getSettings } from '../core/settings-provider';
import { getStoragePath } from './config';
import { DataManager } from './data';
import { FavoritesAIService } from './ai';
import { UIManager } from './ui';
import type { FavoritesItem } from './types';

export class FavoritesApp {
  static instance: FavoritesApp | null = null;

  dataManager: DataManager | null = null;
  aiService: FavoritesAIService | null = null;
  uiManager: UIManager | null = null;
  initialized = false;

  static getInstance(): FavoritesApp {
    if (!FavoritesApp.instance) FavoritesApp.instance = new FavoritesApp();
    return FavoritesApp.instance;
  }

  async init() {
    if (this.initialized) return;

    const settings = getSettings();
    // 文件名固定 favorites.json，设置只允许改目录（ADR-0009：storagePath 优先，旧字段兼容兜底）
    const storagePath = getStoragePath(settings?.storagePath || settings?.favoritesStoragePath);

    this.dataManager = new DataManager(storagePath);
    this.aiService = new FavoritesAIService();

    this.uiManager = new UIManager(
      this.dataManager,
      this.aiService,
      (items: FavoritesItem[]) => { /* 可选的刷新回调 */ }
    );
    this.uiManager.build();

    this.initialized = true;
  }

  async openPanel() {
    await this.init();
    if (this.uiManager) {
      this.uiManager.show();
    }
  }

  getUI(): UIManager | null {
    return this.uiManager;
  }
}
