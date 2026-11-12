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

export function buildDailyPayload(meta: UsageMeta, days: DayBucket[]): DailyPayload {
  return {
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
  ledger.lastAttemptAt = 0;
  // 水位只认「已经过完的日子」：今天还在长，明天会整份重发，不能被今天顶掉
  const done = sentDates.filter((d) => d < today);
  if (!done.length) return;
  const last = done.slice().sort().slice(-1)[0];
  if (last && (!ledger.lastSentDate || last > ledger.lastSentDate)) ledger.lastSentDate = last;
}
