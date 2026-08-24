/**
 * 书库 EPUB 读书笔记测试（ADR-0013 扩展）：loadEpubBookNotes / buildEpubJumpLink / 直改 weave-data。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  loadEpubBookNotes,
  buildEpubJumpLink,
  updateEpubNoteComment,
  deleteEpubNote,
  findWeaveBookByPath,
  encodeCfiForWikilink,
} from '../../src/library/epub-notes';
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
    plugins: { plugins: { 'weave-epub-reader': { settings: { dataPath: 'CONFIG/STORAGE' } } } },
  } as any;
}

function seedWeaveData(vault: MockVault, books: any) {
  vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({ schemaVersion: 2, books }));
}

const HIGH_BOOK = {
  id: 'bk_001',
  file: { vaultPath: '书库/悉达多.epub', sourceId: 'epubsrc-demo' },
  meta: { title: '悉达多', author: '赫尔曼·黑塞' },
  reading: { position: { chapterIndex: 0, cfi: '', percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
  notes: {
    bookmarks: [],
    highlights: [
      { id: 'h1', text: '原文一', commentText: '想法一', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'epubcfi(/6/2[ab]!/4/4)', createdTime: 1700000000000 },
      { id: 'h2', text: '原文二', chapterIndex: 2, cfiRange: 'epubcfi(/6/6!/4/2)', createdTime: 1700100000000 },
    ],
    excerpts: [],
  },
};

describe('epub-notes', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ weaveDataPath: 'CONFIG/STORAGE' }) as any);
  });

  it('encodeCfiForWikilink 编码 [ ] | 保留其余', () => {
    expect(encodeCfiForWikilink('epubcfi(/6/2[ab]!/4/4|5)')).toBe('epubcfi(/6/2%5Bab%5D!/4/4%7C5)');
  });

  it('loadEpubBookNotes：字段映射 + 章节标题兜底 = 第 N 章', async () => {
    seedWeaveData(vault, { bk_001: HIGH_BOOK });
    const notes = await loadEpubBookNotes(makeApp(vault), '书库/悉达多.epub');
    expect(notes.length).toBe(2);
    expect(notes[0].text).toBe('原文一');
    expect(notes[0].comment).toBe('想法一');
    expect(notes[0].chapterTitle).toBe('第一章');
    expect(notes[0].hasComment).toBe(true);
    expect(notes[1].chapterTitle).toBe('第 3 章'); // chapterIndex 2 → 第 3 章
    expect(notes[1].hasComment).toBe(false);
  });

  it('找不到书 → 空数组', async () => {
    seedWeaveData(vault, { bk_001: HIGH_BOOK });
    expect(await loadEpubBookNotes(makeApp(vault), '书库/缺失.epub')).toEqual([]);
  });

  it('buildEpubJumpLink：含 cfi/chapter/sid', async () => {
    seedWeaveData(vault, { bk_001: HIGH_BOOK });
    const notes = await loadEpubBookNotes(makeApp(vault), '书库/悉达多.epub');
    const link = buildEpubJumpLink({ file: { vaultPath: '书库/悉达多.epub', sourceId: 'epubsrc-demo' } }, notes[0]);
    expect(link).toBe('书库/悉达多.epub#weave-cfi=epubcfi(/6/2%5Bab%5D!/4/4)&chapter=0&sid=epubsrc-demo');
  });

  it('updateEpubNoteComment：写回 commentText；清空则删除字段', async () => {
    seedWeaveData(vault, { bk_001: JSON.parse(JSON.stringify(HIGH_BOOK)) });
    const app = makeApp(vault);
    expect(await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '新想法')).toBe(true);
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub');
    expect(notes[0].comment).toBe('新想法');

    await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '');
    const afterClear = await loadEpubBookNotes(app, '书库/悉达多.epub');
    expect(afterClear[0].hasComment).toBe(false);
  });

  it('deleteEpubNote：整条移除高亮；不存在 → false', async () => {
    seedWeaveData(vault, { bk_001: JSON.parse(JSON.stringify(HIGH_BOOK)) });
    const app = makeApp(vault);
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'h1')).toBe(true);
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub');
    expect(notes.length).toBe(1);
    expect(notes[0].highlight.id).toBe('h2');
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'missing')).toBe(false);
  });

  it('findWeaveBookByPath：按 vaultPath 定位', async () => {
    seedWeaveData(vault, { bk_001: HIGH_BOOK, bk_other: { ...HIGH_BOOK, id: 'bk_other', file: { vaultPath: 'X/其他.epub' } } });
    const book = await findWeaveBookByPath(makeApp(vault), 'X/其他.epub');
    expect(book?.id).toBe('bk_other');
    expect(await findWeaveBookByPath(makeApp(vault), 'NOPE.epub')).toBeNull();
  });

  it('weave-data.json 缺失 → load 空数组 / 编辑 false（不抛错）', async () => {
    const app = makeApp(vault);
    expect(await loadEpubBookNotes(app, '书库/a.epub')).toEqual([]);
    expect(await updateEpubNoteComment(app, '书库/a.epub', 'h', 'c')).toBe(false);
    expect(await deleteEpubNote(app, '书库/a.epub', 'h')).toBe(false);
  });

  it('P2 空 id 守卫：脏数据（无 id 高亮）不会被空 highlightId 一次删光/误改', async () => {
    seedWeaveData(vault, {
      bk_dirty: {
        ...JSON.parse(JSON.stringify(HIGH_BOOK)),
        id: 'bk_dirty',
        file: { vaultPath: '书库/脏数据.epub' },
        notes: {
          bookmarks: [],
          highlights: [
            { text: '无id一', chapterIndex: 0 },
            { text: '无id二', chapterIndex: 1 },
            { id: 'ok1', text: '正常高亮', chapterIndex: 2 },
          ],
          excerpts: [],
        },
      },
    });
    const app = makeApp(vault);
    // 空 id / 纯空白 id：直接 false，不读不写
    expect(await deleteEpubNote(app, '书库/脏数据.epub', '')).toBe(false);
    expect(await deleteEpubNote(app, '书库/脏数据.epub', '   ')).toBe(false);
    expect(await updateEpubNoteComment(app, '书库/脏数据.epub', '', '恶意想法')).toBe(false);
    // 三条高亮一条未少，无任何写回
    const notes = await loadEpubBookNotes(app, '书库/脏数据.epub');
    expect(notes.length).toBe(3);
    expect(vault.modifiedPaths).toHaveLength(0);
    // 正常 id 删除仍工作
    expect(await deleteEpubNote(app, '书库/脏数据.epub', 'ok1')).toBe(true);
    expect((await loadEpubBookNotes(app, '书库/脏数据.epub')).length).toBe(2);
  });
});
