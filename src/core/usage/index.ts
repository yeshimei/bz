import { Platform, requestUrl } from 'obsidian';
import { getApp } from '../app';
import { enqueueFileTask, jsonFileStore, storageFile } from '../storage';
import { createUsage, type UsageHandle } from './collect';
import { USAGE_BASE_URL, USAGE_DB, USAGE_PROJECT, usageConfigured } from './config';
import {
  usageFileName,
  emptyLedger,
  type DailyPayload,
  type Ledger,
  type PingPayload,
  type ReaderSnapshot,
  type UsageMeta,
} from './types';

const INSTALL_KEY = 'bz.usage.installId';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READER_FIRST_DELAY_MS = 45_000;
const READER_REFRESH_MS = 6 * 60 * 60_000;

let handle: UsageHandle | null = null;
let cachedInstallId = '';
let cachedMeta: UsageMeta | null = null;
let readerSnapshot: ReaderSnapshot | null = null;
let flagsGetter: (() => { guideDone: boolean; updateAuto: boolean }) | null = null;
let readerFirstTimer = 0;
let readerTimer = 0;
let ledgerPath = '';

interface RandomUuidCrypto {
  randomUUID?: () => string;
}

/** Obsidian 的 App 上有版本号，但公开类型里没有这两个字段（只有运行时存在）。 */
interface AppRuntimeInfo {
  appVersion?: string;
  version?: string;
}

function newInstallId(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : null) as RandomUuidCrypto | null;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = (n: number): string => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, '0');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

function installId(): string {
  if (cachedInstallId) return cachedInstallId;
  try {
    const cur = localStorage.getItem(INSTALL_KEY);
    if (cur && UUID_RE.test(cur)) {
      cachedInstallId = cur;
      return cur;
    }
  } catch {
    /* 无 localStorage 的宿主：本次会话用临时号 */
  }
  const id = newInstallId();
  try {
    localStorage.setItem(INSTALL_KEY, id);
  } catch {
    /* 同上 */
  }
  cachedInstallId = id;
  return id;
}

function platformName(): string {
  // 移动端先判：安卓底层就是 Linux，Platform.isLinux 在手机上也是 true，
  // 反过来写会把所有安卓机记成 linux。
  if (Platform.isIosApp) return 'ios';
  if (Platform.isAndroidApp) return 'android';
  if (Platform.isWin) return 'win32';
  if (Platform.isMacOS) return 'darwin';
  if (Platform.isLinux) return 'linux';
  return 'unknown';
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

function localeName(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc) return loc.slice(0, 24);
  } catch {
    /* 继续往下退 */
  }
  try {
    return typeof navigator !== 'undefined' ? String(navigator.language || '').slice(0, 24) : '';
  } catch {
    return '';
  }
}

/** Obsidian 版本挂在哪儿没有公开契约，几个已知的挂法都试一遍，取第一个像样的。 */
function obsidianVersionOf(app: AppRuntimeInfo): string {
  let ua = '';
  try {
    ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  } catch {
    ua = '';
  }
  const fromUa = /obsidian\/(\d+(?:\.\d+)+)/i.exec(ua)?.[1] || '';
  const winApp = typeof window !== 'undefined' ? (window as unknown as { app?: AppRuntimeInfo }).app : undefined;
  const candidates = [app.appVersion, app.version, winApp?.appVersion, winApp?.version, fromUa];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 32);
  }
  return '';
}

function metaOf(pluginVersion: string): UsageMeta {
  if (!cachedMeta) {
    const app = getApp() as unknown as AppRuntimeInfo;
    cachedMeta = {
      installId: installId(),
      pluginVersion: String(pluginVersion || '').slice(0, 32),
      obsidianVersion: obsidianVersionOf(app),
      platform: platformName(),
      isMobile: !!Platform.isMobile,
      tz: timeZone(),
      locale: localeName(),
    };
  }
  const out: UsageMeta = { ...cachedMeta };
  if (readerSnapshot) out.reader = readerSnapshot;
  // 每次发送前现读：用户中途改了自动更新开关，不用等下次重启才反映
  if (flagsGetter) {
    try {
      const flags = flagsGetter();
      out.guideDone = flags.guideDone;
      out.updateAuto = flags.updateAuto;
    } catch {
      /* 读不到就不带这两项 */
    }
  }
  return out;
}

