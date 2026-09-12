/**
 * 锁屏统计快照 · 明文落盘（src/core/lock-stats.ts，ADR-0124 决策 4 修订）
 * 统计卡数字只在解锁期可算（清单 .safe.enc 是密文，锁定态读不到），原先仅存会话内存 ——
 * 冷启动解锁屏一律「—」。现将各域最近一次快照持久化到 CONFIG/STORAGE/lock-stats.json（明文），
 * 冷启动回落「上次快照」；文件缺失 / 该档缺失 / 读失败仍显「—」，不编造数字。
 * core 无域语义（ADR-0002）：键即 LockScreenKind，值即 num/label 数组。
 * 取舍：明文计数会向能读 vault 目录的人暴露条目规模（元数据级泄露），系修订的有意接受项。
 */
import { jsonFileStore, storageFile, updateFileSections } from './storage';
import type { LockScreenKind, LockScreenStat } from './ui/lock-screen';

type LockStatsFile = Partial<Record<LockScreenKind, LockScreenStat[]>>;

const lockStatsPath = () => storageFile('lock-stats.json');

/** 读某域上次快照；无档 / 读失败返回 null（调用方回落「—」，不阻塞解锁流） */
export async function readLockStats(kind: LockScreenKind): Promise<LockScreenStat[] | null> {
  try {
    const all = await jsonFileStore<LockStatsFile>(lockStatsPath(), { defaultValue: {} }).read();
    const hit = all[kind];
    return Array.isArray(hit) && hit.length ? hit : null;
  } catch {
    return null;
  }
}

/** 写某域快照（段级合并写：多域并发各写各档互不覆盖）；失败照抛，由调用方决定吞不吞 */
export function writeLockStats(kind: LockScreenKind, stats: LockScreenStat[]): Promise<void> {
  return updateFileSections<LockStatsFile>(
    lockStatsPath(),
    () => {
      const set: Partial<LockStatsFile> = {};
      set[kind] = stats;
      return set;
    },
    { defaultValue: {}, writeIfChanged: true }
  ).then(() => undefined);
}
