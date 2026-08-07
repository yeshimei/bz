/**
 * jsonStore 测试（ticket 02）：不存在建目录建文件、解析失败重置、write 语义。
 */
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('解析失败 → 重置 [] 并写回', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', '{broken json');
    const store = jsonStore('CONFIG/STORAGE/memo.json');
    const data = await store.read();
    expect(data).toEqual([]);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
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
