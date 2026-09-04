/**
 * 书架墙（bookshelf）UI 层测试：主面板渲染/筛选/搜索/详情改状态进度书评/删除/报告深链/EPUB 只读
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import { ensureBookshelf, unloadBookshelf, openBookshelf } from '../../src/bookshelf';
import { createOverlay, closeOverlay } from '../../src/bookshelf/ui';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 本地时区日期串（YYYY-MM-DD） */
function dateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** N 年前的今天（纪念日卡种子用） */
function yearsAgoDate(n: number): string {
  const d = new Date();
  return dateStr(new Date(d.getFullYear() - n, d.getMonth(), d.getDate()));
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
    // 左栏 4 项（状态组）+ 分类组（全部 + 成长 + 未分类）
    expect(overlay.querySelectorAll('.bz-bs-side-list .bz-bs-side-item').length).toBe(4);
    const catItems = Array.from(overlay.querySelectorAll('.bz-bs-side-catlist .bz-bs-side-item')).map((b) => b.textContent);
    expect(catItems.length).toBe(3);
    expect(catItems[0]).toContain('全部');
    expect(catItems.some((t) => t?.includes('成长'))).toBe(true);
    expect(catItems.some((t) => t?.includes('未分类'))).toBe(true);
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
    (popup.querySelector('.bz-bs-d-save') as HTMLElement).click();
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
    (popup.querySelector('.bz-bs-d-save') as HTMLElement).click();
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
    expect(popup.querySelector('.bz-bs-d-save')).toBeFalsy(); // 只读无保存钮
    // 直达原文按钮存在（该书在读中 → 文案「继续读」；EPUB 走 Weave 深链）
    const openBtn = popup.querySelector('.bz-bs-d-open') as HTMLElement;
    expect(openBtn).toBeTruthy();
    expect(openBtn.textContent).toContain('继续读');
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
    expect(overlay.querySelector('.bz-bs-shelves')?.textContent).toContain('这个筛选下还没有书');
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

  it('audit H：bindCoverFallback 容器 error 监听只挂一次（重复渲染不叠加）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const shelves = overlay.querySelector('.bz-bs-shelves') as HTMLElement;
    const spy = vi.spyOn(shelves, 'addEventListener');
    const { renderAll } = await import('../../src/bookshelf/ui');
    renderAll(app);
    renderAll(app);
    expect(spy.mock.calls.filter(([type]) => type === 'error').length).toBe(0); // 首次渲染已挂，重复渲染不再叠加
    spy.mockRestore();
    closeOverlay();
  });

  it('audit H：toggle 关面板顺带关闭详情/删除确认弹窗（不留孤儿浮层）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('认知觉醒')) as HTMLElement;
    card.click();
    expect(document.querySelector('.bz-bs-d-popup')).toBeTruthy(); // 详情弹窗开着
    // 再触发一次命令（toggle 语义 → closeOverlay）
    openBookshelf(app);
    expect(document.querySelector('.bz-bs-overlay')).toBeFalsy(); // 主面板已关
    expect(document.querySelector('.bz-bs-d-popup')).toBeFalsy(); // 详情弹窗不留孤儿
    // 删除确认弹窗同样收口
    createOverlay(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay2 = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card2 = Array.from(gridCards(overlay2)).find((b) => b.textContent?.includes('算法导论')) as HTMLElement;
    card2.click();
    (document.querySelector('.bz-bs-d-popup .bz-bs-d-danger') as HTMLElement).click();
    expect(document.querySelector('.bz-bs-confirm-pop')).toBeTruthy();
    openBookshelf(app);
    expect(document.querySelector('.bz-bs-confirm-pop')).toBeFalsy();
    expect(document.querySelector('.bz-bs-d-popup')).toBeFalsy();
  });

  // ==================== 增强包：直达 / accent 卡 / 排序入口 / 撤销 / 分类 / 纪念日 / 读完日期 ====================

  it('详情直达：在读 md 书按钮「继续读」→ 点击瞬间 progress 通知 + openLinkText 打开笔记 + 弹窗收起', async () => {
    const { vault, app } = seedVault();
    const openLink = vi.fn(async () => {});
    (app as any).workspace.openLinkText = openLink;
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('认知觉醒')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    const openBtn = popup.querySelector('.bz-bs-d-open') as HTMLElement;
    expect(openBtn.textContent).toContain('继续读'); // 在读状态文案
    openBtn.click();
    expect(getNoticeMessages().some((m) => m.includes('正在打开…'))).toBe(true); // progress 反馈
    expect(openLink).toHaveBeenCalledWith('书库/认知觉醒.md', '', false); // md 书 = 打开对应笔记
    expect(document.querySelector('.bz-bs-d-popup')).toBeFalsy(); // 弹窗收起
    closeOverlay();
  });

  it('详情直达：非在读 md 书按钮「打开笔记」；EPUB 无阅读数据回落直接打开 epub 路径', async () => {
    const { vault, app } = seedVault();
    const openLink = vi.fn(async () => {});
    (app as any).workspace.openLinkText = openLink;
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 围城（已读）→ 打开笔记
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('围城')) as HTMLElement;
    card.click();
    let popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect((popup.querySelector('.bz-bs-d-open') as HTMLElement).textContent).toContain('打开笔记');
    (popup.querySelector('.bz-bs-d-open') as HTMLElement).click();
    expect(openLink).toHaveBeenLastCalledWith('书库/围城.md', '', false);
    closeOverlay();

    // EPUB：weave-data 无 cfi → 回落直接打开 vaultPath（Weave 自行恢复上次位置）
    const vault2 = new MockVault();
    vault2.files.set('书库/一.md', '---\ntags: [book]\n---');
    vault2.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub', sourceId: 's1' }, reading: { position: { percent: 0.5 } } } },
    }));
    const app2 = makeApp(vault2);
    const openLink2 = vi.fn(async () => {});
    (app2 as any).workspace.openLinkText = openLink2;
    ensureBookshelf(app2);
    createOverlay(app2);
    await new Promise((r) => setTimeout(r, 20));
    const overlay2 = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const epubCard = Array.from(gridCards(overlay2)).find((b) => b.textContent?.includes('百年孤独')) as HTMLElement;
    epubCard.click();
    const popup2 = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    (popup2.querySelector('.bz-bs-d-open') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10)); // EPUB 链路异步（读 weave 聚合 → 深链/回落）
    expect(openLink2).toHaveBeenLastCalledWith('books/x.epub', '', false);
    closeOverlay();
  });

  it('详情直达：EPUB 在读 → weave-cfi 深链跳当前位置', async () => {
    const vault = new MockVault();
    vault.files.set('书库/一.md', '---\ntags: [book]\n---');
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub', sourceId: 's1' }, reading: { position: { chapterIndex: 2, cfi: 'epubcfi(/6/6[ch2]!/4)', percent: 0.5 } } } },
    }));
    const app = makeApp(vault);
    const openLink = vi.fn(async () => {});
    (app as any).workspace.openLinkText = openLink;
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const epubCard = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('百年孤独')) as HTMLElement;
    epubCard.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    (popup.querySelector('.bz-bs-d-open') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10)); // EPUB 链路异步（读 weave 聚合 → 深链）
    expect(openLink).toHaveBeenLastCalledWith(
      'books/x.epub#weave-cfi=epubcfi(/6/6%5Bch2%5D!/4)&chapter=2&sid=s1', '', false,
    );
    closeOverlay();
  });

  it('在读 accent 卡整卡可点：一键回书直达原文（与详情「继续读」同语义）', async () => {
    const { vault, app } = seedVault();
    const openLink = vi.fn(async () => {});
    (app as any).workspace.openLinkText = openLink;
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const accentCard = overlay.querySelector('.bz-bs-dash .bz-bs-statcard[data-bs-resume]') as HTMLElement;
    expect(accentCard).toBeTruthy();
    expect(accentCard.textContent).toContain('正在读');
    accentCard.click();
    expect(getNoticeMessages().some((m) => m.includes('正在打开…'))).toBe(true);
    expect(openLink).toHaveBeenCalledWith('书库/认知觉醒.md', '', false);
    closeOverlay();
  });

  it('移动端排序入口：头行 ⇅ 钮开筛选抽屉（同入口）；uiSegmented 切排序键即时生效且抽屉不关', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const sortBtn = overlay.querySelector('[data-bs-tool="sort"]') as HTMLElement;
    expect(sortBtn).toBeTruthy();
    expect(sortBtn.querySelector('[data-icon="arrow-up-down"]')).toBeTruthy(); // lucide ⇅
    sortBtn.click();
    const drawer = document.querySelector('.bz-bs-drawer-mask') as HTMLElement;
    expect(drawer).toBeTruthy();
    // 排序分段（组件库 uiSegmented，4 键）
    const seg = drawer.querySelector('[data-bs-drawer-sort] .bz-segmented') as HTMLElement;
    expect(seg).toBeTruthy();
    const segBtns = Array.from(seg.querySelectorAll('.bz-segmented-btn')) as HTMLElement[];
    expect(segBtns.map((b) => b.textContent)).toEqual(['最近阅读', '书名', '作者', '进度']);
    // 切「书名」→ 网格即时重排，抽屉保持打开（可连选）
    segBtns[1].click();
    expect(M.sortMode).toBe('title');
    expect((document.querySelector('.bz-bs-drawer-mask') as HTMLElement).isConnected).toBe(true);
    const titles = gridCards(overlay).map((c) => c.querySelector('.bz-bs-bname')?.textContent);
    expect(titles).toEqual([...(titles as string[])].sort((a, b) => (a || '').localeCompare(b || '', 'zh')));
    closeDrawerHelper();
    closeOverlay();
  });

  it('分类筛选：侧栏第二组正交过滤（状态 × 分类叠加）；抽屉 chips 同步', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 点分类「成长」→ 只剩认知觉醒
    const catBtn = Array.from(overlay.querySelectorAll('.bz-bs-side-catlist .bz-bs-side-item')).find((b) => b.textContent?.includes('成长')) as HTMLElement;
    catBtn.click();
    expect(gridCards(overlay).length).toBe(1);
    expect(gridCards(overlay)[0].textContent).toContain('认知觉醒');
    // 正交：切状态「已读」→ 已读 ∩ 成长 = 空（空态文案）
    const doneBtn = Array.from(overlay.querySelectorAll('.bz-bs-side-list .bz-bs-side-item')).find((b) => b.textContent?.includes('已读')) as HTMLElement;
    doneBtn.click();
    expect(gridCards(overlay).length).toBe(0);
    expect(overlay.querySelector('.bz-bs-shelves')?.textContent).toContain('这个筛选下还没有书');
    // 分类「全部」复位 → 已读 1 本
    const allBtn = Array.from(overlay.querySelectorAll('.bz-bs-side-catlist .bz-bs-side-item')).find((b) => b.textContent?.includes('全部')) as HTMLElement;
    allBtn.click();
    expect(gridCards(overlay).length).toBe(1);
    // 移动抽屉：分类 chips 组存在，点「未分类」生效（状态已读仍叠加 → 已读 ∩ 未分类 = 围城）
    (overlay.querySelector('#bz-bs-filterbtn') as HTMLElement).click();
    const drawer = document.querySelector('.bz-bs-drawer-mask') as HTMLElement;
    const chips = Array.from(drawer.querySelectorAll('[data-bs-drawer-cats] .bz-chip')) as HTMLElement[];
    expect(chips.map((c) => c.textContent?.replace(/\d+/g, ''))).toContain('全部');
    const uncat = chips.find((c) => c.textContent?.includes('未分类')) as HTMLElement;
    uncat.click();
    expect(M.catFilter).toBe('未分类');
    expect(gridCards(overlay).length).toBe(1);
    expect(gridCards(overlay)[0].textContent).toContain('围城');
    closeDrawerHelper();
    closeOverlay();
  });

  it('状态保存撤销：改已读保存后 notifyUndo 一键回滚 frontmatter 与条目', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('认知觉醒')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    (Array.from(popup.querySelectorAll('.bz-choice-btn')).find((b) => b.textContent?.trim() === '已读') as HTMLElement).click();
    (popup.querySelector('.bz-bs-d-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    // 落盘：已读（手滑前状态）
    let content = vault.files.get('书库/认知觉醒.md') as string;
    expect(content).toMatch(/completionDate: \d{4}-\d{2}-\d{2}/);
    expect(content).toContain('readingProgress: 100');
    // 撤销 toast（restore 语义 + 撤销按钮）
    const undoBtn = Array.from(document.querySelectorAll('.bz-notice-action')).find((b) => b.textContent === '撤销') as HTMLElement;
    expect(undoBtn).toBeTruthy();
    undoBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    // frontmatter 还原快照旧值：进度 60、无 completionDate
    content = vault.files.get('书库/认知觉醒.md') as string;
    expect(content).toContain('readingProgress: 60');
    expect(content).not.toContain('completionDate');
    // 本地条目回滚 + 渲染联动：仍在读
    const it = M.items.find((x) => x.title === '认知觉醒');
    expect(it?.status).toBe('在读');
    expect(gridCards(overlay).some((c) => c.textContent?.includes('认知觉醒'))).toBe(true);
    closeOverlay();
  });

  it('读完日期可改：已读书详情展示日期输入；改日期保存 → frontmatter 与年度统计按新日期', async () => {
    const { vault, app } = seedVault();
    const y = new Date().getFullYear();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 基线：今年读完 1 本（围城 2026-08-15）
    expect((overlay.querySelector('.bz-bs-dash') as HTMLElement).textContent).toContain(`${y} 读完`);
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('围城')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    // 已读 → 读完日期行可见，预填现有值
    const cdateWrap = popup.querySelector('.bz-bs-d-cdatewrap') as HTMLElement;
    expect(cdateWrap.style.display).not.toBe('none');
    const cdate = popup.querySelector('.bz-bs-d-cdate') as HTMLInputElement;
    expect(cdate.value).toBe('2026-08-15');
    // 补录去年日期 → 保存
    cdate.value = `${y - 1}-08-15`;
    (popup.querySelector('.bz-bs-d-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const content = vault.files.get('书库/围城.md') as string;
    expect(content).toContain(`completionDate: ${y - 1}-08-15`);
    // 年度统计跟随补录日期：今年读完归零（统计按补录日期算，不被保存当天污染）
    const dashText = (overlay.querySelector('.bz-bs-dash') as HTMLElement).textContent || '';
    expect(dashText).not.toContain(`${y} 读完1 本`);
    closeOverlay();
  });

  it('读完日期可改：在读转已读时日期行出现并默认今天；切回在读/未读隐藏', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(gridCards(overlay)).find((b) => b.textContent?.includes('认知觉醒')) as HTMLElement;
    card.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    const cdateWrap = popup.querySelector('.bz-bs-d-cdatewrap') as HTMLElement;
    const cdate = popup.querySelector('.bz-bs-d-cdate') as HTMLInputElement;
    expect(cdateWrap.style.display).toBe('none'); // 在读：隐藏
    (Array.from(popup.querySelectorAll('.bz-choice-btn')).find((b) => b.textContent?.trim() === '已读') as HTMLElement).click();
    expect(cdateWrap.style.display).not.toBe('none');
    expect(cdate.value).toBe(dateStr(new Date())); // 默认今天
    (Array.from(popup.querySelectorAll('.bz-choice-btn')).find((b) => b.textContent?.trim() === '在读') as HTMLElement).click();
    expect(cdateWrap.style.display).toBe('none');
    closeOverlay();
  });

  it('读完纪念日卡：那年今天命中时 accent 卡位替换纪念卡（可点回看详情）；无命中不渲染', async () => {
    const vault = new MockVault();
    vault.files.set('书库/纪念书.md', `---\ntags: [book]\nauthor: 纪念作者\nreadingDate: ${yearsAgoDate(3)}\ncompletionDate: ${yearsAgoDate(3)}\nreadingProgress: 100\n---`);
    const app = makeApp(vault);
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    // 命中：accent 卡位 = 纪念卡（无命中零空态的反向断言在下方）
    const anniv = overlay.querySelector('.bz-bs-dash [data-bs-anniv]') as HTMLElement;
    expect(anniv).toBeTruthy();
    expect(anniv.textContent).toContain('3 年前的今天');
    expect(anniv.textContent).toContain('纪念书');
    expect(anniv.querySelector('[data-icon="calendar-heart"]')).toBeTruthy();
    // 点击 → 回看该书详情
    anniv.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('纪念书');
    closeOverlay();
  });

  it('读完纪念日卡：无命中（今天没读完纪念日）不渲染、无空态', async () => {
    const { vault, app } = seedVault(); // 围城读完 2026-08-15，非今天
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    expect(overlay.querySelector('[data-bs-anniv]')).toBeFalsy();
    // 在读 accent 卡占位（一键回书语义在位）
    expect(overlay.querySelector('.bz-bs-dash [data-bs-resume]')).toBeTruthy();
    closeOverlay();
  });
});

/** 关闭书架墙筛选抽屉（测试辅助） */
function closeDrawerHelper(): void {
  const drawer = document.querySelector('.bz-bs-drawer-mask') as HTMLElement | null;
  if (drawer) (drawer.querySelector('[data-bs-drawer-close]') as HTMLElement)?.click();
}
