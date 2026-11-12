export const USAGE_SCHEMA = 1;

/** 账本文件名：带上设备号前缀。
 *  账本落在库内存储目录，而用户的同步工具会把整个目录同步到别的设备——
 *  同名文件互相覆盖过一次（失败计数被同步回旧值，退避反复触发）。 */
export function usageFileName(installId: string): string {
  const short = String(installId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'local';
  return `usage-${short}.json`;
}

export const KEEP_DAYS = 14;

export const PENDING_MAX_DAYS = 7;

export const TICK_MS = 60_000;

// 心跳比「在线」判定窗口（5 分钟）短，留出两拍的余量：心跳与窗口等长时，
// 只要哪一跳慢十几秒，在线数就会闪成 0，看着像掉线，其实设备一直在。
export const PING_MS = 2 * 60_000;

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

/** bz 阅读的授权档位（2026-11-12 起随快照带上，只给作者看板分类用） */
export type ReaderTier = 'basic' | 'paid' | 'patron' | 'unknown';

/** bz 阅读的使用快照（只标量；书名/路径/划线内容不进这里） */
export interface ReaderSnapshot {
  /** none 没装 / broken 装坏了 / disabled 装了没启用 / idle 启用了没读 / active 在读 / unknown 这次没探测到 */
  state: 'none' | 'broken' | 'disabled' | 'idle' | 'active' | 'unknown';
  /**
   * 当前授权档位：basic 基础版 / paid 高级版 / patron 赞助人（含带专属昵称的码）。
   * 没装、装坏、装了没启用的设备不知道档位，报 unknown——不能塞进基础版充数。
   */
  tier: ReaderTier;
  version: string;
  /** 累计阅读分钟 */
  minutes: number;
  /** 距最近一次阅读几天；-1 = 从未读过 */
  daysSince: number;
}

export interface UsageMeta {
  installId: string;
  pluginVersion: string;
  obsidianVersion: string;
  platform: string;
  isMobile: boolean;
  tz: string;
  locale: string;
  reader?: ReaderSnapshot;
  /** 首次引导走完了没 */
  guideDone?: boolean;
  /** 自动更新开关（缺省开） */
  updateAuto?: boolean;
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
