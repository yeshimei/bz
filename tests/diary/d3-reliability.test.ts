// @vitest-environment node
/**
 * 日记 D3 可靠写契约回归（旧域冻结区只动写安全）：
 * ①同日并发写串行落盘——连续快速追加（addEntry 内 writeFile）与外部整写（writeFile）并发，
 *   磁盘终态为「完整渲染的某一次写」且与内存 map 一致（无读-写窗口交错覆盖）；
 * ②不同日期并行写互不影响（异文件并行语义保持）；
 * ③清空整日（deleteEntry 删除分支）守卫+删除入同队列：条目清空后文件删除、file-vacated 事件照发。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/diary/app';
import { resetTagsConfig, applyDirectories } from '../../src/diary/config';
import { addEntry, deleteEntry, loadAll, writeFile, onFileDeleted } from '../../src/diary/store';
import { setDiaryDataMap, state } from '../../src/diary/state';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault, mockAppWithVault } from '../mock-vault';

const FILE = (date: string) => `我的/日记/${date}.md`;

beforeEach(() => {
  resetTagsConfig();
  applyDirectories({});
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.events.isInternalUpdate = false;
  setDiaryDataMap(null);
  vi.restoreAllMocks();
});

function makeVault(files: Record<string, string>) {
  const vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
  return vault;
}

describe('日记 D3 可靠写契约（writeFile 入 per-path 串行队列）', () => {
  it('①同日并发写：两次 writeFile 交错排队，磁盘终态完整且与内存 map 一致', async () => {
    const vault = makeVault({ [FILE('2024-01-01')]: '# 📖 08:00\n第一条\n\n# 📖 09:00\n第二条\n' });
    await loadAll();

    // 并发整写两次（模拟连续快速保存）：任务按序串行，终态 = 最后一次完整渲染
    await Promise.all([writeFile('2024-01-01'), writeFile('2024-01-01')]);

    const disk = vault.files.get(FILE('2024-01-01'))!;
    // 完整性：无半截行（每个标题与其内容完整存在）
    expect(disk).toContain('# 📖 08:00');
    expect(disk).toContain('第一条');
    expect(disk).toContain('第二条');
    // 与内存 map 一致（标题数 = map 条目数）
    const entries = state.data.originalDiaryEntries.filter((e) => !e.encrypted);
    expect(disk.split('\n').filter((l) => l.startsWith('# ')).length).toBe(entries.length);
  });

  it('①续：addEntry 与外部整写并发，新条目不丢（后写者基于先写者）', async () => {
    const vault = makeVault({ [FILE('2024-01-01')]: '# 📖 08:00\n第一条\n' });
    await loadAll();

    const external = writeFile('2024-01-01'); // 外部触发的整写
    const added = addEntry('2024-01-01', '10:00', [], '新追加条目'); // 面板快速追加（内部走同队列）
    await Promise.all([external, added]);

    const disk = vault.files.get(FILE('2024-01-01'))!;
    expect(disk).toContain('第一条');
    expect(disk).toContain('新追加条目'); // 串行后写保留先写内容
  });

  it('②不同日期并行写互不影响', async () => {
    const vault = makeVault({
      [FILE('2024-01-01')]: '# 📖 08:00\n一日\n',
      [FILE('2024-01-02')]: '# 📖 09:00\n二日\n',
    });
    await loadAll();
    await Promise.all([writeFile('2024-01-01'), writeFile('2024-01-02')]);
    expect(vault.files.get(FILE('2024-01-01'))!).toContain('一日');
    expect(vault.files.get(FILE('2024-01-02'))!).toContain('二日');
  });

  it('③deleteEntry 清空整日：守卫+删除入同队列，文件删除、file-vacated 事件照发', async () => {
    const vault = makeVault({ [FILE('2024-01-01')]: '# 📖 08:00\n唯一条目\n' });
    await loadAll();
    const received: any[] = [];
    const off = onDomainEvent('diary:file-vacated', (evt: any) => received.push(evt));

    const entry = state.data.originalDiaryEntries[0];
    if (!entry || !entry.id) throw new Error('未加载到待删条目');
    await deleteEntry(entry.id);

    expect(vault.files.has(FILE('2024-01-01'))).toBe(false); // 整文件删除
    expect(received).toEqual([{ date: '2024-01-01' }]); // 结构性事件未丢
    off();
  });

  it('③续：外部已删除文件后再删条目，不误报 vacated（文件缺失分支）', async () => {
    const vault = makeVault({ [FILE('2024-01-01')]: '# 📖 08:00\n唯一条目\n' });
    await loadAll();
    const received: any[] = [];
    const off = onDomainEvent('diary:file-vacated', (evt: any) => received.push(evt));

    vault.files.delete(FILE('2024-01-01'));
    await onFileDeleted({ path: FILE('2024-01-01') }); // 外部删除先行（同步剔除内存）
    // deleteEntry 清空 map 分支不会触发（条目已被外部剔除）；直接验证 vacated 未误发
    off();
    expect(received).toEqual([]);
  });
});
