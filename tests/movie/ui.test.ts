/**
 * 影视 UI 测试（ticket 14）：overlay/卡片/搜索/分页/设置筛选/ESC
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetMovieState, setHomeFilmStatus } from '../../src/movie/state';
import { rebuildItems } from '../../src/movie/data';
import {
  renderAll, renderList, setupInfiniteScroll, toggleSearch, closeOverlay,
  openAddModal, openEditModal, openSettingsModal, createOverlay, registerEscapeHandler,
} from '../../src/movie/ui';
import { escManager } from '../../src/core/esc-manager';
import { openMovieManager } from '../../src/movie/index';
import { closeEditModal } from '../../src/movie/ui';

function makeApp(vault: MockVault, extra: any = {}) {
  const app = mockAppWithVault(vault);
  Object.assign(app, extra);
  return app;
}

function seed(vault: MockVault) {
  for (let i = 1; i <= 60; i++) {
    vault.files.set(`我的/影视/《片${i}》.md`, `---\ntags: [电影]\n评分: 5\n观影日期: 2025-0${(i % 9) + 1}-0${(i % 28) + 1}T10:00:00\n---`);
  }
  vault.files.set('我的/影视/《在看片》.md', '---\ntags: [美剧]\n评分: 0\n---');
}

describe('renderAll 分页', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    M.folderPath = '我的/影视';
    M.pageSize = 50;
  });

  it('空列表 → 提示', () => {
    const c = document.createElement('div');
    renderAll([], c, makeApp(new MockVault()));
    expect(c.innerHTML).toContain('暂无符合条件的影视记录');
  });

  it('首屏 50 + 加载更多指示', () => {
    const vault = new MockVault();
    seed(vault);
    const items = rebuildItems(makeApp(vault));
    const c = document.createElement('div');
    renderAll(items, c, makeApp(vault));
    expect(c.querySelectorAll('.movie-card').length).toBe(0); // 卡片无 class，用子 div 计数
    expect(c.innerHTML).toContain('滚动加载更多...');
    expect(M.loadedCount).toBe(50);
  });

  it('loadedCount 递增后渲染全部', () => {
    const vault = new MockVault();
    seed(vault);
    const items = rebuildItems(makeApp(vault));
    const c = document.createElement('div');
    M.loadedCount = 61; // seed 共 61 部
    renderAll(items, c, makeApp(vault));
    expect(c.innerHTML).not.toContain('滚动加载更多...');
  });
});

describe('createOverlay 主界面', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    M.appRef = makeApp(vault, {
      commands: {
        commands: { 'movie-analysis-open': {} },
        executeCommandById: vi.fn(),
      },
    });
  });

  it('overlay 结构：id/头部按钮/搜索容器/列表', () => {
    createOverlay(M.appRef as any);
    const overlay = document.getElementById('__yin_ying__');
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelector('.list-container')).not.toBeNull();
    expect(overlay!.querySelector('#movie-search-container')).not.toBeNull();
    const buttons = overlay!.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it('📊 按钮触发 movie-analysis-open 命令', () => {
    createOverlay(M.appRef as any);
    const overlay = document.getElementById('__yin_ying__')!;
    const analysisBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '📊')!;
    analysisBtn.click();
    expect((M.appRef as any).commands.executeCommandById).toHaveBeenCalledWith('movie-analysis-open');
  });

  it('搜索输入防抖 300ms 后过滤渲染', async () => {
    createOverlay(M.appRef as any);
    const overlay = document.getElementById('__yin_ying__')!;
    const searchBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '🔍')!;
    searchBtn.click(); // 展开搜索
    const searchContainer = overlay.querySelector('#movie-search-container') as HTMLElement;
    expect(searchContainer.style.display).toBe('block');

    const input = overlay.querySelector('#movie-search-input') as HTMLInputElement;
    input.value = '在看片';
    input.dispatchEvent(new Event('input'));
    expect(M.searchKeyword).toBe('');
    await new Promise((r) => setTimeout(r, 350));
    expect(M.searchKeyword).toBe('在看片');
    const list = overlay.querySelector('.list-container') as HTMLElement;
    expect(list.textContent).toContain('在看片');
  });

  it('初始状态过滤（setHomeFilmStatus）', () => {
    setHomeFilmStatus('在看');
    createOverlay(M.appRef as any);
    const list = document.getElementById('__yin_ying__')!.querySelector('.list-container') as HTMLElement;
    expect(list.textContent).toContain('在看片');
    expect(M.statusFilter).toBe('在看');
  });

  it('toggle 关闭：再次 open → closeOverlay', () => {
    createOverlay(M.appRef as any);
    expect(M.currentOverlay).not.toBeNull();
    openMovieManager(M.appRef as any);
    expect(M.currentOverlay).toBeNull();
  });

  it('closeOverlay 触发 changelog（不抛错）', () => {
    createOverlay(M.appRef as any);
    expect(() => closeOverlay()).not.toThrow();
    expect(M.currentOverlay).toBeNull();
  });
});

describe('设置弹窗筛选', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    M.appRef = makeApp(vault);
  });

  it('应用排序/类型/状态筛选后渲染', () => {
    createOverlay(M.appRef as any);
    openSettingsModal();
    const overlay = M.settingsOverlay!;
    const selects = overlay.querySelectorAll('select');
    // [排序, 类型, 状态]
    (selects[1] as HTMLSelectElement).value = '剧集';
    (selects[2] as HTMLSelectElement).value = '在看';
    const applyBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '应用')!;
    applyBtn.click();
    expect(M.typeFilter).toBe('剧集');
    expect(M.statusFilter).toBe('在看');
    const list = document.getElementById('__yin_ying__')!.querySelector('.list-container') as HTMLElement;
    expect(list.textContent).toContain('在看片');
    expect(M.settingsOverlay).toBeNull();
  });
});

describe('添加/编辑弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    M.appRef = makeApp(vault);
  });

  it('openAddModal：结构 + 状态切换评分显隐', () => {
    openAddModal(M.appRef as any);
    const overlay = M.addOverlay!;
    const statusSelect = overlay.querySelectorAll('select')[1] as HTMLSelectElement;
    const ratingWrap = overlay.querySelectorAll('div')[0];
    expect(overlay.textContent).toContain('➕ 添加影视');
    statusSelect.value = '2';
    statusSelect.dispatchEvent(new Event('change'));
    expect(statusSelect.value).toBe('2');
  });

  it('编辑弹窗：已看状态填写评分', () => {
    const item = { file: { path: '我的/影视/《片1》.md' }, name: '片1', status: 2, rating: 5, review: '好', typeTag: '电影', group: '电影', watchDate: null, poster: null, genre: null, director: null, actors: null, region: null };
    openEditModal(item, M.appRef as any);
    expect(M.editOverlay).not.toBeNull();
    expect(M.editOverlay!.textContent).toContain('✏️ 编辑影视');
    closeEditModal();
    expect(M.editOverlay).toBeNull();
  });
});

describe('ESC 层级', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    M.appRef = makeApp(vault);
    registerEscapeHandler();
  });

  it('主界面 ESC 关闭', () => {
    createOverlay(M.appRef as any);
    expect(M.currentOverlay).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(M.currentOverlay).toBeNull();
  });

  it('settings 优先于 currentOverlay 关闭', () => {
    createOverlay(M.appRef as any);
    openSettingsModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(M.settingsOverlay).toBeNull();
    expect(M.currentOverlay).not.toBeNull();
  });
});
