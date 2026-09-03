/**
 * 书架墙（bookshelf）UI 层测试：主面板渲染/筛选/搜索/详情改状态进度书评/删除/报告深链/EPUB 只读
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import { ensureBookshelf, unloadBookshelf } from '../../src/bookshelf';
import { createOverlay, closeOverlay } from '../../src/bookshelf/ui';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('书库/认知觉醒.md', `---
tags: [book]
author: 周岭
category: 成长
readingDate: 2026-08-01
readingProgress: 60
highlights: 12
thinks: 3
bookReview: 值得反复读
---`);
  vault.files.set('书库/围城.md', `---
tags: [book]
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
---`);
  vault.files.set('书库/算法导论.md', '---\ntags: [book]\nauthor: CLRS\n---');
  const app = makeApp(vault);
  ensureBookshelf(app);
  return { vault, app };
}

/** 打开主面板并等待首次异步重建完成 */
async function openPanel(vault: MockVault, app: ReturnType<typeof mockAppWithVault>) {
  createOverlay(app);
  await new Promise((r) => setTimeout(r, 20)); // rebuildItems 微任务
}

/** jsdom 无媒体查询：桌面与移动两份书架容器同时存在（真实环境按断点各显一份）；
 *  helper 取「桌面网格容器」断言（视觉单份）。 */
function gridCards(overlay: HTMLElement): HTMLElement[] {
  return Array.from(overlay.querySelectorAll('.bz-bs-shelves .bz-bs-book'));
}
function mGridCards(overlay: HTMLElement): HTMLElement[] {
  return Array.from(overlay.querySelectorAll('.bz-bs-shelves-m .bz-bs-book'));
}