function ledgerStore() {
  return jsonFileStore<Ledger>(ledgerPath, { defaultValue: () => emptyLedger(Date.now()) });
}

function isoOf(ms: number): string {
  return new Date(Number.isFinite(ms) && ms > 0 ? ms : Date.now()).toISOString();
}

/** Appwrite 的 documentId 上限 36 字符：设备号去横线取前 12 位 + 库标识 + 日期 */
function dayDocId(installId: string, vaultId: string, date: string): string {
  return `${installId.replace(/-/g, '').slice(0, 12)}-${vaultId}-${date}`;
}

let cachedVaultId = '';

/** 同库稳定、跨库不同、不可逆：库名 + 库路径做个 FNV 哈希，只发送这 8 位 */
function vaultIdOf(app: unknown): string {
  if (cachedVaultId) return cachedVaultId;
  const a = app as {
    vault?: { getName?: () => string; adapter?: { getBasePath?: () => string } };
  };
  let name = '';
  let base = '';
  try {
    name = String(a?.vault?.getName?.() || '');
  } catch {
    name = '';
  }
  try {
    base = String(a?.vault?.adapter?.getBasePath?.() || '');
  } catch {
    base = '';
  }
  const src = `${name}|${base}`;
  let h = 2166136261;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  cachedVaultId = (h >>> 0).toString(16).padStart(8, '0');
  return cachedVaultId;
}

