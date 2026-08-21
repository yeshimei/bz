// @vitest-environment node
/**
 * 密码本测试（ticket 07）：CryptoService 加密往返、DataManager 主密码状态机、
 * 未解锁拦截、生成器。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoService, clearCryptoKeyCache } from '../../src/password/crypto';
import { DataManager } from '../../src/password/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

describe('CryptoService', () => {
  it('加密解密往返（salt16+iv12 布局）', async () => {
    const encrypted = await CryptoService.encrypt('{"a":1}', 'mypassword');
    expect(typeof encrypted).toBe('string');
    // Base64 解码后 ≥ 28 字节（16 salt + 12 iv + 密文）
    const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    expect(raw.length).toBeGreaterThanOrEqual(28);
    expect(await CryptoService.decrypt(encrypted, 'mypassword')).toBe('{"a":1}');
  });

  it('错误密码解密失败（AES-GCM 认证失败）', async () => {
    const encrypted = await CryptoService.encrypt('secret', 'correct');
    await expect(CryptoService.decrypt(encrypted, 'wrong')).rejects.toThrow();
  });

  it('相同明文每次密文不同（随机 salt/iv）', async () => {
    const a = await CryptoService.encrypt('same', 'pw');
    const b = await CryptoService.encrypt('same', 'pw');
    expect(a).not.toBe(b);
  });

  it('大载荷加解密往返不栈溢出（回归：展开运算符 btoa(...bytes) 会爆栈）', async () => {
    // ~300KB，远超旧实现 String.fromCharCode(...combined) 的调用栈/参数上限
    const big = Buffer.alloc(300 * 1024, 'x').toString('utf8');
    const encrypted = await CryptoService.encrypt(big, 'pw');
    const decrypted = await CryptoService.decrypt(encrypted, 'pw');
    expect(decrypted).toBe(big);
  });

  it('派生密钥缓存：加密已缓存 key，解密同一密文不再派生；clearCryptoKeyCache 后重新派生', async () => {
    clearCryptoKeyCache();
    const enc = await CryptoService.encrypt('cached', 'pw'); // encrypt 派生 1 次并缓存
    // 打真实 PBKDF2 派生点（crypto.subtle.deriveKey）：缓存命中时不再执行派生
    const spy = vi.spyOn(crypto.subtle, 'deriveKey' as any);
    try {
      expect(await CryptoService.decrypt(enc, 'pw')).toBe('cached');
      expect(spy).toHaveBeenCalledTimes(0); // 命中加密时缓存的 key
      expect(await CryptoService.decrypt(enc, 'pw')).toBe('cached');
      expect(spy).toHaveBeenCalledTimes(0); // 重复解密也不派生
      // 清缓存后重新派生
      clearCryptoKeyCache();
      expect(await CryptoService.decrypt(enc, 'pw')).toBe('cached');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      clearCryptoKeyCache();
    }
  });

  it('派生密钥缓存：错误密码尝试不污染正确密码（同 salt 校验 pw 重新派生）', async () => {
    clearCryptoKeyCache();
    const enc = await CryptoService.encrypt('x', 'right');
    // 先错误密码解密（缓存了 wrong 的 key，但 GCM 认证失败）
    await expect(CryptoService.decrypt(enc, 'wrong')).rejects.toThrow();
    const spy = vi.spyOn(crypto.subtle, 'deriveKey' as any);
    try {
      expect(await CryptoService.decrypt(enc, 'right')).toBe('x');
      // 同 salt 但密码不同 → 缓存校验 pw 不符 → 重新派生（结果正确）
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      clearCryptoKeyCache();
    }
  });
});

describe('DataManager 主密码状态机', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
  });

  it('未解锁时 load/save 拦截（「未解锁，无法加载数据/保存数据」）', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    await expect(dm.load()).rejects.toThrow('未解锁，无法加载数据');
    await expect(dm.save()).rejects.toThrow('未解锁，无法保存数据');
    await expect(dm.addItem({ platform: 'x' } as any)).rejects.toThrow('未解锁');
  });

  it('首次 unlock：设置密码并创建加密文件', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    const ok = await dm.unlock('master123');
    expect(ok).toBe(true);
    expect(dm.unlocked).toBe(true);
    expect(vault.files.has('CONFIG/STORAGE/passwords.enc')).toBe(true);
    // 文件是加密的（不是明文 JSON）
    const content = vault.files.get('CONFIG/STORAGE/passwords.enc')!;
    expect(content.startsWith('{')).toBe(false);
    expect(content).not.toContain('master123');
    // 解密验证
    const decrypted = await CryptoService.decrypt(content.trim(), 'master123');
    expect(JSON.parse(decrypted)).toEqual([]);
  });

  it('解锁流程：正确密码成功、错误密码失败', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    await dm.unlock('master123');
    dm.lock();
    expect(dm.unlocked).toBe(false);

    const dm2 = new DataManager('CONFIG/STORAGE');
    expect(await dm2.unlock('wrong')).toBe(false);
    expect(dm2.unlocked).toBe(false);
    expect(await dm2.unlock('master123')).toBe(true);
    expect(dm2.unlocked).toBe(true);
  });

  it('解锁后 CRUD 往返（加密存储解密读取）', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    await dm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'p@ss', note: '主号' });
    await dm.addItem({ platform: '知乎', account: 'zh', password: 'x1' } as any);
    expect(dm.pwData.length).toBe(2);

    // 重新解锁读取
    dm.lock();
    const dm2 = new DataManager('CONFIG/STORAGE');
    await dm2.unlock('pw');
    expect(dm2.pwData.length).toBe(2);
    expect(dm2.pwData[0]).toMatchObject({ platform: 'GitHub', account: 'me', password: 'p@ss' });
    expect(dm2.pwData[0].id).toMatch(/^pw-/);
    expect(dm2.pwData[0].createdAt).toBeTruthy();

    // 更新 + 删除
    const id = dm2.pwData[0].id;
    await dm2.updateItem(id, { password: 'newpass' });
    expect(dm2.pwData.find((d) => d.id === id)!.password).toBe('newpass');
    await dm2.deleteItem(id);
    expect(dm2.pwData.length).toBe(1);
  });

  it('数据被篡改 → 解密失败提示「数据解密失败，密码可能错误」', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    await dm.unlock('pw');
    // 篡改密文
    const content = vault.files.get('CONFIG/STORAGE/passwords.enc')!;
    const raw = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
    raw[40] = raw[40] ^ 0xff;
    vault.files.set('CONFIG/STORAGE/passwords.enc', btoa(String.fromCharCode(...raw)));
    await expect(dm.load()).rejects.toThrow('数据解密失败，密码可能错误');
  });

  it('search：平台/账号/备注关键词过滤', async () => {
    const dm = new DataManager('CONFIG/STORAGE');
    await dm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'alice', password: 'a', note: '代码' });
    await dm.addItem({ platform: 'Gmail', account: 'bob@x.com', password: 'b', note: '' } as any);
    expect(dm.search('github').length).toBe(1);
    expect(dm.search('alice').length).toBe(1);
    expect(dm.search('代码').length).toBe(1);
    expect(dm.search('nope').length).toBe(0);
    expect(dm.search('').length).toBe(2);
  });
});
