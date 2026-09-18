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
  rekeyDiaryMapPath,
  dropDiaryMapPath,
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
const E1 = '我的/日记/2401010800.md'; // v3 题目：YYMMDDHHmm
const E2 = '我的/日记/2401010905.md';
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
    expect(paths).toEqual(['我的/日记/2401010000-2.md', '我的/日记/2401010000.md']);
    const bodies = [vault.files.get(paths[0]!)!, vault.files.get(paths[1]!)!].map((t) =>
      t.includes('第一条') ? '第一条' : '第二条'
    ).sort();
    expect(bodies).toEqual(['第一条', '第二条']);
    expect(a.filePath).not.toBe(b.filePath);
  });

  it('撞上磁盘已有文件（外来内容）也让位，绝不覆盖', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], '已有内容') });
    await addEntry(DATE, '08:00', ['日记'], '新来的');
    expect(vault.files.get(E1)).toContain('已有内容');
    expect(vault.files.has('我的/日记/2401010800-2.md')).toBe(true);
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
    const E1b = '我的/日记/2401010000-2.md';
    makeVault({
      '我的/日记/2401010000.md': fm('00:00', ['日记'], '第一条'),
      [E1b]: serializeDiaryEntryFile({ date: DATE, time: '00:00' }, ['日记'], '第二条'),
    });
    const n = await removeDiaryEntries(DATE, (e) => e.content === '第二条');
    expect(n).toBe(1);
    expect(vault.files.get('我的/日记/2401010000.md')).toContain('第一条');
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
    expect(disk).toContain('date: 2024-01-01 08:00');
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

  it('N3 回归：重复标签集（type: [日记, 日记]）改成不同集合能写盘（不再误判无变化）', async () => {
    // 旧比较「长度相等且旧集每个都在新集内」把 ['日记','日记']→['日记','随笔'] 误判为无变化
    const dup = ['---', 'date: 2024-01-01 08:00', 'type:', '  - 日记', '  - 日记', '---', '', 'A', ''].join('\n');
    makeVault({ [E1]: dup });
    const updated = await updateDiaryTags(DATE, (e) => e.time === '08:00', ['日记', '随笔']);
    expect(updated?.tags).toEqual(['日记', '随笔']);
    const disk = vault.files.get(E1)!;
    expect(disk).toContain('  - 日记');
    expect(disk).toContain('  - 随笔');
  });

  it('N3 回归：同集同序才算未变化（不写盘）；顺序不同视为变化', async () => {
    const dup = ['---', 'date: 2024-01-01 08:00', 'type:', '  - 日记', '  - 诗', '---', '', 'A', ''].join('\n');
    makeVault({ [E1]: dup });
    // 逐位相等：['日记','诗'] → ['诗','日记'] 是不同序集合，判为变化写盘
    const before = vault.files.get(E1);
    await updateDiaryTags(DATE, (e) => e.time === '08:00', ['诗', '日记']);
    expect(vault.files.get(E1)).not.toBe(before);
    expect(vault.files.get(E1)).toContain('  - 诗');
  });

  it('N4 回归：改标签保留契约外 frontmatter 键（不静默丢弃用户自加属性）', async () => {
    const withExtra = [
      '---',
      'date: 2024-01-01 08:00',
      'cssclass: wide',
      'type:',
      '  - 日记',
      'tags: [a, b]',
      '---',
      '',
      'A',
      '',
    ].join('\n');
    makeVault({ [E1]: withExtra });
    const updated = await updateDiaryTags(DATE, (e) => e.time === '08:00', ['骑行']);
    expect(updated?.tags).toEqual(['骑行']);
    const disk = vault.files.get(E1)!;
    expect(disk).toContain('date: 2024-01-01 08:00');
    expect(disk).toContain('  - 骑行');
    expect(disk).toContain('cssclass: wide'); // 契约外键原样保留
    expect(disk).toContain('tags: [a, b]');
    expect(disk).toContain('A'); // 正文不动
  });

  it('N4 回归：name-mismatch（属性时间与题目不一致）的文件拒写并发通知引导先体检', async () => {
    // 题目 0800 vs 属性 09:30：体检口径 name-mismatch（需人工裁决），改标签不得单方面按题目归一
    const mismatch = ['---', 'date: 2024-01-01 09:30', 'type:', '  - 日记', '---', '', 'A', ''].join('\n');
    makeVault({ [E1]: mismatch });
    const before = vault.files.get(E1);
    // 运行时宽降级：属性可信 → entry.time = 09:30，谓词命中该条目后才触发拒写检查
    const updated = await updateDiaryTags(DATE, (e) => e.time === '09:30', ['骑行']);
    expect(updated).toBeNull(); // 拒写
    expect(vault.files.get(E1)).toBe(before); // 磁盘一字不动（date 未被单方面改成 08:00）
  });
});

