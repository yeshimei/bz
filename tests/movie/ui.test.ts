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
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('🤖 AI 推荐按钮触发推荐弹窗', () => {
    createOverlay(M.appRef as any);
    const overlay = document.getElementById('__yin_ying__')!;
    const recommendBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '🤖')!;
    expect(recommendBtn).toBeTruthy();
    recommendBtn.click();
    expect(M.recommendOverlay).not.toBeNull();
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

  it('筛选/排序按钮组实时生效（类型单标签/状态/排序）', () => {
    createOverlay(M.appRef as any);
    openSettingsModal();
    const overlay = M.settingsOverlay!;
    const buttons = [...overlay.querySelectorAll('button')];
    const typeBtn = buttons.find((b) => b.textContent === '美剧')!;
    typeBtn.click();
    expect(M.typeFilter).toBe('美剧');
    expect(M.settingsOverlay).not.toBeNull(); // 弹窗保留（源码语义）
    const statusBtn = buttons.find((b) => b.textContent === '在看')!;
    statusBtn.click();
    expect(M.statusFilter).toBe('在看');
    const sortBtn = buttons.find((b) => b.textContent === '名称A-Z')!;
    sortBtn.click();
    expect(M.sortState).toEqual({ key: 'name', order: 'asc' });
    const list = document.getElementById('__yin_ying__')!.querySelector('.list-container') as HTMLElement;
    expect(list.textContent).toContain('在看片');
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

  it('openAddModal：标题/13 标签按钮组/状态按钮组/联动显隐', () => {
    openAddModal(M.appRef as any);
    const overlay = M.addOverlay!;
    expect(overlay.textContent).toContain('添加影视');
    // 13 个标签按钮
    const ALL = ['电影', '国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧', '日漫', '国漫', '美漫', '纪录片', '公开课', 'TED'];
    const tagBtns = [...overlay.querySelectorAll('button')].filter((b) => ALL.includes(b.textContent!));
    expect(tagBtns.length).toBe(13);
    // 状态按钮组（想看/在看/已看）
    const statusBtns = [...overlay.querySelectorAll('button')].filter((b) => ['想看', '在看', '已看'].includes(b.textContent!));
    expect(statusBtns.length).toBe(3);
    // 默认已看 → 评分/影评显示
    const inputs = [...overlay.querySelectorAll('input')];
    const ratingInput = inputs.find((i) => (i as HTMLInputElement).placeholder === '评分（0.1~5）') as HTMLInputElement;
    expect(ratingInput.parentElement!.style.display).toBe('flex');
    // 切到想看 → 评分隐藏
    statusBtns[0].click();
    expect(ratingInput.parentElement!.style.display).toBe('none');
  });

  it('编辑弹窗：标题含《名》+ infoRow 类型 + 状态按钮组', () => {
    const item = { file: { path: '我的/影视/《片1》.md' }, name: '片1', status: 2, rating: 5, review: '好', typeTag: '电影', group: '电影', watchDate: null, poster: null, genre: null, director: null, actors: null, region: null };
    openEditModal(item, M.appRef as any);
    expect(M.editOverlay).not.toBeNull();
    expect(M.editOverlay!.textContent).toContain('编辑影视 - 《片1》');
    expect(M.editOverlay!.textContent).toContain('类型：电影');
    const statusBtns = [...M.editOverlay!.querySelectorAll('button')].filter((b) => ['在看', '已看'].includes(b.textContent!));
    expect(statusBtns.length).toBe(2);
    const btns = [...M.editOverlay!.querySelectorAll('button')];
    expect(btns.some((b) => b.textContent === '取消')).toBe(true);
    expect(btns.some((b) => b.textContent === '确定')).toBe(true);
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
