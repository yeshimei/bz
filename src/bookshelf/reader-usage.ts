/** bz 阅读（bz-reader 插件）的使用快照。
 *
 * 只取四个数：状态 / 版本号 / 累计阅读分钟 / 距今几天没读。
 * 书名、文件路径、划线内容一律不出这一层——发送只带这几个标量。
 *
 * 数据来源两处（都只读，不写）：
 *   1. core/reader-install 的 readReaderInstall：装没装、启没启用、版本、是否坏；
 *   2. bookshelf/reader-source 的 readReaderAggregates：每本书的累计阅读时长与最近阅读时刻。
 */
import type { App } from 'obsidian';
import { readReaderInstall } from '../core/reader-install';
import type { ReaderSnapshot } from '../core/usage/types';
import { readReaderAggregates } from './reader-source';

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
    return { state: 'unknown', version: '', minutes: 0, daysSince: -1 };
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
    /* 读不到就按「没读过」算，不阻断发送 */
  }

  const minutes = Math.min(10_000_000, Math.round(ms / 60_000));
  const daysSince = lastAt > 0 ? Math.max(0, Math.floor((Date.now() - lastAt) / DAY_MS)) : -1;
  if (state === 'idle' && (minutes > 0 || lastAt > 0)) state = 'active';
  return { state, version, minutes, daysSince };
}
