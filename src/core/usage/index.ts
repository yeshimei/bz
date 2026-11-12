import { Platform, requestUrl } from 'obsidian';
import { getApp } from '../app';
import { enqueueFileTask, jsonFileStore, storageFile } from '../storage';
import { createUsage, type UsageHandle } from './collect';
import { USAGE_API_KEY, USAGE_BASE_URL, usageConfigured } from './config';
import {
  USAGE_FILE,
  emptyLedger,
  type DailyPayload,
  type Ledger,
  type PingPayload,
  type UsageMeta,
} from './types';

const INSTALL_KEY = 'bz.usage.installId';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let handle: UsageHandle | null = null;
let cachedInstallId = '';
let cachedMeta: UsageMeta | null = null;
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
  if (Platform.isWin) return 'win32';
  if (Platform.isMacOS) return 'darwin';
  if (Platform.isLinux) return 'linux';
  if (Platform.isIosApp) return 'ios';
  if (Platform.isAndroidApp) return 'android';
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

function metaOf(pluginVersion: string): UsageMeta {
  if (cachedMeta) return cachedMeta;
  const app = getApp() as unknown as AppRuntimeInfo;
  cachedMeta = {
    installId: installId(),
    pluginVersion: String(pluginVersion || '').slice(0, 32),
    obsidianVersion: String(app.appVersion || app.version || '').slice(0, 32),
    platform: platformName(),
    isMobile: !!Platform.isMobile,
    tz: timeZone(),
    locale: localeName(),
  };
  return cachedMeta;
}

function ledgerStore() {
  return jsonFileStore<Ledger>(ledgerPath, { defaultValue: () => emptyLedger(Date.now()) });
}

async function rpc(name: string, payload: DailyPayload | PingPayload): Promise<boolean> {
  if (!usageConfigured()) return false;
  try {
    const base = USAGE_BASE_URL.trim().replace(/\/+$/, '');
    const key = USAGE_API_KEY.trim();
    const resp = await requestUrl({
      url: `${base}/rest/v1/rpc/${name}`,
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p: payload }),
      throw: false,
    });
    return resp.status >= 200 && resp.status < 300;
  } catch {
    return false;
  }
}

export function initUsage(manifestVersion: string): void {
  if (handle) return;
  ledgerPath = storageFile(USAGE_FILE);
  const store = ledgerStore();

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
    sendDaily: (payload: DailyPayload) => rpc('bz_sync', payload),
    sendPing: (payload: PingPayload) => rpc('bz_ping', payload),
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
  if (cur) await cur.stop();
}
