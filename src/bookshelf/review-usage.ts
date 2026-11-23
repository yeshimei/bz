/** bz review（bz-review 插件）的使用快照。
 *
 * 只取五个数：状态 / 授权档位 / 版本号 / 复习条目数 / 距今几天没复习，外加码号。
 * 卡片正文、书名、笔记路径、激活码原文一律不出这一层——快照里只有标量。
 *
 * 数据来源三处（都只读，不写）：
 *   1. core/reader-install 的 readReviewInstall：装没装、启没启用、版本、是否坏；
 *   2. bz-review 的 `<插件目录>/data.json`（它把 settings 直接摊在顶层）：
 *      `licenseKey` → 档位与码号（见 bookshelf/reader-tier，不验签、只取 id）；
 *   3. 它自己的业务数据 `<storagePath>/review.json`（默认 CONFIG/STORAGE）：
 *      条目数量与每条的 `lastReviewed`。
 *
 * 与 reader 的差别：review 只有一个数据文件（数组），不用遍历每本书；
 * 代价是它整份 JSON 比单本书大，所以这条路同样只在空闲时、六小时一次。
 */
import type { App } from 'obsidian';
import { REVIEW_SPEC, pluginDirOf, readReviewInstall } from '../core/reader-install';
import { diskReadText } from '../core/storage';
import type { PluginRuntimeState, ReviewSnapshot } from '../core/usage/types';
import { reviewLicenseIdOf, reviewRevokedFlags, reviewTierOf } from './reader-tier';
import type { RevokedFlags } from './reader-tier';

const DAY_MS = 86_400_000;

/** bz-review core/storage-path 的缺省存储目录 */
const DEFAULT_STORAGE_DIR = 'CONFIG/STORAGE';

/** 读一个 vault 相对路径的 JSON；读不到 / 解析失败一律 null（探测不该抛）。
 *  读盘走 core/storage 的问盘助手（ADR-0289）：路径可能是点前缀目录，vault 索引会漏。 */
async function readJson(app: App, path: string): Promise<unknown> {
  const raw = await diskReadText(app, path);
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 存储目录：取 data.json 的 `storagePath`，拒上跳与点目录，坏值回落缺省 */
function storageDirOf(cfg: unknown): string {
  const raw = String((cfg as { storagePath?: unknown } | null)?.storagePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();
  const segs = raw.split('/').filter(Boolean);
  if (!segs.length || segs.some((x) => x === '..' || x.startsWith('.'))) return DEFAULT_STORAGE_DIR;
  return segs.join('/');
}

/** review.json 顶层是数组（旧版可能包一层 `{ items: [...] }`），两种都认 */
function itemsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const list = (data as { items?: unknown } | null)?.items;
  return Array.isArray(list) ? list : [];
}

export async function probeReviewUsage(app: App): Promise<ReviewSnapshot> {
  let state: PluginRuntimeState = 'none';
  let version = '';
  try {
    const install = await readReviewInstall(app);
    version = String(install.version || '').slice(0, 24);
    if (!install.installed) state = 'none';
    else if (install.broken) state = 'broken';
    else if (!install.enabled) state = 'disabled';
    else state = 'idle';
  } catch {
    // 连装没装都读不出来：报「未知」，别拿上次的数字冒充
    return { state: 'unknown', tier: 'unknown', version: '', items: 0, daysSince: -1 };
  }

  /* 档位与条目数只在「装了、没坏、已启用」时才有意义：别的设备走不到 review 的授权判定，
     硬算会把「没装」也算成基础版，凭空放大基础版用户数。 */
  let tier: ReviewSnapshot['tier'] = 'unknown';
  let licenseId = '';
  let items = 0;
  let daysSince = -1;
  let flags: RevokedFlags = {};

  if (state === 'idle') {
    const cfg = await readJson(app, `${pluginDirOf(app, REVIEW_SPEC)}/data.json`);
    if (cfg) {
      try {
        tier = reviewTierOf(cfg);
        licenseId = reviewLicenseIdOf(cfg);
        /* 2026-11-22：封码状态、档位成因、上次激活失败原因。
           review 把这几个键摊在 data.json 顶层（`licenseRevoked` 等），
           老版本没有就全是 undefined —— 不上报，不拿默认值冒充。 */
        flags = reviewRevokedFlags(cfg);
      } catch {
        tier = 'unknown';
      }
      const list = itemsOf(await readJson(app, `${storageDirOf(cfg)}/review.json`));
      items = list.length;
      let lastAt = 0;
      for (const it of list) {
        const t = Date.parse(String((it as { lastReviewed?: unknown } | null)?.lastReviewed || ''));
        if (Number.isFinite(t) && t > lastAt) lastAt = t;
      }
      if (lastAt > 0) daysSince = Math.max(0, Math.floor((Date.now() - lastAt) / DAY_MS));
    }
  }

  // 「启用了但一条都没有」保持 idle；有条目才算 active（与 reader 的 idle/active 同义）
  if (state === 'idle' && items > 0) state = 'active';

  const snap: ReviewSnapshot = { state, tier, version, items, daysSince };
  if (licenseId) snap.licenseId = licenseId;
  if (flags.revoked !== undefined) snap.revoked = flags.revoked;
  if (flags.revokedAt) snap.revokedAt = flags.revokedAt;
  if (flags.tierReason) snap.tierReason = flags.tierReason;
  if (flags.activateFail) snap.activateFail = flags.activateFail;
  if (flags.activateFailAt) snap.activateFailAt = flags.activateFailAt;
  return snap;
}
