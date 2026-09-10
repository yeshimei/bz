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
} from '../../src/diary/store';
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

const DAY = '我的/日记/2024-01-01.md';

describe('addEntry（写层：磁盘同步 → 插入 → 全量重写）', () => {
  it('插入并写盘：# emoji 时间 标题 + 正文，按时间序落位', async () => {
    makeVault({ [DAY]: '# 📖 08:00\n早\n' });
    await addEntry('2024-01-01', '09:05', ['日记'], '新条目');
    const disk = vault.files.get(DAY)!;
    const lines = disk.split('\n');
    expect(lines[0]).toBe('# 📖 08:00');
    // 每条目格式：标题行/空行/正文/空行——第二条标题在第 5 行、正文在第 7 行
    expect(lines[4]).toBe('# 📖 09:05');
    expect(lines[6]).toBe('新条目');
  });

  it('日记本从未打开（无 map）也能安全写：当日文件先从磁盘同步再重写', async () => {
    makeVault({ [DAY]: '# 📖 08:00\n早\n\n# 🚴 07:00\n骑\n' });
    expect(diaryDataMap).toBeNull();
    const e = await addEntry('2024-01-01', '12:00', ['骑行'], '午骑');
    expect(e.lineNumber).toBeGreaterThan(0);
    const disk = vault.files.get(DAY)!;
    expect(disk).toContain('# 🚴 07:00');
    expect(disk).toContain('# 📖 08:00');
    expect(disk).toContain('# 🚴 12:00');
    expect(diaryDataMap!.get('2024-01-01')!.length).toBe(3);
  });

  it('P1-12 回归：同分钟追加后行号与磁盘标题行对位', async () => {
    makeVault({ [DAY]: '# 📖 09:00\nA\n' });
    await addEntry('2024-01-01', '09:00', ['日记'], 'B');
    const lines = vault.files.get(DAY)!.split('\n');
    // 磁盘顺序 09:00(A)、09:00(B)；第二个条目标题在第 5 行（每条目尾带空行）
    expect(lines[4]).toBe('# 📖 09:00');
    expect(diaryDataMap!.get('2024-01-01')![1].lineNumber).toBe(5);
  });

  it('发 diary:entry-added 事件（载荷 date/time/tags/content）', async () => {
    makeVault({});
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:entry-added', (e) => seen.push(e));
    await addEntry('2024-01-01', '10:00', ['日记'], '内容');
    off();
    expect(seen[0]).toMatchObject({ date: '2024-01-01', time: '10:00', tags: ['日记'], content: '内容' });
  });
});

describe('removeDiaryEntries（守卫删除 + 整文件清空）', () => {
  it('删除匹配条目写回；同日其余条目保留', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n\n# 🚴 09:00\nB\n' });
    const n = await removeDiaryEntries('2024-01-01', (e) => e.time === '08:00');
    expect(n).toBe(1);
    const disk = vault.files.get(DAY)!;
    expect(disk).toContain('# 🚴 09:00');
    expect(disk).not.toContain('# 📖 08:00');
  });

  it('P1-12 回归：同分钟多条删第二条，磁盘消失的必须是目标那条', async () => {
    makeVault({ [DAY]: '# 📖 09:00\nA\n\n# 📖 09:00\nB\n' });
    await listDateEntries('2024-01-01');
    const second = diaryDataMap!.get('2024-01-01')!.find((e) => e.content === 'B')!;
    await removeDiaryEntries('2024-01-01', (e) => e.time === second.time && e.lineNumber === second.lineNumber);
    const disk = vault.files.get(DAY)!;
    expect(disk).toContain('A');
    expect(disk).not.toContain('B');
  });

  it('删到空：整文件删除 + 发 diary:file-vacated', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:file-vacated', (e) => seen.push(e));
    await removeDiaryEntries('2024-01-01', () => true);
    off();
    expect(vault.files.has(DAY)).toBe(false);
    expect(seen[0]).toMatchObject({ date: '2024-01-01' });
  });

  it('0 命中：不写盘、不误报 vacated', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:file-vacated', (e) => seen.push(e));
    const n = await removeDiaryEntries('2024-01-01', (e) => e.time === '23:59');
    off();
    expect(n).toBe(0);
    expect(seen).toHaveLength(0);
    expect(vault.files.has(DAY)).toBe(true);
  });

  it('外部已删除文件后再删条目：0 命中、不误报 vacated', async () => {
    makeVault({});
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:file-vacated', (e) => seen.push(e));
    const n = await removeDiaryEntries('2024-01-01', () => true);
    off();
    expect(n).toBe(0);
    expect(seen).toHaveLength(0);
  });
});

