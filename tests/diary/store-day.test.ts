// @vitest-environment node
/**
 * 一天一文件（day 格式）写路径：新建追加、读拆块、改块头、删块、删最后一块整文件进回收站。
 * 与 store.test.ts（entry 格式）互补；两种格式可在同一目录共存。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import {
  addEntry,
  listDateEntries,
  removeDiaryEntries,
  updateDiaryTags,
  setDiaryDataMap,
} from '../../src/diary/store';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

const DATE = '2026-06-13';
const PATH = '我的/日记/2026-06-13.md';
const TYPES = JSON.stringify([
  { tag: '日记', emoji: '📖' },
  { tag: '随笔', emoji: '✍️' },
]);

beforeEach(() => {
  applyDirectories({
    diaryDirectory: '我的/日记',
    diaryEntryFormat: 'day',
    diaryTypes: TYPES,
  });
  setDiaryDataMap(null);
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

describe('addEntry（day 格式：追加到当天日期文件）', () => {
  it('首篇：建 2026-06-13.md，块头 = # emoji HH:mm + 空行 + 正文', async () => {
    const e = await addEntry(DATE, '12:23', ['日记'], '第一篇');
    expect(e.filePath).toBe(PATH);
    expect(e.lineNumber).toBe(0);
    expect(vault.files.get(PATH)).toBe('# 📖 12:23\n\n第一篇\n');
  });

  it('当天第二篇：追加在末尾，空行分隔；行号 = 新块头所在行', async () => {
    await addEntry(DATE, '12:23', ['日记'], '第一篇');
    const e = await addEntry(DATE, '22:10', ['随笔'], '第二篇');
    expect(vault.files.get(PATH)).toBe('# 📖 12:23\n\n第一篇\n\n# ✍️ 22:10\n\n第二篇\n');
    expect(e.lineNumber).toBe(4);
    expect(e.tags).toEqual(['随笔']);
    expect(e.emoji).toBe('✍️');
  });

  it('同刻两篇：两个块，靠 lineNumber 区分', async () => {
    await addEntry(DATE, '12:23', ['日记'], 'A');
    await addEntry(DATE, '12:23', ['日记'], 'B');
    const es = await listDateEntries(DATE);
    expect(es.map((x) => [x.time, x.lineNumber, x.content])).toEqual([
      ['12:23', 0, 'A'],
      ['12:23', 4, 'B'],
    ]);
  });
});

describe('读路径（旧文件拆块）', () => {
  it('listDateEntries 拆块并按时间升序；filePath 限定旧文件返回全部块', async () => {
    vault.files.set(PATH, '# 📖 22:10\n\n晚\n\n# 📖 08:00\n\n早\n');
    const es = await listDateEntries(DATE);
    expect(es.map((x) => x.time)).toEqual(['08:00', '22:10']);
    expect(es.map((x) => x.content)).toEqual(['早', '晚']);
    const only = await listDateEntries(DATE, { filePath: PATH });
    expect(only).toHaveLength(2);
  });
});

describe('updateDiaryTags（day 格式：只换块头）', () => {
  it('命中块只改头行，正文与其他块一字不动', async () => {
    vault.files.set(PATH, '# 📖 12:23\n\n第一篇\n\n# 📖 22:10\n\n第二篇\n');
    const updated = await updateDiaryTags(DATE, (e) => e.content === '第一篇', ['随笔']);
    expect(updated?.tags).toEqual(['随笔']);
    expect(vault.files.get(PATH)).toBe('# ✍️ 12:23\n\n第一篇\n\n# 📖 22:10\n\n第二篇\n');
  });

  it('标签没变：不写盘，等价成功', async () => {
    vault.files.set(PATH, '# 📖 12:23\n\n第一篇\n');
    const before = vault.files.get(PATH);
    const updated = await updateDiaryTags(DATE, (e) => e.content === '第一篇', ['日记']);
    expect(updated?.tags).toEqual(['日记']);
    expect(vault.files.get(PATH)).toBe(before);
  });
});

describe('removeDiaryEntries（day 格式：只摘块）', () => {
  it('删中间/末尾一块：文件保留，其余块与正文不动', async () => {
    vault.files.set(PATH, '# 📖 12:23\n\n第一篇\n\n# 📖 22:10\n\n第二篇\n');
    const n = await removeDiaryEntries(DATE, (e) => e.content === '第二篇');
    expect(n).toBe(1);
    expect(vault.files.get(PATH)).toBe('# 📖 12:23\n\n第一篇\n');
  });

  it('删最后一块：整文件进 Obsidian 回收站（可恢复）', async () => {
    vault.files.set(PATH, '# 📖 12:23\n\n第一篇\n');
    const n = await removeDiaryEntries(DATE, () => true);
    expect(n).toBe(1);
    expect(vault.files.has(PATH)).toBe(false);
    expect(vault.files.has('.trash/2026-06-13.md')).toBe(true);
  });

  it('purge（加密收信例外）：直接销毁，不進回收站', async () => {
    vault.files.set(PATH, '# 📖 12:23\n\n第一篇\n');
    await removeDiaryEntries(DATE, () => true, { purge: true });
    expect(vault.files.has(PATH)).toBe(false);
    expect(vault.files.has('.trash/2026-06-13.md')).toBe(false);
  });
});

/**
 * 2026-11-05 用户要求：day 格式的文件名日期格式跟随 Obsidian 日记设置（增强兼容性）。
 * 写入、读取、改块、删块都得认同一个格式——含 `/` 时文件落在子目录里。
 */
