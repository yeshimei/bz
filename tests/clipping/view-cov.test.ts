/**
 * 剪藏本面板补充覆盖测试（src/clipping/view.ts 未触达分支）：
 * 面板显隐切换（showImmediately=false / 已存在重开并重载）、头部按钮（🔍/⏳/📰/❌）、
 * ESC 关闭、parseArticleFile 容错、删除失败兜底、失效反链来源、最小字段文章、
 * 空容器直调安全、滚动未到底不加载、抽屉头部结构、移动端设置组、批次非法值回退。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  initArticleView,
  applyArticleSettings,
  parseArticleFile,
  buildSheetHead,
  unloadClipping,
} from '../../src/clipping/view';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';

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
    workspace: { openLinkText: vi.fn(), executeCommandById: vi.fn() },
    commands: { executeCommandById: vi.fn() },
  } as any;
}

async function setup(settings: any = { articleDirectory: '我的/文章' }, backlinks?: Map<string, string[]>) {
  resetObsidianMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const vault = new MockVault();
  const app = makeApp(vault, backlinks);
  setApp(app);
  setSettingsProvider(() => settings as any);
  applyArticleSettings();
  return { vault, app };
}

/** 等待异步加载完成 */
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('剪藏本面板显隐与头部按钮', () => {
  afterEach(() => {
    unloadClipping();
    MockPlatform.isMobile = false;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('initArticleView(false)：首次创建即隐藏；再调 true 切换为可见', async () => {
    await setup();
    await initArticleView(false);
    const mask = document.getElementById('article-view-mask') as HTMLElement;
    const popup = document.getElementById('article-view-popup') as HTMLElement;
    expect(mask).not.toBeNull();
    expect(mask.style.visibility).toBe('hidden');
    expect(popup.style.visibility).toBe('hidden');
    // 已存在 + showImmediately=true → 仅切换可见性（不重建 DOM）
    await initArticleView(true);
    expect(document.querySelectorAll('#article-view-mask').length).toBe(1);
    expect(mask.style.visibility).toBe('visible');
    // 再以 false 调用 → 隐藏
    await initArticleView(false);
    expect(mask.style.visibility).toBe('hidden');
  });

  it('已存在面板且数据为空时以 true 重开 → 触发重新加载', async () => {
    const { vault } = await setup();
    await initArticleView(true); // 目录尚不存在 → 空态
    await flush();
    expect(document.querySelector('.article-empty')).not.toBeNull();
    // 补入文章后面板仍挂着（模块内 allArticles 为空）→ 重开触发补加载
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await flush();
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
  });

  it('❌ 关闭按钮与点击遮罩均只隐藏面板（不销毁 DOM）', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await flush();
    const closeBtn = [...document.querySelectorAll('button')].find((b) => b.title === '关闭')!;
    closeBtn.click();
    const mask = document.getElementById('article-view-mask') as HTMLElement;
    expect(mask.style.visibility).toBe('hidden');
    expect(document.getElementById('article-view-popup')).not.toBeNull(); // 不销毁
    // 点遮罩本身 → 同样隐藏
    mask.click();
    expect(mask.style.visibility).toBe('hidden');
    // 点弹窗内部（非遮罩）不关闭：先重开再点 popup
    await initArticleView(true);
    (document.getElementById('article-view-popup') as HTMLElement).click();
    expect((document.getElementById('article-view-mask') as HTMLElement).style.visibility).toBe('visible');
  });

  it('🔍 切换搜索框：显示可输入过滤，收起时清空关键字恢复全量', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/机器学习.md', makeArticleMd('https://x.com/a', '知乎', '机器学习', '2025-06-02T08:00:00.000Z'));
    vault.files.set('我的/文章/科学新闻.md', makeArticleMd('https://x.com/b', '果壳', '科学新闻', '2025-06-01T08:00:00.000Z'));
    await initArticleView(true);
    await flush();

    const toggleBtn = [...document.querySelectorAll('button')].find((b) => b.title === '切换搜索框')!;
    const container = document.getElementById('article-search-container') as HTMLElement;
    const input = document.getElementById('article-search-input') as HTMLInputElement;

    // 展开
    toggleBtn.click();
    expect(container.style.display).toBe('block');

    // 输入关键字（300ms 防抖）→ 过滤出 1 条
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    input.value = '机器';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);

    // 收起 → 清空关键字 + 立即恢复全量
    toggleBtn.click();
    expect(container.style.display).toBe('none');
    vi.useRealTimers();
    expect(input.value).toBe('');
    expect(document.querySelectorAll('.article-entry-card').length).toBe(2);
  });

  // 注：源码中 ⏳「重新加载文章」按钮创建后从未挂载到 DOM（refreshBtn 无 appendChild），
  // 属不可达 UI 分支（兼容性冻结不改产线码），其回调无法经真实路径触达，故无用例。

  it('📰 资讯按钮：隐藏面板并经 commands 裸调用 bz-news-open（域间互调约定 id）', async () => {
    const { app } = await setup();
    await initArticleView(true);
    await flush();
    const newsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '打开资讯阅读器')!;
    newsBtn.click();
    expect((app.commands.executeCommandById as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('bz-news-open');
    expect((document.getElementById('article-view-mask') as HTMLElement).style.visibility).toBe('hidden');
  });

  it('ESC 经 escManager 关闭面板（mask/popup 同步隐藏）', async () => {
    await setup();
    await initArticleView(true);
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect((document.getElementById('article-view-mask') as HTMLElement).style.visibility).toBe('hidden');
    expect((document.getElementById('article-view-popup') as HTMLElement).style.visibility).toBe('hidden');
  });

  it('⚙️ 设置弹窗：移动端追加「移动端」分组（isMobileEnv 分支）', async () => {
    await setup();
    await initArticleView(true);
    await flush();
    MockPlatform.isMobile = true;
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['基础2 项', '智能1 项', '移动端1 项']);
  });
});