describe('updateDiaryTags（行号优先定位改标签）', () => {
  it('改标签写盘并发 diary:tags-changed；返回更新后条目', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const { onDomainEvent } = await import('../../src/core/domain-bus');
    const seen: any[] = [];
    const off = onDomainEvent('diary:tags-changed', (e) => seen.push(e));
    const updated = await updateDiaryTags('2024-01-01', (e) => e.time === '08:00', ['骑行']);
    off();
    expect(updated?.tags).toEqual(['骑行']);
    expect(updated?.emoji).toBe('🚴');
    expect(vault.files.get(DAY)).toContain('# 🚴 08:00');
    expect(seen[0]).toMatchObject({ date: '2024-01-01', time: '08:00', from: ['日记'], to: ['骑行'] });
  });

  it('定位失败（磁盘无该条目）：返回 null、不改盘', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const updated = await updateDiaryTags('2024-01-01', (e) => e.time === '23:59', ['骑行']);
    expect(updated).toBeNull();
    expect(vault.files.get(DAY)).toContain('# 📖 08:00');
  });
});

describe('findDiaryEntry / listDateEntries', () => {
  it('filename+lineNumber 命中；快照未命中做一次磁盘同步后重查', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const hit = await findDiaryEntry('2024-01-01', 1);
    expect(hit).toMatchObject({ time: '08:00', content: 'A' });
    const miss = await findDiaryEntry('2024-01-01', 99);
    expect(miss).toBeNull();
  });

  it('listDateEntries 返回磁盘同步后的快照（副本，不影响 map）', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    const snapshot = await listDateEntries('2024-01-01');
    expect(snapshot).toHaveLength(1);
    snapshot[0].content = '改过的副本';
    expect(diaryDataMap!.get('2024-01-01')![0].content).toBe('A');
  });
});

describe('写前守卫（磁盘有未解析行即拒处理）', () => {
  it('addEntry 拒写：文件保持原样并抛错（人话通知在 jsdom 侧断言）', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n\n# 游记标题\n这段会丢\n' });
    await expect(addEntry('2024-01-01', '10:00', ['日记'], '新')).rejects.toThrow('无法解析');
    expect(vault.files.get(DAY)).toBe('# 📖 08:00\nA\n\n# 游记标题\n这段会丢\n');
  });

  it('removeDiaryEntries 同守卫拒删', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n\n# 游记标题\n这段会丢\n' });
    await expect(removeDiaryEntries('2024-01-01', () => true)).rejects.toThrow('无法解析');
    expect(vault.files.has(DAY)).toBe(true);
  });

  it('listDateEntries 同守卫拒读（findDiaryEntry 降级返回 null）', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n\n# 游记标题\n这段会丢\n' });
    await expect(listDateEntries('2024-01-01')).rejects.toThrow('无法解析');
    const hit = await findDiaryEntry('2024-01-01', 1);
    expect(hit).toBeNull();
  });
});

describe('D3 串行队列语义收口', () => {
  it('同日并发两次 addEntry：磁盘终态含两条且守卫同步正确', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n' });
    await Promise.all([
      addEntry('2024-01-01', '09:00', ['日记'], 'B'),
      addEntry('2024-01-01', '10:00', ['日记'], 'C'),
    ]);
    const disk = vault.files.get(DAY)!;
    expect(disk).toContain('A');
    expect(disk).toContain('B');
    expect(disk).toContain('C');
    expect(disk.split('\n').filter((l) => l.startsWith('# ')).length).toBe(3);
  });

  it('不同日期并行写互不影响', async () => {
    makeVault({ [DAY]: '# 📖 08:00\nA\n', '我的/日记/2024-01-02.md': '# 🚴 07:00\nX\n' });
    await Promise.all([
      addEntry('2024-01-01', '09:00', ['日记'], 'B'),
      addEntry('2024-01-02', '08:00', ['日记'], 'Y'),
    ]);
    expect(vault.files.get(DAY)).toContain('B');
    expect(vault.files.get('我的/日记/2024-01-02.md')).toContain('Y');
  });
});
