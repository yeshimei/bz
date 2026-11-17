/* ============================================================
 * bz-reader · 在线配置（src/data/bzr-data.ts）
 *
 * 2026-11-18 起，更新日志 / 路线图 / 统计 / 跳转地址都从**在线**拿，
 * 本地缓存。两处数据源（GitHub raw / 码云 raw）并发，谁先回合法内容
 * 就用谁；和感谢名单（data/patrons.ts）同一套机制，只是数据更多。
 *
 * 三层兜底，顺序是「先能看见，再求新」：
 *   1. 内存（本会话已拿到 / 从缓存恢复）
 *   2. 内置 BUILTIN（固件里那份，离线也有得看）
 *   3. 远端（双源并发，第一个合法结果胜出）
 * 坏数据不覆盖好数据：远端全挂 / 解析失败时，保留当前内存与缓存。
 *
 * 远端一律不信任：字段类型逐个校验，坏条目丢掉；链接走白名单，
 * 不合法的地址不渲染成可点链接（渲染层只用 safeFeedbackUrl 的结果）。
 * ============================================================ */
import { requestUrl } from 'obsidian';
/* bz 主仓没有 data/reward 模块：内置兜底直接用与 bzr-data.json 同一家店铺地址，
   真实链接以远端数据为准，这里只是离线占位。 */
const SPONSOR_URL = 'https://wzyp.cn/shop/IFCEI5I3';

/* ── 类型 ─────────────────────────────────────────────────── */

export interface BzrL10n {
  zh: string;
  en: string;
}

export interface BzrChangelogEntry {
  domain: BzrL10n;
  text: BzrL10n;
  /** 对应的 GitHub issue；有值时日志正文尾部挂一个 #N 链接 */
  issue?: number;
}

export interface BzrChangelogRelease {
  version: string;
  date?: string;
  added?: BzrChangelogEntry[];
  improved?: BzrChangelogEntry[];
  fixed?: BzrChangelogEntry[];
}

export type RoadmapState = 'plan' | 'doing' | 'done';
export type FeedbackKind = 'issue' | 'bili' | 'qq' | 'afdian';

export interface RoadmapFeedback {
  kind: FeedbackKind;
  /** kind=issue 时的编号 */
  n?: number;
  label: string;
  /** 非 issue 类反馈的落地页；渲染前必须过 safeFeedbackUrl */
  href: string;
}

export interface RoadmapItem {
  title: string;
  state: RoadmapState;
  src: 'builtin' | 'github';
  fb: RoadmapFeedback;
}

export interface RoadmapTheme {
  theme: string;
  color: string;
  order: number;
  items: RoadmapItem[];
}

/** 反馈来源：五条渠道，一一对应 skill 的判源口径 */
export type FeedbackSource =
  | 'github-issue'
  | 'qq-group'
  | 'qq-channel'
  | 'qq-friend'
  | 'bili-dm';

/** 反馈五态：采纳 / 否决 / 不成立 / 已完成 / 进行中 */
export type FeedbackState = 'accepted' | 'rejected' | 'invalid' | 'done' | 'doing';

