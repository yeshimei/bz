// @vitest-environment node
/**
 * 书架墙（bookshelf）数据层测试：md 解析/状态派生/EPUB 聚合/排序/统计/目录回落
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import {
  scanMarkdownBooks, loadEpubItems, sortItems, kwFilter, currentSideItems, computeStats,
  resolveFolderPath, formatReadingTime,
} from '../../src/bookshelf/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('书库/认知觉醒.md', `---
tags: [book]
author: 周岭
category: 成长
readingDate: 2026-08-01
readingProgress: 60
readingTimeFormat: 3小时20分
highlights: 12
thinks: 3
bookReview: 值得反复读
---`);
  vault.files.set('书库/小说/围城.md', `---
tags: book
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
---`);
  vault.files.set('书库/未分类/算法导论.md', `---
tags: [book]
author: CLRS
---`);
  // 目录下非 book 标签的书：不出现
  vault.files.set('书库/别处.md', '---\ntags: [literature]\n---');
  const app = makeApp(vault);
  return { vault, app };
}

describe('bookshelf 数据层', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    M.folderPath = '书库';
  });
  afterEach(() => {
    setSettingsProvider(null as any);
  });

  it('解析 md 书目：字段/cover 前缀/status 三态/子文件夹', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(items.length).toBe(3);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byTitle['认知觉醒'].author).toBe('周岭');
    expect(byTitle['认知觉醒'].category).toBe('成长');
    expect(byTitle['认知觉醒'].readingTimeFormat).toBe('3小时20分');
    expect(byTitle['认知觉醒'].highlights).toBe(12);
    expect(byTitle['认知觉醒'].status).toBe('在读');
    expect(byTitle['围城'].status).toBe('已读');
    expect(byTitle['算法导论'].status).toBe('未读');
    expect(byTitle['围城'].progress).toBe(100);
    expect(byTitle['认知觉醒'].isEpub).toBe(false);
  });

  it('cover 无斜杠 → 拼 CONFIG/BOOK/书名/', () => {
    const vault = new MockVault();
    vault.files.set('书库/A.md', '---\ntags: [book]\ncover: cover.jpg\n---');
    const app = makeApp(vault);
    const [it] = scanMarkdownBooks(app);
    expect(it?.cover).toBe('CONFIG/BOOK/A/cover.jpg');
  });

  it('cover 已是路径 → 原样', () => {
    const vault = new MockVault();
    vault.files.set('书库/B.md', '---\ntags: [book]\ncover: CONFIG/BOOK/x/1.jpg\n---');
    const app = makeApp(vault);
    const [it] = scanMarkdownBooks(app);
    expect(it?.cover).toBe('CONFIG/BOOK/x/1.jpg');
  });

  it('目录回落：新键优先 → libraryFolderPath → 书库', () => {
    expect(resolveFolderPath()).toBe('书库');
    setSettingsProvider(() => ({ libraryFolderPath: '旧书库' } as any));
    expect(resolveFolderPath()).toBe('旧书库');
    setSettingsProvider(() => ({ bookshelfFolderPath: '我的书', libraryFolderPath: '旧书库' } as any));
    expect(resolveFolderPath()).toBe('我的书');
  });

  it('EPUB 聚合条目：从 weave-data.json 构建（ADR-0013 口径）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: {
          meta: { title: '百年孤独', author: '马尔克斯' },
          file: { vaultPath: 'books/百年孤独.epub', sourceId: 's1' },
          reading: { position: { percent: 0.62 }, stats: { lastReadTime: 1725000000000, completedTime: 0, totalReadTime: 10800000 } },
          notes: { highlights: [{ id: 'h1', text: 'xx' }], excerpts: [{ id: 'e1' }] },
        },
        b: {
          meta: { title: '没有路径的书' },
          file: {},
        },
      },
    }));
    const app = makeApp(vault);
    const items = await loadEpubItems(app);
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.title).toBe('百年孤独');
    expect(it.isEpub).toBe(true);
    expect(it.status).toBe('在读');
    expect(it.progress).toBe(62);
    expect(it.readingTimeFormat).toBe('3小时');
    expect(it.highlights).toBe(1);
    expect(it.thinks).toBe(1);
    expect(it.epubVaultPath).toBe('books/百年孤独.epub');
  });

  it('formatReadingTime：毫秒 → 中文时长', () => {
    expect(formatReadingTime(0)).toBeNull();
    expect(formatReadingTime(45 * 60000)).toBe('45分');
    expect(formatReadingTime(3 * 3600000 + 20 * 60000)).toBe('3小时20分');
  });

  it('computeStats：状态分布/今年读完/时长/近 12 月读完柱', () => {
    const { app } = seedVault();
    M.items = [...scanMarkdownBooks(app)];
    const s = computeStats(new Date(2026, 8, 3));
    expect(s.reading.length).toBe(1); // 认知觉醒（无 completionDate）
    expect(s.done.length).toBe(1); // 围城
    expect(s.unread.length).toBe(1); // 算法导论
    expect(s.doneThisYear.length).toBe(1);
    // 3小时20分 → 3 小时（向下取整小时）
    expect(s.totalHours).toBe(3);
    // 围城 2026-08 读完 → 8 月柱 count=1（bars[0] 是本月，向左排到 11 个月前）
    const aug = s.bars.find((b) => b.label === '8月')!;
    expect(aug.count).toBe(1);
    expect(s.bars[0].label).toBe('本月');
  });

  it('排序：date 主日期倒序/无日期排后；title/author/progress', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    const byDate = sortItems(items, 'date');
    expect(byDate[0].title).toBe('围城'); // completionDate 2026-08-15 最新
    expect(byDate[2].title).toBe('算法导论'); // 无日期排最后
    const byTitle = sortItems(items, 'title').map((i) => i.title);
    expect(byTitle).toEqual(['算法导论', '围城', '认知觉醒'].sort((a, b) => a.localeCompare(b, 'zh')));
    const byProg = sortItems(items, 'progress');
    expect(byProg[0].title).toBe('围城');
    expect(byProg[2].title).toBe('算法导论');
  });

  it('kwFilter：书名/作者/分类命中', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(kwFilter(items, '钱钟书').length).toBe(1);
    expect(kwFilter(items, '成长').length).toBe(1);
    expect(kwFilter(items, '觉醒').length).toBe(1);
    expect(kwFilter(items, '不存在').length).toBe(0);
  });

  it('currentSideItems：在读/未读/已读/全部', () => {
    const { app } = seedVault();
    const items = scanMarkdownBooks(app);
    expect(currentSideItems(items, 'all').length).toBe(3);
    expect(currentSideItems(items, 'reading').length).toBe(1);
    expect(currentSideItems(items, 'unread').length).toBe(1);
    expect(currentSideItems(items, 'done').length).toBe(1);
  });
});
