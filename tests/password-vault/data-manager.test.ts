// @vitest-environment node
/**
 * 保险库（password-vault）数据层测试（实现在 src/password-vault/data.ts，ADR-0158 属主收口）：
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
    vault.files.set('CONFIG/.ENCRYPT/' + note.contentRef, await (await import('../../src/core/crypto')).CryptoService.encrypt(oldData, 'pw'));
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

  it('外部上锁事件（encrypt:unlock-changed unlocked=false）→ 本实例明文缓存自清（深审新-2：锁定保险库清不到本域实例）', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: 'p' });
    expect(dm.pwData.length).toBe(1);
    // 外部上锁路径（encrypt lockSafe / 面板「立即上锁」/ 安全模式）：不经过本实例 lock()
    sm.lock();
    expect(dm.pwData.length).toBe(0);
    expect(dm.unlocked).toBe(false);
    // 重解锁后数据面完好可重载（自清只动内存缓存，不动磁盘密文）
    await sm.unlock('pw');
    await dm.load();
    expect(dm.pwData.length).toBe(1);
    expect(dm.pwData[0].platform).toBe('GitHub');
  });

  it('destroy 后退订上锁自清（外部上锁不再清已销毁实例的缓存）', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: 'p' });
    dm.destroy();
    sm.lock(); // 已退订：事件不再触发自清（实例随卸载即弃，仅验证退订链在位）
    expect(dm.pwData.length).toBe(1);
  });

  it('search 空词返回拷贝：调用方就地 sort/reverse 不回写 pwData（磁盘 JSON 序不漂移）', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'A', account: 'a', password: '1' });
    await dm.addItem({ platform: 'B', account: 'b', password: '2' });
    const before = dm.pwData.map((d) => d.platform);
    dm.search('').reverse(); // 模拟渲染层就地改写
    expect(dm.pwData.map((d) => d.platform)).toEqual(before);
    // 非空关键词路径本就返回新数组，行为不变
    expect(dm.search('A').map((d) => d.platform)).toEqual(['A']);
  });

  it('E1 写事务回滚：save 失败后内存恢复快照（无幽灵条目/半改态）', async () => {
    const dm = await unlockedDM();
    await dm.addItem({ platform: 'GitHub', account: 'a', password: '1' });
    const orig = dm.pwData.slice();
    // 令 save 失败：破坏锁定态（save 前 locked 判定会抛「未解锁」）
    const unlockSpy = vi.spyOn(dm as any, 'unlocked', 'get').mockReturnValue(false);
    try {
      // addItem：unshift 后 save 抛 → 回滚（新条目不残留）
      await expect(dm.addItem({ platform: 'X', account: 'b', password: '2' })).rejects.toThrow('未解锁');
      expect(dm.pwData.length).toBe(orig.length);
      // 就地改对象（toggleFav）：save 抛 → fav 恢复原值（逐条拷贝快照回滚）
      const target = dm.pwData[0];
      const beforeFav = target.fav;
      await expect(dm.toggleFav(target.id)).rejects.toThrow('未解锁');
      expect(dm.pwData[0].fav).toBe(beforeFav);
      // 原始条目对象引用不串改（回滚后仍是同一批条目）
      expect(dm.pwData.map((d) => d.id)).toEqual(orig.map((d) => d.id));
    } finally {
      unlockSpy.mockRestore();
    }
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
