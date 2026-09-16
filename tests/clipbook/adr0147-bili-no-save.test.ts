// @vitest-environment jsdom
/**
 * ADR-0147 / issue 329 评审跟进：B站条目去除保存至剪藏 + 已存按钮置灰 + 捕获阶段拦截。
 * - B站条目：桌面菜单无「保存到剪藏本」、移动详情头栏保存钮隐藏
 * - 已存条目：移动保存钮置灰，再点不触发保存流
 * - 锚定双链点击：捕获阶段 stopPropagation，Obsidian 式 document 委托监听不再同时原生导航
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { getNewsFilePath } from '../../src/clipbook/news-data';

const knowledgeMocks: Record<string, any> = await import('../../src/knowledge');

vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  openTermNote: vi.fn(),
  openPassageNote: vi.fn(),
  openImageNote: vi.fn(),
  openKnowledgePreview: vi.fn(async () => {}),
  upgradeNoteSourceInternal: vi.fn(async () => true),
}));

const { Platform } = await import('obsidian');

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      { platform: 'B站', title: '视频一', url: 'https://b23.tv/1', author: '影视飓风', body: '简介', date: '2026-09-01 08:00:00' },
      { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 09:00:00', body: '甲的正文' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  unloadPanel();
  resetObsidianMocks();
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));
  openClipbook(getApp());
  return vault;
}

function deskCard(title: string): HTMLElement {
  const card = [...document.querySelectorAll('[data-id]') as unknown as HTMLElement[]]
    .find((el) => el.textContent?.includes(title));
  expect(card, `目录里应能找到 ${title}`).toBeTruthy();
  return card!;
}

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as any).isMobile = false;
  clearNotices();
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
});

beforeEach(() => {
  for (const fn of [knowledgeMocks.openKnowledgeAddTask, knowledgeMocks.openTermNote, knowledgeMocks.openKnowledgePreview]) {
    (fn as ReturnType<typeof vi.fn>).mockClear();
  }
});

describe('B站条目去除保存至剪藏（ADR-0147）', () => {
  it('桌面条目菜单：B站无「保存到剪藏本」，果壳有', async () => {
    boot();
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const bili = deskCard('视频一');
    bili.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const labels = [...document.querySelectorAll('.bz-item-menu-item') as unknown as HTMLElement[]].map((el) => el.textContent || '');
    expect(labels.some((t) => t.includes('保存到剪藏本'))).toBe(false);
    (document.querySelector('.bz-item-menu') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // 对照组：果壳条目有
    const gk = deskCard('甲文');
    gk.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const ls = [...document.querySelectorAll('.bz-item-menu-item') as unknown as HTMLElement[]].map((el) => el.textContent || '');
      expect(ls.some((t) => t.includes('保存到剪藏本'))).toBe(true);
    });
  });

  it('移动详情：B站条目头栏保存钮隐藏', async () => {
    boot();
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('视频一'));
    card!.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const save = document.querySelector('[data-clip-mob-save]') as HTMLElement;
    expect(save.style.display).toBe('none');
  });

  it('已存条目保存钮置灰：再点不触发保存流（不重复计数）', async () => {
    const vault = boot();
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('甲文'));
    card!.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const save = document.querySelector('[data-clip-mob-save]') as HTMLElement;
    save.click(); // 第一次：正常保存
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      const disk = JSON.parse(vault.files.get(getNewsFilePath()) as string);
      expect(disk.stats.totalSaved).toBe(1);
    });
    // 保存后自动前进到邻位（issue 332 动线）
    await vi.waitFor(() => expect(M.cur?.title).toBe('视频一'));
    // 重开面板（新会话）→ 从已收段再打开已存的甲文
    unloadClipbook();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const again = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('甲文'));
    expect(again, '已收段应有甲文').toBeTruthy();
    again!.click();
    await vi.waitFor(() => expect(M.cur?.title).toBe('甲文'));
    await vi.waitFor(() => expect(M.cur?.st).toBe('saved'));
    const save2 = document.querySelector('[data-clip-mob-save]') as HTMLElement;
    expect(save2.textContent).toBe('已存');
    expect(save2.classList.contains('disabled')).toBe(true); // 置灰
    save2.click(); // 置灰后点击无效：不触发保存流
    await drainNewsWritesForTests();
    const disk = JSON.parse(vault.files.get(getNewsFilePath()) as string);
    expect(disk.stats.totalSaved).toBe(1); // 不重复计数
    expect(vault.files.has('归档/网页剪藏/甲文 2.md')).toBe(false);
  });
});

describe('锚定双链点击：捕获阶段掐断原生导航（移动端崩溃修复）', () => {
  it('预览打开的同时，document 级委托监听（模拟 Obsidian）不再被触发', async () => {
    const vault = boot();
    (Platform as any).isMobile = true;
    vault.files.set('文献盒/量子纠缠笔记.md', '---\ntitle: 量子纠缠笔记\ntype: term\n---\n名词正文。');
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('甲文'));
    card!.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('[data-clip-mob-md]')).toBeTruthy());
    // 手动注入 internal-link（mock MarkdownRenderer 不产真实锚点，行为单源测试同款做法）。
    // data-href 用裸 basename（真实别名双链 `[[量子纠缠笔记|量子纠缠]]` 的渲染形态，issue 336）
    const md = document.querySelector('[data-clip-mob-md]') as HTMLElement;
    md.innerHTML = '<p><a class="internal-link" data-href="量子纠缠笔记" href="量子纠缠笔记">量子纠缠</a></p>';
    // 模拟 Obsidian 的 document 级委托监听（原生导航通道）
    let navigated = '';
    const spy = (e: Event) => {
      const a = (e.target as HTMLElement).closest('a.internal-link') as HTMLAnchorElement | null;
      if (a) navigated = a.dataset.href || '';
    };
    document.addEventListener('click', spy);
    (md.querySelector('a.internal-link') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledTimes(1));
    expect(navigated).toBe(''); // stopPropagation 掐断：原生导航通道未触发
    document.removeEventListener('click', spy);
  });
});

describe('锚定双链裸 basename 解析（issue 336：桌面无反应/移动端崩溃根因）', () => {
  /** 打开移动详情并注入裸 basename 锚点（真实渲染形态），点击后断言预览直达/原生回退 */
  async function clickBasenameAnchor(vault: MockVault, href: string): Promise<void> {
    (Platform as any).isMobile = true;
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('甲文'));
    card!.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('[data-clip-mob-md]')).toBeTruthy());
    const md = document.querySelector('[data-clip-mob-md]') as HTMLElement;
    md.innerHTML = `<p><a class="internal-link" data-href="${href}" href="${href}">锚</a></p>`;
    (md.querySelector('a.internal-link') as HTMLElement).click();
  }

  it('盒内同名笔记直查：mock 无任何链接解析 API（≈真实 Obsidian 无 getFirstLinkfileDest）仍拦截直达预览', async () => {
    const vault = boot();
    vault.files.set('文献盒/量子纠缠笔记.md', '---\ntitle: 量子纠缠笔记\ntype: term\n---\n名词正文。');
    await clickBasenameAnchor(vault, '量子纠缠笔记');
    await vi.waitFor(() => expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledTimes(1));
    expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledWith(expect.anything(), '文献盒/量子纠缠笔记.md');
  });

  it('盒内子目录笔记：getFirstLinkpathDest 兜底解析（TFile.path）后拦截', async () => {
    const vault = boot();
    vault.files.set('文献盒/子目录/长名词.md', '---\ntitle: 长名词\ntype: term\n---\n正文。');
    // 直查未命中（不在盒根）→ 走 metadataCache 兜底；mock 先于点击就位
    const app: any = getApp();
    app.metadataCache.getFirstLinkpathDest = (p: string) => ({ path: '文献盒/子目录/长名词.md', name: p });
    await clickBasenameAnchor(vault, '长名词');
    await vi.waitFor(() => expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledTimes(1));
    expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledWith(expect.anything(), '文献盒/子目录/长名词.md');
  });

  it('解析失败（盒内外都不存在）：不拦，原生导航通道不触发预览', async () => {
    const vault = boot();
    await clickBasenameAnchor(vault, '不存在的笔记');
    await new Promise((r) => setTimeout(r, 30));
    expect(knowledgeMocks.openKnowledgePreview).not.toHaveBeenCalled();
  });
});
