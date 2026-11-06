// @vitest-environment node
/**
 * 日记格式互转：旧日期文件 ⇄ 条目文件。
 * 只测真实写盘结果（MockVault），不测设置页 UI。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { convertDiaryFormat, convertEntriesToLegacy, convertLegacyToEntries } from '../../src/diary/convert';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;
const DIR = '我的/日记';
const DAY_PATH = `${DIR}/2026-06-13.md`;
const E1 = `${DIR}/2606131223.md`;
const E2 = `${DIR}/2606132210.md`;

beforeEach(() => {
  applyDirectories({ diaryDirectory: DIR, diaryEntryFormat: 'entry' });
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

describe('旧 → 新（日期文件拆条目文件）', () => {
  it('两块拆成两个条目文件，frontmatter 正确，原文件进回收站', async () => {
    vault.files.set(DAY_PATH, '# 📖 12:23\n\nA\n\n# ✍️ 22:10\n\nB\n');
    const r = await convertLegacyToEntries();
    expect(r.errors).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.converted).toBe(2);
    expect(vault.files.get(E1)).toBe(serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    expect(vault.files.get(E2)).toBe(serializeDiaryEntryFile({ date: '2026-06-13', time: '22:10' }, ['随笔'], 'B'));
    expect(vault.files.has(DAY_PATH)).toBe(false);
    expect(vault.files.has('.trash/2026-06-13.md')).toBe(true);
  });

  it('同刻多块：第 2 块让位 -2 后缀', async () => {
    vault.files.set(DAY_PATH, '# 📖 12:23\n\nA\n\n# 📖 12:23\n\nB\n');
    const r = await convertLegacyToEntries();
    expect(r.converted).toBe(2);
    expect(vault.files.has(E1)).toBe(true);
    expect(vault.files.has(`${DIR}/2606131223-2.md`)).toBe(true);
  });

  it('有游离正文：整份跳过，原文件不删、目标不建', async () => {
    vault.files.set(DAY_PATH, '前言\n# 📖 12:23\n\nA\n');
    const r = await convertLegacyToEntries();
    expect(r.converted).toBe(0);
    expect(r.skipped[0]?.path).toBe(DAY_PATH);
    expect(r.skipped[0]?.reason).toContain('游离');
    expect(vault.files.has(DAY_PATH)).toBe(true);
    expect(vault.files.has(E1)).toBe(false);
  });

  it('整篇无头行（Obsidian 原生日记）：整篇转一条，兜底 00:00，记进 inferred', async () => {
    vault.files.set(DAY_PATH, '今天下雨了。\n\n在家写了一下午代码。\n');
    const r = await convertLegacyToEntries();
    expect(r.errors).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.converted).toBe(1);
    // MockVault 的 ctime 是 2024-01-01，不在文件名那天 → 兜底 00:00
    expect(r.inferred).toHaveLength(1);
    expect(r.inferred[0].path).toBe(DAY_PATH);
    expect(r.inferred[0].reason).toContain('00:00');
    expect(vault.files.get(`${DIR}/2606130000.md`)).toBe(
      serializeDiaryEntryFile(
        { date: '2026-06-13', time: '00:00' },
        ['日记'],
        '今天下雨了。\n\n在家写了一下午代码。'
      )
    );
    expect(vault.files.has(DAY_PATH)).toBe(false);
    expect(vault.files.has('.trash/2026-06-13.md')).toBe(true);
  });

  it('正常有头行的文件不进 inferred（只有靠兜底时间的才记）', async () => {
    vault.files.set(DAY_PATH, '# 📖 12:23\n\nA\n');
    const r = await convertLegacyToEntries();
    expect(r.converted).toBe(1);
    expect(r.inferred).toEqual([]);
  });

  it('空日期文件：不建空条目，也不算问题（不挡整批切换）', async () => {
    vault.files.set(DAY_PATH, '\n\n');
    const r = await convertLegacyToEntries();
    expect(r.converted).toBe(0);
    expect(r.skipped).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(vault.files.has(DAY_PATH)).toBe(true); // 原文件留着（没有可丢的内容）
  });

  it('幂等：目标已存在且内容一致，不重复写、不列入回滚', async () => {
    vault.files.set(DAY_PATH, '# 📖 12:23\n\nA\n');
    vault.files.set(E1, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    const r = await convertLegacyToEntries();
    expect(r.converted).toBe(0);
    expect(r.errors).toEqual([]);
    expect(vault.files.has(E1)).toBe(true);
    expect(vault.files.has(DAY_PATH)).toBe(false); // 原文件仍按已转换处理进回收站
  });
});

describe('新 → 旧（同日条目合并日期文件）', () => {
  it('按时间排序合并，块头带 emoji，原条目文件进回收站', async () => {
    vault.files.set(
      E2,
      serializeDiaryEntryFile({ date: '2026-06-13', time: '22:10' }, ['随笔'], 'B')
    );
    vault.files.set(
      E1,
      serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A')
    );
    const r = await convertEntriesToLegacy();
    expect(r.errors).toEqual([]);
    expect(r.converted).toBe(1);
    expect(vault.files.get(DAY_PATH)).toBe('# 📖 12:23\n\nA\n\n# ✍️ 22:10\n\nB\n');
    expect(vault.files.has(E1)).toBe(false);
    expect(vault.files.has(E2)).toBe(false);
  });

  it('当天已有日期文件：整日跳过，条目文件不动（避免合并冲突）', async () => {
    vault.files.set(DAY_PATH, '# 📖 08:00\n\n已有\n');
    vault.files.set(E1, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    const r = await convertEntriesToLegacy();
    expect(r.converted).toBe(0);
    expect(r.skipped[0]?.reason).toContain('已存在');
    expect(vault.files.has(E1)).toBe(true);
    expect(vault.files.get(DAY_PATH)).toBe('# 📖 08:00\n\n已有\n');
  });

  it('当天有条目读取失败：整日跳过（不拆半份）', async () => {
    vault.files.set(E1, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    vault.files.set(`${DIR}/2606132210.md`, serializeDiaryEntryFile({ date: '2026-06-13', time: '22:10' }, ['随笔'], 'B'));
    const realRead = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      if (String(f.path).endsWith('2606132210.md')) throw new Error('读失败');
      return realRead(f);
    });
    const r = await convertEntriesToLegacy();
    expect(r.converted).toBe(0);
    expect(r.skipped[0]?.reason).toContain('读取失败');
    expect(vault.files.has(E1)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('convertDiaryFormat 分派', () => {
  it('target=entry 走旧→新；target=day 走新→旧', async () => {
    vault.files.set(DAY_PATH, '# 📖 12:23\n\nA\n');
    expect((await convertDiaryFormat('entry')).converted).toBe(1);
    expect(vault.files.has(E1)).toBe(true);

    const v2 = new MockVault();
    v2.files.set(E1, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    setApp(mockAppWithVault(v2));
    expect((await convertDiaryFormat('day')).converted).toBe(1);
    expect(v2.files.has(DAY_PATH)).toBe(true);
  });

  it('试运行：有文件不能转时整批一个都不动，不会出现「半批已转」', async () => {
    // 6-13 能转；6-14 有游离正文（整份跳过）
    vault.files.set(`${DIR}/2026-06-13.md`, '# 📖 12:23\n\nA\n');
    vault.files.set(`${DIR}/2026-06-14.md`, '前言\n# 📖 12:23\n\nB\n');
    const r = await convertDiaryFormat('entry');
    expect(r.converted).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.skipped).toHaveLength(1);
    // 能转的那天也没动：原文件还在，条目文件一个没建
    expect(vault.files.has(`${DIR}/2026-06-13.md`)).toBe(true);
    expect(vault.files.has(`${DIR}/2606131223.md`)).toBe(false);
  });

  it('目标写好但原文件没进回收站：记 leftovers，重跑只补移原文件、不重复写', async () => {
    vault.files.set(E1, serializeDiaryEntryFile({ date: '2026-06-13', time: '12:23' }, ['日记'], 'A'));
    const trashSpy = vi.spyOn(vault, 'trash').mockRejectedValueOnce(new Error('回收站不可写'));
    const r1 = await convertDiaryFormat('day');
    expect(r1.converted).toBe(1);
    expect(r1.leftovers).toHaveLength(1);
    expect(vault.files.has(DAY_PATH)).toBe(true);
    expect(vault.files.has(E1)).toBe(true); // 原文件还在（目标不能跟着回滚）
    trashSpy.mockRestore();

    // 重跑：目标内容一致 = 上次已转换 → 不重新写、只把残留原文件挪走
    const r2 = await convertDiaryFormat('day');
    expect(r2.converted).toBe(0);
    expect(r2.skipped).toEqual([]);
    expect(r2.leftovers).toEqual([]);
    expect(vault.files.has(E1)).toBe(false);
  });
});