describe('bookshelf overlay', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    M.folderPath = '书库';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('打开主面板：头行标题 + 计数 + 统计 + 左栏状态 + 网格书卡', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-bs-title')?.textContent).toContain('书架墙');
    expect(overlay.querySelector('.bz-bs-total')?.textContent).toBe('3 本');
    // 统计卡：正在读 1 / 今年读完 1
    expect(overlay.textContent).toContain('正在读');
    expect(overlay.querySelector('.bz-bs-stat-num')?.textContent).toBe('1 本');
    // 左栏 4 项
    expect(overlay.querySelectorAll('.bz-bs-side-item').length).toBe(4);
    // 网格 3 卡：B7 单端渲染——桌面模式只渲染桌面容器，移动容器留空（免双份 DOM/图片）
    expect(gridCards(overlay).length).toBe(3);
    expect(mGridCards(overlay).length).toBe(0);
    expect(overlay.querySelector('.bz-bs-report')?.textContent).toContain('阅读分析报告');
    closeOverlay();
  });

  it('筛选：左栏点已读 → 只剩 1 卡', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const doneBtn = Array.from(overlay.querySelectorAll('.bz-bs-side-item')).find((b) => b.textContent?.includes('已读')) as HTMLElement;
    doneBtn.click();
    expect(gridCards(overlay).length).toBe(1);
    expect(gridCards(overlay)[0].textContent).toContain('围城');
    closeOverlay();
  });

  it('搜索：桌面输入过滤；清空恢复', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250)); // 防抖 200ms
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(gridCards(overlay).length).toBe(1);
    expect(gridCards(overlay)[0].textContent).toContain('围城');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(gridCards(overlay).length).toBe(3);
    closeOverlay();
  });

  it('面板重开：搜索关键字回写两个输入框（过滤状态可见，不再空输入框静默过滤）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    closeOverlay();
    // 重开：M.searchKeyword 残留，输入框必须回显同样的关键字
    createOverlay(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay2 = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect((overlay2.querySelector('#bz-bs-dsearch') as HTMLInputElement).value).toBe('钱钟书');
    expect((overlay2.querySelector('#bz-bs-msearch') as HTMLInputElement).value).toBe('钱钟书');
    expect(gridCards(overlay2).length).toBe(1); // 过滤仍生效且与输入框一致
    closeOverlay();
  });

  it('详情：打开书籍详情弹窗，改状态已读 → 保存 → 统计/计数联动 + frontmatter 落盘', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('认知觉醒')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('认知觉醒');
    expect(popup.textContent).toContain('周岭');
    // 状态单选（组件库 .bz-choice-btn）
    const doneBtn = Array.from(popup.querySelectorAll('.bz-choice-btn')).find((b) => b.textContent?.trim() === '已读') as HTMLElement;
    doneBtn.click();
    // 保存
    (popup.querySelector('.bz-btn--primary') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30)); // 异步 processFrontMatter + rebuild
    // frontmatter 落盘：readingProgress 100 + completionDate
    const content = vault.files.get('书库/认知觉醒.md') as string;
    expect(content).toContain('readingProgress: 100');
    expect(content).toMatch(/completionDate: \d{4}-\d{2}-\d{2}/);
    expect(content).toContain('bookReview: 值得反复读');
    // 统计联动
    const total = overlay.querySelector('.bz-bs-total') as HTMLElement;
    expect(total.textContent).toBe('3 本');
    // 详情弹窗关闭（保存成功）
    expect(document.querySelector('.bz-bs-d-popup')).toBeFalsy();
    closeOverlay();
  });

  it('改状态在读 → 保存：readingProgress 归进度值、无 completionDate；清空书评删键', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 打开「围城」（已读）
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('围城')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    // 点「在读」
    (Array.from(popup.querySelectorAll('.bz-choice-btn')).find((b) => b.textContent?.trim() === '在读') as HTMLElement).click();
    // 进度滑杆拉低
    const range = popup.querySelector('.bz-range') as HTMLInputElement;
    range.value = '45';
    range.dispatchEvent(new Event('input'));
    // 清空书评
    const review = popup.querySelector('.bz-bs-d-review') as HTMLTextAreaElement;
    review.value = '';
    // 保存
    (popup.querySelector('.bz-btn--primary') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const content = vault.files.get('书库/围城.md') as string;
    expect(content).toContain('readingProgress: 45');
    expect(content).not.toContain('completionDate');
    expect(content).not.toContain('bookReview');
    closeOverlay();
  });

  it('详情：md 书可删除（二次确认链）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('算法导论')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup.textContent).toContain('删除');
    (popup.querySelector('.bz-bs-d-danger') as HTMLElement).click();
    // 确认框
    const conf = document.querySelector('.bz-bs-confirm-pop') as HTMLElement;
    expect(conf).toBeTruthy();
    expect(conf.textContent).toContain('算法导论');
    (conf.querySelector('[data-bs-c="1"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(vault.files.has('书库/算法导论.md')).toBe(false);
    // 剩 2 本（删除后重建）
    expect(gridCards(overlay).length).toBe(2);
    expect(gridCards(overlay).some((b) => b.textContent?.includes('算法导论'))).toBe(false);
    closeOverlay();
  });

  it('EPUB 条目：网格出现且详情只读（无删除/保存钮，状态禁用）', async () => {
    const vault = new MockVault();
    vault.files.set('书库/认知觉醒.md', '---\ntags: [book]\n---');
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: {
          meta: { title: '百年孤独', author: '马尔克斯' },
          file: { vaultPath: 'books/x.epub' },
          reading: { position: { percent: 0.5 }, stats: { totalReadTime: 3600000 } },
        },
      },
    }));
    const app = makeApp(vault);
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(gridCards(overlay).length).toBe(2);
    const epubCard = gridCards(overlay).find((b) => b.textContent?.includes('百年孤独')) as HTMLElement;
    epubCard.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup.textContent).toContain('百年孤独');
    expect(popup.textContent).toContain('EPUB 书目由 Weave 阅读器记录');
    expect(popup.querySelector('.bz-bs-d-danger')).toBeFalsy();
    expect(popup.querySelector('.bz-btn--primary')).toBeFalsy();
    // 状态单选禁用
    const btn = popup.querySelector('.bz-choice-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 无删除 → vault 文件未被动
    expect(vault.files.has('书库/认知觉醒.md')).toBe(true);
    closeOverlay();
  });

  it('阅读分析报告入口：执行 bz-reading-report-open 命令', async () => {
    const { vault, app } = seedVault();
    let executed = '';
    (app as any).commands.executeCommandById = (id: string) => { executed = id; };
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    (overlay.querySelector('.bz-bs-report') as HTMLElement).click();
    expect(executed).toBe('bz-reading-report-open');
    closeOverlay();
  });

  it('移动端视图：抽屉筛选可用（桌面模式同样能开抽屉）；选未读 → 只剩未读卡', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 头部筛选按钮（在 DOM 中；桌面 CSS 隐藏但可点击）
    const filterBtn = overlay.querySelector('#bz-bs-filterbtn') as HTMLElement;
    filterBtn.click();
    const drawer = document.querySelector('.bz-bs-drawer-mask') as HTMLElement;
    expect(drawer).toBeTruthy();
    const opts = Array.from(drawer.querySelectorAll('.bz-bs-drawer-opt'));
    expect(opts.length).toBe(4);
    const unreadOpt = opts.find((o) => o.textContent?.includes('未读')) as HTMLElement;
    unreadOpt.click();
    expect(gridCards(overlay).length).toBe(1);
    expect(gridCards(overlay)[0].textContent).toContain('算法导论');
    // 筛选按钮角标出现
    expect(overlay.textContent).toContain('未读 1');
    // 再开抽屉选全部 → 恢复
    (overlay.querySelector('#bz-bs-filterbtn') as HTMLElement).click();
    const drawer2 = document.querySelector('.bz-bs-drawer-mask') as HTMLElement;
    (Array.from(drawer2.querySelectorAll('.bz-bs-drawer-opt')).find((o) => o.textContent?.includes('全部')) as HTMLElement).click();
    expect(gridCards(overlay).length).toBe(3);
    closeOverlay();
  });

  it('B7：移动端模式（Platform.isMobile）只渲染移动容器', async () => {
    const MockPlatform = (await import('../mock-obsidian-entry')).Platform;
    const { vault, app } = seedVault();
    MockPlatform.isMobile = true;
    try {
      await openPanel(vault, app);
      const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
      expect(mGridCards(overlay).length).toBe(3);
      expect(gridCards(overlay).length).toBe(0);
    } finally {
      MockPlatform.isMobile = false;
    }
    closeOverlay();
  });

  it('B8：首开加载态（rebuild 完成前显示「正在整理书架…」占位）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    // rebuild 未完成：shelves 是加载占位而非空态文案
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(overlay.querySelector('.bz-bs-shelves')?.textContent).toContain('正在整理书架');
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay.querySelector('.bz-bs-shelves')?.textContent).not.toContain('正在整理书架');
    expect(gridCards(overlay).length).toBe(3);
    closeOverlay();
  });

  it('B9：空态三态区分——搜索无命中 search-x、状态筛空 funnel', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 搜索无命中 → search-x（mock setIcon 记录图标名到 data-icon）
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '不存在的书名';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(overlay.querySelector('.bz-bs-shelves [data-icon="search-x"]')).toBeTruthy();
    // 状态筛空（库非空、无搜索、「在读」下无书）→ funnel + 专属文案
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    M.items = M.items.filter((x) => x.title === '围城'); // 只剩已读
    M.side = 'reading';
    const { renderAll } = await import('../../src/bookshelf/ui');
    renderAll(app);
    expect(overlay.querySelector('.bz-bs-shelves')?.textContent).toContain('这个状态下还没有书');
    expect(overlay.querySelector('.bz-bs-shelves [data-icon="funnel"]')).toBeTruthy();
    closeOverlay();
  });

  it('B4：weave-data.json vault modify → 防抖后自动刷新（EPUB 进度联动）', async () => {
    const { vault, app } = seedVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' }, reading: { position: { percent: 0.1 } } } },
    }));
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(gridCards(overlay).some((b) => b.textContent?.includes('百年孤独'))).toBe(true);
    // Weave 外部落盘新进度 → vault modify
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' }, reading: { position: { percent: 0.9 } } },
        b: { meta: { title: '新加的书' }, file: { vaultPath: 'books/y.epub' } },
      },
    }));
    vault.emit('modify', vault.file('CONFIG/STORAGE/weave-data.json'));
    await new Promise((r) => setTimeout(r, 420)); // 防抖 300ms + rebuild
    expect(gridCards(overlay).length).toBe(5); // 3 md + 2 epub
    const epub = gridCards(overlay).find((b) => b.textContent?.includes('百年孤独')) as HTMLElement;
    const bar = epub.querySelector('.bz-bs-prog i') as HTMLElement;
    expect(bar?.style.width).toBe('90%'); // 0.9 → 90（进度是条宽，非文本）
    closeOverlay();
  });

  it('B1/B5：unloadBookshelf 注销 ESC 层 + 退订事件（面板重开后 ESC 不误关、modify 不再刷新）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    closeOverlay();
    unloadBookshelf(); // 注销 ESC 层 + 退订 vault modify
    // 重新开面板（不经 ensureBookshelf：模拟卸载后层未注销的对照场景）
    createOverlay(app);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-bs-overlay')).toBeTruthy(); // ESC 层已注销：不关
    // vault modify 不再触发刷新（退订生效）
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    vault.files.set('书库/新书.md', '---\ntags: [book]\n---');
    vault.emit('modify', vault.file('书库/新书.md'));
    await new Promise((r) => setTimeout(r, 420));
    expect(gridCards(overlay).length).toBe(3); // 未刷新（新书未出现）
    closeOverlay();
  });
});
