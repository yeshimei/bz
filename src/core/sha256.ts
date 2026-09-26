/* ============================================================
 * bz · SHA-256（core/sha256.ts，单源）
 *
 * 用途：皮肤包完整性校验（ADR-0199）——远端清单条目自带 sha256，
 * 插件下载后逐字比对，不匹配则**拒绝注入**（远端是个公开 raw 地址，
 * 谁有仓库写权限谁就能投毒；手册吃这个亏顶多少看一页，皮肤吃这个亏
 * 是把垃圾直接注入 `<style>`）。
 *
 * 为什么手写而不用 crypto.subtle：它是 Promise API，且 jsdom / 测试环境
 * 不保证存在；皮肤校验要**同步、可测、零环境依赖**，纯 TS 实现（FIPS 180-4）
 * 最省事，也免了「下载期异步 + 注入期同步」的时序纠缠。
 *
 * 口径：只吃 UTF-8 文本。调用方必须先把换行归一到 `\n`（见 normalizeEol），
 * 否则 Windows 本地 CRLF 与仓库 LF 会算出两个 hash。
 * ============================================================ */

/** FIPS 180-4 轮常量（前 64 个素数立方根小数前 32 位） */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** UTF-8 编码（TextEncoder 在 Electron / node / jsdom 全都有，不自己造轮子） */
function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** 换行归一（CRLF / CR → LF）——hash 与比对两侧都必须先过这一步 */
export function normalizeEol(text: string): string {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

/**
 * SHA-256 → 64 位小写十六进制。
 * @param text 待摘要文本（UTF-8）
 */
export function sha256Hex(text: string): string {
  const bytes = toBytes(String(text ?? ''));
  const dataLen = bytes.length;

  // 填充：0x80 + 0x00… 至 (len ≡ 56 mod 64)，末尾 8 字节大端位长
  const padded = new Uint8Array((((dataLen + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[dataLen] = 0x80;
  const bitLen = dataLen * 8; // < 2^32（皮肤包只有几十 KB）
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  // 初始哈希值（FIPS 180-4 §5.3.3）
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** 文本摘要（先归一换行再算——与构建脚本同口径，免 CRLF/LF 两套 hash） */
export function textSha256(text: string): string {
  return sha256Hex(normalizeEol(text));
}
