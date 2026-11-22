export const USAGE_SCHEMA = 1;

/** 账本文件名：带上设备号前缀。
 *  账本落在库内存储目录，而用户的同步工具会把整个目录同步到别的设备——
 *  同名文件互相覆盖过一次（失败计数被同步回旧值，退避反复触发）。 */
export function usageFileName(installId: string): string {
  const short = String(installId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'local';
  return `usage-${short}.json`;
}

/**
 * 本地账本保留天数。
 *
 * 2026-11-22 从 14 拉到 45：Appwrite 免费额度的写入被心跳写爆过一次（402，整个项目
 * API 暂停到 12-12 账单周期结束）。那段日子里上报全部失败，数据只能攒在本地——
 * 如果保留期还是 14 天，等待期早期那几天会在补发之前就被 `pruneDays` 裁掉，
 * 「恢复后一起上传」就补不全。45 天 = 20 天等待 + 余量。
 *
 * 代价只有账本文件变大（一天一个 bucket，45 天也就几十 KB 到一两百 KB）。
 */
export const KEEP_DAYS = 45;

/** 一次上报最多带几天：服务端单次请求的体积上限，补发积压时分多轮走 */
export const PENDING_MAX_DAYS = 7;

export const TICK_MS = 60_000;

/**
 * 上线心跳已删除（2026-11-22，用户拍板）。
 *
 * 原心跳每 2 分钟一次、每次两组文档各「POST 撞 409 → PATCH」= 4 次写；403 台设备
 * 一天就是 116 万次、一月 3500 万次，把 Appwrite 的写入额度直接写爆（402）。
 * 它产出两样东西：`lastSeen` 和 `presence` 集合——后者的读取方为零，前者日汇总
 * 本来就会写。所以整条链路停掉，只留日汇总一条上报路径。
 */
export const UPLOAD_FIRST_DELAY_MS = 20_000;

export const UPLOAD_INTERVAL_MS = 6 * 60 * 60_000;

/**
 * 两次上报之间的最小间隔（跨重启生效）。
 *
 * 日汇总每次都要重发「今天」（水位只认已经过完的日子），而上传计时器是**进程内**的：
 * 用户反复重载插件就会反复发同一份。账本里的 `lastAttemptAt` 是落盘的，用它挡掉
 * 一小时内的重复——一天重启十次也只发一次。
 */
export const MIN_UPLOAD_GAP_MS = 60 * 60_000;

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
  /**
   * 第一次见到这个插件时的版本。空 = 还没记（下次落盘时补上）。
   * 只写一次、绝不覆盖——见 DailyPayload.firstVersion 的说明。
   */
  firstVersion: string;
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

/**
 * 当前档位的成因（2026-11-22）。
 *
 * 「现在是基础版」这一句话底下是四种完全不同的处境，处理方式也完全不同：
 *   none      没填码       → 该引导他买
 *   expired   码到期了     → 该做续费提醒
 *   revoked   码被停用了   → 该查是不是误封，或者盗版在流通
 *   invalid   码验签不过   → 码被改过 / 复制坏了
 *   ok        有码且有效
 *   unknown   这次没探测到
 *
 * 由两个插件自己判定并写进各自的档案（只有它们知道验签结果），bz 只读、不算。
 */
export type TierReason = 'ok' | 'none' | 'expired' | 'revoked' | 'invalid' | 'unknown';

/**
 * 上次激活失败的原因（2026-11-22）。
 *
 * 激活发生在两个插件各自的设置页里，bz 无从得知，只能由它们记一笔。
 * **只记分类，绝不记码原文**——码原文一旦出门就是泄露。
 *
 *   format   格式不对（复制粘贴被截断、多了空格）
 *   invalid  验签不过（码被改过）
 *   offline  拉不到停用名单，要求联网
 *   revoked  这枚码已被停用
 *   expired  码已过期
 *
 * 激活成功一次就清掉，免得几个月前的一次手滑永远挂在身上。
 */
export type ActivateFail = 'format' | 'invalid' | 'offline' | 'revoked' | 'expired';

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
  /**
   * 这枚码是不是已被停用名单判死（2026-11-22）。
   *
   * 这是封码机制唯一的效果证据：封之前几台在用、封之后还剩几台。
   * 剩下的那些就是没升级、断网、或者绕过去的——只看「码号还在上报」
   * 分不出「还在用」和「已经被封了但设备没联网核对」。
   */
  revoked?: boolean;
  /** 被判死的时刻（毫秒）；缺省 = 没被判死过 */
  revokedAt?: number;
  /** 当前档位的成因（没码 / 过期 / 被封 / 码坏了），口径见 TierReason */
  tierReason?: TierReason;
  /** 上次激活失败的原因；激活成功过就清掉，缺省 = 没失败过 */
  activateFail?: ActivateFail;
  /** 上次激活失败的时刻（毫秒） */
  activateFailAt?: number;
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
  /** 口径同 ReaderSnapshot.revoked */
  revoked?: boolean;
  /** 口径同 ReaderSnapshot.revokedAt */
  revokedAt?: number;
  /** 口径同 ReaderSnapshot.tierReason */
  tierReason?: TierReason;
  /** 口径同 ReaderSnapshot.activateFail */
  activateFail?: ActivateFail;
  /** 口径同 ReaderSnapshot.activateFailAt */
  activateFailAt?: number;
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
  /**
   * 第一次见到这个插件时的版本（2026-11-22）。
   *
   * 只写一次、之后绝不覆盖。只记「当前版本」的话，发一次版所有人都变成新版本，
   * 「老用户还剩多少」「升级断在哪一版」就永远看不出来了。
   */
  firstVersion?: string;
  days: DayBucket[];
}

export function emptyLedger(now: number): Ledger {
  return {
    schema: USAGE_SCHEMA,
    createdAt: now,
    sinceDay: '',
    firstVersion: '',
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
