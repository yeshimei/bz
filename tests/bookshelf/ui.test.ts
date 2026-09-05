/**
 * 书架墙（bookshelf）UI 层测试：书脊墙渲染（issue 218 1:1 复刻）——
 * 刊头/统计标签筛选/分类分区/倒叠区/搜索/排序三档/借书卡（改状态进度日期书评/删除/EPUB 只读/直达）
 * 读书报告内嵌化：命令路径进报告视图（墙面无入口）/返回/同面板筛选/自动刷新/渲染中止
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import { ensureBookshelf, unloadBookshelf, openBookshelf, openBookshelfReport } from '../../src/bookshelf';
import { createOverlay, closeOverlay, applyBookshelfSkin, bsSkinClass } from '../../src/bookshelf/ui';
import { setSettingsProvider } from '../../src/core/settings-provider';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 轮询等待报告分片渲染完成（成功反馈 toast = finishDone 标记） */
async function waitReport(content: HTMLElement, timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!document.querySelector('#bz-notice-container')?.textContent?.includes('阅读统计完成')) {
    if (Date.now() - start > timeout) throw new Error('waitReport: 报告渲染超时');
    await new Promise((r) => setTimeout(r, 15));
  }
  void content;
}

/** 本地时区日期串（YYYY-MM-DD） */
function dateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
wordCount: 180000
pages: 288
---`);
  vault.files.set('书库/围城.md', `---
