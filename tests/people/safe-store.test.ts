// @vitest-environment node
/**
 * 保库记录存储缝测试（issue 467 / ADR-0194；spec Testing Decisions 第 4 条）：
 * 注入共锁 SafeManager（MockVault 内存假库 + 真加密——密码本域注入式测试同款接法），断言：
 *   1. 每联系人一条记录（同人多写不增条）；
 *   2. 上锁清明文（内存缓存清空 + 库内无任何明文聊天数据）；
 *   3. 存量迁移 3 人 → 3 条记录（幂等重跑不重复、旧明文三件清理、任务随人入记录）；
 *   4. 头像附件往返（写 → 锁 → 解锁 → 可渲染成内存 data URL，全程不落明文文件）。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import {
  PeopleSafeStore,
  PEOPLE_KIND,
  PEOPLE_NOTE_PATH_PREFIX,
  getPeopleSafeStore,
  setPeopleSafeStoreForTests,
  type PeopleSafeRecord,
} from '../../src/people/safe-store';
import { migrateLegacyPeopleData } from '../../src/people/migrate';
import type { PersonEntry } from '../../src/people/types';
import type { PersonJob } from '../../src/people/jobs';

const PW = 'test-pw-467';

/** 构造一条时间线消息（type=1 文本） */
function msg(n: number, text: string): PeopleSafeRecord['store']['msgs'][number] {
  return { key: `k${n}`, ts: Date.UTC(2026, 0, n + 1), isSender: n % 2 === 0, type: 1, text };
}

function card(id: string, name = id): PersonEntry {
  return { id, name, createdAt: '2026-09-25T00:00:00.000Z', imports: [] };
}

function job(talker: string, name = talker): PersonJob {
  return {
    talker,
    name,
    mode: 'full',
    fileLabel: `数据源:${talker}`,
    status: 'paused',
    stage: 'chunked',
    msgCount: 3,
    contentHash: 'hash467',
    chunks: [],
    batchesDone: 0,
    results: [],
    startedAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
  };
}

/** vault 内全部文件内容拼串（明文泄漏断言用；含二进制名的文本形态） */
function allVaultText(vault: MockVault): string {
  return [...vault.files.entries()].map(([p, c]) => `${p}\n${c}`).join('\n');
}

