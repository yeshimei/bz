/**
 * 脸谱域数据层测试（issue 435 建域；467 / ADR-0194 改走保库记录）：PeopleStore 门面（同 API）
 * 的 upsert 增改、导入记录与脸谱写入、删除与不存在人物报错；明文 people.json 不再产生；
 * 双卷画像数据契约（issue 455）：FaceDigest person/bond/interests/threads 落盘读回 + personOf/bondOf 兼容读。
 * 存储 = 注入 SafeManager（MockVault 内存假库 + 真加密，密码本域注入式同款）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PeopleStore } from '../../src/people/data';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { bondOf, personOf } from '../../src/people/types';
import type { FaceDigest, ImportRecord, ManualEvent, PersonEntry } from '../../src/people/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const PW = 'data-test-pw';
let vault: MockVault;
let sm: SafeManager;
let safe: PeopleSafeStore;

function setup(vaultRef: MockVault, settings: any = { storagePath: 'CONFIG/STORAGE' }) {
  setApp({ vault: vaultRef } as any);
  setSettingsProvider(() => settings as any);
  resetObsidianMocks();
}

/** 共享装配：解锁保库并注入（门面与断言共用同一 PeopleSafeStore） */
async function setupSafe(vaultRef: MockVault): Promise<PeopleSafeStore> {
  setup(vaultRef);
  sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  return safe;
}

function person(id: string, name = id): PersonEntry {
  return { id, name, createdAt: '2026-09-25T00:00:00.000Z', imports: [] };
}

