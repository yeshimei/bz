// @vitest-environment node
/**
 * 备忘录（memo）数据层回归（批 B 修复）：loadItems 元素级守卫（M2）、normalizeItem
 * 字段兜底（M2）、getCourseNotes 目录前缀边界（A6）、deleteCompletedBefore 批量清理
 * 与快照原位插回（效率#11）。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoData, normalizeItem } from '../../src/memo/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return {
    vault,
    workspace: { getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  };
}

const BASE_SETTINGS = {
  memoFilePath: 'CONFIG/STORAGE',
  cinemaFolderPath: '我的/影视',
};

describe('批 B 数据层修复', () => {
  let vault: MockVault;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('M2 loadItems：[null, {...}] 坏元素剔除、其余上墙、剔除后回写盘', async () => {
    MemoData.init(BASE_SETTINGS);
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([null, { id: 'x', title: '正常条目', scene: '工作' }, 'garbage', 42])
    );
    const items = await MemoData.loadItems();
    // 坏元素（null/字符串/数字）全部剔除，合法条目照常归一
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('x');
    expect(items[0].title).toBe('正常条目');
    // console.warn 一次汇总留痕
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String((warnSpy.mock.calls[0] as unknown[])[0])).toContain('3');
    // 剔除结果回写盘（坏元素不留在盘上，下次读不再重复告警）
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.length).toBe(1);
    expect(raw[0].id).toBe('x');
  });

  it('M2 loadItems：纯好数据不触发回写与告警', async () => {
    MemoData.init(BASE_SETTINGS);
    const good = JSON.stringify([{ id: 'a', title: 'A', scene: '工作' }]);
    vault.files.set('CONFIG/STORAGE/memo.json', good);
    const items = await MemoData.loadItems();
    expect(items.length).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(vault.files.get('CONFIG/STORAGE/memo.json')).toBe(good);
  });

  it('M2 normalizeItem：title/scene 关键字段 String() 归一（缺失回落空串）', () => {
    const it = normalizeItem({ id: 'n1', title: null, scene: 123 });
    expect(it.title).toBe('');
    expect(it.scene).toBe('123');
    // 缺 title 字段（手改脏数据）不再让渲染层 it.title.length TypeError
    const it2 = normalizeItem({ id: 'n2' });
    expect(it2.title).toBe('');
    expect(it2.scene).toBe('');
    expect(it2.priority).toBe('minor');
    // null/非对象入参安全（loadItems 已挡，completeItem 链路防御）
    const it3 = normalizeItem(null);
    expect(it3.title).toBe('');
    expect(it3.completed).toBeNull();
  });

  it('A6 getCourseNotes：同级兄弟目录「我的/影视花絮」不被「我的/影视」误命中', async () => {
    MemoData.init(BASE_SETTINGS);
    vault.files.set('我的/影视/《公开课：AI》.md', '---\ntags: [公开课]\n---\n内容');
    vault.files.set('我的/影视花絮/《花絮也带课》.md', '---\ntags: [公开课]\n---\n内容');
    const app = makeApp(vault) as any;
    setApp(app);
    app.metadataCache.getFileCache = (file: any) => {
      const content = vault.files.get(file.path) || '';
      const m = content.match(/^---\n([\s\S]*?)\n---/);
      const tags: string[] = [];
      if (m) {
        const tm = m[1].match(/tags:\s*\[([^\]]*)\]/);
        if (tm) tags.push(...tm[1].split(',').map((s: string) => s.trim()));
      }
      return { tags: tags.map((t) => ({ tag: '#' + t })), frontmatter: { tags } };
    };
    app.vault.getFiles = () =>
      [...vault.files.keys()].map((p) => ({
        path: p,
        basename: p.split('/').pop()!.replace(/\.md$/, ''),
        extension: p.endsWith('.md') ? 'md' : '',
      }));
    const notes = await MemoData.getCourseNotes();
    // 只命中目录本身下的文件；兄弟前缀目录（影视花絮）不再被裸 startsWith 带进来
    expect(notes).toEqual([{ name: '《公开课：AI》', path: '我的/影视/《公开课：AI》.md' }]);
  });
});

describe('效率#11 deleteCompletedBefore 批量清理', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    MemoData.init(BASE_SETTINGS);
  });

  function seed(rows: unknown[]): void {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(rows, null, 2));
  }

  it('时间窗批删：completed < cutoff 的一次删除，返回快照含原索引；窗内/未完成保留', async () => {
    seed([
      { id: 'd1', title: '未完成', scene: '工作', completed: null },
      { id: 'd2', title: '40天前完成', scene: '工作', completed: '2026-07-01 10:00:00' },
      { id: 'd3', title: '昨天完成', scene: '生活', completed: '2026-09-17 09:00:00' },
    ]);
    const removed = await MemoData.deleteCompletedBefore('2026-09-01 00:00:00');
    expect(removed.map((r) => r.item.id)).toEqual(['d2']);
    expect(removed[0].idx).toBe(1); // 删除前文件序原索引
    expect(removed[0].item.title).toBe('40天前完成');
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd3']);
  });

  it('cutoff 传 null 清全部已完成；onlyIds 收窄到集合内', async () => {
    seed([
      { id: 'a', title: '未完成', completed: null },
      { id: 'b', title: '完成B', completed: '2026-01-01 00:00:00' },
      { id: 'c', title: '完成C', completed: '2026-02-01 00:00:00' },
    ]);
    const removed = await MemoData.deleteCompletedBefore(null, new Set(['b']));
    expect(removed.map((r) => r.item.id)).toEqual(['b']);
    let raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.map((r: any) => r.id)).toEqual(['a', 'c']);

    const removed2 = await MemoData.deleteCompletedBefore(null);
    expect(removed2.map((r) => r.item.id)).toEqual(['c']);
    raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.map((r: any) => r.id)).toEqual(['a']);
  });

  it('无可清条目不写盘、返回空数组', async () => {
    seed([{ id: 'a', title: '未完成', completed: null }]);
    const before = vault.files.get('CONFIG/STORAGE/memo.json');
    const removed = await MemoData.deleteCompletedBefore('2020-01-01 00:00:00');
    expect(removed).toEqual([]);
    expect(vault.files.get('CONFIG/STORAGE/memo.json')).toBe(before);
  });

  it('快照原位插回：按原索引升序逐条 restoreItem 恢复完整文件序', async () => {
    seed([
      { id: 'd1', title: '未完成1', completed: null },
      { id: 'd2', title: '完成2', completed: '2026-07-01 10:00:00' },
      { id: 'd3', title: '未完成3', completed: null },
      { id: 'd4', title: '完成4', completed: '2026-06-01 10:00:00' },
      { id: 'd5', title: '未完成5', completed: null },
    ]);
    const removed = await MemoData.deleteCompletedBefore('2026-09-01 00:00:00');
    expect(removed.map((r) => r.item.id)).toEqual(['d2', 'd4']);
    let raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd3', 'd5']);
    // 升序插回（restoreItem 为绝对位置 splice(at,0)，降序会因前置条目缺失整体偏后）
    const sorted = [...removed].sort((a, b) => a.idx - b.idx);
    for (const r of sorted) await MemoData.restoreItem(r.item, r.idx);
    raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
  });
});
