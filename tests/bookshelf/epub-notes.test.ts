/**
 * 书架墙 EPUB 读书笔记测试（ADR-0283：唯一数据源 = bz 阅读的 bz-reader.json）：
 * loadEpubBookNotes / buildReaderJumpUrl / openEpubBook / 直改 bz-reader.json。
 * 注：beforeEach 清理 document，需要 jsdom 环境（不加 node 头）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import {
  loadEpubBookNotes,
  buildReaderJumpUrl,
  openEpubBook,
  updateEpubNoteComment,
  deleteEpubNote,
  findEpubBookByPath,
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
  } as any;
}

const READER_PATH = `${READER_DEFAULT_DATA_DIR}/bz-reader.json`;

/** bz 阅读的一本书：字段名按它自己的 schema（fileRef / comment / createdAt / notesUpdatedAt） */
function readerBook(over: any = {}): any {
  const base = {
    id: 'rb1',
    meta: { title: '悉达多', author: '赫尔曼·黑塞' },
    fileRef: { vaultPath: '书库/悉达多.epub', format: 'epub' },
    reading: {
      position: { percent: 0.4, cfi: 'epubcfi(/6/2!/4/2)' },
      stats: { totalReadTime: 60, lastReadTime: 1700000000000 },
      sessions: [],
    },
    notes: {
      highlights: [
        { id: 'h1', text: '原文一', comment: '想法一', createdAt: 1700000000000, cfiRange: 'epubcfi(/6/2!/4/2)', chapterTitle: '第一章' },
        { id: 'h2', text: '原文二', createdAt: 1700000001000, cfiRange: 'epubcfi(/6/4!/4/2)', chapterIndex: 2 },
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
  return { ...base, ...over };
}

function seedReader(vault: MockVault, books: any[] = [readerBook()]) {
  vault.files.set(READER_PATH, JSON.stringify({ version: 1, schemaVersion: 2, books }));
}

function readerFile(vault: MockVault): any {
  return JSON.parse(vault.files.get(READER_PATH)!);
}

describe('epub-notes（bookshelf）：读划线 + 章节兜底', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('loadEpubBookNotes：字段映射 + 章节标题兜底 = 第 N 章', async () => {
    seedReader(vault);
    const notes = await loadEpubBookNotes(makeApp(vault), '书库/悉达多.epub');
    expect(notes.length).toBe(2);
    expect(notes[0].text).toBe('原文一');
    expect(notes[0].comment).toBe('想法一'); // comment → commentText 归一后读得到
    expect(notes[0].chapterTitle).toBe('第一章');
    expect(notes[0].hasComment).toBe(true);
    expect(notes[1].chapterTitle).toBe('第 3 章'); // chapterIndex 2 → 第 3 章
    expect(notes[1].hasComment).toBe(false);
  });

  it('找不到书 → 空数组', async () => {
    seedReader(vault);
    expect(await loadEpubBookNotes(makeApp(vault), '书库/缺失.epub')).toEqual([]);
  });

  it('findEpubBookByPath：按 vaultPath 定位；没有返回 null', async () => {
    seedReader(vault, [readerBook(), readerBook({ id: 'rb_other', fileRef: { vaultPath: 'X/其他.epub' } })]);
    const book = await findEpubBookByPath(makeApp(vault), 'X/其他.epub');
    expect(book?.id).toBe('rb_other');
    expect(await findEpubBookByPath(makeApp(vault), 'NOPE.epub')).toBeNull();
  });

  it('数据文件缺失 → load 空数组 / 编辑 false（不抛错）', async () => {
    const app = makeApp(vault);
    expect(await loadEpubBookNotes(app, '书库/a.epub')).toEqual([]);
    expect(await updateEpubNoteComment(app, '书库/a.epub', 'h', 'c')).toBe(false);
    expect(await deleteEpubNote(app, '书库/a.epub', 'h')).toBe(false);
  });
});

describe('epub-notes：编辑想法/删除划线写回 bz-reader.json', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('编辑想法：写 comment 字段，镜像 excerpt 同步，updatedAt / notesUpdatedAt 一起推进', async () => {
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
    expect(vault.modifiedPaths).toEqual([READER_PATH]);

    // 清空想法：字段删除（不是空串），excerpt 镜像同样清掉
    await updateEpubNoteComment(app, '书库/悉达多.epub', 'h1', '');
    const cleared = readerFile(vault).books[0];
    expect('comment' in cleared.notes.highlights[0]).toBe(false);
    expect('comment' in cleared.notes.excerpts[0]).toBe(false);
  });

  it('删除划线：highlights 与 excerpts 的同 id 条目一起删；不存在 → false', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'h1')).toBe(true);
    const book = readerFile(vault).books[0];
    expect(book.notes.highlights.map((h: any) => h.id)).toEqual(['h2']);
    expect(book.notes.excerpts.map((e: any) => e.id)).toEqual(['h2']);
    expect(await deleteEpubNote(app, '书库/悉达多.epub', 'missing')).toBe(false);
  });

  it('P2 空 id 守卫：脏数据（无 id 高亮）不会被空 highlightId 一次删光/误改', async () => {
    seedReader(vault, [readerBook({
      id: 'rb_dirty',
      fileRef: { vaultPath: '书库/脏数据.epub' },
      notes: {
        bookmarks: [],
        highlights: [
          { text: '无id一', chapterIndex: 0 },
          { text: '无id二', chapterIndex: 1 },
          { id: 'ok1', text: '正常高亮', chapterIndex: 2 },
        ],
        excerpts: [],
      },
    })]);
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

describe('epub-notes：深链与打开书', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('buildReaderJumpUrl：协议链接带 book/cfi/t/c（与 bz 阅读 deeplink 同格式）', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    const book = await findEpubBookByPath(app, '书库/悉达多.epub');
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub', book);
    const url = buildReaderJumpUrl(book, notes[0]);
    expect(url.startsWith('obsidian://bz-reader?')).toBe(true);
    expect(url).toContain('book=rb1');
    expect(url).toContain(`cfi=${encodeURIComponent('epubcfi(/6/2!/4/2)')}`);
    expect(url).toContain('t=' + encodeURIComponent('原文一'));
    expect(url).toContain(`c=${encodeURIComponent('第一章')}`);
  });

  it('buildReaderJumpUrl：章节是兜底「第 N 章」时不传 c；没有 bookId → 空串', async () => {
    seedReader(vault);
    const app = makeApp(vault);
    const book = await findEpubBookByPath(app, '书库/悉达多.epub');
    const notes = await loadEpubBookNotes(app, '书库/悉达多.epub', book);
    expect(buildReaderJumpUrl(book, notes[1])).not.toContain('&c=');
    expect(buildReaderJumpUrl({}, notes[0])).toBe('');
  });

  it('openEpubBook：走协议链接（带当前位置 CFI，经 core openExternalUrl 单源）', () => {
    const opened: string[] = [];
    const app = makeApp(vault) as any;
    app.openUrl = (url: string) => { opened.push(url); return Promise.resolve(); };
    expect(openEpubBook(app, { epubBookId: 'rb1', epubCfi: 'epubcfi(/6/2!/4/2)' })).toBe(true);
    expect(opened).toEqual([`obsidian://bz-reader?book=rb1&cfi=${encodeURIComponent('epubcfi(/6/2!/4/2)')}`]);
    // 没有 bookId 就没法定位：返回 false，调用方留在原地
    expect(openEpubBook(app, { epubBookId: null })).toBe(false);
  });
});
