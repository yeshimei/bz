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
import type { ActivateFail, PluginTier, TierReason } from '../core/usage/types';

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

/* ── 2026-11-22：封码状态与「为什么掉级」的读取口径 ──────────────
 * 这几样**只有那两个插件自己知道**：验签结果、停用名单判定、激活失败原因，
 * 全都发生在它们各自的授权链路里。bz 只读不算，脏值一律当「没探测到」。
 */

const TIER_REASONS: readonly TierReason[] = ['ok', 'none', 'expired', 'revoked', 'invalid', 'unknown'];
const ACTIVATE_FAILS: readonly ActivateFail[] = ['format', 'invalid', 'offline', 'revoked', 'expired'];

function oneOf<T extends string>(v: unknown, pool: readonly T[]): T | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return (pool as readonly string[]).includes(s) ? (s as T) : undefined;
}

/**
 * 档位成因。老版本插件没写这个键 → undefined（不上报），**不拿 'none' 冒充**：
 * 「没填码」和「这版插件根本不会记」是两件事，混起来会把老用户算成没买。
 */
function tierReasonOf(src: unknown): TierReason | undefined {
  return oneOf((src as { tierReason?: unknown } | null)?.tierReason, TIER_REASONS);
}

/** 上次激活失败的原因；没记过 → undefined */
function activateFailOf(src: unknown): ActivateFail | undefined {
  return oneOf((src as { activateFail?: unknown } | null)?.activateFail, ACTIVATE_FAILS);
}

/** 毫秒戳（数字或可解析的 ISO 串）；0 / 负数 / 垃圾值 → undefined */
export function stampOf(v: unknown): number | undefined {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
  }
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) && t > 0 ? t : undefined;
  }
  return undefined;
}

/** 停用标记：只认真正的布尔，别的（缺失 / 字符串 "true"）当「没探测到」 */
function revokedOf(src: unknown): boolean | undefined {
  const v = (src as { revoked?: unknown } | null)?.revoked;
  return typeof v === 'boolean' ? v : undefined;
}

/** bz reader 写在自己 `entitlement` 记录里的那几笔 */
export interface RevokedFlags {
  revoked?: boolean;
  revokedAt?: number;
  tierReason?: TierReason;
  activateFail?: ActivateFail;
  activateFailAt?: number;
}

/** reader 侧：从 `entitlement` 读（老版本没有这几个键，全是 undefined） */
export function readerRevokedFlags(cfg: unknown): RevokedFlags {
  const ent = (cfg as { entitlement?: unknown } | null)?.entitlement;
  if (!ent) return {};
  return {
    revoked: revokedOf(ent),
    revokedAt: stampOf((ent as { revokedAt?: unknown }).revokedAt),
    tierReason: tierReasonOf(ent),
    activateFail: activateFailOf(ent),
    activateFailAt: stampOf((ent as { activateFailAt?: unknown }).activateFailAt),
  };
}

/**
 * review 侧：它的 settings 摊在 data.json 顶层，几个键都带 `license` 前缀
 * （`licenseRevoked` / `licenseTierReason` / …）。形状不同只是历史原因，
 * 这里收口，采集端只管拿。
 */
export function reviewRevokedFlags(cfg: unknown): RevokedFlags {
  const c = cfg as Record<string, unknown> | null;
  if (!c) return {};
  return {
    revoked: revokedOf({ revoked: c.licenseRevoked }),
    revokedAt: stampOf(c.licenseRevokedAt),
    tierReason: tierReasonOf({ tierReason: c.licenseTierReason }),
    activateFail: activateFailOf({ activateFail: c.licenseActivateFail }),
    activateFailAt: stampOf(c.licenseActivateFailAt),
  };
}
