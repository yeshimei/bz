/**
 * 书库 items 测试（ticket 12）：getBookItems / sortItemList / getSubfolder / getStatusColors。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getBookItems, sortItemList, getSubfolder, loadEpubBookItems, resolveWeaveDataPath } from '../../src/library/items';
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
    // 模拟已装 Weave EPUB Reader（ticket 65：weave 数据路径改由插件配置提供）
    plugins: { plugins: { 'weave-epub-reader': { settings: { dataPath: 'CONFIG/STORAGE' } } } },
  } as any;
}

const BOOK_MD = `---
tags: ["book"]
author: "余华"
category: "小说"
cover: "cover.jpg"
readingDate: 2025-06-01
completionDate: 2025-07-01
readingProgress: 100
readingTimeFormat: "2小时30分"
highlights: 12
thinks: 3
bookReview: "好书"
---
正文
`;

describe('getSubfolder', () => {
  it('第一段目录；无则 null', () => {
    expect(getSubfolder('书库/小说/活着.md', '书库')).toBe('小说');
    expect(getSubfolder('书库/活着.md', '书库')).toBeNull();
  });
});

describe('resolveWeaveDataPath（ticket 65：读 Weave 插件配置）', () => {
  it('读 Weave EPUB Reader 的 settings.dataPath', () => {
    const app = { plugins: { plugins: { 'weave-epub-reader': { settings: { dataPath: 'CUSTOM/阅读数据' } } } } };
    expect(resolveWeaveDataPath(app)).toBe('CUSTOM/阅读数据');
  });

  it('插件未装 / 字段缺失 / 空 app → 默认 CONFIG/STORAGE', () => {
    expect(resolveWeaveDataPath({})).toBe('CONFIG/STORAGE');
    expect(resolveWeaveDataPath({ plugins: { plugins: { 'weave-epub-reader': { settings: {} } } } })).toBe('CONFIG/STORAGE');
    expect(resolveWeaveDataPath({ plugins: { plugins: {} } })).toBe('CONFIG/STORAGE');
    expect(resolveWeaveDataPath(undefined)).toBe('CONFIG/STORAGE');
  });
});

describe('getBookItems', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
  });

  it('只收 book 标签 + 目录内文件；字段解析', () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('书库/其他.md', '---\ntags: ["note"]\n---\n正文');
    vault.files.set('Inbox/外面.md', '---\ntags: ["book"]\n---\n正文');
    const items = getBookItems(makeApp(vault));
    expect(items.length).toBe(1);
    const b = items[0];
    expect(b.title).toBe('活着');
    expect(b.author).toBe('余华');
    expect(b.category).toBe('小说');
    expect(b.cover).toBe('CONFIG/BOOK/活着/cover.jpg'); // 无斜杠拼路径
    expect(b.status).toBe('已读');
    expect(b.readingProgress).toBe(100);
    expect(b.highlights).toBe(12);
    expect(b.subfolder).toBeNull();
  });

  it('状态判定：readingDate 无 completionDate → 在读；无 readingDate → 未读', () => {
    vault.files.set('书库/A.md', '---\ntags: ["book"]\nreadingDate: 2025-06-01\n---\n正文');
    vault.files.set('书库/B.md', '---\ntags: ["book"]\n---\n正文');
    const items = getBookItems(makeApp(vault));
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.status]));
    expect(byTitle['A']).toBe('在读');
    expect(byTitle['B']).toBe('未读');
  });

  it('cover 含斜杠 → 原样', () => {
    vault.files.set('书库/C.md', '---\ntags: ["book"]\ncover: "附件/c.png"\n---\n正文');
    const items = getBookItems(makeApp(vault));
    expect(items[0].cover).toBe('附件/c.png');
  });

  it('audit H：readingProgress 非法值 → 兜底 0（不再 NaN 污染进度条与排序）', () => {
    vault.files.set('书库/坏进度.md', '---\ntags: ["book"]\nreadingDate: 2025-06-01\nreadingProgress: abc\n---\n正文');
    vault.files.set('书库/零进度.md', '---\ntags: ["book"]\n---\n正文');
    const items = getBookItems(makeApp(vault));
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.readingProgress]));
    expect(byTitle['坏进度']).toBe(0);
    expect(byTitle['零进度']).toBe(0);
    expect(Number.isNaN(byTitle['坏进度'] as number)).toBe(false);
  });
});

describe('sortItemList', () => {
  function item(partial: any) {
    return {
      file: { stat: {} }, title: 'T', author: 'A', category: 'C', cover: null,
      bookReview: null, readingDate: null, completionDate: null, readingProgress: 0,
      readingTimeFormat: null, highlights: 0, thinks: 0, status: '未读', subfolder: null,
      sizeBytes: 0, ...partial,
    };
  }

  it('title 中文本地排序 asc/desc', () => {
    const list = [item({ title: '乙' }), item({ title: '甲' })];
    expect(sortItemList(list, 'title', 'asc').map((i) => i.title)).toEqual(['甲', '乙']);
    expect(sortItemList(list, 'title', 'desc').map((i) => i.title)).toEqual(['乙', '甲']);
  });

  it('readingDate：有值在前（按时间），无值排后', () => {
    const list = [
      item({ title: '无日期' }),
      item({ title: '早', readingDate: '2025-01-01' }),
      item({ title: '晚', readingDate: '2025-06-01' }),
    ];
    const asc = sortItemList(list, 'readingDate', 'asc').map((i) => i.title);
    expect(asc).toEqual(['早', '晚', '无日期']);
    const desc = sortItemList(list, 'readingDate', 'desc').map((i) => i.title);
    expect(desc).toEqual(['晚', '早', '无日期']);
  });

  it('readingProgress：数值升/降序（恒为 number，无“无值”分支）', () => {
    const list = [item({ title: '50', readingProgress: 50 }), item({ title: '10', readingProgress: 10 })];
    expect(sortItemList(list, 'readingProgress', 'asc').map((i) => i.title)).toEqual(['10', '50']);
    expect(sortItemList(list, 'readingProgress', 'desc').map((i) => i.title)).toEqual(['50', '10']);
  });

  it('未知 key → 原序', () => {
    const list = [item({ title: 'B' }), item({ title: 'A' })];
    expect(sortItemList(list, 'xxx', 'asc').map((i) => i.title)).toEqual(['B', 'A']);
  });
});

describe('loadEpubBookItems（ADR-0013，读 Weave 数据文件）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book', weaveDataPath: 'CONFIG/STORAGE' }) as any);
  });

  function seedWeaveData(books: any) {
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({ schemaVersion: 2, books }));
  }

  it('从 weave-data.json 构建 EPUB 条目（字段 + coverPath + 状态）', async () => {
    seedWeaveData({
      bk_001: {
        id: 'bk_001',
        file: { vaultPath: '书库/悉达多.epub' },
        meta: { title: '悉达多', author: '赫尔曼·黑塞', coverPath: 'CONFIG/BOOK/EPUB COVER/悉达多.jpg', chapterCount: 12 },
        reading: {
          position: { chapterIndex: 2, cfi: '', percent: 0.3 },
          stats: { totalReadTime: 1500000, lastReadTime: 1735000000000, createdTime: 1730000000000 },
        },
        notes: { bookmarks: [], highlights: [{ id: 'h1' }], excerpts: [{ id: 'e1' }] },
      },
    });
    vault.files.set('CONFIG/BOOK/EPUB COVER/悉达多.jpg', 'x');
    const items = await loadEpubBookItems(makeApp(vault));
    expect(items.length).toBe(1);
    const b = items[0];
    expect(b.isEpub).toBe(true);
    expect(b.title).toBe('悉达多');
    expect(b.author).toBe('赫尔曼·黑塞');
    expect(b.category).toBe('未分类');
    expect(b.cover).toBe('CONFIG/BOOK/EPUB COVER/悉达多.jpg');
    expect(b.status).toBe('在读');
    expect(b.readingProgress).toBe(30);
    expect(b.highlights).toBe(1);
    expect(b.thinks).toBe(1);
    expect(b.readingTimeFormat).toBe('25分');
  });

  it('coverPath 缺失时退回按书名推断默认封面目录；未读状态', async () => {
    seedWeaveData({
      bk_002: {
        id: 'bk_002',
        file: { vaultPath: '书库/宇宙.epub' },
        meta: { title: '宇宙', author: '卡尔·萨根', chapterCount: 8 },
        reading: {
          position: { chapterIndex: 0, cfi: '', percent: 0 },
          stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 },
        },
        notes: { bookmarks: [], highlights: [], excerpts: [] },
      },
    });
    vault.files.set('CONFIG/BOOK/EPUB COVER/宇宙.png', 'x');
    const items = await loadEpubBookItems(makeApp(vault));
    expect(items[0].cover).toBe('CONFIG/BOOK/EPUB COVER/宇宙.png');
    expect(items[0].status).toBe('未读');
    expect(items[0].readingProgress).toBe(0);
  });

  it('weave-data.json 缺失 → 空数组（不抛错）', async () => {
    const items = await loadEpubBookItems(makeApp(vault));
    expect(items).toEqual([]);
  });

  it('weave-data.json 非法 JSON → 空数组', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', 'not json{{{');
    const items = await loadEpubBookItems(makeApp(vault));
    expect(items).toEqual([]);
  });

  it('audit H：EPUB 日期本地时区切片（UTC+8 早 8 点前读完不再归前一天）', async () => {
    const ts = new Date(2024, 11, 24, 7, 30).getTime(); // UTC+8 下对应 2024-12-23T23:30Z
    seedWeaveData({
      bk_tz: {
        id: 'bk_tz',
        file: { vaultPath: '书库/时区.epub' },
        meta: { title: '时区' },
        reading: { position: { percent: 0.5 }, stats: { lastReadTime: ts } },
        notes: { bookmarks: [], highlights: [], excerpts: [] },
      },
    });
    const items = await loadEpubBookItems(makeApp(vault));
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    expect(items[0].readingDate).toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    expect(items[0].readingDate).toBe('2024-12-24'); // 本地日期（旧 UTC 切片会给 2024-12-23）
  });
});
