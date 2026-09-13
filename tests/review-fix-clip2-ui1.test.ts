// @vitest-environment jsdom
/**
 * 剪藏本域 UI 核心修复批回归（review-clipbook-bugs.md C1 / C5 / C6 / C7 / C8 / C13 / C14 / C15）：
 * - C1：rail 站点行「全部标为已读（N 篇）」按**该站**口径查询（原 source 三元链缺 site 分支，
 *   落 {kind:'all'}——菜单计数 = 全库未读、一次确认清空整个未读流）；
 * - C5：剪藏正文懒加载水合前清占位（MarkdownRenderer 是追加语义，铁律 6——占位不与水合共存）；
 * - C6：异步水合完成后的 img 补挂 error 兜底（断网/防盗链不留裂图）；
 * - C7：closePanel 同步复位移动详情 overlay 显示态（重开不落在上次的详情屏）；
 * - C8：stepArticle 搜索态在命中集内步进 / 剪藏源按平铺列表步进（原 dirFor().unread 对 clip 恒空）；
 * - C13：移动详情「第 X 则 / N」按 id 查序（快照实例与查询实例身份失配恒 -1）；
 * - C14：已读/已收条目不挂「标记为已读」（doMarkRead 守卫会静默吞掉，不给无效入口）；
 * - C15：剪藏源搜索零命中空态文案 = 「查无此条」（不误报「剪藏本为空」）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp, getApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../src/clipbook';
import { closePanel, showPanel } from '../src/clipbook/ui';
import { M } from '../src/clipbook/state';
import { getNewsFilePath } from '../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../src/clipbook/write-queue';
import { setClipDir } from './clipbook/helpers';

/** news.json 种子（lastFetchAt 拦 openClipbook 自动抓取，同 enhance.test.ts 口径） */
function seedNews(articles: any[]): string {
  return JSON.stringify({
    articles,
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    lastFetchAt: Date.now(),
  });
}

async function boot(vault: MockVault): Promise<void> {
  try { unloadClipbook(); } catch { /* 幂等 */ }
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  setClipDir('归档/网页剪藏');
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
}

const diskNews = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

function railRow(label: string): HTMLElement {
  return [...document.querySelectorAll('.bz-rail-item')].find((r) => r.getAttribute('title') === label) as HTMLElement;
}

async function contextMenuOn(target: HTMLElement): Promise<HTMLElement> {
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  return await vi.waitFor(() => {
    const el = document.querySelector('.bz-item-menu') as HTMLElement | null;
    expect(el, '右键菜单应弹出').toBeTruthy();
    return el!;
  });
}

beforeEach(() => {
  try { unloadClipbook(); } catch { /* 幂等 */ }
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  try { closePanel(); } catch { /* 幂等 */ }
  try { unloadClipbook(); } catch { /* 幂等 */ }
});

// ================= C1 =================

describe('C1：rail 站点行批量已读按该站口径（不落 {kind:all}）', () => {
  it('站点行菜单计数 = 该站未读数；确认后只标该站、统计只 +1', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '果壳未读', url: 'https://guokr.com/g1', date: '2026-09-03 08:00:00', body: '果壳正文' },
      { platform: 'B站', title: 'B站未读甲', url: 'https://bilibili.com/video/BV1', date: '2026-09-02 08:00:00', body: 'B站正文甲' },
      { platform: 'B站', title: 'B站未读乙', url: 'https://bilibili.com/video/BV2', date: '2026-09-01 08:00:00', body: 'B站正文乙' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(3));

    const siteRow = railRow('果壳科学人');
    expect(siteRow, '站点行应在 rail').toBeTruthy();
    const menu = await contextMenuOn(siteRow);
    const btn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('全部标为已读')) as HTMLElement;
    expect(btn, '站点行应有批量已读入口').toBeTruthy();
    // 修复前：source 落 {kind:'all'} → 计数 = 全库未读 3 篇，一次确认清空整个未读流
    expect(btn.textContent).toContain('（1 篇）');

    btn.click();
    const popup = await vi.waitFor(() => {
      const el = document.querySelector('#__shared_confirm_popup__') as HTMLElement | null;
      expect(el, '确认框应弹出').toBeTruthy();
      return el!;
    });
    expect(popup.textContent).toContain('「果壳科学人」');
    expect(popup.textContent).toContain('1 篇');
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();

    await drainNewsWritesForTests();
    await vi.waitFor(() => {
      const disk = diskNews(vault);
      const byUrl = (u: string) => disk.articles.find((a: any) => a.url === u);
      expect(byUrl('https://guokr.com/g1').read).toBe(true);              // 该站条目已读
      expect(byUrl('https://bilibili.com/video/BV1').read).toBeUndefined(); // 他站未读未被误清
      expect(byUrl('https://bilibili.com/video/BV2').read).toBeUndefined();
      expect(disk.stats.totalRead).toBe(1);                                // 修复前一次确认全库 +3
    });
  });
});