describe('保库记录存储缝（PeopleSafeStore × 注入 SafeManager）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let safe: PeopleSafeStore;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as never);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    safe = new PeopleSafeStore(sm);
  });

  it('每联系人一条记录：两人各一条 .enc；同人反复写不增条（updateNotePayload 覆盖同一镜像）', async () => {
    await sm.unlock(PW);
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, '构造消息一'));
    });
    await safe.write('wxid_b', (rec) => {
      rec.person = card('wxid_b', '老周');
    });
    // 同人再写两次（改人物卡 + 追消息）——记录条数不变
    await safe.write('wxid_a', (rec) => {
      rec.person.name = '阿琳琳';
      rec.store.msgs.push(msg(2, '构造消息二'));
    });
    const peopleNotes = sm.manifest.notes.filter((n) => (n as { kind?: string }).kind === PEOPLE_KIND);
    expect(peopleNotes).toHaveLength(2);
    expect(safe.talkers().sort()).toEqual(['wxid_a', 'wxid_b']);
    // 每条记录独立一个正文密文镜像（contentRef 互不相同）
    const refs = new Set(peopleNotes.map((n) => n.contentRef));
    expect(refs.size).toBe(2);
    // 数据一致（人物卡改名 + 消息追加都在同一条里）
    const ra = await safe.read('wxid_a');
    expect(ra?.person.name).toBe('阿琳琳');
    expect(ra?.store.msgs).toHaveLength(2);
    // 记录定位路径 = 虚拟索引（后缀即 talker；清单整体在 .safe.enc 密文内）
    expect(peopleNotes.map((n) => n.path).every((p) => p.startsWith(PEOPLE_NOTE_PATH_PREFIX))).toBe(true);
  });

  it('上锁清明文：缓存清空、读抛错、库内无任何明文聊天数据；重解锁后数据往返一致', async () => {
    await sm.unlock(PW);
    const secret = '构造密语-明月见-467';
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, secret));
    });
    expect(allVaultText(vault)).not.toContain(secret); // 落盘即密文
    sm.lock();
    expect(safe.unlocked).toBe(false);
    expect(vault.files.has('CONFIG/STORAGE/people-preview.json')).toBe(false); // 明文仓不再存在
    expect(() => safe.talkers()).toThrow('未解锁'); // 索引（清单）也不可读
    await expect(safe.read('wxid_a')).rejects.toThrow('未解锁');
    await expect(safe.readAll()).rejects.toThrow('未解锁');
    await expect(safe.write('wxid_a', () => {})).rejects.toThrow('未解锁');
    expect(allVaultText(vault)).not.toContain(secret);
    // 重解锁：同主密码可读，数据往返一致
    await sm.unlock(PW);
    const rec = await safe.read('wxid_a');
    expect(rec?.person.name).toBe('阿琳');
    expect(rec?.store.msgs.map((m) => m.text)).toEqual([secret]);
  });

  it('存量迁移：3 人 → 3 条记录；任务随人入记录；旧明文三件清理；重跑幂等', async () => {
    await sm.unlock(PW);
    // 旧明文三件（people.json / people-preview.json v2 / people-jobs.json）
    vault.files.set('CONFIG/STORAGE/people.json', JSON.stringify({ version: 1, people: [card('wxid_a', '阿琳'), card('wxid_b', '老周')] }));
    vault.files.set(
      'CONFIG/STORAGE/people-preview.json',
      JSON.stringify({
        version: 2,
        contacts: {
          wxid_a: { msgs: [msg(1, '构造消息一')], watermarkSid: 0, stats: { msgCount: 1, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '2026-09-25T00:00:00.000Z' },
          wxid_b: { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '2026-09-25T00:00:00.000Z' },
          wxid_c: { msgs: [msg(2, '只有仓没有卡的人')], watermarkSid: 0, stats: { msgCount: 1, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '2026-09-25T00:00:00.000Z' },
        },
      })
    );
    vault.files.set('CONFIG/STORAGE/people-jobs.json', JSON.stringify({ version: 1, queue: [job('wxid_b', '老周')] }));

    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(3);
    expect(safe.talkers().sort()).toEqual(['wxid_a', 'wxid_b', 'wxid_c']);
    // 任务随人入记录
    const rb = await safe.read('wxid_b');
    expect(rb?.job?.talker).toBe('wxid_b');
    expect((await safe.read('wxid_a'))?.job ?? null).toBeNull();
    // 没卡的人迁移时补空卡（452 占位卡语义）
    const rc = await safe.read('wxid_c');
    expect(rc?.person.id).toBe('wxid_c');
    expect(rc?.store.msgs).toHaveLength(1);
    // 旧明文三件清理（迁移校验通过才删）
    expect(out.cleaned.sort()).toEqual(['CONFIG/STORAGE/people-preview.json', 'CONFIG/STORAGE/people-jobs.json', 'CONFIG/STORAGE/people.json'].sort());
    expect(vault.files.has('CONFIG/STORAGE/people.json')).toBe(false);
    expect(vault.files.has('CONFIG/STORAGE/people-preview.json')).toBe(false);
    expect(vault.files.has('CONFIG/STORAGE/people-jobs.json')).toBe(false);
    expect(allVaultText(vault)).not.toContain('构造消息一'); // 库内不再有明文聊天数据
    // 幂等重跑一：旧文件已清 → 无源空操作（0 迁 0 跳），记录仍是 3 条
    const again = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(again.migrated).toBe(0);
    expect(again.skipped).toBe(0);
    expect(safe.talkers()).toHaveLength(3);
    // 幂等重跑二（半途崩溃收敛模拟）：旧明文残留 + 记录已在 → 逐人跳过不重复迁
    vault.files.set('CONFIG/STORAGE/people.json', JSON.stringify({ version: 1, people: [card('wxid_a', '阿琳'), card('wxid_b', '老周')] }));
    const partial = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(partial.migrated).toBe(0);
    expect(partial.skipped).toBe(2);
    expect(safe.talkers()).toHaveLength(3);
    expect(vault.files.has('CONFIG/STORAGE/people.json')).toBe(false); // 残留旧件照常清
  });

  it('头像附件往返：写 → 锁 → 解锁 → 可渲染成内存 data URL；全程不落明文头像文件', async () => {
    await sm.unlock(PW);
    const raw = 'fake-jpeg-bytes-467';
    const b64 = Buffer.from(raw, 'utf8').toString('base64');
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
    }, { avatar: { base64: b64, ext: 'jpg' } });
    expect(safe.attachmentCount('wxid_a')).toBe(1);
    expect(allVaultText(vault)).not.toContain(raw); // 头像字节在库里只有密文形态
    expect(vault.binaryFiles.size).toBe(0); // 不落明文文件
    // 锁 → 解锁（同主密码）→ 可渲染
    sm.lock();
    await expect(safe.avatarDataUrl('wxid_a')).rejects.toThrow('未解锁');
    await sm.unlock(PW);
    const url = await safe.avatarDataUrl('wxid_a');
    expect(url).toBe(`data:image/jpeg;base64,${b64}`);
    // 同图重写零重建（指纹一致不重加密）；换图整条重建仍是单条单附件
    const refBefore = sm.manifest.notes.find((n) => n.path === PEOPLE_NOTE_PATH_PREFIX + 'wxid_a')!.contentRef;
    await safe.write('wxid_a', () => {}, { avatar: { base64: b64, ext: 'jpg' } });
    expect(safe.attachmentCount('wxid_a')).toBe(1);
    const refAfter = sm.manifest.notes.find((n) => n.path === PEOPLE_NOTE_PATH_PREFIX + 'wxid_a')!.contentRef;
    expect(refAfter).toBe(refBefore);
    const b64New = Buffer.from('another-avatar', 'utf8').toString('base64');
    await safe.write('wxid_a', () => {}, { avatar: { base64: b64New, ext: 'png' } });
    expect(safe.attachmentCount('wxid_a')).toBe(1);
    expect(await safe.avatarDataUrl('wxid_a')).toBe(`data:image/png;base64,${b64New}`);
    expect(sm.manifest.notes.filter((n) => (n as { kind?: string }).kind === PEOPLE_KIND)).toHaveLength(1);
  });

  it('共享实例注入缝：setPeopleSafeStoreForTests 后 getPeopleSafeStore 返回注入件', async () => {
    setPeopleSafeStoreForTests(safe);
    expect(await getPeopleSafeStore()).toBe(safe);
    setPeopleSafeStoreForTests(null);
  });

  it('清空聊天数据：只清各记录 store 段，人物卡与任务保留', async () => {
    await sm.unlock(PW);
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, '构造消息一'));
      rec.job = job('wxid_a');
    });
    await safe.clearStores();
    const rec = await safe.read('wxid_a');
    expect(rec?.store.msgs).toHaveLength(0);
    expect(rec?.person.name).toBe('阿琳');
    expect(rec?.job?.talker).toBe('wxid_a');
  });
});

