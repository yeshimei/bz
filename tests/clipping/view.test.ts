/**
 * 剪藏本 UI 测试（ticket 08/69）：面板渲染、站点栏单选过滤、搜索、单击跳转、
 * 移动端长按抽屉（打开/复制双链/复制原文链接/删除）、桌面端无浮层、
 * 反链直点、滚动加载、空态、clipping:file-modified 域事件自动刷新。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { initArticleView, applyArticleSettings, applyFilter, renderEmpty, unloadClipping } from '../../src/clipping/view';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks,
  hasNotice,
  Platform as MockPlatform,
} from '../mock-obsidian-entry';
// 隔离 auto-summary：断言开关 ON/OFF 分别调用 ensure/stop（P1-22）
vi.mock('../../src/auto-summary', () => ({
  ensureAutoSummary: vi.fn(),
  stopAutoSummary: vi.fn(),
}));
import { ensureAutoSummary, stopAutoSummary } from '../../src/auto-summary';

function makeArticleMd(url: string, site: string, title: string, created: string, extra = '') {
  return `---
url: "${url}"
author: "作者"
site: "${site}"
summary: "摘要"
tags: ["AI"]
created: ${created}
${extra}---
正文 ${title}
`;
}

function makeApp(vault: MockVault, backlinks?: Map<string, string[]>) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const m = content.match(/^---\n([\s\S]*?)\n---/);
        const fm: Record<string, any> = {};
        if (m) {
          for (const line of m[1].split('\n')) {
            const idx = line.indexOf(':');
            if (idx > 0) {
              const key = line.slice(0, idx).trim();
              let value: any = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
              const arr = value.match(/^\[(.*)\]$/);
              if (arr) value = arr[1].split(',').map((s) => s.trim());
              fm[key] = value;
            }
          }
        }
        return Object.keys(fm).length ? { frontmatter: fm } : null;
      },
      getBacklinksForFile: () => ({ data: backlinks ?? new Map() }),
    },
    workspace: {
      openLinkText: vi.fn(),
      executeCommandById: vi.fn(),
    },
    commands: { executeCommandById: vi.fn() },
  } as any;
}

const SETTINGS = { articleDirectory: '我的/文章' };

async function setup() {
  resetObsidianMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const vault = new MockVault();
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => SETTINGS as any);
  applyArticleSettings(); // 与 ensureClipping 等价：应用 articleDirectory/batchSize 设置
  return { vault, app };
}

describe('剪藏本面板', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('initArticleView 创建 DOM 并渲染卡片（标题/站点/✍️作者/相对时间）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/《A》.md', makeArticleMd('https://zhihu.com/x', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/《B》.md', makeArticleMd('https://guokr.com/x', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.getElementById('article-view-mask')).not.toBeNull();
    expect(document.getElementById('article-view-popup')).not.toBeNull();
    const cards = document.querySelectorAll('.article-entry-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('A'); // 时间倒序：新在前
    expect(cards[0].textContent).toContain('知乎');
    expect(cards[0].textContent).toContain('✍️作者');
  });

  it('首开：先弹窗显示加载提示，数据让出事件循环后渲染替换；重开：缓存复用零扫描（ticket 130）', async () => {
    const { vault, app } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    // 解析让出事件循环（未渲染）→ 窗口已可见且内容区为加载提示（首开保留，ticket 125）
    const popup = document.getElementById('article-view-popup') as HTMLElement;
    expect(popup.style.visibility).toBe('visible');
    const hint = document.querySelector('.article-loading-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe('📚 正在加载文章...');
    expect(document.querySelectorAll('.article-entry-card').length).toBe(0);
    // 宏任务让出后：解析渲染替换加载提示
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    expect(document.querySelector('.article-loading-hint')!.textContent).toBe('已显示所有文章');
    // 重开缓存复用（ticket 130）：不重载——直接显示旧列表、无加载提示、loadAllArticles 不再调用。
    // getFileCache 是解析入口（loadAllArticles 逐文件调用）：重开后零新增调用即证明零重扫。
    const parseSpy = vi.spyOn(app.metadataCache, 'getFileCache');
    // 关闭期间 vault 补入新文章（不派发任何域事件）→ 重开不应扫描到它
    vault.files.set('我的/文章/新增C.md', makeArticleMd('https://x.com/c', '知乎', '新增C', '2025-06-03T08:00:00.000Z'));
    (document.getElementById('article-view-mask') as HTMLElement).click();
    expect(popup.style.visibility).toBe('hidden');
    await initArticleView(true);
    expect(popup.style.visibility).toBe('visible');
    // 立即断言（重开路径无异步）：无「正在加载」提示、旧列表仍在、新文件未被扫描
    expect(document.body.textContent).not.toContain('📚 正在加载文章...');
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    expect([...document.querySelectorAll('.article-entry-card')].some((c) => c.textContent!.includes('新增C'))).toBe(false);
    expect(parseSpy).not.toHaveBeenCalled(); // 零重扫：解析入口零新增调用
    // 等待任一潜在异步加载窗口后仍无扫描结果
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
  });

  it('站点栏：全部 (N) + 各站点计数；点击站点单选过滤', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://guokr.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    vault.files.set('我的/文章/C.md', makeArticleMd('https://guokr.com/c', '果壳', 'C', '2025-05-31T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const btns = [...document.querySelectorAll('.article-site-btn')] as HTMLElement[];
    expect(btns[0].textContent).toContain('全部 (3)');
    expect(btns.some((b) => b.textContent!.includes('果壳') && b.textContent!.includes('(2)'))).toBe(true);

    // 点击果壳站点按钮 → 只显示 2 篇
    const guokrBtn = btns.find((b) => b.dataset.site === '果壳')!;
    guokrBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
    expect(guokrBtn.classList.contains('active')).toBe(true);

    // 再点取消筛选
    guokrBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(3);
  });

  it('搜索：关键字过滤标题/摘要/作者/标签/站点', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/机器学习入门.md', makeArticleMd('https://zhihu.com/a', '知乎', '机器学习入门', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/科学新闻.md', makeArticleMd('https://guokr.com/b', '果壳', '科学新闻', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const input = document.getElementById('article-search-input') as HTMLInputElement;
    input.value = '机器';
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350); // 防抖 300ms
    vi.useRealTimers();
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    expect(document.querySelector('.article-entry-card')!.textContent).toContain('机器学习入门');
  });

  it('双击卡片 → openLinkText 跳转并隐藏面板（用户反馈回退：双击打开，单击无操作）', async () => {
    const { vault, app } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    // 单击无操作
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(app.workspace.openLinkText).not.toHaveBeenCalled();
    // 双击打开
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('我的/文章/A.md', '', false, { active: true });
    expect((document.getElementById('article-view-mask') as HTMLElement).style.visibility).toBe('hidden');
    expect((document.getElementById('article-view-popup') as HTMLElement).style.visibility).toBe('hidden');
  });

  it('桌面端：右键弹跟手菜单（打开/复制双链/复制原文链接/删除）；双击仍打开文章', async () => {
    const { vault, app } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    // 右键 → 跟手菜单（全局组件路径，preventDefault 拦原生菜单）
    const ev = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 100, clientY: 100 });
    card.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    const labels = [...menu.querySelectorAll('.bz-item-menu-label')].map((el) => el.textContent);
    expect(labels).toEqual(['打开', '复制双链', '复制原文链接', '删除']);

    // 双击打开（与右键互不干扰）
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('我的/文章/A.md', '', false, { active: true });
  });

  it('移动端：长按整卡 → 底部抽屉（头部两行：标题+简介；动作 打开/复制双链/复制原文链接/删除）→ 删除走确认弹窗', async () => {
    vi.useFakeTimers();
    MockPlatform.isMobile = true;
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await vi.advanceTimersByTimeAsync(20);

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(550); // core longPress 500ms
    const sheet = document.querySelector('.bz-item-sheet');
    expect(sheet).not.toBeNull();

    // 头部两行精简（用户拍板）：标题 + 简介（摘要），meta 行不在头部
    const head = sheet!.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(head).not.toBeNull();
    expect(head.textContent).toContain('A'); // 标题
    expect(head.textContent).toContain('摘要'); // 简介（两行截断由 CSS 承载）
    expect(head.textContent).not.toContain('知乎');
    expect(head.textContent).not.toContain('✍️作者');

    // 动作顺序
    const labels = [...sheet!.querySelectorAll('.bz-item-sheet-label')].map((el) => el.textContent);
    expect(labels).toEqual(['打开', '复制双链', '复制原文链接', '删除']);

    // 鼠标路径残余 click 吞掉，抽屉保持
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();

    // 点「删除」→ 关抽屉 + 弹既有「确认删除」弹窗 → 确认后删除文件
    const deleteItem = [...sheet!.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent === '删除'
    ) as HTMLElement;
    deleteItem.click();
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.body.textContent).toContain('确认删除');
    const confirmDeleteBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === '删除'
    ) as HTMLButtonElement;
    confirmDeleteBtn.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(vault.files.has('我的/文章/A.md')).toBe(false);
    expect(hasNotice(/已删除/)).toBe(true);
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('移动端：抽屉「复制双链」写剪贴板 [[完整路径|标题]] 并通知', async () => {
    vi.useFakeTimers();
    MockPlatform.isMobile = true;
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await vi.advanceTimersByTimeAsync(20);

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(550);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const item = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent === '复制双链'
    ) as HTMLElement;
    item.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeSpy).toHaveBeenCalledWith('[[我的/文章/A.md|A]]');
    expect(hasNotice(/已复制双链引用/)).toBe(true);
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('移动端：抽屉「复制原文链接」小字显示域名，点击复制 URL 并通知', async () => {
    vi.useFakeTimers();
    MockPlatform.isMobile = true;
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await vi.advanceTimersByTimeAsync(20);

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(550);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    const subItems = [...sheet.querySelectorAll('.bz-item-sheet-item')];
    const originalItem = subItems.find((b) => b.textContent!.includes('复制原文链接')) as HTMLElement;
    expect(originalItem.querySelector('.bz-item-sheet-item-sub')!.textContent).toBe('zhihu.com');
    originalItem.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeSpy).toHaveBeenCalledWith('https://zhihu.com/a');
    expect(hasNotice(/已复制原文链接/)).toBe(true);
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('反链保留列表直点（stopPropagation 不触发整卡打开）；抽屉不放反链动作', async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const vault = new MockVault();
    const app = makeApp(vault, new Map([['我的/阅读/《来源笔记》.md', ['x']]]));
    setApp(app);
    setSettingsProvider(() => SETTINGS as any);
    applyArticleSettings();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/阅读/《来源笔记》.md', '# 笔记');
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    // 点位列表反链📌直点跳转（stopPropagation，不触发整卡打开）
    const linkTag = [...document.querySelectorAll('.article-entry-site')].find(
      (s) => s.textContent!.includes('📌')
    ) as HTMLElement;
    expect(linkTag.textContent).toContain('来源笔记'); // 《》书名号去除
    linkTag.click();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('我的/阅读/《来源笔记》.md', '', false, { active: true });
    expect(app.workspace.openLinkText).not.toHaveBeenCalledWith('我的/文章/A.md', '', false, { active: true });
    const mask = document.getElementById('article-view-mask') as HTMLElement;
    expect(mask.style.visibility).toBe('hidden');
  });

  it('滚动到底加载更多（每批固定 20 条 + 已显示所有文章）', async () => {
    const { vault } = await setup();
    for (let i = 0; i < 25; i++) {
      const day = String(i + 1).padStart(2, '0');
      vault.files.set(`我的/文章/文章${i}.md`, makeArticleMd(`https://x.com/${i}`, '站', `文章${i}`, `2025-06-${day}T08:00:00.000Z`));
    }
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    // 每批固定 20 条 → 首屏只渲染 20 张
    expect(document.querySelectorAll('.article-entry-card').length).toBe(20);
    // 模拟滚动到底
    const container = document.getElementById('__article-entries-container__')!;
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 900, configurable: true });
    container.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(25);
    container.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(25);
    expect(document.querySelector('.article-loading-hint')!.textContent).toBe('已显示所有文章');
  });
  it('articleBatchSize 设置生效（每批 5 条）', async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const vault = new MockVault();
    setSettingsProvider(() => ({ articleDirectory: '我的/文章', articleBatchSize: '5' }) as any);
    applyArticleSettings();
    for (let i = 0; i < 25; i++) {
      const day = String(i + 1).padStart(2, '0');
      vault.files.set(`我的/文章/文章${i}.md`, makeArticleMd(`https://x.com/${i}`, '站', `文章${i}`, `2025-06-${day}T08:00:00.000Z`));
    }
    setApp(makeApp(vault));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(5);
  });


  it('目录不存在 → 空态引导设置（ticket 63 三态之一：目录未配置）', async () => {
    await setup();
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.article-empty')!.textContent).toBe(
      '未找到剪藏目录「我的/文章」，请点击右上角 ⚙️ 前往设置'
    );
  });

  it('⚙️ 设置弹窗：分组卡片（基础/智能/数据源；移动端组桌面不渲染）+ 文案规范', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('剪藏本设置');
    // 数据源组异步加载（news.json 缺失 → 引导块）；等替换完成后断言
    await new Promise((r) => setTimeout(r, 50));
    // 分组卡片结构：桌面 3 组（基础/智能/数据源；移动端组仅移动端渲染），原生图标 + 徽标回填项数
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['基础2 项', '智能1 项', '数据源1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual(['folder-open', 'sparkles', 'radio']);
    // 可见设置行（隐藏的自动摘要详设不计入——开关默认关，detailEl display none）：基础 2 + 智能 1 + 数据源引导 1
    const settingItems = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')].filter(
      (el) => !(el as HTMLElement).closest('.auto-summary-detail')
    );
    expect(settingItems.map((el) => (el as HTMLElement).dataset.name)).toEqual(['剪藏目录', '每批加载数量', '自动摘要', '尚未启用新闻数据源']);
    // 详设容器存在但隐藏（自动摘要默认关 → detailEl display none）
    const detailContainer = popup.querySelector<HTMLElement>('.auto-summary-detail');
    expect(detailContainer).not.toBeNull();
    expect(detailContainer!.style.display).toBe('none');
    expect(detailContainer!.querySelectorAll('.setting-item').length).toBeGreaterThanOrEqual(3);
    // 文案规范：标题零符号；描述大白话，无括号/符号写法与实现细节
    const descs = settingItems.map((el: any) => el.__setting && el.__setting.desc);
    expect(descs.slice(0, 3)).toEqual([
      '存放网页剪藏文章的文件夹',
      '滚动加载时每批显示的条目数',
      '新剪藏的文章自动生成 AI 摘要',
    ]);
    expect(descs[3]).toContain('obsidian-news');
  });

  it('目录变更 → 清缓存全量重载一次：旧目录条目清空、站点/搜索筛选态重置、新目录内容呈现（ticket 130）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://guokr.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
    // 清空先前用例残留的搜索关键字（模块状态跨用例常驻；同「目录边界」用例惯例）
    const input = document.getElementById('article-search-input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // 防抖 300ms 清空 currentSearchKeyword
    // 置位站点筛选 + 搜索关键字（目录变更后应被清空重置）
    const guokrBtn = [...document.querySelectorAll('.article-site-btn')].find(
      (b) => (b as HTMLElement).dataset.site === '果壳'
    ) as HTMLElement;
    guokrBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    input.value = '残留关键字';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // 防抖 300ms 后站点+搜索双筛选生效
    expect(document.querySelectorAll('.article-entry-card').length).toBe(0); // 双筛选无结果
    // 变更剪藏目录（模拟设置保存后 applyArticleSettings 生效）→ 清缓存全量重载一次
    vault.files.set('我的/新文章/C.md', makeArticleMd('https://r.jina.ai/c', '知乎', 'C', '2025-06-05T08:00:00.000Z'));
    setSettingsProvider(() => ({ articleDirectory: '我的/新文章' }) as any);
    applyArticleSettings();
    await new Promise((r) => setTimeout(r, 20));
    // 新目录内容呈现、旧目录条目清空
    const cards = document.querySelectorAll('.article-entry-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('C');
    // 筛选态已重置：站点栏回「全部 (1)」（无果壳/知乎站点残留），搜索框清空，非空态
    expect((document.querySelector('.article-site-btn') as HTMLElement).textContent).toContain('全部 (1)');
    expect(input.value).toBe('');
    expect(document.body.textContent).not.toContain('没有符合条件的文章');
    // 恢复原目录（防后续用例模块状态残留：本 describe 面板跨用例常驻连接）
    setSettingsProvider(() => SETTINGS as any);
    applyArticleSettings();
    await new Promise((r) => setTimeout(r, 20));
  });
});

describe('空态三态与增量刷新（ticket 45/63）', () => {
  afterEach(() => {
    unloadClipping();
    vi.clearAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('目录存在但为空 → 空态「目录为空」（区别于目录未配置/筛选无结果）', async () => {
    const { vault } = await setup();
    vault.dirs.add('我的/文章'); // 注册空目录（存在但无文件）
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    // 清空先前用例残留的搜索关键字（模块状态），保证空态文案由目录内容决定（同「目录边界」用例惯例）
    const searchInput = document.getElementById('article-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 350));
    }
    expect(document.querySelector('.article-empty')!.textContent).toBe('目录为空，还没有剪藏文章');
  });

  it('搜索无结果 → 空态「没有符合条件的文章」（筛选无结果三态文案）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    const toggleBtn = [...document.querySelectorAll('button')].find((b) => b.title === '切换搜索框')!;
    toggleBtn.click();
    const input = document.getElementById('article-search-input') as HTMLInputElement;
    input.value = '不存在的关键字';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // 防抖 300ms
    expect(document.querySelector('.article-empty')!.textContent).toBe('没有符合条件的文章');
    // 清空关键字 → 恢复卡片（不再停留空态）
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
  });

  it('modify 增量刷新：只重解析被改文件，不整目录重读（vault.read 零调用）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    const readSpy = vi.spyOn(vault, 'read');

    // 修改 B（站点变更，卡片 meta 就地更新）→ 增量更新生效
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x2.com/b', '果壳新站', 'B', '2025-06-01T08:00:00.000Z'));
    emitDomainEvent('clipping:file-modified', { path: '我的/文章/B.md' });
    await new Promise((r) => setTimeout(r, 400));

    expect(readSpy).not.toHaveBeenCalled(); // 不再整目录重读
    const cards = document.querySelectorAll('.article-entry-card');
    expect(cards.length).toBe(2);
    expect([...cards].some((c) => c.textContent!.includes('果壳新站'))).toBe(true);
  });

  it('modify 后失去 url/created → 从列表移除（增量删除分支）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    vault.files.set('我的/文章/B.md', '# 不再是文章\n\n无 frontmatter');
    emitDomainEvent('clipping:file-modified', { path: '我的/文章/B.md' });
    await new Promise((r) => setTimeout(r, 400));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
  });

  it('防抖窗口内多文件被改 → 逐个增量刷新，全部生效', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    // 同一防抖窗口内改两个文件的站点 → 窗口结束逐个刷新，两处都生效
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎新站', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳新站', 'B', '2025-06-01T08:00:00.000Z'));
    emitDomainEvent('clipping:file-modified', { path: '我的/文章/A.md' });
    emitDomainEvent('clipping:file-modified', { path: '我的/文章/B.md' }); // 重置防抖计时
    await new Promise((r) => setTimeout(r, 400));
    const texts = [...document.querySelectorAll('.article-entry-card')].map((c) => c.textContent);
    expect(texts.some((t) => t!.includes('知乎新站'))).toBe(true);
    expect(texts.some((t) => t!.includes('果壳新站'))).toBe(true);
  });

  it('file-deleted 事件 → 按路径移除卡片，不残留幽灵条目（B1）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
    // 外部删除 B：vault 文件消失 + adapter 派发 clipping:file-deleted
    vault.files.delete('我的/文章/B.md');
    emitDomainEvent('clipping:file-deleted', { path: '我的/文章/B.md' });
    await new Promise((r) => setTimeout(r, 400));
    const cards = document.querySelectorAll('.article-entry-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('A');
  });

  it('file-renamed 事件（auto-summary 改名路径）→ 旧卡移除、新卡解析，同一文章不双卡（B1）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/《旧名》.md', makeArticleMd('https://x.com/a', '知乎', '旧名', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    // 模拟 auto-summary 改名：旧文件消失、新文件就位 + adapter 派发 renamed（双路径均在本目录）
    const content = vault.files.get('我的/文章/《旧名》.md')!;
    vault.files.delete('我的/文章/《旧名》.md');
    vault.files.set('我的/文章/《新名》.md', content);
    emitDomainEvent('clipping:file-renamed', {
      oldPath: '我的/文章/《旧名》.md',
      newPath: '我的/文章/《新名》.md',
      movedOut: false,
    });
    await new Promise((r) => setTimeout(r, 400));
    // 仅一张卡：旧卡已移除、新路径已解析（若只增不删就是双卡）
    const cards = document.querySelectorAll('.article-entry-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('《新名》');
  });

  it('面板隐藏期间文件删除 → 监听通道移除旧卡，重开无幽灵卡片（B1 常驻监听，ticket 130）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '果壳', 'B', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
    const closeBtn = [...document.querySelectorAll('button')].find((b) => b.title === '关闭')!;
    closeBtn.click(); // 面板关闭（visibility 常驻，模块列表与 DOM 均保留）
    // 关闭期间外部删除 B：vault 文件消失 + adapter 派发 clipping:file-deleted
    // （三通道监听常驻，面板隐藏期间照常结算——B1 由常驻监听增量维护，重开不再重载兜底）
    vault.files.delete('我的/文章/B.md');
    emitDomainEvent('clipping:file-deleted', { path: '我的/文章/B.md' });
    await new Promise((r) => setTimeout(r, 400)); // 防抖 300ms 结算
    // 重开缓存复用（ticket 130）：零扫描，直接展示监听维护后的列表，无幽灵卡片
    await initArticleView(true);
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
    expect(document.querySelector('.article-entry-card')!.textContent).toContain('A');
    expect(document.body.textContent).not.toContain('📚 正在加载文章...');
  });
});

describe('剪藏本修复回归（P0-8/P1-22/P1-23/P2）', () => {
  afterEach(() => {
    // 摘除 vault 监听并重置 fileListenerAttached，防跨用例模块状态残留
    unloadClipping();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('站点栏注入（P0-8）：站点名含 <img …> 渲染为纯文本，计数 span 结构与类名不变', async () => {
    const { vault } = await setup();
    const evil = '<img src=x onerror=alert(1)>';
    vault.files.set('我的/文章/A.md', makeArticleMd('无效链接', evil, 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const btn = [...document.querySelectorAll('.article-site-btn')].find(
      (b) => (b as HTMLElement).dataset.site === evil
    ) as HTMLElement;
    expect(btn).toBeDefined();
    expect(btn.querySelector('img')).toBeNull(); // 未被解析为元素（link 无效无 favicon，断言干净）
    expect(btn.innerHTML).not.toContain('<img'); // 无真实 img 标签
    expect(btn.textContent).toContain(evil); // 原样文本呈现
    const countSpan = btn.querySelector('.count');
    expect(countSpan).not.toBeNull(); // 计数 span 结构/类名不变
    expect(countSpan!.textContent).toBe('(1)');
  });

  it('自动摘要开关（P1-22）：OFF 调 stopAutoSummary、ON 调 ensureAutoSummary', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    vi.mocked(ensureAutoSummary).mockClear();
    vi.mocked(stopAutoSummary).mockClear();

    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const item = [...popup.querySelectorAll('.setting-item')].find(
      (el) => (el as HTMLElement).dataset.name === '自动摘要'
    ) as HTMLElement;
    const toggle = (item as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');

    toggle.trigger(false); // OFF → 摘除监听
    await Promise.resolve();
    expect(stopAutoSummary).toHaveBeenCalledTimes(1);
    expect(ensureAutoSummary).not.toHaveBeenCalled();

    toggle.trigger(true); // ON → 恢复
    await Promise.resolve();
    expect(ensureAutoSummary).toHaveBeenCalledWith(expect.objectContaining({ commands: expect.anything() }));
  });

  it('created 为 "1750000000000" 这类值（P1-23）：不再抛 RangeError 卡死面板，列表正常渲染', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/Bad.md', makeArticleMd('https://x.com/b', '站', 'Bad', '"1750000000000"'));
    vault.files.set('我的/文章/Good.md', makeArticleMd('https://x.com/g', '站', 'Good', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    // 两张卡都渲染（Invalid Date 回退当前时间，不中断整表加载）
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
    const badCard = [...document.querySelectorAll('.article-entry-card')].find(
      (c) => c.querySelector('.article-entry-title')!.textContent === 'Bad'
    ) as HTMLElement;
    const metaRow = badCard.querySelector('.article-entry-meta')!;
    expect(metaRow.textContent).toContain('站'); // meta 行正常构建
    // dataset.created 合法 ISO 或缺省（容错不抛错），相对时间文案存在
    const lastMeta = metaRow.lastElementChild as HTMLElement;
    if (lastMeta.dataset.created) {
      expect(() => new Date(lastMeta.dataset.created!).toISOString()).not.toThrow();
    }
  });

  it('删除含引号路径的文章（P2）：findCardByPath 遍历 dataset 比对，不再抛 DOMException', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/含"引"号.md', makeArticleMd('https://x.com/a', '知乎', '标题X', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true }));
    // 菜单能弹出 = buildArticleActions→findCardByPath 未抛 DOMException
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    const deleteItem = menu.querySelector('.bz-item-menu-item--danger') as HTMLElement;
    deleteItem.click();
    expect(document.body.textContent).toContain('确认删除');
    const confirmBtn = [...document.querySelectorAll('.setting-item, button')].find(
      (el) => el.tagName === 'BUTTON' && el.textContent === '删除'
    ) as HTMLButtonElement;
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(vault.files.has('我的/文章/含"引"号.md')).toBe(false);
    expect(hasNotice(/已删除/)).toBe(true);
  });

  it('clipping:file-modified 目录边界（P2）：前缀同名目录不误触发刷新；目录内正常防抖刷新', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    // 清空前面用例残留的搜索关键字（refreshData→applyFilter 会用到），保证刷新结果只由目录内容决定
    const searchInput = document.getElementById('article-search-input') as HTMLInputElement;
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // 等防抖把 currentSearchKeyword 清空
    const scBefore = document.querySelector('.article-scroll-container');

    // 「我的/文章备选」（前缀同名但非同目录）modify → 不刷新（补 '/' 边界后 startsWith 不命中）
    emitDomainEvent('clipping:file-modified', { path: '我的/文章备选/x.md' });
    await new Promise((r) => setTimeout(r, 350));
    expect(document.querySelector('.article-scroll-container')).toBe(scBefore);
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);

    // 目录内 modify → 防抖 300ms 后 refreshData 重渲染（scrollContainer 重建）
    vault.files.set('我的/文章/B.md', makeArticleMd('https://x.com/b', '站', 'B', '2025-06-03T08:00:00.000Z'));
    emitDomainEvent('clipping:file-modified', { path: '我的/文章/B.md' });
    await new Promise((r) => setTimeout(r, 400));
    expect(document.querySelector('.article-scroll-container')).not.toBe(scBefore);
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
  });
});