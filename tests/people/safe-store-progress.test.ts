// @vitest-environment node
/**
 * PeopleSafeStore 冷读进度与热读判定（issue 483 数据层）：
 * - readAll(onProgress)：开跑即报 (0, total)，逐人完成报 (i+1, total)；只数 people 记录；
 * - 不传回调的既有调用点（PeopleStore.list / jobs / mergeInto）零漂移；
 * - isFullyCached：冷库 false → readAll 后 true → clearPlainCaches 后回落 false
 *   （面板重开路径靠它区分「缓存命中不出加载态」与「刚解锁要出骨架」）。
 */
import { describe, it, expect } from 'vitest';
import { PeopleSafeStore, PEOPLE_NOTE_PATH_PREFIX } from '../../src/people/safe-store';
import type { SafeManager } from '../../src/encrypt/data';

/** 最小 SafeManager 假件：清单给两条 people 记录 + 一条干扰 kind，正文按 path 解密 */
function fakeSafe(): SafeManager {
  const rec = (name: string) => JSON.stringify({
    version: 1,
    person: { id: name, name, createdAt: '2026-01-01T00:00:00.000Z', imports: [] },
    store: { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '' },
    job: null,
  });
  const bodies = new Map<string, string>([
    [PEOPLE_NOTE_PATH_PREFIX + '莫莫', rec('莫莫')],
    [PEOPLE_NOTE_PATH_PREFIX + '大琳', rec('大琳')],
  ]);
  const notes = [
    { id: 'n1', kind: 'people', path: PEOPLE_NOTE_PATH_PREFIX + '莫莫', title: '脸谱：莫莫', attachments: [] },
    { id: 'n2', kind: 'people', path: PEOPLE_NOTE_PATH_PREFIX + '大琳', title: '脸谱：大琳', attachments: [] },
    { id: 'n3', kind: 'diary-entry', path: '我的/日记/x.md', title: 'x', attachments: [] },
  ];
  return {
    unlocked: true,
    manifest: { notes },
    decryptNoteBody: async (note: { path: string }) => bodies.get(note.path) ?? null,
  } as unknown as SafeManager;
}

describe('readAll 进度回调与 isFullyCached（issue 483）', () => {
  it('onProgress 开跑报 (0,total)，逐人完成递增；只数 people 记录', async () => {
    const store = new PeopleSafeStore(fakeSafe());
    const seen: Array<[number, number]> = [];
    const all = await store.readAll((done, total) => seen.push([done, total]));
    expect(seen).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect([...all.keys()].sort()).toEqual(['大琳', '莫莫']);
  });

  it('不传回调（既有调用点）零漂移', async () => {
    const store = new PeopleSafeStore(fakeSafe());
    const all = await store.readAll();
    expect(all.size).toBe(2);
  });

  it('isFullyCached：冷库 false → readAll 后 true → clearPlainCaches 后回落 false', async () => {
    const store = new PeopleSafeStore(fakeSafe());
    expect(store.isFullyCached()).toBe(false);
    await store.readAll();
    expect(store.isFullyCached()).toBe(true);
    store.clearPlainCaches();
    expect(store.isFullyCached()).toBe(false);
  });
});
