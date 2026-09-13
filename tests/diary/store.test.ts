// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import {
  addEntry,
  removeDiaryEntries,
  updateDiaryTags,
  listDateEntries,
  findDiaryEntry,
  diaryDataMap,
  setDiaryDataMap,
  isDiaryReadFailure,
  DiaryFileReadError,
} from '../../src/diary/store';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

function makeVault(files: Record<string, string>) {
  vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
  return vault;
}

beforeEach(() => {
  resetTagsConfig();
  applyDirectories({});
  setDiaryDataMap(null);
  vi.restoreAllMocks();
});

const DATE = '2024-01-01';
const E1 = `我的/日记/${DATE} 08-00.md`;
const E2 = `我的/日记/${DATE} 09-05.md`;
const fm = (time: string, tags: string[], body: string) => serializeDiaryEntryFile({ date: DATE, time }, tags, body);

describe('addEntry（写层：取空闲条目文件名 → 建文件）', () => {
  it('新建条目文件：frontmatter 日期+类型，正文落盘，返回条目带完整路径', async () => {
    makeVault({});
    const e = await addEntry(DATE, '09:05', ['日记'], '新条目');
    expect(vault.files.has(E2)).toBe(true);
    expect(vault.files.get(E2)).toBe(fm('09:05', ['日记'], '新条目'));
    expect(e).toMatchObject({
      date: DATE,
      time: '09:05',
      timeValue: 905,
      tags: ['日记'],
      emoji: '📖',
      filename: E2,
      filePath: E2,
      lineNumber: 0,
      content: '新条目',
    });
    expect(diaryDataMap!.get(E2)![0].content).toBe('新条目');
  });

  it('同刻冲突自动让位：第二篇落 -2 后缀（队内复检）', async () => {
    makeVault({});
    const [a, b] = await Promise.all([
      addEntry(DATE, '00:00', ['日记'], '第一条'),
      addEntry(DATE, '00:00', ['日记'], '第二条'),
    ]);
    const paths = [a.filePath, b.filePath].sort();
    // '-2' 字典序在 '.' 前：排序后 -2 在前（两文件确为 基名 + -2 各一）；
    // 并发下谁占基名是竞态，断言两条内容各落一个文件、互不覆盖
    expect(paths).toEqual([`我的/日记/${DATE} 00-00-2.md`, `我的/日记/${DATE} 00-00.md`]);
    const bodies = [vault.files.get(paths[0])!, vault.files.get(paths[1])!].map((t) =>
      t.includes('第一条') ? '第一条' : '第二条'
    ).sort();
    expect(bodies).toEqual(['第一条', '第二条']);
    expect(a.filePath).not.toBe(b.filePath);
  });

  it('撞上磁盘已有文件（外来内容）也让位，绝不覆盖', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], '已有内容') });
    await addEntry(DATE, '08:00', ['日记'], '新来的');
    expect(vault.files.get(E1)).toContain('已有内容');
    expect(vault.files.has(`我的/日记/${DATE} 08-00-2.md`)).toBe(true);
  });

  it('发 diary:entry-added 事件（载荷 date/time/tags/content）', async () => {
    makeVault({});
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:entry-added', (e) => seen.push(e));
    await addEntry(DATE, '10:00', ['日记'], '内容');
    off();
    expect(seen[0]).toMatchObject({ date: DATE, time: '10:00', tags: ['日记'], content: '内容' });
  });
});

describe('removeDiaryEntries（删条目 = 删条目文件）', () => {
  it('删除匹配条目文件；同日其余条目文件保留', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A'), [E2]: fm('09:05', ['日记'], 'B') });
    const n = await removeDiaryEntries(DATE, (e) => e.time === '08:00');
    expect(n).toBe(1);
    expect(vault.files.has(E1)).toBe(false);
    expect(vault.files.get(E2)).toContain('B');
  });

  it('0 命中：不删任何文件', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const n = await removeDiaryEntries(DATE, (e) => e.time === '23:59');
    expect(n).toBe(0);
    expect(vault.files.has(E1)).toBe(true);
  });

  it('外部已删除后再删：0 命中不误报', async () => {
    makeVault({});
    const n = await removeDiaryEntries(DATE, () => true);
    expect(n).toBe(0);
  });

  it('同刻两条（-2）只删谓词命中的那条', async () => {
    const E1b = `我的/日记/${DATE} 00-00-2.md`;
    makeVault({
      [`我的/日记/${DATE} 00-00.md`]: fm('00:00', ['日记'], '第一条'),
      [E1b]: serializeDiaryEntryFile({ date: DATE, time: '00:00' }, ['日记'], '第二条'),
    });
    const n = await removeDiaryEntries(DATE, (e) => e.content === '第二条');
    expect(n).toBe(1);
    expect(vault.files.get(`我的/日记/${DATE} 00-00.md`)).toContain('第一条');
    expect(vault.files.has(E1b)).toBe(false);
  });
});

