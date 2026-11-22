/**
 * 配套插件的授权档位与码号（只给统计用，纯函数、不碰 UI）。
 *
 * 读取对象是两个插件各自的 `<插件目录>/data.json`：
 *   - bz reader：`entitlement.license`（见 bz-reader src/data/plugin-data.ts）
 *   - bz review：顶层 `licenseKey`（它把 settings 直接摊在 data.json 顶层）
 * 激活码都是三段式 `<前缀>.<base64url(payload)>.<sig>`：BZR* 是 Reader 的码，
 * BZP* 是 Review 自己的码（Review 两种都认，见 bz-review src/data/license.ts）。
 * payload 里有 `id`（码号）、`patron`（赞助人码）、`exp`（过期毫秒戳，0/缺省 = 永久）。
 *
 * 四条规矩：
 *   1. **不验签**。验签要异步 WebCrypto + 内嵌公钥，而这里只为一格统计；
 *      码是真是假由插件自己判定，这边照它判定的方向读就行。
 *   2. **只读码号，不读任何原文**。2026-11-22 起带 `id`（作者要知道哪个码在被用、
 *      一个码几台设备），但昵称、订单号、码原文一律不出这一层。
 *   3. **判「当前有效」而不是「有没有码」**：过期码在插件里就是基础版，
 *      统计里也算基础版，否则「卖出去了」和「还在用」会被混成一个数。
 *   4. **判不出来就报 unknown，不塞进基础版充数**（档位由调用方决定怎么兜）。
 */
import type { PluginTier } from '../core/usage/types';

/** 从码里读出来的事实（不含原文） */
export interface LicenseFacts {
  patron: boolean;
  exp: number;
  /** 码号（payload.id），没有或形状不对时为空串 */
  id: string;
}

/** bz reader 只认自己的 BZR* 码 */
const READER_PREFIXES = ['BZR1', 'BZR2'] as const;
/** bz review 认自己的 BZP*，也认 Reader 的通用 BZR*（赞助人码跨插件可用） */
export const REVIEW_PREFIXES = ['BZP1', 'BZP2', 'BZR1', 'BZR2'] as const;

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
 * 拆激活码 payload。形状不对、JSON 坏、版本不认识、前缀不在白名单 → null。
 * 与 bz-reader src/data/license.ts 的 parseLicense 同规则，只是不取签名字节。
 */
export function parseLicenseFacts(
  code: string,
  prefixes: readonly string[] = REVIEW_PREFIXES,
): LicenseFacts | null {
  const raw = String(code ?? '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  if (!prefixes.includes(parts[0])) return null;
  try {
    const bytes = bytesOf(parts[1]);
    if (!bytes) return null;
    const doc = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown> | null;
    if (!doc || typeof doc !== 'object') return null;
    if (doc.v !== 1 && doc.v !== 2) return null;
    const exp = typeof doc.exp === 'number' && Number.isFinite(doc.exp) && doc.exp > 0 ? doc.exp : 0;
    // 码号只留字母数字与横线/下划线：防止手改坏的文件把奇怪字符带进统计
    const id =
      typeof doc.id === 'string' ? doc.id.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : '';
    return { patron: doc.patron === true, exp, id };
  } catch {
    return null;
  }
}

/**
 * bz reader 的码（只认 BZR*）→ 判档需要的两个字段。
 * 保持只返回 `{patron, exp}` 的形状：这层的既有测试按这个形状钉过，
 * 码号走单独的 `licenseIdOf`。
 */
export function parseReaderLicense(code: string): { patron: boolean; exp: number } | null {
  const facts = parseLicenseFacts(code, READER_PREFIXES);
  return facts ? { patron: facts.patron, exp: facts.exp } : null;
}

/** 从任何一枚码里取码号（认 BZR* 与 BZP*）；取不到返回空串 */
export function licenseIdOf(code: string): string {
  return parseLicenseFacts(code, REVIEW_PREFIXES)?.id ?? '';
}

/** 事实 + 当前时刻 → 档位 */
function tierOfFacts(facts: LicenseFacts | null, now: number): PluginTier {
  if (!facts) return 'basic';
  if (facts.exp > 0 && facts.exp <= now) return 'basic';
  return facts.patron ? 'patron' : 'paid';
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
export function readerTierOf(cfg: unknown, now = Date.now()): PluginTier {
  const ent = (cfg as { entitlement?: { license?: unknown } } | null)?.entitlement;
  const license = typeof ent?.license === 'string' ? ent.license : '';
  if (!license.trim()) return 'basic';
  return tierOfFacts(parseLicenseFacts(license, READER_PREFIXES), now);
}

/**
 * bz review 插件配置 → 当前档位（口径同 reader）。
 *
 * 配置是它自己的 settings 对象摊在 data.json 顶层，码在 `licenseKey`。
 * 传 null 按 basic：Review 没填码时就是基础版（笔记 + 划线合计 50 条上限）。
 */
export function reviewTierOf(cfg: unknown, now = Date.now()): PluginTier {
  const license = String((cfg as { licenseKey?: unknown } | null)?.licenseKey || '');
  if (!license.trim()) return 'basic';
  return tierOfFacts(parseLicenseFacts(license, REVIEW_PREFIXES), now);
}

/** bz 阅读配置里的码号（没有码 / 解不开 → 空串） */
export function readerLicenseIdOf(cfg: unknown): string {
  const ent = (cfg as { entitlement?: { license?: unknown } } | null)?.entitlement;
  const license = typeof ent?.license === 'string' ? ent.license : '';
  return licenseIdOf(license);
}

/** bz review 配置里的码号（没有码 / 解不开 → 空串） */
export function reviewLicenseIdOf(cfg: unknown): string {
  const license = String((cfg as { licenseKey?: unknown } | null)?.licenseKey || '');
  return licenseIdOf(license);
}