describe('PeopleStore（保库记录门面）', () => {
  let store: PeopleStore;

  beforeEach(async () => {
    vault = new MockVault();
    await setupSafe(vault);
    store = new PeopleStore(vault);
  });

  afterEach(() => {
    setPeopleSafeStoreForTests(null);
    sm.lock();
    vi.restoreAllMocks();
  });

  it('明文退役（467）：人物卡写进保库记录，people.json 明文文件不再产生', async () => {
    expect(await store.list()).toEqual([]);
    await store.upsert(person('wxid_a', '老王'));
    const people = await store.list();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('老王');
    expect(vault.files.has('CONFIG/STORAGE/people.json')).toBe(false);
    expect(vault.files.has('CONFIG/STORAGE/people-preview.json')).toBe(false);
    expect(vault.files.has('CONFIG/STORAGE/people-jobs.json')).toBe(false);
    // 记录在保险库清单里：kind=people、虚拟索引路径
    expect(safe.talkers()).toEqual(['wxid_a']);
    const note = sm.manifest.notes.find((n) => n.path === 'CONFIG/STORAGE/people/wxid_a');
    expect(note).toBeTruthy();
    expect((note as any).kind).toBe('people');
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

describe('PeopleStore.mergeInto（评审 443 补测）', () => {
  let store: PeopleStore;

  beforeEach(async () => {
    vault = new MockVault();
    await setupSafe(vault);
    store = new PeopleStore(vault);
  });

  afterEach(() => {
    setPeopleSafeStoreForTests(null);
    sm.lock();
    vi.restoreAllMocks();
  });

  function entry(id: string, extra: Partial<PersonEntry> = {}): PersonEntry {
    return { id, name: id, createdAt: '2026-09-25T00:00:00.000Z', imports: [], ...extra };
  }
  const rec = (file: string, importedAt: string): ImportRecord => ({
    file, importedAt, messageCount: 3, skippedCount: 0,
    timeFrom: '2024-01-01T00:00:00.000Z', timeTo: '2024-02-01T00:00:00.000Z',
  });
  const man = (id: string, ts: string): ManualEvent => ({ id, ts, summary: `事 ${id}`, createdAt: '2026-09-01T00:00:00.000Z' });

  it('imports 并入按 importedAt 升序；manualEvents 并入按 ts 升序', async () => {
    await store.upsert(entry('to', {
      imports: [rec('b.csv', '2026-09-02T00:00:00.000Z')],
      manualEvents: [man('t1', '2024-05-01')],
    }));
    await store.upsert(entry('from', {
      imports: [rec('a.csv', '2026-09-01T00:00:00.000Z')],
      manualEvents: [man('f2', '2024-06-01'), man('f1', '2024-04-01')],
    }));
    await store.mergeInto('from', 'to');
    const to = (await store.list()).find((p) => p.id === 'to');
    expect(to!.imports.map((r) => r.file)).toEqual(['a.csv', 'b.csv']);
    expect(to!.manualEvents!.map((e) => e.ts)).toEqual(['2024-04-01', '2024-05-01', '2024-06-01']);
  });

  it('digest 继承：to 无脸谱时继承 from 的；to 已有时保留自己的（from 的舍弃）', async () => {
    const digestOf = (portrait: string): FaceDigest => ({ portrait, events: [], generatedAt: '2026-09-01T00:00:00.000Z' });
    await store.upsert(entry('to1'));
    await store.upsert(entry('from', { digest: digestOf('from 画像') }));
    await store.mergeInto('from', 'to1');
    expect((await store.list()).find((p) => p.id === 'to1')!.digest?.portrait).toBe('from 画像');

    await store.upsert(entry('to2', { digest: digestOf('to 自己的') }));
    await store.upsert(entry('from2', { digest: digestOf('from2 画像') }));
    await store.mergeInto('from2', 'to2');
    expect((await store.list()).find((p) => p.id === 'to2')!.digest?.portrait).toBe('to 自己的');
  });

  it('from 合并后被移除', async () => {
    await store.upsert(entry('to'));
    await store.upsert(entry('from'));
    await store.mergeInto('from', 'to');
    expect((await store.list()).map((p) => p.id)).toEqual(['to']);
  });

  it('fromId === toId 直接返回：不抛错、人物原样保留', async () => {
    await store.upsert(entry('same'));
    await store.mergeInto('same', 'same');
    const people = await store.list();
    expect(people).toHaveLength(1);
    expect(people[0].id).toBe('same');
  });
});

describe('FaceDigest 双卷契约与兼容读（issue 455）', () => {
  let store: PeopleStore;

  beforeEach(async () => {
    vault = new MockVault();
    await setupSafe(vault);
    store = new PeopleStore(vault);
  });

  afterEach(() => {
    setPeopleSafeStoreForTests(null);
    sm.lock();
    vi.restoreAllMocks();
  });

  it('双卷 digest 落盘读回：person / bond / interests / threads 全字段无损', async () => {
    await store.upsert(person('wxid_dual', '双卷'));
    await store.setDigest('wxid_dual', {
      person: '## 画像速写\n其人卷',
      bond: '## 关系定性\n我们卷',
      events: [{ ts: '2024-05-01', summary: '约饭' }],
      quotes: [{ ts: '2024-05-01', who: '对方', text: '原话' }],
      chronicle: '## 2024 年',
      traits: ['话痨'],
      moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
      interests: [{ ts: '2024-05-01', topic: '五月天' }],
      threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
      generatedAt: '2026-09-26T00:00:00.000Z',
    });
    const p = (await store.list()).find((x) => x.id === 'wxid_dual');
    expect(p?.digest?.person).toBe('## 画像速写\n其人卷');
    expect(p?.digest?.bond).toBe('## 关系定性\n我们卷');
    expect(p?.digest?.interests).toEqual([{ ts: '2024-05-01', topic: '五月天' }]);
    expect(p?.digest?.threads).toEqual([{ ts: '2024-05-01', text: '下次一起爬山' }]);
    // 旧字段 portrait 不再写入（重画后缺席即新形态）
    expect('portrait' in (p?.digest ?? {})).toBe(false);
    // 加密记录体带全部新字段（解密回读）
    const rec = await safe.read('wxid_dual');
    const digest = rec?.person.digest!;
    expect(digest.person).toContain('其人卷');
    expect(digest.bond).toContain('我们卷');
    expect(digest.interests).toHaveLength(1);
    expect(digest.threads).toHaveLength(1);
  });

  it('personOf：双卷新数据取 person；旧单卷数据回落 portrait；空卷 / 缺 digest 返回空串', () => {
    expect(personOf({ person: '新其人卷', portrait: '旧单卷', events: [], generatedAt: '' })).toBe('新其人卷');
    expect(personOf({ portrait: '旧单卷', events: [], generatedAt: '' })).toBe('旧单卷');
    expect(personOf({ bond: '只有我们卷', events: [], generatedAt: '' })).toBe('');
    expect(personOf(undefined)).toBe('');
  });

  it('bondOf：有 bond 取 bond；旧数据无卷二返回空串；缺 digest 返回空串', () => {
    expect(bondOf({ person: '其人', bond: '我们卷', events: [], generatedAt: '' })).toBe('我们卷');
    expect(bondOf({ portrait: '旧单卷', events: [], generatedAt: '' })).toBe('');
    expect(bondOf(undefined)).toBe('');
  });
});