describe('updateDiaryTags（只重写 frontmatter，正文一字不动）', () => {
  it('改标签写盘并发 diary:tags-changed；返回更新后条目', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:tags-changed', (e) => seen.push(e));
    const updated = await updateDiaryTags(DATE, (e) => e.time === '08:00', ['骑行']);
    off();
    expect(updated?.tags).toEqual(['骑行']);
    expect(updated?.emoji).toBe('🚴');
    const disk = vault.files.get(E1)!;
    expect(disk).toContain('日期: 2024-01-01 08:00');
    expect(disk).toContain('  - 骑行');
    expect(disk).toContain('A'); // 正文不动
    expect(seen[0]).toMatchObject({ date: DATE, time: '08:00', from: ['日记'], to: ['骑行'] });
  });

  it('标签未变化等价成功：不写盘（内容逐字节一致）', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const before = vault.files.get(E1);
    const updated = await updateDiaryTags(DATE, (e) => e.time === '08:00', ['日记']);
    expect(updated?.tags).toEqual(['日记']);
    expect(vault.files.get(E1)).toBe(before);
  });

  it('定位失败（磁盘无该条目）：返回 null、不改盘', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const updated = await updateDiaryTags(DATE, (e) => e.time === '23:59', ['骑行']);
    expect(updated).toBeNull();
    expect(vault.files.get(E1)).toContain('  - 日记');
  });
});

describe('findDiaryEntry / listDateEntries', () => {
  it('完整路径命中；旧日期串形状返回 null（条目文件化后无对应文件）', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const hit = await findDiaryEntry(E1, 0);
    expect(hit).toMatchObject({ time: '08:00', content: 'A', filePath: E1 });
    expect(await findDiaryEntry(DATE, 1)).toBeNull();
  });

  it('listDateEntries 按时间升序返回当日全部条目（副本，不影响 map）', async () => {
    makeVault({ [E2]: fm('09:05', ['日记'], 'B'), [E1]: fm('08:00', ['日记'], 'A') });
    const snapshot = await listDateEntries(DATE);
    expect(snapshot.map((e) => e.time)).toEqual(['08:00', '09:05']);
    snapshot[0].content = '改过的副本';
    expect(diaryDataMap!.get(E1)![0].content).toBe('A');
  });

  it('listDateEntries 带 filePath 只读指定条目文件', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A'), [E2]: fm('09:05', ['日记'], 'B') });
    const only = await listDateEntries(DATE, { filePath: E2 });
    expect(only).toHaveLength(1);
    expect(only[0].content).toBe('B');
  });
});

describe('守卫语义（ADR-0130：宽运行时降级 / 异常文件跳过不阻断）', () => {
  it('frontmatter 日期损坏 → 从文件名降级，读写照常', async () => {
    const corrupt = '---\n日期: 2024-13-45 99:99\n类型:\n  - 日记\n---\n\n正文';
    makeVault({ [E1]: corrupt });
    const entries = await listDateEntries(DATE);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: DATE, time: '08:00', tags: ['日记'] });
    const n = await removeDiaryEntries(DATE, () => true);
    expect(n).toBe(1);
    expect(vault.files.has(E1)).toBe(false);
  });

  it('非条目文件名（含旧格式日期文件）不进日期枚举：删/读都跳过不误伤', async () => {
    const legacy = `我的/日记/${DATE}.md`;
    makeVault({ [legacy]: '# 📖 08:00\n旧格式正文\n', [E1]: fm('08:00', ['日记'], 'A') });
    const entries = await listDateEntries(DATE);
    expect(entries.map((e) => e.content)).toEqual(['A']); // 旧格式文件不解析不出
    const n = await removeDiaryEntries(DATE, () => true);
    expect(n).toBe(1);
    expect(vault.files.has(legacy)).toBe(true); // 旧文件原样保留（迁移归档由脚本负责）
  });

  it('显式 filePath 指向非条目文件：listDateEntries 拒读抛 UnparsedLineError', async () => {
    const junk = '我的/日记/随手记.md';
    makeVault({ [junk]: '随便什么内容' });
    const { UnparsedLineError } = await import('../../src/diary/store');
    await expect(listDateEntries(DATE, { filePath: junk })).rejects.toBeInstanceOf(UnparsedLineError);
  });

  it('读失败：删除路径跳过该文件不误删（D1：不视为空文件），其余文件照常', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A'), [E2]: fm('09:05', ['日记'], 'B') });
    const realRead = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      if (f.path === E1) throw new Error('EBUSY: 资源被占用');
      return realRead(f);
    });
    const n = await removeDiaryEntries(DATE, () => true);
    expect(n).toBe(1); // 只有读得动的 E2 被删
    expect(vault.files.has(E1)).toBe(true); // 读失败文件原样保留
    expect(vault.files.get(E1)).toBe(fm('08:00', ['日记'], 'A'));
    expect(isDiaryReadFailure(new DiaryFileReadError('x', null))).toBe(true);
    expect(isDiaryReadFailure(new Error('其他错误'))).toBe(false);
  });
});

