// @vitest-environment node
/**
 * 保险库（password-vault）数据层测试：
 * 共享保险箱 password-vault SafeNote（fav 字段新增/兼容）、平台聚合、CRUD、
 * 域事件广播（写后 password-vault:changed；外部 encrypt:changed 触发重载）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager, PASSWORD_VAULT_CHANNEL } from '../../src/password-vault/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { onDomainEvent } from '../../src/core/domain-bus';

describe('PasswordVaultDataManager', () => {
  let vault: MockVault;
  let sm: SafeManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
  });

  async function unlockedDM(password = 'pw'): Promise<PasswordVaultDataManager> {
    await sm.unlock(password);
    return new PasswordVaultDataManager(sm);
  }

  it('fav 字段：新增条目默认 false；旧 7 字段数据 load 归一化补 false', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: 'p' });
    expect(dm.pwData[0].fav).toBe(false);
    // 直接写旧 7 字段（无 fav）整表 → load 后补 false
    const note = sm.manifest.notes[0];
    const oldData = JSON.stringify([
      { id: 'old-1', platform: 'GitHub', url: '', account: 'me', password: 'x', note: '', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    vault.files.set('CONFIG/.ENCRYPT/' + note.contentRef, await (await import('../../src/password/crypto')).CryptoService.encrypt(oldData, 'pw'));
    await dm.load();
    expect(dm.pwData[0].fav).toBe(false);
    expect(dm.pwData[0].id).toBe('old-1');
  });

  it('平台聚合：同平台合并、按最近账号时间倒序；favCount/hasFav 正确', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: '1' });
    await dm.addItem({ platform: 'GitHub', account: 'b', password: '2', fav: true });
    await dm.addItem({ platform: '哔哩哔哩', account: 'c', password: '3' });
    const plats = dm.platforms();
    expect(plats.length).toBe(2);
    const gh = plats.find((p) => p.platform === 'GitHub')!;
    expect(gh.accounts.length).toBe(2);
    expect(dm.hasFav('GitHub')).toBe(true);
    expect(dm.favCount('GitHub')).toBe(1);
    expect(dm.hasFav('哔哩哔哩')).toBe(false);
  });

  it('toggleFav / removePlatform / updatePlatform 写盘 + 域事件广播', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: '1' });
    await dm.addItem({ platform: 'GitHub', account: 'b', password: '2' });
    const spy = vi.fn();
    const off = onDomainEvent(PASSWORD_VAULT_CHANNEL, spy);
    try {
      await dm.toggleFav(dm.pwData[0].id);
      expect(dm.pwData.find((d) => d.id === dm.pwData[0].id)!.fav).toBe(true);
      expect(spy).toHaveBeenCalled();
      // removePlatform
      const n = await dm.removePlatform('GitHub');
      expect(n).toBe(2);
      expect(dm.pwData.length).toBe(0);
      // updatePlatform
      await dm.addItem({ platform: '微信', account: 'x', password: 'y' });
      await dm.addItem({ platform: '微信', account: 'z', password: 'w' });
      await dm.updatePlatform('微信', { platform: '星球视频', url: 'https://x.com' });
      expect(dm.pwData.every((d) => d.platform === '星球视频')).toBe(true);
      expect(dm.pwData.every((d) => d.url === 'https://x.com')).toBe(true);
    } finally {
      off();
    }
  });

  it('外部 encrypt:changed（source≠password-vault）→ 自动重载并回调 onExternalChange', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: '1' });
    const external = vi.fn();
    dm.onExternalChange = external;
    // 模拟保险箱面板直接改密文（updateNotePayload 会广播 encrypt:changed）
    await sm.updateNotePayload(sm.manifest.notes[0].id, JSON.stringify([
      { id: 'ext-1', platform: '新平台', account: 'b', password: '2', fav: false },
    ]));
    // 异步重载
    await new Promise((r) => setTimeout(r, 20));
    expect(external).toHaveBeenCalled();
    expect(dm.pwData[0].platform).toBe('新平台');
  });

  it('自己广播（source=password-vault）不触发自重载', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: '1' });
    const external = vi.fn();
    dm.onExternalChange = external;
    await dm.addItem({ platform: 'Gmail', account: 'b', password: '2' }); // 自己广播
    await new Promise((r) => setTimeout(r, 20));
    expect(external).not.toHaveBeenCalled();
  });

  it('lock：整体上锁 + 清内存 + 清 load 缓存', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'x', account: 'a', password: 'p' });
    dm.lock();
    expect(sm.unlocked).toBe(false);
    expect(dm.unlocked).toBe(false);
    expect(dm.pwData.length).toBe(0);
  });

  it('destroy：退订域事件', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'x', account: 'a', password: 'p' });
    dm.destroy();
    const external = vi.fn();
    dm.onExternalChange = external;
    await sm.updateNotePayload(sm.manifest.notes[0].id, '[]'); // 会广播 encrypt:changed
    await new Promise((r) => setTimeout(r, 20));
    expect(external).not.toHaveBeenCalled();
  });

  afterEach(() => {
    sm.lock();
  });
});
