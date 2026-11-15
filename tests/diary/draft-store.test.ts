// @vitest-environment node
/**
 * 写日记草稿的本地留存（2026-11-15 备忘录）：强制关闭 Obsidian 时内存态草稿会连 DOM 一起没，
 * 所以每敲一段字就同步落一份到 localStorage（按库分键，写入是同步的，卸载时不用等异步写盘）。
 * 本文件只测纯数据层：键、往返、脏数据自愈、存储不可用不炸。
 */
import { describe, expect, it } from 'vitest';
import {
  DIARY_DRAFT_KEY,
  diaryDraftKey,
  readDiaryDraft,
  writeDiaryDraft,
  clearDiaryDraft,
  type DiaryDraftData,
  type DraftStoreLike,
} from '../../src/diary/draft-store';

function memStore(): DraftStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const sample = (over: Partial<DiaryDraftData> = {}): DiaryDraftData => ({
  text: '写了一半的日记\n第二行  ',
  date: '2026-11-15',
  time: '23:40',
  tags: ['日记', '随笔'],
  savedAt: 1763226000000,
  ...over,
});

describe('diary draft-store · 按库分键与往返', () => {
  it('同一份草稿在不同库互不串味；空路径用裸键', () => {
    expect(diaryDraftKey('D:/vault/a')).not.toBe(diaryDraftKey('D:/vault/b'));
    expect(diaryDraftKey('')).toBe(DIARY_DRAFT_KEY);
    expect(diaryDraftKey('D:/vault/a')).toContain(DIARY_DRAFT_KEY);
  });

  it('写入再读出逐字段相同，正文原样保留（不 trim、不吞换行）', () => {
    const s = memStore();
    const d = sample({ edit: { filePath: '我的/日记/2026-11-14.md', lineNumber: 3, expectContent: '旧字', originalTags: ['日记'], whole: false } });
    writeDiaryDraft('D:/vault/a', d, s);
    expect(readDiaryDraft('D:/vault/a', s)).toEqual(d);
    expect(readDiaryDraft('D:/vault/b', s)).toBeNull();
  });

  it('空正文 / 坏 JSON / 缺字段 / 标签不是数组 → 当没草稿，并顺手删掉脏键', () => {
    const s = memStore();
    const key = diaryDraftKey('D:/vault/a');
    const bad = [
      'not-json',
      JSON.stringify(sample({ text: '   ' })),
      JSON.stringify({ text: '有字' }),
      JSON.stringify(sample({ tags: '日记' as unknown as string[] })),
    ];
    for (const raw of bad) {
      s.setItem(key, raw);
      expect(readDiaryDraft('D:/vault/a', s)).toBeNull();
      expect(s.getItem(key)).toBeNull();
    }
  });

  it('改字信息的字段不全 → 整份草稿作废（免得恢复成「新写」落出重复一篇）', () => {
    const s = memStore();
    writeDiaryDraft('D:/vault/a', sample({ edit: { filePath: 'x.md' } as never }), s);
    expect(readDiaryDraft('D:/vault/a', s)).toBeNull();
  });

  it('落笔 / 揉掉后清键；存储抛错（隐私模式）静默不炸', () => {
    const s = memStore();
    writeDiaryDraft('D:/vault/a', sample(), s);
    clearDiaryDraft('D:/vault/a', s);
    expect(readDiaryDraft('D:/vault/a', s)).toBeNull();

    const broken: DraftStoreLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(() => writeDiaryDraft('D:/vault/a', sample(), broken)).not.toThrow();
    expect(() => readDiaryDraft('D:/vault/a', broken)).not.toThrow();
    expect(() => clearDiaryDraft('D:/vault/a', broken)).not.toThrow();
  });
});