tags: [book]
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
wordCount: 130000
---`);
  vault.files.set('书库/银河英雄传说VOL.1：黎明篇.md', '---\ntags: [book]\nauthor: 田中芳树\ncategory: 科幻\n---');
  const app = makeApp(vault);
  ensureBookshelf(app);
  return { vault, app };
}

/** 打开主面板并等待首次异步重建完成 */
async function openPanel(vault: MockVault, app: ReturnType<typeof mockAppWithVault>) {
  createOverlay(app);
  await new Promise((r) => setTimeout(r, 20)); // rebuildItems 微任务
}

/** 墙上书脊（借书卡详情/计数断言统一入口） */
function spines(overlay: HTMLElement): HTMLElement[] {
  return Array.from(overlay.querySelectorAll('.bz-bs-spine'));
}

describe('bookshelf 书脊墙（issue 218）', () => {
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

  it('打开主面板：木匾刊头 + 纸质标签行（状态四张 + 分类）+ 工具行 + 墙体书脊', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    // 刊头
    expect(overlay.querySelector('.bz-bs-plaque h1')?.textContent).toBe('书脊墙');
    expect(overlay.querySelector('.bz-bs-plaque p')?.textContent).toContain('SPINE WALL');
    // 标签行：全馆 3 / 已读 1 / 在读 1 / 未读 1 + 分类（成长/科幻）
    const labels = Array.from(overlay.querySelectorAll('.bz-bs-taglabel'));
    // 分类标签只数在架书（围城无分类 → 「未分类」也出标签；科幻是未读书专属分类 → 不出，未读统一在倒叠区）
    expect(labels.length).toBe(6);
    expect(labels[0].textContent).toContain('全馆藏书');
    expect(labels[0].textContent).toContain('3');
    expect(labels[1].textContent).toContain('已读 · 讫');
    expect(labels[2].textContent).toContain('在读 · 抽出');
    expect(labels[3].textContent).toContain('未读 · 倒叠');
    expect(labels.some((l) => l.textContent?.includes('成长'))).toBe(true);
    expect(labels.some((l) => l.textContent?.includes('未分类'))).toBe(true);
    expect(labels.some((l) => l.textContent?.includes('科幻'))).toBe(false);
    // 工具行：检索 + 三档排序 + 在墙计数
    expect(overlay.querySelector('#bz-bs-dsearch')).toBeTruthy();
    const segBtns = Array.from(overlay.querySelectorAll('#bz-bs-sortseg button')).map((b) => b.textContent);
    expect(segBtns).toEqual(['最近读完', '时长最长', '书名']);
    expect(overlay.querySelector('#bz-bs-hint')?.textContent).toContain('3 册在墙');
    // 墙体：3 条书脊；已读盖「讫」印、在读垂书签带；旧网格/统计/左栏不存在
    expect(spines(overlay).length).toBe(3);
    expect(overlay.querySelector('.bz-bs-spine.read .stamp')).toBeTruthy();
    expect(overlay.querySelector('.bz-bs-spine.reading .ribbon')).toBeTruthy();
    expect(overlay.querySelector('.bz-bs-grid')).toBeFalsy();
    expect(overlay.querySelector('.bz-bs-dash')).toBeFalsy();
    expect(overlay.querySelector('.bz-rail')).toBeFalsy();
    closeOverlay();
  });

  it('书脊语义：高度/厚度内联变量 + 长书名主/副双列拆分（按「：」）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    // 认知觉醒：有字数有批注 → 内联 height/width/--c1
    const spine = spines(overlay).find((s) => s.title?.includes('认知觉醒')) as HTMLElement;
    expect(spine.style.height).toMatch(/px$/);
    expect(spine.style.width).toMatch(/px$/);
    expect(spine.style.getPropertyValue('--c1')).toBeTruthy();
    // 「银河英雄传说VOL.1：黎明篇」→ 主/副双列
    const long = spines(overlay).find((s) => s.title?.includes('银河英雄传说')) as HTMLElement;
    expect(long).toBeTruthy();
    expect(long.querySelector('.bz-bs-spine-title .t-main')?.textContent).toContain('银河英雄传说');
    expect(long.querySelector('.bz-bs-spine-title .t-sub')?.textContent).toBe('黎明篇');
    closeOverlay();
  });

  it('筛选：点已读标签 → 只剩围城；再点已读回全馆（issue 208）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const doneLabel = () => Array.from(overlay.querySelectorAll<HTMLElement>('[data-bs-side]')).find((b) => b.dataset.bsSide === 'done') as HTMLElement;
    doneLabel().click();
    expect(spines(overlay).length).toBe(1);
    expect((spines(overlay)[0] as HTMLElement).title).toContain('围城');
    doneLabel().click();
    expect(spines(overlay).length).toBe(3);
    closeOverlay();
  });

  it('分类标签：正交过滤；再点同类回全馆', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const catLabel = () => Array.from(overlay.querySelectorAll<HTMLElement>('[data-bs-cat]')).find((b) => b.dataset.bsCat === '成长') as HTMLElement;
    expect(catLabel()).toBeTruthy();
    catLabel().click();
    expect(spines(overlay).length).toBe(1);
    expect((spines(overlay)[0] as HTMLElement).title).toContain('认知觉醒');
    catLabel().click();
    expect(spines(overlay).length).toBe(3);
    closeOverlay();
  });

  it('倒叠区：未读书收墙尾「倒 叠 区」分区（不在分类分区）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const zones = Array.from(overlay.querySelectorAll('.bz-bs-zone'));
    expect(zones.length).toBeGreaterThanOrEqual(2); // 分类分区 + 倒叠区
    const last = zones[zones.length - 1] as HTMLElement;
    expect(last.querySelector('.bz-bs-divider')?.textContent).toContain('倒');
    const unreadSpines = Array.from(last.querySelectorAll('.bz-bs-spine.unread'));
    expect(unreadSpines.length).toBe(1);
    expect((unreadSpines[0] as HTMLElement).title).toContain('银河英雄传说');
    closeOverlay();
  });

  it('搜索：输入过滤（书名/作者）；清空恢复；在墙计数联动', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250)); // 防抖 200ms
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(spines(overlay).length).toBe(1);
    expect((spines(overlay)[0] as HTMLElement).title).toContain('围城');
    expect(overlay.querySelector('#bz-bs-hint')?.textContent).toContain('1 册在墙');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(spines(overlay).length).toBe(3);
    closeOverlay();
  });

  it('面板重开：搜索关键字回写输入框（过滤状态可见）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    closeOverlay();
    createOverlay(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay2 = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect((overlay2.querySelector('#bz-bs-dsearch') as HTMLInputElement).value).toBe('钱钟书');
    expect(spines(overlay2).length).toBe(1);
    closeOverlay();
  });

  it('排序三档：默认最近读完；点「书名」即时重排（zh 序）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(M.sortMode).toBe('recent');
    const titleBtn = overlay.querySelector('#bz-bs-sortseg [data-bs-sort="title"]') as HTMLElement;
    titleBtn.click();
    expect(M.sortMode).toBe('title');
    expect(overlay.querySelector('#bz-bs-sortseg .on')?.textContent).toBe('书名');
    closeOverlay();
  });

  it('借书卡只读化（issue 220）：点书脊弹出纯展示卡——台账/进度条/印章齐备，无任何编辑控件', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const spine = spines(document.querySelector('.bz-panel-overlay') as HTMLElement).find((s) => s.title?.includes('认知觉醒')) as HTMLElement;
    spine.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('已抽出这本书');
    expect(popup.textContent).toContain('认知觉醒');
    expect(popup.textContent).toContain('周岭');
    expect(popup.textContent).toContain('值得反复读');
    expect(popup.querySelector('.bz-bs-d-seal')?.textContent).toBe('阅');
    expect(popup.querySelector('.bz-choice-btn')).toBeFalsy();
    expect(popup.querySelector('.bz-range')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-review')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-cdate')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-danger')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-save')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-actions')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-meter .bar i')).toBeTruthy();
    expect(popup.querySelector('.bz-bs-d-stdot')).toBeTruthy();
    expect(popup.textContent).toContain('阅读进度');
    closeOverlay();
  });

  it('借书卡：EPUB 与 md 同一只读形态（无编辑控件；展示 Weave 数据）', async () => {
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
    const spine = spines(document.querySelector('.bz-panel-overlay') as HTMLElement).find((s) => s.title?.includes('百年孤独')) as HTMLElement;
    expect(spine).toBeTruthy();
    spine.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup.textContent).toContain('百年孤独');
    expect(popup.textContent).toContain('EPUB');
    expect(popup.querySelector('.bz-choice-btn')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-danger')).toBeFalsy();
    expect(popup.querySelector('.bz-bs-d-save')).toBeFalsy();
    closeOverlay();
  });

  it('B8：首开加载态（rebuild 完成前「正在整理书架…」占位）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay.querySelector('#bz-bs-shelf')?.textContent).toContain('正在整理书架');
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay.querySelector('#bz-bs-shelf')?.textContent).not.toContain('正在整理书架');
    expect(spines(overlay).length).toBe(3);
    closeOverlay();
  });

  it('B9：空态三态——搜索无命中 search-x、状态筛空 funnel', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '不存在的书名';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(overlay.querySelector('#bz-bs-shelf [data-icon="search-x"]')).toBeTruthy();
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    M.items = M.items.filter((x) => x.title === '围城');
    M.side = 'reading';
    const { renderAll } = await import('../../src/bookshelf/ui');
    renderAll(app);
    expect(overlay.querySelector('#bz-bs-shelf')?.textContent).toContain('这个筛选下还没有书');
    expect(overlay.querySelector('#bz-bs-shelf [data-icon="funnel"]')).toBeTruthy();
    closeOverlay();
  });

  it('B4：weave-data.json vault modify → 防抖后自动刷新（EPUB 上墙）', async () => {
    const { vault, app } = seedVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' }, reading: { position: { percent: 0.9 } } } },
    }));
    await openPanel(vault, app);
    let overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(spines(overlay).some((s) => s.title?.includes('百年孤独'))).toBe(true);
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' }, reading: { position: { percent: 0.9 } } },
        b: { meta: { title: '新加的书' }, file: { vaultPath: 'books/y.epub' } },
      },
    }));
    vault.emit('modify', vault.file('CONFIG/STORAGE/weave-data.json'));
    await new Promise((r) => setTimeout(r, 420));
    overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(spines(overlay).length).toBe(5); // 3 md + 2 epub
    closeOverlay();
  });

  it('B1/B5：unloadBookshelf 注销 ESC 层 + 退订事件（重开后 ESC 不误关、modify 不再刷新）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    closeOverlay();
    unloadBookshelf();
    createOverlay(app);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    vault.files.set('书库/新书.md', '---\ntags: [book]\n---');
    vault.emit('modify', vault.file('书库/新书.md'));
    await new Promise((r) => setTimeout(r, 420));
    expect(spines(overlay).length).toBe(3); // 未刷新
    closeOverlay();
  });

  it('audit H：toggle 关面板顺带关闭借书卡弹窗（不留孤儿浮层）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const spine = spines(document.querySelector('.bz-panel-overlay') as HTMLElement)[0];
    spine.click();
    expect(document.querySelector('.bz-bs-d-popup')).toBeTruthy();
    openBookshelf(app);
    expect(document.querySelector('.bz-panel-overlay')).toBeFalsy();
    expect(document.querySelector('.bz-bs-d-popup')).toBeFalsy();
  });

  it('读书报告：命令冷开面板直落报告视图；返回书脊墙', async () => {
    const { vault, app } = seedVault();
    openBookshelfReport(app);
    await new Promise((r) => setTimeout(r, 40));
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(M.view).toBe('report');
    expect(overlay.querySelector('.bz-bs-view-report')?.classList.contains('active')).toBe(true);
    expect(overlay.querySelector('.bz-bs-view-shelf')?.classList.contains('active')).toBe(false);
    const content = overlay.querySelector('.bz-rr-content') as HTMLElement;
    await waitReport(content);
    expect(content.textContent).toContain('已读');
    // 返回书脊墙
    (overlay.querySelector('[data-rr-goto-shelf]') as HTMLElement).click();
    expect(M.view).toBe('shelf');
    expect(overlay.querySelector('.bz-bs-view-shelf')?.classList.contains('active')).toBe(true);
    closeOverlay();
  });

  it('读书报告：已开面板热切报告视图；作者行回墙预填搜索（同面板筛选）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    openBookshelfReport(app);
    expect(M.view).toBe('report');
    const content = overlay.querySelector('.bz-rr-content') as HTMLElement;
    // 直接轮询内容区出现作者卡（toast 口径会被前后台渲染时序骗过）
    const start = Date.now();
    while (!content.querySelector('[data-rr-author="周岭"]') && Date.now() - start < 8000) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const authorCard = content.querySelector('[data-rr-author="周岭"]') as HTMLElement;
    expect(authorCard).toBeTruthy();
    authorCard.click();
    expect(M.view).toBe('shelf');
    expect(M.searchKeyword).toBe('周岭');
    expect((overlay.querySelector('#bz-bs-dsearch') as HTMLInputElement).value).toBe('周岭');
    expect(spines(overlay).length).toBe(1);
    expect(spines(overlay)[0].title).toContain('认知觉醒');
    closeOverlay();
  });

  it('报告渲染中止：报告视图中关面板 → 在途渲染作废不报错、toast 收起', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    openBookshelfReport(app);
    closeOverlay();
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
    expect(document.querySelectorAll('#bz-notice-container .bz-notice').length).toBe(0);
  });

  it('audit H：借书卡封面坏图回退占位（bindCoverFallback 容器级一次挂载）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const spine = spines(document.querySelector('.bz-panel-overlay') as HTMLElement).find((s) => s.title?.includes('认知觉醒')) as HTMLElement;
    spine.click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    const spy = vi.spyOn(popup, 'addEventListener');
    // 重复渲染路径不重挂（借书卡无重渲；直接断言委托已绑：手工坏图回退）
    const wrap = document.createElement('div');
    wrap.className = 'bz-bs-d-cover';
    wrap.innerHTML = '<img src="x.png" alt="">';
    popup.querySelector('.bz-bs-d-card')!.appendChild(wrap);
    (wrap.querySelector('img') as HTMLElement).dispatchEvent(new Event('error'));
    expect(wrap.querySelector('.bz-bs-d-cover-ph')).toBeTruthy();
    expect(spy.mock.calls.filter(([type]) => type === 'error').length).toBe(0);
    spy.mockRestore();
    closeOverlay();
  });
});

/** 关闭书架墙筛选抽屉（历史测试辅助；抽屉已退役保留空实现防悬挂引用） */
function closeDrawerHelper(): void { /* issue 218 抽屉退役 */ }
void closeDrawerHelper;

describe('bookshelf 面板皮肤（issue 216）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    M.folderPath = '书库';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    setSettingsProvider(() => ({} as never));
    document.body.innerHTML = '';
  });

  it('未配置 → 默认挂雪松白（nordic）；配置值 → 面板根挂对应皮肤类', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const panel = document.querySelector('.bz-bs-panel') as HTMLElement;
    expect(panel.classList.contains('bz-bs-skin-nordic')).toBe(true);
    closeOverlay();

    setSettingsProvider(() => ({ bookshelfSkin: 'noir' }) as never);
    await openPanel(vault, app);
    const panel2 = document.querySelector('.bz-bs-panel') as HTMLElement;
    expect(panel2.classList.contains('bz-bs-skin-noir')).toBe(true);
    expect(panel2.classList.contains('bz-bs-skin-nordic')).toBe(false);
  });

  it('applyBookshelfSkin 热切换已开面板；非法值回落雪松白', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const panel = document.querySelector('.bz-bs-panel') as HTMLElement;
    applyBookshelfSkin('mono');
    expect(panel.classList.contains('bz-bs-skin-mono')).toBe(true);
    applyBookshelfSkin('bogus');
    expect(panel.classList.contains('bz-bs-skin-nordic')).toBe(true);
    expect(panel.className).not.toContain('bz-bs-skin-bogus');
    applyBookshelfSkin('velvet');
    expect(['nordic', 'dark', 'noir', 'wabi', 'bauhaus', 'blueprint', 'neon', 'kraft', 'velvet', 'mono'].every((id) => id === 'velvet' || !panel.classList.contains(`bz-bs-skin-${id}`))).toBe(true);
  });

  it('bsSkinClass：弹窗与面板同套皮肤；未配置回落 nordic', () => {
    setSettingsProvider(() => ({ bookshelfSkin: 'wabi' }) as never);
    expect(bsSkinClass()).toBe('bz-bs-skin-wabi');
    setSettingsProvider(() => ({ bookshelfSkin: 'whatever' }) as never);
    expect(bsSkinClass()).toBe('bz-bs-skin-nordic');
    setSettingsProvider(() => ({} as never));
    expect(bsSkinClass()).toBe('bz-bs-skin-nordic');
  });
});
