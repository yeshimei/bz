/**
 * 书库 items 测试（ticket 12）：getBookItems / sortItemList / getSubfolder / getStatusColors。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getBookItems, sortItemList, getSubfolder, getStatusColors } from '../../src/library/items';
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

describe('getStatusColors', () => {
  afterEach(() => {
    document.body.classList.remove('theme-dark');
  });

  it('light 模式色板', () => {
    document.body.classList.remove('theme-dark');
    const c = getStatusColors();
    expect(c.badgeBg.未读).toBe('#BDBDBD');
    expect(c.badgeBg.在读).toBe('#FF8C42');
    expect(c.badgeBg.已读).toBe('#66BB6A');
  });

  it('dark 模式色板', () => {
    document.body.classList.add('theme-dark');
    const c = getStatusColors();
    expect(c.badgeBg.已读).toBe('#388E3C');
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

  it('readingProgress：有进度在前', () => {
    const list = [item({ title: '无进度', readingProgress: null as any }), item({ title: '50', readingProgress: 50 })];
    expect(sortItemList(list, 'readingProgress', 'asc')[0].title).toBe('50');
    expect(sortItemList(list, 'readingProgress', 'desc')[0].title).toBe('50');
  });

  it('未知 key → 原序', () => {
    const list = [item({ title: 'B' }), item({ title: 'A' })];
    expect(sortItemList(list, 'xxx', 'asc').map((i) => i.title)).toEqual(['B', 'A']);
  });
});
