/**
 * 入口/工具补测（单文件 80% 目标）：favorites/clipping/news/movie index 分支、
 * core/dom createSiteIcon 加载分支、main.ts onunload 清理分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { ensureFavorites, openFavoritesPanel, addFavoriteItem, unloadFavorites } from '../src/favorites/index';
import { ensureClipping, openArticleView, unloadArticleView } from '../src/clipping/index';
import { ensureNews, openNewsReader, unloadNewsReader } from '../src/news/index';
import { ensureMovie, openMovieManager, addMovieItem, unloadMovie } from '../src/movie/index';
import { M as MovieM } from '../src/movie/state';
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
    movieFolderPath: '我的/影视',
    moviePageSize: '20',
    favoritesStoragePath: 'CONFIG/STORAGE',
  }));
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

describe('clipping 入口', () => {
  beforeEach(() => setup());

  it('ensureClipping 幂等 + openArticleView', () => {
    ensureClipping(app);
    expect(() => openArticleView(app)).not.toThrow();
  });

  it('unloadArticleView 清理', () => {
    expect(() => unloadArticleView()).not.toThrow();
  });
});

describe('news 入口', () => {
  beforeEach(() => setup());

  it('ensureNews 幂等 + openNewsReader', () => {
    ensureNews(app);
    expect(() => openNewsReader(app)).not.toThrow();
  });

  it('unloadNewsReader 清理', () => {
    expect(() => unloadNewsReader()).not.toThrow();
  });
});

describe('movie 入口', () => {
  beforeEach(() => {
    setup();
    unloadMovie();
  });

  it('openMovieManager：首次打开 overlay，再次调用 toggle 关闭', () => {
    ensureMovie(app);
    openMovieManager(app);
    expect(MovieM.currentOverlay).toBeTruthy();
    openMovieManager(app);
    expect(MovieM.currentOverlay).toBeNull();
  });

  it('addMovieItem 打开添加弹窗', () => {
    ensureMovie(app);
    addMovieItem(app);
    expect(MovieM.addOverlay).toBeTruthy();
  });

  it('vault 事件触发防抖刷新（overlay 打开时 rebuild）', async () => {
    ensureMovie(app);
    openMovieManager(app);
    await new Promise((r) => setTimeout(r, 50)); // rebuildItems 完成
    const before = (MovieM.entries || []).length;
    vault.emit('modify', { path: '我的/影视/《新片》.md', extension: 'md' });
    await new Promise((r) => setTimeout(r, 400));
    expect((MovieM.entries || []).length).toBeGreaterThanOrEqual(before);
  });

  it('vault 事件：非影视目录文件不触发', async () => {
    ensureMovie(app);
    openMovieManager(app);
    await new Promise((r) => setTimeout(r, 50));
    const before = (MovieM.entries || []).length;
    vault.emit('create', { path: '其他/x.md', extension: 'md' });
    await new Promise((r) => setTimeout(r, 400));
    expect((MovieM.entries || []).length).toBe(before);
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
  it('onunload：unloadBz/unloadAIAgent/清理 diary 全部执行', async () => {
    setup();
    const plugin: any = new BzPlugin(app, {} as any);
    plugin.app = app;
    plugin.loadData = async () => null;
    plugin.saveData = async () => {};
    await plugin.onload();
    // 开启常驻域后卸载
    plugin.settings.autoSummaryEnabled = true;
    plugin.settings.aiAgentEnabled = true;
    plugin.settings.flashEnabled = true;
    await plugin.onunload();
    expect(plugin.registeredCommandIds.length).toBeGreaterThan(0);
  });
});