async function api(method: string, path: string, body?: unknown): Promise<number> {
  if (!usageConfigured()) {
    console.warn('[bz] usage: 端点未配置');
    return 0;
  }
  try {
    const base = USAGE_BASE_URL.trim().replace(/\/+$/, '');
    const resp = await requestUrl({
      url: `${base}${path}`,
      method,
      headers: {
        'X-Appwrite-Project': USAGE_PROJECT.trim(),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });
    if (resp.status < 200 || resp.status >= 300) {
      console.warn('[bz] usage api', method, path, resp.status, String(resp.text || '').slice(0, 300));
    }
    return resp.status;
  } catch (e) {
    console.warn('[bz] usage api failed', method, path, (e as Error)?.message || e);
    return 0;
  }
}

/** 先建，已存在（409）再改：两条路各自一次请求，避开「改不存在文档」在某些环境下不返回 404 的情况 */
async function upsert(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  createExtra?: Record<string, unknown>,
): Promise<boolean> {
  const base = `/databases/${USAGE_DB}/collections/${collection}/documents`;
  const created = await api('POST', base, {
    documentId: docId,
    data: { ...data, ...(createExtra || {}) },
  });
  if (created >= 200 && created < 300) return true;
  if (created !== 409) return false;
  const patched = await api('PATCH', `${base}/${docId}`, { data });
  return patched >= 200 && patched < 300;
}

function readerFields(reader?: ReaderSnapshot): Record<string, unknown> {
  if (!reader) return {};
  return {
    readerState: reader.state,
    readerVersion: reader.version,
    readerMinutes: reader.minutes,
    readerDaysSince: reader.daysSince,
  };
}

function flagFields(payload: PingPayload | DailyPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (payload.guideDone !== undefined) out.guideDone = payload.guideDone;
  if (payload.updateAuto !== undefined) out.updateAuto = payload.updateAuto;
  return out;
}

function installFields(payload: PingPayload | DailyPayload, at: string): Record<string, unknown> {
  return {
    lastSeen: at,
    pluginVersion: payload.pluginVersion,
    obsidianVersion: payload.obsidianVersion,
    platform: payload.platform,
    isMobile: payload.isMobile,
    tz: payload.tz,
    locale: payload.locale,
    ...readerFields(payload.reader),
    ...flagFields(payload),
  };
}

async function sendPing(payload: PingPayload): Promise<boolean> {
  const at = isoOf(payload.at);
  const ok = await upsert('installs', payload.installId, installFields(payload, at), {
    installId: payload.installId,
    firstSeen: at,
  });
  await upsert(
    'presence',
    payload.installId,
    {
      lastSeen: at,
      pluginVersion: payload.pluginVersion,
      platform: payload.platform,
      isMobile: payload.isMobile,
    },
    { installId: payload.installId },
  );
  return ok;
}

async function sendDaily(payload: DailyPayload): Promise<boolean> {
  const at = isoOf(Date.now());
  const vault = vaultIdOf(getApp());
  let ok = await upsert('installs', payload.installId, installFields(payload, at), {
    installId: payload.installId,
    firstSeen: at,
  });
  for (const day of payload.days) {
    const saved = await upsert('dailies', dayDocId(payload.installId, vault, day.date), {
      installId: payload.installId,
      vaultId: vault,
      day: day.date,
      sessions: day.sessions,
      activeMinutes: day.activeMinutes,
      hourMinutes: JSON.stringify(day.hourMinutes || []),
      commands: JSON.stringify(day.commands || {}),
      domains: JSON.stringify(day.domains || {}),
      firstAt: day.firstAt ?? 0,
      lastAt: day.lastAt ?? 0,
      pluginVersion: payload.pluginVersion,
      platform: payload.platform,
      updatedAt: at,
    });
    if (!saved) ok = false;
  }
  return ok;
}

export interface UsageInitOptions {
  /** bz 阅读的使用快照；取不到就别传（那头没装或不归这次记录） */
  reader?: () => Promise<ReaderSnapshot>;
  /** 首用引导完成与自动更新开关（首启读一次，之后不追） */
  flags?: () => { guideDone: boolean; updateAuto: boolean };
}

export function initUsage(manifestVersion: string, opts?: UsageInitOptions): void {
  if (handle) return;
  ledgerPath = storageFile(usageFileName(installId()));
  const store = ledgerStore();

  if (opts?.flags) flagsGetter = opts.flags;

  if (opts?.reader) {
    const probe = opts.reader;
    // 读整份阅读数据是同步解析大 JSON，挑浏览器空闲时做，别卡用户手头的操作
    const idle = (fn: () => void): void => {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 5_000 });
      else window.setTimeout(fn, 0);
    };
    const refresh = async (): Promise<void> => {
      try {
        const snap = await probe();
        if (snap) readerSnapshot = snap;
      } catch {
        // 探测失败不沿用旧值：宁可这一版显示「未知」，也不拿旧数字冒充当前状态
        readerSnapshot = { state: 'unknown', version: '', minutes: 0, daysSince: -1 };
      }
    };
    readerFirstTimer = window.setTimeout(() => idle(() => void refresh()), READER_FIRST_DELAY_MS);
    readerTimer = window.setInterval(() => idle(() => void refresh()), READER_REFRESH_MS);
  }

  handle = createUsage({
    now: () => Date.now(),
    visible: () => {
      try {
        return typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true;
      } catch {
        return true;
      }
    },
    enabled: () => usageConfigured(),
    load: async () => {
      try {
        return await store.read();
      } catch {
        return null;
      }
    },
    save: (ledger: Ledger) => enqueueFileTask(ledgerPath, () => store.write(ledger)),
    sendDaily: (payload: DailyPayload) => sendDaily(payload),
    sendPing: (payload: PingPayload) => sendPing(payload),
    meta: () => metaOf(manifestVersion),
    warn: (msg: string, err?: unknown) => console.warn(`[bz] ${msg}`, err ?? ''),
    setInterval: (fn: () => void, ms: number) => window.setInterval(fn, ms),
    clearInterval: (id: number) => window.clearInterval(id),
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimeout: (id: number) => window.clearTimeout(id),
  });
}

export function trackCommand(commandId: string): void {
  handle?.trackCommand(commandId);
}

export async function disposeUsage(): Promise<void> {
  const cur = handle;
  handle = null;
  if (readerFirstTimer) window.clearTimeout(readerFirstTimer);
  if (readerTimer) window.clearInterval(readerTimer);
  readerFirstTimer = 0;
  readerTimer = 0;
  if (cur) await cur.stop();
}
