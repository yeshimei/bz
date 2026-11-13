/**
 * clipbook（剪藏本融合域）：对外门面 —— 给 bz-reader「剪藏成书」用的窄口。
 *
 * 与 knowledge / readerAi 同范式（ADR-0215 / ADR-0294）：阅读器不猜存储路径、
 * 不复制剪藏本的状态机，只经 `app.plugins.getPlugin('bz').clipbook` 拿它要的东西。
 *
 * 五件事：
 *   sources()      订阅源清单（含订阅了但还没抓到文章的源）
 *   articles()     文章清单（元数据，不带正文）
 *   articleBody()  单篇正文（Markdown）
 *   markRead()     标已读（只对未读的订阅文章生效）
 *   saveArticle()  存进剪藏本（走 bz 自己的写入与事件链）
 *
 * 纯逻辑 + 依赖注入：本文件不 import 任何会碰 DOM / 存储的模块，
 * 真实依赖在 facade-host.ts 里接，node 环境可测。
 */
import { articleKeyOf, excerpt } from './constants';
import { stripClipChrome } from './md';
import { platformOf } from './store';
import type { ClipbookData } from './data';
import type { ClipNote } from './scan';
import type { NewsSources, RssFeed } from './news-data';

export type ClipSourceKind = 'rss' | 'bilibili' | 'platform' | 'site';

export interface ClipSourceRow {
  /** 稳定 id：rss:<url> / bili:<uid> / platform:<zhihu|guokr> / site:<站点名> */
  id: string;
  name: string;
  kind: ClipSourceKind;
}

export type ClipArticleState = 'unread' | 'read' | 'saved';

export interface ClipFacadeArticle {
  /** 稳定标识：news = articleKeyOf；剪藏 = clip:<路径> */
  key: string;
  origin: 'news' | 'clip';
  title: string;
  url: string;
  author: string;
  /** 归属源 id / 展示名（与 sources() 对齐） */
  sourceId: string;
  source: string;
  date: string;
  ts: number;
  summary: string;
  /**
   * 正文长度（字符数）。阅读器拿它估整本书的页数：以前没有这个字段，
   * 每章一律按 1200 兜底，23 章的剪藏本整本总页数会在 23 / 46 / 1541 之间乱跳。
   * 剪藏笔记（origin=clip）在清单阶段不读正文，给 0，由阅读器按实际渲染回填。
   */
  size: number;
  state: ClipArticleState;
  notePath: string | null;
  tags: string[];
}

/** 内部行：多带一份 news 原文（markRead / saveArticle 要原始对象，不出门面） */
export interface ClipExportRow extends ClipFacadeArticle {
  raw?: any;
}

export interface ClipExportIndex {
  sources: ClipSourceRow[];
  rows: ClipExportRow[];
}

export interface ExportBuildInput {
  articles: any[];
  clips: ClipNote[] | null;
  rssFeeds: RssFeed[];
  upIds: string[];
  upInfo: Record<string, { name?: string }>;
  sources: NewsSources;
}

const PLATFORM_ROWS: Array<{ key: 'zhihu' | 'guokr'; id: string; name: string }> = [
  { key: 'zhihu', id: 'platform:zhihu', name: '知乎日报' },
  { key: 'guokr', id: 'platform:guokr', name: '果壳科学人' },
];

