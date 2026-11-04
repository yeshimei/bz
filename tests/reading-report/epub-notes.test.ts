/**
 * 阅读报告 EPUB 条目测试（ADR-0283）：getEpubBookNotes 从 bz-reader.json 映射为报告 book-note 口径。
 * 深审修复批（bz-fix-rr-core）：RR-F1 subjects 分类通道 / RR-F4 readingDate progress 前置 /
 * RR-F9 会话 type 派生 / RR-F10 非法 start 丢弃；fixture 直接写 bz 阅读的数据文件
 * （缺省数据目录 `bz-reader/storage`，不注入其插件 data.json 的 dataDir），字段按它的 schema
 * （fileRef / comment+createdAt / 秒记账，见 bookshelf/reader-source.ts）——不再经旧数据通道，
 * 也不再往设置里塞路径注入键（数据目录由 bz 阅读自己的 data.json 决定，写在这里只会误导后人）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getEpubBookNotes, calculateReadingStats, analyzeReadingFocus } from '../../src/reading-report/stats';
import { READER_DEFAULT_DATA_DIR } from '../../src/bookshelf/reader-source';
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

/** 本地时区 YYYY-MM-DD（与 P1-20 修复后 stats.toIsoDate 同口径，原 UTC 切片会在时区边界偏移一天） */
function localIsoDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 缺省数据目录（bz 阅读插件的 data.json 未注入 → 回落 `bz-reader/storage`） */
const READER_PATH = `${READER_DEFAULT_DATA_DIR}/bz-reader.json`;

/** bz 阅读落盘形状：顶层 books 是**数组**，书用 fileRef，时长按**秒**记账 */
function readerFile(books: any[]) {
  return JSON.stringify({ version: 1, schemaVersion: 2, books });
}

/** 有想法的划线（thinks 读的是归一后「带 comment 的 highlights」条数） */
function highlightWithComment(ts: number) {
  return { id: 'h1', text: '原文一', comment: '想法一', createdAt: ts };
}