describe('D3 串行队列语义收口', () => {
  it('同日并发两次 addEntry（不同时刻）：两文件齐落', async () => {
    makeVault({});
    await Promise.all([addEntry(DATE, '09:00', ['日记'], 'B'), addEntry(DATE, '10:00', ['日记'], 'C')]);
    expect(vault.files.get(`我的/日记/${DATE} 09-00.md`)).toContain('B');
    expect(vault.files.get(`我的/日记/${DATE} 10-00.md`)).toContain('C');
  });

  it('不同日期并行写互不影响', async () => {
    makeVault({});
    await Promise.all([
      addEntry('2024-01-01', '09:00', ['日记'], 'B'),
      addEntry('2024-01-02', '08:00', ['日记'], 'Y'),
    ]);
    expect(vault.files.get('我的/日记/2024-01-01 09-00.md')).toContain('B');
    expect(vault.files.get('我的/日记/2024-01-02 08-00.md')).toContain('Y');
  });
});

describe('子目录落点（opts.filePath 只取其目录）', () => {
  const NESTED = `我的/日记/旧/${DATE} 08-00.md`;

  it('listDateEntries 带 filePath 读子目录条目文件；与顶层互不串扰', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], '顶层'), [NESTED]: fm('08:00', ['日记'], '子目录') });
    const nested = await listDateEntries(DATE, { filePath: NESTED });
    expect(nested).toHaveLength(1);
    expect(nested[0].filePath).toBe(NESTED);
    expect(nested[0].content).toBe('子目录');
    expect(diaryDataMap!.get(NESTED)![0].content).toBe('子目录'); // map 按路径分键
  });

  it('删子目录条目文件：动的是子目录文件，顶层原样保留', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], '顶层'), [NESTED]: fm('08:00', ['日记'], '子目录') });
    const hit = await findDiaryEntry(NESTED, 0);
    expect(hit!.content).toBe('子目录');
    const removed = await removeDiaryEntries(DATE, (e) => e.filePath === NESTED, { filePath: NESTED });
    expect(removed).toBe(1);
    expect(vault.files.has(NESTED)).toBe(false);
    expect(vault.files.get(E1)).toContain('顶层');
  });

  it('改子目录条目标签：写回子目录文件，顶层不动', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], '顶层'), [NESTED]: fm('08:00', ['日记'], '子目录') });
    const updated = await updateDiaryTags(DATE, (e) => e.filePath === NESTED, ['骑行'], { filePath: NESTED });
    expect(updated?.tags).toEqual(['骑行']);
    expect(vault.files.get(NESTED)).toContain('  - 骑行');
    expect(vault.files.get(E1)).toContain('  - 日记');
  });

  it('addEntry 带 opts.filePath：新条目落子目录，顶层不误建', async () => {
    makeVault({ [NESTED]: fm('08:00', ['日记'], '子目录') });
    await addEntry(DATE, '09:00', ['日记'], '新条目', { filePath: NESTED });
    expect(vault.files.get(`我的/日记/旧/${DATE} 09-00.md`)).toContain('新条目');
    expect(vault.files.has(E2)).toBe(false);
  });
});