/** FNV-1a 32 位：数据版本指纹（与阅读器那边同算法，两边不用互认，只要稳定） */
export function fnv(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function norm(s: unknown): string {
  return String(s ?? '').trim();
}

/** 时间戳：优先 fetchedAt/date（news）或 created（剪藏），解析失败退回 0 */
function tsOf(raw: any, fallback = 0): number {
  const first = raw?.fetchedAt || raw?.date;
  const a = new Date(first).valueOf();
  if (!Number.isNaN(a)) return a;
  const b = new Date(raw?.date).valueOf();
  return Number.isNaN(b) ? fallback : b;
}

/** 时间戳 → 「YYYY-MM-DD HH:mm:ss」（与 news 的 date 同一写法；给阅读器副标题用） */
function fmtTs(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const d = new Date(ts);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(
    d.getSeconds(),
  )}`;
}

/**
 * 把 news.json + 剪藏目录归一成「源清单 + 文章清单」。
 *
 * 口径（与剪藏本自己的列表一致）：
 * - 同一 URL 两侧都有 → 剪藏笔记代表这一篇（正文完整、可能带本地图），news 条目剔除；
 * - 状态：剪藏 = saved；news 已读 = read（state=saved 也是 saved）；否则 unread；
 * - 源：RSS 订阅按 platform 命中；B站按 author（uid）归 UP；平台按开关列；
 *   命中不了的落 site:<站点>，不让文章凭空消失。
 */
export function buildExportIndex(input: ExportBuildInput): ClipExportIndex {
  const sources: ClipSourceRow[] = [];
  const seen = new Set<string>();
  const pushSource = (s: ClipSourceRow): void => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    sources.push(s);
  };

  const feedByName = new Map<string, ClipSourceRow>();
  for (const f of input.rssFeeds || []) {
    const url = norm(f?.url);
    if (!url) continue;
    const row: ClipSourceRow = {
      id: `rss:${url}`,
      name: norm(f?.title) || url,
      kind: 'rss',
    };
    feedByName.set(norm(row.name), row);
    pushSource(row);
  }

  const upIds = new Set<string>();
  for (const id of input.upIds || []) if (norm(id)) upIds.add(norm(id));
  for (const id of Object.keys(input.upInfo || {})) if (norm(id)) upIds.add(norm(id));
  const upByName = new Map<string, ClipSourceRow>();
  for (const uid of upIds) {
    const row: ClipSourceRow = {
      id: `bili:${uid}`,
      name: norm(input.upInfo?.[uid]?.name) || uid,
      kind: 'bilibili',
    };
    upByName.set(norm(row.name), row);
    pushSource(row);
  }

  const platformRows = new Map<string, ClipSourceRow>();
  for (const p of PLATFORM_ROWS) {
    if (!input.sources?.[p.key]) continue;
    const row: ClipSourceRow = { id: p.id, name: p.name, kind: 'platform' };
    platformRows.set(p.name, row);
    pushSource(row);
  }

  const siteRows = new Map<string, ClipSourceRow>();
  const siteOf = (name: string): ClipSourceRow => {
    const clean = norm(name) || '未知';
    const hit = siteRows.get(clean);
    if (hit) return hit;
    const row: ClipSourceRow = { id: `site:${clean}`, name: clean, kind: 'site' };
    siteRows.set(clean, row);
    pushSource(row);
    return row;
  };

  /** 源归属：RSS 标题 → UP 名 → 平台名 → 站点兜底 */
  const sourceFor = (site: string, platform: string, author: string): ClipSourceRow => {
    const p = norm(platform);
    if (p === 'B站') {
      const uid = norm(author);
      const byId = sources.find((s) => s.kind === 'bilibili' && s.id === `bili:${uid}`);
      if (byId) return byId;
      const row: ClipSourceRow = { id: `bili:${uid || '未知'}`, name: norm(input.upInfo?.[uid]?.name) || uid || 'B站', kind: 'bilibili' };
      pushSource(row);
      return row;
    }
    const byName = feedByName.get(p) || upByName.get(p) || platformRows.get(p);
    if (byName) return byName;
    return siteOf(norm(site) || p);
  };

  // 剪藏先入（URL 去重时由它代表）
  const clipUrls = new Set<string>();
  const rows: ClipExportRow[] = [];
  for (const n of input.clips || []) {
    const url = norm(n?.url);
    if (url) clipUrls.add(url);
    const src = sourceFor(n?.site || '', n?.site || '', n?.author || '');
    rows.push({
      key: `clip:${n.path}`,
      origin: 'clip',
      title: norm(n.title) || '(无标题)',
      url,
      author: norm(n.author),
      sourceId: src.id,
      source: src.name,
      /* 剪藏行的 date 以前是空串：剪藏之后副标题只剩源名、日期整段消失
         （真机：剪藏后「… · 2026-11-06」不见了）。用 created 补回来。 */
      date: fmtTs(Number(n.created) || 0),
      ts: Number(n.created) || 0,
      summary: norm(n.summary),
      /* 正文在清单阶段不读盘：给 0，阅读器渲染这一章时会回填真实长度 */
      size: 0,
      state: 'saved',
      notePath: norm(n.path) || null,
      tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
    });
  }

  const taken = new Set<string>();
  for (const a of input.articles || []) {
    const url = norm(a?.url);
    if (url && clipUrls.has(url)) continue;
    const key = articleKeyOf(a);
    if (taken.has(key)) continue;
    taken.add(key);
    const platform = platformOf(a);
    const src = sourceFor(a?.site || platform, platform, a?.author || '');
    rows.push({
      key,
      origin: 'news',
      title: norm(a?.title) || '(无标题)',
      url,
      author: norm(a?.author),
      sourceId: src.id,
      source: src.name,
      date: norm(a?.date || a?.fetchedAt),
      ts: tsOf(a),
      /* 只有**在阅读器里生成过的**摘要才进这个字段（`aiSummary`）。
         不能拿 news 自带的 `summary` 顶上：那是 RSS 的 description
         （少数派给的是「……等。查看全文」这种一句半），内容和正文开头一模一样，
         摆到标题下方等于把第一段抄了两遍——真机截图当场就露馅。 */
      summary: norm(a?.aiSummary),
      size: norm(a?.body).length,
      state: a?.read === true ? (a?.state === 'saved' ? 'saved' : 'read') : 'unread',
      notePath: null,
      tags: Array.isArray(a?.tags) ? a.tags.map(String) : [],
      raw: a,
    });
  }

  rows.sort((x, y) => y.ts - x.ts);
  return { sources, rows };
}

export interface ClipbookFacadeDeps {
  readIndex(): Promise<ClipExportIndex>;
  readNote(path: string): Promise<string>;
  /** 把一批 news 原文标已读；返回实际变更数 */
  markRead(raws: any[]): Promise<number>;
  /** 存进剪藏本；notePath 由实现方按标题算好 */
  save(raw: any): Promise<{ ok: boolean; notePath?: string }>;
  /** 给一篇订阅文章生成 AI 摘要并写回（阅读器标题下方那一段） */
  summarize(raw: any): Promise<ClipSummaryResult>;
  isFolderReady(): boolean;
  /**
   * 数据版本（剪藏成书「实时更新」用）：news.json / clipbook.json / 剪藏目录
   * 任一有变化就要变。阅读器轮询它决定要不要重建目录。
   */
  dataVersion(): Promise<string>;
  /** 打开剪藏本主界面（与命令 bz-clipbook-open 同一入口） */
  open(): void;
}

/** 摘要失败原因码：阅读器自己翻译成当前语言 */
export type ClipSummaryFailCode = 'notFound' | 'aiFailed' | 'writeFailed';

export interface ClipSummaryResult {
  ok: boolean;
  summary?: string;
  code?: ClipSummaryFailCode;
}

export interface ClipSaveResult {
  ok: boolean;
  notePath?: string;
  /** 失败原因码：阅读器自己翻译成当前语言 */
  code?: 'bilibili' | 'alreadySaved' | 'notFound' | 'noFolder';
}

export interface ClipbookFacade {
  /**
   * 契约版本。2026-11-13 加 `summarizeArticle` 时**没有**跟着升到 2：
   * 阅读器那边一律按 `typeof facade.xxx === 'function'` 探测单个能力，
   * 版本号只用于「门面整体够不够新」的判断，升它会让老阅读器误判成不兼容。
   */
  readonly version: 1;
  sources(): Promise<ClipSourceRow[]>;
  articles(opts?: { savedOnly?: boolean; includeRead?: boolean }): Promise<ClipFacadeArticle[]>;
  articleBody(key: string): Promise<string>;
  markRead(keys: string[]): Promise<number>;
  saveArticle(key: string): Promise<ClipSaveResult>;
  /** 生成这一篇的 AI 摘要并写回剪藏本（只对订阅文章；剪藏笔记的摘要来自 frontmatter） */
  summarizeArticle(key: string): Promise<ClipSummaryResult>;
  isReady(): { ok: boolean; code?: 'noFolder' };
  /** 数据版本：变了说明剪藏本有新文章 / 状态变化 / 笔记改动 */
  dataVersion(): Promise<string>;
  /**
   * 打开剪藏本主界面（2026-11-13）。
   *
   * 阅读器的剪藏本开关在「库里还是空的」时会弹一句提醒，那个「去设置」按钮
   * 走这里——与命令 bz-clipbook-open 同一个入口。放进同一个门面而不是另挂
   * 一个对象：剪藏本对外只有这一个面，两套会让调用方不知道该信哪个。
   */
  open(): void;
}

/** 门面对象：每次调用都重新读盘，不缓存（用户随时可能在剪藏本里改东西） */
export function createClipbookFacade(deps: ClipbookFacadeDeps): ClipbookFacade {
  const find = (idx: ClipExportIndex, key: string): ClipExportRow | undefined =>
    idx.rows.find((r) => r.key === key);

  return {
    version: 1,

    async sources() {
      return (await deps.readIndex()).sources;
    },

    async articles(opts) {
      const idx = await deps.readIndex();
      return idx.rows
        .filter((r) => (opts?.savedOnly ? r.state === 'saved' : true))
        /* 「不含已读」只剔掉 read；剪藏（saved）是另一种状态，不能被当成已读一起丢 */
        .filter((r) => (opts?.includeRead === false ? r.state !== 'read' : true))
        .map(({ raw: _raw, ...rest }) => rest);
    },

    async articleBody(key) {
      const idx = await deps.readIndex();
      const row = find(idx, key);
      if (!row) return '';
      if (row.origin === 'clip') {
        if (!row.notePath) return '';
        try {
          return stripClipChrome(await deps.readNote(row.notePath));
        } catch {
          return '';
        }
      }
      return String(row.raw?.body ?? '');
    },

    async markRead(keys) {
      const wanted = new Set(keys || []);
      if (!wanted.size) return 0;
      const idx = await deps.readIndex();
      let bumped = 0;
      for (const row of idx.rows) {
        if (!wanted.has(row.key)) continue;
        if (row.origin !== 'news' || row.state !== 'unread' || !row.raw) continue;
        bumped += await deps.markRead([row.raw]);
      }
      return bumped;
    },

    async saveArticle(key) {
      const idx = await deps.readIndex();
      const row = find(idx, key);
      if (!row) return { ok: false, code: 'notFound' };
      if (row.state === 'saved' && row.notePath) return { ok: false, code: 'alreadySaved', notePath: row.notePath };
      if (row.origin !== 'news' || !row.raw) return { ok: false, code: 'alreadySaved', notePath: row.notePath ?? undefined };
      if (platformOf(row.raw) === 'B站') return { ok: false, code: 'bilibili' };
      if (!deps.isFolderReady()) return { ok: false, code: 'noFolder' };
      const out = await deps.save(row.raw);
      return out.ok ? { ok: true, notePath: out.notePath } : { ok: false, code: 'notFound' };
    },

    async summarizeArticle(key) {
      const idx = await deps.readIndex();
      const row = find(idx, key);
      /* 剪藏笔记（origin=clip）的摘要在它自己的 frontmatter 里，由知识盒 / 剪藏本
         维护；这里只给「还没落地成笔记」的订阅文章补摘要。 */
      if (!row || row.origin !== 'news' || !row.raw) return { ok: false, code: 'notFound' };
      return deps.summarize(row.raw);
    },

    isReady() {
      return deps.isFolderReady() ? { ok: true } : { ok: false, code: 'noFolder' };
    },

    async dataVersion() {
      return deps.dataVersion();
    },

    open() {
      deps.open();
    },
  };
}

/** 门面状态单源（main.ts 挂载 / 卸载时用；未挂载 = 老版本 bz，调用方 typeof 探测失败） */
export type { ClipbookData };
