// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { getNewsFilePath } from '../../src/clipbook/news-data';

const { Platform } = await import('obsidian');

describe('probe2', () => {
  it('probe', async () => {
    (Platform as any).isMobile = true;
    try { unloadClipbook(); } catch (e) { /**/ }
    unloadPanel();
    resetObsidianMocks();
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({
      articles: [
        { platform: 'B站', title: '视频一', url: 'https://b23.tv/1', author: 'x', body: '简介', date: '2026-09-01 08:00:00' },
        { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: 'x', date: '2026-09-01 09:00:00', body: '甲的正文' },
      ],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', knowledgeDirectory: '文献盒', clipbookImageFolder: '' } as any));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    const card = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]].find((el) => el.textContent?.includes('甲文'));
    card!.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    (document.querySelector('[data-clip-mob-save]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.cur?.title).toBe('视频一'));
    await new Promise((r) => setTimeout(r, 200));
    const items = [...document.querySelectorAll('.bz-clip-mob-item') as unknown as HTMLElement[]];
    console.log('TOC 条数:', items.length, '| 文本:', items.map((i) => i.textContent).join(' ## '));
    const folds = [...document.querySelectorAll('.bz-clip-mob-arch') as unknown as HTMLElement[]];
    console.log('折叠段:', folds.map((f) => `${f.getAttribute('data-arch-kind')}:${f.hidden ? 'hidden' : 'open'}`).join(' | '));
    console.log('M.cur:', M.cur?.title, M.cur?.st);
    expect(true).toBe(true);
  });
});