describe('自写抑制（issue 492）：头像重建的变更广播不清自己的明文缓存', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let safe: PeopleSafeStore;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as never);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    safe = new PeopleSafeStore(sm);
  });

  it('甲头像重建（removeNote→lockNote 同步广播）后，乙的缓存记录保持同一对象且内容完整', async () => {
    await sm.unlock(PW);
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, '甲的消息'));
    });
    await safe.write('wxid_b', (rec) => {
      rec.person = card('wxid_b', '阿乙');
      rec.store.msgs.push(msg(2, '乙的消息'));
    });
    const bBefore = await safe.read('wxid_b');
    // 甲带新头像写入 → avatarChanged → removeNote+lockNote 重建 → ENCRYPT_CHANGED 同步广播
    await safe.write('wxid_a', (rec) => {
      rec.store.msgs.push(msg(3, '甲再导入一条'));
    }, { avatar: { base64: 'aGk=', ext: 'jpg' } });
    const a = await safe.read('wxid_a');
    const b = await safe.read('wxid_b');
    expect(b).toBe(bBefore); // 同一对象：自写广播没有把明文缓存清掉重解
    expect(b?.store.msgs.map((m) => m.text)).toContain('乙的消息');
    expect(a?.store.msgs).toHaveLength(2); // 甲的写入照常落地
    expect(a?.person.name).toBe('阿琳');
  });
});

