/**
 * bz 阅读的授权档位（只给统计用，纯函数、不碰 UI）。
 *
 * 读取对象是 bz 阅读自己的配置 `<插件目录>/data.json` 里的 `entitlement.license`
 * （见 bz-reader src/data/plugin-data.ts）：激活码是 `BZR2.<base64url(payload)>.<sig>`
 * 的三段式，payload 里有 `patron`（赞助人码）与 `exp`（过期毫秒戳，0/缺省 = 永久）。
 *
 * 三条硬规矩：
 *   1. **不验签**。验签要异步 WebCrypto + 内嵌公钥，而这里只为一格统计；
 *      码是真是假由 bz 阅读自己判定，这边照它判定的方向读就行。
 *   2. **不读任何原文**。调用方只拿到档位枚举——昵称、码号、订单号一律不出这一层。
 *   3. **判「当前有效」而不是「有没有码」**：过期码在 bz 阅读里就是基础版，
 *      统计里也算基础版，否则「卖出去了」和「还在用」会被混成一个数。
 */
import type { ReaderTier } from '../core/usage/types';

/** 一段 base64url（无填充）解成字节 */
function bytesOf(s: string): Uint8Array | null {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 拆激活码 payload。形状不对、JSON 坏、版本不认识 → null。
 * 与 bz-reader src/data/license.ts 的 parseLicense 同规则，只是不取签名字节。
 */
export function parseReaderLicense(
  code: string,
): { patron: boolean; exp: number } | null {
  const raw = String(code ?? '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  if (parts[0] !== 'BZR1' && parts[0] !== 'BZR2') return null;
  try {
    const bytes = bytesOf(parts[1]);
    if (!bytes) return null;
    const doc = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown> | null;
    if (!doc || typeof doc !== 'object') return null;
    if (doc.v !== 1 && doc.v !== 2) return null;
    const exp = typeof doc.exp === 'number' && Number.isFinite(doc.exp) && doc.exp > 0 ? doc.exp : 0;
    return { patron: doc.patron === true, exp };
  } catch {
    return null;
  }
}

/**
 * bz 阅读插件配置 → 当前档位。
 *
 *   basic   没有码 / 码到期 / 码解不开（用户看到的就是基础版）
 *   paid    有效的高级版码
 *   patron  有效的高级版码，且带赞助人标记（带专属昵称的那些也在这里，不单列）
 *
 * 传 null（data.json 读不到）按 basic：bz 阅读没有码时也是这个状态。
 */
export function readerTierOf(cfg: unknown, now = Date.now()): ReaderTier {
  const ent = (cfg as { entitlement?: { license?: unknown } } | null)?.entitlement;
  const license = typeof ent?.license === 'string' ? ent.license : '';
  if (!license.trim()) return 'basic';
  const payload = parseReaderLicense(license);
  if (!payload) return 'basic';
  if (payload.exp > 0 && payload.exp <= now) return 'basic';
  return payload.patron ? 'patron' : 'paid';
}
