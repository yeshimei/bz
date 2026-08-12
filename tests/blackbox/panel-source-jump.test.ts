/**
 * 黑匣子列表来源点击测试（ticket 07 / ADR-0016）：
 * 摘抄/概念来源行渲染分派（epub 双链/URL/[[笔记]] 可点击 button；纯文本不可点）；
 * 点击触发 jumpFromSource 三分派执行（阅读器 API / openLinkText / window.open）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { seedV3 } from './v3-seed';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxPanel, unloadBlackBoxPanel } from '../../src/blackbox/panel';
import { unloadBlackBox, closeBlackBoxCapture } from '../../src/blackbox';

const EPUB_LINK = '[[书架/三体.epub#weave-cfi=epubcfi(/6/14!/4/2/2/1:0)|三体]]';

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = mockAppWithVault(vault) as any;
  app.plugins = { getPlugin: vi.fn(() => null) };
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

function seedVault(vault: MockVault): void {
  seedV3(vault, {
    settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖'] },
    persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
    entries: [
      // 概念：links[0] = epub 双链（来源可点）
      { id: 'bb_c1', type: 'concept', createdAt: '2026-08-01T00:00:00.000Z', name: '提喻法', definition: '以部分代整体', related: [], emotions: [], people: [], scene: '', toward: '', links: [EPUB_LINK] },
      // 摘抄：URL 来源（可点 → 浏览器）
      { id: 'bb_l1', type: 'literature', createdAt: '2026-08-03T00:00:00.000Z', text: '宇宙很大，生活更大。', source: 'https://example.com/article', terms: [], emotions: [], people: [], scene: '', toward: '', links: [] },
      // 摘抄：[[笔记]] 来源（可点 → 打开笔记）
      { id: 'bb_l2', type: 'literature', createdAt: '2026-08-04T00:00:00.000Z', text: '修辞是语言的弹性。', source: '[[文学课]]', terms: [], emotions: [], people: [], scene: '', toward: '', links: [] },
      // 摘抄：纯文本来源（不可点）
      { id: 'bb_l3', type: 'literature', createdAt: '2026-08-05T00:00:00.000Z', text: '某段摘抄。', source: '《诗学》', terms: [], emotions: [], people: [], scene: '', toward: '', links: [] },
    ],
    profiles: [],
    events: [],
    reviews: [],
    chat: [],
    meta: { lastReviewAt: '', totalEntries: 0, totalEvents: 0 },
  });
}

function sourceButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button.bz-blackbox-source-link'));
}

function sourceTexts(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.bz-blackbox-stream-card-source')).map((el) =>
    (el.textContent || '').replace('📌 ', '')
  );
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  unloadBlackBoxPanel();
  unloadBlackBox();
  closeBlackBoxCapture();
  delete (global as any).fetch;
});

describe('面板来源行渲染分派（ADR-0016）', () => {
  it('epub 双链 / URL / [[笔记]] 来源 → 可点击 button；纯文本来源 → 纯文本不可点', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);

    const btns = sourceButtons();
    expect(btns.length).toBe(3); // epub 双链 + URL + [[笔记]]
    // ticket 50：来源只显示可读名（epub=书名、笔记=笔记名、URL 原样），点击跳转不变
    expect(sourceTexts()).toContain('三体');
    expect(sourceTexts()).toContain('https://example.com/article');
    expect(sourceTexts()).toContain('文学课');
    // 纯文本来源保留为不可点 div（仍在卡片中展示）
    expect(sourceTexts()).toContain('《诗学》');
  });

  it('概念卡来源（links[0] epub 双链）→ 可点击，显示书名', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxPanel(app);
    const conceptCard = document.querySelector('.bz-blackbox-stream-card .bz-blackbox-stream-card-name')?.closest('.bz-blackbox-stream-card');
    expect(conceptCard).toBeTruthy();
    const btn = conceptCard!.querySelector('button.bz-blackbox-source-link') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('三体'); // 只显示书名
  });
});

describe('来源点击执行（jumpFromSource 三分派）', () => {
  it('epub 双链点击 → 调阅读器 openEpubLocationFromLink', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    const openEpubLocationFromLink = vi.fn(async (_link: string) => true);
    app.plugins.getPlugin = vi.fn((id: string) =>
      id === 'weave-epub-reader' ? { openEpubLocationFromLink } : null
    );
    await openBlackBoxPanel(app);

    const epubBtn = sourceButtons().find((b) => b.title?.includes('书内原文位置'))!;
    epubBtn.click();
    await vi.waitFor(() => {
      expect(openEpubLocationFromLink).toHaveBeenCalledTimes(1);
      expect(openEpubLocationFromLink.mock.calls[0][0]).toBe(EPUB_LINK);
    });
  });

  it('epub 双链跳转失败（书缺失）→ toast 提示不静默', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    app.plugins.getPlugin = vi.fn((id: string) =>
      id === 'weave-epub-reader' ? { openEpubLocationFromLink: vi.fn(async () => false) } : null
    );
    await openBlackBoxPanel(app);
    sourceButtons().find((b) => b.title?.includes('书内原文位置'))!.click();
    await vi.waitFor(() => {
      expect(hasNotice(/未能定位原文位置/)).toBe(true);
    });
  });

  it('阅读器未安装 → epub 双链点击 toast 提示', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    app.plugins.getPlugin = vi.fn(() => null);
    await openBlackBoxPanel(app);
    sourceButtons().find((b) => b.title?.includes('书内原文位置'))!.click();
    await vi.waitFor(() => {
      expect(hasNotice(/未安装 EPUB 阅读器插件/)).toBe(true);
    });
  });

  it('URL 来源点击 → window.open', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    const openSpy = vi.fn();
    (global as any).open = openSpy;
    await openBlackBoxPanel(app);

    sourceButtons().find((b) => b.textContent?.includes('example.com'))!.click();
    expect(openSpy).toHaveBeenCalledWith('https://example.com/article', '_blank');
    delete (global as any).open;
  });

  it('[[笔记]] 来源点击 → workspace.openLinkText 打开笔记', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    const openLinkText = vi.fn();
    app.workspace.openLinkText = openLinkText;
    await openBlackBoxPanel(app);

    sourceButtons().find((b) => b.textContent?.includes('文学课'))!.click();
    expect(openLinkText).toHaveBeenCalledWith('文学课', '', false, { active: true });
  });
});
