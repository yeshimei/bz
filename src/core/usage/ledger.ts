import { localDayKey } from '../ui/str';
import { domainOfCommand, isCommandId, type UsageDomain } from './domain-map';
import {
  DAY_MS,
  KEEP_DAYS,
  SESSION_GAP_MS,
  USAGE_SCHEMA,
  emptyDay,
  emptyLedger,
  type DayBucket,
  type Ledger,
} from './types';

export function isDayKey(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function dayOf(ledger: Ledger, now: number): DayBucket {
  const key = localDayKey(now);
  let day = ledger.days[key];
  if (!day) {
    day = emptyDay(key);
    ledger.days[key] = day;
  }
  return day;
}

function touch(day: DayBucket, now: number): void {
  if (day.firstAt === null || now < day.firstAt) day.firstAt = now;
  if (day.lastAt === null || now > day.lastAt) day.lastAt = now;
}

function noteActivity(ledger: Ledger, day: DayBucket, now: number): void {
  if (!ledger.lastActivityAt || now - ledger.lastActivityAt > SESSION_GAP_MS) {
    day.sessions += 1;
  }
  ledger.lastActivityAt = now;
}

export function recordCommand(ledger: Ledger, commandId: string, now: number): UsageDomain | null {
  if (!isCommandId(commandId)) return null;
  const day = dayOf(ledger, now);
  const domain = domainOfCommand(commandId);
  day.commands[commandId] = (day.commands[commandId] ?? 0) + 1;
  day.domains[domain] = (day.domains[domain] ?? 0) + 1;
  touch(day, now);
  noteActivity(ledger, day, now);
  return domain;
}

export function addActiveMinute(ledger: Ledger, now: number): void {
  const day = dayOf(ledger, now);
  const hour = new Date(now).getHours();
  day.activeMinutes += 1;
  day.hourMinutes[hour] = (day.hourMinutes[hour] ?? 0) + 1;
  touch(day, now);
}

export function startSession(ledger: Ledger, now: number): void {
  const day = dayOf(ledger, now);
  if (!ledger.lastActivityAt || now - ledger.lastActivityAt > SESSION_GAP_MS) day.sessions += 1;
  ledger.lastActivityAt = now;
  touch(day, now);
}

export function pruneDays(ledger: Ledger, now: number, keep = KEEP_DAYS): number {
  const oldest = localDayKey(now - (Math.max(1, keep) - 1) * DAY_MS);
  let removed = 0;
  for (const key of Object.keys(ledger.days)) {
    if (key < oldest) {
      delete ledger.days[key];
      removed += 1;
    }
  }
  return removed;
}

function sanitizeCounts(raw: unknown, keyOk: (k: string) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!keyOk(k)) continue;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n <= 0) continue;
    out[k] = Math.min(1_000_000, n);
  }
  return out;
}

function sanitizeHours(raw: unknown): number[] {
  const out = new Array<number>(24).fill(0);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 24; i += 1) {
    const n = Math.round(Number(raw[i]));
    out[i] = Number.isFinite(n) && n > 0 ? Math.min(1_440, n) : 0;
  }
  return out;
}

function sanitizeAt(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function normalizeLedger(raw: unknown, now: number): Ledger {
  const base = emptyLedger(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const ledger: Ledger = {
    schema: USAGE_SCHEMA,
    createdAt: sanitizeAt(r.createdAt) ?? now,
    lastSentDate: isDayKey(r.lastSentDate) ? r.lastSentDate : '',
    failures: Math.max(0, Math.min(99, Math.round(Number(r.failures) || 0))),
    lastAttemptAt: sanitizeAt(r.lastAttemptAt) ?? 0,
    lastActivityAt: sanitizeAt(r.lastActivityAt) ?? 0,
    days: {},
  };

  if (r.days && typeof r.days === 'object') {
    for (const [key, value] of Object.entries(r.days as Record<string, unknown>)) {
      if (!isDayKey(key) || !value || typeof value !== 'object') continue;
      const d = value as Record<string, unknown>;
      ledger.days[key] = {
        date: key,
        sessions: Math.max(0, Math.min(10_000, Math.round(Number(d.sessions) || 0))),
        activeMinutes: Math.max(0, Math.min(1_440, Math.round(Number(d.activeMinutes) || 0))),
        hourMinutes: sanitizeHours(d.hourMinutes),
        commands: sanitizeCounts(d.commands, isCommandId),
        domains: sanitizeCounts(d.domains, (k) => /^[a-z][a-z0-9-]{0,23}$/.test(k)),
        firstAt: sanitizeAt(d.firstAt),
        lastAt: sanitizeAt(d.lastAt),
      };
    }
  }

  return ledger;
}
