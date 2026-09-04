// @vitest-environment node
/**
 * jsonStore 测试（ticket 02）：不存在建目录建文件、损坏留档重建、write 语义。
 * P1-31：并发首建竞态（create 撞「已存在」降级重读/modify，数据不丢）。
 * P1-32：解析失败不再静默清库——原文件原样留档 CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak（D1 契约）后重建空库。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jsonStore } from '../../src/core/json-store';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';

describe('jsonStore', () => {
  let vault: MockVault;
  let app: any;

  beforeEach(() => {
    vault = new MockVault();
    app = { vault };
    setApp(app);
  });

  /** 模拟真实 Obsidian 语义：vault.create 对已存在路径抛「already exists」（MockVault 默认静默覆盖） */
  function raceAwareCreate(): void {
    const rawCreate = vault.create.bind(vault);
    vault.create = async (path: string, content: string) => {
      if (vault.files.has(path)) throw new Error('File already exists: ' + path);
      return rawCreate(path, content);
    };
  }

  it('文件不存在 → 建目录+建文件并返回 []', async () => {
    const store = jsonStore('CONFIG/STORAGE/memo.json');
    const data = await store.read();
    expect(data).toEqual([]);
    expect(vault.files.has('CONFIG/STORAGE/memo.json')).toBe(true);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
  });

  it('写入后读取往返（格式化缩进 2 空格）', async () => {
    const store = jsonStore('CONFIG/STORAGE/memo.json');
    await store.read(); // 建文件
    await store.write([{ id: 'a', title: '任务' }]);
    const data = await store.read();
    expect(data).toEqual([{ id: 'a', title: '任务' }]);
    expect(vault.files.get('CONFIG/STORAGE/memo.json')).toBe('[\n  {\n    "id": "a",\n    "title": "任务"\n  }\n]');
  });

  it('P1-32 注入损坏 JSON → read 返回 [] 且原内容留档存在', async () => {
    const broken = '{broken json';
    vault.files.set('CONFIG/STORAGE/memo.json', broken);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = jsonStore('CONFIG/STORAGE/memo.json');
      expect(await store.read()).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
    // 原内容原样留档（CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak，D1 契约），未丢失
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/memo.json.'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^CONFIG\/\.CORRUPT\/memo\.json\.\d{8}-\d{6}\.bak$/);
    expect(vault.files.get(backups[0])).toBe(broken);
    // 原路径重建空库
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
  });

  it('P1-32 留档失败 → 容错原地重建空库（不抛错）', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', '{broken');
    const rawCreate = vault.create.bind(vault);
    vault.create = async (path: string, content: string) => {
      if (path.startsWith('CONFIG/.CORRUPT/')) throw new Error('create failed');
      return rawCreate(path, content);
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const store = jsonStore('CONFIG/STORAGE/memo.json');
      expect(await store.read()).toEqual([]);
      // 留档失败：无留档文件，原路径被重建为 []
      expect([...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/'))).toHaveLength(0);
      expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('P1-31 并发双 read 首建同一文件均成功且内容正确', async () => {
    raceAwareCreate();
    const store = jsonStore('CONFIG/STORAGE/race.json');
    const [a, b] = await Promise.all([store.read(), store.read()]);
    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/race.json')!)).toEqual([]);
  });

  it('P1-31 read 首建空文件与 write 数据交错时写入不丢', async () => {
    raceAwareCreate();
    const store = jsonStore('CONFIG/STORAGE/race2.json');
    const data = [{ id: 1, title: '并发数据' }];
    await Promise.all([store.read(), store.write(data)]);
    // 无论 create 谁先抢到，最终落盘都是 write 的数据（降级为 modify）
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/race2.json')!)).toEqual(data);
  });

  it('P1-31 非竞态 create 错误照常抛出（不吞异常）', async () => {
    vault.createFolder = async () => {
      throw new Error('disk full');
    };
    const store = jsonStore('X/Y/data.json');
    await expect(store.read()).rejects.toThrow('disk full');
  });

  it('write 时目录不存在自动创建', async () => {
    const store = jsonStore('深/层/目录/data.json');
    await store.write([1, 2]);
    expect(vault.files.has('深/层/目录/data.json')).toBe(true);
    expect(vault.dirs.has('深/层')).toBe(false); // 目录按需隐式存在（文件树以文件为准）
    expect(JSON.parse(vault.files.get('深/层/目录/data.json')!)).toEqual([1, 2]);
  });

  it('write 已存在文件用 modify（不重复创建）', async () => {
    vault.files.set('a.json', '[]');
    const store = jsonStore('a.json');
    await store.write([{ x: 1 }]);
    expect(vault.files.get('a.json')).toContain('"x"');
  });
});