describe('剪藏本数据解析与容错', () => {
  afterEach(() => {
    unloadClipping();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('parseArticleFile：无 frontmatter / 缺 url / 缺 created / 读文件抛错 → 均返回 null', async () => {
    const { vault, app } = await setup();
    vault.files.set('我的/文章/nofm.md', '正文（无 frontmatter）');
    vault.files.set('我的/文章/nourl.md', '---\ncreated: 2025-06-02T08:00:00.000Z\n---\n正文');
    vault.files.set('我的/文章/nocreated.md', '---\nurl: "https://x.com/a"\n---\n正文');

    expect(await parseArticleFile(vault.file('我的/文章/nofm.md'))).toBeNull();
    expect(await parseArticleFile(vault.file('我的/文章/nourl.md'))).toBeNull();
    expect(await parseArticleFile(vault.file('我的/文章/nocreated.md'))).toBeNull();

    // 读文件抛错：console.warn 兜底不中断
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (app as any).vault.read = async () => {
      throw new Error('disk error');
    };
    vault.files.set('我的/文章/bad.md', makeArticleMd('https://x.com/a', '知乎', 'bad', '2025-06-02T08:00:00.000Z'));
    expect(await parseArticleFile(vault.file('我的/文章/bad.md'))).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('反链来源指向不存在文件 → meta 行跳过该来源（continue 分支）', async () => {
    const { vault } = await setup({ articleDirectory: '我的/文章' }, new Map([['我的/阅读/已被删除.md', ['x']]]));
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await flush();
    const metaRow = document.querySelector('.article-entry-meta')!;
    expect(metaRow.textContent).not.toContain('📌'); // 来源文件不存在：不入列
    // 日期节点仍在（相对时间）
    expect(metaRow.lastElementChild!.textContent).toBeTruthy();
  });

  it('最小字段文章：站点回退「未知」、无作者标记、非法链接不抛错', async () => {
    const { vault } = await setup({ articleDirectory: '我的/文章' });
    vault.files.set('我的/文章/min.md', '---\nurl: "不是合法URL"\ncreated: 2025-06-02T08:00:00.000Z\n---\n正文');
    await initArticleView(true);
    await flush();
    const metaRow = document.querySelector('.article-entry-meta') as HTMLElement;
    expect(metaRow.textContent).toContain('未知'); // site 缺省
    expect(metaRow.textContent).not.toContain('✍️'); // 无作者
    // 卡片照常渲染（URL 解析失败被吞）
    expect(document.querySelectorAll('.article-entry-card').length).toBe(1);
  });

  it('删除失败（vault.delete 抛错）→ 错误通知且文件保留', async () => {
    const { vault } = await setup();
    vault.files.set('我的/文章/A.md', makeArticleMd('https://x.com/a', '知乎', 'A', '2025-06-02T08:00:00.000Z'));
    await initArticleView(true);
    await flush();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (vault as any).delete = async () => {
      throw new Error('EACCES: permission denied');
    };

    const card = document.querySelector('.article-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true }));
    const deleteItem = document.querySelector('.bz-item-menu-item--danger') as HTMLElement;
    deleteItem.click();
    const confirmBtn = [...document.querySelectorAll('button')].find(
      (el) => el.tagName === 'BUTTON' && el.textContent === '删除'
    ) as HTMLButtonElement;
    confirmBtn.click();
    await flush();

    const notices = Array.from(document.querySelectorAll('.bz-notice-msg')).map((n) => n.textContent);
    expect(notices.some((t) => t!.includes('删除失败，请检查文件权限'))).toBe(true);
    expect(vault.files.has('我的/文章/A.md')).toBe(true); // 文件未被误删
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('剪藏本渲染辅助与滚动', () => {
  afterEach(() => {
    unloadClipping();
    document.body.innerHTML = '';
  });

  it('未初始化时直调导出函数不抛错（容器缺失早退）', async () => {
    await setup();
    const { renderEntries, rebuildSiteBar, renderEmpty } = await import('../../src/clipping/view');
    expect(() => renderEntries(true)).not.toThrow();
    expect(() => rebuildSiteBar()).not.toThrow();
    expect(() => renderEmpty()).not.toThrow();
  });  it('滚动位置远离底部 → 不触发加载下一批', async () => {
    const { vault } = await setup();
    for (let i = 0; i < 25; i++) {
      const day = String(i + 1).padStart(2, '0');
      vault.files.set(`我的/文章/文章${i}.md`, makeArticleMd(`https://x.com/${i}`, '站', `文章${i}`, `2025-06-${day}T08:00:00.000Z`));
    }
    await initArticleView(true);
    await flush();
    expect(document.querySelectorAll('.article-entry-card').length).toBe(20); // 首批 20

    const container = document.getElementById('__article-entries-container__')!;
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 100, configurable: true }); // 远离底部
    container.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.article-entry-card').length).toBe(20); // 不加载
  });

  it('buildSheetHead：标题块（含反链高亮类）+ 摘要块（缺省回退文案）', async () => {
    const entry = {
      file: {},
      path: '我的/文章/A.md',
      url: 'https://x.com/a',
      author: '',
      site: '知乎',
      summary: '',
      tags: [],
      created: new Date('2025-06-02T08:00:00.000Z'),
      title: '标题A',
      rawContent: '',
      hasBacklink: true,
      backlinkSources: ['我的/阅读/B.md'],
    };
    const head = buildSheetHead(entry);
    expect(head.className).toBe('bz-item-sheet-entry');
    const titleDiv = head.querySelector('.article-entry-title') as HTMLElement;
    expect(titleDiv.textContent).toBe('标题A');
    expect(titleDiv.classList.contains('has-backlink')).toBe(true); // 有反链 → 高亮类
    const summaryEl = head.querySelector('.article-entry-summary') as HTMLElement;
    expect(summaryEl.textContent).toBe('（无摘要）'); // 摘要缺省回退
  });

  it('articleBatchSize 非法值（非数字）→ 回退默认每批 20', async () => {
    const { vault } = await setup({ articleDirectory: '我的/文章', articleBatchSize: 'abc' });
    for (let i = 0; i < 22; i++) {
      const day = String(i + 1).padStart(2, '0');
      vault.files.set(`我的/文章/文章${i}.md`, makeArticleMd(`https://x.com/${i}`, '站', `文章${i}`, `2025-06-${day}T08:00:00.000Z`));
    }
    await initArticleView(true);
    await flush();
    expect(document.querySelectorAll('.article-entry-card').length).toBe(20);
  });
});
