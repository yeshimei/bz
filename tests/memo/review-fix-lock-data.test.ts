// @vitest-environment node
/**
 * 锁家族修复批回归（review-all-bugs.md 三节 E 系 memo 数据侧）：
 * E21 rename 标题联动仅对引用条目生效（不盲改同名无关条目）、
 * E22 监听范围外但被 memo.json 引用的笔记 rename/delete 照常同步、
 * E23 memo.json 合法 JSON 但非数组 → 损坏留档重建，不再静默空白。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureFileSync, unloadFileSync } from '../../src/memo/file-sync';
import { MemoData } from '../../src/memo/data';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

const SETTINGS = { storagePath: 'CONFIG/STORAGE' };

async function flushQueue() {
  await new Promise((r) => setTimeout(r, 400)); // 覆盖 rename 去抖窗口
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 0));
}

describe('memo 引用同步修复（E21/E22）', () => {
  let vault: MockVault;

  beforeEach(async () => {
    unloadFileSync();
    clearDomainEvents();
    vault = new MockVault();
    const app = { vault: vault as any };
    setApp(app as any);
    setSettingsProvider(() => ({ ...SETTINGS }) as any);
    MemoData.init({ ...SETTINGS } as any);
    ensureFileSync(app as any);
  });

  it('E21：rename 标题联动只对引用了该笔记的条目生效，同名无关条目不动', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '旧笔记', scene: '工作', linkedNote: '卡片盒/旧笔记.md', notePath: '卡片盒/旧笔记.md', url: null },
      { id: 'm2', title: '旧笔记', scene: '生活', linkedNote: null, notePath: null, url: null }, // 内容恰好同名，未引用该文件
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/旧笔记.md', newPath: '卡片盒/新笔记.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0]).toMatchObject({ title: '新笔记', linkedNote: '卡片盒/新笔记.md', notePath: '卡片盒/新笔记.md' });
    expect(bz[1].title).toBe('旧笔记'); // 修复前被盲改成「新笔记」
  });

  it('E22：监听范围外但被 notePath 引用的笔记 rename → 引用同步', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '随笔条目', scene: '生活', linkedNote: null, notePath: '随笔/范围外.md', url: null },
    ], null, 2));

    emitDomainEvent('vault:md-renamed', { oldPath: '随笔/范围外.md', newPath: '随笔/范围外2.md' });
    await flushQueue();

    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].notePath).toBe('随笔/范围外2.md'); // 修复前：范围外事件被丢弃 → 引用失效
  });

  it('E22：范围外被引用笔记 delete → 清空关联；范围外无引用笔记不动 memo.json', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '随笔条目', scene: '生活', linkedNote: null, notePath: '随笔/范围外.md', url: null },
    ], null, 2));

    // 无引用的范围外笔记：不触发写
    const writesBefore = vault.modifiedPaths.filter((p) => p.endsWith('memo.json')).length;
    emitDomainEvent('vault:md-deleted', { path: '随手记/与备忘录无关.md' });
    await new Promise((r) => setTimeout(r, 50));
    expect(vault.modifiedPaths.filter((p) => p.endsWith('memo.json')).length).toBe(writesBefore);

    // 被引用的范围外笔记：清空关联
    emitDomainEvent('vault:md-deleted', { path: '随笔/范围外.md' });
    await new Promise((r) => setTimeout(r, 50));
    const bz = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(bz[0].notePath).toBeNull();
  });
});

describe('E23：memo.json 非数组损坏形态留档重建', () => {
  it('合法 JSON 但为对象 → loadItems 返回空数组、原内容留档、文件重建 []', async () => {
    unloadFileSync();
    clearDomainEvents();
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', '{"a":1}');
    setApp({ vault } as any);
    setSettingsProvider(() => ({ ...SETTINGS }) as any);
    MemoData.init({ ...SETTINGS } as any);

    const items = await MemoData.loadItems();
    expect(items).toEqual([]); // 修复前：raw.map 抛 TypeError 被吞 → 面板静默空白
    expect(vault.files.get('CONFIG/STORAGE/memo.json')).toBe('[]');
    // 原内容已按 D1 契约留档
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/') && p.includes('memo.json'));
    expect(backups.length).toBe(1);
    expect(vault.files.get(backups[0])).toBe('{"a":1}');
  });

  it('合法数组照常加载（对照）', async () => {
    unloadFileSync();
    clearDomainEvents();
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: 'm1', title: '正常条目', scene: '工作' },
    ]));
    setApp({ vault } as any);
    setSettingsProvider(() => ({ ...SETTINGS }) as any);
    MemoData.init({ ...SETTINGS } as any);

    const items = await MemoData.loadItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('正常条目');
    expect(items[0].priority).toBe('minor'); // 归一补齐
    void vi;
  });
});
