// @vitest-environment node
/**
 * 锁屏统计快照明文存储回归（core/lock-stats，ADR-0124 决策 4 修订）：
 * - readLockStats：无文件 / 该档缺失 / 文件损坏 → null（锁屏回落「—」，不编造数字、不阻塞解锁流）
 * - writeLockStats：段级合并写，多域各写各档互不覆盖
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { readLockStats, writeLockStats } from '../../src/core/lock-stats';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { __resetNoticeForTests } from '../../src/core/notice';

const PATH = 'CONFIG/STORAGE/lock-stats.json';
const vaultStats = [
  { num: '7', label: '笔记条目' },
  { num: '2', label: '随库附件' },
  { num: '1.5 KB', label: '附件密文' },
];
const pvStats = [
  { num: '3', label: '平台' },
  { num: '5', label: '口令条目' },
  { num: '1', label: '收藏' },
];

describe('core/lock-stats（锁屏统计明文快照）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({}) as any);
    resetObsidianMocks();
    __resetNoticeForTests();
  });

  it('无文件 → null（不编造数字）', async () => {
    expect(await readLockStats('vault')).toBeNull();
  });

  it('写入后读回；未写档位仍 null', async () => {
    await writeLockStats('vault', vaultStats);
    expect(await readLockStats('vault')).toEqual(vaultStats);
    expect(await readLockStats('diary')).toBeNull();
  });

  it('段级合并写：多域各写各档互不覆盖', async () => {
    await writeLockStats('vault', vaultStats);
    await writeLockStats('password-vault', pvStats);
    expect(await readLockStats('vault')).toEqual(vaultStats);
    expect(await readLockStats('password-vault')).toEqual(pvStats);
  });

  it('文件损坏 → null（走留档重建兜底，不抛错）', async () => {
    await vault.create(PATH, '{oops');
    expect(await readLockStats('vault')).toBeNull();
  });
});
