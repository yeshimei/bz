/** bz 阅读（bz-reader 插件）的使用快照。
 *
 * 只取五个数：状态 / 授权档位 / 版本号 / 累计阅读分钟 / 距今几天没读。
 * 书名、文件路径、划线内容、激活码原文、购买者昵称一律不出这一层——快照里只有这几个标量。
 *
 * 数据来源三处（都只读，不写）：
 *   1. core/reader-install 的 readReaderInstall：装没装、启没启用、版本、是否坏；
 *   2. bookshelf/reader-source 的 readReaderPluginConfig：配置里的激活码 → 档位
 *      （见 bookshelf/reader-tier，只判「基础 / 高级 / 赞助人」，不验签、不留原文）；
 *   3. bookshelf/reader-source 的 readReaderAggregates：每本书的累计阅读时长与最近阅读时刻。
 */
import type { App } from 'obsidian';
import { readReaderInstall } from '../core/reader-install';
import type { ReaderSnapshot, ReaderTier } from '../core/usage/types';
import { readReaderAggregates, readReaderPluginConfig } from './reader-source';
import { readerLicenseIdOf, readerRevokedFlags, readerTierOf } from './reader-tier';
import type { RevokedFlags } from './reader-tier';

const DAY_MS = 86_400_000;

/** 秒级时间戳统一成毫秒（bz-reader 的 lastReadTime 是秒，updatedAt 是毫秒） */
function toMs(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

export async function probeReaderUsage(app: App): Promise<ReaderSnapshot> {
  let state: ReaderSnapshot['state'] = 'none';
  let version = '';
  try {
    const install = await readReaderInstall(app);
    version = String(install.version || '').slice(0, 24);
    if (!install.installed) state = 'none';
    else if (install.broken) state = 'broken';
    else if (!install.enabled) state = 'disabled';
    else state = 'idle';
  } catch {
    // 连装没装都读不出来：报「未知」，别拿上次的数字冒充
    return { state: 'unknown', tier: 'unknown', version: '', minutes: 0, daysSince: -1 };
  }

  /* 档位只在「装了、没坏、已启用」时才有意义：别的设备根本走不到 bz 阅读的授权判定，
     硬算会把「没装」也算成基础版，凭空放大基础版用户数。 */
  let tier: ReaderTier = 'unknown';
  let licenseId = '';
  let flags: RevokedFlags = {};
  if (state === 'idle') {
    try {
      const cfg = await readReaderPluginConfig(app);
      tier = readerTierOf(cfg);
      licenseId = readerLicenseIdOf(cfg);
      /* 2026-11-22：封码状态、档位成因、上次激活失败原因。
         reader 那边写在自己的 entitlement 记录里；老版本没有这几个键，
         读出来全是 undefined —— 不上报，而不是拿 false / 'none' 冒充。 */
      flags = readerRevokedFlags(cfg);
    } catch {
      tier = 'unknown';
    }
  }

  let ms = 0;
  let lastAt = 0;
  try {
    const books = await readReaderAggregates(app, { silent: true });
    for (const book of books) {
      const stats = book?.reading?.stats || {};
      const total = Number(stats.totalReadTime);
      if (Number.isFinite(total) && total > 0) ms += total;
      const last = Math.max(toMs(stats.lastReadTime), toMs(book?.updatedAt));
      if (last > lastAt) lastAt = last;
    }
  } catch {
    /* 读不到就按「没读过」算，不阻断本轮快照 */
  }

  const minutes = Math.min(10_000_000, Math.round(ms / 60_000));
  const daysSince = lastAt > 0 ? Math.max(0, Math.floor((Date.now() - lastAt) / DAY_MS)) : -1;
  if (state === 'idle' && (minutes > 0 || lastAt > 0)) state = 'active';
  const snap: ReaderSnapshot = { state, tier, version, minutes, daysSince };
  if (licenseId) snap.licenseId = licenseId;
  if (flags.revoked !== undefined) snap.revoked = flags.revoked;
  if (flags.revokedAt) snap.revokedAt = flags.revokedAt;
  if (flags.tierReason) snap.tierReason = flags.tierReason;
  if (flags.activateFail) snap.activateFail = flags.activateFail;
  if (flags.activateFailAt) snap.activateFailAt = flags.activateFailAt;
  return snap;
}
