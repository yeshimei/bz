/* ============================================================
 * bz · 在线赞赏名单（core/patron-list.ts）
 *
 * 2026-11-11 起名单**不在代码里**：bz 与 bz Reader 共用主仓 `docs/patrons.json`
 * 这一份公开数据。改名单只改那个文件、推一次，不用再发两版。
 * （bz Reader 对应实现：`bz-reader/src/data/patrons.ts`，两边的解析规则必须一致，
 *  格式说明见 `docs/patrons.md`。）
 *
 * 数据从两个地址并发取（谁先回、内容合法就用谁）：
 *   · GitHub raw —— 主源；
 *   · 码云 raw   —— 国内直连。**没有跨域头**，只能走 requestUrl（core/http 已封装）。
 * 单请求 8 秒封顶；URL 带 `?t=` 绕 CDN 缓存（GitHub 5 分钟、码云 60 秒）。
 *
 * 三层兜底：内存 → 本机 localStorage（先显示旧名单，后台再校验）→ 空态 + 重试。
 * 远端坏了**不覆盖**已有好数据：一次网络故障不该把所有人的支持者名单清空。
 *
 * 与旧实现的差别：以前 `REWARD_NAMES` 是同步常量，更新日志页脚的 `+人数` 角标
 * 直接读 length；现在名单是异步来的，角标要等拉到之后原地补上（见 changelog-links）。
 * ============================================================ */
import { httpGetText, requestUrlAsFetch } from './http';
import type { RewardName } from './reward-names';

/** 与 reward-names 的类型同一份：amount 只认数字或 'patron' */
export type Patron = RewardName;

/** 注 HTTP 通道：返回正文；null = 这条通道失败（超时 / 非 2xx / 网络错） */
export type PatronHttp = (url: string, timeoutMs: number) => Promise<string | null>;

/** 两个源：同一个文件、两份内容。顺序只是「先发谁」，不是优先级 */
export const PATRON_URLS: readonly string[] = [
  'https://raw.githubusercontent.com/yeshimei/bz/master/docs/patrons.json',
  'https://gitee.com/ntbl/bz/raw/master/docs/patrons.json',
];

/** 本机缓存键。带版本号：将来换结构时老缓存自动作废 */
export const PATRON_CACHE_KEY = 'bz:patrons:v1';

/** 两次自动拉取的最小间隔（打开赞赏窗、更新日志都会触发） */
export const PATRON_REFRESH_GAP_MS = 60 * 1000;

const CACHE_VERSION = 1;
const FETCH_TIMEOUT_MS = 8000;
const MAX_PATRONS = 500;
const MAX_NAME = 40;
const MAX_MESSAGE = 120;
const MAX_AMOUNT = 99999;

/** idle = 从没拉过；loading = 正在拉；ready = 有数据（含合法空名单）；failed = 拉了但没拿到 */
export type PatronsStatus = 'idle' | 'loading' | 'ready' | 'failed';

const EMPTY: readonly Patron[] = Object.freeze([]);

let memory: { list: Patron[]; at: number } | null = null;
let cacheRead = false;
let status: PatronsStatus = 'idle';
let lastAttempt = 0;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<(list: readonly Patron[]) => void>();

const httpImpl = requestUrlAsFetch();

/** 生产通道：core/http 的 httpGetText（requestUrl + 超时，失败归 null） */
function requestText(url: string, timeoutMs: number): Promise<string | null> {
  return httpGetText(url, { timeoutMs, fetchImpl: httpImpl });
}

/** `?t=` 破缓存：两个域名各自缓存，参数换一个就是新 URL，回源 */
function bust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

/* ── 解析 ─────────────────────────────────────────────────── */

function cleanText(v: string): string {
  return v
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `YYYY-MM-DD`，且是真实存在的日子（2026-13-01、2026-02-30 都不算） */
function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * 一条远端记录 → 一条名单记录；任何字段不对就丢这一条。
 *
 * 昵称超长**整条丢**而不是截断：名字被切一半比不显示更失礼。留言超长截断
 * 无所谓——它本来就可能是一长句，截在 120 字仍然读得通。
 */
export function normalizePatron(raw: unknown): Patron | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.name !== 'string') return null;
  const rawName = o.name.trim();
  if (!rawName || rawName.length > MAX_NAME) return null;
  const name = cleanText(rawName);
  if (!name) return null;

  let amount: number | 'patron';
  if (typeof o.amount === 'number') {
    if (!Number.isFinite(o.amount) || o.amount <= 0 || o.amount > MAX_AMOUNT) return null;
    amount = Math.round(o.amount * 100) / 100;
  } else if (typeof o.amount === 'string' && o.amount.trim().toLowerCase() === 'patron') {
    amount = 'patron';
  } else {
    /* 字符串数字（"12"）故意不收：手改 JSON 时最容易把数字写成字符串 */
    return null;
  }

  const date = typeof o.date === 'string' ? o.date.trim() : '';
  if (!isIsoDate(date)) return null;

  let message: string | undefined;
  if (typeof o.message === 'string') {
    const m = cleanText(o.message).slice(0, MAX_MESSAGE);
    if (m) message = m;
  }

  const out: Patron = { name, amount, date };
  if (message) out.message = message;
  return out;
}

