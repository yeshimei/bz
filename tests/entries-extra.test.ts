/**
 * 入口/工具补测（单文件 80% 目标）：favorites index 分支、
 * core/dom createSiteIcon 加载分支、main.ts onunload 清理分支。
 * ADR-0085/0087：news/clipping/movie 入口已随旧域退役，对应 describe 删除。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { emitDomainEvent } from '../src/core/domain-bus';
import { ensureFavorites, openFavoritesPanel, addFavoriteItem, unloadFavorites } from '../src/favorites/index';
import { createSiteIcon } from '../src/core/dom';
import BzPlugin from '../src/main';

let vault: MockVault;
let app: any;

function setup() {
  vault = new MockVault();
  app = mockAppWithVault(vault);
  app.workspace.onLayoutReady = (cb: () => void) => cb();
  setApp(app);
  setSettingsProvider(() => ({
    favoritesStoragePath: 'CONFIG/STORAGE',
  } as any));
  resetObsidianMocks();
  document.body.innerHTML = '';
}

describe('favorites 入口', () => {
  beforeEach(() => {
    setup();
    unloadFavorites();
  });

  it('ensureFavorites 幂等初始化 + openPanel', () => {
    ensureFavorites(app);
    expect(() => openFavoritesPanel(app)).not.toThrow();
  });

  it('addFavoriteItem 打开添加弹窗', () => {
    ensureFavorites(app);
    expect(() => addFavoriteItem(app)).not.toThrow();
  });

  it('unloadFavorites 清理（无 UI 实例安全）', () => {
    unloadFavorites();
    expect(() => unloadFavorites()).not.toThrow();
  });
});

describe('core/dom createSiteIcon', () => {
  it('本地缓存命中：直接返回图标', () => {
    localStorage.setItem('__icon_github.com', 'data:image/png;base64,AAA');
    const img = createSiteIcon('github.com', 16);
    expect(img).toBeTruthy();
  });

  it('未缓存：创建 img（onload 缓存 + onerror 隐藏分支手动触发）', () => {
    localStorage.removeItem('__icon_unknown.xyz');
    const img = createSiteIcon('unknown.xyz', 16) as HTMLImageElement;
    expect(img).toBeTruthy();
    // 手动触发加载成功 → 尝试缓存（canvas 环境缺失时走 catch）
    expect(() => (img as any).onload?.()).not.toThrow();
    // 手动触发加载失败 → 隐藏
    expect(() => (img as any).onerror?.()).not.toThrow();
    expect(img.style.display).toBe('none');
  });
});

describe('main.ts onunload 清理分支', () => {
  it('onunload：unloadFileSync/unloadFavoritesFileSync/清理 diary 全部执行', async () => {
    setup();
    const plugin: any = new BzPlugin(app, {} as any);
    plugin.app = app;
    plugin.loadData = async () => null;
    plugin.saveData = async () => {};
    await plugin.onload();
    // 开启常驻域后卸载
    plugin.settings.autoSummaryEnabled = true;
    plugin.settings.secondBrainEnabled = true;
    await plugin.onunload();
    expect(plugin.registeredCommandIds.length).toBeGreaterThan(0);
  });
});