// ================= C5 =================

describe('C5：剪藏正文懒加载水合前清占位（MarkdownRenderer 追加语义）', () => {
  it('首次阅读剪藏：正文顶部不残留「正在读取剪藏正文…」占位', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/正文甲.md', '---\nurl: "https://a.com/1"\ncreated: 2026-08-20 10:00:00\n---\n正文甲第一段。\n\n正文甲第二段。');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(1));

    railRow('剪藏本').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const md = await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-reader] [data-clip-md]') as HTMLElement | null;
      expect(el, '阅读面正文容器应在').toBeTruthy();
      expect(el!.textContent).toContain('正文甲第一段');
      return el!;
    });
    // 修复前：水合是追加语义，占位 <p class="dim"> 与正文同容器共存（正文顶部永久多一行）
    expect(md.textContent).not.toContain('正在读取剪藏正文…');
    expect(md.querySelector('p.dim')).toBeNull();
  });
});

// ================= C6 =================

describe('C6：异步水合产出的 img 补挂失败兜底', () => {
  it('水合后外链图加载失败被摘除（不留裂图）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/图甲.md', '---\nurl: "https://a.com/2"\ncreated: 2026-08-20 10:00:00\n---\n正文前。\n\n![配图](https://img.example/a.png)\n');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(1));

    // 模拟 MarkdownRenderer 产出 img（默认 mock 只写纯文本，不产 img 节点）。用持久实现而非
    // mockImplementationOnce：懒加载水合在渲染管线里可能落到重建后的最新容器，一次性实现会
    // 落在已被替换的旧节点上，断言不到真实 DOM
    const { MarkdownRenderer } = await import('obsidian');
    const renderMock = MarkdownRenderer.render as ReturnType<typeof vi.fn>;
    const original = renderMock.getMockImplementation();
    renderMock.mockImplementation(async (_app: any, md: string, el: HTMLElement) => {
      if (el) el.innerHTML = String(md).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    });
    try {
      railRow('剪藏本').click();
      await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
      const img = await vi.waitFor(() => {
        const el = document.querySelector('[data-clip-reader] [data-clip-md] img') as HTMLImageElement | null;
        expect(el, '水合产出的 img 应在').toBeTruthy();
        return el!;
      });
      // 修复前：bindImgFallback 在异步水合之前跑（当时容器无 img），此图无 error 监听 → 裂图常驻
      img.dispatchEvent(new Event('error'));
      expect(document.querySelector('[data-clip-reader] [data-clip-md] img')).toBeNull();
    } finally {
      if (original) renderMock.mockImplementation(original);
      else renderMock.mockReset();
    }
  });
});

// ================= C7 =================

describe('C7：closePanel 复位移动详情显示态', () => {
  it('详情开着关面板 → 重开不落在上次详情屏（DOM 态与 mobDetailOpen 对齐）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '果壳甲', url: 'https://guokr.com/c7a', date: '2026-09-01 08:00:00', body: 'b1' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));

    const card = document.querySelector('[data-clip-mob-list] .bz-clip-mob-item') as HTMLElement;
    expect(card, '移动目录条目应在').toBeTruthy();
    card.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const detail = document.querySelector('[data-clip-mob-detail]') as HTMLElement;
    expect(detail.style.display).toBe('flex');

    closePanel();
    expect(M.mobDetailOpen).toBe(false);
    expect(detail.style.display).toBe('none'); // 修复前：布尔已复位但 overlay 仍 flex

    showPanel();
    await vi.waitFor(() => expect(M.open).toBe(true));
    // 重开面板 = 新会话落回列表屏；修复前详情 overlay 直接盖在列表上，须手动点返回
    expect((document.querySelector('[data-clip-mob-detail]') as HTMLElement).style.display).toBe('none');
  });
});

// ================= C8 =================

