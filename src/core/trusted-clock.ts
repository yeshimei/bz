/* ============================================================
 * 可信时间（src/core/trusted-clock.ts）
 *
 * bz 自己不卖授权，但会读 bz Reader / bz Review 写下的激活码判档位
 * （`bookshelf/reader-tier`，档位进作者看板）。判「过期没有」不能直接
 * 用系统时钟——用户把时间往回拨，过期码在看板里会一直算成「付费在用」。
 *
 * 这里记住每次见过的最晚时刻（高水位），判档用「高水位与当前时间的
 * 较大者」。与两个插件各自的 data/trusted-clock 同构，键名独立。
 *
 * 只落 localStorage：bz 是读取方，不是授权方，看板统计错一格不影响
 * 用户实际能不能用；真正挡绕过的那道门在两个插件自己的授权链路里。
 * ============================================================ */

/** 本地存储键。带版本号：将来换结构时老状态自动作废 */
export const CLOCK_STORAGE_KEY = 'bz:clock:v1';

/**
 * 容差：系统时间小幅回拨不算异常。
 * NTP 校时、时区切换、虚拟机恢复快照通常都在几分钟内；30 分钟足够宽，
 * 又远小于「把时间拨回去年」这种绕过。
 */
export const CLOCK_TOLERANCE_MS = 30 * 60 * 1000;

export interface ClockState {
  /** 见过的最大可信时间（毫秒）。只增不减 */
  seenAt: number;
  /** 最近一次拿到的服务器时间（毫秒） */
  serverAt: number;
  /** 拿到服务器时间那一刻的本地时间（毫秒） */
  serverLocalAt: number;
  /** 最近一次判定「本地时间明显落后」的时刻（0 = 没判过） */
  suspectAt: number;
}

export const EMPTY_CLOCK: ClockState = { seenAt: 0, serverAt: 0, serverLocalAt: 0, suspectAt: 0 };

export interface ClockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let storage: ClockStorage | null = null;
let cache: ClockState = { ...EMPTY_CLOCK };
let loaded = false;
let lastPersistAt = 0;

/** 进程内落盘节流：高水位前进不足一分钟时不重复写 */
const PERSIST_GAP_MS = 60 * 1000;

function activeStorage(): ClockStorage | null {
  if (storage) return storage;
  try {
    const ls = (globalThis as { localStorage?: ClockStorage }).localStorage;
    return ls && typeof ls.getItem === 'function' ? ls : null;
  } catch {
    return null;
  }
}

function ms(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

function load(): ClockState {
  if (loaded) return cache;
  loaded = true;
  const state: ClockState = { ...EMPTY_CLOCK };
  try {
    const raw = activeStorage()?.getItem(CLOCK_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ClockState> | null;
      if (p && typeof p === 'object') {
        state.seenAt = ms(p.seenAt);
        state.serverAt = ms(p.serverAt);
        state.serverLocalAt = ms(p.serverLocalAt);
        state.suspectAt = ms(p.suspectAt);
      }
    }
  } catch {
    /* 坏 JSON 当没记录：宁可少一层防护，也不能让看板计算抛错 */
  }
  cache = state;
  return cache;
}

function save(): void {
  try {
    activeStorage()?.setItem(CLOCK_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* 存不下不影响本次会话 */
  }
}

/** 换存储后端（测试隔离）；传 null 退回「先看注入、再看 globalThis.localStorage」 */
export function setClockStorage(s: ClockStorage | null): void {
  storage = s;
  cache = { ...EMPTY_CLOCK };
  loaded = false;
  lastPersistAt = 0;
}

export function _resetClockForTests(): void {
  cache = { ...EMPTY_CLOCK };
  loaded = true;
  lastPersistAt = 0;
  try {
    activeStorage()?.removeItem(CLOCK_STORAGE_KEY);
  } catch {
    /* 测试清理失败不影响断言 */
  }
}

/** 从别处灌入高水位。只增：旧备份不能把更晚的记录拉回去 */
export function seedClock(seenAt: number): void {
  const v = ms(seenAt);
  if (!v) return;
  const s = load();
  if (v > s.seenAt) {
    s.seenAt = v;
    save();
  }
}

/** 记一次「此刻我在」 */
export function noteSeen(now: number): void {
  const v = ms(now);
  if (!v) return;
  const s = load();
  if (v > s.seenAt) {
    s.seenAt = v;
    save();
    lastPersistAt = Date.now();
  }
}

/**
 * 判断到期时该用的「现在」：系统时间正常时就是当前时间，被往回拨过
 * 就是高水位。只增不减——「调快再调回」洗不掉记录。
 */
export function trustedNow(localNow = Date.now()): number {
  const now = ms(localNow) || Date.now();
  const s = load();
  if (now > s.seenAt) {
    s.seenAt = now;
    if (now - lastPersistAt >= PERSIST_GAP_MS) {
      save();
      lastPersistAt = now;
    }
  }
  return Math.max(now, s.seenAt);
}

/** 记一次服务器时间（响应头的 Date）：只把高水位往上顶，不往下拉 */
export function noteServerTime(serverNow: number, localNow: number): void {
  const real = ms(serverNow);
  if (!real) return;
  const local = ms(localNow) || Date.now();
  const s = load();
  s.serverAt = real;
  s.serverLocalAt = local;
  if (real - local > CLOCK_TOLERANCE_MS) s.suspectAt = local;
  if (real > s.seenAt) s.seenAt = real;
  save();
  lastPersistAt = Date.now();
}

/** 从 HTTP 响应头取服务器时间；大小写都认，拿不到什么都不做 */
export function noteServerDateHeader(headers: unknown, localNow = Date.now()): void {
  if (!headers || typeof headers !== 'object') return;
  let raw = '';
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    if (key.toLowerCase() !== 'date') continue;
    const v = (headers as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) raw = v.trim();
  }
  if (!raw) return;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed) && parsed > 0) noteServerTime(parsed, localNow);
}

/** 本地时间是否明显落后于「见过的最晚时刻」。只用于排查，不参与门控 */
export function clockSuspect(localNow = Date.now()): boolean {
  const s = load();
  if (!s.seenAt) return false;
  return localNow + CLOCK_TOLERANCE_MS < s.seenAt;
}

/** 当前高水位（毫秒，0 = 从没记过） */
export function clockSeenAt(): number {
  return load().seenAt;
}

/** 当前完整状态（测试与排查用，只读副本） */
export function clockState(): ClockState {
  return { ...load() };
}
