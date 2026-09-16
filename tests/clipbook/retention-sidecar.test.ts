// @vitest-environment node
/**
 * issue 333 评审修复：保留策略清理超期条目时，其侧写三段（marks/savedImages/pendingSource）
 * 一并清掉——不随清理永久残留。装载器 readNewsAndSidecar 内 fire-and-forget 清理，测试轮询收敛。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { readNewsAndSidecar } from '../../src/clipbook/loader';
import { readClipbookData, updateClipbookData } from '../../src/clipbook/data';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';

const KEY = 'url:https://guokr.com/expired';

function seed(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      // 超期已读（46 天前，默认保留 30 天 → 清理）
      { platform: '果壳科学人', title: '旧文', url: 'https://guokr.com/expired', author: '果壳', date: '2026-08-01 08:00:00', fetchedAt: '2026-08-01 07:00:00', read: true, state: 'saved', body: '旧正文' },
      // 新鲜未读（不动）
      { platform: '果壳科学人', title: '新文', url: 'https://guokr.com/fresh', author: '果壳', date: '2026-09-16 08:00:00', fetchedAt: '2026-09-16 07:00:00', body: '新正文' },
    ],
    stats: { totalRead: 1, totalSaved: 1, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  return vault;
}

describe('保留策略清理同步清侧写（issue 333）', () => {
  beforeEach(() => {
    const vault = seed();
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({
      storagePath: 'CONFIG/STORAGE',
      articleDirectory: '归档/网页剪藏',
      knowledgeDirectory: '文献盒',
      clipbookImageFolder: '',
      newsRetentionUnsavedDays: '30',
    } as any));
  });

  it('超期条目被清理后，其 marks/pendingSource 侧写随之清除', async () => {
    // 预置：旧文曾有划词标记（修复前创建、pendingSource 缺失的存量形态）
    const before = {
      articleOverrides: {}, savedArchive: [], order: [],
      marks: { [KEY]: [{ find: '旧正文片段', notePath: '文献盒/旧名词.md', kind: 'term' as const }] },
      savedImages: {}, pendingSource: { [KEY]: ['文献盒/旧名词.md'] },
    };
    await updateClipbookData(() => before);

    await readNewsAndSidecar();
    await drainNewsWritesForTests();

    // 轮询等 fire-and-forget 清理落地（updateClipbookData 走独立队列）
    let data = await readClipbookData();
    for (let i = 0; i < 20 && (data.marks[KEY] || data.pendingSource[KEY]); i++) {
      await new Promise((r) => setTimeout(r, 50));
      data = await readClipbookData();
    }
    expect(data.marks[KEY]).toBeUndefined();
    expect(data.pendingSource[KEY]).toBeUndefined();
  });
});
