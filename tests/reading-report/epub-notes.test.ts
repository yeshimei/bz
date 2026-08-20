/**
 * 阅读报告 EPUB 条目测试（ADR-0013 扩展）：getEpubBookNotes 从 weave-data.json 映射为报告 book-note 口径。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getEpubBookNotes, calculateReadingStats } from '../../src/reading-report/stats';
import { MockVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const fm = parseFrontmatter(content);
        return fm && Object.keys(fm).length ? { frontmatter: fm } : null;
      },
    },
    workspace: {},
  } as any;
}

describe('getEpubBookNotes（ADR-0013 扩展）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ weaveDataPath: 'CONFIG/STORAGE' }) as any);
  });

  function seedWeaveData(books: any) {
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({ schemaVersion: 2, books }));
  }

  it('映射 frontmatter 口径（进度/时长/划线/想法/日期/页码估算）', async () => {
    seedWeaveData({
      bk_001: {
        id: 'bk_001',
        file: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '赫尔曼·黑塞', wordCount: 60000, chapterCount: 12 },
        reading: {
          position: { chapterIndex: 2, cfi: '', percent: 50 },
          stats: { totalReadTime: 3600000, lastReadTime: 1735000000000, completedTime: 1735600000000 },
          sessions: [
            { start: 1734900000000, end: 1734900700000, durationSeconds: 700 },
          ],
        },
        notes: { bookmarks: [], highlights: [{ id: 'h1' }], excerpts: [{ id: 'e1' }] },
      },
    });

    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries.length).toBe(1);
    const e = entries[0];
    expect(e.frontmatter.title).toBe('悉达多');
    expect(e.frontmatter.author).toBe('赫尔曼·黑塞');
    expect(e.frontmatter.readingProgress).toBe(50);
    expect(e.frontmatter.readingTime).toBe(3600000);
    expect(e.frontmatter.pages).toBe(Math.floor(60000 / 500)); // 120
    expect(e.frontmatter.highlights).toBe(1);
    expect(e.frontmatter.thinks).toBe(1);
    expect(e.frontmatter.readingDate).toBe(new Date(1735000000000).toISOString().slice(0, 10));
    expect(e.frontmatter.completionDate).toBe(new Date(1735600000000).toISOString().slice(0, 10));
    expect(e.frontmatter.dialogue).toBe(0);
    expect(e.frontmatter.category).toBe('未分类');
  });

  it('readingSessions 转换：duration 单位秒、start/end 原样', async () => {
    seedWeaveData({
      bk_001: {
        id: 'bk_001',
        file: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', author: '卡尔·萨根', wordCount: 30000, chapterCount: 8 },
        reading: {
          position: { chapterIndex: 0, cfi: '', percent: 10 },
          stats: { totalReadTime: 3600000, lastReadTime: 1735000000000 },
          sessions: [
            { start: 1734900000000, end: 1734901200000, durationSeconds: 1200 },
            { start: 1734901300000, end: 1734901650000, durationSeconds: 350 },
          ],
        },
        notes: { bookmarks: [], highlights: [], excerpts: [] },
      },
    });

    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries[0].frontmatter.readingSessions).toEqual([
      { start: 1734900000000, end: 1734901200000, duration: 1200 },
      { start: 1734901300000, end: 1734901650000, duration: 350 },
    ]);
  });

  it('缺 title/vaultPath 的书跳过；weave-data 缺失 → 空数组', async () => {
    expect(await getEpubBookNotes(makeApp(vault))).toEqual([]);
    seedWeaveData({ bad: { id: 'bad', file: { vaultPath: '' }, meta: {} } });
    expect(await getEpubBookNotes(makeApp(vault))).toEqual([]);
  });

  it('并入 calculateReadingStats：会话/时长/划线都计入统计', async () => {
    seedWeaveData({
      bk_001: {
        id: 'bk_001',
        file: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '赫尔曼·黑塞', wordCount: 60000 },
        reading: {
          position: { chapterIndex: 2, cfi: '', percent: 100 },
          stats: { totalReadTime: 3600000, lastReadTime: 1735000000000, completedTime: 1735600000000 },
          sessions: [{ start: 1734900000000, end: 1734900700000, durationSeconds: 700 }],
        },
        notes: { bookmarks: [], highlights: [{ id: 'h1' }], excerpts: [{ id: 'e1' }] },
      },
    });

    const entries = await getEpubBookNotes(makeApp(vault));
    const stats = calculateReadingStats(entries);
    expect(stats.totalBooks).toBe(1);
    expect(stats.readBooks).toBe(1); // completedTime → 已读
    expect(stats.totalReadingTime).toBe(3600000);
    expect(stats.totalHighlights).toBe(1);
    expect(stats.totalThinks).toBe(1);
    expect(stats.readingSessions.length).toBe(1); // 700s > 60s 保留
    expect(stats.readingSpeed.totalPages).toBe(Math.floor(60000 / 500));
  });
});
