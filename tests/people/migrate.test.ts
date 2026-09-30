// @vitest-environment node
/**
 * 存量迁移故障面回归（明文三件 → 保库记录，issue 467 迁移器的健壮性收口）：
 * - 旧明文三件「存在但读不动」（被锁 / IO 故障）→ 迁移整体中止，绝不进入清理段
 *   （错吞成「不存在」会带着残缺现场删旧明文，聊天记录永久丢失）；
 * - 旧头像源缺失 / 读不动 → 按设计不阻断迁移，校验也不再因「元数据有路径」永远
 *   verifyFail——旧明文照常清理；
 * - 旧头像源可读 → 附件在位校验仍对真读到字节的人生效。
 * 数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { PeopleSafeStore } from '../../src/people/safe-store';
import { migrateLegacyPeopleData } from '../../src/people/migrate';
import type { PersonEntry } from '../../src/people/types';

const PW = 'migrate-fix-pw';
const P = 'CONFIG/STORAGE';
const THREE = [`${P}/people-preview.json`, `${P}/people-jobs.json`, `${P}/people.json`];

function card(id: string, name = id): PersonEntry {
  return { id, name, createdAt: '2026-09-25T00:00:00.000Z', imports: [] };
}

function contact(msgs: number): Record<string, unknown> {
  return {
    msgs: Array.from({ length: msgs }, (_, i) => ({ key: `k${i}`, ts: Date.UTC(2026, 0, i + 1), isSender: false, type: 1, text: `构造消息${i}` })),
    watermarkSid: 0,
    stats: { msgCount: msgs, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 },
    updatedAt: '2026-09-25T00:00:00.000Z',
  };
}

describe('迁移故障面：读不动中止 / 头像缺失不卡清理', () => {
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

  /** 铺旧明文三件（一人：wxid_a）；opts.avatarPath 写进聊天仓元数据 */
  function seedLegacy(opts?: { avatarPath?: string }): void {
    vault.files.set(`${P}/people.json`, JSON.stringify({ version: 1, people: [card('wxid_a', '阿琳')] }));
    const c = contact(1);
    if (opts?.avatarPath) c.avatar = opts.avatarPath;
    vault.files.set(`${P}/people-preview.json`, JSON.stringify({ version: 2, contacts: { wxid_a: c } }));
    vault.files.set(`${P}/people-jobs.json`, JSON.stringify({ version: 1, queue: [] }));
  }

  it('旧明文存在但读不动（读写错误）：迁移整体中止，三件旧文件原样保留，不写任何记录', async () => {
    await sm.unlock(PW);
    seedLegacy();
    // preview.json 被占用（read 抛错）——修复前被吞成「不存在」，校验过后旧明文会被误删
    const origRead = vault.adapter.read;
    vault.adapter.read = async (path: string) => {
      if (path === `${P}/people-preview.json`) throw new Error('EBUSY: 模拟文件被占用');
      return origRead(path);
    };
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(0);
    expect(out.cleaned).toEqual([]);
    expect(out.keptBack.sort()).toEqual([...THREE].sort());
    // 三件旧明文一件未删
    expect(vault.files.has(`${P}/people.json`)).toBe(true);
    expect(vault.files.has(`${P}/people-preview.json`)).toBe(true);
    expect(vault.files.has(`${P}/people-jobs.json`)).toBe(true);
    // 没写任何保库记录（残缺源不迁）
    expect(safe.talkers()).toEqual([]);
  });

  it('存在性探测也失败（exists 抛错）：同样按「读不动」中止，不清理不迁移', async () => {
    await sm.unlock(PW);
    seedLegacy();
    const origExists = vault.adapter.exists;
    vault.adapter.exists = async (path: string) => {
      if (path === `${P}/people.json`) throw new Error('EIO: 模拟探测失败');
      return origExists(path);
    };
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(0);
    expect(out.cleaned).toEqual([]);
    expect(out.keptBack.sort()).toEqual([...THREE].sort());
    expect(vault.files.has(`${P}/people-preview.json`)).toBe(true);
  });

  it('坏 JSON（解析失败）：同样中止并保留现场', async () => {
    await sm.unlock(PW);
    seedLegacy();
    vault.files.set(`${P}/people-jobs.json`, '{这不是JSON');
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(0);
    expect(out.cleaned).toEqual([]);
    expect(vault.files.has(`${P}/people-preview.json`)).toBe(true);
  });

  it('旧头像源文件缺失（元数据有路径）：迁移照常完成且校验通过，旧明文清理，记录不带附件', async () => {
    await sm.unlock(PW);
    seedLegacy({ avatarPath: 'CONFIG/FACES/阿琳/avatar.jpg' }); // 明文头像目录里并没有这个文件
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(1);
    expect(out.keptBack).toEqual([]);
    expect(out.cleaned.sort()).toEqual([...THREE].sort());
    expect(vault.files.has(`${P}/people-preview.json`)).toBe(false);
    // 头像缺失按设计不阻断迁移，也不要求附件在位（修复前按元数据路径判定 → 永远 verifyFail）
    expect(safe.attachmentCount('wxid_a')).toBe(0);
  });

  it('旧头像源可读：附件在位，校验通过照常清理（口径只对真读到字节的人生效）', async () => {
    await sm.unlock(PW);
    seedLegacy({ avatarPath: 'CONFIG/FACES/阿琳/avatar.jpg' });
    vault.binaryFiles.set('CONFIG/FACES/阿琳/avatar.jpg', new TextEncoder().encode('fake-jpeg-bytes'));
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(1);
    expect(out.keptBack).toEqual([]);
    expect(safe.attachmentCount('wxid_a')).toBe(1);
    expect(vault.files.has(`${P}/people.json`)).toBe(false);
  });

  it('旧明文带 UTF-8 BOM（外部编辑器/同步工具动过）：照常迁移并清理（不再永远卡「读不动」）', async () => {
    await sm.unlock(PW);
    seedLegacy();
    for (const p of THREE) {
      const raw = vault.files.get(p);
      if (raw !== undefined) vault.files.set(p, `﻿${raw}`);
    }
    const out = await migrateLegacyPeopleData({ vault } as never, safe);
    expect(out.migrated).toBe(1);
    expect(out.keptBack).toEqual([]);
    expect(out.cleaned.sort()).toEqual([...THREE].sort());
    expect(safe.attachmentCount('wxid_a')).toBe(0);
  });
});