/** 一条用户反馈；state 优先，日期只作展示（老数据无 state 时按日期推导） */
export interface BzrFeedback {
  id: string;
  source: FeedbackSource;
  summary: string;
  title: string;
  desc: string;
  /** 可空；渲染前必须过 safeFeedbackUrl */
  href: string;
  /** 归属插件：bz / bz-reader，其余值置空 */
  plugin?: string;
  /** 功能域，只有 bz 条目显示（如「日记本」） */
  domain?: string;
  /** 作者（用户本人）在聊天里对这条的回复，逐句原话，可空 */
  reply?: string;
  /** 作者回复的一句话摘要，QQ 频道帖子用；界面不显示 */
  replyDigest?: string;
  /** 核查详情（查了什么、是否属实、修了什么），QQ 频道帖子用 */
  verify?: string;
  /** 五态；老数据 / 手写夹具可能没有，渲染时按日期推导 */
  state?: FeedbackState;
  /** YYYY-MM-DD 或 YYYY-MM-DD HH:mm */
  submittedAt: string;
  /** 空串 = 未完成；YYYY-MM-DD[ HH:mm] = 已完成 */
  doneAt: string;
  /** 空串 / 缺省 = 未否决；YYYY-MM-DD[ HH:mm] = 作者已否决 */
  rejectedAt?: string;
  /** 实现所在仓库：bz / bz-reader；空 = 未进 Git 历史 */
  commitRepo?: string;
  /** 8 位十六进制短 id；空 = 没提交 */
  commitId?: string;
  /** 提交日期 YYYY-MM-DD HH:mm；空 = 没提交 */
  commitDate?: string;
  /** 已发布版本号，如 1.44.5；state=done 时界面显示 */
  releaseVersion?: string;
}

/** 固定两组：bug（问题反馈）/ feature（功能建议） */
export interface BzrFeedbackGroup {
  key: 'bug' | 'feature';
  items: BzrFeedback[];
}

export interface BzrStats {
  /** 打赏次数 */
  reward: number;
  pro: number;
  patrons: number;
}

export interface BzrLinks {
  /** 赞助跳转地址 */
  support: string;
  /** 购买激活码跳转地址 */
  buy: string;
}

export interface BzrData {
  version: number;
  updatedAt: string;
  changelog: BzrChangelogRelease[];
  roadmap: RoadmapTheme[];
  /** 用户反馈两组；老数据 / 老缓存可能没有，读时按空组兜底 */
  feedback?: BzrFeedbackGroup[];
  stats: BzrStats;
  links: BzrLinks;
}

/* ── 常量 ─────────────────────────────────────────────────── */

/** 数据文件同时放 bz 主仓，和 patrons.json 同一个仓、两条下载通道 */
export const BZR_URLS: readonly string[] = [
  'https://raw.githubusercontent.com/yeshimei/bz/master/docs/bzr-data.json',
  'https://gitee.com/ntbl/bz/raw/master/docs/bzr-data.json',
];
/* bz 与 bz-reader 可能同库安装：各存各的缓存，别共用 key */
export const BZR_CACHE_KEY = 'bz:data:v2';
export const BZR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const BZR_REFRESH_GAP_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
/* 2026-11-18 升到 2：数据语义变了（roadmap 清空、links 换店铺、stats 落真实值），
   旧缓存里的 456 / 1286 / 328 和假路线图必须立刻作废，不能等 6 小时。
   同日升到 3：反馈条目换成五态 + 分钟日期 + 作者回复 + Git 提交链接，老缓存缺这些字段
   会导致新界面全空，必须立刻作废。
   导出给测试用：写缓存那几个用例要按当前版本号拼 doc，别再手写 1。 */
export const BZR_CACHE_VERSION = 4;
const MAX_ITEMS = 200;
const MAX_TEXT = 400;

/** 允许渲染成链接的域名（精确匹配 host，防 github.com.evil.com 这种） */
const FEEDBACK_HOSTS = new Set([
  'github.com', 'www.github.com',
  'afdian.net', 'www.afdian.net',
  /* 链动小铺：高级版 / 赞助人的购买页（2026-11-18 起 links.buy / links.support 都指这里）。
     漏了这个域名 → 两条链接解析为空 → 整份在线数据判定无效，回退内置数据。 */
  'wzyp.cn', 'www.wzyp.cn',
  'bilibili.com', 'www.bilibili.com',
  'qm.qq.com',
]);

export type BzrHttp = (url: string, timeoutMs: number) => Promise<string | null>;

/* ── 链接白名单 ───────────────────────────────────────────── */

