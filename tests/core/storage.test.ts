// @vitest-environment node
/**
 * 统一 JSON 数据读写层测试（统一数据读写重构）
 * - storageDir/storageFile：路径解析（trim 尾斜杠、空回退 CONFIG/STORAGE）
 * - jsonFileStore 泛型：defaultValue（对象/函数）、损坏留档 + onCorrupt 钩子
 * - writeIfChanged：写前比对跳过写 / 内容变才写
 * - app 注入：传 app 时用注入的，不传回退 getApp()
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jsonFileStore, storageDir, storageFile } from '../../src/core/storage';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('storageDir / storageFile', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({} as any));
  });

  it('storageDir：默认 CONFIG/STORAGE', () => {
    expect(storageDir()).toBe('CONFIG/STORAGE');
  });

  it('storageDir：跟随 storagePath 并 trim 尾斜杠', () => {
    setSettingsProvider(() => ({ storagePath: 'DATA/番茄/' } as any));
    expect(storageDir()).toBe('DATA/番茄');
  });

  it('storageDir：空 storagePath 回退 CONFIG/STORAGE', () => {
    setSettingsProvider(() => ({ storagePath: '' } as any));
    expect(storageDir()).toBe('CONFIG/STORAGE');
  });

  it('storageFile：拼文件路径', () => {
    setSettingsProvider(() => ({ storagePath: 'DATA' } as any));
    expect(storageFile('news.json')).toBe('DATA/news.json');
  });

  it('storageFile：base 覆盖 storagePath（旧字段兜底域）', () => {
    setSettingsProvider(() => ({ storagePath: 'DATA' } as any));
    expect(storageFile('review.json', 'OLD/复习')).toBe('OLD/复习/review.json');
  });
});

describe('jsonFileStore', () => {
  let vault: MockVault;
  let app: any;

  beforeEach(() => {
    vault = new MockVault();
    app = { vault };
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
  });

  it('defaultValue 对象：缺失 → 建对象初始值文件并返回', async () => {
    const store = jsonFileStore<{ notes: Record<string, unknown> }>('CONFIG/STORAGE/quiz.json', {
      defaultValue: { notes: {} },
    });
    const data = await store.read();
    expect(data).toEqual({ notes: {} });
    expect(vault.files.has('CONFIG/STORAGE/quiz.json')).toBe(true);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/quiz.json')!)).toEqual({ notes: {} });
  });

  it('defaultValue 函数：每次读取求值（防共享引用被外部 mutate）', async () => {
    const factory = () => ({ items: [] as string[] });
    const store = jsonFileStore<{ items: string[] }>('f.json', { defaultValue: factory });
    const a = await store.read();
    const b = await store.read();
    expect(a).toEqual({ items: [] });
    expect(b).toEqual({ items: [] });
    // 每次读取是独立对象（mutate a 不影响后续读取）
    a.items.push('x');
    const c = await store.read();
    expect(c.items).toEqual([]);
  });

  it('损坏 JSON → CONFIG/.CORRUPT 留档重建默认值 + onCorrupt 钩子', async () => {
    const broken = '{broken';
    vault.files.set('CONFIG/STORAGE/data.json', broken);
    const corruptSpy = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = jsonFileStore('CONFIG/STORAGE/data.json', { onCorrupt: corruptSpy });
      expect(await store.read()).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
    expect(corruptSpy).toHaveBeenCalledTimes(1);
    expect(corruptSpy.mock.calls[0][0]).toBe('CONFIG/STORAGE/data.json');
    // D1 留档契约：原样留档到 CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak，原路径重建默认值
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/data.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/data.json')!)).toEqual([]);
  });

  it('writeIfChanged：内容没变 → 跳过写（不刷新 mtime 语义）', async () => {
    const store = jsonFileStore<any[]>('a.json', { writeIfChanged: true });
    await store.write([{ x: 1 }]);
    const writes: string[] = [];
    const origModify = vault.modify.bind(vault);
    vault.modify = async (f: any, c: string) => { writes.push(f.path); return origModify(f, c); };
    // 同内容再存 → 跳过
    await store.write([{ x: 1 }]);
    expect(writes).toEqual([]);
    // 内容变 → 照写
    await store.write([{ x: 2 }]);
    expect(writes).toEqual(['a.json']);
  });

  it('writeIfChanged 默认关：同内容照写（行为保持现状）', async () => {
    const store = jsonFileStore<any[]>('a.json');
    await store.write([{ x: 1 }]);
    const writes: string[] = [];
    const origModify = vault.modify.bind(vault);
    vault.modify = async (f: any, c: string) => { writes.push(f.path); return origModify(f, c); };
    await store.write([{ x: 1 }]);
    expect(writes).toEqual(['a.json']); // 默认关 → 照写
  });

  it('app 注入优先：传 app 时用注入的，不传回退 getApp()', async () => {
    // 未 setApp 时传 app 注入可用
    setApp(null as any);
    const otherVault = new MockVault();
    const store = jsonFileStore('inj.json', { app: { vault: otherVault } });
    await store.write([1]);
    expect(otherVault.files.has('inj.json')).toBe(true);
    // 不传 app 且未 setApp → getApp 抛错
    await expect(jsonFileStore('noapp.json').read()).rejects.toThrow('app 未初始化');
  });
});
