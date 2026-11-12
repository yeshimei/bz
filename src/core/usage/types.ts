export const USAGE_SCHEMA = 1;

export const USAGE_FILE = 'usage.json';

export const KEEP_DAYS = 14;

export const PENDING_MAX_DAYS = 7;

export const TICK_MS = 60_000;

export const PING_MS = 5 * 60_000;

export const PING_FIRST_DELAY_MS = 5_000;

export const UPLOAD_FIRST_DELAY_MS = 20_000;

export const UPLOAD_INTERVAL_MS = 6 * 60 * 60_000;

export const SESSION_GAP_MS = 30 * 60_000;

export const DAY_MS = 86_400_000;

export interface DayBucket {
  date: string;
  sessions: number;
  activeMinutes: number;
  hourMinutes: number[];
  commands: Record<string, number>;
  domains: Record<string, number>;
  firstAt: number | null;
  lastAt: number | null;
}

export interface Ledger {
  schema: number;
  createdAt: number;
  lastSentDate: string;
  failures: number;
  lastAttemptAt: number;
  lastActivityAt: number;
  days: Record<string, DayBucket>;
}

export interface UsageMeta {
  installId: string;
  pluginVersion: string;
  obsidianVersion: string;
  platform: string;
  isMobile: boolean;
  tz: string;
  locale: string;
}

export interface DailyPayload extends UsageMeta {
  schema: number;
  days: DayBucket[];
}

export interface PingPayload extends UsageMeta {
  schema: number;
  at: number;
}

export function emptyLedger(now: number): Ledger {
  return {
    schema: USAGE_SCHEMA,
    createdAt: now,
    lastSentDate: '',
    failures: 0,
    lastAttemptAt: 0,
    lastActivityAt: 0,
    days: {},
  };
}

export function emptyDay(date: string): DayBucket {
  return {
    date,
    sessions: 0,
    activeMinutes: 0,
    hourMinutes: new Array<number>(24).fill(0),
    commands: {},
    domains: {},
    firstAt: null,
    lastAt: null,
  };
}
