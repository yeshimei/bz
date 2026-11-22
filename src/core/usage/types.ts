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
  /**
   * 本机考古得到的「最早使用日」（YYYY-MM-DD），由 `probeSince` 每次启动合并一次，
   * **只往早里走，绝不改晚**（同一设备开两个库时，两份账本各自只增不减）。
   * '' = 还没查到（新装 / 数据目录还没建）。设备级那份在 localStorage，跨库共享。
   * 唯一用途：让作者看板知道「统计上线之前这台设备用了多久」，好折算历史时长。
   */
  sinceDay: string;
  lastSentDate: string;
  failures: number;
  lastAttemptAt: number;
  lastActivityAt: number;
  days: Record<string, DayBucket>;
}

/** 配套插件的授权档位（2026-11-12 起随快照带上，只给作者看板分类用） */
export type PluginTier = 'basic' | 'paid' | 'patron' | 'unknown';

/** 兼容旧名 */
export type ReaderTier = PluginTier;

/** 配套插件的运行状态（reader / review 共用同一套枚举） */
export type PluginRuntimeState = 'none' | 'broken' | 'disabled' | 'idle' | 'active' | 'unknown';

/** bz 阅读的使用快照（只标量；书名/路径/划线内容不进这里） */
export interface ReaderSnapshot {
  /** none 没装 / broken 装坏了 / disabled 装了没启用 / idle 启用了没读 / active 在读 / unknown 这次没探测到 */
  state: PluginRuntimeState;
  /**
   * 当前授权档位：basic 基础版 / paid 高级版 / patron 赞助人（含带专属昵称的码）。
   * 没装、装坏、装了没启用的设备不知道档位，报 unknown——不能塞进基础版充数。
   */
  tier: PluginTier;
  version: string;
  /** 累计阅读分钟 */
  minutes: number;
  /** 距最近一次阅读几天；-1 = 从未读过 */
  daysSince: number;
  /**
   * 码号（激活码 payload 里的 `id`，例如 `BZR-AF-2026-0017`；没有码就不出现这个键）。
   * 2026-11-22 起带上：作者要能回答「哪个码在被用、一个码几台设备、封了会影响谁」。
   * 只带码号，不带码原文 / 昵称 / 订单号——码号本身不能用来激活。
   */
  licenseId?: string;
}

/** bz review 的使用快照（只标量；卡片内容、书名、笔记路径一律不进这里） */
export interface ReviewSnapshot {
  /** 口径同 ReaderSnapshot.state */
  state: PluginRuntimeState;
  /** 口径同 ReaderSnapshot.tier（Review 认 BZP* 与 BZR* 两种码） */
  tier: PluginTier;
  version: string;
  /** 复习条目总数（复习笔记 + 划线卡，与它自己的 50 条上限同一口径） */
  items: number;
  /** 距最近一次复习几天；-1 = 从未复习过 */
  daysSince: number;
  /** 码号；没有码就不出现这个键 */
  licenseId?: string;
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
  /** bz review 的快照（这台设备没装就不带） */
  review?: ReviewSnapshot;
  /** 首次引导走完了没 */
  guideDone?: boolean;
  /** 自动更新开关（缺省开） */
  updateAuto?: boolean;
}

export interface DailyPayload extends UsageMeta {
  schema: number;
  /** 本机最早使用日（YYYY-MM-DD）；考古没查到就不带这个键 */
  since?: string;
  days: DayBucket[];
}

export interface PingPayload extends UsageMeta {
  schema: number;
  /** 同 DailyPayload.since：只发日期，不发任何路径或文件名 */
  since?: string;
  at: number;
}

export function emptyLedger(now: number): Ledger {
  return {
    schema: USAGE_SCHEMA,
    createdAt: now,
    sinceDay: '',
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
