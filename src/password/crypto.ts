/**
 * CryptoService（密码本.js 逐字移植）
 * PBKDF2(100000 迭代, SHA-256) 派生 AES-GCM-256 密钥；
 * 密文布局：salt(16) + iv(12) + ciphertext；btoa/atob Base64。
 *
 * 派生密钥缓存：PBKDF2 十万次迭代是解密耗时大头（预览窗每附件一次），
 * 按 (password, salt) 缓存已派生密钥——同一密文重复解密（重开预览/失败重试）不再重复派生。
 * 锁定语义：保险箱上锁时须 clearCryptoKeyCache()，密钥不残留内存。
 */
export class CryptoService {
  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const cacheKey = toBase64(salt);
    const hit = keyCache.get(cacheKey);
    if (hit && hit.pw === password) return hit.key;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
      'deriveKey',
    ]);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    keyCache.set(cacheKey, { pw: password, key });
    return key;
  }

  static async encrypt(plainText: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data);
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    // 与原脚本同布局：salt16+iv12+ct → Base64。
    // 注意：勿用 btoa(String.fromCharCode(...combined))——大附件(图片/视频)展开整个字节数组
    // 会触发「Maximum call stack size exceeded」；改分块编码，输出逐字节不变。
    return toBase64(combined);
  }

  static async decrypt(encryptedBase64: string, password: string): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    const key = await this.deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  }
}

/**
 * 字节数组 → Base64（分块，逐字节结果与 String.fromCharCode(...bytes) 完全一致）。
 * 分块（≤32k 字节/次）避免对大字节数组一次性展开触发栈溢出。
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32768，远低于引擎参数上限
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any);
  }
  return btoa(bin);
}

/** 已派生密钥缓存：(salt base64) → {密码, 密钥}；同 salt 换密码会重新派生（校验 pw） */
const keyCache = new Map<string, { pw: string; key: CryptoKey }>();

/** 清空派生密钥缓存（安全：保险箱/密码本上锁时调用，密钥不残留内存） */
export function clearCryptoKeyCache(): void {
  keyCache.clear();
}