/** 时间倒序；同日保持文件里的先后（新记的排在文件前面，所以显示时也新在前） */
function sortPatrons(list: Patron[]): Patron[] {
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * 整份远端 JSON → 名单；`null` = 这份内容不可用（换下一个源 / 保留旧数据）。
 * 空数组合法；「每条都坏」视为格式不对，不是空名单。
 */
export function parsePatrons(raw: unknown): Patron[] | null {
  let doc: unknown = raw;
  if (typeof raw === 'string') {
    try {
      doc = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const list = (doc as { patrons?: unknown }).patrons;
  if (!Array.isArray(list)) return null;

  const out: Patron[] = [];
  for (const item of list) {
    if (out.length >= MAX_PATRONS) break;
    const p = normalizePatron(item);
    if (p) out.push(p);
  }
  if (list.length > 0 && out.length === 0) return null;
  return sortPatrons(out);
}

/* ── 缓存 ─────────────────────────────────────────────────── */

interface CacheDoc {
  v: number;
  at: number;
  list: Patron[];
}

function readCache(): { list: Patron[]; at: number } | null {
  try {
    const raw = window.localStorage.getItem(PATRON_CACHE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as Partial<CacheDoc> | null;
    if (!doc || doc.v !== CACHE_VERSION || !Array.isArray(doc.list)) return null;
    const at = typeof doc.at === 'number' && Number.isFinite(doc.at) ? doc.at : 0;
    const list: Patron[] = [];
    for (const it of doc.list) {
      const p = normalizePatron(it);
      if (p) list.push(p);
    }
    if (doc.list.length > 0 && list.length === 0) return null;
    return { list: sortPatrons(list), at };
  } catch {
    return null;
  }
}

function writeCache(v: { list: Patron[]; at: number }): void {
  try {
    window.localStorage.setItem(
      PATRON_CACHE_KEY,
      JSON.stringify({ v: CACHE_VERSION, at: v.at, list: v.list } satisfies CacheDoc),
    );
  } catch {
    /* 隐私模式 / 配额满：本次会话内存里还有 */
  }
}

function ensureCacheLoaded(): void {
  if (cacheRead) return;
  cacheRead = true;
  const c = readCache();
  if (c) {
    memory = c;
    status = 'ready';
  }
}

/* ── 对外 ─────────────────────────────────────────────────── */

/** 当前名单（同步、随时可调）。没有就是空数组 */
export function currentPatrons(): readonly Patron[] {
  ensureCacheLoaded();
  return memory ? memory.list : EMPTY;
}

/** 这份名单的拉取时间（0 = 从没成功过） */
export function patronsFetchedAt(): number {
  ensureCacheLoaded();
  return memory ? memory.at : 0;
}

/** 给 UI 判断「空态该写什么」：加载中 / 没拉到 / 真的没人 */
export function patronsStatus(): PatronsStatus {
  ensureCacheLoaded();
  return status;
}

/** 订阅名单变化；返回退订函数。弹窗关掉时要退 */
export function onPatronsChange(fn: (list: readonly Patron[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  const list = memory ? memory.list : EMPTY;
  for (const fn of [...listeners]) {
    try {
      fn(list);
    } catch {
      /* 一个订阅者抛错不该挡住其余订阅者 */
    }
  }
}

/** 两个源并发，第一个「合法」的结果胜出；都失败 → null */
async function fetchFirstValid(): Promise<Patron[] | null> {
  const urls = PATRON_URLS.map(bust);
  return new Promise((resolve) => {
    let pending = urls.length;
    let settled = false;
    for (const url of urls) {
      Promise.resolve()
        .then(() => http(url, FETCH_TIMEOUT_MS))
        .then((text) => {
          if (settled || text == null) return;
          const list = parsePatrons(text);
          if (!list) return;
          settled = true;
          resolve(list);
        })
        .catch(() => undefined)
        .finally(() => {
          pending -= 1;
          if (pending === 0 && !settled) {
            settled = true;
            resolve(null);
          }
        });
    }
  });
}

/**
 * 拉一次。`force` 只给「手动重试」用——默认 60 秒内不重复请求。
 * 返回「这次有没有拿到新内容」；false 不代表名单不可用（可能是节流或旧数据还在）。
 */
export async function refreshPatrons(opts: { force?: boolean } = {}): Promise<boolean> {
  ensureCacheLoaded();
  if (inflight) return inflight;

  const now = Date.now();
  if (!opts.force && now - lastAttempt < PATRON_REFRESH_GAP_MS) return false;
  lastAttempt = now;

  if (!memory) status = 'loading';

  inflight = (async () => {
    try {
      const list = await fetchFirstValid();
      if (!list) {
        if (!memory) {
          status = 'failed';
          notify();
        }
        return false;
      }
      memory = { list, at: Date.now() };
      status = 'ready';
      writeCache(memory);
      notify();
      return true;
    } catch {
      if (!memory) {
        status = 'failed';
        notify();
      }
      return false;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

let http: PatronHttp = requestText;

/* ── 测试 ─────────────────────────────────────────────────── */

/** 清空会话状态（**不动** localStorage：缓存恢复的用例要用它） */
export function _resetPatronsForTests(): void {
  memory = null;
  cacheRead = false;
  status = 'idle';
  lastAttempt = 0;
  inflight = null;
  listeners.clear();
  http = requestText;
}

/** 换掉 HTTP 通道（传 null 恢复生产实现） */
export function _setPatronsHttpForTests(fn: PatronHttp | null): void {
  http = fn || requestText;
}
