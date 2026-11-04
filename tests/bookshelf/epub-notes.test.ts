/**
 * 书架墙 EPUB 读书笔记测试（迁移自旧 tests/library/epub-notes.test.ts，旧 library 域退役）：
 * loadEpubBookNotes / buildEpubJumpLink / 直改 weave-data。
 * 注：beforeEach 清理 document，需要 jsdom 环境（不加 node 头）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import {
  loadEpubBookNotes,
  buildEpubJumpLink,
  buildReaderJumpUrl,
  epubJumpTargetOf,
  openEpubBook,
  updateEpubNoteComment,
  deleteEpubNote,
  findEpubBookByPath,
  encodeCfiForWikilink,
} from '../../src/bookshelf/epub-notes';
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

describe('epub-notes（bookshelf）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
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

  it('findEpubBookByPath：按 vaultPath 定位', async () => {
    seedWeaveData(vault, { bk_001: HIGH_BOOK, bk_other: { ...HIGH_BOOK, id: 'bk_other', file: { vaultPath: 'X/其他.epub' } } });
    const book = await findEpubBookByPath(makeApp(vault), 'X/其他.epub');
    expect(book?.id).toBe('bk_other');
    expect(await findEpubBookByPath(makeApp(vault), 'NOPE.epub')).toBeNull();
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

/**
 * bz 阅读（bz-reader.json）兼容：读划线、深链协议、编辑/删除写回 bz-reader.json。
 * 数据目录取缺省 `bz-reader/storage`（测试 app 没有 plugins.manifests，解析走 configDir 兜底）。
 */