/** 合法地址原样返回；不合法（协议 / host 不在白名单）返回 null */
export function safeFeedbackUrl(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return FEEDBACK_HOSTS.has(u.hostname.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ── 解析 ─────────────────────────────────────────────────── */

function clean(s: string, max = MAX_TEXT): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
/** 反馈日期：老数据 YYYY-MM-DD，新数据精确到分钟 YYYY-MM-DD HH:mm */
function isFeedbackDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  return m[4] === undefined || (Number(m[4]) <= 23 && Number(m[5]) <= 59);
}
function l10n(raw: unknown): BzrL10n | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.zh !== 'string' || typeof o.en !== 'string') return null;
  const zh = clean(o.zh), en = clean(o.en);
  return zh && en ? { zh, en } : null;
}
function changelogEntry(raw: unknown): BzrChangelogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const domain = l10n(o.domain), text = l10n(o.text);
  if (!domain || !text) return null;
  const out: BzrChangelogEntry = { domain, text };
  if (typeof o.issue === 'number' && Number.isInteger(o.issue) && o.issue > 0 && o.issue < 1_000_000) {
    out.issue = o.issue;
  }
  return out;
}
function feedback(raw: unknown): RoadmapFeedback | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== 'string' || !clean(o.label)) return null;
  if (o.kind !== 'issue' && o.kind !== 'bili' && o.kind !== 'qq' && o.kind !== 'afdian') return null;
  let n: number | undefined;
  if (o.kind === 'issue') {
    if (typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n <= 0) return null;
    n = o.n;
  }
  let href = '';
  if (o.kind !== 'issue' && typeof o.href === 'string') href = safeFeedbackUrl(o.href) ?? '';
  return { kind: o.kind, label: clean(o.label, 40), href, ...(n ? { n } : {}) };
}

const FEEDBACK_SOURCES = new Set<FeedbackSource>([
  'github-issue', 'qq-group', 'qq-channel', 'qq-friend', 'bili-dm',
]);
const FEEDBACK_STATES = new Set<FeedbackState>([
  'accepted', 'rejected', 'invalid', 'done', 'doing',
]);
const FEEDBACK_KEYS = ['bug', 'feature'] as const;

/** state 显式值优先；老数据没 state 时按 doneAt / rejectedAt 推导 */
function feedbackState(o: Record<string, unknown>, doneAt: string, rejectedAt: string): FeedbackState {
  if (typeof o.state === 'string' && FEEDBACK_STATES.has(o.state as FeedbackState)) {
    return o.state as FeedbackState;
  }
  return rejectedAt ? 'rejected' : doneAt ? 'done' : 'accepted';
}
/** 8 位十六进制短 id 才算合法，其余（javascript: 等）一律置空 */
function cleanCommitId(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return /^[0-9a-f]{8}$/.test(s) ? s : '';
}
function cleanCommitRepo(raw: unknown): string {
  return raw === 'bz' || raw === 'bz-reader' ? raw : '';
}
/** 归属插件只认两个已知值，其余置空（远端数据不可信） */
function cleanPlugin(raw: unknown): string {
  return raw === 'bz' || raw === 'bz-reader' ? raw : '';
}

/** 短 id 拼 GitHub commit 链接；repo 只认两个已知仓库，绝不拼进外部 host */
export function feedbackCommitUrl(it: BzrFeedback): string {
  const repo = cleanCommitRepo(it.commitRepo);
  const id = cleanCommitId(it.commitId);
  return repo && id ? `https://github.com/yeshimei/${repo}/commit/${id}` : '';
}

