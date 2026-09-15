// @vitest-environment jsdom
/**
 * memo item-1789357688430-zrurtk 回归：「保存至剪藏后自动打开的下一篇未跳开头、未标已读」。
 * 根因：refreshAfterAction 的落位回退（当前条目出收件流 → M.cur 落邻位）绕过 selectArticle，
 * 换篇不标已读、滚动位残留前一篇。修复后：自动前进的下一篇补齐换篇语义——打开即已读 +
 * 双端滚动归零。本文件把这条用户动线钉进回归。
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
import { getNewsFilePath } from "../../src/clipbook/news-data";

const { Platform } = await import('obsidian');

/** 种子：同站三篇未读（甲/乙/丙），「读下一则」与桌面步进都有真实邻位 */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '甲的正文' },
      { platform: '果壳科学人', title: '乙文', url: 'https://guokr.com/2', author: '果壳', date: '2026-09-01 09:00:00', fetchedAt: '2026-09-01 07:00:00', body: '乙的正文' },
      { platform: '果壳科学人', title: '丙文', url: 'https://guokr.com/3', author: '果壳', date: '2026-09-01 10:00:00', fetchedAt: '2026-09-01 07:00:00', body: '丙的正文' },
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
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));
  openClipbook(getApp());
  return vault;
}

async function openMobDetailByTitle(title: string): Promise<void> {
  await vi.waitFor(() => expect(M.articles.length).toBe(3));
  const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]]
    .find((el) => el.textContent?.includes(title));
  expect(card, `目录里应能找到 ${title}`).toBeTruthy();
  card!.click();
  await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
  await vi.waitFor(() => expect(M.cur?.title).toBe(title));
}

function mobNewsReadBit(vault: MockVault, url: string): boolean | undefined {
  const raw = JSON.parse(vault.files.get(getNewsFilePath()) as string);
  return raw.articles.find((a: any) => a.url === url)?.read;
}

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as any).isMobile = false;
  clearNotices();
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
});

beforeEach(() => {
  (Platform as any).isMobile = true; // 本文件全是移动动线
});

describe('memo zrurtk：保存剪藏后前进下一篇的已读与滚动（现状钉住）', () => {
  it('移动保存甲文 → 自动前进乙文：打开即已读 + 详情滚动归零', async () => {
    const vault = boot();
    await openMobDetailByTitle('甲文');
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    body.scrollTop = 120; // 前一篇的滚动位不得带到下一篇
    (document.querySelector('[data-clip-mob-save]') as HTMLElement).click();
    // 保存条目自身已读 + 落盘
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      expect(mobNewsReadBit(vault, 'https://guokr.com/1')).toBe(true);
    });
    // 自动前进到落位邻位乙文（「处理后前进下一篇」动线）
    await vi.waitFor(() => expect(M.cur?.title).toBe('乙文'));
    // 换篇语义补齐：下一篇打开即已读
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      expect(mobNewsReadBit(vault, 'https://guokr.com/2')).toBe(true);
    });
    // 转跳至开头
    expect(body.scrollTop).toBe(0);
  });

  it('自动前进到乙文后点「读下一则」→ 丙文同样已读 + 滚动归零', async () => {
    const vault = boot();
    await openMobDetailByTitle('甲文');
    (document.querySelector('[data-clip-mob-save]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.cur?.title).toBe('乙文'));
    const body = document.querySelector('[data-clip-mob-detail-body]') as HTMLElement;
    body.scrollTop = 120;
    (document.querySelector('[data-clip-mob-next]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.cur?.title).toBe('丙文'));
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      expect(mobNewsReadBit(vault, 'https://guokr.com/3')).toBe(true);
    });
    expect(body.scrollTop).toBe(0);
  });

  it('章末「读下一则」→ 回目录（不崩溃、不串篇）', async () => {
    boot();
    await openMobDetailByTitle('丙文');
    (document.querySelector('[data-clip-mob-next]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    expect(M.cur?.title).toBe('丙文');
  });

  it('桌面保存 → 自动前进乙文：打开即已读 + 阅读滚动归零', async () => {
    const vault = boot();
    (Platform as any).isMobile = false;
    await vi.waitFor(() => expect(M.articles.length).toBe(3));
    // 桌面右栏选中甲文（点目录首条）
    const card = [...document.querySelectorAll('[data-id]') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('甲文'));
    card!.click();
    await vi.waitFor(() => expect(M.cur?.title).toBe('甲文'));
    const readPane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    (readPane.querySelector('.bz-clip-read-scroll') as HTMLElement).scrollTop = 90;
    // 右键条目菜单「保存到剪藏本」
    card!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const act = [...document.querySelectorAll('.bz-item-menu-item') as unknown as HTMLElement[]]
        .find((el) => el.textContent?.includes('保存到剪藏本'));
      expect(act).toBeTruthy();
    });
    const act = [...document.querySelectorAll('.bz-item-menu-item') as unknown as HTMLElement[]]
      .find((el) => el.textContent?.includes('保存到剪藏本')) as HTMLElement;
    act.click();
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      expect(mobNewsReadBit(vault, 'https://guokr.com/1')).toBe(true);
    });
    // 自动前进乙文（换篇语义补齐）：打开即已读 + 阅读滚动归零
    await vi.waitFor(() => expect(M.cur?.title).toBe('乙文'));
    await vi.waitFor(async () => {
      await drainNewsWritesForTests();
      expect(mobNewsReadBit(vault, 'https://guokr.com/2')).toBe(true);
    });
    expect((readPane.querySelector('.bz-clip-read-scroll') as HTMLElement).scrollTop).toBe(0);
  });
});
