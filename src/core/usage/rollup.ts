import { localDayKey } from '../ui/str';
import { isCommandId } from './domain-map';
import { isDayKey } from './ledger';
import { PENDING_MAX_DAYS, USAGE_SCHEMA, type DailyPayload, type DayBucket, type Ledger, type UsageMeta } from './types';

export function pendingDates(ledger: Ledger, now: number, max = PENDING_MAX_DAYS): string[] {
  const today = localDayKey(now);
  const floor = ledger.lastSentDate && isDayKey(ledger.lastSentDate) ? ledger.lastSentDate : '';
  // 今天也发：当天就能看到今日活跃，之后每 6 小时滚一次覆盖同一天。
  // 今天这条不推进水位（见 markDailySent），明天会作为「昨天」再完整发一遍。
  // 取最早的一批，不是最近的一批：服务端一次最多收 7 天，积压超过 7 天时让老日子先走，
  // 剩下的下一轮接着发。取最近 7 天会让中间的日子永远排不进窗口，最后随保留期一起被清掉。
  return Object.keys(ledger.days)
    .filter((d) => isDayKey(d) && d <= today && (!floor || d > floor))
    .sort()
    .slice(0, Math.max(1, max));
}

export function exportDay(day: DayBucket): DayBucket {
  const commands: Record<string, number> = {};
  for (const [k, v] of Object.entries(day.commands)) {
    if (isCommandId(k) && Number.isFinite(v) && v > 0) commands[k] = Math.round(v);
  }
  const domains: Record<string, number> = {};
  for (const [k, v] of Object.entries(day.domains)) {
    if (/^[a-z][a-z0-9-]{0,23}$/.test(k) && Number.isFinite(v) && v > 0) domains[k] = Math.round(v);
  }
  return {
    date: day.date,
    sessions: day.sessions,
    activeMinutes: day.activeMinutes,
    hourMinutes: day.hourMinutes.slice(0, 24),
    commands,
    domains,
    firstAt: day.firstAt,
    lastAt: day.lastAt,
  };
}

export function buildDailyPayload(
  meta: UsageMeta,
  days: DayBucket[],
  since = '',
  firstVersion = '',
): DailyPayload {
  const payload: DailyPayload = {
    schema: USAGE_SCHEMA,
    installId: meta.installId,
    pluginVersion: meta.pluginVersion,
    obsidianVersion: meta.obsidianVersion,
    platform: meta.platform,
    isMobile: meta.isMobile,
    tz: meta.tz,
    locale: meta.locale,
    days: days.map(exportDay),
  };
  /* 配套插件快照此前只跟着「上线心跳」发（心跳把 meta 整份展开）；2026-11-22 心跳删掉后
     日汇总成了唯一的上报路径，这几项必须在这里显式带上，否则码号永远到不了服务端。
     只在有值时才写键：PATCH 里不传的字段保持服务端旧值，不会被空值冲掉。 */
  if (meta.reader) payload.reader = meta.reader;
  if (meta.review) payload.review = meta.review;
  if (meta.guideDone !== undefined) payload.guideDone = meta.guideDone;
  if (meta.updateAuto !== undefined) payload.updateAuto = meta.updateAuto;
  // 只有考古拿到日子才带这个键：查不到就让服务端按 firstSeen 兜底，别发空串占位
  if (since) payload.since = since;
  // 同理：第一次见到的版本只写一次，账本里还没有就不带
  if (firstVersion) payload.firstVersion = firstVersion;
  return payload;
}

export function retryDelay(failures: number): number {
  const step = Math.min(3, Math.max(1, Math.round(failures)));
  const base = 6 * 60 * 60 * 1000;
  return step === 1 ? base : step === 2 ? base * 2 : base * 4;
}

export function retryWaitMs(ledger: Ledger, now: number): number {
  if (ledger.failures <= 0) return 0;
  const wait = retryDelay(ledger.failures);
  const elapsed = now - (ledger.lastAttemptAt || 0);
  return elapsed >= wait ? 0 : wait - elapsed;
}

export function markDailySent(ledger: Ledger, sentDates: string[], today: string): void {
  ledger.failures = 0;
  // 不清 lastAttemptAt（2026-11-22）：它现在兼任「上次上报时刻」，跨重启节流（collect 的
  // MIN_UPLOAD_GAP_MS）要用它。退避那边不受影响——retryWaitMs 在 failures=0 时根本不看它。
  // 水位只认「已经过完的日子」：今天还在长，明天会整份重发，不能被今天顶掉
  const done = sentDates.filter((d) => d < today);
  if (!done.length) return;
  const last = done.slice().sort().slice(-1)[0];
  if (last && (!ledger.lastSentDate || last > ledger.lastSentDate)) ledger.lastSentDate = last;
}