describe('day 文件名跟随 Obsidian 日记的日期格式', () => {
  /** 把 mock app 的日记插件日期格式换成 fmt（写层实时读，不需要重新 applyDirectories） */
  function withFormat(fmt: string): void {
    const app = mockAppWithVault(vault);
    (app as any).internalPlugins.getPluginById = (id: string) =>
      id === 'daily-notes' ? { instance: { options: { folder: '我的/日记', format: fmt } } } : null;
    setApp(app as never);
  }

  it('YYYY/MM/DD：写进子目录，读路径按相对路径认出同一天', async () => {
    withFormat('YYYY/MM/DD');
    const e = await addEntry(DATE, '12:23', ['日记'], '子目录里的第一篇');
    expect(e.filePath).toBe('我的/日记/2026/06/13.md');
    expect(vault.files.get('我的/日记/2026/06/13.md')).toContain('子目录里的第一篇');

    const es = await listDateEntries(DATE);
    expect(es.map((x) => x.content)).toEqual(['子目录里的第一篇']);

    const updated = await updateDiaryTags(DATE, (x) => x.content === '子目录里的第一篇', ['随笔']);
    expect(updated?.tags).toEqual(['随笔']);
    expect(vault.files.get('我的/日记/2026/06/13.md')).toContain('# ✍️ 12:23');
  });

  it('YYYY.MM.DD：文件名带点，块读写照常', async () => {
    withFormat('YYYY.MM.DD');
    const e = await addEntry(DATE, '08:00', ['日记'], '点号格式');
    expect(e.filePath).toBe('我的/日记/2026.06.13.md');
    expect((await listDateEntries(DATE)).map((x) => x.content)).toEqual(['点号格式']);
  });

  it('自定义带星期：YYYY-MM-DD-dddd 也能写能读（往返严格，不宽松吞别的文件）', async () => {
    withFormat('YYYY-MM-DD-dddd');
    const e = await addEntry(DATE, '09:00', ['日记'], '带星期');
    expect(e.filePath).toMatch(/^我的\/日记\/2026-06-13-.+\.md$/);
    expect((await listDateEntries(DATE)).map((x) => x.content)).toEqual(['带星期']);
  });

  it('旧 YYYY-MM-DD 文件在自定义格式下仍认（内置四种兜底，不整批消失）', async () => {
    withFormat('YYYY/MM/DD');
    vault.files.set(PATH, '# 📖 12:23\n\n旧文件名\n');
    const es = await listDateEntries(DATE);
    expect(es.map((x) => x.content)).toEqual(['旧文件名']);
  });
});
