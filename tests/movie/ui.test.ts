/**
 * 影视 UI 测试（ticket 14）：overlay/卡片/搜索/分页/设置筛选/ESC
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform as MockPlatform } from '../mock-obsidian-entry';
import { M, resetMovieState, setHomeFilmStatus } from '../../src/movie/state';
import { rebuildItems, getDisplayItems } from '../../src/movie/data';
import {
  renderAll, renderList, setupInfiniteScroll, toggleSearch, closeOverlay,
  openAddModal, closeAddModal, openEditModal, openFilterModal, closeFilterModal, createOverlay, registerEscapeHandler,
} from '../../src/movie/ui';
import { escManager } from '../../src/core/esc-manager';
import { openMovieManager, ensureMovie, unloadMovie } from '../../src/movie/index';
import { closeEditModal } from '../../src/movie/ui';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';

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

describe('renderAll 分页', () => {
  it('movieRatingDisplay=number → 已看卡片显示 ⭐数字', () => {
    resetObsidianMocks();
    resetMovieState();
    document.body.innerHTML = '';
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《评分片》.md',
      ['---', 'tags: [电影]', '评分: 4.5', '观影日期: 2025-01-01T10:00:00', '---'].join('\n')
    );
    const app = makeApp(vault);
    M.appRef = app;
    setSettingsProvider(() => ({ movieRatingDisplay: 'number' }) as any);
    rebuildItems(app);
    const container = document.createElement('div');
    renderAll(getDisplayItems(), container, app);
    const overlay = container;
    expect(overlay.textContent).toContain('⭐4.5');
    expect(overlay.textContent).not.toContain('⭐⭐⭐⭐');
    closeOverlay();
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

  it('🤖 AI 荐片：点击发进度通知不弹窗（完成后通知更新成功并自动弹结果）', async () => {
    // 无 AI mock 时点击后仅出现进度通知，不带遮罩弹窗（动态通知模式）
    createOverlay(M.appRef as any);
    const overlay = document.getElementById('__yin_ying__')!;
    const recommendBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '🤖')!;
    expect(recommendBtn).toBeTruthy();
    recommendBtn.click();
    expect(M.recommendOverlay).toBeNull(); // 不立即弹窗
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
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    input.dispatchEvent(new Event('input'));
    expect(M.searchKeyword).toBe('');
    await vi.advanceTimersByTimeAsync(350);
    vi.useRealTimers();
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

  it('closeOverlay 不抛错并关闭', () => {
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
    setSettingsProvider(() => ({ movieFolderPath: '我的/影视', moviePageSize: '20' }) as any);
  });

  it('⚙️ 影视设置弹窗：文件夹/每页 + 默认视图 3 项 + 评分显示', () => {
    createOverlay(M.appRef as any);
    const settingsBtn = [...document.querySelectorAll('#__yin_ying__ button')].find((b) => (b as HTMLElement).title === '影视设置') as HTMLElement;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual([
      '影视文件夹', '每页加载数量',
      '默认视图', '默认排序', '默认类型筛选', '默认状态筛选',
      '显示', '已看卡片评分显示', '海报抓取',
    ]);
    closeFilterModal();
  });

  it('筛选/排序按钮组实时生效（类型单标签/状态/排序）', () => {
    createOverlay(M.appRef as any);
    openFilterModal();
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

  it('openAddModal：标题/13 标签按钮组/状态按钮组/联动显隐；评分为滑块、无日期字段', () => {
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
    // 默认已看 → 评分滑块显示（1~6 · 0.1 步进），无日期输入框
    const ratingSlider = [...overlay.querySelectorAll('input')].find((i) => (i as HTMLInputElement).type === 'range') as HTMLInputElement;
    expect(ratingSlider).not.toBeNull();
    expect(ratingSlider.min).toBe('1');
    expect(ratingSlider.max).toBe('6');
    expect(ratingSlider.step).toBe('0.1');
    expect(ratingSlider.value).toBe('3.5');
    expect(ratingSlider.parentElement!.style.display).toBe('block');
    expect(overlay.querySelector('input[type="datetime-local"]')).toBeNull();
    // 滑块对应分数实时显示（初始 3.5，拖动更新）
    const ratingValueEl = ratingSlider.parentElement!.querySelector('.bz-movie-rating-value') as HTMLElement;
    expect(ratingValueEl.textContent).toBe('3.5');
    ratingSlider.value = '5.2';
    ratingSlider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ratingValueEl.textContent).toBe('5.2');
    // 切到想看 → 评分隐藏
    statusBtns[0].click();
    expect(ratingSlider.parentElement!.style.display).toBe('none');
  });

  it('openAddModal：标题实时检测已存在 → 输入框下方提示', () => {
    openAddModal(M.appRef as any);
    const overlay = M.addOverlay!;
    const nameInput = overlay.querySelector('input[placeholder="名称"]') as HTMLInputElement;
    const hint = nameInput.nextElementSibling as HTMLElement;
    // 初始无输入 → 不提示
    expect(hint.style.display).toBe('none');
    // 输入已存在标题 → 提示
    nameInput.value = '片1';
    nameInput.dispatchEvent(new Event('input'));
    expect(hint.style.display).toBe('block');
    expect(hint.textContent).toContain('「片1」已存在');
    // 改为不存在的标题 → 隐藏
    nameInput.value = '全新片';
    nameInput.dispatchEvent(new Event('input'));
    expect(hint.style.display).toBe('none');
    closeAddModal();
  });

  it('openAddModal：确认创建 → 常驻 progress 通知「正在获取海报和豆瓣信息」→ 海报填充后原地更新已完成', async () => {
    vi.useFakeTimers();
    // workspace 需带 getLeaf（openFile）才能走通创建流程
    const vault = new MockVault();
    seed(vault);
    M.appRef = makeApp(vault, {
      workspace: {
        getActiveViewOfType: () => null,
        openLinkText: async () => {},
        on: () => ({ ref: 'mock-ws-ref' }),
        off: () => {},
        offref: () => {},
        getActiveFile: () => null,
        getLeaf: () => ({ openFile: async () => {} }),
      },
    });
    openAddModal(M.appRef as any);
    const overlay = M.addOverlay!;
    const nameInput = overlay.querySelector('input[placeholder="名称"]') as HTMLInputElement;
    nameInput.value = '新片';
    const ratingSlider = [...overlay.querySelectorAll('input')].find((i) => (i as HTMLInputElement).type === 'range') as HTMLInputElement;
    ratingSlider.value = '4';
    const confirmBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '确定')!;
    confirmBtn.click();
    await vi.advanceTimersByTimeAsync(0);
    // 创建完成 → 弹「正在获取海报和豆瓣信息」progress 通知（常驻转圈）
    const noticeEl = document.querySelector('.bz-notice--progress')!;
    expect(noticeEl).not.toBeNull();
    expect(noticeEl.textContent).toContain('正在获取海报和豆瓣信息');
    // 模拟外部 watcher 写入海报字段 → 原地更新为已完成
    vault.files.set('我的/影视/《新片》.md', '---\ntags: [电影]\n评分: 4\n海报: 我的/影视/海报/新片.png\n---\n');
    await vi.advanceTimersByTimeAsync(2000);
    expect(noticeEl.textContent).toContain('海报和豆瓣信息获取完成');
    expect(noticeEl.classList.contains('bz-notice--success')).toBe(true);
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
    vi.useRealTimers();
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
    openFilterModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(M.settingsOverlay).toBeNull();
    expect(M.currentOverlay).not.toBeNull();
    expect(M.settingsOverlay).toBeNull();
    expect(M.currentOverlay).not.toBeNull();
  });

  it('⚙️ 打开真设置弹窗（影视文件夹/每页加载数量/海报抓取提示）；🔀 为筛选弹窗', () => {
    setSettingsProvider(() => ({ movieFolderPath: '我的/影视', moviePageSize: '20' }) as any);
    createOverlay(M.appRef as any);
    // 🔀 筛选弹窗（原 ⚙️ 语义，ADR-0009）
    const filterBtn = [...document.querySelectorAll('button')].find((b) => b.title === '筛选与排序')!;
    expect(filterBtn.textContent).toBe('🔀');
    filterBtn.click();
    expect(M.settingsOverlay).not.toBeNull();
    closeFilterModal();
    // ⚙️ 真设置弹窗
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => (b as HTMLElement).title === '影视设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('影视设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toContain('影视文件夹');
    expect(names).toContain('每页加载数量');
    expect(names).toContain('海报抓取');
  });
});

describe('抽屉（统一手势组件接入）', () => {
  /** 长按卡片弹抽屉（fake timers 内）+ 消费残余 click */
  function openSheetCard(card: HTMLElement) {
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function setupVault() {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《想看片》.md',
      ['---', 'tags: [电影]', '评分: -1', '---'].join('\n')
    );
    vault.files.set(
      '我的/影视/《在看片》.md',
      ['---', 'tags: [美剧]', '评分: 0', '---'].join('\n')
    );
    vault.files.set(
      '我的/影视/《已看片》.md',
      ['---', 'tags: [电影]', '评分: 4.5', '观影日期: 2025-01-01T10:00:00', '影评: 好片', '导演: 诺兰', '主演: A/B', '类型: 科幻', '豆瓣评分: 8.9', '片长: 148', '---'].join('\n')
    );
    vault.files.set(
      '我的/影视/《已看无评分》.md',
      ['---', 'tags: [电影]', '---'].join('\n')
    );
    return vault;
  }

  /** 在容器中按片名找卡片（卡片无 class，子 div 文本 = 片名） */
  function findCard(container: HTMLElement, name: string): HTMLElement {
    const nameEl = [...container.querySelectorAll('div')].find((d) => d.textContent === name) as HTMLElement;
    return nameEl.parentElement!.parentElement!;
  }

  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    vi.useFakeTimers();
    document.body.innerHTML = '';
    MockPlatform.isMobile = true;
  });

  afterEach(() => {
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('长按想看条目 → 动作（打开/标记在看/删除，无编辑/写影评），无评分影评项；头部名称与徽章', () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '想看片');
    expect(card.classList.contains('bz-item-card')).toBe(true);
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    for (const label of ['打开', '标记在看', '删除']) {
      expect(sheet.textContent).toContain(label);
    }
    expect(sheet.textContent).not.toContain('编辑'); // 编辑动作已移除
    // 评分/影评只在已看显示
    expect(sheet.textContent).not.toContain('标记已看');
    expect(sheet.textContent).not.toContain('评分');
    expect(sheet.textContent).not.toContain('影评');
    // 头部：名称 + 类型徽章 + 想看徽章
    const head = sheet.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(head.textContent).toContain('想看片');
    expect(head.textContent).toContain('电影');
    expect(head.textContent).toContain('想看');
  });

  it('点抽屉「标记在看」→ 只写评分 0（状态字段不存在，状态由评分推断）', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '想看片');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const markBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('标记在看')) as HTMLElement;
    markBtn.click();
    await vi.advanceTimersByTimeAsync(50);
    expect(vault.files.get('我的/影视/《想看片》.md')).toContain('评分: 0');
    expect(vault.files.get('我的/影视/《想看片》.md')).not.toContain('状态');
    expect(hasNotice('已标记在看')).toBe(true);
  });

  it('在看条目点「标记已看」→ 直改标记不弹窗：评分写默认 3.5，抽屉保持并动态刷新为已看动作', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '在看片');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.textContent).toContain('标记已看');
    const markBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('标记已看')) as HTMLElement;
    markBtn.click(); // keepOpen：抽屉不关闭
    await vi.advanceTimersByTimeAsync(50);
    expect(vault.files.get('我的/影视/《在看片》.md')).toContain('评分: 3.5');
    expect(vault.files.get('我的/影视/《在看片》.md')).not.toContain('状态');
    expect(hasNotice('已标记已看')).toBe(true);
    // 抽屉保持打开，动作动态刷新为已看态（改分/写影评），不再有标记已看
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    expect(sheet.textContent).toContain('改分');
    expect(sheet.textContent).toContain('写影评');
    expect(sheet.textContent).not.toContain('标记已看');
    // 头部同步刷新：在看徽章消失，出现评分星星（状态展示区随动作联动）
    const sheetHead = sheet.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(sheetHead.querySelector('.bz-movie-badge--accent')).toBeNull();
    expect(sheetHead.querySelector('.bz-movie-stars')).not.toBeNull();
    expect(sheetHead.textContent).toContain('⭐');
  });

  it('已看条目按有无评分显示「改分」/「评分」；评分窗为滑块+实时数值、无日期输入、无取消', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    // 有评分 → 改分；有影评 → 改影评
    const card1 = findCard(c, '已看片');
    openSheetCard(card1);
    let sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.textContent).toContain('改分');
    expect(sheet.textContent).toContain('改影评');
    expect(sheet.textContent).not.toContain('评分\n'); // 无「评分」标签（仅子串保护）
    // 改分小字 = 当前分数（动态数据，不带星标）
    const rateItem0 = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('改分')) as HTMLElement;
    expect((rateItem0.querySelector('.bz-item-sheet-item-sub') as HTMLElement).textContent).toBe('4.5');
    // 打开评分窗：滑块 + 数值
    const rateBtn = rateItem0;
    rateBtn.click();
    let modal = document.querySelector('.bz-movie-tiny-modal') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('改分');
    const slider = modal.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('6');
    expect(slider.step).toBe('0.1');
    expect(slider.value).toBe('4.5'); // 预填当前评分
    expect(modal.querySelector('input[placeholder="评分（0.1~5）"]')).toBeNull(); // 滑块取代数字输入
    expect(modal.querySelector('input[type="datetime-local"]')).toBeNull(); // 无日期输入
    expect(modal.textContent).toContain('⭐ 4.5');
    const buttons = [...modal.querySelectorAll('button')];
    expect(buttons.length).toBe(1); // 只有确认，无取消
    // 遮罩点击关闭
    (document.querySelector('.bz-movie-tiny-mask') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-movie-tiny-modal')).toBeNull();
    // 无评分 → 评分（无影评 → 写影评）
    document.querySelector('.bz-item-sheet-mask')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
    const card2 = findCard(c, '已看无评分');
    openSheetCard(card2);
    sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.textContent).toContain('评分');
    expect(sheet.textContent).toContain('写影评');
  });

  it('评分窗：拖动滑块 → 确认写评分与日期（改分保留原观影日期）', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '已看片');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const rateBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('改分')) as HTMLElement;
    rateBtn.click();
    const modal = document.querySelector('.bz-movie-tiny-modal') as HTMLElement;
    const slider = modal.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect((modal.querySelector('.bz-movie-rating-value') as HTMLElement).textContent).toBe('⭐ 3.0');
    (modal.querySelector('.bz-movie-tiny-confirm') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const fileContent = vault.files.get('我的/影视/《已看片》.md')!;
    expect(fileContent).toContain('评分: 3');
    expect(fileContent).toContain('观影日期: 2025-01-01'); // 改分保留原观影日期
    expect(hasNotice('已更新影视信息')).toBe(true);
    expect(document.querySelector('.bz-movie-tiny-modal')).toBeNull(); // 确认后关闭
    // 抽屉保持，动作刷新：评分（无评分）→ 改分
    expect(document.querySelector('.bz-item-sheet')!.textContent).toContain('改分');
  });

  it('写评分（无评分已看）：确认写评分 + 默认当年日期', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '已看无评分');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const rateBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('评分')) as HTMLElement;
    rateBtn.click();
    const modal = document.querySelector('.bz-movie-tiny-modal') as HTMLElement;
    expect(modal.textContent).toContain('评分');
    const slider = modal.querySelector('input[type="range"]') as HTMLInputElement;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    (modal.querySelector('.bz-movie-tiny-confirm') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const fileContent = vault.files.get('我的/影视/《已看无评分》.md')!;
    expect(fileContent).not.toContain('状态'); // 状态字段已废除
    expect(fileContent).toContain('评分: 3.5'); // 滑块默认 3.5
    expect(fileContent).toMatch(/观影日期: \d{4}-\d{2}-\d{2}/); // 默认当年日期
  });

  it('影评窗：改影评预填 → 确认写入 frontmatter；空文本删除影评字段', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '已看片');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const reviewBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('改影评')) as HTMLElement;
    reviewBtn.click();
    const modal = document.querySelector('.bz-movie-tiny-modal') as HTMLElement;
    expect(modal.textContent).toContain('改影评');
    const area = modal.querySelector('textarea') as HTMLTextAreaElement;
    expect(area.value).toBe('好片');
    area.value = '二刷更佳';
    (modal.querySelector('.bz-movie-tiny-confirm') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(vault.files.get('我的/影视/《已看片》.md')).toContain('影评: 二刷更佳');
    expect(hasNotice('已保存影评')).toBe(true);
  });

  it('点抽屉「删除」→ 二次确认 → 影视笔记从库删除', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const card = findCard(c, '想看片');
    openSheetCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const delBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('删除')) as HTMLElement;
    delBtn.click();
    const confirmMask = document.getElementById('__shared_confirm_mask__') as HTMLElement;
    expect(confirmMask).not.toBeNull();
    expect(confirmMask.textContent).toContain('想看片');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(vault.files.has('我的/影视/《想看片》.md')).toBe(false);
    expect(hasNotice('影视已删除')).toBe(true);
  });

  it('季集字段已移除：添加弹窗与编辑弹窗均无「季集」输入', () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    openAddModal(app as any);
    expect([...document.querySelectorAll('input')].some((i) => (i as HTMLInputElement).placeholder === '季集（可选）')).toBe(false);
    closeAddModal();
    const item = items.find((i) => i.name === '已看片')!;
    openEditModal(item, app as any);
    expect([...document.querySelectorAll('input')].some((i) => (i as HTMLInputElement).placeholder === '季集（可选）')).toBe(false);
    closeEditModal();
  });

  it('详情：有豆瓣抓取数据才显示并弹窗展示字段；无数据条目不显示', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    // 想看片无详情字段 → 抽屉无「详情」
    openSheetCard(findCard(c, '想看片'));
    let sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.textContent).not.toContain('详情');
    document.querySelector('.bz-item-sheet-mask')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
    // 已看片有导演/主演/豆瓣 → 详情显示并弹窗展示
    openSheetCard(findCard(c, '已看片'));
    sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const detailBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('详情')) as HTMLElement;
    expect(detailBtn).toBeTruthy();
    detailBtn.click();
    const modal = document.querySelector('.bz-movie-tiny-modal') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('《已看片》');
    expect(modal.textContent).toContain('导演');
    expect(modal.textContent).toContain('诺兰');
    expect(modal.textContent).toContain('豆瓣评分');
    expect(modal.textContent).toContain('8.9');
    // 遮罩点击关闭详情窗（抽屉保持）
    (document.querySelector('.bz-movie-tiny-mask') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-movie-tiny-modal')).toBeNull();
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
  });

  it('复制双链：点击后剪贴板写入 [[《片名》]]', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    openSheetCard(findCard(c, '已看片'));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const linkBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('复制双链')) as HTMLElement;
    linkBtn.click();
    await vi.advanceTimersByTimeAsync(50);
    expect(writeSpy).toHaveBeenCalledWith('[[《已看片》]]');
    expect(hasNotice(/已复制双链/)).toBe(true);
  });

  it('找同类：AI 报告窗生成推荐卡（复用「加入想看」）', async () => {
    const vault = setupVault();
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderAll(items, c, app);
    const raw = '[{"title":"星际穿越","year":"2014","type":"电影","director":"诺兰","reason":"同为诺兰科幻杰作"}]';
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }) as any);
    resetAIProviderCache();
    setApp(app as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: JSON.stringify({ choices: [{ message: { content: raw } }] }) });

    openSheetCard(findCard(c, '已看片'));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const simBtn = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) => b.textContent!.includes('找同类')) as HTMLElement;
    simBtn.click();
    await vi.advanceTimersByTimeAsync(50);
    const modal = document.querySelector('.bz-movie-similar-modal') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('找同类 ·《已看片》');
    await vi.advanceTimersByTimeAsync(0);
    const list = modal.querySelector('.bz-movie-similar-list') as HTMLElement;
    expect(list.textContent).toContain('星际穿越');
    expect(list.textContent).toContain('导演：诺兰');
    expect(list.textContent).toContain('💡 同为诺兰科幻杰作');
    expect(list.textContent).toContain('加入想看');
  });
});