describe('写路径健壮性：普通写抑制 / 删除串行 / 重建回滚 / 落盘失败逐缓存 / 坏档跳过', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let safe: PeopleSafeStore;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as never);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    safe = new PeopleSafeStore(sm);
  });

  /** 解锁 + 两位联系人（各自一条热缓存记录） */
  async function seedTwo(): Promise<void> {
    await sm.unlock(PW);
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, '甲的消息'));
    });
    await safe.write('wxid_b', (rec) => {
      rec.person = card('wxid_b', '阿乙');
      rec.store.msgs.push(msg(2, '乙的消息'));
    });
  }

  it('普通写路径不破全库热读：updateNotePayload 的自写广播不清明文缓存（492 补全普通分支）', async () => {
    await seedTwo();
    const bBefore = await safe.read('wxid_b');
    expect(safe.isFullyCached()).toBe(true);
    // 甲普通写（不带 avatar → updateNotePayload 常规路径，其显式广播 encrypt:changed）
    await safe.write('wxid_a', (rec) => {
      rec.store.msgs.push(msg(3, '甲又一条'));
    });
    const bAfter = await safe.read('wxid_b');
    expect(bAfter).toBe(bBefore); // 缓存未被清：同一对象（修复前每次普通写都全库重解）
    expect(safe.isFullyCached()).toBe(true); // 整库热读未被打破
    const a = await safe.read('wxid_a');
    expect(a?.store.msgs).toHaveLength(2); // 写入本身照常落地
  });

  it('删除与在途写串行：写已排队未执行时删人，删后不落出空骨架（不复活）', async () => {
    await seedTwo();
    // 新联系人的首写悬在 mutate 闸口（在途写）；此刻删除 TA——修复前删除不走链，
    // 抢在首写前跑完（当时还没有记录可删），首写随后把空骨架落出来
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const writeP = safe.write('wxid_new', async () => {
      await gate;
    });
    const removeP = safe.removeContact('wxid_new');
    release();
    await expect(writeP).resolves.toBe('created'); // 首写照常提交
    await removeP; // 删除排在写之后：把刚落的记录删净
    expect(safe.has('wxid_new')).toBe(false);
    expect(safe.talkers().sort()).toEqual(['wxid_a', 'wxid_b']);
    expect(sm.manifest.notes.filter((n) => (n as { kind?: string }).kind === PEOPLE_KIND)).toHaveLength(2);
  });

  it('头像重建失败（lockNote 抛错）：旧载荷 + 旧头像回锁同路径兜底，记录与头像可恢复', async () => {
    await sm.unlock(PW);
    const b64v1 = Buffer.from('avatar-v1-bytes', 'utf8').toString('base64');
    await safe.write('wxid_a', (rec) => {
      rec.person = card('wxid_a', '阿琳');
      rec.store.msgs.push(msg(1, '甲的消息'));
    }, { avatar: { base64: b64v1, ext: 'jpg' } });
    // 首次 lockNote（重建）抛错，第二次（回滚兜底）放行真链
    const origLock = sm.lockNote.bind(sm);
    let calls = 0;
    const spy = vi.spyOn(sm, 'lockNote').mockImplementation(((input: Parameters<typeof origLock>[0]) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error('模拟重建失败（磁盘满）'));
      return origLock(input);
    }) as typeof sm.lockNote);
    const b64v2 = Buffer.from('avatar-v2-bytes', 'utf8').toString('base64');
    await expect(
      safe.write('wxid_a', (rec) => {
        rec.person.name = '阿琳琳';
      }, { avatar: { base64: b64v2, ext: 'png' } })
    ).rejects.toThrow('模拟重建失败'); // 上抛原错：调用方必须知道本次写入没成
    spy.mockRestore();
    // 记录没丢：盘上回到 mutate 前的旧版本 + 旧头像（缓存已逐出，回读现解）
    const after = await safe.read('wxid_a');
    expect(after?.person.name).toBe('阿琳');
    expect(after?.store.msgs.map((m) => m.text)).toEqual(['甲的消息']);
    expect(await safe.avatarDataUrl('wxid_a')).toBe(`data:image/jpeg;base64,${b64v1}`);
    expect(safe.attachmentCount('wxid_a')).toBe(1);
    expect(sm.manifest.notes.filter((n) => (n as { kind?: string }).kind === PEOPLE_KIND)).toHaveLength(1); // 不堆重复条目
  });

  it('落盘失败：逐出脏缓存并上抛，回读重新解密盘上旧数据（不再「界面已保存、盘上没存」）', async () => {
    await seedTwo();
    const cached = await safe.read('wxid_a'); // 热缓存
    const spy = vi.spyOn(sm, 'updateNotePayload').mockRejectedValue(new Error('模拟落盘失败'));
    await expect(
      safe.write('wxid_a', (rec) => {
        rec.person.name = '改了但没存上';
      })
    ).rejects.toThrow('模拟落盘失败');
    spy.mockRestore();
    const after = await safe.read('wxid_a');
    expect(after).not.toBe(cached); // 脏缓存已逐出 → 全新解密对象（修复前命中被原地改过的旧引用）
    expect(after?.person.name).toBe('阿琳'); // 盘上仍是旧数据
    expect(safe.isFullyCached()).toBe(true); // 回读后整库回到热读
  });

  it('单条坏记录不拖垮 readAll：跳过并经 stats 出参带出失败数；不传出参零漂移', async () => {
    const good = (name: string) => JSON.stringify({
      version: 1,
      person: { id: name, name, createdAt: '2026-01-01T00:00:00.000Z', imports: [] },
      store: { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '' },
      job: null,
    });
    const bodies = new Map<string, string | null>([
      [PEOPLE_NOTE_PATH_PREFIX + '甲', good('甲')],
      [PEOPLE_NOTE_PATH_PREFIX + '乙坏档', null], // 解密失败（decryptNoteBody null → read 抛错）
      [PEOPLE_NOTE_PATH_PREFIX + '丙坏档', '{broken-json'], // 解析失败
    ]);
    const notes = [...bodies.keys()].map((path, i) => ({ id: `n${i}`, kind: 'people', path, title: path, attachments: [] }));
    const fake = {
      unlocked: true,
      manifest: { notes },
      decryptNoteBody: async (note: { path: string }) => bodies.get(note.path) ?? null,
    } as unknown as SafeManager;
    const store = new PeopleSafeStore(fake);
    const seen: Array<[number, number]> = [];
    const stats = { failedCount: 0 };
    const all = await store.readAll((done, total) => seen.push([done, total]), stats);
    expect([...all.keys()]).toEqual(['甲']); // 坏档跳过，好档照常返回
    expect(stats.failedCount).toBe(2);
    expect(seen).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]); // 进度回调仍逐人推进（含坏档）
    // 不传出参的既有调用点零漂移（不抛、返回好档）
    const plain = await store.readAll();
    expect(plain.size).toBe(1);
  });
});