/** 一条反馈：逐字段校验，坏条目丢掉（不因一条坏丢整组） */
function feedbackEntry(raw: unknown): BzrFeedback | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !clean(o.id, 60)) return null;
  if (typeof o.source !== 'string' || !FEEDBACK_SOURCES.has(o.source as FeedbackSource)) return null;
  if (typeof o.summary !== 'string' || !clean(o.summary)) return null;
  if (typeof o.title !== 'string' || !clean(o.title)) return null;
  const submittedAt = typeof o.submittedAt === 'string' && isFeedbackDate(o.submittedAt) ? o.submittedAt : '';
  if (!submittedAt) return null;
  const doneAt = typeof o.doneAt === 'string' && isFeedbackDate(o.doneAt) ? o.doneAt : '';
  const rejectedAt = typeof o.rejectedAt === 'string' && isFeedbackDate(o.rejectedAt) ? o.rejectedAt : '';
  return {
    id: clean(o.id, 60),
    source: o.source as FeedbackSource,
    summary: clean(o.summary, 80),
    title: clean(o.title, MAX_TEXT),
    desc: typeof o.desc === 'string' ? clean(o.desc, MAX_TEXT) : '',
    href: typeof o.href === 'string' ? (safeFeedbackUrl(o.href) ?? '') : '',
    plugin: cleanPlugin(o.plugin),
    domain: typeof o.domain === 'string' ? clean(o.domain, 40) : '',
    reply: typeof o.reply === 'string' ? clean(o.reply, MAX_TEXT) : '',
    replyDigest: typeof o.replyDigest === 'string' ? clean(o.replyDigest, MAX_TEXT) : '',
    verify: typeof o.verify === 'string' ? clean(o.verify, MAX_TEXT) : '',
    state: feedbackState(o, doneAt, rejectedAt),
    submittedAt,
    doneAt,
    rejectedAt,
    commitRepo: cleanCommitRepo(o.commitRepo),
    commitId: cleanCommitId(o.commitId),
    commitDate: typeof o.commitDate === 'string' && isFeedbackDate(o.commitDate) ? o.commitDate : '',
    releaseVersion: typeof o.releaseVersion === 'string' ? clean(o.releaseVersion, 20) : '',
  };
}

/** 固定两组，缺的补空；每组按提交日期倒序 */
function feedbackGroups(raw: unknown): BzrFeedbackGroup[] {
  const out: BzrFeedbackGroup[] = FEEDBACK_KEYS.map((key) => ({ key, items: [] }));
  if (!Array.isArray(raw)) return out;
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    if (o.key !== 'bug' && o.key !== 'feature') continue;
    const target = out.find((x) => x.key === o.key);
    if (!target) continue;
    const itemsIn = Array.isArray(o.items) ? o.items : [];
    for (const it of itemsIn) {
      if (target.items.length >= MAX_ITEMS) break;
      const v = feedbackEntry(it);
      if (v) target.items.push(v);
    }
  }
  for (const g of out) g.items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return out;
}

function roadmapItem(raw: unknown): RoadmapItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== 'string' || !clean(o.title)) return null;
  if (o.state !== 'plan' && o.state !== 'doing' && o.state !== 'done') return null;
  if (o.src !== 'builtin' && o.src !== 'github') return null;
  const fb = feedback(o.fb);
  if (!fb) return null;
  return { title: clean(o.title, MAX_TEXT), state: o.state, src: o.src, fb };
}
function roadmapTheme(raw: unknown): RoadmapTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.theme !== 'string' || !clean(o.theme)) return null;
  const itemsIn = Array.isArray(o.items) ? o.items : [];
  const items: RoadmapItem[] = [];
  for (const it of itemsIn) {
    if (items.length >= MAX_ITEMS) break;
    const v = roadmapItem(it);
    if (v) items.push(v);
  }
  if (itemsIn.length > 0 && items.length === 0) return null;
  if (!items.length) return null;
  return {
    theme: clean(o.theme, 60),
    color: typeof o.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.color) ? o.color : '#7856d6',
    order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : 99,
    items,
  };
}
function changelogRelease(raw: unknown): BzrChangelogRelease | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'string' || !clean(o.version, 20)) return null;
  const out: BzrChangelogRelease = { version: clean(o.version, 20) };
  if (typeof o.date === 'string' && isIsoDate(o.date)) out.date = o.date;
  for (const key of ['added', 'improved', 'fixed'] as const) {
    const list = o[key];
    if (!Array.isArray(list)) continue;
    const items: BzrChangelogEntry[] = [];
    for (const it of list) {
      if (items.length >= MAX_ITEMS) break;
      const v = changelogEntry(it);
      if (v) items.push(v);
    }
    if (items.length) out[key] = items;
  }
  if (!out.added && !out.improved && !out.fixed) return null;
  return out;
}
function nonneg(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100_000_000
    ? Math.round(raw) : 0;
}