describe('ensureMovie 设置读取', () => {
  it('moviePageSize 设置生效（默认 20）', () => {
    unloadMovie();
    resetMovieState();
    setSettingsProvider(() => ({ movieFolderPath: '我的/影视', moviePageSize: '30' }) as any);
    ensureMovie(makeApp(new MockVault()));
    expect(M.pageSize).toBe(30);
  });

  it('moviePageSize 缺省回退默认 20', () => {
    unloadMovie();
    resetMovieState();
    setSettingsProvider(() => ({} as any));
    ensureMovie(makeApp(new MockVault()));
    expect(M.pageSize).toBe(20);
  });

  it('默认视图：movieDefaultSort/TypeFilter/StatusFilter 生效', () => {
    unloadMovie();
    resetMovieState();
    setSettingsProvider(() => ({
      movieFolderPath: '我的/影视',
      movieDefaultSort: 'rating-desc',
      movieDefaultTypeFilter: '美剧',
      movieDefaultStatusFilter: '在看',
    }) as any);
    ensureMovie(makeApp(new MockVault()));
    expect(M.sortState).toEqual({ key: 'rating', order: 'desc' });
    expect(M.typeFilter).toBe('美剧');
    expect(M.statusFilter).toBe('在看');
  });

  it('默认视图缺省回退：date-desc / 全部 / 全部；非法排序忽略', () => {
    unloadMovie();
    resetMovieState();
    setSettingsProvider(() => ({ movieDefaultSort: 'bad-value' }) as any);
    ensureMovie(makeApp(new MockVault()));
    expect(M.sortState).toEqual({ key: 'date', order: 'desc' });
    expect(M.typeFilter).toBe('全部');
    expect(M.statusFilter).toBe('全部');
  });
});

describe('主页影视状态过滤（window.__homeFilmStatus 兼容）', () => {
  it('主页点击「在看」→ 只显示在看', () => {
    unloadMovie();
    resetMovieState();
    (window as any).__homeFilmStatus = '在看';
    openMovieManager(makeApp(new MockVault()));
    expect(M.statusFilter).toBe('在看');
    expect((window as any).__homeFilmStatus).toBeNull(); // 消费后清除，避免残留
    closeOverlay();
  });

  it('主页点击「想看」→ 只显示想看；无标志时默认全部', () => {
    unloadMovie();
    resetMovieState();
    (window as any).__homeFilmStatus = '想看';
    openMovieManager(makeApp(new MockVault()));
    expect(M.statusFilter).toBe('想看');
    closeOverlay();

    // 无标志 → 全部
    unloadMovie();
    resetMovieState();
    openMovieManager(makeApp(new MockVault()));
    expect(M.statusFilter).toBe('全部');
    closeOverlay();
  });
});
