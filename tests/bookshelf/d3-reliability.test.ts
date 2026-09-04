// @vitest-environment node
/**
 * 书架墙 D3 可靠写契约回归（weave-data.json 直改收编，ADR-0013 竞态例外口径不变）：
 * ①并发直改不互踩——想法编辑（updateEpubNoteComment）与划线删除（deleteEpubNote）并发，
 *   双方改动按序落盘（后写者基于先写者的最新文档，不再用陈旧基线覆盖）；
 * ②文件缺失/损坏 → 不写不建文件（保持「weave 不在时零侵入」语义），返回 false。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { updateEpubNoteComment, deleteEpubNote } from '../../src/bookshelf/epub-notes';
import { MockVault } from '../mock-vault';

const DATA_PATH = 'CONFIG/STORAGE/weave-data.json'; // resolveWeaveDataPath 缺省回落 CONFIG/STORAGE

function makeEnv(document: any) {
  const vault = new MockVault();
  if (document !== null) vault.files.set(DATA_PATH, JSON.stringify(document));
  return { vault, app: { vault } as any };
}

function bookDoc(highlights: any[]): any {
  return {
    settings: { theme: 'dark' }, // 非 books 段：段外字段保留口径观察位
    books: {
      'Library/book.epub': {
        file: { vaultPath: 'Library/book.epub' },
        notes: { highlights },
      },
    },
  };
}

const hl = (id: string, comment?: string) => ({ id, text: '划线' + id, ...(comment ? { commentText: comment } : {}) });

beforeEach(() => {});

describe('weave-data.json D3 可靠写契约（enqueueFileTask 串行）', () => {
  it('①并发直改：想法编辑与划线删除并发，改动按序都落盘', async () => {
    const { vault, app } = makeEnv(bookDoc([hl('h1'), hl('h2')]));
    await Promise.all([
      updateEpubNoteComment(app, 'Library/book.epub', 'h1', '我的想法'),
      deleteEpubNote(app, 'Library/book.epub', 'h2'),
    ]);
    const raw = JSON.parse(vault.files.get(DATA_PATH)!);
    const highlights = raw.books['Library/book.epub'].notes.highlights;
    expect(highlights).toHaveLength(1); // h2 已删
    expect(highlights[0].commentText).toBe('我的想法'); // h1 想法在（后写保留先写结果）
    expect(raw.settings).toEqual({ theme: 'dark' }); // books 外字段原样保留
  });

  it('①续：串行链内连续两笔改动均完整（删后改不再复活旧快照）', async () => {
    const { vault, app } = makeEnv(bookDoc([hl('h1'), hl('h2')]));
    expect(await deleteEpubNote(app, 'Library/book.epub', 'h2')).toBe(true);
    expect(await updateEpubNoteComment(app, 'Library/book.epub', 'h1', '后写想法')).toBe(true);
    const raw = JSON.parse(vault.files.get(DATA_PATH)!);
    const highlights = raw.books['Library/book.epub'].notes.highlights;
    expect(highlights).toHaveLength(1);
    expect(highlights[0].commentText).toBe('后写想法');
  });

  it('②文件缺失 → 返回 false 且不建文件（零侵入语义）', async () => {
    const { vault, app } = makeEnv(null);
    expect(await updateEpubNoteComment(app, 'Library/book.epub', 'h1', 'x')).toBe(false);
    expect(await deleteEpubNote(app, 'Library/book.epub', 'h1')).toBe(false);
    expect(vault.files.has(DATA_PATH)).toBe(false);
  });

  it('②续：损坏 JSON → 返回 false 不写不建（不覆盖损坏现场）', async () => {
    const { vault, app } = makeEnv(null);
    vault.files.set(DATA_PATH, '{"books":'); // 半截 JSON
    expect(await updateEpubNoteComment(app, 'Library/book.epub', 'h1', 'x')).toBe(false);
    expect(vault.files.get(DATA_PATH)).toBe('{"books":'); // 损坏现场原样保留
  });

  it('②尾：目标书不存在/高亮不存在 → false 且文件不被改写', async () => {
    const { vault, app } = makeEnv(bookDoc([hl('h1')]));
    const before = vault.files.get(DATA_PATH);
    expect(await updateEpubNoteComment(app, 'Library/other.epub', 'h1', 'x')).toBe(false);
    expect(await updateEpubNoteComment(app, 'Library/book.epub', '不存在的id', 'x')).toBe(false);
    expect(await deleteEpubNote(app, 'Library/book.epub', '不存在的id')).toBe(false);
    expect(vault.files.get(DATA_PATH)).toBe(before); // 无改动不写盘（mtime 不再空刷）
  });
});