describe('epub-notes：bz 阅读数据源', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  const READER_BOOK = {
    id: 'rb1',
    meta: { title: '悉达多', author: '黑塞' },
    fileRef: { vaultPath: '书库/悉达多.epub', format: 'epub' },
    reading: { position: { percent: 0.4, cfi: 'epubcfi(/6/2!/4/2)' }, stats: { totalReadTime: 60, lastReadTime: 1700000000000 }, sessions: [] },
    notes: {
      highlights: [
        { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1700000000000, cfiRange: 'epubcfi(/6/2!/4/2)', chapterTitle: '第一章' },
        { id: 'h2', text: '原文二', createdAt: 1700000001000, cfiRange: 'epubcfi(/6/4!/4/2)' },
      ],
      excerpts: [
        { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1700000000000 },
        { id: 'h2', text: '原文二', createdAt: 1700000001000 },
      ],
      bookmarks: [],
    },
    addedAt: 1699000000000,
    updatedAt: 1700000000000,
    notesUpdatedAt: 1700000000000,
  };

  const READER_PATH = `${READER_DEFAULT_DATA_DIR}/bz-reader.json`;

  function seedReader(vault: MockVault, books: any[] = [READER_BOOK]) {
    vault.files.set(READER_PATH, JSON.stringify({ version: 1, schemaVersion: 2, books }));
  }

  function readerFile(vault: MockVault): any {
    return JSON.parse(vault.files.get(READER_PATH)!);
  }

  it('findEpubBookByPath 定位 bz 阅读的书；loadEpubBookNotes 读到 comment 字段', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    const book = await findEpubBookByPath(app, '书库/悉达多.epub');
    expect(book?.id).toBe('rb1');
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub', book);
    expect(notes.length).toBe(2);
    expect(notes[0].comment).toBe('想法一');
    expect(notes[0].chapterTitle).toBe('第一章');
    expect(notes[1].hasComment).toBe(false);
  });

  it('深链按来源分派：bz 阅读 → obsidian://bz-reader；weave 仍是 #weave-cfi 双链', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    const book = await findEpubBookByPath(app, '书库/悉达多.epub');
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub', book);

    const url = buildReaderJumpUrl(book, notes[0]);
    expect(url.startsWith('obsidian://bz-reader?')).toBe(true);
    expect(url).toContain('book=rb1');
    expect(url).toContain(`cfi=${encodeURIComponent('epubcfi(/6/2!/4/2)')}`);
    expect(url).toContain(`c=${encodeURIComponent('第一章')}`);
    expect(epubJumpTargetOf(book, notes[0])).toEqual({ kind: 'url', value: url });

    // weave 源行为不变（先清掉 reader 数据，否则同 path 双源会按活动时间选 reader）
    vault.files.delete(READER_PATH);
    seedWeaveData(vault, { bk_001: HIGH_BOOK });
    const weaveBook = await findEpubBookByPath(app, '书库/悉达多.epub');
    const weaveNotes = await loadEpubBookNotes(app, '书库/悉达多.epub', weaveBook);
    expect(epubJumpTargetOf(weaveBook, weaveNotes[0])?.kind).toBe('wikilink');
    expect(buildEpubJumpLink(weaveBook, weaveNotes[0])).toContain('#weave-cfi=');
  });

  it('编辑想法：写 bz-reader.json 的 comment 字段，镜像 excerpt 同步，updatedAt / notesUpdatedAt 一起推进', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    const before = readerFile(vault).books[0].updatedAt;
    const beforeNotes = readerFile(vault).books[0].notesUpdatedAt;
    expect(await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '新想法')).toBe(true);

    const book = readerFile(vault).books[0];
    expect(book.notes.highlights[0].comment).toBe('新想法');
    expect(book.notes.excerpts[0].comment).toBe('新想法');
    expect(book.updatedAt).toBeGreaterThan(before);
    // 标注是单独一条时间线（bz-reader store.ts 的 A-15）：不推进 notesUpdatedAt，
    // 阅读器 flush 时会以本地 notes 赢回、把刚写进去的想法盖掉
    expect(book.notesUpdatedAt).toBe(book.updatedAt);
    expect(book.notesUpdatedAt).toBeGreaterThan(beforeNotes);
    // 只动了 bz-reader.json，没有写 weave
    expect(vault.modifiedPaths).toEqual([READER_PATH]);

    // 清空想法：字段删除（不是空串），excerpt 镜像同样清掉
    await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '');
    const cleared = readerFile(vault).books[0];
    expect('comment' in cleared.notes.highlights[0]).toBe(false);
    expect('comment' in cleared.notes.excerpts[0]).toBe(false);
  });

  it('删除划线：highlights 与 excerpts 的同 id 条目一起删', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'h1')).toBe(true);
    const book = readerFile(vault).books[0];
    expect(book.notes.highlights.map((h: any) => h.id)).toEqual(['h2']);
    expect(book.notes.excerpts.map((e: any) => e.id)).toEqual(['h2']);
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'missing')).toBe(false);
  });

  it('双源同 path：写回跟随「最近活动」的那一份（weave 更新时不动 bz-reader.json）', async () => {
    // weave 的 lastReadTime 更晚 → 编辑应写 weave-data.json
    seedWeaveData(vault, {
      bk_001: { ...JSON.parse(JSON.stringify(HIGH_BOOK)), reading: { position: {}, stats: { lastReadTime: 1800000000000 } } },
    });
    seedReader(vault);
    const app = makeApp(vault);
    const readerBefore = vault.files.get(READER_PATH);
    expect(await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '写给我的 weave')).toBe(true);
    expect(vault.files.get(READER_PATH)).toBe(readerBefore);
    expect(vault.modifiedPaths).toContain('CONFIG/STORAGE/weave-data.json');
  });

  it('openEpubBook：bz 阅读走协议链接（带当前位置 CFI，经 core openExternalUrl 单源），weave 走 openLinkText', () => {
    const opened: string[] = [];
    const app = makeApp(vault) as any;
    app.openUrl = (url: string) => { opened.push(url); return Promise.resolve(); };
    const links: string[] = [];
    app.workspace.openLinkText = (t: string) => { links.push(t); };

    expect(openEpubBook(app, {
      epubSource: 'reader', epubBookId: 'rb1', epubCfi: 'epubcfi(/6/2!/4/2)', epubVaultPath: '书库/悉达多.epub',
    })).toBe(true);
    expect(opened).toEqual([`obsidian://bz-reader?book=rb1&cfi=${encodeURIComponent('epubcfi(/6/2!/4/2)')}`]);
    expect(links).toEqual([]);

    expect(openEpubBook(app, { epubSource: 'weave', epubVaultPath: '书库/悉达多.epub' })).toBe(true);
    expect(links).toEqual(['书库/悉达多.epub']);
  });
});