describe('getEpubBookNotes（ADR-0283）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    // 数据目录解析只认 bz 阅读插件自己的 data.json（未注入 = 缺省 bz-reader/storage）
    setSettingsProvider(() => ({}) as any);
  });

  function seedReaderData(books: any[]) {
    vault.files.set(READER_PATH, readerFile(books));
  }

  it('映射 frontmatter 口径（进度/时长/划线/想法/日期/页码估算）', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '赫尔曼·黑塞', wordCount: 60000, chapterCount: 12 },
        reading: {
          position: { chapterIndex: 2, cfi: '', percent: 50 },
          // bz 阅读按秒记账：3600 秒 → 归一后 3600000 毫秒
          stats: { totalReadTime: 3600, lastReadTime: 1735000000000, completedTime: 1735600000000 },
          sessions: [
            { start: 1734900000000, end: 1734900700000, durationSeconds: 700 },
          ],
        },
        notes: {
          bookmarks: [],
          highlights: [highlightWithComment(1734900000000)],
          // excerpts 是 highlights 的同 id 镜像（bz 阅读的真实落盘形态）
          excerpts: [highlightWithComment(1734900000000)],
        },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);

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
    expect(e.frontmatter.readingDate).toBe(localIsoDate(1735000000000)); // 本地时区日期（P1-20）
    expect(e.frontmatter.completionDate).toBe(localIsoDate(1735600000000));
    expect(e.frontmatter.dialogue).toBe(0);
    // 无 subjects → 报告侧缺省串（宿主书架侧为 null，经 categoryLabel 同归「未分类」桶）
    expect(e.frontmatter.category).toBe('未分类');
  });

  it('RR-F1：meta.subjects 分类接 ADR-0099 通道——与书架墙 buildEpubItem 同源不再整体「未分类」', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '黑塞', subjects: ['中国古典文学', '哲学'] },
        reading: {
          position: { percent: 0.5 },
          stats: { totalReadTime: 60, lastReadTime: 1735000000000 },
          sessions: [],
        },
        notes: { bookmarks: [], highlights: [] },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);
    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries[0].frontmatter.category).toBe('中国古典文学'); // subjects[0]（ADR-0099 决策 4）
    // subjects 空/非串 → 回落「未分类」
    seedReaderData([
      {
        id: 'bk_002',
        fileRef: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', subjects: ['', 42] },
        reading: { position: { percent: 0.5 }, stats: { totalReadTime: 0, lastReadTime: 0 }, sessions: [] },
        notes: {},
        addedAt: 1734800000000,
        updatedAt: 1734800000000,
      },
    ]);
    const entries2 = await getEpubBookNotes(makeApp(vault));
    expect(entries2[0].frontmatter.category).toBe('未分类'); // subjects 空/非串回落
  });

  it('readingSessions 转换：duration 单位秒、type 派生（RR-F9）', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', author: '卡尔·萨根', wordCount: 30000, chapterCount: 8 },
        reading: {
          position: { chapterIndex: 0, cfi: '', percent: 10 },
          stats: { totalReadTime: 3600, lastReadTime: 1735000000000 },
          sessions: [
            { start: 1734900000000, end: 1734901200000, durationSeconds: 1200 },
            { start: 1734901300000, end: 1734901650000, durationSeconds: 350 },
          ],
        },
        notes: { bookmarks: [], highlights: [] },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);

    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries[0].frontmatter.readingSessions).toEqual([
      { start: 1734900000000, end: 1734901200000, duration: 1200, type: 'completed' },
      { start: 1734901300000, end: 1734901650000, duration: 350, type: 'completed' },
    ]);
  });

  it('RR-F9：EPUB 会话并入专注度——完成率不再恒 0（type 派生口径）', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', author: '卡尔·萨根' },
        reading: {
          position: { percent: 0.5 },
          stats: { totalReadTime: 7200, lastReadTime: 1735000000000 },
          sessions: [
            { start: 1734900000000, end: 1734901200000, durationSeconds: 1200 },
            { start: 1734902000000, end: 1734903800000, durationSeconds: 1800 },
          ],
        },
        notes: { bookmarks: [], highlights: [] },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);
    const entries = await getEpubBookNotes(makeApp(vault));
    const focus = analyzeReadingFocus(entries[0].frontmatter.readingSessions, entries);
    // type 派生前完成率恒 0 → 完成度 30 分权重拿不到（总分 ≈48）；派生后 ≥60
    expect(focus.focusScore).toBeGreaterThan(60);
  });

  it('RR-F10：start 缺失/非法（0）的会话直接丢弃——不落 1970 幽灵月', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', author: '卡尔·萨根' },
        reading: {
          position: { percent: 0.5 },
          stats: { totalReadTime: 7200, lastReadTime: 1735000000000 },
          sessions: [
            { start: 0, end: 600000, durationSeconds: 600 },
            { durationSeconds: 300 },
            { start: 1734900000000, end: 1734900700000, durationSeconds: 700 },
          ],
        },
        notes: { bookmarks: [], highlights: [] },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);
    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries[0].frontmatter.readingSessions).toEqual([
      { start: 1734900000000, end: 1734900700000, duration: 700, type: 'completed' },
    ]);
    const stats = calculateReadingStats(entries);
    // 热力图月键全集不含 1970
    const { getHeatmapMonthKeys, processHeatmapData } = await import('../../src/reading-report/stats');
    expect(getHeatmapMonthKeys(processHeatmapData(stats.readingSessions)).join(',')).not.toContain('1970');
  });

  it('RR-F4：进度重置 0（重读）→ readingDate 为 null——与书架墙「未读」口径一致', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '黑塞' },
        reading: {
          position: { percent: 0 },
          stats: { totalReadTime: 60, lastReadTime: 1735000000000 }, // lastReadTime 在但 progress=0
          sessions: [],
        },
        notes: { bookmarks: [], highlights: [] },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);
    const entries = await getEpubBookNotes(makeApp(vault));
    expect(entries[0].frontmatter.readingDate).toBeNull();
    const stats = calculateReadingStats(entries);
    expect(stats.readingBooks).toBe(0); // 不再「报告在读、书架未读」两侧分叉
  });

  it('缺 title/vaultPath 的书跳过；bz-reader 数据缺失 → 空数组', async () => {
    expect(await getEpubBookNotes(makeApp(vault))).toEqual([]);
    seedReaderData([{ id: 'bad', fileRef: { vaultPath: '' }, meta: {}, addedAt: 1, updatedAt: 1 }]);
    expect(await getEpubBookNotes(makeApp(vault))).toEqual([]);
  });

  it('并入 calculateReadingStats：会话/时长/划线都计入统计', async () => {
    seedReaderData([
      {
        id: 'bk_001',
        fileRef: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '赫尔曼·黑塞', wordCount: 60000 },
        reading: {
          position: { chapterIndex: 2, cfi: '', percent: 100 },
          stats: { totalReadTime: 3600, lastReadTime: 1735000000000, completedTime: 1735600000000 },
          sessions: [{ start: 1734900000000, end: 1734900700000, durationSeconds: 700 }],
        },
        notes: {
          bookmarks: [],
          highlights: [highlightWithComment(1734900000000)],
          // 同 id 镜像（见首个用例说明）
          excerpts: [highlightWithComment(1734900000000)],
        },
        addedAt: 1734800000000,
        updatedAt: 1735000000000,
      },
    ]);

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
