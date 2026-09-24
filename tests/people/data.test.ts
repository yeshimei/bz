/**
 * 脸谱域数据层测试（issue 435）：people.json 读写、upsert 增改、导入记录与脸谱写入、
 * 删除与不存在人物报错（MockVault + 串行写队列）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PeopleStore, getPeopleFilePath } from '../../src/people/data';
import type { PersonEntry } from '../../src/people/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function setup(vault: MockVault, settings: any = { storagePath: 'CONFIG/STORAGE' }) {
  setApp({ vault } as any);
  setSettingsProvider(() => settings as any);
  resetObsidianMocks();
}

function person(id: string, name = id): PersonEntry {
  return { id, name, createdAt: '2026-09-25T00:00:00.000Z', imports: [] };
}

describe('PeopleStore', () => {
  let vault: MockVault;
  let store: PeopleStore;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    store = new PeopleStore({ vault });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('路径解析：storagePath 基目录 + people.json', () => {
    expect(getPeopleFilePath()).toBe('CONFIG/STORAGE/people.json');
    setSettingsProvider(() => ({ storagePath: 'CUSTOM/DIR' }) as any);
    expect(getPeopleFilePath()).toBe('CUSTOM/DIR/people.json');
  });

  it('空库 list → [];upsert 新增后可查（缺失建文件）', async () => {
    expect(await store.list()).toEqual([]);
    await store.upsert(person('wxid_a', '老王'));
    const people = await store.list();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('老王');
    expect(vault.files.has('CONFIG/STORAGE/people.json')).toBe(true);
  });

  it('upsert 同 id 整卡替换（改名不换 id）', async () => {
    await store.upsert(person('wxid_a', '旧名'));
    await store.upsert(person('wxid_a', '新名'));
    const people = await store.list();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('新名');
  });

  it('appendImport / setDigest 写入生效；按 createdAt 升序', async () => {
    await store.upsert(person('b', '后建'));
    await store.upsert({ ...person('a', '先建'), createdAt: '2026-09-24T00:00:00.000Z' });
    await store.appendImport('b', {
      file: '老王.csv',
      importedAt: '2026-09-25T01:00:00.000Z',
      messageCount: 120,
      skippedCount: 8,
      timeFrom: '2024-01-01T00:00:00.000Z',
      timeTo: '2024-12-31T00:00:00.000Z',
    });
    await store.setDigest('b', { portrait: '## 速写', events: [{ ts: '2024-05-01', summary: '约饭' }], generatedAt: '2026-09-25T01:00:00.000Z' });
    const [first, second] = await store.list();
    expect(first.id).toBe('a');
    expect(second.imports).toHaveLength(1);
    expect(second.imports[0].messageCount).toBe(120);
    expect(second.digest?.portrait).toBe('## 速写');
  });

  it('mutate 不存在的人物抛错；remove 删除后 list 为空', async () => {
    await expect(store.appendImport('ghost', {
      file: 'x.csv', importedAt: '', messageCount: 0, skippedCount: 0, timeFrom: '', timeTo: '',
    })).rejects.toThrow('人物不存在');
    await store.upsert(person('wxid_a'));
    await store.remove('wxid_a');
    expect(await store.list()).toEqual([]);
  });
});
