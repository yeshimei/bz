// @vitest-environment node
/**
 * 密码本测试（合并至保险箱）：CryptoService 加密往返、DataManager（password-vault 条目）
 * 未解锁拦截、CRUD 往返、篡改拦截、整体上锁、生成器。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoService, clearCryptoKeyCache } from '../../src/password/crypto';
import { DataManager } from '../../src/password/data';
import { SafeManager } from '../../src/encrypt/data';
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

describe('DataManager（合并至保险箱：password-vault 条目）', () => {
  let vault: MockVault;
  let sm: SafeManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
  });

  async function unlockedDM(password = 'pw'): Promise<DataManager> {
    sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock(password);
    return new DataManager(sm);
  }

  it('未解锁时 load/save 拦截；unlocked 反射保险箱解锁态', async () => {
    const dm = new DataManager(new SafeManager('CONFIG/.ENCRYPT'));
    expect(dm.unlocked).toBe(false);
    await expect(dm.load()).rejects.toThrow('未解锁，无法加载数据');
    await expect(dm.save()).rejects.toThrow('未解锁，无法保存数据');
    await expect(dm.addItem({ platform: 'x' } as any)).rejects.toThrow('未解锁');
  });

  it('首次 save：以 password-vault 条目落进保险箱清单，不再产生 passwords.enc', async () => {
    const dm = await unlockedDM('master123');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'p@ss', note: '主号' });
    // 数据在保险箱：清单含 password-vault 条目 + 正文密文镜像
    expect(sm.manifest.notes.length).toBe(1);
    const note = sm.manifest.notes[0];
    expect(note.kind).toBe('password-vault');
    expect(note.title).toBe('密码本');
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    // 独立的 passwords.enc 已不存在（路线 B：单一密文库）
    expect(vault.files.has('CONFIG/STORAGE/passwords.enc')).toBe(false);
    // 镜像为密文（不含明文条目）
    expect(vault.files.get('CONFIG/.ENCRYPT/' + note.contentRef)!).not.toContain('GitHub');
    const plain = await sm.decryptNoteBody(note);
    expect(JSON.parse(plain!).length).toBe(1);
  });

  it('CRUD 往返：锁后另开实例（重新解锁保险箱）可读', async () => {
    const dm = await unlockedDM('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'p@ss', note: '主号' });
    await dm.addItem({ platform: '知乎', account: 'zh', password: 'x1' } as any);
    expect(dm.pwData.length).toBe(2);

    // 模拟重启：锁定后新实例（同样走保险箱解锁）
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    const dm2 = new DataManager(sm2);
    await dm2.load();
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

  it('正文镜像被篡改 → load 解密失败向上抛（GCM 认证失败）', async () => {
    const dm = await unlockedDM('pw');
    await dm.addItem({ platform: 'x', account: 'a', password: 'p' } as any);
    const note = sm.manifest.notes[0];
    const raw = Uint8Array.from(
      atob(vault.files.get('CONFIG/.ENCRYPT/' + note.contentRef)!),
      (c) => c.charCodeAt(0)
    );
    raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff; // 破坏密文尾部（GCM tag）
    vault.files.set('CONFIG/.ENCRYPT/' + note.contentRef, btoa(String.fromCharCode(...raw)));
    await expect(dm.load()).rejects.toThrow();
  });

  it('lock：整体上锁（保险箱与密码本共享解锁态）', async () => {
    const dm = await unlockedDM('pw');
    dm.lock();
    expect(sm.unlocked).toBe(false);
    expect(dm.unlocked).toBe(false);
  });

  it('search：平台/账号/备注关键词过滤', async () => {
    const dm = await unlockedDM('pw');
    await dm.addItem({ platform: 'GitHub', account: 'alice', password: 'a', note: '代码' });
    await dm.addItem({ platform: 'Gmail', account: 'bob@x.com', password: 'b', note: '' } as any);
    expect(dm.search('github').length).toBe(1);
    expect(dm.search('alice').length).toBe(1);
    expect(dm.search('代码').length).toBe(1);
    expect(dm.search('nope').length).toBe(0);
    expect(dm.search('').length).toBe(2);
  });
});