/**
 * 整份远端 JSON → 配置；`null` = 这份内容不可用（换源 / 保留旧数据）。
 * 某一块坏只丢那一块里的坏条目；关键块（changelog / roadmap / links）全坏 → null。
 */
export function parseBzrData(raw: unknown): BzrData | null {
  let doc: unknown = raw;
  if (typeof raw === 'string') {
    try { doc = JSON.parse(raw); } catch { return null; }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const o = doc as Record<string, unknown>;

  const changelogIn = Array.isArray(o.changelog) ? o.changelog : [];
  const changelog: BzrChangelogRelease[] = [];
  for (const it of changelogIn) {
    if (changelog.length >= MAX_ITEMS) break;
    const v = changelogRelease(it);
    if (v) changelog.push(v);
  }
  const roadmapIn = Array.isArray(o.roadmap) ? o.roadmap : [];
  const roadmap: RoadmapTheme[] = [];
  for (const it of roadmapIn) {
    if (roadmap.length >= MAX_ITEMS) break;
    const v = roadmapTheme(it);
    if (v) roadmap.push(v);
  }
  const li = o.links && typeof o.links === 'object' ? o.links as Record<string, unknown> : {};
  const links: BzrLinks = {
    support: safeFeedbackUrl(typeof li.support === 'string' ? li.support : '') ?? '',
    buy: safeFeedbackUrl(typeof li.buy === 'string' ? li.buy : '') ?? '',
  };
  /* 路线图允许为空（作者会清掉演示数据）：只要日志与跳转地址还在，这份数据就可用 */
  if (!changelog.length || !links.support || !links.buy) return null;

  const st = o.stats && typeof o.stats === 'object' ? o.stats as Record<string, unknown> : {};
  return {
    version: typeof o.version === 'number' ? o.version : 1,
    updatedAt: typeof o.updatedAt === 'string' && isIsoDate(o.updatedAt) ? o.updatedAt : '',
    changelog,
    roadmap,
    feedback: feedbackGroups(o.feedback),
    stats: { reward: nonneg(st.reward), pro: nonneg(st.pro), patrons: nonneg(st.patrons) },
    links,
  };
}

/* ── 内置兜底：离线也有得看，发版时随包更新 ───────────────── */

const BUILTIN: BzrData = {
  version: 1,
  updatedAt: '',
  changelog: [],
  roadmap: [
    { theme: '路线图', color: '#7856d6', order: 1, items: [
      { title: '路线图数据已更新，请联网查看', state: 'plan', src: 'builtin',
        fb: { kind: 'issue', n: 1, label: '#1', href: '' } },
    ] },
  ],
  feedback: [
    { key: 'bug', items: [] },
    { key: 'feature', items: [] },
  ],
  stats: { reward: 0, pro: 0, patrons: 0 },
  links: {
    support: SPONSOR_URL,
    buy: SPONSOR_URL,
  },
};

/* ── 内存 / 缓存 / 拉取 ──────────────────────────────────── */

type BzrStatus = 'idle' | 'loading' | 'ready' | 'failed';
let memory: BzrData | null = null;
let cacheRead = false;
let status: BzrStatus = 'idle';
let lastAttempt = 0;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<(d: BzrData) => void>();

function bust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}
async function requestText(url: string, timeoutMs: number): Promise<string | null> {
  let timer: number | null = null;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), timeoutMs);
    });
    const req = requestUrl({ url, method: 'GET', throw: false }).then((resp) =>
      resp && resp.status >= 200 && resp.status < 300 ? resp.text : null,
    );
    return await Promise.race([req, timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}
let http: BzrHttp = requestText;

interface CacheDoc { v: number; at: number; data: BzrData }
function readCache(): { data: BzrData; at: number } | null {
  try {
    const raw = window.localStorage.getItem(BZR_CACHE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as Partial<CacheDoc> | null;
    if (!doc || doc.v !== BZR_CACHE_VERSION || !doc.data) return null;
    const data = parseBzrData(doc.data);
    if (!data) return null;
    const at = typeof doc.at === 'number' && Number.isFinite(doc.at) ? doc.at : 0;
    return { data, at };
  } catch {
    return null;
  }
}
function writeCache(data: BzrData, at: number): void {
  try {
    window.localStorage.setItem(BZR_CACHE_KEY, JSON.stringify({ v: BZR_CACHE_VERSION, at, data } satisfies CacheDoc));
  } catch {
    /* 隐私模式 / 配额满：内存里还有，写不进去不算错 */
  }
}
function ensureLoaded(): void {
  if (cacheRead) return;
  cacheRead = true;
  const c = readCache();
  if (c) {
    memory = c.data;
    status = 'ready';
  }
}
function fallback(): BzrData {
  /* 内置兜底要带上当前日志，离线也能弹（由 shell 注入，这里只给结构） */
  return BUILTIN;
}
function notify(): void {
  const d = currentBzrData();
  for (const fn of [...listeners]) {
    try { fn(d); } catch { /* 一个订阅者抛错不挡其余 */ }
  }
}

/** 当前配置（同步）；没拿到远端时给内置兜底 */
export function currentBzrData(): BzrData {
  ensureLoaded();
  return memory ?? fallback();
}
export function bzrDataStatus(): BzrStatus {
  ensureLoaded();
  return status;
}
export function bzrDataFetchedAt(): number {
  ensureLoaded();
  const c = readCache();
  return c ? c.at : 0;
}
export function onBzrDataChange(fn: (d: BzrData) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function fetchFirstValid(): Promise<BzrData | null> {
  const urls = BZR_URLS.map(bust);
  return new Promise((resolve) => {
    let pending = urls.length, settled = false;
    for (const url of urls) {
      Promise.resolve()
        .then(() => http(url, FETCH_TIMEOUT_MS))
        .then((text) => {
          if (settled || text == null) return;
          const data = parseBzrData(text);
          if (!data) return;
          settled = true;
          resolve(data);
        })
        .catch(() => undefined)
        .finally(() => {
          pending -= 1;
          if (pending === 0 && !settled) { settled = true; resolve(null); }
        });
    }
  });
}

/** 拉一次。force 只给手动刷新用；返回值表示这次有没有拿到新内容 */
export async function refreshBzrData(opts: { force?: boolean } = {}): Promise<boolean> {
  ensureLoaded();
  if (inflight) return inflight;
  const now = Date.now();
  if (!opts.force && now - lastAttempt < BZR_REFRESH_GAP_MS) return false;
  lastAttempt = now;
  if (!memory) status = 'loading';
  inflight = (async () => {
    try {
      const data = await fetchFirstValid();
      if (!data) {
        if (!memory) { status = 'failed'; notify(); }
        return false;
      }
      memory = data;
      status = 'ready';
      writeCache(data, Date.now());
      notify();
      return true;
    } catch {
      if (!memory) { status = 'failed'; notify(); }
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/* ── 测试注入 ─────────────────────────────────────────────── */
export function _resetBzrDataForTests(): void {
  memory = null; cacheRead = false; status = 'idle';
  lastAttempt = 0; inflight = null; listeners.clear(); http = requestText;
}
export function _setBzrHttpForTests(fn: BzrHttp | null): void {
  http = fn || requestText;
}