describe('C8：stepArticle 感知搜索态与剪藏源', () => {
  it('搜索态 j 在命中集内步进（不切到无高亮的非命中条目）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '苹果甲', url: 'https://guokr.com/p1', date: '2026-09-03 08:00:00', body: 'b1' },
      { platform: '果壳科学人', title: '香蕉乙', url: 'https://guokr.com/p2', date: '2026-09-02 08:00:00', body: 'b2' },
      { platform: '果壳科学人', title: '苹果丙', url: 'https://guokr.com/p3', date: '2026-09-01 08:00:00', body: 'b3' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(3));

    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '苹果';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    expect(M.list.map((a) => a.title)).toEqual(['苹果甲', '苹果丙']); // 命中集（香蕉乙不在）
    expect(M.cur!.id).toBe('url:https://guokr.com/p1');

    const pane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    // 修复前按未读快照原序步进 → 切到「香蕉乙」（不在命中列表、目录无高亮）
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/p3'));
  });

  it('剪藏本源 j/k 按平铺列表步进（原未读桶对 clip 恒空，静默无效）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/剪藏甲.md', '---\nurl: "https://a.com/c1"\ncreated: 2026-08-21 10:00:00\n---\n甲正文');
    vault.files.set('归档/网页剪藏/剪藏乙.md', '---\nurl: "https://a.com/c2"\ncreated: 2026-08-20 10:00:00\n---\n乙正文');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(2));

    railRow('剪藏本').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    const firstId = M.cur!.id;
    const pane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe(M.list[1].id));
    expect(M.cur!.id).not.toBe(firstId);
  });
});

// ================= C13 =================

describe('C13：移动详情「第 X 则 / N」按 id 查序', () => {
  it('点开未读条目显示实际序号（身份失配不再恒空）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '果壳甲', url: 'https://guokr.com/n1', date: '2026-09-02 08:00:00', body: '正文甲' },
      { platform: '果壳科学人', title: '果壳乙', url: 'https://guokr.com/n2', date: '2026-09-01 08:00:00', body: '正文乙' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(2));

    const cards = [...document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-item')] as HTMLElement[];
    expect(cards.length).toBe(2);
    cards[0].click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    // 修复前：mobItemOrder.indexOf(新实例) 恒 -1 → 期次行序号为空
    expect((document.querySelectorAll('[data-clip-mob-detail] .bz-clip-mob-d-kicker span')[1]).textContent).toBe('第 1 则 / 2');

    (document.querySelector('[data-clip-mob-back]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    const cards2 = [...document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-item')] as HTMLElement[];
    cards2[1].click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    expect((document.querySelectorAll('[data-clip-mob-detail] .bz-clip-mob-d-kicker span')[1]).textContent).toBe('第 2 则 / 2');
  });
});

// ================= C14 =================

describe('C14：已读条目不挂「标记为已读」', () => {
  it('已读条目右键菜单无该项（守卫会静默吞掉，不给无效入口），保存/删除仍在', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([
      { platform: '果壳科学人', title: '已读甲', url: 'https://guokr.com/r1', date: '2026-09-01 08:00:00', body: '正文甲', read: true, state: 'skipped' },
    ]));
    await boot(vault);
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 无未读 → 已读折叠段自动展开，条目在 DOM
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));

    const menu = await contextMenuOn(document.querySelector('.bz-clip-item') as HTMLElement);
    expect(menu.textContent).not.toContain('标记为已读');
    expect(menu.textContent).toContain('保存到剪藏本');
    expect(menu.textContent).toContain('删除');
    await drainNewsWritesForTests();
    const disk = diskNews(vault);
    expect(disk.articles[0].read).toBe(true);      // 未被动过
    expect(disk.stats.totalRead).toBe(0);
  });
});

// ================= C15 =================

describe('C15：剪藏源搜索零命中空态文案', () => {
  it('搜索态零命中显示「查无此条」，不误报「剪藏本为空」', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), seedNews([]));
    vault.files.set('归档/网页剪藏/剪藏甲.md', '---\nurl: "https://a.com/only"\ncreated: 2026-08-20 10:00:00\n---\n甲正文');
    await boot(vault);
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(1));

    railRow('剪藏本').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));

    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '绝对不存在zzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-clip-list')!.textContent).toContain('查无此条'));
    expect(document.querySelector('.bz-clip-list')!.textContent).not.toContain('剪藏本为空');
  });
});