describe('findDiaryEntry / listDateEntries', () => {
  it('完整路径命中；旧日期串形状返回 null（条目文件化后无对应文件）', async () => {
    makeVault({ [E1]: fm('08:00', ['日记'], 'A') });
    const hit = await findDiaryEntry(E1);
    expect(hit).toMatchObject({ time: '08:00', content: 'A', filePath: E1 });
    expect(await findDiaryEntry(DATE)).toBeNull();
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
  it('frontmatter 日期损坏 → 从题目降级，读写照常', async () => {
    const corrupt = '---\ndate: 2024-13-45 99:99\ntype:\n  - 日记\n---\n\n正文';
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
    expect(vault.files.get('我的/日记/2401010900.md')).toContain('B');
    expect(vault.files.get('我的/日记/2401011000.md')).toContain('C');
  });

  it('不同日期并行写互不影响', async () => {
    makeVault({});
    await Promise.all([
      addEntry('2024-01-01', '09:00', ['日记'], 'B'),
      addEntry('2024-01-02', '08:00', ['日记'], 'Y'),
    ]);
    expect(vault.files.get('我的/日记/2401010900.md')).toContain('B');
    expect(vault.files.get('我的/日记/2401020800.md')).toContain('Y');
  });
});

describe('子目录落点（opts.filePath 只取其目录）', () => {
  const NESTED = '我的/日记/旧/2401010800.md';

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
    const hit = await findDiaryEntry(NESTED);
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
    expect(vault.files.get('我的/日记/旧/2401010900.md')).toContain('新条目');
    expect(vault.files.has(E2)).toBe(false);
  });
});

describe('内存路径同步（issue 339：vault:md-renamed / vault:md-deleted 纯内存口）', () => {
  /** 预置 map 快照：oldPath 一条 + 无关路径一条 */
  function seedMap() {
    const mk = (path: string, content: string): any => ({
      date: DATE, time: '08:00', timeValue: 800, tags: ['日记'], emoji: '📖',
      content, filename: path, filePath: path, lineNumber: 0,
    });
    const entries = [mk(E1, '命中'), mk('我的/日记/2401020800.md', '无关')];
    setDiaryDataMap(new Map([[E1, [entries[0]]], ['我的/日记/2401020800.md', [entries[1]]]]));
    return entries;
  }

  it('rekeyDiaryMapPath：键迁移 + 条目 filePath/filename 重定向；无关键不动；返回是否改动', () => {
    const entries = seedMap();
    const next = '我的/日记/2401010930.md';
    expect(rekeyDiaryMapPath(E1, next)).toBe(true);
    expect(diaryDataMap!.has(E1)).toBe(false);
    expect(diaryDataMap!.get(next)![0]).toBe(entries[0]);
    expect(entries[0].filePath).toBe(next);
    expect(entries[0].filename).toBe(next);
    expect(diaryDataMap!.has('我的/日记/2401020800.md')).toBe(true); // 无关键原样
    expect(entries[1].filePath).toBe('我的/日记/2401020800.md');
  });

  it('rekeyDiaryMapPath：无 map / 无命中键 / 同路径 → 空转返回 false，不误建键', () => {
    setDiaryDataMap(null);
    expect(rekeyDiaryMapPath(E1, E2)).toBe(false); // 无 map
    seedMap();
    expect(rekeyDiaryMapPath('我的/日记/不存在.md', E2)).toBe(false); // 无命中键
    expect(rekeyDiaryMapPath(E1, E1)).toBe(false); // 同路径
    expect(diaryDataMap!.has(E2)).toBe(false);
    expect(diaryDataMap!.has(E1)).toBe(true);
  });

  it('dropDiaryMapPath：命中键移除返回 true；无 map/无命中返回 false', () => {
    setDiaryDataMap(null);
    expect(dropDiaryMapPath(E1)).toBe(false); // 无 map
    seedMap();
    expect(dropDiaryMapPath(E1)).toBe(true);
    expect(diaryDataMap!.has(E1)).toBe(false);
    expect(diaryDataMap!.size).toBe(1); // 无关键保留
    expect(dropDiaryMapPath(E1)).toBe(false); // 已移除
    expect(dropDiaryMapPath('')).toBe(false); // 空路径
  });
});
