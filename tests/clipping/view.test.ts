/**
 * 剪藏本 UI 测试（ticket 08）：面板渲染、站点栏单选过滤、搜索、双击跳转、
 * 长按删除确认、滚动加载、空态、modify 自动刷新。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { initArticleView, applyArticleSettings, applyFilter, renderEmpty } from '../../src/clipping/view';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

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

function makeApp(vault: MockVault) {
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
      getBacklinksForFile: () => ({ data: new Map() }),
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

  it('双击卡片 → openLinkText 跳转并隐藏面板', async () => {
    const { vault, app } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('我的/文章/A.md', '', false, { active: true });
  });

  it('长按日期 → 删除确认弹窗「确认删除」→ 删除文件 + Notice', async () => {
    vi.useFakeTimers();
    const { vault, app } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://zhihu.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await vi.advanceTimersByTimeAsync(20);

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    const dateSpan = [...card.querySelectorAll('span')].find((s) => s.dataset.created) as HTMLElement;
    dateSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(900); // LONG_PRESS_DURATION=800

    // 确认弹窗
    expect(document.body.textContent).toContain('确认删除');
    // 删除按钮
    const deleteBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === '删除') as HTMLButtonElement;
    deleteBtn.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(vault.files.has('我的/文章/A.md')).toBe(false);
    expect(hasNotice(/已删除/)).toBe(true);
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

  it('⚙️ 设置弹窗：仅剪藏目录/每批加载数量/自动摘要开关三项', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await new Promise((r) => setTimeout(r, 20));
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('剪藏本设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual(['剪藏目录', '每批加载数量', '自动摘要']);
  });
});