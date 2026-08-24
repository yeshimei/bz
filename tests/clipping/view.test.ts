/**
 * 剪藏本 UI 测试（ticket 08/69）：面板渲染、站点栏单选过滤、搜索、单击跳转、
 * 移动端长按抽屉（打开/复制双链/复制原文链接/删除）、桌面端无浮层、
 * 反链直点、滚动加载、空态、modify 自动刷新。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { initArticleView, applyArticleSettings, applyFilter, renderEmpty } from '../../src/clipping/view';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks,
  getNoticeMessages,
  hasNotice,
  clearNotices,
  Platform as MockPlatform,
} from '../mock-obsidian-entry';

function makeArticleMd(link: string, site: string, title: string, created: string, extra = '') {
  return `---
link: "${link}"
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


  it('目录不存在 → 空态「暂无文章」', async () => {
    await setup();
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.article-empty')!.textContent).toBe('暂无文章');
  });

  it('⚙️ 设置弹窗：分组卡片（目录/加载/智能；移动端组桌面不渲染）+ 文案规范', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('剪藏本设置');
    // 分组卡片结构：桌面 3 组（目录/加载/智能；移动端组仅移动端渲染），原生图标 + 徽标回填项数
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['目录1 项', '加载1 项', '智能1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual(['folder-open', 'gauge', 'sparkles']);
    const settingItems = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')];
    expect(settingItems.map((el) => (el as HTMLElement).dataset.name)).toEqual(['剪藏目录', '每批加载数量', '自动摘要']);
    // 文案规范：标题零符号；描述大白话，无括号/符号写法与实现细节
    expect(settingItems.map((el) => (el as any).__setting.desc as string)).toEqual([
      '存放网页剪藏文章的文件夹',
      '滚动加载时每批显示的条目数',
      '新剪藏的文章自动生成 AI 摘要',
    ]);
  });
});